import io,os,sys,unittest,hashlib,json,importlib.util
from pathlib import Path
from unittest.mock import patch
import boto3
from botocore.exceptions import ClientError

FILE=Path(__file__).resolve().parents[1]/'.github/scripts/migrate-r2-resumable.py'

class FakeS3:
    def __init__(self): self.objects={};self.writes=[]
    def get_object(self,**kw):
        key=kw["Key"]
        if key not in self.objects:
            raise ClientError({"Error":{"Code":"NoSuchKey","Message":"not found"}},"GetObject")
        v=self.objects[key]
        return {"Body":io.BytesIO(v["data"]), "ContentType":v["contentType"], "Metadata":v["metadata"]}
    def put_object(self,**kw):
        data=kw["Body"]
        if hasattr(data,"read"):data=data.read()
        k=kw["Key"];self.writes.append(k)
        self.objects[k]={"data":data,"contentType":kw.get("ContentType","binary/octet-stream"),"metadata":kw.get("Metadata",{})}

def load():
    old,new=FakeS3(),FakeS3()
    for k,v in {
        "NOON_OLD_R2_ACCESS_KEY_ID":"a"*32,"NOON_OLD_R2_SECRET_ACCESS_KEY":"b"*64,
        "NOON_NEW_R2_ACCESS_KEY_ID":"c"*32,"NOON_NEW_R2_SECRET_ACCESS_KEY":"d"*64,
    }.items():os.environ[k]=v
    def fake_client(*args,**kw):
        return old if "c82274152a942dea53044eae7153cfd7" in kw.get("endpoint_url","") else new
    with patch.object(boto3,"client",side_effect=fake_client):
        spec=importlib.util.spec_from_file_location("r2copy",FILE)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    return mod,old,new

class MigrationMutableTests(unittest.TestCase):
    def test_live_source_index_size_change_copies_actual_get_bytes(self):
        m,old,new=load();key="quality/global-index/v2/SA/id.json"
        old.put_object(Bucket="b",Key=key,Body=b"fresh-longer",ContentType="application/json")
        m.migrate_one({"Key":key,"Size":5})
        self.assertEqual(new.objects[key]["data"],b"fresh-longer")
        self.assertEqual(m.totals["verified"],1)
        self.assertEqual(m.totals["source_changed"],1)

    def test_conflicting_dynamic_destination_is_deferred_and_audited(self):
        m,old,new=load();key="quality/global-index/v2/SA/id.json"
        old.put_object(Bucket="b",Key=key,Body=b"source",ContentType="application/json")
        new.put_object(Bucket="b",Key=key,Body=b"old",ContentType="application/json")
        m.migrate_one({"Key":key,"Size":6})
        self.assertEqual(new.objects[key]["data"],b"old")
        self.assertEqual(m.totals["deferred"],1)
        self.assertEqual(m.totals["verified"],0)
        m.save_deferred_page("quality/",None)
        path=[p for p in new.objects if p.startswith("migration/transfer/deferred-volatile-v1/")][0]
        audit=json.loads(new.objects[path]["data"])
        self.assertEqual(audit["objects"][0]["key"],key)
        self.assertTrue(audit["sourceStillActive"])

    def test_immutable_article_size_change_aborts(self):
        m,old,new=load();key="articles/do-not-lose.html"
        old.put_object(Bucket="b",Key=key,Body=b"new text",ContentType="text/html")
        with self.assertRaisesRegex(RuntimeError,"source_size_changed_during_copy"):
            m.migrate_one({"Key":key,"Size":4})
        self.assertNotIn(key,new.objects)

    def test_immutable_destination_conflict_aborts_without_overwrite(self):
        m,old,new=load();key="articles/do-not-lose.html"
        old.put_object(Bucket="b",Key=key,Body=b"source",ContentType="text/html")
        new.put_object(Bucket="b",Key=key,Body=b"target",ContentType="text/html")
        with self.assertRaisesRegex(RuntimeError,"destination_existing_mismatch_no_overwrite"):
            m.migrate_one({"Key":key,"Size":6})
        self.assertEqual(new.objects[key]["data"],b"target")

    def test_empty_deferred_page_does_not_generate_audit(self):
        m,old,new=load()
        m.save_deferred_page("articles/","cursor")
        self.assertEqual(new.objects,{})

if __name__=="__main__":unittest.main()
