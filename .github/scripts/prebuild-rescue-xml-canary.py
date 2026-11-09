#!/usr/bin/env python3
"""Create only THREE prebuilt XML canaries in the existing destination R2 bucket.

The original articles and indexed JSON shards are NEVER altered. Actual XML is
rendered by the existing JS production sitemap function, so code/slug/loc
escaping is byte-for-byte identical. Refuse mismatched, incomplete shards.
"""
import hashlib
import json
import os
import subprocess
import sys

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET = "nooncoupons-content-v2"
TARGETS = (("images", 9), ("images", 25), ("articles", 32))
PREFIX = "seo-rescue/prebuilt-xml/"
ID = os.environ["NOON_NEW_R2_ACCESS_KEY_ID"].strip()
SECRET = os.environ["NOON_NEW_R2_SECRET_ACCESS_KEY"].strip()
if not ID or not SECRET:
    raise RuntimeError("R2 credentials missing; no changes made")
s3 = boto3.client(
    "s3", region_name="auto",
    endpoint_url="https://" + ACCOUNT + ".r2.cloudflarestorage.com",
    aws_access_key_id=ID, aws_secret_access_key=SECRET,
    config=Config(connect_timeout=10, read_timeout=40,
                  retries={"mode": "standard", "max_attempts": 3})
)


def existing_json(key):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    body = obj["Body"].read()
    obj["Body"].close()
    return json.loads(body), str(obj["ETag"]).strip('"')


def main():
    manifest, _ = existing_json("seo-rescue/index.json")
    if manifest.get("version") != 1 or not isinstance(manifest.get("segments"), list):
        raise RuntimeError("published R2 index missing or corrupt; abort")
    if len(manifest["segments"]) < 33:
        raise RuntimeError("published R2 index too short for approved canaries; abort")

    prepared = []
    # Prepare/validate all canaries BEFORE the first derived R2 write.
    for kind, number in TARGETS:
        source = next((s for s in manifest["segments"] if s.get("n") == number), None)
        if not source or not source.get("key") or source.get("count", 0) < 1:
            raise RuntimeError("missing published source for " + kind + str(number))
        original_key = source["key"]
        if not original_key.startswith("seo-rescue/") or not original_key.endswith(".json"):
            raise RuntimeError("unsafe source path in manifest")
        segment, etag = existing_json(original_key)
        count = len(segment.get("articles", []))
        if segment.get("version") != 1 or count != source["count"] or count > 2000:
            raise RuntimeError("source count / published manifest mismatch")
        route = f"/sitemap-rescue-{kind}-{number}.xml"
        result = subprocess.run(
            ["node", "scripts/geo-prebuilt-rescue-xml-render.mjs"],
            input=json.dumps({"path": route, "manifest": manifest,
                              "segment": segment}, ensure_ascii=False).encode(),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90,
            check=False
        )
        if result.returncode != 0:
            raise RuntimeError("canary XML renderer failed on " + route
                               + ": " + result.stderr.decode(errors="replace")[:180])
        xml = result.stdout
        if not xml.startswith(b'<?xml version="1.0"') or len(xml) > 3_000_000:
            raise RuntimeError("invalid prebuilt XML output")
        if xml.count(b"<url>") != count:
            raise RuntimeError("prebuilt URL count differs from published shard")
        if kind == "images" and xml.count(b"<image:image>") != count:
            raise RuntimeError("prebuilt image count differs from published shard")
        prepared.append((kind, number, original_key, etag, xml))
        print(f"PREPARED={route} URLS={count} BYTES={len(xml)}", flush=True)

    for kind, number, original_key, etag, xml in prepared:
        key = f"{PREFIX}{kind}-{number}.xml"
        digest = hashlib.sha256(xml).hexdigest()
        old = None
        try:
            old = s3.head_object(Bucket=BUCKET, Key=key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") not in ("404", "NoSuchKey", "NotFound"):
                raise
        if (old and (old.get("Metadata") or {}).get("source-etag") == etag
                and (old.get("Metadata") or {}).get("xml-sha256") == digest
                and old.get("ContentLength") == len(xml)):
            print(f"ALREADY_CURRENT={key}", flush=True)
            continue
        # Only new derived XML keys, never JSON articles, manifests, or images.
        s3.put_object(
            Bucket=BUCKET, Key=key, Body=xml,
            ContentType="application/xml; charset=utf-8",
            CacheControl="public,max-age=86400",
            Metadata={"source-etag": etag, "source-key": original_key,
                      "xml-sha256": digest, "generated-by": "geo-prebuilt-canary-v1"}
        )
        verify=s3.get_object(Bucket=BUCKET, Key=key)
        body=verify["Body"].read()
        verify["Body"].close()
        if hashlib.sha256(body).hexdigest()!=digest or \
           (verify.get("Metadata") or {}).get("source-etag")!=etag:
            raise RuntimeError("prebuilt XML read-back verification failed for "+key)
        print(f"PREBUILT_R2_VERIFIED={key} bytes={len(xml)} sha256={digest[:14]}", flush=True)


if __name__=="__main__":
    main()
