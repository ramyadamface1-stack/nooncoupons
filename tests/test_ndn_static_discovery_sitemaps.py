"""Exact exported discovery sitemap renderers run on local read-only R2."""
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("stage_discovery",ROOT/"scripts/stage-ndn-static-discovery-inputs.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NS={"s":"http://www.sitemaps.org/schemas/sitemap/0.9"}


def article(slug,country,coupon):
    return {"slug":slug,"country":country,"coupon":coupon,"quality":97,
      "qualityFloor":90,"wordCount":1700,"status":"published","indexable":True,
      "title":"Noon Shopping Coupon Guide "+slug,"primaryKeyword":"Noon coupon",
      "categoryKey":"mobiles","brandKey":"samsung",
      "createdAt":"2026-11-21T11:00:00Z","publishedAt":"2026-11-21T11:00:00Z"}


class DiscoveryStaticTests(unittest.TestCase):
    def test_read_only_compact_manifest_quality_precondition(self):
        baseline={"bulk/public-compact-v1.json":{"version":1,"articles":[article("saudi-buyer-test", "SA","NOV170")]},
                  "english-canary/public-recent-v1.json":{"version":1,"articles":[]}}
        self.assertEqual(mod.validate(baseline)["compactEntries"],1)
        self.assertTrue(mod.validate(baseline)["usesCompact"])
        baseline["bulk/public-compact-v1.json"]["version"]=2
        with self.assertRaisesRegex(ValueError,"COMPACT"):
            mod.validate(baseline)
        with self.assertRaisesRegex(ValueError,"PUBLIC_MANIFEST_NOT_AVAILABLE"):
            mod.validate({})

    def test_original_exported_priority_hub_english_image_renderers(self):
        data={
          "bulk/public-compact-v1.json":{"version":1,"articles":[article(
            "saudi-buyer-verified-nov170-2026","SA","NOV170")]},
          "bulk/latest.json":None,
          "english-canary/public-recent-v1.json":{"version":1,"articles":[article(
            "en-uae-buyer-verified-nov188-2026","AE","NOV188")]},
          "maintenance/article-discovery-v1/current.json":{"complete":True,"version":1,
            "shards":5,"generatedAt":"2026-11-21T09:00:00Z"}
        }
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            (root/".ndn-discovery-temp").mkdir()
            (root/".ndn-static-assets").mkdir()
            (root/".ndn-static-assets/sitemap-live-recent.xml").write_text("dynamic untouched marker")
            (root/".ndn-discovery-temp/manifest.json").write_text(json.dumps(data),encoding="utf-8")
            proc=subprocess.run(["node",str(ROOT/"scripts/render-ndn-static-discovery-sitemaps.mjs")],
                                cwd=d,capture_output=True,text=True,timeout=40)
            self.assertEqual(proc.returncode,0,proc.stderr)
            expected=["sitemap-priority.xml","sitemap-en-articles.xml",
                      "sitemap-hubs.xml","sitemap-images.xml"]
            for filename in expected:
                xml=(root/".ndn-static-assets"/filename).read_text()
                doc=ET.fromstring(xml)
                self.assertTrue(doc.tag.endswith("urlset"),filename)
                locs=[x.text for x in doc.findall("s:url/s:loc",NS)]
                self.assertGreaterEqual(len(locs),1,filename)
                self.assertTrue(all(x.startswith(mod.ACCOUNT.replace(
                    mod.ACCOUNT,"https://noondealsnow.com")) for x in locs))
            self.assertEqual((root/".ndn-static-assets/sitemap-live-recent.xml").read_text(),
                             "dynamic untouched marker")
            english=(root/".ndn-static-assets/sitemap-en-articles.xml").read_text()
            images=(root/".ndn-static-assets/sitemap-images.xml").read_text()
            self.assertIn("en-uae-buyer-verified-nov188-2026",english)
            self.assertIn("<image:image>",images)
            self.assertIn("/assets/coupon-svg/",images)
            self.assertIn("NOV170",images)
            self.assertIn("NOV188",images)


if __name__=="__main__":
    unittest.main()
