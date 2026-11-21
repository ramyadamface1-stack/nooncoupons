"""Regressions: historical article XML parity, R2 read-only and fail-closed."""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
import xml.etree.ElementTree as ET

SRC = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build-ndn-static-bulk-article-sitemaps.py"
spec = importlib.util.spec_from_file_location("ndn_bulk_archive", SRC)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def canonical(paths):
    return ('<?xml version="1.0"?><sitemapindex xmlns="'
            + NS["s"] + '">' + "".join(
                "<sitemap><loc>" + m.ORIGIN + p + "</loc></sitemap>" for p in paths
            ) + "</sitemapindex>")


class FakeR2:
    def __init__(self, objects):
        self.objects = objects
        self.reads = []
    def get_object(self, Bucket, Key):
        self.reads.append((Bucket, Key))
        return {"Body": io.BytesIO(json.dumps(self.objects[Key]).encode("utf-8"))}


def article(slug="saudi-buyer-verified-coupon-2026", **changes):
    return dict({
        "slug": slug, "status": "published", "quality": 97,
        "qualityFloor": 90, "wordCount": 1650, "country": "SA",
        "createdAt": "2026-10-18T12:00:00Z", "indexable": True
    }, **changes)


class BulkStaticTests(unittest.TestCase):
    def test_eligibility_mirrors_existing_live_quality_gate(self):
        self.assertTrue(m.eligible(article()))
        for changed in [
            {"status": "draft"}, {"quality": 94}, {"qualityFloor": 87},
            {"wordCount": 1499}, {"indexable": False}, {"orphan": True},
            {"superseded": True}, {"duplicateIntent": True}, {"p0": ["thin"]},
            {"indexation": {"indexable": False}},
        ]:
            self.assertFalse(m.eligible(article(**changed)), changed)
        self.assertTrue(m.eligible(article(wordCount=None, qualityFloor=None)))
        self.assertFalse(m.eligible(article(quality="invalid")))

    def test_root_sitemap_only_original_historical_shards(self):
        paths = ["/sitemap-articles-2026-10-18-0.xml",
                 "/sitemap-articles-2026-10-17-25.xml"]
        root = canonical(["/sitemap-core.xml", paths[0], "/sitemap-ai-v2.xml", paths[1]])
        self.assertEqual(m.expected_paths(root), paths)
        with self.assertRaisesRegex(ValueError, "FOREIGN_URL"):
            m.expected_paths(canonical(["/sitemap-pages.xml"]).replace(
                m.ORIGIN + "/sitemap-pages.xml", "https://evil.example/x.xml"))
        with self.assertRaisesRegex(ValueError, "DUPLICATES"):
            m.expected_paths(canonical([paths[0], paths[0]]))

    def test_render_filters_unpublished_without_altering_source(self):
        valid = article(slug="خصم-نون-السعودية-نوفمبر-2026")
        source = {"articles": [valid, article("a-draft-article", status="draft")]}
        xml, count = m.render_shard("/sitemap-articles-2026-10-18-0.xml", source)
        self.assertEqual(count, 1)
        tree = ET.fromstring(xml)
        urls = tree.findall("s:url", NS)
        self.assertEqual(len(urls), 1)
        self.assertIn("%D8%AE%D8%B5%D9%85", urls[0].find("s:loc", NS).text)
        self.assertEqual(urls[0].find("s:lastmod", NS).text, valid["createdAt"])
        self.assertEqual(source["articles"][1]["status"], "draft")
        self.assertNotIn("a-draft-article", xml)

    def test_read_only_r2_fetch_and_preserve_others(self):
        paths = ["/sitemap-articles-2026-10-18-0.xml",
                 "/sitemap-articles-2026-10-17-25.xml"]
        client = FakeR2({
            m.key_for_path(paths[0]): {"articles": [article()]},
            m.key_for_path(paths[1]): {"articles": [
                article(slug="uae-buyer-verified-coupon-2026", country="AE")]},
        })
        with tempfile.TemporaryDirectory() as d:
            folder = pathlib.Path(d)
            (folder / "sitemap-ai-v2.xml").write_text("trusted existing XML")
            (folder / "sitemap-articles-2026-10-19-0.xml").write_text("stale")
            built = m.build(client, canonical(paths), folder)
            self.assertEqual((built["count"], built["urls"], built["empty"]), (2, 2, 0))
            self.assertEqual(len(client.reads), 2)
            self.assertEqual((folder / "sitemap-ai-v2.xml").read_text(), "trusted existing XML")
            self.assertFalse((folder / "sitemap-articles-2026-10-19-0.xml").exists())
            self.assertIn("<urlset", (folder / paths[0].lstrip("/")).read_text())

    def test_fail_closed_missing_or_invalid_r2_source(self):
        paths = ["/sitemap-articles-2026-10-18-0.xml",
                 "/sitemap-articles-2026-10-17-0.xml"]
        partial = FakeR2({m.key_for_path(paths[0]): {"articles": [article()]}})
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(KeyError):
                m.build(partial, canonical(paths), pathlib.Path(d))
            self.assertEqual(list(pathlib.Path(d).iterdir()), [])
        with self.assertRaisesRegex(ValueError, "SHARD_SCHEMA_INVALID"):
            m.render_shard(paths[0], {"articles": {}})
        with self.assertRaisesRegex(ValueError, "INVALID_SLUG"):
            m.render_shard(paths[0], {"articles": [article(slug="../admin")]})

    def test_no_bulk_paths_do_not_fabricate_or_delete_existing_files(self):
        with tempfile.TemporaryDirectory() as d:
            folder = pathlib.Path(d)
            (folder / "sitemap-ai-v2.xml").write_text("keep")
            result = m.build(FakeR2({}), canonical(["/sitemap-ai-v2.xml"]), folder)
            self.assertEqual(result["count"], 0)
            self.assertEqual((folder / "sitemap-ai-v2.xml").read_text(), "keep")


if __name__ == "__main__":
    unittest.main()
