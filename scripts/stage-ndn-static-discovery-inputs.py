"""Read-only local R2 inputs for 4 canonical discovery sitemaps.

The original exported discovery-entry.js render functions run on fake local
read-only R2 get(). Keep native AI publishing and /sitemap-live-recent.xml
untouched, so fresh articles remain immediately discoverable after quota reset.
"""
import json
import os
import pathlib
import sys

ACCOUNT="e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET="nooncoupons-content-v2"
ROOT=pathlib.Path(".ndn-static-assets/sitemap.xml")
DEST=pathlib.Path(".ndn-discovery-temp/manifest.json")
KEYS=(
    "bulk/public-compact-v1.json",
    "bulk/latest.json",
    "english-canary/public-recent-v1.json",
    "maintenance/article-discovery-v1/current.json",
)


def validate(loaded):
    compact=loaded.get(KEYS[0])
    fallback=loaded.get(KEYS[1])
    chosen=compact if compact is not None else fallback
    if not isinstance(chosen,dict) or not isinstance(chosen.get("articles"),list):
        raise ValueError("DISCOVERY_STATIC_PUBLIC_MANIFEST_NOT_AVAILABLE")
    if compact is not None and compact.get("version")!=1:
        raise ValueError("DISCOVERY_STATIC_COMPACT_PUBLIC_MANIFEST_INVALID")
    english=loaded.get(KEYS[2])
    if english is not None and (not isinstance(english,dict) or english.get("version")!=1
                                or not isinstance(english.get("articles"),list)):
        raise ValueError("DISCOVERY_STATIC_ENGLISH_PUBLIC_MANIFEST_INVALID")
    audit=loaded.get(KEYS[3])
    if audit is not None and not isinstance(audit,dict):
        raise ValueError("DISCOVERY_STATIC_AUDIT_STATE_INVALID")
    return {"compactEntries":len(chosen["articles"]),
            "englishEntries":len(english["articles"]) if english else 0,
            "usesCompact":compact is not None}


def main():
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    if not ROOT.exists():
        raise ValueError("DISCOVERY_STATIC_CANONICAL_SITEMAP_REQUIRED")
    access=os.environ.get("AWS_ACCESS_KEY_ID","").strip()
    secret=os.environ.get("AWS_SECRET_ACCESS_KEY","").strip()
    if not access or not secret:
        raise ValueError("DISCOVERY_STATIC_R2_READ_ONLY_SECRETS_REQUIRED")
    client=boto3.client("s3",region_name="auto",
        endpoint_url="https://"+ACCOUNT+".r2.cloudflarestorage.com",
        aws_access_key_id=access,aws_secret_access_key=secret,
        config=Config(connect_timeout=12,read_timeout=30,retries={"max_attempts":2,"mode":"standard"}))
    loaded={}
    for key in KEYS:
        try:
            response=client.get_object(Bucket=BUCKET,Key=key)
            blob=response["Body"].read(12_000_000)
            if len(blob)>=12_000_000:
                raise ValueError("DISCOVERY_STATIC_R2_OBJECT_TOO_LARGE")
            loaded[key]=json.loads(blob)
        except ClientError as exc:
            if str(exc.response.get("Error",{}).get("Code","")) in ("404","NoSuchKey","NotFound"):
                loaded[key]=None
            else:
                raise
    stat=validate(loaded)
    DEST.parent.mkdir(parents=True,exist_ok=True)
    DEST.write_text(json.dumps(loaded,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("NDN_DISCOVERY_STATIC_R2_STAGING=PASS;PUBLIC_ROWS="+str(stat["compactEntries"])
          +";ENGLISH_ROWS="+str(stat["englishEntries"])
          +";USES_COMPACT="+str(stat["usesCompact"]))
    print("DISCOVERY_STATIC_R2_GETS=4;R2_WRITES=0;ARTICLE_GENERATION=0;DYNAMIC_LIVE_RECENT_UNCHANGED=true")


if __name__=="__main__":
    sys.exit(main())
