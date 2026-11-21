"""Prebuild AI V2 sitemap index + real article URL shards as Worker Static Assets.

Read ONLY the existing canonical R2 publication ledger. Mirror
ai-v2-sitemap.js's publication order/2000-shard boundaries, never scan R2
articles or synthesize published items, and never edit ledger or HTML.
Snapshots refresh on the existing daily safe-deployment workflow; do not
redirect article generation or publication to GitHub.
"""
from __future__ import annotations

import html
import json
import os
import pathlib
import re
import sys

ORIGIN = "https://noondealsnow.com"
BUCKET = "nooncoupons-content-v2"
ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
LEDGER_KEY = "_ops/ai-v2-publication-ledger-v1.json"
OUT = pathlib.Path(".ndn-static-assets")
SHARD_SIZE = 2000
MAX_ARTICLES = 100000
SLUG = re.compile(r"^[a-z0-9-]{16,120}$")
XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'
XML_NS = ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'


def escape(value):
    return html.escape(str(value), quote=True).replace("&#x27;", "&apos;").replace("&quot;", "&quot;")


def validate_ledger(ledger):
    """Mirror inspectAiV2Ledger. No response if source is corrupt."""
    if not isinstance(ledger, dict) or ledger.get("version") != 1:
        raise ValueError("AI_LEDGER_VERSION_MISMATCH")
    articles = ledger.get("articles")
    if not isinstance(articles, list) or len(articles) > MAX_ARTICLES:
        raise ValueError("AI_LEDGER_SHAPE_OR_SIZE_INVALID")
    seen = set()
    for row in articles:
        if not isinstance(row, dict):
            raise ValueError("AI_LEDGER_ENTRY_NOT_OBJECT")
        slug, country = row.get("slug"), row.get("country")
        if not isinstance(slug, str) or not SLUG.fullmatch(slug) or "--" in slug:
            raise ValueError("AI_LEDGER_INVALID_SLUG")
        if country not in ("SA", "AE") or slug in seen:
            raise ValueError("AI_LEDGER_COUNTRY_OR_DUPLICATE")
        seen.add(slug)
    return articles


def render(ledger):
    """Return path->XML, including zero-article XML per the live renderer."""
    rows = validate_ledger(ledger)
    outputs = {}
    root_path = "sitemap-ai-v2.xml"
    if not rows:
        outputs[root_path] = XML_HEADER + "<urlset" + XML_NS + "></urlset>"
        return outputs
    shards = [rows[i:i + SHARD_SIZE] for i in range(0, len(rows), SHARD_SIZE)]
    links = []
    for n, entries in enumerate(shards, start=1):
        filename = f"sitemap-ai-v2-{n}.xml"
        last = entries[-1].get("publishedAt")
        links.append(
            "<sitemap><loc>" + escape(ORIGIN + "/" + filename) + "</loc>"
            + ("<lastmod>" + escape(last) + "</lastmod>" if last else "")
            + "</sitemap>"
        )
        items = []
        for row in entries:
            url = ORIGIN + "/articles/" + row["slug"]
            at = row.get("publishedAt")
            items.append(
                "<url><loc>" + escape(url) + "</loc>"
                + ("<lastmod>" + escape(at) + "</lastmod>" if at else "")
                + "</url>"
            )
        outputs[filename] = XML_HEADER + "<urlset" + XML_NS + ">" + "".join(items) + "</urlset>"
    outputs[root_path] = XML_HEADER + "<sitemapindex" + XML_NS + ">" + "".join(links) + "</sitemapindex>"
    return outputs


def write_files(outputs, output_dir=OUT):
    output_dir.mkdir(parents=True, exist_ok=True)
    # All generated URLs belong to /sitemap-ai-v2*.xml only.
    paths = set(outputs)
    if "sitemap-ai-v2.xml" not in paths:
        raise ValueError("AI_SITEMAP_INDEX_MISSING")
    for name in paths:
        if not re.fullmatch(r"sitemap-ai-v2(?:-[1-9]\d{0,3})?\.xml", name):
            raise ValueError("AI_SITEMAP_UNSAFE_FILENAME")
    # Do not leave yesterday's removed shards in the deployment.
    for path in output_dir.glob("sitemap-ai-v2-*.xml"):
        if path.name not in paths:
            path.unlink()
    for filename, content in outputs.items():
        if not isinstance(content, str) or len(content.encode("utf-8")) > 15_000_000:
            raise ValueError("AI_SITEMAP_XML_OVERSIZE")
        path = output_dir / filename
        path.write_text(content, encoding="utf-8")
        if path.read_text(encoding="utf-8") != content:
            raise ValueError("AI_SITEMAP_WRITE_MISMATCH")


def main():
    import boto3
    from botocore.config import Config
    key, secret = os.environ.get("AWS_ACCESS_KEY_ID", ""), os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    if not key.strip() or not secret.strip():
        raise ValueError("AI_LEDGER_READ_CREDENTIALS_REQUIRED")
    s3 = boto3.client(
        "s3", region_name="auto",
        endpoint_url="https://" + ACCOUNT + ".r2.cloudflarestorage.com",
        aws_access_key_id=key, aws_secret_access_key=secret,
        config=Config(connect_timeout=12, read_timeout=30, retries={"max_attempts": 2, "mode": "standard"}),
    )
    obj = s3.get_object(Bucket=BUCKET, Key=LEDGER_KEY)
    ledger = json.loads(obj["Body"].read())
    data = render(ledger)
    write_files(data)
    count = len(validate_ledger(ledger))
    shards = max(0, len(data) - 1)
    print("NDN_STATIC_AI_V2_SITEMAPS=BUILT;PUBLISHED_LEDGER_ENTRIES="
          + str(count) + ";SHARDS=" + str(shards) + ";ROOT_AND_LEAVES=" + str(len(data)))
    print("NDN_STATIC_AI_V2_SOURCE=EXISTING_R2_PUBLICATION_LEDGER;READ_ONLY=true;HTML_OR_R2_WRITES=ZERO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
