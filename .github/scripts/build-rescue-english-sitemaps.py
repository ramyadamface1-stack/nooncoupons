#!/usr/bin/env python3
"""Index only published, quality-scored English UAE HTML in EXISTING new R2."""
import os,json,datetime,math
from concurrent.futures import ThreadPoolExecutor,as_completed
from botocore.config import Config
import boto3
AID='e4c35f8a50a7b2e4cfb9d6c534962603'
BUCKET='nooncoupons-content-v2'
PREFIX='seo-rescue/'
PART_SIZE=2000
NOW=datetime.datetime.now(datetime.timezone.utc)
s=boto3.client('s3',region_name='auto',endpoint_url=f'https://{AID}.r2.cloudflarestorage.com',
    aws_access_key_id=os.environ['NOON_NEW_R2_ACCESS_KEY_ID'].strip(),
    aws_secret_access_key=os.environ['NOON_NEW_R2_SECRET_ACCESS_KEY'].strip(),
    config=Config(max_pool_connections=32,retries={'max_attempts':4,'mode':'standard'},connect_timeout=10,read_timeout=35))
def read(key):
    o=s.get_object(Bucket=BUCKET,Key=key)
    try:return json.load(o['Body'])
    finally:o['Body'].close()
def published(key):
    obj=s.head_object(Bucket=BUCKET,Key=key)
    m=obj.get('Metadata') or {}
    if m.get('status')!='published':return None,'not_published'
    if m.get('c')!='AE':return None,'market'
    if m.get('lang') not in ('en','en-AE','en_US'):return None,'language'
    try:q=float(m.get('q') or 0);qf=float(m.get('qf') or 0)
    except Exception:return None,'quality_missing'
    if q<95 or qf<88:return None,'quality'
    if obj['ContentLength']<9000:return None,'short_html_candidate'
    date=m.get('at')
    if not date:return None,'missing_original_date'
    try:
        dt=datetime.datetime.fromisoformat(date.replace('Z','+00:00'))
        if dt.tzinfo is None:dt=dt.replace(tzinfo=datetime.timezone.utc)
        if dt>NOW:return None,'future'
        date=dt.date().isoformat()
    except Exception:return None,'invalid_date'
    slug=key[len('articles/'):-len('.html')]
    if not slug.startswith('en-') or '/' in slug or '..' in slug or len(slug)>250:return None,'slug'
    return {'slug':slug,'country':'AE','code':m.get('cp','')[:24],'lastmod':date,'quality':int(q)},None
def main():
    before=read(PREFIX+'index.json')
    assert before.get('version')==1 and before.get('count',0)>100000 and len(before.get('segments') or [])>=50,'Arabic quality sitemap must exist'
    keys=[]
    for page in s.get_paginator('list_objects_v2').paginate(Bucket=BUCKET,Prefix='articles/en-',PaginationConfig={'PageSize':1000}):
        keys.extend(x['Key'] for x in page.get('Contents',[]) if x['Key'].endswith('.html'))
    print('ENGLISH_INDEX_SOURCE_KEYS='+str(len(keys)),flush=True)
    if len(keys)>30000:raise RuntimeError('English source above approved safe cap; abort before HEADs')
    admitted=[]
    rejected={}
    failures=[]
    with ThreadPoolExecutor(max_workers=24) as pool:
        jobs={pool.submit(published,key):key for key in keys}
        for i,job in enumerate(as_completed(jobs),1):
            try:a,reason=job.result()
            except Exception as e:
                failures.append((jobs[job],str(e)[:110]))
                continue
            if a:admitted.append(a)
            else:rejected[reason]=rejected.get(reason,0)+1
            if i%3000==0:print('ENGLISH_METADATA_REVIEWED='+str(i)+'/'+str(len(keys)),flush=True)
    print('ENGLISH_INDEX_ELIGIBLE='+str(len(admitted)),flush=True)
    print('ENGLISH_INDEX_REJECTED='+json.dumps(rejected,sort_keys=True),flush=True)
    print('ENGLISH_INDEX_ERRORS='+str(len(failures)),flush=True)
    if failures:
        print('ENGLISH_FIRST_ERRORS='+json.dumps(failures[:4]),flush=True)
        raise RuntimeError('English head data incomplete; no sitemap publish')
    if len(admitted)<100:raise RuntimeError('too few admitted English pages; review')
    admitted.sort(key=lambda x:x['slug'])
    segments=[]
    for n in range(math.ceil(len(admitted)/PART_SIZE)):
        name=f'{PREFIX}english-{n}.json'
        items=admitted[n*PART_SIZE:(n+1)*PART_SIZE]
        data=json.dumps({'version':1,'articles':items},ensure_ascii=False,separators=(',',':')).encode()
        s.put_object(Bucket=BUCKET,Key=name,Body=data,ContentType='application/json; charset=utf-8',CacheControl='public,max-age=600')
        if s.head_object(Bucket=BUCKET,Key=name)['ContentLength']!=len(data):raise RuntimeError('segment verify failed')
        segments.append({'n':n,'key':name,'count':len(items)})
        print('ENGLISH_SEGMENT_VERIFIED='+str(n)+' COUNT='+str(len(items)),flush=True)
    index=read(PREFIX+'index.json')
    if index.get('count')!=before.get('count') or index.get('segments')!=before.get('segments'):
        raise RuntimeError('Arabic index changed concurrently; do not overwrite')
    index.update({'englishCount':len(admitted),'englishSegments':segments,'englishUpdatedAt':NOW.isoformat()})
    payload=json.dumps(index,ensure_ascii=False,separators=(',',':')).encode()
    s.put_object(Bucket=BUCKET,Key=PREFIX+'index.json',Body=payload,ContentType='application/json; charset=utf-8')
    verify=read(PREFIX+'index.json')
    assert verify.get('englishCount')==len(admitted) and len(verify.get('englishSegments') or [])==len(segments)
    print('ENGLISH_SITEMAP_MANIFEST_COMPLETE=true',flush=True)
    print('ENGLISH_SITEMAP_TOTAL='+str(len(admitted)),flush=True)
    print('ENGLISH_SITEMAP_PARTS='+str(len(segments)),flush=True)
if __name__=='__main__':main()
