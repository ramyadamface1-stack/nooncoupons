import importlib.util
import pathlib
import tempfile
import unittest
import xml.etree.ElementTree as ET

SRC = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "prune-empty-bulk-sitemap-references.py"
spec = importlib.util.spec_from_file_location("ndn_prune", SRC)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def index(names):
    return ('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="' + NS["s"] + '">'
            + "".join("<sitemap><loc>" + m.ORIGIN + "/" + x + "</loc></sitemap>" for x in names)
            + "</sitemapindex>")


def urlset(urls):
    return ('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="' + NS["s"] + '">'
            + "".join("<url><loc>" + x + "</loc></url>" for x in urls) + "</urlset>")


class PruneEmptyBulkSitemapTests(unittest.TestCase):
    def test_only_empty_index_reference_removed_no_article_or_leaf_deleted(self):
        a = "sitemap-articles-2026-09-15-0.xml"
        b = "sitemap-articles-2026-11-20-2.xml"
        other = "sitemap-ai-v2.xml"
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            (root / a).write_text(urlset([]))
            (root / b).write_text(urlset([m.ORIGIN + "/articles/saudi-original-article"]))
            before_a = (root / a).read_text()
            before_b = (root / b).read_text()
            text, report = m.prune(index([other,a,b]),root)
            found = [x.text for x in ET.fromstring(text).findall("s:sitemap/s:loc", NS)]
            self.assertEqual(found,[m.ORIGIN+"/"+other,m.ORIGIN+"/"+b])
            self.assertEqual(report["removedEmptyReferences"],1)
            self.assertEqual(report["nonEmptyHistoricalSitemaps"],1)
            self.assertTrue(report["emptyFilesPreserved"])
            self.assertEqual((root/a).read_text(),before_a)
            self.assertEqual((root/b).read_text(),before_b)

    def test_absent_historic_leaf_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError,"REFERENCED_HISTORIC_SITEMAP_NOT_BUILT"):
                m.prune(index(["sitemap-articles-2026-11-20-0.xml"]),pathlib.Path(d))

    def test_mixed_other_roots_remain_byte_for_byte_unmodified(self):
        source=index(["sitemap-core.xml","sitemap-ai-v2.xml","sitemap-commercial.xml"])
        with tempfile.TemporaryDirectory() as d:
            found,report=m.prune(source,pathlib.Path(d))
            self.assertEqual(found,source)
            self.assertEqual(report["removedEmptyReferences"],0)

    def test_all_empty_references_fail_closed(self):
        empty="sitemap-articles-2026-09-15-0.xml"
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            (root/empty).write_text(urlset([]))
            with self.assertRaisesRegex(ValueError,"REFUSING_ALL_HISTORIC_SITEMAPS_EMPTY"):
                m.prune(index([empty]),root)


if __name__ == "__main__":
    unittest.main()
