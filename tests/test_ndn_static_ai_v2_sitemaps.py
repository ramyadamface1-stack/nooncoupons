"""Parity and safety tests for quota-free native AI V2 article sitemaps."""
import importlib.util
import pathlib
import tempfile
import unittest
import xml.etree.ElementTree as ET

SOURCE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build-ndn-static-ai-v2-sitemaps.py"
spec = importlib.util.spec_from_file_location("ndn_ai_static_sitemaps", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def mk(n, country="SA"):
    return {"slug": f"buyer-verified-item-{n:05d}-coupon", "country": country,
            "publishedAt": f"2026-11-{(n % 20) + 1:02d}T12:00:00Z",
            "provider": "gemini", "keyRef": "REDACTED_SHOULD_NOT_APPEAR"}


class StaticNativeAiSitemapTests(unittest.TestCase):
    def test_root_and_multiple_leaves_preserve_source_order(self):
        entries = [mk(i, "SA" if i % 2 == 0 else "AE") for i in range(2001)]
        files = mod.render({"version": 1, "articles": entries})
        self.assertEqual(set(files), {"sitemap-ai-v2.xml", "sitemap-ai-v2-1.xml", "sitemap-ai-v2-2.xml"})
        root = ET.fromstring(files["sitemap-ai-v2.xml"])
        children = root.findall("s:sitemap", NS)
        self.assertEqual(len(children), 2)
        self.assertEqual(children[0].find("s:loc", NS).text, mod.ORIGIN + "/sitemap-ai-v2-1.xml")
        self.assertEqual(children[1].find("s:lastmod", NS).text, entries[-1]["publishedAt"])
        first = ET.fromstring(files["sitemap-ai-v2-1.xml"]).findall("s:url", NS)
        last = ET.fromstring(files["sitemap-ai-v2-2.xml"]).findall("s:url", NS)
        self.assertEqual(len(first), 2000)
        self.assertEqual(len(last), 1)
        self.assertEqual(first[0].find("s:loc", NS).text, mod.ORIGIN + "/articles/" + entries[0]["slug"])
        self.assertEqual(last[0].find("s:loc", NS).text, mod.ORIGIN + "/articles/" + entries[-1]["slug"])
        self.assertNotIn("REDACTED_SHOULD_NOT_APPEAR", "".join(files.values()))
        self.assertNotIn("gemini", "".join(files.values()))

    def test_empty_ledger_matches_live_urlset_and_no_stale_shards(self):
        files = mod.render({"version": 1, "articles": []})
        self.assertEqual(list(files), ["sitemap-ai-v2.xml"])
        self.assertEqual(ET.fromstring(files["sitemap-ai-v2.xml"]).tag.split("}")[-1], "urlset")
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "sitemap-ai-v2-1.xml").write_text("stale")
            (root / "robots.txt").write_text("preserved")
            mod.write_files(files, root)
            self.assertFalse((root / "sitemap-ai-v2-1.xml").exists())
            self.assertEqual((root / "robots.txt").read_text(), "preserved")

    def test_invalid_records_fail_closed_without_files(self):
        for source in [
            None, {},
            {"version": 2, "articles": []},
            {"version": 1, "articles": {}},
            {"version": 1, "articles": [mk(1), mk(1)]},
            {"version": 1, "articles": [{**mk(1), "country": "EG"}]},
            {"version": 1, "articles": [{**mk(1), "slug": "../../admin"}]},
            {"version": 1, "articles": [{**mk(1), "slug": "short"}]},
        ]:
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    mod.render(source)

    def test_only_static_xml_routes_and_no_article_html(self):
        files = mod.render({"version": 1, "articles": [mk(9)]})
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "sitemap.xml").write_text("original canonical root")
            mod.write_files(files, root)
            self.assertEqual((root / "sitemap.xml").read_text(), "original canonical root")
            self.assertTrue(all(x.name.endswith(".xml") for x in root.iterdir()))
            self.assertTrue(all(path.name.startswith("sitemap-ai-v2") for path in root.iterdir() if path.name != "sitemap.xml"))


if __name__ == "__main__":
    unittest.main()
