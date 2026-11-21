"""Regression tests for read-only live crawl probes; makes no HTTP requests."""
import importlib.util
import pathlib
import unittest

PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "ndn-live-article-crawl-smoke.py"
spec = importlib.util.spec_from_file_location("ndn_crawl_smoke", PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
BASE = "https://noondealsnow.com"
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def index(urls):
    return ('<?xml version="1.0"?><sitemapindex xmlns="' + NS + '">' +
            "".join("<sitemap><loc>" + x + "</loc></sitemap>" for x in urls) +
            "</sitemapindex>").encode()


def articles(urls):
    return ('<?xml version="1.0"?><urlset xmlns="' + NS + '">' +
            "".join("<url><loc>" + x + "</loc></url>" for x in urls) +
            "</urlset>").encode()


class CrawlSmokeTests(unittest.TestCase):
    def test_prefers_recent_then_archive_and_never_scans_all(self):
        urls = [
            BASE + "/sitemap-pages.xml",
            BASE + "/sitemap-audit-articles-0.xml",
            BASE + "/sitemap-live-recent.xml",
            BASE + "/sitemap-rescue-articles-1.xml",
        ]
        self.assertEqual(mod.choose_sitemaps(index(urls)), [
            BASE + "/sitemap-live-recent.xml",
            BASE + "/sitemap-audit-articles-0.xml",
        ])

    def test_native_ai_root_all_shards_and_strict_order(self):
        paths = [BASE + f"/sitemap-ai-v2-{n}.xml" for n in range(1, 6)]
        self.assertEqual(mod.ai_v2_shard_paths(index(paths)), paths)
        with self.assertRaisesRegex(ValueError, "AI_V2_NONCANONICAL_SHARD_ORDER"):
            mod.ai_v2_shard_paths(index([paths[1], paths[0]]))
        with self.assertRaisesRegex(ValueError, "AI_V2_DUPLICATE_SHARD_URLS"):
            mod.ai_v2_shard_paths(index([paths[0], paths[0]]))
        with self.assertRaisesRegex(ValueError, "AI_V2_FOREIGN_SHARD_URL"):
            mod.ai_v2_shard_paths(index(["https://evil.example/sitemap-ai-v2-1.xml"]))
        with self.assertRaisesRegex(ValueError, "AI_V2_UNEXPECTED_SHARD_COUNT"):
            mod.ai_v2_shard_paths(index([]))

    def test_falls_back_to_day_article_sitemaps(self):
        result = mod.choose_sitemaps(index([
            BASE + "/sitemap-pages.xml",
            BASE + "/sitemap-articles-2026-11-20-1.xml",
        ]))
        self.assertEqual(result, [BASE + "/sitemap-articles-2026-11-20-1.xml"])

    def test_requires_actual_canonical_article_links(self):
        urls = mod.article_urls(articles([
            BASE + "/articles/real-ar",
            BASE + "/en/articles/real-en",
            BASE + "/blog/old-article",
            BASE + "/privacy",
        ]))
        self.assertEqual(len(urls), 3)
        with self.assertRaisesRegex(ValueError, "CHILD_ARTICLE_SITEMAP_EMPTY"):
            mod.article_urls(articles([]))

    def test_never_fetches_cross_domain_or_credentialed_links(self):
        for url in ["https://evil.example/articles/anything",
                    "http://noondealsnow.com/articles/test",
                    "https://user:secret@noondealsnow.com/articles/test",
                    "https://noondealsnow.com.evil.example/articles/x"]:
            self.assertFalse(mod.safe_url(url))
        with self.assertRaisesRegex(ValueError, "ROOT_HAS_FOREIGN_SITEMAP_URL"):
            mod.choose_sitemaps(index([BASE + "/sitemap-articles-0.xml",
                                       "https://evil.example/sitemap-articles-0.xml"]))
        with self.assertRaisesRegex(ValueError, "CHILD_HAS_FOREIGN_URLS"):
            mod.article_urls(articles(["https://evil.example/articles/pwned"]))

    def test_rejects_invalid_xml_and_nonarticle_sitemap(self):
        with self.assertRaises(ValueError):
            mod.choose_sitemaps(index([BASE + "/sitemap-pages.xml"]))
        with self.assertRaises(Exception):
            mod.article_urls(b"<html>invalid")
        with self.assertRaises(ValueError):
            mod.article_urls(index([BASE + "/sitemap-pages.xml"]))


if __name__ == "__main__":
    unittest.main()
