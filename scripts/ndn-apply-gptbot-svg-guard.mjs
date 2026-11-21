// Scoped, idempotent Cloudflare Free-plan mitigation.
// Block ONLY requests advertising GPTBot for expensive per-article SVG assets.
// Never deny HTML, article/sitemap/robots, OAI-SearchBot, Googlebot or Bingbot.
// Rule is at the zone edge, before the Worker, so blocked requests do not
// consume the Workers daily invocation allowance.
const token=process.env.CF_TOKEN||'',account=process.env.CF_ACCOUNT||'';
const origin='https://api.cloudflare.com/client/v4',name='NDN quota guard: GPTBot SVG requests only';
const expr='(http.request.uri.path starts_with "/assets/coupon-svg/" and http.user_agent contains "GPTBot")';
function assert(x,msg){if(!x)throw Error(msg)}
async function api(path,{method='GET',body}={}){
  const res=await fetch(origin+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
  const data=await res.json();
  if(!res.ok||data.success!==true){
    throw Error('API_'+method+'_HTTP_'+res.status+'_ERR_'+String(data.errors?.[0]?.message||'unknown').slice(0,120));
  }
  return data.result;
}
async function getEntrypoint(zone){
  try{return await api('/zones/'+zone+'/rulesets/phases/http_request_firewall_custom/entrypoint')}
  catch(e){if(/HTTP_404/.test(String(e.message)))return null;throw e}
}
if(!token||!account)throw Error('MISSING_CLOUDFLARE_ACCOUNT_TOKEN');
const zones=await api('/zones?name=noondealsnow.com');
const zone=(zones||[]).find(x=>x?.account?.id===account&&x?.status==='active');
assert(zone?.id,'NO_MATCHING_ACTIVE_ZONE');
assert(zone.name==='noondealsnow.com','UNEXPECTED_ZONE');
let entry=await getEntrypoint(zone.id);
const rules=entry?.rules||[];
const existing=rules.filter(x=>x.description===name);
assert(existing.length<=1,'DUPLICATE_QUOTA_RULES_REQUIRE_MANUAL_REVIEW');
const intended={action:'block',expression:expr,description:name,enabled:true};
if(existing.length===1){
  const rule=existing[0];
  assert(rule.action==='block'&&rule.expression===expr&&rule.enabled!==false,'EXISTING_RULE_DRIFT');
  console.log('NDN_SCOPED_GPTBOT_SVG_GUARD=ALREADY_APPLIED;id='+rule.id);
}else{
  // Never replace existing rules. Add to the established zone entry point, or
  // create one when absent. The API token may lack Zone WAF Edit; fail loudly.
  if(entry?.id){
    await api('/zones/'+zone.id+'/rulesets/'+entry.id+'/rules',{method:'POST',body:intended});
  }else{
    await api('/zones/'+zone.id+'/rulesets',{method:'POST',body:{
      name:'NoonDealsNow targeted bot media quota protection',
      kind:'zone',phase:'http_request_firewall_custom',rules:[intended]
    }});
  }
  entry=await getEntrypoint(zone.id);
  const after=(entry?.rules||[]).filter(x=>x.description===name);
  assert(after.length===1&&after[0].action==='block'&&after[0].expression===expr&&after[0].enabled!==false,'POST_WRITE_VERIFICATION_FAILED');
  console.log('NDN_SCOPED_GPTBOT_SVG_GUARD=CREATED_AND_VERIFIED;id='+after[0].id);
}
console.log('NDN_GUARD_PROTECTS=page-html,googlebot,bingbot,oai-searchbot');
console.log('NDN_GUARD_DENIES=gptbot_user_agent_only_on_dynamic_coupon_svg');
console.log('NDN_ARTICLE_OR_DNS_OR_R2_OR_SCHEDULER_MUTATIONS=ZERO');
