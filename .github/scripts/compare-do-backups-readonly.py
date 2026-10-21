#!/usr/bin/env python3
"""Compare immutable DO snapshots by storage key and canonical value hash. NO WRITES.

Old baseline vs newer source backup copied directly to existing destination R2.
No mutation to source/destination DO or R2. Counts only; never leak stored values.
"""
import os,json,hashlib,concurrent.futures,collections,time
from botocore.config import Config
import boto3
ACCOUNT='e4c35f8a50a7b2e4cfb9d6c534962603'; BUCKET='nooncoupons-content-v2'
TAGS=('20261017-baseline','20261020-old-do-recovery')
s3=boto3.client('s3',endpoint_url=f'https://{ACCOUNT}.r2.cloudflarestorage.com',region_name='auto',
    aws_access_key_id=os.environ['NOON_NEW_R2_ACCESS_KEY_ID'].strip(),
    aws_secret_access_key=os.environ['NOON_NEW_R2_SECRET_ACCESS_KEY'].strip(),
    config=Config(max_pool_connections=22,connect_timeout=10,read_timeout=35,retries={'max_attempts':4,'mode':'standard'}))
def read(key):
    resp=s3.get_object(Bucket=BUCKET,Key=key)
    try:return json.load(resp['Body'])
    finally:resp['Body'].close()
def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).digest()
def fetch_part(tag,n):
    key=f'migration/do-state/{tag}/ControlPlane/part-{n:07d}.json'
    v=read(key)
    if v.get('part')!=n or v.get('tag')!=tag or v.get('type')!='ControlPlane':
        raise RuntimeError('invalid immutable DO archive part '+str(n))
    return n,v.get('entries') or []
def snapshot(tag):
    m=read(f'migration/do-state/{tag}/ControlPlane/manifest.json')
    if m.get('complete') is not True or m.get('type')!='ControlPlane' or not m.get('parts'):
        raise RuntimeError('missing source snapshot completion marker for '+tag)
    expected=m['exported'];parts=m['parts'];rows={};num=0
    started=time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as pool:
        for n,entries in pool.map(lambda n:fetch_part(tag,n),range(1,parts+1)):
            for key,value in entries:
                if key in rows:raise RuntimeError('duplicate source DO key '+tag+' '+str(n))
                rows[key]=digest(value)
                num+=1
            if n%500==0:
                print('DO_SNAPSHOT_SCAN='+json.dumps({'tag':tag,'partsRead':n,'expectedParts':parts,'keys':num,'elapsedSeconds':round(time.monotonic()-started,1)}),flush=True)
    if num!=expected or len(rows)!=expected:raise RuntimeError('snapshot count mismatch tag='+tag)
    print('DO_SNAPSHOT_COMPLETE='+json.dumps({'tag':tag,'keys':num,'parts':parts,'snapshotAt':m.get('completedAt'),'elapsedSeconds':round(time.monotonic()-started,1)}),flush=True)
    return rows
a=snapshot(TAGS[0]);b=snapshot(TAGS[1])
keys_old=set(a);keys_new=set(b)
added=keys_new-keys_old;removed=keys_old-keys_new
shared=keys_old&keys_new
changed=[key for key in shared if a[key]!=b[key]]
same=len(shared)-len(changed)
def groups(keys):
    out=collections.Counter()
    for k in keys:
        val=k.split(':',1)[0].split('/',1)[0]
        out[val[:30]]+=1
    return out.most_common(15)
out={'baselineKeys':len(a),'latestBackupKeys':len(b),'unchangedKeys':same,'addedKeys':len(added),
    'changedKeys':len(changed),'absentFromNewSnapshot':len(removed),
    'changedPlusAdded':len(changed)+len(added),'isLatestSnapshotLive':False,
    'newBackupNotAfterOct21Published':True,
    'addedKeyKinds':groups(added),'changedKeyKinds':groups(changed),'removedKeyKinds':groups(removed),
    'noKeysOrValuesExposed':True,'r2OrDoWrites':0}
print('DO_BACKUP_DIFF_READONLY='+json.dumps(out),flush=True)
