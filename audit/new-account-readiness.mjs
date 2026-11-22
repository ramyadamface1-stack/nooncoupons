/** Read-only evidence-based assessment. Never changes DNS, Worker routes or storage. */
export function assessCutover(x) {
  const blockers=[],warnings=[];
  const must=(id,pass,reason)=>{if(!pass)blockers.push({id,reason});};
  must("zone_active",x.zoneStatus==="active","The new Cloudflare zone is not Active.");
  must("worker_exists",x.workerFound===true,"New-account production candidate is unverified.");
  must("bucket_exists",x.bucketFound===true,"New-account R2 bucket is unverified.");
  for(const kind of ["ControlPlane","GeneratorControl"]){
    for(const part of ["baseline","fresh"]){
      const s=x?.[part]?.[kind]||{};
      must(part+"_"+kind,s.manifestComplete===true && s.restoreComplete===true &&
        Number.isInteger(s.exported) && s.exported===s.restored,
        part+" "+kind+" source keys and restored keys must match a completed manifest.");
    }
  }
  must("dns_record_parity",x.dnsRecordsVerified===true,
    "New-zone DNS, email, TXT and verification records have not been independently confirmed.");
  if(x.publicStatus===429)warnings.push("The current public site returned HTTP 429; do not claim live readiness.");
  if(x.publicStatus==null)warnings.push("Public status was not determined.");
  if(x.liveCutoverApplied!==true)warnings.push("No confirmed public DNS/route cutover to the new account.");
  return {readyForOperatorCutover:blockers.length===0,
    liveOnNewAccount:x.liveCutoverApplied===true && blockers.length===0,blockers,warnings};
}
