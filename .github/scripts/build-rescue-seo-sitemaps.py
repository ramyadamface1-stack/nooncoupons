#!/usr/bin/env python3
"""Create read-only-serving sitemap manifests in the EXISTING new R2 bucket.

Only indexes already published + independently quality-scored article records.
No old-account R2 reads, no article mutations, no new buckets, no DO writes.
"""
import os
import sys
import re
import json
import math
import datetime
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.config import Config
from botocore.exceptions import ClientError
import boto3

ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET = "nooncoupons-content-v2"
PREFIX = "seo-rescue/"
SEGMENT_SIZE = 2000
READ_WORKERS = 10
NOW = datetime.datetime.now(datetime.timezone.utc)
assert os.environ.get("NOON_NEW_R2_ACCESS_KEY_ID") and os.environ.get("NOON_NEW_R2_SECRET_ACCESS_KEY")
s3 = boto3.client("s3", region_name="auto",
    endpoint_url=f"https://{ACCOUNT}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ["NOON_NEW_R2_ACCESS_KEY_ID"].strip(),
    aws_secret_access_key=os.environ["NOON_NEW_R2_SECRET_ACCESS_KEY"].strip(),
    config=Config(max_pool_connections=18, connect_timeout=10, read_timeout=45,
                  retries={"max_attempts":4, "mode":"standard"}))

def read(key):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    try:
        return json.load(obj["Body"])
    finally:
        obj["Body"].close()

def valid_date(s):
    try:
        value = datetime.datetime.fromisoformat(str(s or "").replace("Z", "+00:00"))
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime.timezone.utc)
        if value > NOW + datetime.timedelta(minutes=5):
            return None
        return value.isoformat().replace("+00:00", "Z")
    except Exception:
        return None

def valid_slug(v):
    s = str(v or "").strip()
    return len(s) <= 280 and len(s) > 5 and "/" not in s and "\\" not in s and ".." not in s and not s.startswith("en-")

def qualifies(a):
    if not isinstance(a, dict): return "invalid"
    if a.get("status") != "published": return "not_published"
    if a.get("indexable") is False or a.get("superseded") or a.get("orphan") or a.get("duplicateIntent"):
        return "not_indexable"
    if not valid_slug(a.get("slug")): return "slug"
    if a.get("country") not in ("SA", "AE"): return "country"
    if float(a.get("quality") or 0) < 95: return "quality"
    if a.get("qualityFloor") is not None and float(a.get("qualityFloor")) < 88: return "quality_floor"
    if int(a.get("wordCount") or 0) < 1500: return "word_count"
    if not valid_date(a.get("createdAt") or a.get("publishedAt") or a.get("updatedAt")):return "date"
    return None

def main():
    days = read("bulk/days.json").get("days") or []
    indices = []
    for row in days:
        day = str(row.get("day", ""))
        if not re.fullmatch(r"20\d\d-\d\d-\d\d",day) or day > NOW.date().isoformat():
            continue
        shards = int(row.get("shards") or 0)
        if shards > 2500:
            print("UNUSUALLY_LARGE_DAY="+day+" "+str(shards),flush=True)
            sys.exit(3)
        indices.extend((day,i) for i in range(shards))
    if len(indices)>4000:raise RuntimeError("too_many_shards_review_required")
    print("SOURCE_DAYS="+str(len(days)),flush=True)
    print("INDEX_SHARDS_TO_READ="+str(len(indices)),flush=True)
    items = {}
    skipped = {}
    missing = 0
    failed = []
    def worker(di):
        day,i = di
        key = f"bulk/day/{day}/{i}.json"
        try:
            return key,read(key).get("articles") or [],None
        except ClientError as e:
            if e.response.get("Error",{}).get("Code") in ("NoSuchKey","404","NotFound"):
                return key,[], "missing"
            return key,[],str(e)[:120]
        except Exception as e:
            return key,[],str(e)[:120]
    with ThreadPoolExecutor(max_workers=READ_WORKERS) as pool:
        fs=[pool.submit(worker,di) for di in indices]
        for future in as_completed(fs):
            key,rows,error=future.result()
            if error:
                if error=="missing":missing+=1
                else:failed.append((key,error))
                continue
            for a in rows:
                try:reason=qualifies(a)
                except Exception:reason="bad_record"
                if reason:
                    skipped[reason]=skipped.get(reason,0)+1
                    continue
                slug=str(a["slug"]); date=valid_date(a.get("updatedAt") or a.get("createdAt"))
                entry={"slug":slug,"country":a["country"],"code":str(a.get("coupon") or a.get("code") or "")[:25],"lastmod":date[:10],"quality":int(a["quality"])}
                previous=items.get(slug)
                if previous is None or entry["lastmod"]>previous["lastmod"]:items[slug]=entry
    print("INDEX_FILES_MISSING="+str(missing),flush=True)
    print("INDEX_FILES_ERRORS="+str(len(failed)),flush=True)
    if failed:print("READ_ERRORS="+json.dumps(failed[:6]),flush=True)
    print("ELIGIBLE_UNIQUE="+str(len(items)),flush=True)
    print("REJECTED_COUNTS="+json.dumps(skipped,sort_keys=True),flush=True)
    if failed or missing>0:raise RuntimeError("incomplete index read; no published sitemap write")
    if len(items)<100:raise RuntimeError("unexpectedly few eligible entries; no publish")
    values=sorted(items.values(),key=lambda r:(r["country"],r["slug"]))
    segments=[]
    for n in range(math.ceil(len(values)/SEGMENT_SIZE)):
        chunk=values[n*SEGMENT_SIZE:(n+1)*SEGMENT_SIZE]
        name=f"{PREFIX}articles-{n}.json"
        segments.append({"n":n,"key":name,"count":len(chunk)})
    manifest={"version":1,"generatedAt":NOW.isoformat(),"source":"quality-gated bulk/day indices mirrored in destination R2","count":len(values),
              "segmentSize":SEGMENT_SIZE,"segments":segments,
              "excluded":skipped,"daysScanned":len(days),"readObjects":len(indices)}
    # Manifest is written only AFTER verifying and writing ALL segment objects.
    for seg in segments:
        n=seg["n"]
        data=json.dumps({"version":1,"articles":values[n*SEGMENT_SIZE:(n+1)*SEGMENT_SIZE]},
            ensure_ascii=False,separators=(",",":")).encode("utf-8")
        s3.put_object(Bucket=BUCKET,Key=seg["key"],Body=data,ContentType="application/json; charset=utf-8",CacheControl="public,max-age=600")
        check=s3.head_object(Bucket=BUCKET,Key=seg["key"])
        if check["ContentLength"]!=len(data):raise RuntimeError("segment size mismatch")
        if n % 10==0:print(f"SEGMENT_WRITTEN={n+1}/{len(segments)}",flush=True)
    data=json.dumps(manifest,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    s3.put_object(Bucket=BUCKET,Key=PREFIX+"index.json",Body=data,ContentType="application/json; charset=utf-8",CacheControl="public,max-age=600")
    stored=read(PREFIX+"index.json")
    if stored.get("count")!=len(values) or len(stored.get("segments") or [])!=len(segments):
        raise RuntimeError("manifest verification failed")
    print("SITEMAP_MANIFEST_VERIFIED=true",flush=True)
    print("SITEMAP_MANIFEST_ARTICLES="+str(len(values)),flush=True)
    print("SITEMAP_MANIFEST_PARTS="+str(len(segments)),flush=True)

if __name__=="__main__":
    main()
