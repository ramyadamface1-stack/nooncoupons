"""List all physically saved article HTML in destination R2 (read-only).
Includes historical Arabic and English content outside the recent AI ledger.
Never assumes an article count from stale counters; the R2 object key is proof
of saved content. Does not modify article bodies, names, slugs or timestamps.
"""
import boto3,datetime,json,os,pathlib,re
from botocore.config import Config

ACCOUNT="e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET="nooncoupons-content-v2"
DEST=pathlib.Path(".ndn-blog-staging/full-r2-article-keys.json")
SLUG=re.compile(r"^[a-z0-9-]{1,280}$")

def main():
  access=os.environ.get("AWS_ACCESS_KEY_ID","").strip()
  secret=os.environ.get("AWS_SECRET_ACCESS_KEY","").strip()
  if not access or not secret:raise ValueError("NDN_FULL_ARCHIVE_R2_READ_CREDENTIALS_REQUIRED")
  client=boto3.client("s3",endpoint_url="https://"+ACCOUNT+".r2.cloudflarestorage.com",
    region_name="auto",aws_access_key_id=access,aws_secret_access_key=secret,
    config=Config(connect_timeout=12,read_timeout=40,retries={"max_attempts":3,"mode":"standard"}))
  slugs=set()
  english=0
  continuation=None
  pages=0
  rejected=0
  while True:
    request={"Bucket":BUCKET,"Prefix":"articles/","MaxKeys":1000}
    if continuation:request["ContinuationToken"]=continuation
    result=client.list_objects_v2(**request)
    pages+=1
    for obj in result.get("Contents") or []:
      key=obj.get("Key","")
      if key.startswith("articles/") and key.endswith(".html"):
        slug=key[len("articles/"):-len(".html")]
        if SLUG.fullmatch(slug) and ".." not in slug:
          slugs.add(slug)
        else:
          rejected+=1
    continuation=result.get("NextContinuationToken")
    if pages%40==0:
      print("NDN_R2_ARCHIVE_LIST_PAGE="+str(pages)+";UNIQUE_HTML="+str(len(slugs)),flush=True)
    if not result.get("IsTruncated"):break
    if not continuation:raise ValueError("NDN_ARCHIVE_LIST_TRUNCATED_WITHOUT_TOKEN")
    if pages>1000:raise ValueError("NDN_ARCHIVE_UNEXPECTEDLY_LARGE_LIST")
  ordered=sorted(slugs)
  if len(ordered)<150000:raise ValueError("NDN_ARCHIVE_MISSING_MOST_ORIGINALS_"+str(len(ordered)))
  english=sum(x.startswith("en-") for x in ordered)
  DEST.parent.mkdir(parents=True,exist_ok=True)
  data={"version":1,"listedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "articleSlugs":ordered,"source":"destination-r2-articles-html-only",
    "english":english,"arabic":len(ordered)-english}
  DEST.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf8")
  print("NDN_R2_ALL_SAVED_ARTICLE_HTML="+str(len(ordered))+";ARABIC="+str(len(ordered)-english)+
    ";ENGLISH="+str(english)+";R2_LIST_PAGES="+str(pages)+";UNSAFE_SKIPPED="+str(rejected))
  print("NDN_R2_ORIGINALS_MODIFIED=ZERO;R2_WRITES=ZERO;NO_WORKER_REQUESTS=true")

if __name__=="__main__":main()
