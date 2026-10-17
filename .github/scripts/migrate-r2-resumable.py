#!/usr/bin/env python3
"""Non-destructive, resumable two-account R2 copy. Never deletes or overwrites."""
import os, time, tempfile, hashlib, threading, sys, re
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import boto3
import botocore
from botocore.config import Config
from boto3.s3.transfer import TransferConfig

SOURCE_ACCOUNT = "c82274152a942dea53044eae7153cfd7"
TARGET_ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET = "nooncoupons-content-v2"
PREFIXES = ("articles/", "quality/", "maintenance/", "bulk/", "english-canary/", "_ops/", "freshness/", "legacy-upgrade/")
COPY_WORKERS = 8
QUEUE_LIMIT = COPY_WORKERS * 5
CHUNK_SIZE = 1024 * 1024
SMALL_LIMIT = 8 * CHUNK_SIZE
TRANSFER = TransferConfig(multipart_threshold=16 * CHUNK_SIZE, multipart_chunksize=8 * CHUNK_SIZE, use_threads=False)
CFG = Config(signature_version="s3v4", connect_timeout=10, read_timeout=70,
             max_pool_connections=24, retries={"max_attempts":5,"mode":"standard"})
FIELDS = ("ContentType", "CacheControl", "ContentDisposition", "ContentEncoding", "ContentLanguage", "Expires")
lock = threading.Lock()
totals = {"source_seen":0, "copied":0,"resumed":0, "bytes_copied":0, "bytes_resumed":0, "source_pages":0, "verified":0, "errors":0}
start = time.monotonic()
# Bounded 310 min run to leave enough time for Actions cleanup.
time_limit_seconds = 310 * 60

def cred(name, n):
    value=os.environ.get(name,"").strip()
    if not re.fullmatch(r"[0-9a-fA-F]{"+str(n)+r"}", value):
        raise ValueError("invalid_credential_format:"+name)
    return value

def client(account, a, b):
    return boto3.client("s3",region_name="auto",
       endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
       aws_access_key_id=cred(a,32),aws_secret_access_key=cred(b,64),config=CFG)

old = client(SOURCE_ACCOUNT,"NOON_OLD_R2_ACCESS_KEY_ID","NOON_OLD_R2_SECRET_ACCESS_KEY")
new = client(TARGET_ACCOUNT,"NOON_NEW_R2_ACCESS_KEY_ID","NOON_NEW_R2_SECRET_ACCESS_KEY")

def sha(body):
    h=hashlib.sha256()
    size=0
    with tempfile.SpooledTemporaryFile(max_size=SMALL_LIMIT) as tmp:
        while True:
            chunk=body.read(CHUNK_SIZE)
            if not chunk: break
            tmp.write(chunk)
            h.update(chunk)
            size += len(chunk)
        tmp.seek(0)
        return h.hexdigest(), size

def content_and_digest(body):
    h=hashlib.sha256()
    size=0
    tmp=tempfile.SpooledTemporaryFile(max_size=SMALL_LIMIT)
    try:
        while True:
            part=body.read(CHUNK_SIZE)
            if not part: break
            tmp.write(part)
            h.update(part)
            size+=len(part)
        tmp.seek(0)
        return tmp,h.hexdigest(),size
    except:
        tmp.close()
        raise

def existing_hash(key):
    try:
        o=new.get_object(Bucket=BUCKET,Key=key)
    except botocore.exceptions.ClientError as exc:
        if str(exc.response.get("Error",{}).get("Code")) in ("404","NoSuchKey","NotFound"):
            return None
        raise
    try:
        digest,size=sha(o["Body"])
        return digest,size,{f:o[f] for f in FIELDS if f in o},o.get("Metadata",{})
    finally:
        o["Body"].close()

def migrate_one(entry):
    key=entry["Key"]
    obj=old.get_object(Bucket=BUCKET,Key=key)
    try:
        tmp,digest,size=content_and_digest(obj["Body"])
    finally:
        obj["Body"].close()
    try:
        if size!=int(entry["Size"]):
            raise RuntimeError("source_size_changed_during_copy: "+key)
        headers={f:obj[f] for f in FIELDS if obj.get(f) is not None}
        metadata=obj.get("Metadata",{})
        remote=existing_hash(key)
        if remote is not None:
            digest2,n,h,m=remote
            if digest!=digest2 or n!=size or h!=headers or m!=metadata:
                raise RuntimeError("destination_existing_mismatch_no_overwrite: "+key)
            with lock:
                totals["resumed"]+=1
                totals["bytes_resumed"]+=size
                totals["verified"]+=1
            return
        kwargs=dict(Bucket=BUCKET,Key=key,**headers)
        if metadata: kwargs["Metadata"]=metadata
        # Existing keys are never overwritten. One copy job only, no target publishing.
        if size <= SMALL_LIMIT:
            data=tmp.read()
            new.put_object(Body=data,**kwargs)
        else:
            new.upload_fileobj(tmp,BUCKET,key,ExtraArgs={**headers,**({"Metadata":metadata} if metadata else {})},Config=TRANSFER)
        # Read back every copied object: SHA256 and metadata, not only S3 ETag.
        remote=existing_hash(key)
        if remote is None:
            raise RuntimeError("destination_missing_after_upload: "+key)
        digest2,n,h,m=remote
        if digest2!=digest or n!=size or h!=headers or m!=metadata:
            raise RuntimeError("destination_after_upload_mismatch: "+key)
        with lock:
            totals["copied"]+=1
            totals["bytes_copied"]+=size
            totals["verified"]+=1
    finally:
        tmp.close()

def drain_once(futures):
    done,pending=wait(futures,return_when=FIRST_COMPLETED)
    for fut in done:
        fut.result()
    return pending

def print_status(prefix="COPY_PROGRESS"):
    elapsed=round(time.monotonic()-start,1)
    with lock:
        d=dict(totals)
    print(prefix+" "+" ".join(f"{k}={v}" for k,v in d.items())+f" elapsed={elapsed}",flush=True)

def main():
    # Destination is an isolated staging bucket; no traffic or publisher uses it.
    futures=set()
    last_report=0
    with ThreadPoolExecutor(max_workers=COPY_WORKERS) as pool:
        try:
            for prefix in PREFIXES:
                token=None
                while True:
                    if time.monotonic()-start>time_limit_seconds:
                        raise TimeoutError("time_budget_reached_resume_required")
                    args={"Bucket":BUCKET,"Prefix":prefix,"MaxKeys":1000}
                    if token: args["ContinuationToken"]=token
                    page=old.list_objects_v2(**args)
                    totals["source_pages"]+=1
                    for entry in page.get("Contents",()):
                        if time.monotonic()-start>time_limit_seconds:
                            raise TimeoutError("time_budget_reached_resume_required")
                        totals["source_seen"]+=1
                        futures.add(pool.submit(migrate_one,entry))
                        if len(futures)>=QUEUE_LIMIT:
                            futures=drain_once(futures)
                        if totals["source_seen"]-last_report >= 3000:
                            print_status()
                            last_report=totals["source_seen"]
                    if not page.get("IsTruncated",False):
                        break
                    t=page.get("NextContinuationToken")
                    if not t or t==token: raise RuntimeError("invalid_pagination_token:"+prefix)
                    token=t
                # Drain at each prefix: useful audit checkpoint.
                while futures: futures=drain_once(futures)
                print_status("COPY_PREFIX_COMPLETED_"+prefix.replace("/",""))
            while futures: futures=drain_once(futures)
        except:
            print_status("COPY_STOPPED")
            raise
    if totals["source_seen"]!=totals["verified"]:
        raise RuntimeError("verification_incomplete")
    print_status("COPY_COMPLETE")
    with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as f:
        f.write("### R2 safe cross-account copy\n\n")
        for k,v in totals.items(): f.write(f"- {k}: **{v}**\n")
        f.write("\n**No deletes or DNS changes.** Source may still receive new writes; final delta and Durable Object migration required before cutover.\n")

if __name__=="__main__":
    main()
