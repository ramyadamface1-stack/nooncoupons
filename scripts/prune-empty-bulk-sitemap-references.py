"""Drop only provably empty, previously built historical article sitemap refs.

The prebuild first reads/verifies every referenced R2 historical shard. This
postbuild operates solely on the generated static XML assets and removes an
empty leaf's <sitemap> entry from sitemap.xml; it does NOT delete the leaf
file, original R2 object or any HTML/slug/coupon. The root remains fully
discoverable even when the Cloudflare Worker free quota is exhausted.
"""
import json
import pathlib
import re
import xml.etree.ElementTree as ET

ORIGIN = "https://noondealsnow.com"
ASSETS = pathlib.Path(".ndn-static-assets")
ROOT = ASSETS / "sitemap.xml"
REPORT = pathlib.Path(".ndn-blog-staging/empty-article-sitemap-references.json")
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
BULK = re.compile(r"^sitemap-articles-20\d{2}-\d{2}-\d{2}-(?:0|[1-9]\d{0,3})\.xml$")


def prune(root_xml, assets):
    tree = ET.fromstring(root_xml)
    if not tree.tag.endswith("sitemapindex"):
        raise ValueError("ROOT_NOT_SITEMAP_INDEX")
    entries = tree.findall("s:sitemap/s:loc", NS)
    referenced = [str(n.text or "") for n in entries]
    if not referenced or len(referenced) != len(set(referenced)):
        raise ValueError("EMPTY_OR_DUPLICATE_SITEMAP_REFERENCES")
    empty = []
    inspected = 0
    live = 0
    for url in referenced:
        if not url.startswith(ORIGIN + "/"):
            raise ValueError("FOREIGN_SITEMAP_INDEX_ENTRY")
        name = url[len(ORIGIN) + 1 :]
        if not BULK.fullmatch(name):
            continue
        path = assets / name
        if not path.is_file():
            raise ValueError("REFERENCED_HISTORIC_SITEMAP_NOT_BUILT_" + name)
        doc = ET.parse(path).getroot()
        if not doc.tag.endswith("urlset"):
            raise ValueError("HISTORIC_SITEMAP_NOT_URLSET_" + name)
        rows = doc.findall("s:url", NS)
        inspected += 1
        if rows:
            live += 1
            continue
        empty.append(name)
    if inspected and not live:
        raise ValueError("REFUSING_ALL_HISTORIC_SITEMAPS_EMPTY")
    patched = root_xml
    for name in empty:
        entry = "<sitemap><loc>" + ORIGIN + "/" + name + "</loc></sitemap>"
        if patched.count(entry) != 1:
            raise ValueError("CANNOT_IDENTIFY_EMPTY_REFERENCED_SITEMAP_" + name)
        patched = patched.replace(entry, "", 1)
    output = ET.fromstring(patched)
    new_refs = [n.text for n in output.findall("s:sitemap/s:loc", NS)]
    expected = [url for url in referenced if url.removeprefix(ORIGIN + "/") not in set(empty)]
    if new_refs != expected:
        raise ValueError("NON_EMPTY_SITEMAP_ENTRY_ALTERED")
    if any(not (assets / name).is_file() for name in empty):
        raise ValueError("EMPTY_LEAF_FILE_WAS_DELETED")
    return patched, {
        "version": 1, "inspectedHistoricalSitemaps": inspected,
        "nonEmptyHistoricalSitemaps": live, "removedEmptyReferences": len(empty),
        "emptyFilesPreserved": True, "r2Writes": 0, "articleHtmlWrites": 0,
        "removedFromIndex": ["/" + name for name in empty]
    }


def main():
    if not ROOT.is_file():
        raise ValueError("ROOT_SITEMAP_NOT_BUILT")
    source = ROOT.read_text(encoding="utf8")
    patched, report = prune(source, ASSETS)
    if patched != source:
        ROOT.write_text(patched, encoding="utf8")
        if ROOT.read_text(encoding="utf8") != patched:
            raise ValueError("ROOT_SITEMAP_WRITE_NOT_CONFIRMED")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print("NDN_EMPTY_SITEMAP_INDEX_PRUNED="
          + str(report["removedEmptyReferences"])
          + ";NONEMPTY_SHARDS=" + str(report["nonEmptyHistoricalSitemaps"])
          + ";ORIGINAL_ARTICLE_HTML_TOUCHED=ZERO;R2_WRITES=ZERO")


if __name__ == "__main__":
    main()
