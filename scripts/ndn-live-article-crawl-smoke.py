"""Read-only live SEO smoke: sample actual published article URLs after quota reset.

Do not confuse a working GitHub deployment / static sitemap with live
article indexability. This probe runs only when homepage is HTTP 200 and never
writes to R2, Cloudflare, Search Console, or the publishing API.

No API secrets, no remote redirects, up to 50 canonical static AI XML shards,
plus <= 2 dynamic nested sitemaps and <= 2 HTML article pages after recovery.
"""
from __future__ import annotations

import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://noondealsnow.com"
NAMESPACE = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
AGENT = "NoonDealsNow-SEO-Health-Check/1.0 (+https://noondealsnow.com/about)"


def safe_url(url):
    parts = urllib.parse.urlsplit(str(url))
    return parts.scheme == "https" and parts.netloc == "noondealsnow.com" and not parts.username and not parts.password


def choose_sitemaps(xml, cap=2):
    root = ET.fromstring(xml)
    if not root.tag.endswith("sitemapindex"):
        raise ValueError("ROOT_NOT_SITEMAP_INDEX")
    urls = [node.text or "" for node in root.findall("s:sitemap/s:loc", NAMESPACE)]
    if not urls:
        raise ValueError("ROOT_SITEMAP_EMPTY")
    if any(not safe_url(x) for x in urls):
        raise ValueError("ROOT_HAS_FOREIGN_SITEMAP_URL")
    options = []
    for kind in ("live-recent", "fresh-articles-", "audit-articles-", "articles-", "rescue-articles-"):
        found = next((x for x in urls if re.search(r"/sitemap-" + re.escape(kind) + r"[\w-]*\.xml$", x)), None)
        if found and found not in options:
            options.append(found)
    if not options:
        raise ValueError("ROOT_HAS_NO_REAL_ARTICLE_SITEMAPS")
    # Prefer a newly published journal and one older archive if both exist.
    if options[0].endswith("/sitemap-live-recent.xml"):
        second = next((x for x in options[1:] if x != options[0]), None)
        return [options[0]] + ([second] if second and cap > 1 else [])
    return options[:cap]


def article_urls(xml):
    root = ET.fromstring(xml)
    if not root.tag.endswith("urlset"):
        raise ValueError("CHILD_NOT_URLSET")
    urls = [node.text or "" for node in root.findall("s:url/s:loc", NAMESPACE)]
    if not urls:
        raise ValueError("CHILD_ARTICLE_SITEMAP_EMPTY")
    if any(not safe_url(x) for x in urls):
        raise ValueError("CHILD_HAS_FOREIGN_URLS")
    return [x for x in urls if re.search(r"^/((en/)?articles/|blog/)", urllib.parse.urlsplit(x).path)]


def canonical_bulk_sitemap_paths(xml):
    """Select only first-party historical bulk shards listed in canonical root."""
    root = ET.fromstring(xml)
    if not root.tag.endswith("sitemapindex"):
        raise ValueError("BULK_CANONICAL_ROOT_NOT_INDEX")
    all_refs = [n.text or "" for n in root.findall("s:sitemap/s:loc", NAMESPACE)]
    pattern = re.compile(r"^/sitemap-articles-20\d{2}-\d{2}-\d{2}-(0|[1-9]\d{0,3})\.xml$")
    urls = []
    for url in all_refs:
        if not safe_url(url):
            raise ValueError("BULK_CANONICAL_ROOT_UNSAFE_FOREIGN_URL")
        if pattern.fullmatch(urllib.parse.urlsplit(url).path):
            urls.append(url)
    if len(urls) != len(set(urls)) or len(urls) > 5000:
        raise ValueError("BULK_CANONICAL_ROOT_DUPLICATE_OR_TOO_LARGE")
    return urls


def verify_static_bulk_archive():
    """Sample old R2 article XML even when homepage and AI Workers are 429."""
    status, mime, data = get(BASE + "/sitemap.xml", limit=3000000)
    if status != 200 or "xml" not in mime:
        raise RuntimeError("BULK_CANONICAL_STATIC_ROOT_UNAVAILABLE")
    paths = canonical_bulk_sitemap_paths(data)
    if not paths:
        print("NDN_STATIC_BULK_ARCHIVE_MONITOR=NO_HISTORICAL_BULK_PATHS_IN_ROOT")
        return 0
    sample = list(dict.fromkeys([paths[0], paths[len(paths) // 2], paths[-1]]))
    found = 0
    for path in sample:
        code, content_type, body = get(path, limit=4000000)
        print("NDN_STATIC_BULK_SAMPLE_PATH=" + path + ";HTTP=" + str(code))
        if code != 200 or "xml" not in content_type:
            raise RuntimeError("BULK_STATIC_SAMPLE_NOT_200_XML")
        doc = ET.fromstring(body)
        if not doc.tag.endswith("urlset"):
            raise RuntimeError("BULK_STATIC_SAMPLE_NOT_URLSET")
        urls = [node.text or "" for node in doc.findall("s:url/s:loc", NAMESPACE)]
        if len(urls) != len(set(urls)):
            raise RuntimeError("BULK_STATIC_SAMPLE_DUPLICATE_ARTICLE_URLS")
        if any(not safe_url(url) or not urllib.parse.urlsplit(url).path.startswith("/articles/") for url in urls):
            raise RuntimeError("BULK_STATIC_SAMPLE_FOREIGN_OR_NONARTICLE_URL")
        found += len(urls)
        print("NDN_STATIC_BULK_SAMPLE_PUBLICATION_URLS=" + str(len(urls)))
    if found == 0:
        raise RuntimeError("BULK_STATIC_ARCHIVE_ALL_SAMPLED_XML_EMPTY")
    print("NDN_STATIC_BULK_ARCHIVE_CRAWL=VERIFIED;ROOT_SHARDS=" + str(len(paths))
          + ";SAMPLED_SHARDS=" + str(len(sample)) + ";SAMPLED_URL_ENTRIES=" + str(found))
    # Historical XML is reachable; this does NOT prove the HTML routes or
    # Google's actual indexing have recovered from shared Workers 1027.
    return len(paths)


def ai_v2_shard_paths(xml):
    """All verified native AI V2 sitemap leaves, not just a random canary."""
    root = ET.fromstring(xml)
    if not root.tag.endswith("sitemapindex"):
        raise ValueError("AI_V2_ROOT_NOT_SITEMAP_INDEX")
    paths = [node.text or "" for node in root.findall("s:sitemap/s:loc", NAMESPACE)]
    if not 1 <= len(paths) <= 50:
        raise ValueError("AI_V2_UNEXPECTED_SHARD_COUNT")
    if len(set(paths)) != len(paths):
        raise ValueError("AI_V2_DUPLICATE_SHARD_URLS")
    for i, url in enumerate(paths, 1):
        if not safe_url(url):
            raise ValueError("AI_V2_FOREIGN_SHARD_URL")
        if urllib.parse.urlsplit(url).path != "/sitemap-ai-v2-" + str(i) + ".xml":
            raise ValueError("AI_V2_NONCANONICAL_SHARD_ORDER")
    return paths


def verify_static_ai_v2():
    """Read-only static asset inspection, even if all dynamic HTML is HTTP 429."""
    code, mime, body = get(BASE + "/sitemap-ai-v2.xml", limit=3000000)
    print("NDN_STATIC_AI_V2_ROOT_HTTP=" + str(code))
    if code != 200 or "xml" not in mime:
        raise RuntimeError("STATIC_AI_V2_ROOT_NOT_200_XML")
    paths = ai_v2_shard_paths(body)
    count = 0
    for path in paths:
        status, mime, data = get(path, limit=4000000)
        print("NDN_STATIC_AI_V2_SHARD=" + path + ";HTTP=" + str(status))
        if status != 200 or "xml" not in mime:
            raise RuntimeError("STATIC_AI_V2_SHARD_NOT_200_XML")
        rows = article_urls(data)
        total_in_xml = len(ET.fromstring(data).findall("s:url", NAMESPACE))
        if not 1 <= len(rows) <= 2000 or len(rows) != total_in_xml or len(rows) != len(set(rows)):
            raise RuntimeError("STATIC_AI_V2_INVALID_OR_DUPLICATE_ARTICLE_URLS")
        count += len(rows)
    print("NDN_STATIC_AI_V2_GOOGLE_CRAWL_DISCOVERY=VERIFIED;SHARDS="
          + str(len(paths)) + ";PUBLICATION_LEDGER_URLS=" + str(count))
    # This proves XML availability only, NOT Google indexing or article HTTP 200.
    return count


def get(url, limit=600000):
    if not safe_url(url):
        raise ValueError("INVALID_URL_HOST")
    opener = urllib.request.build_opener(NoCrossHostRedirect)
    request = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "text/html,application/xml"})
    try:
        with opener.open(request, timeout=17) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read(limit)
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get("Content-Type", ""), error.read(2000)


class NoCrossHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not safe_url(newurl):
            raise ValueError("REFUSE_EXTERNAL_REDIRECT")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def run():
    verify_static_bulk_archive()
    verify_static_ai_v2()
    status, _, _ = get(BASE + "/")
    print("NDN_DYNAMIC_HOMEPAGE_HTTP=" + str(status))
    if status == 429:
        print("NDN_LIVE_ARTICLE_SMOKE=SKIPPED_WORKER_QUOTA_EXHAUSTED;NO_CLAIM_OF_RECOVERY")
        return 0
    if status != 200:
        raise RuntimeError("DYNAMIC_HOMEPAGE_NOT_200_" + str(status))

    status, _, sitemap_body = get(BASE + "/sitemap.xml", limit=3000000)
    if status != 200:
        raise RuntimeError("ROOT_SITEMAP_HTTP_" + str(status))
    nested = choose_sitemaps(sitemap_body)
    print("NDN_CRAWL_SITEMAP_CHILDREN_TO_TEST=" + str(len(nested)))

    pages = []
    for path in nested:
        code, content_type, body = get(path, limit=3000000)
        print("NDN_NESTED_SITEMAP=" + path + ";HTTP=" + str(code))
        if code != 200 or "xml" not in content_type:
            raise RuntimeError("NESTED_SITEMAP_NOT_XML_200_" + str(code))
        rows = article_urls(body)
        if not rows:
            raise RuntimeError("NESTED_SITEMAP_NO_ARTICLE_URLS")
        pages.append(rows[0])
    visited = set()
    for url in pages:
        if url in visited:
            continue
        visited.add(url)
        code, content_type, body = get(url)
        print("NDN_REAL_ARTICLE=" + url + ";HTTP=" + str(code))
        if code != 200 or "html" not in content_type:
            raise RuntimeError("REAL_PUBLISHED_ARTICLE_NOT_HTML_200_" + str(code))
        html = body.decode("utf-8", "replace").lower()
        if "<html" not in html or "<title" not in html or "<h1" not in html:
            raise RuntimeError("REAL_PUBLISHED_ARTICLE_MISSING_HTML_TITLE_OR_H1")
        if 'rel="canonical"' not in html and "rel='canonical'" not in html:
            raise RuntimeError("REAL_PUBLISHED_ARTICLE_MISSING_CANONICAL")
    print("NDN_LIVE_ARTICLE_INDEXABILITY_SMOKE=VERIFIED;PAGES=" + str(len(visited)))


if __name__ == "__main__":
    try:
        sys.exit(run() or 0)
    except Exception as exc:
        print("::error::NDN_LIVE_CRAWL_CHECK_FAILED=" + str(exc)[:230])
        sys.exit(1)
