#!/usr/bin/env python3
"""Build a conservative sparse Durable Object delta from two IMMUTABLE R2 backups.

Uses the EXISTING destination R2 bucket. Default is dry-run and reads only.
When explicit --apply + CONFIRM_SAFE_DELTA=YES both set, writes ONLY new prefix
migration/do-state/20261021-delta-v1/, never deleting or modifying old backups.

Does not activate Workers, alter nameservers, or deploy a publisher.
"""
import os,sys,json,hashlib,argparse,concurrent.futures,datetime,time
import boto3
from botocore.config import Config

BUCKET="nooncoupons-content-v2"
ACCOUNT="e4c35f8a50a7b2e4cfb9d6c534962603"
BASE_TAG="20261017-baseline"
CURRENT_TAG="20261020-old-do-recovery"
DELTA_TAG="20261021-delta-v1"
PAGE=128
EXPECTED={"ControlPlane":(353109,380267,31287)}
def compact_hash(x):
    return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).digest()
def as_json(doc):
    return json.dumps(doc,ensure_ascii=False,separators=(",",":")).encode("utf-8")
def select_delta(before,after):
    """Pure deterministic key/value diff; rejects deleted keys (must be reviewed)."""
    missing=set(before).difference(after)
    if missing:raise ValueError("deleted_source_keys_require_individual_review:"+str(len(missing)))
    result={}
    for key,value in after.items():
        if key not in before or compact_hash(before[key])!=compact_hash(value):
            if key.startswith("__noondealsnow_migration_"):
                raise ValueError("internal_control_key_cannot_be_imported")
            result[key]=value
    return result
def build_part(tag,typ,n,entries):
    return {"version":1,"tag":tag,"type":typ,"part":n,
            "cursorBefore":None,"cursorAfter":entries[-1][0] if entries else None,
            "scanned":len(entries),"entries":entries}
def verify_part(doc,tag,typ,n):
    if doc.get("version")!=1 or doc.get("tag")!=tag or doc.get("type")!=typ or doc.get("part")!=n:
        raise ValueError("mismatched_import_part_header")
    pairs=doc.get("entries")
    if not isinstance(pairs,list) or len(pairs)>PAGE or len(pairs)==0:raise ValueError("bad_entries_count")
    keys=set()
    for pair in pairs:
        if not isinstance(pair,list) or len(pair)!=2 or not isinstance(pair[0],str) or pair[0] in keys or pair[0].startswith("__noondealsnow_migration_"):
            raise ValueError("invalid_import_pair")
        keys.add(pair[0])
def s3_client():
    return boto3.client('s3',endpoint_url=f'https://{ACCOUNT}.r2.cloudflarestorage.com',region_name='auto',
        aws_access_key_id=os.environ["NOON_NEW_R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["NOON_NEW_R2_SECRET_ACCESS_KEY"].strip(),
        config=Config(max_pool_connections=24,connect_timeout=10,read_timeout=35,retries={"mode":"standard","max_attempts":4}))
def get_json(s3,key):
    obj=s3.get_object(Bucket=BUCKET,Key=key)
    try:return json.load(obj["Body"])
    finally:obj["Body"].close()
def load_snapshot(s3,tag,typ):
    key=f'migration/do-state/{tag}/{typ}/manifest.json'
    manifest=get_json(s3,key)
    if not(manifest.get('version')==1 and manifest.get('complete') is True and manifest.get('type')==typ and manifest.get('tag')==tag):
        raise RuntimeError('incomplete_source_snapshot_'+tag+'_'+typ)
    pages=manifest['parts']
    total=manifest['exported']
    if pages>5000 or total>640000:raise RuntimeError('unexpectedly_large_source_snapshot')
    entries={}
    def fetch(n):
        item=get_json(s3,f'migration/do-state/{tag}/{typ}/part-{n:07d}.json')
        if item.get('part')!=n or item.get('type')!=typ or item.get('tag')!=tag or item.get('version')!=1:
            raise RuntimeError('bad_source_part_'+tag+'_'+str(n))
        return item['entries']
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for page in pool.map(fetch,range(1,pages+1)):
            for key,value in page:
                if key in entries:raise RuntimeError('duplicate_source_key')
                entries[key]=value
    if len(entries)!=total:raise RuntimeError('source_backup_key_count_mismatch')
    print('SNAPSHOT_READY='+json.dumps({'tag':tag,'type':typ,'parts':pages,'exported':len(entries),'time':manifest.get('completedAt')}),flush=True)
    return entries
def build_manifest(typ,delta):
    return {"version":1,"type":typ,"tag":DELTA_TAG,"complete":True,
        "parts":(len(delta)+PAGE-1)//PAGE,"scanned":len(delta),"exported":len(delta),
        "completedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "provenance":{"base":BASE_TAG,"source":CURRENT_TAG,"baselineKeys":None,"sourceKeys":None,
                      "mode":"sparse-add-or-change","sourceActivePublisher":True}}
def do_work(s3,typ,apply):
    base=load_snapshot(s3,BASE_TAG,typ)
    current=load_snapshot(s3,CURRENT_TAG,typ)
    delta=select_delta(base,current)
    if typ in EXPECTED:
        baseExpected,newExpected,expected=EXPECTED[typ]
        if (len(base),len(current),len(delta))!=(baseExpected,newExpected,expected):
            raise RuntimeError("sparse_delta_unexpected_counts_"+str((len(base),len(current),len(delta))))
    print('SPARSE_DELTA_VERIFIED='+json.dumps({'type':typ,'baselineKeys':len(base),'newerBackupKeys':len(current),
          'onlyChangedOrAdded':len(delta),'parts':(len(delta)+PAGE-1)//PAGE,'removedKeys':0,'apply':apply}),flush=True)
    if not delta:
        print('NO_IMPORT_NEEDED='+typ,flush=True)
        return
    if not apply:return
    prefix=f'migration/do-state/{DELTA_TAG}/{typ}/'
    # Do not re-publish an existing immutable manifest with different cardinality.
    try:
        original=get_json(s3,prefix+'manifest.json')
    except s3.exceptions.NoSuchKey:original=None
    except Exception as e:
        if 'NoSuchKey' in str(e) or '404' in str(e):original=None
        else:raise
    if original and original.get('complete') and original.get('exported')==len(delta):
        print('EXISTING_DELTA_MANIFEST_COMPLETE='+typ,flush=True)
        return
    if original:raise RuntimeError('refuse_overwriting_existing_different_delta_manifest')
    items=sorted(delta.items(),key=lambda pair:pair[0])
    manifest=build_manifest(typ,delta)
    manifest['provenance']['baselineKeys']=len(base)
    manifest['provenance']['sourceKeys']=len(current)
    for offset in range(0,len(items),PAGE):
        n=offset//PAGE+1
        fragment=[[k,v] for k,v in items[offset:offset+PAGE]]
        document=build_part(DELTA_TAG,typ,n,fragment)
        verify_part(document,DELTA_TAG,typ,n)
        body=as_json(document)
        key=prefix+f'part-{n:07d}.json'
        s3.put_object(Bucket=BUCKET,Key=key,Body=body,ContentType="application/json; charset=utf-8")
        if hashlib.sha256(as_json(get_json(s3,key))).digest()!=hashlib.sha256(body).digest():
            raise RuntimeError('R2_roundtrip_checksum_mismatch_part_'+str(n))
        if n%40==0 or n==manifest['parts']:
            print('SPARSE_DELTA_PART_CHECKED='+json.dumps({'type':typ,'part':n,'expected':manifest['parts']}),flush=True)
    # The importer recognizes ONLY a finished manifest; publish it last.
    data=as_json(manifest)
    s3.put_object(Bucket=BUCKET,Key=prefix+'manifest.json',Body=data,ContentType="application/json; charset=utf-8")
    verified=get_json(s3,prefix+'manifest.json')
    if not verified.get('complete') or verified.get('parts')!=manifest['parts'] or verified.get('exported')!=len(delta):
        raise RuntimeError('delta_manifest_postwrite_validation_failed')
    print('SPARSE_DELTA_R2_READY='+json.dumps({'type':typ,'keys':len(delta),'parts':manifest['parts'],'tag':DELTA_TAG}),flush=True)
if __name__=="__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("--apply",action="store_true")
    cli.add_argument("--fixture-test",action="store_true")
    args=cli.parse_args()
    if args.fixture_test:
        before={"a":{"x":1},"b":{"v":[2,3]}}
        newer={"a":{"x":1},"b":{"v":[2,4]},"c":{"created":True}}
        result=select_delta(before,newer)
        assert set(result)=={"b","c"}
        assert len(result)==2
        try:select_delta(before,{"b":{"v":[2,4]}})
        except ValueError:pass
        else:raise AssertionError("missing deletion guard")
        part=build_part("testtag","ControlPlane",1,[["b",result["b"]],["c",result["c"]]])
        verify_part(part,"testtag","ControlPlane",1)
        print('SPARSE_DELTA_UNIT_TESTS_PASS=true')
        sys.exit(0)
    if args.apply and os.environ.get("CONFIRM_SAFE_DELTA")!="YES":
        raise SystemExit("explicit CONFIRM_SAFE_DELTA=YES required for writing")
    s3=s3_client()
    for typ in ("ControlPlane","GeneratorControl"):
        do_work(s3,typ,args.apply)
    print('SPARSE_DELTA_BUILD_FINISHED='+json.dumps({'apply':args.apply,'noDoWrites':True,'noDnsUpdates':True}),flush=True)
