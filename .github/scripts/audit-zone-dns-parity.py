#!/usr/bin/env python3
"""Read-only source/new Cloudflare zone and DNS parity audit.

Uses existing GitHub Secrets but never reveals token values or DNS record
contents. Never changes a zone, name server, route, DNS record, or Worker.
"""
import collections
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error

DOMAIN="noondealsnow.com"
OLD_ACCOUNT="c82274152a942dea53044eae7153cfd7"
NEW_ACCOUNT="e4c35f8a50a7b2e4cfb9d6c534962603"
BASE="https://api.cloudflare.com/client/v4/"

def request(token,path):
    req=urllib.request.Request(BASE+path,headers={"Authorization":"Bearer "+token,"Accept":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            result=json.load(r)
    except urllib.error.HTTPError as exc:
        return None, exc.code
    except (OSError, ValueError):
        return None, 0
    return result if result.get("success") is True else None, 200

def zone(token, account):
    params=urllib.parse.urlencode({"name":DOMAIN,"account.id":account})
    data,http=request(token,"zones?"+params)
    zones=data.get("result",[]) if data else []
    match=next((z for z in zones if z.get("account",{}).get("id")==account and z.get("name")==DOMAIN),None)
    return match,http

def records(token,zone_id):
    all_records=[]
    page=1
    while page<=10:
        data,http=request(token,"zones/"+urllib.parse.quote(zone_id,safe="")+"/dns_records?per_page=500&page="+str(page))
        if not data:
            return None,http
        all_records.extend(data.get("result",[]))
        info=data.get("result_info",{})
        if page>=int(info.get("total_pages") or 1):
            return all_records,200
        page+=1
    return None,413

def normalize(record):
    t=record.get("type","")
    name=str(record.get("name","")).rstrip(".").lower()
    val=str(record.get("content","")).strip().rstrip(".")
    if t in ("CNAME","MX","NS","SRV"):
        val=val.lower()
    # Only record identity, not provider-specific proxy metadata or TTL.
    return (t,name,val,int(record.get("priority") or 0))

def main():
    source_tokens=[(k,os.environ.get(k,"").strip()) for k in ("CLOUDFLARE_API_TOKEN","CLOUDFLARE_NOONCOUPONS_DEPLOY_TOKEN1")]
    destination_token=os.environ.get("NOON_NEW_CF_API_TOKEN","").strip()
    if not destination_token:raise RuntimeError("new_zone_token_not_configured")
    new,code=zone(destination_token,NEW_ACCOUNT)
    if not new:raise RuntimeError("new_zone_lookup_unavailable_http_"+str(code))
    old=None;old_token=None;source_status=[]
    for name,token in source_tokens:
        if not token:
            source_status.append(name+":missing")
            continue
        candidate,code=zone(token,OLD_ACCOUNT)
        source_status.append(name+":"+("ok" if candidate else "http_"+str(code)))
        if candidate:
            old,old_token=candidate,token
            break
    target={
        "domain":DOMAIN,
        "new_zone_status":new.get("status"),
        "new_assigned_nameservers":new.get("name_servers",[]),
        "new_observed_nameservers":new.get("observed_name_servers",[]),
        "old_zone_status":old.get("status") if old else "NOT_READABLE",
        "old_nameservers":old.get("name_servers",[]) if old else [],
        "old_token_readiness":source_status,
        "safe_to_change_nameservers":False,
        "dns_parity_complete":False
    }
    dest,code=records(destination_token,new["id"])
    if dest is None:raise RuntimeError("new_dns_read_unavailable_http_"+str(code))
    target["new_dns_counts"]=dict(collections.Counter(r.get("type","") for r in dest))
    if old:
        src,http=records(old_token,old["id"])
        if src is None:
            target["old_dns_read_status"]="http_"+str(http)
        else:
            # Include all mail and verification records; exclude zone-managed NS/SOA.
            excluded={"NS","SOA"}
            new_set={normalize(x) for x in dest if x.get("type") not in excluded}
            old_set={normalize(x) for x in src if x.get("type") not in excluded}
            missing=old_set-new_set
            extra=new_set-old_set
            target["old_dns_counts"]=dict(collections.Counter(r.get("type","") for r in src))
            target["missing_in_new_by_type"]=dict(collections.Counter(x[0] for x in missing))
            target["extra_in_new_by_type"]=dict(collections.Counter(x[0] for x in extra))
            target["dns_parity_complete"]=not missing
            # PARITY does not prove DO restore, route deployment or public reachability.
            target["safe_to_change_nameservers"]=False
    print("NOONDEALSNOW_DNS_CUTOVER_READ_ONLY="+json.dumps(target,ensure_ascii=False,sort_keys=True),flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
            f.write("### NoonDealsNow Cloudflare DNS cutover audit (read-only)\n\n")
            f.write("New zone status: **"+str(target["new_zone_status"])+"**; DNS parity: **"+str(target["dns_parity_complete"])+"**.\n")
            f.write("Nameserver cutover remains blocked until all migration gates pass. No changes were made.\n")
    print("CLOUDFLARE_DNS_RECORD_WRITES=0",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("NOONDEALSNOW_DNS_AUDIT_ERROR="+str(exc).splitlines()[0][:150],file=sys.stderr)
        sys.exit(1)
