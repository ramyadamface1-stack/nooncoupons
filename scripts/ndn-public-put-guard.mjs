// Exact, reversible Cloudflare zone WAF rule for invalid HTTP PUT requests
// on READ-ONLY public article and SVG paths. The actual publisher uses POST
// /api/internal/ai-v2/publish. Admin/API, articles GET/HEAD and all other
// routes are not affected. Never run broad method bans automatically.
const desc='NDN quota guard: reject PUT on public article and SVG routes only';
const expr='(http.request.method eq "PUT" and (starts_with(http.request.uri.path, "/articles/") or starts_with(http.request.uri.path, "/en/articles/") or starts_with(http.request.uri.path, "/assets/coupon-svg/")))';
const token=String(process.env.CF_TOKEN||'').trim(),account=String(process.env.CF_ACCOUNT||'').trim();
const mode=String(process.env.NDN_PUBLIC_PUT_GUARD_MODE||'').trim();
if(!token||!account)throw Error('CLOUDFLARE_READ_WRITE_TOKEN_AND_ACCOUNT_REQUIRED');
if(!['apply','disable'].includes(mode))throw Error('EXPLICIT_APPLY_OR_DISABLE_MODE_REQUIRED');
async function api(path,{method='GET',body}={}){
 const resp=await fetch('https://api.cloudflare.com/client/v4'+path,{method,
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 const data=await resp.json();
 if(!resp.ok||data.success!==true)throw Error('CLOUDFLARE_'+method+'_HTTP_'+resp.status+'_'+String(data.errors?.[0]?.message||'error').slice(0,150));
 return data.result;
}
const zone=(await api('/zones?name=noondealsnow.com')).find(z=>z.name==='noondealsnow.com'&&z.account?.id===account&&z.status==='active');
if(!zone?.id)throw Error('EXPECTED_ACTIVE_ZONE_NOT_FOUND');
const phase='/zones/'+zone.id+'/rulesets/phases/http_request_firewall_custom/entrypoint';
async function entry(){try{return await api(phase)}catch(err){if(String(err.message).includes('HTTP_404'))return null;throw err}}
let current=await entry();
const found=(current?.rules||[]).filter(x=>x.description===desc);
if(found.length>1)throw Error('DUPLICATE_OWNED_RULES_REFUSE');
if(found.length===1&&(found[0].expression!==expr||found[0].action!=='block'))throw Error('EXISTING_RULE_MISMATCH_REFUSE');
if(mode==='disable'){
 if(found.length!==1)throw Error('NO_MATCHING_RULE_TO_DISABLE');
 if(found[0].enabled===false){console.log('NDN_PUBLIC_PUT_GUARD_ALREADY_DISABLED');process.exit(0)}
 await api('/zones/'+zone.id+'/rulesets/'+current.id+'/rules/'+found[0].id,{method:'PATCH',body:{enabled:false}});
 const updated=await entry();
 if((updated?.rules||[]).find(x=>x.id===found[0].id)?.enabled!==false)throw Error('DISABLE_VERIFICATION_FAILED');
 console.log('NDN_PUBLIC_PUT_GUARD_DISABLED_AND_VERIFIED='+found[0].id);
}else{
 if(found.length===1&&found[0].enabled!==true){
   await api('/zones/'+zone.id+'/rulesets/'+current.id+'/rules/'+found[0].id,{method:'PATCH',body:{enabled:true}});
 }else if(found.length===0&&current?.id){
   await api('/zones/'+zone.id+'/rulesets/'+current.id+'/rules',{method:'POST',body:{action:'block',expression:expr,description:desc,enabled:true}});
 }else if(found.length===0){
   await api('/zones/'+zone.id+'/rulesets',{method:'POST',body:{name:'NoonDealsNow narrowly scoped public read-only quota guard',kind:'zone',phase:'http_request_firewall_custom',rules:[{action:'block',expression:expr,description:desc,enabled:true}]}});
 }
 const updated=await entry();
 const matched=(updated?.rules||[]).filter(x=>x.description===desc);
 if(matched.length!==1||matched[0].expression!==expr||matched[0].action!=='block'||matched[0].enabled!==true)throw Error('APPLY_VERIFICATION_FAILED');
 console.log('NDN_PUBLIC_PUT_GUARD_APPLIED_AND_VERIFIED='+matched[0].id);
}
console.log('NDN_PUBLIC_PUT_GUARD_MODE='+mode);
console.log('NDN_GUARD_AFFECTS_ONLY=PUT:/articles/,PUT:/en/articles/,PUT:/assets/coupon-svg/');
console.log('NDN_GUARD_EXCLUDES=GET,HEAD,POST,admin,all-api,coupon-pages,sitemap,robots,live-publisher');
console.log('NDN_DNS_R2_ARTICLE_SCHEDULER_MUTATIONS=ZERO');
