"""Read-only temporary staging of original rescue sitemap inputs from R2.

NO R2 writes, no article creation, no transformed slugs, no object LIST.
All outputs in .ndn-rescue-temp/ are CI-local; never deployed or committed.
The existing JavaScript rescue sitemap renderer will build final XML verbatim.
"""
from __future__ import annotations

import concurrent.futures
import json
import os
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

ORIGIN = "https://noondealsnow.com"
ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET = "nooncoupons-content-v2"
INPUT = pathlib.Path(".ndn-rescue-temp")
INDEX = pathlib.Path(".ndn-static-assets/sitemap.xml")
PATTERN = re.compile(r"^/sitemap-rescue-(articles|images|english|english-images)-(0|[1-9]\d{0,3})\.xml$")
CATALOG = {"/sitemap-rescue-catalog.xml", "/sitemap-rescue-english-catalog.xml"}
SITEMAP_NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def references(root_xml):
    root = ET.fromstring(root_xml)
    if not root.tag.endswith("sitemapindex"):
        raise ValueError("RESCUE_STATIC_ROOT_NOT_INDEX")
    paths = []
    for node in root.findall("s:sitemap/s:loc", SITEMAP_NS):
        value = node.text or ""
        if not value.startswith(ORIGIN + "/"):
            raise ValueError("RESCUE_STATIC_ROOT_HAS_EXTERNAL_URL")
        path = value[len(ORIGIN):]
        if PATTERN.fullmatch(path) or path in CATALOG:
            paths.append(path)
    if len(paths) != len(set(paths)) or len(paths) > 600:
        raise ValueError("RESCUE_STATIC_ROOT_DUPLICATE_OR_TOO_LARGE")
    return paths


def sources_from_manifest(paths, manifest):
    if not isinstance(manifest, dict) or manifest.get("version") != 1:
        raise ValueError("RESCUE_STATIC_MANIFEST_VERSION")
    if not isinstance(manifest.get("segments"), list) or not isinstance(manifest.get("englishSegments"), list):
        raise ValueError("RESCUE_STATIC_MANIFEST_SEGMENTS")
    keys = {}
    used = {}
    for path in paths:
        matched = PATTERN.fullmatch(path)
        if not matched:
            continue
        group, num = matched.groups()
        english = group.startswith("english")
        segment = next((x for x in manifest["englishSegments" if english else "segments"]
                        if isinstance(x, dict) and type(x.get("n")) is int and x["n"] == int(num)), None)
        if not segment:
            raise ValueError("RESCUE_STATIC_MISSING_MANIFEST_SEGMENT_" + path)
        key = segment.get("key")
        if not isinstance(key, str) or not re.fullmatch(r"seo-rescue/[A-Za-z0-9/_.-]+\.json", key) or ".." in key:
            raise ValueError("RESCUE_STATIC_INVALID_SOURCE_KEY_" + path)
        count = segment.get("count")
        if type(count) is not int or not 1 <= count <= 2000:
            raise ValueError("RESCUE_STATIC_SEGMENT_COUNT_INVALID_" + path)
        if key in used and used[key] != count:
            raise ValueError("RESCUE_STATIC_SAME_KEY_DIFFERENT_COUNTS")
        used[key] = count
        keys[path] = key
    return keys, used


def stage_from_loaded(root_xml, manifest, loaded, destination=INPUT):
    paths = references(root_xml)
    _, sources = sources_from_manifest(paths, manifest)
    if any(key not in loaded for key in sources):
        raise ValueError("RESCUE_STATIC_REFERENCED_R2_OBJECT_MISSING")
    to_write = {}
    mapping = {}
    for index, (key, count) in enumerate(sources.items()):
        doc = loaded[key]
        if not isinstance(doc, dict) or doc.get("version") != 1 or not isinstance(doc.get("articles"), list):
            raise ValueError("RESCUE_STATIC_SOURCE_SCHEMA_INVALID")
        if len(doc["articles"]) != count:
            raise ValueError("RESCUE_STATIC_SOURCE_COUNT_DRIFT")
        filename = f"segment-{index:04d}.json"
        to_write[filename] = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
        mapping[key] = filename
    if not destination.parent.exists():
        raise ValueError("RESCUE_STATIC_INVALID_DESTINATION")
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    for filename, data in to_write.items():
        (destination / filename).write_text(data, encoding="utf-8")
    (destination / "index.json").write_text(
        json.dumps({"paths": paths, "inputs": mapping}, ensure_ascii=False), encoding="utf-8"
    )
    return {"xmlPaths": len(paths), "sourceObjects": len(mapping),
            "sourceArticleEntries": sum(sources.values())}


def main():
    import boto3
    from botocore.config import Config

    access, secret = os.environ.get("AWS_ACCESS_KEY_ID", "").strip(), os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    if not access or not secret:
        raise ValueError("RESCUE_STATIC_R2_READ_CREDENTIALS_MISSING")
    if not INDEX.exists():
        raise ValueError("RESCUE_STATIC_CANONICAL_ROOT_NOT_BUILT")
    root_xml = INDEX.read_text(encoding="utf-8")
    paths = references(root_xml)
    if not paths:
        print("NDN_RESCUE_STATIC=NOT_REFERENCED_BY_CANONICAL_ROOT;NO_FABRICATED_FILES")
        return
    client = boto3.client(
        "s3", region_name="auto", endpoint_url="https://" + ACCOUNT + ".r2.cloudflarestorage.com",
        aws_access_key_id=access, aws_secret_access_key=secret,
        config=Config(connect_timeout=12, read_timeout=30, max_pool_connections=16,
                      retries={"max_attempts": 2, "mode": "standard"})
    )

    def read(key):
        obj = client.get_object(Bucket=BUCKET, Key=key)
        data = obj["Body"].read(10_000_000)
        if len(data) >= 10_000_000:
            raise ValueError("RESCUE_STATIC_R2_SOURCE_OVERSIZE")
        return json.loads(data)

    manifest = read("seo-rescue/index.json")
    _, keys = sources_from_manifest(paths, manifest)
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(read, key): key for key in keys}
        loaded = {futures[f]: f.result() for f in concurrent.futures.as_completed(futures)}
    result = stage_from_loaded(root_xml, manifest, loaded)
    print("NDN_RESCUE_STATIC_R2_STAGING=PASS;CANONICAL_XML_PATHS=" + str(result["xmlPaths"])
          + ";R2_SEGMENT_GETS=" + str(result["sourceObjects"])
          + ";MANIFEST_SOURCE_ENTRIES=" + str(result["sourceArticleEntries"]))
    print("NDN_RESCUE_STATIC_SOURCE=ORIGINAL_R2_RESCUE_MANIFEST;R2_WRITES=ZERO;TEMP_JSON_NOT_DEPLOYED=true")


if __name__ == "__main__":
    sys.exit(main())
