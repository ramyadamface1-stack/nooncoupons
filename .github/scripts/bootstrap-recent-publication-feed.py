#!/usr/bin/env python3
"""One-time bootstrap of EXISTING new-account R2 blog publication feed.

Read only all published article *names and metadata* from same pre-existing R2
bucket. One conditional, atomic CREATE ONLY for a missing feed key. Never
rewrites article HTML or an existing concurrent publisher feed.
"""
import os, json, heapq, datetime, urllib.parse, html, sys
from concurrent.futures import ThreadPoolExecutor,as_completed
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

AID="e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET="nooncoupons-content-v2"
KEY="blog/latest-live-v1.json"
NOW=datetime.datetime.now(datetime.timezone.utc)
HORIZON=NOW-datetime.timedelta(days=7)
MAX_PAGES=400
MAX_HEAD=420
MAX_FEED=300
MIN_FEED=12
s=boto3.client('s3',region_name='auto',endpoint_url=f'https://{AID}.r2.cloudflarestorage.com',
    aws_access_key_id=os.environ['NOON_NEW_R2_ACCESS_KEY_ID'].strip(),
    aws_secret_access_key=os.environ['NOON_NEW_R2_SECRET_ACCESS_KEY'].strip(),
    config=Config(max_pool_connections=18,connect_timeout=10,read_timeout=30,retries={'mode':'standard','max_attempts':3}))
try:
    x=s.head_object(Bucket=BUCKET,Key=KEY)
    print("FEED_BOOTSTRAP=ALREADY_EXISTS; preservable publisher state; no write",flush=True)
    print("EXISTING_FEED_BYTES="+str(x['ContentLength']),flush=True)
    sys.exit(0)
except ClientError as e:
    if e.response.get('Error',{}).get('Code') not in ('404','NoSuchKey','NotFound'):raise

recent=[]
page_count=0
total=0
for page in s.get_paginator('list_objects_v2').paginate(Bucket=BUCKET,Prefix='articles/',PaginationConfig={'PageSize':1000}):
    page_count+=1
    if page_count>MAX_PAGES:raise RuntimeError('listing_budget_exceeded_no_write')
    for o in page.get('Contents',[]):
        total+=1
        if o['Key'].endswith('.html') and o['LastModified']>=HORIZON:
            recent.append((o['LastModified'],o['Key']))
print("FEED_BOOTSTRAP_ARTICLE_OBJECTS_SCANNED="+str(total),flush=True)
print("FEED_BOOTSTRAP_R2_LIST_PAGES="+str(page_count),flush=True)
recent=heapq.nlargest(MAX_HEAD,recent,key=lambda x:x[0])
print("FEED_BOOTSTRAP_RECENT_CANDIDATES="+str(len(recent)),flush=True)
if len(recent)<MIN_FEED:raise RuntimeError('unexpectedly_few_recent_candidates; no_write')

def inspect(entry):
    date,key=entry
    slug=key[len('articles/'):-len('.html')]
    if not slug or len(slug)>280 or '/' in slug or '..' in slug or slug.startswith('en-'):return None,'slug'
    obj=s.head_object(Bucket=BUCKET,Key=key)
    m=obj.get('Metadata') or {}
    if m.get('status')!='published':return None,'not_published'
    country=m.get('c') or m.get('country')
    if country not in ('SA','AE'):return None,'country'
    try:
        quality=float(m['q'])
        if quality<95:return None,'quality'
        if m.get('qf') and float(m['qf'])<88:return None,'floor'
        if m.get('w') and int(m['w'])<1500:return None,'words'
    except (KeyError,TypeError,ValueError):return None,'quality_missing'
    rawtime=m.get('at') or m.get('publishedAt')
    if rawtime:
        try:
            when=datetime.datetime.fromisoformat(rawtime.replace('Z','+00:00'))
            if when.tzinfo is None:when=when.replace(tzinfo=datetime.timezone.utc)
        except Exception:return None,'invalid_date'
        if when>NOW+datetime.timedelta(minutes=5):return None,'future'
    else:when=date
    # A freshly updated object can be an older article; respect source publish timestamp.
    if when<NOW-datetime.timedelta(days=90):return None,'stale_article'
    decode=lambda v:html.unescape(urllib.parse.unquote(str(v or '')))
    title=decode(m.get('t') or m.get('title') or slug.replace('-',' '))[:180]
    description=decode(m.get('m') or m.get('metaDescription') or '')[:170]
    code=str(m.get('cp') or m.get('coupon') or '')[:30]
    return {'slug':slug,'country':country,'status':'published',
        'createdAt':when.isoformat().replace('+00:00','Z'),
        'publishedAt':when.isoformat().replace('+00:00','Z'),
        'title':title,'metaDescription':description,'coupon':code,
        'quality':quality,'wordCount':int(m.get('w') or 0) or None},None

admitted=[]
rejected={}
failures=[]
with ThreadPoolExecutor(max_workers=14) as pool:
    futs={pool.submit(inspect,x):x for x in recent}
    for f in as_completed(futs):
        try:item,reason=f.result()
        except Exception as e:
            failures.append((str(futs[f][1])[:70],type(e).__name__))
            continue
        if item:admitted.append(item)
        else:rejected[reason]=rejected.get(reason,0)+1
print('FEED_BOOTSTRAP_ADMITTED='+str(len(admitted)),flush=True)
print('FEED_BOOTSTRAP_REJECTED='+json.dumps(rejected,ensure_ascii=False),flush=True)
print('FEED_BOOTSTRAP_METADATA_ERRORS='+str(len(failures)),flush=True)
if failures:raise RuntimeError('metadata_read_error_no_write')
if len(admitted)<MIN_FEED:raise RuntimeError('too_few_independently_quality_approved_articles_no_write')
admitted.sort(key=lambda a:a['publishedAt'],reverse=True)
seen=set();dedup=[]
for a in admitted:
    if a['slug'] in seen:continue
    seen.add(a['slug']);dedup.append(a)
rows=dedup[:MAX_FEED]
payload=json.dumps({'version':1,'updatedAt':NOW.isoformat().replace('+00:00','Z'),
    'articles':rows},ensure_ascii=False,separators=(',',':')).encode('utf8')
if len(payload)>250000:raise RuntimeError('feed_size_budget_exceeded_no_write')
# If a live Worker wrote the feed concurrently, fail-safe skip, do not overwrite!
try:
    s.put_object(Bucket=BUCKET,Key=KEY,Body=payload,IfNoneMatch='*',ContentType='application/json; charset=utf-8',CacheControl='public,max-age=30')
except ClientError as e:
    if e.response.get('ResponseMetadata',{}).get('HTTPStatusCode')==412:
        print('FEED_BOOTSTRAP=CONCURRENT_PUBLISHER_FEED_EXISTS; no overwrite',flush=True)
        sys.exit(0)
    raise
result=s.get_object(Bucket=BUCKET,Key=KEY)
stored=json.load(result['Body'])
if stored.get('version')!=1 or len(stored.get('articles') or [])!=len(rows):
    raise RuntimeError('feed_verify_failed')
print('FEED_BOOTSTRAP_CREATED=true',flush=True)
print('FEED_BOOTSTRAP_ARTICLES='+str(len(rows)),flush=True)
print('FEED_BOOTSTRAP_FIRST_5='+json.dumps([{'slug':r['slug'][:110],'country':r['country'],'time':r['publishedAt']} for r in rows[:5]],ensure_ascii=False),flush=True)
print('FEED_BOOTSTRAP_NO_EXISTING_ARTICLE_MODIFICATIONS=true',flush=True)
