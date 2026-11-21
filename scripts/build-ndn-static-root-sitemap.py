"""Read-only prebuild of NoonDealsNow's canonical ROOT sitemap index.

Source: existing destination-account R2 manifests. Do not enumerate or mutate
article objects. The root is delivered as a Cloudflare Static Asset to keep
Google's sitemap discovery reachable during free Worker request quota outages.
Dynamic article/shard sitemaps remain owned by existing application routes.

The static index is a *snapshot* refreshed on safe Worker deployments, while
other live sitemap URLs remain accessible directly via robots.txt.
"""
from __future__ import annotations

import datetime
import html
import json
import os
import pathlib
import re
import sys

ORIGIN = "https://noondealsnow.com"
BUCKET = "nooncoupons-content-v2"
ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
OUT = pathlib.Path(".ndn-static-assets/sitemap.xml")
STATIC_SEGMENTS = ("pages", "guides", "coupons", "coupons-saudi", "coupons-uae")
DISCOVERY_SEGMENTS = ("core", "priority", "en-articles", "hubs", "images", "ai-v2")
APPROVED_INDEX = re.compile(
    r"^/sitemap-(?:"
    r"(?:audit|fresh|articles)-[a-z0-9-]+"
    r"|(?:pages|guides|coupons|coupons-saudi|coupons-uae|core|priority|en-articles|hubs|images|ai-v2)"
    r"|rescue-(?:articles|images|english|english-images)-[0-9]{1,4}"
    r"|rescue-(?:catalog|english-catalog)"
    r"|live-recent"
    r")\.xml$"
)


def stamp(raw):
    try:
        return datetime.datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError, OverflowError):
        return None


def safe_shards(n, maximum=10000):
    if isinstance(n, bool):
        return 0
    try:
        value = int(n)
    except (TypeError, ValueError, OverflowError):
        return 0
    return value if 0 <= value <= maximum else 0


def is_eligible_live(a, now=None):
    if not isinstance(a, dict) or a.get("status") != "published" or a.get("indexable") is False:
        return False
    slug = str(a.get("slug") or "")
    if not (1 <= len(slug) <= 280) or "/" in slug or ".." in slug:
        return False
    try:
        quality = float(a.get("quality") or 0)
        words = float(a.get("wordCount")) if a.get("wordCount") is not None else 1500
    except (TypeError, ValueError, OverflowError):
        return False
    at = stamp(a.get("publishedAt") or a.get("createdAt"))
    return quality >= 95 and words >= 1500 and at is not None and at <= (now or datetime.datetime.now(datetime.timezone.utc).timestamp()) + 60


def make_paths(days, discovery=None, rescue=None, live=None, now=None):
    """Mirror auto-platform.sitemapIndex + discovery-entry.augmentRootSitemap.

    Input JSON objects are *read only*. Fail if missing the bulk index rather
    than deploying a misleadingly small index that loses old article shards.
    """
    if not isinstance(days, dict) or not isinstance(days.get("days"), list):
        raise ValueError("BULK_DAYS_MANIFEST_REQUIRED")
    paths = []
    current = discovery if isinstance(discovery, dict) else {}
    complete = (
        current.get("complete") is True
        and str(current.get("version")) == "1"
        and current.get("shards") is not None
        and str(current.get("shards")).strip().isdigit()
        and 0 <= safe_shards(current.get("shards")) <= 10000
        and bool(current.get("runId")) and bool(current.get("sourceAuditRunId"))
    )
    entries = days["days"]
    if complete:
        for i in range(safe_shards(current["shards"])):
            paths.append("/sitemap-audit-articles-" + str(i) + ".xml")
        cutoff = stamp(current.get("generatedAt"))
        for day in entries:
            if not isinstance(day, dict):
                continue
            updated = stamp(day.get("updatedAt"))
            if cutoff is None or updated is None or updated <= cutoff:
                continue
            daystr = str(day.get("day", ""))
            if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", daystr):
                continue
            for i in reversed(range(safe_shards(day.get("shards")))):
                paths.append("/sitemap-fresh-articles-" + daystr + "-" + str(i) + ".xml")
    else:
        for day in entries:
            if not isinstance(day, dict):
                continue
            daystr = str(day.get("day", ""))
            if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", daystr):
                continue
            for i in reversed(range(safe_shards(day.get("shards")))):
                paths.append("/sitemap-articles-" + daystr + "-" + str(i) + ".xml")

    paths.extend("/sitemap-" + x + ".xml" for x in STATIC_SEGMENTS)
    paths.extend("/sitemap-" + x + ".xml" for x in DISCOVERY_SEGMENTS)

    if isinstance(rescue, dict) and rescue.get("version") == 1 and rescue.get("count"):
        for segment in rescue.get("segments") or []:
            if not isinstance(segment, dict):
                continue
            n, count = segment.get("n"), segment.get("count")
            if type(n) is not int or not 0 <= n <= 9999 or type(count) is not int or count < 1:
                continue
            paths.extend(("/sitemap-rescue-articles-" + str(n) + ".xml",
                          "/sitemap-rescue-images-" + str(n) + ".xml"))
        for segment in rescue.get("englishSegments") or []:
            if not isinstance(segment, dict):
                continue
            n, count = segment.get("n"), segment.get("count")
            if type(n) is not int or not 0 <= n <= 9999 or type(count) is not int or count < 1:
                continue
            paths.extend(("/sitemap-rescue-english-" + str(n) + ".xml",
                          "/sitemap-rescue-english-images-" + str(n) + ".xml"))
        if rescue.get("segments"):
            paths.append("/sitemap-rescue-catalog.xml")
        if rescue.get("englishSegments"):
            paths.append("/sitemap-rescue-english-catalog.xml")
    if isinstance(live, dict) and any(is_eligible_live(a, now=now) for a in live.get("articles", []) if isinstance(a, dict)):
        paths.append("/sitemap-live-recent.xml")

    unique = list(dict.fromkeys(paths))
    if not unique or len(unique) > 40000:
        raise ValueError("UNSAFE_SITEMAP_INDEX_SIZE")
    if any(APPROVED_INDEX.fullmatch(path) is None for path in unique):
        raise ValueError("UNEXPECTED_SITEMAP_INDEX_PATH")
    return unique


def render(paths):
    if not paths or len(paths) > 40000:
        raise ValueError("UNSAFE_SITEMAP_INDEX_SIZE")
    content = ('<?xml version="1.0" encoding="UTF-8"?>'
               '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
               + "".join("<sitemap><loc>" + html.escape(ORIGIN + p, quote=True)
                         + "</loc></sitemap>" for p in paths)
               + "</sitemapindex>")
    if len(content.encode("utf-8")) > 20_000_000:
        raise ValueError("STATIC_SITEMAP_INDEX_EXCEEDS_SAFE_ASSET_SIZE")
    return content


def main():
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    key = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
    secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    if not key or not secret:
        raise ValueError("NEW_ACCOUNT_R2_READ_CREDENTIALS_REQUIRED")
    s3 = boto3.client(
        "s3", region_name="auto",
        endpoint_url="https://" + ACCOUNT + ".r2.cloudflarestorage.com",
        aws_access_key_id=key, aws_secret_access_key=secret,
        config=Config(connect_timeout=12, read_timeout=30,
                      retries={"max_attempts": 2, "mode": "standard"}),
    )

    def read(key, *, required=False):
        try:
            obj = s3.get_object(Bucket=BUCKET, Key=key)
            value = json.loads(obj["Body"].read())
            if not isinstance(value, dict):
                raise ValueError("UNEXPECTED_R2_MANIFEST_SHAPE_" + key)
            return value
        except ClientError as e:
            err = str(e.response.get("Error", {}).get("Code", ""))
            if err in ("404", "NoSuchKey", "NotFound") and not required:
                return None
            raise

    days = read("bulk/days.json", required=True)
    discovery = read("maintenance/article-discovery-v1/current.json")
    rescue = read("seo-rescue/index.json")
    live = read("blog/latest-live-v1.json")
    paths = make_paths(days, discovery, rescue, live)
    xml = render(paths)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(xml, encoding="utf8")
    assert OUT.read_text(encoding="utf8") == xml
    print("NDN_STATIC_ROOT_SITEMAP_BUILD=PASS;INDEXED_SITEMAPS=" + str(len(paths))
          + ";BYTES=" + str(len(xml.encode("utf8")))
          + ";ORIGINAL_ARTICLE_FILES_TOUCHED=ZERO;R2_WRITES=ZERO")
    print("NDN_STATIC_ROOT_SITEMAP_SOURCE=destination-r2-metadata-only;SHARD_URLS_RETAINED=true")


if __name__ == "__main__":
    main()
