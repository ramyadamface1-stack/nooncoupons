#!/usr/bin/env python3
"""Incremental immutable article mirror from old to new R2; no deletes or overwrites."""
import os, re, io, json, time, hashlib, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

BUCKET="nooncoupons-content-v2"
SOURCE="c82274152a942dea53044eae7153cfd7"
DEST="e4c35f8a50a7b2e4cfb9d6c534962603"
PREFIX="articles/"
HEADERS=("ContentType","CacheControl","ContentDisposition","ContentEncoding","ContentLanguage","Expires")
SIZE_CAP=8*1024*1024
CONFIG=Config(signature_version="s3v4",connect_timeout=10,read_timeout=55,
              max_pool_connections=28,retries={"max_attempts":4,"mode":"standard"})

def cred(name,n):
    value=os.environ.get(name,"").strip()
    if not re.fullmatch("[A-Fa-f0-9]{"+str(n)+"}",value):
        raise RuntimeError("credential_missing_or_invalid_format:"+name)
    return value

def connect(account,aid,secret):
    return boto3.client("s3",region_name="auto",
        endpoint_url="https://"+account+".r2.cloudflarestorage.com",
        aws_access_key_id=cred(aid,32),aws_secret_access_key=cred(secret,64),
        config=CONFIG)

def list_articles(client):
    # R2 ListObjectsV2 only; avoid article HEAD or content GET for unchanged keys.
    result={}
    pages=0
    for page in client.get_paginator("list_objects_v2").paginate(
            Bucket=BUCKET,Prefix=PREFIX,PaginationConfig={"PageSize":1000}):
        pages+=1
        for obj in page.get("Contents",()):
            key=obj["Key"]
            if not key.endswith(".html"):
                continue
            if key in result:
                raise RuntimeError("duplicate_key_in_listing")
            result[key]={"size":int(obj.get("Size",0)),"etag":str(obj.get("ETag",""))}
        if pages%100==0:
            print("DELTA_LIST_PROGRESS pages="+str(pages)+" articles="+str(len(result)),flush=True)
        if pages>500:
            raise RuntimeError("article_inventory_over_500_pages")
    return result,pages

def get_article(client,key):
    res=client.get_object(Bucket=BUCKET,Key=key)
    try:
        data=res["Body"].read(SIZE_CAP+1)
    finally:
        res["Body"].close()
    if len(data)>SIZE_CAP:
        raise RuntimeError("article_exceeds_8MB")
    attrs={k:res[k] for k in HEADERS if res.get(k) is not None}
    meta=res.get("Metadata",{})
    return data,attrs,meta

def transfer_one(key,expected,source,dest):
    data,attrs,metadata=get_article(source,key)
    if len(data)!=expected["size"]:
        # Source changed during LIST and GET; retry next run, never copy inconsistent bytes.
        return "source_changed"
    # A staging-only destination is not supposed to write concurrently, but protect any
    # unexpected existing object with one HEAD *per missing article*, never per listing.
    try:
        already=dest.head_object(Bucket=BUCKET,Key=key)
    except ClientError as exc:
        if str(exc.response.get("Error",{}).get("Code")) not in ("404","NotFound","NoSuchKey"):
            raise
        already=None
    if already:
        if int(already.get("ContentLength",-1))!=len(data):
            raise RuntimeError("destination_preexisting_size_conflict")
        return "exists_since_list"
    kwargs=dict(Bucket=BUCKET,Key=key,Body=data,**attrs)
    if metadata:kwargs["Metadata"]=metadata
    dest.put_object(**kwargs)
    verify,attrs2,meta2=get_article(dest,key)
    if hashlib.sha256(verify).digest()!=hashlib.sha256(data).digest():
        raise RuntimeError("article_sha256_mismatch")
    if attrs2!=attrs or meta2!=metadata:
        raise RuntimeError("article_headers_or_metadata_mismatch")
    return "copied"

def main():
    start=time.monotonic()
    source=connect(SOURCE,"NOON_OLD_R2_ACCESS_KEY_ID","NOON_OLD_R2_SECRET_ACCESS_KEY")
    dest=connect(DEST,"NOON_NEW_R2_ACCESS_KEY_ID","NOON_NEW_R2_SECRET_ACCESS_KEY")
    src,source_pages=list_articles(source)
    dst,dest_pages=list_articles(dest)
    missing=[(key,attrs) for key,attrs in src.items() if key not in dst]
    mismatches=[key for key,attrs in src.items()
                if key in dst and attrs["size"]!=dst[key]["size"]]
    print("ARTICLE_SOURCE_COUNT="+str(len(src)),flush=True)
    print("ARTICLE_TARGET_COUNT_BEFORE="+str(len(dst)),flush=True)
    print("ARTICLE_MISSING_BEFORE="+str(len(missing)),flush=True)
    print("ARTICLE_EXISTING_SIZE_CONFLICTS="+str(len(mismatches)),flush=True)
    if mismatches:
        print("ARTICLE_DELTA_STATUS=blocked_existing_size_conflict")
        raise RuntimeError("immutable_article_conflict_no_overwrite")
    # Budget any one delta run to 5000 articles; hourly schedule resumes on next listing.
    if len(missing)>5000:
        print("ARTICLE_DELTA_BACKLOG="+str(len(missing))+";processing_first=5000")
        missing=missing[:5000]
    stats={"copied":0,"exists_since_list":0,"source_changed":0}
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures=[pool.submit(transfer_one,key,attrs,source,dest) for key,attrs in missing]
        for future in as_completed(futures):
            status=future.result()
            stats[status]+=1
    print("ARTICLE_DELTA_COPIED="+str(stats["copied"]),flush=True)
    print("ARTICLE_DELTA_EXISTED_SINCE_LIST="+str(stats["exists_since_list"]),flush=True)
    print("ARTICLE_DELTA_SOURCE_CHANGED="+str(stats["source_changed"]),flush=True)
    print("ARTICLE_DELTA_REQUIRES_FINAL_QUIESCED_PASS=true")
    print("ARTICLE_DELTA_SECS="+str(round(time.monotonic()-start,1)))
    summary=os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary,"a") as f:
            f.write("### NoonDealsNow R2 article delta — no delete/overwrite\n\n")
            for name,value in (
                ("Old-account article keys at scan",len(src)),
                ("New-account article keys before scan",len(dst)),
                ("Missing at scan",len(missing)),
                ("New SHA256-verified copies",stats["copied"]),
                ("Source modified mid-transfer (retry)",stats["source_changed"]),
                ("Existing size conflicts (block)",len(mismatches)),
                ("Old-account list pages",source_pages),
                ("New-account list pages",dest_pages)):
                f.write(f"- {name}: **{value}**\n")
            f.write("\nOld account still publishes. Final frozen-source delta and full manifest/DO reconciliation are required before DNS cutover.\n")

if __name__=="__main__":
    main()
