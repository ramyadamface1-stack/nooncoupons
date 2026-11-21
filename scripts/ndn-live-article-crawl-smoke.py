"""Read-only live SEO smoke: sample actual published article URLs after quota reset.

Do not confuse a working GitHub deployment / static sitemap with live
article indexability. This probe runs only when homepage is HTTP 200 and never
writes to R2, Cloudflare, Search Console, or the publishing API.

No API secrets, no remote redirects, and <= 2 nested sitemaps + 2 HTML pages.
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
