#!/usr/bin/env python3
"""READ ONLY: compare all key-value snapshots already stored in existing NEW R2.

Safe report: counts and key-name prefix aggregates only. Never print DO values,
write to Durable Objects, change source accounts, overwrite R2 or cut over DNS.
"""
import os,json,hashlib,collections,concurrent.futures,time,datetime,sys
import boto3
from botocore.config import Config
ACCOUNT='e4c35f8a50a7b2e4cfb9d6c534962603'
BUCKET='nooncoupons-content-v2'
TAGS=['20261017-baseline','20261020-old-do-recovery']
TYPES=['ControlPlane','GeneratorControl']
client=boto3.client('s3',region_name='auto',
  endpoint_url=f'https://{ACCOUNT}.r2.cloudflarestorage.com',
  aws_access_key_id=os.environ['NEW_KEY'].strip(),
  aws_secret_access_key=os.environ['NEW_SECRET'].strip(),
  config=Config(max_pool_connections=32,retries={'max_attempts':3,'mode':'standard'},read_timeout=32,connect_timeout=10))

def load(k):
    obj=client.get_object(Bucket=BUCKET,Key=k)
    data=obj['Body'].read()
    obj['Body'].close()
    return json.loads(data)

def load_part(args):
    typ,tag,n=args
    path=f'migration/do-state/{tag}/{typ}/part-{n:07d}.json'
    obj=load(path)
    if obj.get('version')!=1 or obj.get('part')!=n or obj.get('tag')!=tag or obj.get('type')!=typ or not isinstance(obj.get('entries'),list):
        raise ValueError('invalid_backup_part_'+tag+'_'+typ+'_'+str(n))
    entries=obj['entries']
    if len(entries)>128:raise ValueError('unexpected_extra_entries')
    return tag,typ,n,entries

def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')).hexdigest()

def group(key):
    # Never output full keys, slugs, user data or values.
    head=key.split(':',1)[0].split('/',1)[0].split('_',1)[0]
    return head[:18] if head and head[0].isascii() else '(other)'

def main():
    for typ in TYPES:
        manifests={}
        for tag in TAGS:
            key=f'migration/do-state/{tag}/{typ}/manifest.json'
            manifest=load(key)
            if manifest.get('complete') is not True or manifest.get('type')!=typ or manifest.get('tag')!=tag:raise ValueError('source_backup_incomplete')
            manifests[tag]=manifest
            print('DIFF_ARCHIVE='+json.dumps({'type':typ,'tag':tag,'parts':manifest.get('parts'),'exported':manifest.get('exported'),'finishedAt':manifest.get('completedAt')}),flush=True)
        tasks=[(typ,tag,i) for tag in TAGS for i in range(1,manifests[tag]['parts']+1)]
        records={tag:{} for tag in TAGS}
        parts={tag:0 for tag in TAGS}
        start=time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=18) as pool:
            futures=[pool.submit(load_part,a) for a in tasks]
            for future in concurrent.futures.as_completed(futures):
                tag,kind,n,pairs=future.result()
                parts[tag]+=1
                for key,value in pairs:
                    if not isinstance(key,str):raise ValueError('bad backup key')
                    if key in records[tag]:raise ValueError('duplicate DO key '+tag)
                    records[tag][key]=digest(value)
                if sum(parts.values())%700==0:
                    print('DIFF_PROGRESS='+json.dumps({'type':typ,'parts_read':sum(parts.values()),'total':len(tasks),'duration_sec':round(time.time()-start,1)}),flush=True)
        left,right=(records[tag] for tag in TAGS)
        L,R=set(left),set(right)
        changed={k for k in L&R if left[k]!=right[k]}
        added=R-L
        missing=L-R
        stats=lambda keys:dict(collections.Counter(group(k) for k in keys).most_common(20))
        report={
          'type':typ,
          'baseCount':len(L),'freshCount':len(R),
          'sourceManifestBaseCount':manifests[TAGS[0]]['exported'],
          'sourceManifestFreshCount':manifests[TAGS[1]]['exported'],
          'unchangedCount':len(L&R)-len(changed),
          'addedCount':len(added),'changedCount':len(changed),'missingOldKeysCount':len(missing),
          'totalDeltaWritesIfApplied':len(added)+len(changed),
          'addedPrefixes':stats(added),'changedPrefixes':stats(changed),'missingPrefixes':stats(missing),
          'snapshotStillNotLatest':True,
          'baselineRestoreRequiresIndependentVerification':True,
          'not_applied':True
        }
        print('DO_SNAPSHOT_DIFF='+json.dumps(report,sort_keys=True),flush=True)
        if len(L)!=manifests[TAGS[0]]['exported'] or len(R)!=manifests[TAGS[1]]['exported']:raise ValueError('manifest count mismatch')
        if len(added)+len(changed)>100000:
            print('DO_DELTA_FREE_QUOTA_EXCEEDED_IF_SINGLE_DAY=true',flush=True)
        else:print('DO_DELTA_FITS_ONE_FREE_ROW_WRITE_DAY_ESTIMATE=true',flush=True)
    print('READ_ONLY_DIFF_FINISHED=true',flush=True)

if __name__=='__main__':
    main()
