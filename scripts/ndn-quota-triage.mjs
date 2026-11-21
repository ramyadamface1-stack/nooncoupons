// Read-only. No API mutations, IP collection or origin/DNS changes.
// Counts are analytics samples, not account billing totals.
const CF='https://api.cloudflare.com/client/v4';
const log=(label,value)=>console.log(label+'='+JSON.stringify(value));
const token=process.env.CF_TOKEN||'';
const account=process.env.CF_ACCOUNT||'';
if(!token||!account){console.log('NDN_QUOTA_TRIAGE_UNAVAILABLE=missing_cloudflare_read_token');process.exit(0)}
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function api(path){
  const response=await fetch(CF+path,{headers,signal:AbortSignal.timeout(13000)});
  const data=await response.json();
  if(!response.ok||!data.success)throw Error('status='+response.status+' '+String(data.errors?.[0]?.message||'').slice(0,80));
  return data.result;
}
let zone;
try{
  const zones=await api('/zones?name=noondealsnow.com');
  zone=zones.find(x=>x?.account?.id===account);
  if(!zone)throw Error('zone_not_in_expected_account');
  log('NDN_ZONE',{status:zone.status,plan:zone.plan?.name||'unknown',id:zone.id});
}catch(e){console.log('NDN_ZONE_LOOKUP_FAILED='+String(e.message).slice(0,90));process.exit(0)}
for(const [label,path] of [
  ['ROUTES','/zones/'+zone.id+'/workers/routes'],
  ['DOMAINS','/accounts/'+account+'/workers/domains'],
  ['CACHE_RULES','/zones/'+zone.id+'/rulesets/phases/http_request_cache_settings/entrypoint'],
  ['CUSTOM_WAF','/zones/'+zone.id+'/rulesets/phases/http_request_firewall_custom/entrypoint'],
  ['RATE_RULES','/zones/'+zone.id+'/rulesets/phases/http_ratelimit/entrypoint']
]){
  try{
    const rows=await api(path);
    if(label==='ROUTES')log('NDN_WORKER_ROUTES',(Array.isArray(rows)?rows:[]).map(x=>({pattern:x.pattern,script:x.script,failOpen:x.request_limit_fail_open})).slice(0,30));
    else if(label==='DOMAINS')log('NDN_WORKER_CUSTOM_DOMAINS',(Array.isArray(rows)?rows:[]).filter(x=>/noondealsnow/i.test(x.hostname||'')).map(x=>({hostname:x.hostname,service:x.service,environment:x.environment})));
    else log('NDN_'+label,{id:rows?.id,enabled:rows?.enabled,phase:rows?.phase,count:rows?.rules?.length||0,
      rules:(rows?.rules||[]).slice(0,12).map(x=>({action:x.action,enabled:x.enabled,description:x.description,
        expression:String(x.expression||'').slice(0,170)}))});
  }catch(e){console.log('NDN_'+label+'_UNAVAILABLE='+String(e.message).slice(0,95))}
}
const now=new Date(),start=new Date(now);start.setUTCHours(0,0,0,0);
const vars={zone:zone.id,from:start.toISOString(),to:now.toISOString()};
log('NDN_QUOTA_WINDOW_UTC',{from:vars.from,to:vars.to});
async function query(label,body,filter={},max=15){
  const gql=`query($zone: String,$from: String,$to: String) {
    viewer { zones(filter:{zoneTag:$zone}) {
      values:httpRequestsAdaptiveGroups(limit:${max},orderBy:[count_DESC],filter:{
        datetime_geq:$from,datetime_leq:$to,${Object.entries(filter).map(([k,v])=>k+':'+JSON.stringify(v)).join(',')}
      }) {count ${body}}
    }}
  }`;
  try{
    const r=await fetch(CF+'/graphql',{method:'POST',headers,body:JSON.stringify({query:gql,variables:vars}),signal:AbortSignal.timeout(19000)});
    const obj=await r.json();
    if(!r.ok||obj.errors?.length)throw Error('HTTP '+r.status+' '+String(obj.errors?.[0]?.message||'unknown').slice(0,100));
    const rows=obj?.data?.viewer?.zones?.[0]?.values;
    if(!Array.isArray(rows))throw Error('no analytics rows');
    const mapped=rows.map(x=>({...x,dimensions:Object.fromEntries(Object.entries(x.dimensions||{}).map(([k,v])=>[k,String(v).slice(0,170)]))}));
    log('NDN_'+label,mapped);
  }catch(e){console.log('NDN_'+label+'_UNAVAILABLE='+String(e.message).slice(0,125))}
}
await query('ALL_EDGE_REQUESTS','',{},1);
await query('SVG_EDGE_REQUESTS','',{clientRequestPath_like:'/assets/coupon-svg/%'},1);
await query('ARTICLE_EDGE_REQUESTS','',{clientRequestPath_like:'/articles/%'},1);
await query('EN_ARTICLE_EDGE_REQUESTS','',{clientRequestPath_like:'/en/articles/%'},1);
await query('API_EDGE_REQUESTS','',{clientRequestPath_like:'/api/%'},1);
await query('BOT_AGENT_BREAKDOWN','dimensions { userAgent }',{requestSource:'eyeball'},20);
await query('ASN_BREAKDOWN','dimensions { clientAsn }',{requestSource:'eyeball'},20);
await query('EDGE_STATUSES','dimensions { edgeResponseStatus }',{},12);
for(const [name,agent] of [['GPTBOT','%GPTBot%'],['GOOGLEBOT','%Googlebot%'],['OAI_SEARCHBOT','%OAI-SearchBot%'],['SEMRUSHBOT','%SemrushBot%'],['AHREFSBOT','%AhrefsBot%']]){
  await query(name+'_ALL','',{userAgent_like:agent},1);
  await query(name+'_SVG','',{userAgent_like:agent,clientRequestPath_like:'/assets/coupon-svg/%'},1);
  await query(name+'_ARTICLES','',{userAgent_like:agent,clientRequestPath_like:'/articles/%'},1);
}
await query('GPTBOT_504','',{userAgent_like:'%GPTBot%',edgeResponseStatus:504},1);
await query('GPTBOT_204','',{userAgent_like:'%GPTBot%',edgeResponseStatus:204},1);
await query('METHODS','dimensions { clientRequestHTTPMethodName }',{},10);
await query('ERROR_504_METHODS','dimensions { clientRequestHTTPMethodName }',{edgeResponseStatus:504},10);
await query('STATUS_204_METHODS','dimensions { clientRequestHTTPMethodName }',{edgeResponseStatus:204},10);
await query('ARTICLES_504_AGENTS','dimensions { userAgent }',{clientRequestPath_like:'/articles/%',edgeResponseStatus:504},12);
await query('SVG_504_AGENTS','dimensions { userAgent }',{clientRequestPath_like:'/assets/coupon-svg/%',edgeResponseStatus:504},12);
for(const [label,prefix] of [['ARTICLES','/articles/%'],['SVG','/assets/coupon-svg/%'],['API','/api/%']]){
  await query('STATUS_504_'+label,'',{clientRequestPath_like:prefix,edgeResponseStatus:504},1);
  await query('STATUS_204_'+label,'',{clientRequestPath_like:prefix,edgeResponseStatus:204},1);
}
await query('GOOGLEBOT_504','',{userAgent_like:'%Googlebot%',edgeResponseStatus:504},1);
await query('OAI_SEARCHBOT_504','',{userAgent_like:'%OAI-SearchBot%',edgeResponseStatus:504},1);


console.log('NDN_QUOTA_TRIAGE_READ_ONLY=true');
