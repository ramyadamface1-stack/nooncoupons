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
def valid_public_slug(slug):
  return isinstance(slug,str) and 1<=len(slug)<=280 and bool(re.fullmatch(r'[\w\-]+',slug,re.UNICODE)) and '..' not in slug
def fail(message): raise ValueError("NDN_STATIC_BLOG_"+message)
def main():
  access=os.environ.get("AWS_ACCESS_KEY_ID","").strip()
  secret=os.environ.get("AWS_SECRET_ACCESS_KEY","").strip()
  if not access or not secret: fail("R2_CREDENTIALS_REQUIRED")
  client=boto3.client("s3",region_name="auto",
    endpoint_url="https://"+ACCOUNT+".r2.cloudflarestorage.com",
    aws_access_key_id=access,aws_secret_access_key=secret,
    config=Config(connect_timeout=12,read_timeout=35,max_pool_connections=36,retries={"max_attempts":2,"mode":"standard"}))
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
  # The four native article URLs are used by the live production smoke.
  # Include them as real, verified R2 fragments even if newer publications
  # push them outside the 75-per-market latest-window.
  priority_slugs=["saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6","uae-buyer-baseus-powerbank-multiport-power-budget-sharing-nov188-2026-n6","saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov170-2026-n10","uae-buyer-xiaomi-phone-nfc-wallet-regional-compatibility-nov188-2026-n10"]
  native_by_slug={row["slug"]:row for row in native}
  requested={row["slug"] for row in target}
  for slug in priority_slugs:
    row=native_by_slug.get(slug)
    if row is None:fail("PRIORITY_R2_NATIVE_ARTICLE_MISSING_FROM_LEDGER_"+slug)
    if slug not in requested:
      target.append(row)
      requested.add(slug)
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
  for slug in priority_slugs:
    if slug not in copied:fail("PRIORITY_R2_NATIVE_ARTICLE_INVALID_"+slug)
  if len(copied)<24:fail("TOO_FEW_NATIVE_FRAGMENTS_"+str(len(copied)))
  if min(sum(1 for x in target if x["country"]==c and x["slug"] in copied) for c in ("SA","AE"))<12:
    fail("MARKET_STATIC_COVERAGE_TOO_LOW")

  # Verify EVERY canonical published URL exists and collect original native
  # title/description metadata, not guesses derived from slugs.
  from concurrent.futures import ThreadPoolExecutor,as_completed
  rows={x["slug"]:x for x in native}
  for x in compact["articles"]:
    if not isinstance(x,dict) or not valid_public_slug(x.get("slug")) or x.get("country") not in ("SA","AE"):continue
    if x.get("status") in ("draft","scheduled") or x.get("indexable") is False:continue
    rows.setdefault(x["slug"],x)
  known=set(copied)
  missing_all=[]
  failed_head=[]
  native_ids={r["slug"] for r in native}
  def verify_row(item):
    slug,row=item
    key="articles/"+slug+".html"
    try:
      obj=client.head_object(Bucket=BUCKET,Key=key)
      meta=obj.get("Metadata") or {}
      if slug in native_ids and (meta.get("p")!="ai-v2-native" or meta.get("status")!="published" or meta.get("c")!=row["country"]):
        return slug,None,"not_approved_native"
      return slug,meta,None
    except Exception as err:
      return slug,None,str(type(err).__name__)
  # boto3 S3 client is thread-safe; head_object is read only. No list/put/delete.
  stage_tasks=[(slug,row) for slug,row in rows.items() if slug not in known]
  with ThreadPoolExecutor(max_workers=24) as pool:
    for fut in as_completed(pool.submit(verify_row,item) for item in stage_tasks):
      slug,meta,err=fut.result()
      if err:
        failed_head.append((slug,err))
      else:
        metadata["articles/"+slug+".html"]=meta
        known.add(slug)
  if len(known)<int(len(rows)*0.97):
    fail("R2_ARTICLE_HEAD_INTEGRITY_"+str(len(known))+"_OF_"+str(len(rows)))
  # Public catalog contains only objects proven present; R2 metadata is retained
  # unmodified and all older source rows remain in R2.
  verified=sorted(known)
  public_native=[x for x in ledger["articles"] if x.get("slug") in known]
  public_compact=[x for x in compact["articles"] if x.get("slug") in known and
    x.get("status") not in ("draft","scheduled") and x.get("indexable") is not False]
  source_rows=len(rows)
  print("NDN_FULL_PUBLISHED_R2_HEAD_CHECK="+str(len(known))+"/"+str(source_rows)+
    ";MISSING="+str(len(failed_head))+";SA="+str(sum(rows[s]["country"]=="SA" for s in known))+
    ";AE="+str(sum(rows[s]["country"]=="AE" for s in known)))
  if failed_head:
    print("NDN_UNAVAILABLE_PUBLISHED_SAMPLE="+repr(failed_head[:12]))

  DEST.parent.mkdir(parents=True,exist_ok=True)
  snapshot={"version":1,"createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "objects":{LEDGER:{**ledger,"articles":public_native},COMPACT:{**compact,"articles":public_compact}},"heads":metadata,
    "journal":journal,"cachedArticleSlugs":copied,"verifiedArticleSlugs":verified,
    "sourcePublishedCount":source_rows,"verifiedPublishedCount":len(verified)}
  DEST.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
  print("NDN_R2_PUBLISHED_LEDGER="+str(len(native))+";COMPACT="+str(len(compact["articles"])))
  print("NDN_REAL_STATIC_ARTICLE_HTML="+str(len(copied))+";MISSING="+str(len(missing))+
        ";REJECTED="+str(len(denied))+";MARKET_REQUESTED="+str(market_counts))
  print("NDN_R2_PUBLIC_SNAPSHOT_READ_ONLY=TRUE;ARTICLE_R2_MUTATIONS=ZERO;AI_GENERATION=ZERO")
if __name__=="__main__":sys.exit(main())
