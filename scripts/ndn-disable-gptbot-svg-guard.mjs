// Manual rollback ONLY: disable the exact owned SVG-only rule, preserve every other rule.
// Invoked by workflow_dispatch input mode=disable; no DNS/R2/Worker mutations.
const name='NDN quota guard: GPTBot SVG requests only';
const expr='(starts_with(http.request.uri.path, "/assets/coupon-svg/") and http.user_agent contains "GPTBot")';
const account=process.env.CF_ACCOUNT||'',token=process.env.CF_TOKEN||'';
if(!account||!token||process.env.NDN_ROLLBACK_MODE!=='disable')throw Error('EXPLICIT_DISABLE_MODE_REQUIRED');
async function api(path,{method='GET',body}={}){
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{
  method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)
 });
 const json=await r.json();
 if(!r.ok||json.success!==true)throw Error('CLOUDFLARE_HTTP_'+r.status+'_'+String(json.errors?.[0]?.message||'error').slice(0,90));
 return json.result;
}
const zones=await api('/zones?name=noondealsnow.com');
const zone=zones.find(x=>x?.account?.id===account&&x.status==='active');
if(!zone)throw Error('ZONE_NOT_FOUND');
const path='/zones/'+zone.id+'/rulesets/phases/http_request_firewall_custom/entrypoint';
const rs=await api(path);
const candidates=(rs.rules||[]).filter(r=>r.description===name);
if(candidates.length!==1||candidates[0].expression!==expr||candidates[0].action!=='block')
 throw Error('RULE_NOT_EXACT_MATCH_ROLLBACK_REFUSED');
const target=candidates[0];
if(target.enabled===false){console.log('NDN_SCOPED_GUARD_ALREADY_DISABLED');process.exit(0)}
await api('/zones/'+zone.id+'/rulesets/'+rs.id+'/rules/'+target.id,{
 method:'PATCH',body:{enabled:false}
});
const updated=await api(path);
const after=(updated.rules||[]).find(x=>x.id===target.id);
if(!after||after.enabled!==false)throw Error('GUARD_DISABLE_NOT_VERIFIED');
console.log('NDN_SCOPED_GUARD_DISABLED_AND_VERIFIED='+target.id);
console.log('NO_OTHER_RULES_OR_DNS_OR_ARTICLES_MODIFIED=true');
