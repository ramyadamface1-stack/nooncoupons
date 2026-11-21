// Temporary reversible P0 safeguard: disproportionate high-volume GPTBot
// article crawling exhausted free Workers invocations on 2026-11-21.
// Preserve ChatGPT Search via independent OAI-SearchBot and user-triggered
// ChatGPT-User, normal browsers, Googlebot/Bingbot, all admin/API/publishing.
const label='NDN P0 quota guard: GPTBot training GET on article URLs only';
const expression='(http.request.method eq "GET" and http.user_agent contains "GPTBot" and not http.user_agent contains "OAI-SearchBot" and not http.user_agent contains "ChatGPT-User" and (starts_with(http.request.uri.path, "/articles/") or starts_with(http.request.uri.path, "/en/articles/")))';
const mode=process.env.NDN_TRAINING_BOT_ARTICLE_MODE||'';
const account=process.env.CF_ACCOUNT||'',token=process.env.CF_TOKEN||'';
if(!['apply','disable'].includes(mode)||!account||!token)throw Error('EXPLICIT_MODE_AND_CLOUDFLARE_TOKEN_REQUIRED');
async function api(path,{method='GET',body}={}){
 const response=await fetch('https://api.cloudflare.com/client/v4'+path,{
  method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 const json=await response.json();
 if(!response.ok||json.success!==true)throw Error(method+'_HTTP_'+response.status+' '+String(json.errors?.[0]?.message||'invalid').slice(0,160));
 return json.result;
}
const zones=await api('/zones?name=noondealsnow.com');
const zone=zones.find(z=>z.name==='noondealsnow.com'&&z.account?.id===account&&z.status==='active');
if(!zone?.id)throw Error('UNEXPECTED_CLOUDFLARE_ZONE');
const phase='/zones/'+zone.id+'/rulesets/phases/http_request_firewall_custom/entrypoint';
const group=await api(phase);
const matches=(group.rules||[]).filter(x=>x.description===label);
if(matches.length>1)throw Error('DUPLICATE_RULES_REFUSE');
if(matches.length===1&&(matches[0].expression!==expression||matches[0].action!=='block'))throw Error('RULE_DRIFT_REFUSE');
if(mode==='apply'){
 if(!matches.length)await api('/zones/'+zone.id+'/rulesets/'+group.id+'/rules',{method:'POST',body:{action:'block',expression,description:label,enabled:true}});
 else if(matches[0].enabled!==true)await api('/zones/'+zone.id+'/rulesets/'+group.id+'/rules/'+matches[0].id,{method:'PATCH',body:{enabled:true}});
}else{
 if(matches.length!==1)throw Error('NO_EXACT_MATCH_TO_DISABLE');
 if(matches[0].enabled!==false)await api('/zones/'+zone.id+'/rulesets/'+group.id+'/rules/'+matches[0].id,{method:'PATCH',body:{enabled:false}});
}
const after=await api(phase),owned=(after.rules||[]).filter(x=>x.description===label);
if(owned.length!==1||owned[0].enabled!==(mode==='apply')||owned[0].expression!==expression)throw Error('POST_WRITE_VERIFY_FAIL');
console.log('NDN_GPTBOT_TRAINING_ARTICLE_GUARD_'+(mode==='apply'?'ACTIVE':'DISABLED')+'_VERIFIED='+owned[0].id);
console.log('PROTECTED_PATHS=GET /articles/* and /en/articles/* FROM GPTBot User-Agent only');
console.log('NOT_BLOCKED=OAI-SearchBot,ChatGPT-User,Googlebot,Bingbot,all normal browsers,GET coupon pages,admin,APIs,POST publishing');
console.log('DNS_R2_PUBLISHER_ARTICLE_MUTATIONS=ZERO');
