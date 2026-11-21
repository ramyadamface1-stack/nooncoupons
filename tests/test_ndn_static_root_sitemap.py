"""Offline unit tests for the read-only static root sitemap builder."""
import datetime
import importlib.util
import pathlib
import unittest
import xml.etree.ElementTree as ET

MODULE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build-ndn-static-root-sitemap.py"
spec = importlib.util.spec_from_file_location("ndn_static_sitemap", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class SitemapBuilderTests(unittest.TestCase):
    def test_fallback_bulk_day_shards_and_canonical_routes(self):
        days = {"days": [{"day": "2026-11-21", "shards": 2},
                         {"day": "2026-11-20", "shards": 1}]}
        paths = mod.make_paths(days)
        self.assertEqual(paths[:3], [
            "/sitemap-articles-2026-11-21-1.xml",
            "/sitemap-articles-2026-11-21-0.xml",
            "/sitemap-articles-2026-11-20-0.xml",
        ])
        self.assertIn("/sitemap-coupons.xml", paths)
        self.assertIn("/sitemap-core.xml", paths)
        self.assertIn("/sitemap-ai-v2.xml", paths)
        self.assertNotIn("/articles/example", paths)
        self.assertEqual(len(paths), len(set(paths)))
        root = ET.fromstring(mod.render(paths))
        self.assertEqual(len(list(root)), len(paths))

    def test_completed_audit_owner_and_incremental_fresh_days(self):
        discovery = {"complete": True, "version": 1, "shards": 2,
                     "runId": "v1", "sourceAuditRunId": "audit",
                     "generatedAt": "2026-11-20T12:00:00Z"}
        days = {"days": [
            {"day": "2026-11-20", "shards": 1, "updatedAt": "2026-11-20T11:59:00Z"},
            {"day": "2026-11-21", "shards": 2, "updatedAt": "2026-11-21T01:30:00Z"},
        ]}
        paths = mod.make_paths(days, discovery)
        self.assertIn("/sitemap-audit-articles-0.xml", paths)
        self.assertIn("/sitemap-audit-articles-1.xml", paths)
        self.assertIn("/sitemap-fresh-articles-2026-11-21-1.xml", paths)
        self.assertNotIn("/sitemap-fresh-articles-2026-11-20-0.xml", paths)
        self.assertNotIn("/sitemap-articles-2026-11-21-0.xml", paths)

    def test_rescue_quality_and_english_segments_preserved(self):
        rescue = {
            "version": 1, "count": 2000,
            "segments": [{"n": 0, "count": 2000, "key": "some-key"}],
            "englishCount": 120,
            "englishSegments": [{"n": 3, "count": 120, "key": "some-key"}]
        }
        now = datetime.datetime(2026, 11, 21, tzinfo=datetime.timezone.utc).timestamp()
        live = {"articles": [{"slug": "en-test", "status": "published",
                              "indexable": True, "quality": 96,
                              "wordCount": 1550,
                              "publishedAt": "2026-11-20T12:00:00Z"},
                             {"slug": "draft-only", "status": "draft",
                              "quality": 99, "wordCount": 1900,
                              "publishedAt": "2026-11-20T12:00:00Z"}]}
        paths = mod.make_paths({"days": []}, rescue=rescue, live=live, now=now)
        for p in [
            "/sitemap-rescue-articles-0.xml",
            "/sitemap-rescue-images-0.xml",
            "/sitemap-rescue-english-3.xml",
            "/sitemap-rescue-english-images-3.xml",
            "/sitemap-rescue-catalog.xml",
            "/sitemap-rescue-english-catalog.xml",
            "/sitemap-live-recent.xml",
        ]:
            self.assertIn(p, paths)
        self.assertNotIn("/articles/draft-only", paths)

    def test_fail_closed_on_missing_bulk_days_or_invalid_manifest_path(self):
        with self.assertRaisesRegex(ValueError, "BULK_DAYS_MANIFEST_REQUIRED"):
            mod.make_paths(None)
        with self.assertRaisesRegex(ValueError, "BULK_DAYS_MANIFEST_REQUIRED"):
            mod.make_paths({"days": "not-a-list"})
        self.assertFalse(mod.is_eligible_live({
            "slug": "../admin", "status": "published", "quality": 100,
            "wordCount": 2000, "publishedAt": "2026-11-20T12:00:00Z"
        }))
        with self.assertRaisesRegex(ValueError, "UNSAFE_SITEMAP_INDEX_SIZE"):
            mod.render([])


if __name__ == "__main__":
    unittest.main()
