#!/usr/bin/env python3
"""Read-only comparison of existing NoonDealsNow DO export snapshots in new-account R2.

This intentionally never writes R2, DO, Cloudflare config or published content.
Outputs only aggregate ADD/CHANGE/UNCHANGED/MISSING counts, never key names
or value contents. Missing from newer snapshot is never a deletion instruction.
"""
import collections
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
import sys
import time

import boto3
from botocore.config import Config

ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET = "nooncoupons-content-v2"
BASE = "20261017-baseline"
NEW = "20261020-old-do-recovery"
MAX_SECONDS = 1650


def client():
    access = os.environ.get("DEST_ACCESS", "").strip()
    secret = os.environ.get("DEST_SECRET", "").strip()
    if not access or not secret:
        raise RuntimeError("destination_r2_credentials_missing")
    return boto3.client(
        "s3", region_name="auto", endpoint_url=f"https://{ACCOUNT}.r2.cloudflarestorage.com",
        aws_access_key_id=access, aws_secret_access_key=secret,
        config=Config(connect_timeout=10, read_timeout=35, retries={"max_attempts": 3, "mode": "standard"})
    )


def get_json(s3, key):
    response = s3.get_object(Bucket=BUCKET, Key=key)
    try:
        return json.loads(response["Body"].read())
    finally:
        response["Body"].close()


def get_manifest(s3, tag, kind):
    obj = get_json(s3, f"migration/do-state/{tag}/{kind}/manifest.json")
    if not (isinstance(obj, dict) and obj.get("complete") is True
            and obj.get("type") == kind and obj.get("tag") == tag
            and type(obj.get("parts")) is int and obj["parts"] > 0
            and type(obj.get("exported")) is int and obj["exported"] >= 0):
        raise RuntimeError("unverified_complete_manifest_" + tag + "_" + kind)
    return obj


def fingerprint(value):
    canonical = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(canonical.encode("utf-8")).digest()


def load_items(s3, tag, kind, manifest, t0):
    # Eight bounded concurrent GETs cut a 5,700-object read-only comparison
    # from ~30 min to a few minutes. No R2 PUT/DELETE or DO requests.
    seen = {}
    count = 0
    def fetch_part(n):
        key = f"migration/do-state/{tag}/{kind}/part-{n:07d}.json"
        return get_json(s3, key)

    with ThreadPoolExecutor(max_workers=8, thread_name_prefix="r2-read-only") as pool:
        for n, obj in enumerate(pool.map(fetch_part, range(1, manifest["parts"] + 1)), 1):
            if time.monotonic() - t0 > MAX_SECONDS:
                raise RuntimeError("diff_time_budget_exceeded_no_data_written")
            if not (isinstance(obj, dict) and obj.get("version") == 1
                    and obj.get("tag") == tag and obj.get("type") == kind
                    and obj.get("part") == n and isinstance(obj.get("entries"), list)
                    and len(obj["entries"]) <= 128):
                raise RuntimeError("bad_export_part_" + tag + "_" + kind + "_" + str(n))
            for row in obj["entries"]:
                if not (isinstance(row, list) and len(row) == 2 and isinstance(row[0], str)):
                    raise RuntimeError("bad_row_in_export_" + kind)
                name, val = row
                if name in seen:
                    raise RuntimeError("duplicate_export_key_" + kind)
                seen[name] = fingerprint(val)
                count += 1
            if n % 500 == 0:
                print(f"DO_DELTA_PROGRESS kind={kind} snapshot={tag} parts={n}/{manifest['parts']}", flush=True)
    if count != manifest["exported"]:
        raise RuntimeError("manifest_count_mismatch_" + tag + "_" + kind)
    return seen


def check_restore(s3, tag, kind):
    key = f"migration/restore-progress/{tag}/{kind}.json"
    try:
        o = get_json(s3, key)
        return {
            "exists": True, "complete": o.get("complete") is True,
            "partsDone": o.get("partsDone"), "partsTotal": o.get("partsTotal"),
            "keysRestored": o.get("keysRestored"), "keysTotal": o.get("keysTotal")
        }
    except s3.exceptions.NoSuchKey:
        return {"exists": False}
    except Exception as e:
        if "NoSuchKey" in str(e) or "404" in str(e):
            return {"exists": False}
        raise


def main():
    s3 = client()
    t0 = time.monotonic()
    for kind in ("GeneratorControl", "ControlPlane"):
        base_manifest = get_manifest(s3, BASE, kind)
        new_manifest = get_manifest(s3, NEW, kind)
        older = load_items(s3, BASE, kind, base_manifest, t0)
        newer = load_items(s3, NEW, kind, new_manifest, t0)
        added = sum(k not in older for k in newer)
        modified = sum(k in older and older[k] != v for k, v in newer.items())
        unchanged = len(newer) - added - modified
        missing = sum(k not in newer for k in older)
        record = {
            "kind": kind, "baseline": BASE, "newer": NEW,
            "older_count": len(older), "newer_count": len(newer),
            "added": added, "changed": modified,
            "unchanged": unchanged, "missing_from_newer_do_not_delete": missing,
            "writes_required_for_upsert_only": added + modified,
            "baseline_restore": check_restore(s3, BASE, kind),
            "newer_restore": check_restore(s3, NEW, kind)
        }
        print("DO_SNAPSHOT_DIFF " + json.dumps(record, sort_keys=True), flush=True)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as handle:
                handle.write(f"### {kind}: read-only DO snapshot comparison\n\n")
                handle.write("| Measure | Count |\n|---|---:|\n")
                for key in ("older_count", "newer_count", "added", "changed", "unchanged",
                            "missing_from_newer_do_not_delete", "writes_required_for_upsert_only"):
                    handle.write(f"| {key} | {record[key]:,} |\n")
                handle.write("\n**This job never writes storage or removes keys.**\n")
    print("DO_SNAPSHOT_DIFF_COMPLETE=true", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("DO_SNAPSHOT_DIFF_ERROR=" + str(exc).splitlines()[0][:180], file=sys.stderr)
        raise SystemExit(1)
