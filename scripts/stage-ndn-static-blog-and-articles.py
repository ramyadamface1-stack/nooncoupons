"""Read published snapshots from destination R2; read only, no article changes.
Public R2 original HTML is copied byte-for-byte only if canonical + market
guards pass. This emergency *partial* static snapshot keeps the latest
article pages reachable after Workers Free 1027. Older pages stay dynamic.
"""
import boto3
from botocore.config import Config
import datetime,json,os,pathlib,re,sys

ACCOUNT="e4c35f8a50a7b2e4cfb9d6c534962603"
BUCKET="nooncoupons-content-v2"
STAGE=pathlib.Path(".ndn-blog-staging/native-article-fragments")
DEST=pathlib.Path(".ndn-blog-staging/public-snapshot.json")
LEDGER="_ops/ai-v2-publication-ledger-v1.json"
COMPACT="bulk/public-compact-v1.json"
JOURNAL="blog/latest-live-v1.json"
SLUG=re.compile(r"^[a-z0-9-]{16,120}$")
def fail(message): raise ValueError("NDN_STATIC_BLOG_"+message)
def main():
  access=os.environ.get("AWS_ACCESS_KEY_ID","").strip()
  secret=os.environ.get("AWS_SECRET_ACCESS_KEY","").strip()
  if not access or not secret: fail("R2_CREDENTIALS_REQUIRED")
  client=boto3.client("s3",region_name="auto",
    endpoint_url="https://"+ACCOUNT+".r2.cloudflarestorage.com",
    aws_access_key_id=access,aws_secret_access_key=secret,
    config=Config(connect_timeout=12,read_timeout=35,retries={"max_attempts":2,"mode":"standard"}))
  def read(key,optional=False):
    from botocore.exceptions import ClientError
    try:
      body=client.get_object(Bucket=BUCKET,Key=key)["Body"].read(12_000_001)
      if len(body)>12_000_000:fail("OVERSIZE_R2_"+key)
      return json.loads(body)
    except ClientError as e:
      if optional and str(e.response.get("Error",{}).get("Code","")) in ("404","NotFound","NoSuchKey"):return None
      raise
  ledger=read(LEDGER)
  compact=read(COMPACT)
  journal=read(JOURNAL,optional=True)
  if ledger.get("version")!=1 or not isinstance(ledger.get("articles"),list) or not ledger["articles"]:fail("INVALID_OR_EMPTY_LEDGER")
  if compact.get("version")!=1 or not isinstance(compact.get("articles"),list):fail("INVALID_COMPACT")
  native=[x for x in ledger["articles"] if isinstance(x,dict) and x.get("country") in ("SA","AE")
    and SLUG.fullmatch(str(x.get("slug",""))) and x.get("publishedAt")]
  if len(native)<30:fail("INSUFFICIENT_REAL_PUBLISHED_ARTICLES")
  native.sort(key=lambda x:x["publishedAt"],reverse=True)
  # Build compact 2-market cover; only real, already-published article objects.
  target=[];market_counts={"SA":0,"AE":0}
  for row in native:
    market=row["country"]
    if market_counts[market]>=75:continue
    target.append(row)
    market_counts[market]+=1
    if all(n>=75 for n in market_counts.values()):break
  metadata={};copied=[];missing=[];denied=[]
  STAGE.mkdir(parents=True,exist_ok=True)
  for row in target:
    slug=row["slug"];country=row["country"];key="articles/"+slug+".html"
    try:
      obj=client.get_object(Bucket=BUCKET,Key=key)
      raw=obj["Body"].read(2_000_001)
      if len(raw)>2_000_000:denied.append(slug+":oversize");continue
      html=raw.decode("utf-8",errors="strict")
      meta=obj.get("Metadata") or {}
      if (meta.get("p")!="ai-v2-native" or meta.get("status")!="published" or
          (country=="SA" and meta.get("c")!="SA") or
          (country=="AE" and meta.get("c")!="AE") or
          "<article" not in html.lower() or "<h1" not in html.lower() or
          ("NOV170" not in html if country=="SA" else "NOV188" not in html)):
        denied.append(slug+":native_or_market");continue
      (STAGE/(slug+".html")).write_bytes(raw)
      metadata[key]=obj.get("Metadata") or {}
      copied.append(slug)
    except Exception as err:
      missing.append(slug)
  if len(copied)<24:fail("TOO_FEW_NATIVE_FRAGMENTS_"+str(len(copied)))
  if min(sum(1 for x in target if x["country"]==c and x["slug"] in copied) for c in ("SA","AE"))<12:
    fail("MARKET_STATIC_COVERAGE_TOO_LOW")
  DEST.parent.mkdir(parents=True,exist_ok=True)
  snapshot={"version":1,"createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "objects":{LEDGER:ledger,COMPACT:compact},"heads":metadata,
    "journal":journal,"cachedArticleSlugs":copied}
  DEST.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
  print("NDN_R2_PUBLISHED_LEDGER="+str(len(native))+";COMPACT="+str(len(compact["articles"])))
  print("NDN_REAL_STATIC_ARTICLE_HTML="+str(len(copied))+";MISSING="+str(len(missing))+
        ";REJECTED="+str(len(denied))+";MARKET_REQUESTED="+str(market_counts))
  print("NDN_R2_PUBLIC_SNAPSHOT_READ_ONLY=TRUE;ARTICLE_R2_MUTATIONS=ZERO;AI_GENERATION=ZERO")
if __name__=="__main__":sys.exit(main())
