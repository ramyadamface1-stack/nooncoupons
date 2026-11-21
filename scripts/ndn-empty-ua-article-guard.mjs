// P0 narrow and reversible zone edge rule. On 2026-11-21, anonymous GET
// requests for PUBLIC article URLs generated 81,532 504 responses vs 591
// 200 responses in sampled zone analytics. Preserve legitimate crawlers
// (named user agent), regular browsers, HEAD/POST, all admin/API/publish routes.
const label='NDN quota guard: empty UA GET to public article URLs only';
const expression='(http.request.method eq "GET" and http.user_agent eq "" and (starts_with(http.request.uri.path, "/articles/") or starts_with(http.request.uri.path, "/en/articles/")))';
const mode=process.env.NDN_EMPTY_UA_ARTICLE_MODE||'';
const account=process.env.CF_ACCOUNT,token=process.env.CF_TOKEN;
if(!['apply','disable'].includes(mode)||!account||!token)throw Error('EXPLICIT_MODE_AND_ACCOUNT_TOKEN_REQUIRED');
const origin='https://api.cloudflare.com/client/v4';
async function api(path,{method='GET',body}={}){
 const r=await fetch(origin+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const j=await r.json();if(!r.ok||!j.success)throw Error(method+'_API_HTTP_'+r.status+' '+String(j.errors?.[0]?.message||'invalid').slice(0,160));
 return j.result;
}
const zones=await api('/zones?name=noondealsnow.com');
const zone=zones.find(x=>x.name==='noondealsnow.com'&&x.account?.id===account&&x.status==='active');
if(!zone?.id)throw Error('UNEXPECTED_CLOUDFLARE_ZONE');
const phase='/zones/'+zone.id+'/rulesets/phases/http_request_firewall_custom/entrypoint';
const ruleset=await api(phase);
const matches=(ruleset.rules||[]).filter(x=>x.description===label);
if(matches.length>1)throw Error('DUPLICATE_RULE_REFUSE');
if(matches.length===1&&(matches[0].action!=='block'||matches[0].expression!==expression))throw Error('RULE_DRIFT_REFUSE');
if(mode==='apply'){
 if(matches.length===1){
  if(!matches[0].enabled)await api('/zones/'+zone.id+'/rulesets/'+ruleset.id+'/rules/'+matches[0].id,{method:'PATCH',body:{enabled:true}});
 }else{
  await api('/zones/'+zone.id+'/rulesets/'+ruleset.id+'/rules',{method:'POST',body:{action:'block',expression,description:label,enabled:true}});
 }
}else{
 if(matches.length!==1)throw Error('RULE_TO_DISABLE_MISSING');
 if(matches[0].enabled)await api('/zones/'+zone.id+'/rulesets/'+ruleset.id+'/rules/'+matches[0].id,{method:'PATCH',body:{enabled:false}});
}
const after=await api(phase),owned=(after.rules||[]).filter(x=>x.description===label);
if(owned.length!==1||owned[0].enabled!==(mode==='apply')||owned[0].expression!==expression)throw Error('POST_WRITE_POLICY_VERIFICATION_FAILED');
console.log('NDN_EMPTY_UA_ARTICLE_GUARD_'+(mode==='apply'?'ACTIVE':'DISABLED')+'_VERIFIED='+owned[0].id);
console.log('ONLY_MATCHES=GET with empty user-agent at /articles/ or /en/articles/');
console.log('UNMODIFIED=articles, coupon codes, DNS, R2, scheduler, robots, Googlebot, OAI-SearchBot, real browser GET/HEAD and all APIs');
