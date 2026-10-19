import io,importlib.util,unittest
from pathlib import Path
from botocore.exceptions import ClientError

path=Path(__file__).resolve().parents[1]/".github/scripts/migrate-r2-article-delta.py"
spec=importlib.util.spec_from_file_location("article_delta",path)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Fake:
    def __init__(self):self.data={};self.writes=0
    def get_object(self,Bucket,Key):
        if Key not in self.data:raise ClientError({"Error":{"Code":"NoSuchKey"}},"GetObject")
        data,attrs,metadata=self.data[Key]
        return {"Body":io.BytesIO(data),**attrs,"Metadata":metadata}
    def head_object(self,Bucket,Key):
        if Key not in self.data:raise ClientError({"Error":{"Code":"404"}},"HeadObject")
        return {"ContentLength":len(self.data[Key][0])}
    def put_object(self,**kwargs):
        self.writes+=1
        self.data[kwargs["Key"]]=(kwargs["Body"],{"ContentType":kwargs["ContentType"]},kwargs.get("Metadata",{}))

class ArticleDeltaTests(unittest.TestCase):
    def test_new_article_sha256_and_metadata_verified(self):
        src,dst=Fake(),Fake()
        src.data["articles/example.html"]=(b"<html>article</html>",{"ContentType":"text/html"},{"country":"SA"})
        status=m.transfer_one("articles/example.html",{"size":20},src,dst)
        self.assertEqual(status,"copied")
        self.assertEqual(dst.data["articles/example.html"],src.data["articles/example.html"])
        self.assertEqual(dst.writes,1)
    def test_immutable_article_not_overwritten_when_exists(self):
        src,dst=Fake(),Fake()
        src.data["articles/existing.html"]=(b"source",{"ContentType":"text/html"},{})
        dst.data["articles/existing.html"]=(b"target",{"ContentType":"text/html"},{})
        result=m.transfer_one("articles/existing.html",{"size":6},src,dst)
        self.assertEqual(result,"exists_since_list")
        self.assertEqual(dst.writes,0)
    def test_source_changed_mid_scan_retry_next_run(self):
        src,dst=Fake(),Fake()
        src.data["articles/updated.html"]=(b"updated",{"ContentType":"text/html"},{})
        result=m.transfer_one("articles/updated.html",{"size":5},src,dst)
        self.assertEqual(result,"source_changed")
        self.assertEqual(dst.writes,0)
    def test_classification_keeps_missing_even_with_conflict(self):
        src={"articles/conflict.html":{"size":10},"articles/missing.html":{"size":4}}
        dst={"articles/conflict.html":{"size":7}}
        missing,conflicts=m.classify_delta(src,dst)
        self.assertEqual([key for key,_ in missing],["articles/missing.html"])
        self.assertEqual(conflicts,["articles/conflict.html"])

    def test_existing_conflict_is_not_overwritten_when_other_missing_key_copied(self):
        source,target=Fake(),Fake()
        source.data["articles/conflict.html"]=(b"source-article",{"ContentType":"text/html"},{})
        source.data["articles/missing.html"]=(b"new-html",{"ContentType":"text/html"},{})
        target.data["articles/conflict.html"]=(b"original-different",{"ContentType":"text/html"},{})
        before=target.data["articles/conflict.html"]
        missing,conflicts=m.classify_delta(
            {key:{"size":len(value[0])} for key,value in source.data.items()},
            {key:{"size":len(value[0])} for key,value in target.data.items()})
        self.assertEqual(conflicts,["articles/conflict.html"])
        for key,attr in missing:
            self.assertEqual(m.transfer_one(key,attr,source,target),"copied")
        self.assertEqual(target.data["articles/conflict.html"],before)
        self.assertEqual(target.writes,1)

    def test_conflict_when_destination_size_differs(self):
        src,dst=Fake(),Fake()
        src.data["articles/existing.html"]=(b"source",{"ContentType":"text/html"},{})
        dst.data["articles/existing.html"]=(b"much-longer-target",{"ContentType":"text/html"},{})
        with self.assertRaisesRegex(RuntimeError,"destination_preexisting_size_conflict"):
            m.transfer_one("articles/existing.html",{"size":6},src,dst)
        self.assertEqual(dst.writes,0)

if __name__=="__main__":unittest.main()
