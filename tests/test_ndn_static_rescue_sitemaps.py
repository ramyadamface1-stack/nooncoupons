"""Rescue XML root/manifests fail closed; exact JS renderer integration."""
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("stage_ndn_rescue", ROOT / "scripts" / "stage-ndn-static-rescue-inputs.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NS = {"s":"http://www.sitemaps.org/schemas/sitemap/0.9"}


def root(paths):
    return ('<?xml version="1.0"?><sitemapindex xmlns="' + NS["s"] + '">'
            + ''.join('<sitemap><loc>' + mod.ORIGIN + p + '</loc></sitemap>' for p in paths)
            + '</sitemapindex>')


def source():
    manifest = {"version":1,"count":2,"englishCount":1,
        "segments":[{"n":0,"count":2,"key":"seo-rescue/samples/arabic-0.json"}],
        "englishSegments":[{"n":0,"count":1,"key":"seo-rescue/samples/english-0.json"}]}
    loaded = {
      "seo-rescue/samples/arabic-0.json": {"version":1,"articles":[
        {"slug":"saudi-buyer-test-coupon-2026","country":"SA","title":"Noon Saudi Coupon",
         "lastmod":"2026-11-21T12:00:00Z"},
        {"slug":"uae-buyer-test-coupon-2026","country":"AE","title":"Noon UAE Coupon",
         "lastmod":"2026-11-21T12:01:00Z"},
      ]},
      "seo-rescue/samples/english-0.json": {"version":1,"articles":[
        {"slug":"en-uae-buyer-test-2026","country":"AE","title":"Noon UAE English Coupon",
         "lastmod":"2026-11-21T12:02:00Z"}]}
    }
    return manifest, loaded


class RescueStaticTests(unittest.TestCase):
    def test_references_exact_canonical_rescue_paths(self):
        paths = ['/sitemap-pages.xml',
            '/sitemap-rescue-articles-0.xml','/sitemap-rescue-images-0.xml',
            '/sitemap-rescue-english-0.xml','/sitemap-rescue-english-images-0.xml',
            '/sitemap-rescue-catalog.xml','/sitemap-rescue-english-catalog.xml']
        self.assertEqual(len(mod.references(root(paths))),6)
        with self.assertRaisesRegex(ValueError, "EXTERNAL"):
            mod.references(root(paths).replace(mod.ORIGIN+'/sitemap-pages.xml','https://evil.example/sitemap-pages.xml'))
        with self.assertRaisesRegex(ValueError, "DUPLICATE"):
            mod.references(root([paths[1],paths[1]]))

    def test_only_existing_exact_manifest_segment_keys(self):
        manifest, _ = source()
        paths = ['/sitemap-rescue-articles-0.xml','/sitemap-rescue-images-0.xml',
                 '/sitemap-rescue-english-0.xml']
        mapping,keys = mod.sources_from_manifest(paths,manifest)
        self.assertEqual(len(mapping),3)
        self.assertEqual(len(keys),2)
        with self.assertRaisesRegex(ValueError, "MISSING_MANIFEST"):
            mod.sources_from_manifest(['/sitemap-rescue-articles-999.xml'],manifest)
        manifest["segments"][0]["key"]='../escape.json'
        with self.assertRaisesRegex(ValueError, "INVALID_SOURCE_KEY"):
            mod.sources_from_manifest(paths,manifest)

    def test_stages_raw_original_json_and_reuses_exact_js_xml_renderer(self):
        manifest, objects = source()
        paths = ['/sitemap-rescue-articles-0.xml','/sitemap-rescue-images-0.xml',
                 '/sitemap-rescue-english-0.xml','/sitemap-rescue-english-images-0.xml',
                 '/sitemap-rescue-catalog.xml','/sitemap-rescue-english-catalog.xml']
        with tempfile.TemporaryDirectory() as tmp:
            cwd = pathlib.Path(tmp)
            (cwd/'.ndn-static-assets').mkdir()
            result = mod.stage_from_loaded(root(paths),manifest,objects,cwd/'.ndn-rescue-temp')
            self.assertEqual(result,{"xmlPaths":6,"sourceObjects":2,"sourceArticleEntries":3})
            subprocess.run(["node",str(ROOT/"scripts/render-ndn-static-rescue-sitemaps.mjs")],
                           cwd=tmp,capture_output=True,text=True,check=True,timeout=35)
            for path in paths:
                doc = ET.parse(cwd/'.ndn-static-assets'/path[1:]).getroot()
                self.assertTrue(doc.tag.endswith("urlset"))
            arabic = (cwd/'.ndn-static-assets/sitemap-rescue-articles-0.xml').read_text()
            image = (cwd/'.ndn-static-assets/sitemap-rescue-images-0.xml').read_text()
            english = (cwd/'.ndn-static-assets/sitemap-rescue-english-0.xml').read_text()
            self.assertIn('https://noondealsnow.com/articles/saudi-buyer-test-coupon-2026',arabic)
            self.assertIn('/assets/coupon-svg/',image)
            self.assertIn('NOV170',image)
            self.assertIn('NOV188',image)
            self.assertIn('/en/articles/en-uae-buyer-test-2026',english)

    def test_manifest_or_source_drift_fails_before_writing(self):
        manifest,objects = source()
        with tempfile.TemporaryDirectory() as t:
            path = pathlib.Path(t)/'out'
            with self.assertRaisesRegex(ValueError,"REFERENCED_R2_OBJECT_MISSING"):
                mod.stage_from_loaded(root(['/sitemap-rescue-articles-0.xml']),
                                      manifest,{},path)
            self.assertFalse(path.exists())
        objects["seo-rescue/samples/arabic-0.json"]["articles"].pop()
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaisesRegex(ValueError, "SOURCE_COUNT_DRIFT"):
                mod.stage_from_loaded(root(['/sitemap-rescue-articles-0.xml']),
                                      manifest,objects,pathlib.Path(t)/'out')


if __name__ == "__main__":
    unittest.main()
