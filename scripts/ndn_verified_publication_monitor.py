"""Read-only production monitor for Cloudflare-native NoonDealsNow publications.

Uses the real R2 AI-v2 verified ledger + live direct Worker health; old
/api/generator-health is a *legacy* engine and is not authoritative for native
Cloudflare AI. Does not send AI requests, create articles, update R2, or mutate
any site metadata. All UTC dates; render Cairo only where explicitly labeled.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import urllib.request
from collections import Counter
from zoneinfo import ZoneInfo

UTC = dt.timezone.utc
ORIGIN = "https://noondealsnow.com"
DIRECT = "https://noondealsnow-ai-direct-r2.ndn-e4c35f8a50.workers.dev/health"
LEDGER = "_ops/ai-v2-publication-ledger-v1.json"
MAX_BYTES = 24_000_000


def parse_time(value):
    if not isinstance(value, str):
        return None
    try:
        result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return result.astimezone(UTC) if result.tzinfo else None


def summarize(health, ledger, now=None):
    now = now or dt.datetime.now(UTC)
    if not isinstance(health, dict) or not isinstance(ledger, dict) or \
            ledger.get("version") != 1 or not isinstance(ledger.get("articles"), list):
        raise ValueError("INVALID_LIVE_MONITOR_INPUT")
    if len(ledger["articles"]) > 100000:
        raise ValueError("UNREASONABLE_LEDGER_SIZE")
    rows = ledger["articles"]
    counts = {"1h": Counter(), "24h": Counter()}
    last = None
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("country") not in ("SA", "AE") or \
                not isinstance(row.get("slug"), str) or row["slug"] in seen:
            raise ValueError("LEDGER_INVALID_OR_DUPLICATE")
        seen.add(row["slug"])
        when = parse_time(row.get("publishedAt"))
        if when is None or when > now:
            continue
        if last is None or when > last[0]:
            last = (when, row)
        age = (now - when).total_seconds()
        for label, seconds in (("1h", 3600), ("24h", 86400)):
            if age <= seconds:
                counts[label]["total"] += 1
                counts[label][row["country"]] += 1
                provider = row.get("provider")
                counts[label][provider if provider in ("gemini", "groq") else "unknown"] += 1
    verification = health.get("lastLiveVerification") or {}
    verified = parse_time(verification.get("at"))
    reason = verification.get("reason")
    slug = str(verification.get("slug") or "")
    age_minutes = max(0, (now - verified).total_seconds() / 60) if verified else None
    live_ok = (health.get("ok") is True and health.get("schedulerEnabled") is True
               and health.get("directStage") == "production"
               and health.get("controlStatus") == "POLICY_VERIFIED"
               and health.get("siteServiceBindingConfigured") is True)
    recent = (live_ok and reason == "LIVE_VERIFIED" and
              verification.get("http") == 200 and
              bool(slug) and age_minutes is not None and age_minutes < 90)
    return {
        "source": "verified-r2-publication-ledger-and-direct-health",
        "checkedAt": now.isoformat().replace("+00:00", "Z"),
        "ledgerItems": len(rows),
        "lastHour": dict(counts["1h"]),
        "last24Hours": dict(counts["24h"]),
        "lastLedgerPublication": {"slug": last[1]["slug"],
                                  "country": last[1]["country"],
                                  "at": last[0].isoformat().replace("+00:00", "Z")} if last else None,
        "lastLiveVerified": {"slug": slug, "at": verification.get("at"),
                             "minutesAgo": round(age_minutes, 1)} if verified and slug else None,
        "directWorkerConfigured": live_ok,
        "publishingRecentlyVerified": bool(recent),
        "belowTarget60PerHour": counts["1h"]["total"] < 60,
        "targetPerHour": 60,
        "readyCount": health.get("readyCount"),
        "markets": {key: {"phase": (health.get("marketGeneration") or {}).get(key, {}).get("phase"),
                           "provider": (health.get("marketGeneration") or {}).get(key, {}).get("provider"),
                           "http": (health.get("marketGeneration") or {}).get(key, {}).get("http")}
                    for key in ("SA", "AE")},
    }


def get(url, limit=4_000_000):
    request = urllib.request.Request(url, headers={
        "Cache-Control": "no-cache", "User-Agent": "NDN-Native-ReadOnly-Monitor/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        status = response.status
        content_type = response.headers.get("content-type", "").lower()
        body = response.read(limit + 1)
    if status != 200 or len(body) > limit:
        raise RuntimeError("UNEXPECTED_RESPONSE_" + url.split("/", 3)[-1][:80])
    return content_type, body.decode("utf-8", errors="replace")


def read_r2():
    import boto3  # only needed for the scheduled live monitor, not offline tests
    from botocore.config import Config
    access, secret = os.environ.get("R2_ACCESS"), os.environ.get("R2_SECRET")
    if not access or not secret:
        raise RuntimeError("R2_READ_CREDENTIALS_MISSING")
    r2 = boto3.client("s3", endpoint_url=
        "https://e4c35f8a50a7b2e4cfb9d6c534962603.r2.cloudflarestorage.com",
        aws_access_key_id=access, aws_secret_access_key=secret, region_name="auto",
        config=Config(connect_timeout=10, read_timeout=25,
                      retries={"max_attempts": 2, "mode": "standard"}))
    obj = r2.get_object(Bucket="nooncoupons-content-v2", Key=LEDGER)
    raw = obj["Body"].read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise RuntimeError("VERIFIED_LEDGER_TOO_LARGE")
    return json.loads(raw)


def execute():
    _, raw = get(DIRECT, 50000)
    health = json.loads(raw)
    ledger = read_r2()
    report = summarize(health, ledger)
    checks = [("/", "text/html"), ("/blog", "text/html"),
              ("/blog/latest", "text/html"),
              ("/coupon/nov170", "text/html"),
              ("/coupon/nov188", "text/html"),
              ("/sitemap.xml", "xml")]
    for path, expected_type in checks:
        content_type, body = get(ORIGIN + path)
        if expected_type not in content_type:
            raise RuntimeError("PUBLIC_CONTENT_TYPE_MISMATCH_" + path)
        if path == "/blog" and "/blog/latest" not in body:
            raise RuntimeError("BLOG_LIVE_FEED_NOT_LINKED")
        if path == "/blog/latest" and "<h1" not in body:
            raise RuntimeError("LIVE_BLOG_NOT_RENDERED")
    verified = report["lastLiveVerified"]
    if verified:
        slug = verified["slug"]
        if not slug.isascii() or not all(x.isalnum() or x == "-" for x in slug) or len(slug) > 120:
            raise RuntimeError("INVALID_VERIFIED_SLUG")
        _, article = get(ORIGIN + "/articles/" + slug)
        coupon = "NOV188" if slug.startswith("uae-") else "NOV170" if slug.startswith("saudi-") else None
        if coupon is None or "<article" not in article or coupon not in article:
            raise RuntimeError("LIVE_VERIFIED_ARTICLE_NOW_MISSING")
    print("NDN_CURRENT_NATIVE_MONITOR=" + json.dumps(report, ensure_ascii=False), flush=True)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        report_name = "PASS" if report["publishingRecentlyVerified"] else "STALLED"
        lines = [
            "## NoonDealsNow native Cloudflare publication monitor",
            "**Actual status: " + report_name + "**. Snapshot from live R2 + Worker, not legacy /api/generator-health.",
            "| Indicator | Verified |", "|---|---|",
            "| 1h published | " + str(report["lastHour"].get("total", 0)) + " / target 60 |",
            "| 24h published | " + str(report["last24Hours"].get("total", 0)) + " |",
            "| Last LIVE_VERIFIED | " + str(verified["at"] if verified else "none") + " |",
            "| Direct generation | " + str(report["markets"]) + " |",
            "| READY stock | " + str(report["readyCount"]) + " |",
            "Monitoring requests only. No articles or AI provider requests generated.",
        ]
        with open(summary_path, "a", encoding="utf-8") as file:
            file.write("\n".join(lines) + "\n")
    if report["belowTarget60PerHour"]:
        print("::warning::NDN_REAL_PUBLISH_RATE_BELOW_60_PER_HOUR;" +
              "COUNT=" + str(report["lastHour"].get("total", 0)), flush=True)
    if not report["directWorkerConfigured"] or not report["publishingRecentlyVerified"]:
        print("::error::NDN_REAL_PUBLICATION_STALLED_OR_DIRECT_WORKER_UNHEALTHY", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(execute())
    except Exception as exc:
        # No body, API tokens, or R2 credentials are printed.
        print("::error::NDN_NATIVE_MONITOR_FAILED_" + type(exc).__name__, flush=True)
        sys.exit(1)
