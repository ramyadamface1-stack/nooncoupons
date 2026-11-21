"""Read-only prebuild for canonical historical bulk article sitemap shards.

Exactly mirrors auto-platform.js articleSitemap()'s quality/indexability filter.
Only roots present in today's canonical static sitemap.xml are generated.
No articles are edited or scanned with LIST; never add unpublished/draft URLs.
Worker Static Assets serve the XML without the 100k/day Worker invocation cap.

The builder intentionally fails if any referenced R2 source is missing/invalid
instead of silently replacing an article sitemap with a false empty success.
"""
from __future__ import annotations

import concurrent.futures
import html
import json
import os
import pathlib
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

BUCKET = "nooncoupons-content-v2"
ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
ORIGIN = "https://noondealsnow.com"
ASSETS = pathlib.Path(".ndn-static-assets")
ROOT = ASSETS / "sitemap.xml"
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
PATH_RE = re.compile(r"^/sitemap-articles-(20\d{2}-\d{2}-\d{2})-(0|[1-9]\d{0,3})\.xml$")
MAX_ASSET_COUNT = 19000  # Cloudflare Workers Free allows 20k static files/worker.
MAX_SHARD_BYTES = 18_000_000
MAX_TOTAL_XML_BYTES = 300_000_000


def xml_escape(value):
    return html.escape(str(value), quote=True)


def number(value):
    """JS Number() semantics for practical stored metadata and fail-closed NaN."""
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    try:
        return float(str(value).strip() or "0")
    except (TypeError, ValueError, OverflowError):
        return float("nan")


def eligible(article):
    """Match auto-platform.js sitemapEligible (not a looser new inclusion rule)."""
    if not isinstance(article, dict) or not article.get("slug"):
        return False
    if article.get("status") != "published":
        return False
    for flag in ("indexable",):
        if article.get(flag) is False:
            return False
    if any(article.get(flag) is True for flag in ("superseded", "orphan", "duplicateIntent")):
        return False
    quality = number(article.get("quality"))
    if not quality >= 95:
        return False
    if article.get("qualityFloor") is not None and not number(article["qualityFloor"]) >= 88:
        return False
    if article.get("wordCount") is not None and number(article["wordCount"]) < 1500:
        return False
    if isinstance(article.get("p0"), list) and article["p0"]:
        return False
    indexation = article.get("indexation")
    if isinstance(indexation, dict) and indexation.get("indexable") is False:
        return False
    return True


def expected_paths(root_xml):
    tree = ET.fromstring(root_xml)
    if not tree.tag.endswith("sitemapindex"):
        raise ValueError("BULK_STATIC_CANONICAL_ROOT_NOT_SITEMAPINDEX")
    all_urls = [n.text or "" for n in tree.findall("s:sitemap/s:loc", NS)]
    if not all_urls or len(all_urls) != len(set(all_urls)):
        raise ValueError("BULK_STATIC_CANONICAL_ROOT_EMPTY_OR_DUPLICATES")
    paths = []
    for url in all_urls:
        if not url.startswith(ORIGIN + "/"):
            raise ValueError("BULK_STATIC_CANONICAL_ROOT_FOREIGN_URL")
        path = url[len(ORIGIN):]
        if PATH_RE.fullmatch(path):
            paths.append(path)
    if len(paths) + 50 >= MAX_ASSET_COUNT:
        raise ValueError("BULK_STATIC_WORKERS_FREE_ASSET_COUNT_EXCEEDED")
    return paths


def key_for_path(path):
    matched = PATH_RE.fullmatch(path)
    if not matched:
        raise ValueError("BULK_STATIC_UNSAFE_FILENAME")
    day, shard = matched.groups()
    return "bulk/day/" + day + "/" + str(int(shard)) + ".json"


def render_shard(path, source):
    """Mirror actual live dynamic articleSitemap() XML, without content change."""
    day = PATH_RE.fullmatch(path)
    if not day:
        raise ValueError("BULK_STATIC_PATH_NOT_CANONICAL")
    if not isinstance(source, dict) or not isinstance(source.get("articles"), list):
        raise ValueError("BULK_STATIC_R2_DAY_SHARD_SCHEMA_INVALID_" + path)
    date = day.group(1)
    rows = []
    for article in source["articles"]:
        if not eligible(article):
            continue
        slug = article["slug"]
        if not isinstance(slug, str) or not 1 <= len(slug) <= 280 or any(x in slug for x in ("/", "\\", "?", "#", "\r", "\n")) or ".." in slug:
            raise ValueError("BULK_STATIC_PUBLISHED_INVALID_SLUG_" + path)
        # All canonical saved slugs are path segments; quote() matches JS
        # encodeURI for hyphenated/Unicode article slugs (RFC 3986 URL path).
        url = ORIGIN + "/articles/" + urllib.parse.quote(slug, safe="-_.!~*'()")
        edited = article.get("updatedAt") or article.get("createdAt") or date
        rows.append("<url><loc>" + xml_escape(url) + "</loc><lastmod>"
                    + xml_escape(edited) + "</lastmod></url>")
    body = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            + "".join(rows) + "</urlset>")
    if len(body.encode("utf-8")) > MAX_SHARD_BYTES:
        raise ValueError("BULK_STATIC_SHARD_TOO_LARGE_" + path)
    return body, len(rows)


def collect_one(client, path):
    from botocore.exceptions import ClientError
    key = key_for_path(path)
    try:
        response = client.get_object(Bucket=BUCKET, Key=key)
        payload = response["Body"].read(14_000_000)
        if len(payload) >= 14_000_000:
            raise ValueError("BULK_STATIC_SOURCE_OBJECT_OVERSIZE_" + path)
        row = json.loads(payload)
    except ClientError as exc:
        raise ValueError("BULK_STATIC_SOURCE_MISSING_OR_UNAVAILABLE_" + path) from exc
    return path, *render_shard(path, row)


def build(client, root_xml, assets=ASSETS):
    paths = expected_paths(root_xml)
    if not paths:
        # Future canonical roots may switch to audit-discovery shards.
        print("NDN_STATIC_BULK_ARTICLE_SITEMAPS=NOT_LISTED_IN_CANONICAL_ROOT;NO_FABRICATED_FILES")
        return {"count": 0, "urls": 0, "bytes": 0, "empty": 0}
    if not assets.is_dir():
        raise ValueError("BULK_STATIC_OUTPUT_DIRECTORY_MISSING")
    completed = {}
    # Bounded parallel GETs only, never R2 object LIST or writes.
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        tasks = {pool.submit(collect_one, client, path): path for path in paths}
        for task in concurrent.futures.as_completed(tasks):
            path, contents, url_count = task.result()
            completed[path] = (contents, url_count)
    if set(completed) != set(paths):
        raise ValueError("BULK_STATIC_R2_INCOMPLETE_SHARD_SET")
    amount = sum(len(completed[p][0].encode("utf-8")) for p in paths)
    if amount > MAX_TOTAL_XML_BYTES:
        raise ValueError("BULK_STATIC_TOTAL_XML_TOO_LARGE")
    if not any(completed[p][1] for p in paths):
        raise ValueError("BULK_STATIC_ALL_REFERENCED_ARTICLE_SHARDS_EMPTY")
    for path in paths:
        target = assets / path.lstrip("/")
        content = completed[path][0]
        target.write_text(content, encoding="utf-8")
    stale = [x for x in assets.glob("sitemap-articles-*.xml") if "/" + x.name not in completed]
    for path in stale:
        path.unlink()
    urls = sum(completed[p][1] for p in paths)
    empty = sum(completed[p][1] == 0 for p in paths)
    print("NDN_STATIC_BULK_ARTICLE_SITEMAPS=BUILT;SHARDS=" + str(len(paths))
          + ";CANONICAL_ARTICLE_URLS=" + str(urls) + ";EMPTY_SHARDS=" + str(empty)
          + ";TOTAL_XML_BYTES=" + str(amount))
    print("NDN_STATIC_BULK_SOURCE=EXACT_R2_DAY_SHARDS_FROM_CANONICAL_ROOT;R2_WRITES=ZERO;ARTICLE_HTML_MUTATIONS=ZERO")
    return {"count": len(paths), "urls": urls, "bytes": amount, "empty": empty}


def main():
    import boto3
    from botocore.config import Config

    key = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
    secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    if not key or not secret:
        raise ValueError("BULK_STATIC_READ_ONLY_R2_CREDENTIALS_MISSING")
    if not ROOT.exists():
        raise ValueError("BULK_STATIC_CANONICAL_ROOT_NOT_PREBUILT")
    client = boto3.client(
        "s3", region_name="auto",
        endpoint_url="https://" + ACCOUNT + ".r2.cloudflarestorage.com",
        aws_access_key_id=key, aws_secret_access_key=secret,
        config=Config(connect_timeout=12, read_timeout=28,
                      max_pool_connections=16,
                      retries={"max_attempts": 2, "mode": "standard"}),
    )
    result = build(client, ROOT.read_text(encoding="utf-8"))
    print("NDN_STATIC_BULK_WORKERS_FREE_MAX_ASSETS=20000;BUILD_TOTAL_SHARDS=" + str(result["count"]))


if __name__ == "__main__":
    sys.exit(main())
