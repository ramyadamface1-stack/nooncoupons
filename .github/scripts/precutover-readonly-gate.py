#!/usr/bin/env python3
"""Read-only fail-closed cutover gate for preexisting NoonDealsNow Cloudflare resources.

Never modifies R2, Durable Objects, GitHub, Cloudflare zones or Worker deployments.
All major blockers must be independently confirmed before NS change; this tool
cannot authorize cutover itself, even if the read-only subset passes.
"""
import os, json, urllib.request, urllib.error, sys, datetime
import boto3
from botocore.config import Config

OLD_ACCOUNT = "c82274152a942dea53044eae7153cfd7"
NEW_ACCOUNT = "e4c35f8a50a7b2e4cfb9d6c534962603"
OLD_ZONE = "3032a311856f82908a53f0b19b0ffcf8"
NEW_ZONE = "c09077a581adc7aa11d6de0c121e179d"
BUCKET = "nooncoupons-content-v2"
SOURCE_BASELINE_PARTS = 2759
SOURCE_BASELINE_KEYS = 353109
BOT_MIN_AR = 169082
BOT_MIN_EN = 21269
TAG = "20261017-baseline"
NEW_STAGE_NAME = "noondealsnow-migration-staging"
RESULTS = []

def gate(name, value, detail=None, required=True):
    row = {"name":name,"pass":bool(value),"required":required,"detail":detail}
    RESULTS.append(row)
    print("PRECUTOVER_GATE=" + json.dumps(row, ensure_ascii=False, separators=(",",":")),flush=True)

def cloudflare(token, path):
    request = urllib.request.Request("https://api.cloudflare.com/client/v4"+path,
        headers={"Authorization":"Bearer "+str(token or "").strip(),"Accept":"application/json"})
    try:
        with urllib.request.urlopen(request,timeout=18) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        try:payload=json.loads(error.read(5000))
        except Exception:payload={}
        return error.code,payload

def r2client():
    return boto3.client('s3',region_name='auto',endpoint_url=
        f'https://{NEW_ACCOUNT}.r2.cloudflarestorage.com',
        aws_access_key_id=os.environ["NOON_NEW_R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["NOON_NEW_R2_SECRET_ACCESS_KEY"].strip(),
        config=Config(connect_timeout=10,read_timeout=25,retries={"mode":"standard","max_attempts":2}))

def read_json(client,key):
    o=client.get_object(Bucket=BUCKET,Key=key)
    try:return json.load(o['Body'])
    finally:o['Body'].close()

def inspect():
    client=r2client()
    for typ,parts,total in (("ControlPlane",SOURCE_BASELINE_PARTS,SOURCE_BASELINE_KEYS),
                            ("GeneratorControl",1,4)):
        source=read_json(client,f"migration/do-state/{TAG}/{typ}/manifest.json")
        import_state=read_json(client,f"migration/restore-progress/{TAG}/{typ}.json")
        exported=source.get("complete") is True and source.get("parts")==parts and source.get("exported")==total
        restored=import_state.get("complete") is True and import_state.get("partsDone")==parts and \
          import_state.get("partsTotal")==parts and import_state.get("keysRestored")==total and \
          import_state.get("keysTotal")==total
        gate(f"{typ}_archive_complete",exported,{"parts":source.get("parts"),"keys":source.get("exported")})
        gate(f"{typ}_restore_complete",restored,
          {"done":import_state.get("partsDone"),"total":import_state.get("partsTotal"),
           "keys":import_state.get("keysRestored"),"expected":total,"at":import_state.get("updatedAt")})
    seo=read_json(client,"seo-rescue/index.json")
    ar_parts=seo.get("segments") or []
    en_parts=seo.get("englishSegments") or []
    curated = seo.get("count",0)>=BOT_MIN_AR and seo.get("englishCount",0)>=BOT_MIN_EN and \
      seo.get("count")==sum(x.get("count",0) for x in ar_parts) and \
      seo.get("englishCount")==sum(x.get("count",0) for x in en_parts)
    gate("quality_sitemap_manifests",curated,{"arabic":seo.get("count"),"english":seo.get("englishCount"),"shards":len(ar_parts)+len(en_parts)})
    names={}
    allrecords={}
    for side,token,zone in (("old",os.environ["NOON_OLD_CF_API_TOKEN"],OLD_ZONE),
                            ("new",os.environ["NOON_NEW_CF_API_TOKEN"],NEW_ZONE)):
        status,z=cloudflare(token,f"/zones/{zone}")
        zoneinfo=z.get("result") or {}
        valid=status==200 and z.get("success") is True and zoneinfo.get("name")=="noondealsnow.com"
        gate(side+"_zone_readable",valid,{"status":zoneinfo.get("status"),"nameservers":zoneinfo.get("name_servers")})
        names[side]=zoneinfo.get("status")
        status,rr=cloudflare(token,f"/zones/{zone}/dns_records?per_page=100")
        if rr.get("success") is True and isinstance(rr.get("result"),list):
            allrecords[side]=sorted((x.get("name"),x.get("type"),x.get("content"),x.get("proxied"),x.get("priority"))
                                    for x in rr["result"])
            gate(side+"_dns_readable",status==200,{"count":len(rr["result"])})
        else:gate(side+"_dns_readable",False,{"http":status})
        status,packs=cloudflare(token,f"/zones/{zone}/ssl/certificate_packs?per_page=30")
        certs = packs.get("result") if isinstance(packs.get("result"),list) else []
        active=[p for p in certs if p.get("status")=="active" and "noondealsnow.com" in (p.get("hosts") or [])]
        gate(side+"_apex_certificate_active",status==200 and bool(active),
             {"active_apex_packs":len(active),"total":len(certs)})
        status,dom=cloudflare(token,"/accounts/"+(OLD_ACCOUNT if side=="old" else NEW_ACCOUNT)+"/workers/domains")
        worker_domains=(dom.get("result") if isinstance(dom.get("result"),list) else []) or []
        matches=[d for d in worker_domains if d.get("hostname")=="noondealsnow.com" and d.get("zone_id")==zone]
        gate(side+"_apex_worker_binding",status==200 and bool(matches),
             {"matches":[{"service":x.get("service"),"environment":x.get("environment")} for x in matches]})
    gate("old_zone_remains_active",names.get("old")=="active",{"status":names.get("old")})
    gate("dns_strict_parity",allrecords.get("old")==allrecords.get("new") and bool(allrecords.get("old")),
         {"old_count":len(allrecords.get("old",[])),"new_count":len(allrecords.get("new",[]))})
    token=os.environ["NOON_NEW_CF_API_TOKEN"]
    status,setting=cloudflare(token,f"/accounts/{NEW_ACCOUNT}/workers/scripts/{NEW_STAGE_NAME}/settings")
    bindings=(setting.get("result") or {}).get("bindings") or []
    binding_names={x.get("name") for x in bindings}
    gate("restore_only_worker_bindings",status==200 and {"CONTENT_FINAL","CONTROL","GENERATOR_CONTROL"}.issubset(binding_names),
         {"has_r2":"CONTENT_FINAL" in binding_names,"has_control":"CONTROL" in binding_names,"has_generator":"GENERATOR_CONTROL" in binding_names})
    # Even with every read-only check green, do NOT authorize cutover automatically.
    # Source R2 is NotEntitled so last article delta and mutable source indexes
    # CANNOT be proven copied, and old publishing must be independently disabled.
    gate("final_source_r2_delta_verified",False,
         "Source old account R2 disabled (10042); cannot independently verify latest objects/metadata")
    gate("final_do_state_delta_verified",False,
         "The October 17 baseline does not include all October 19 source DO changes")
    gate("single_publisher_cutover_verification",False,
         "Need transactionally proven source stop, destination start and <=1 article/min")
    gate("certificate_activation_without_downtime",False,
         "Pending destination zone must safely activate certificate/custom-domain before switch; no NS changes authorized")
    failures=[r["name"] for r in RESULTS if r["required"] and not r["pass"]]
    print("PRECUTOVER_READ_ONLY_SUMMARY="+json.dumps({"ready":not failures,"failed_gates":failures,
           "checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "cutover_performed":False,"mutations_performed":False},separators=(",",":")),flush=True)
    if failures:sys.exit(2)

if __name__=="__main__":
    try:inspect()
    except Exception as error:
        print("PRECUTOVER_INSPECTION_ERROR="+json.dumps({"type":type(error).__name__,"message":str(error)[:160]}),flush=True)
        sys.exit(3)
