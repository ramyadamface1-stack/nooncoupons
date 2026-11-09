// Read-only Cloudflare AI crawler sample report. No IPs, secrets, or visitor IDs.
// Free plans typically identify crawlers by spoofable User-Agent, not verified IP.
// Never equate a sampled request with an AI citation or a coupon purchase.
import {appendFileSync} from 'node:fs';

const SITE = 'noondealsnow.com';
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const TOKEN = process.env.CF_TOKEN || '';
const CLIENTS = [
  ['ChatGPT Search', 'OAI-SearchBot'],
  ['ChatGPT User fetch', 'ChatGPT-User'],
  ['Googlebot / Google AI search eligibility', 'Googlebot'],
  ['Bing / Copilot discovery', 'bingbot'],
  ['Perplexity', 'PerplexityBot']
];
const end = new Date();
const start = new Date(end.getTime()-23*3600*1000);
const notes = [];
const lines = [
  '# Cloudflare GEO/AEO crawler requests',
  '',
  'Host: '+SITE+'; UTC time: '+start.toISOString()+' to '+end.toISOString(),
  '',
  '**Traffic sample observed at Cloudflare, not a confirmed ChatGPT/Gemini/Copilot recommendation. User-Agent can be spoofed; low traffic and sampling can hide real crawls.**',
  '',
  '| Claimed crawler | Sampled requests | 2xx/3xx | 4xx/5xx | Most requested path (sample) |',
  '|---|---:|---:|---:|---|'
];
function writeReport() {
  let report=lines.concat('',notes.length?'## Diagnostic notes':'## Status',...(notes.length?notes:['Read-only report complete. Google indexing and actual AI citations require independent checks.'])).join('\n')+'\n';
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
}
function unavailable(message) {notes.push(message);writeReport();}

async function readJson(url, options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('Cloudflare HTTP '+response.status);
  return await response.json();
}
function analyticsQuery(agent){
  // Public Cloudflare schema documented for httpRequestsAdaptiveGroups.
  const literal=agent.replace(/[^A-Za-z0-9_-]/g,'');
  return 'query CrawlerSample($zoneTag:string,$start:Time,$end:Time){'+
    'viewer{zones(filter:{zoneTag:$zoneTag}){'+
    'traffic:httpRequestsAdaptiveGroups(limit:100,orderBy:[count_DESC],'+
    'filter:{datetime_geq:$start,datetime_lt:$end,requestSource:"eyeball",userAgent_like:"%'+literal+'%"})'+
    '{count dimensions{clientRequestPath edgeResponseStatus userAgent}}'+
    '}}}';
}
async function main(){
  if(!TOKEN || !ACCOUNT_ID) return unavailable('Cloudflare API token/account unavailable in this CI environment. No traffic conclusion made; enable a read-only Zone Analytics permission to report.');
  let zones;
  try {
    zones=await readJson('https://api.cloudflare.com/client/v4/zones?name='+SITE+'&account.id='+ACCOUNT_ID,{
      headers:{Authorization:'Bearer '+TOKEN},});
  } catch(err) {return unavailable('Cannot discover existing Cloudflare zone ('+String(err.message).slice(0,80)+'). No site or DNS changes attempted.');}
  const matches=(zones.result||[]).filter(z=>z.name===SITE&&z.account?.id===ACCOUNT_ID);
  if(!zones.success||matches.length!==1)
    return unavailable('Exactly one matching Cloudflare zone not accessible. This may be a token scope or account/zone mismatch.');
  const zoneTag=matches[0].id;
  let measured=0,errors=0;
  for(const [label,agent] of CLIENTS){
    try {
      const data=await readJson('https://api.cloudflare.com/client/v4/graphql',{
        method:'POST',
        headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify({query:analyticsQuery(agent),variables:{zoneTag,start:start.toISOString(),end:end.toISOString()}})
      });
      const rows=data.data?.viewer?.zones?.[0]?.traffic;
      if(data.errors?.length||!Array.isArray(rows)){
        errors++;
        notes.push(label+': analytics dataset unavailable or token lacks read permission. No inference about crawler activity.');
        lines.push('| '+label+' | unavailable | — | — | — |');
        continue;
      }
      measured++;
      let total=0,success=0,fail=0;
      const paths=new Map();
      const errorStatuses=new Map();
      const errorPaths=new Map();
      const couponHits=new Map();
      for(const row of rows){
        const n=Number(row.count)||0,status=Number(row.dimensions?.edgeResponseStatus)||0;
        total+=n;
        if(status>=200&&status<400) success+=n;
        if(status>=400) {
          fail+=n;
          errorStatuses.set(status,(errorStatuses.get(status)||0)+n);
          const failedPath=row.dimensions?.clientRequestPath||'';
          if(failedPath.startsWith('/')&&!failedPath.startsWith('/admin')&&!failedPath.startsWith('/api/'))
            errorPaths.set(failedPath,(errorPaths.get(failedPath)||0)+n);
        }
        if(['/coupon/nov170','/coupon/nov188'].includes(row.dimensions?.clientRequestPath))
          couponHits.set(row.dimensions.clientRequestPath,(couponHits.get(row.dimensions.clientRequestPath)||0)+n);
        const path=row.dimensions?.clientRequestPath||'';
        if(path&&path.startsWith('/')&&!path.startsWith('/admin')&&!path.startsWith('/api/'))
          paths.set(path,(paths.get(path)||0)+n);
      }
      const top=[...paths].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
      lines.push('| '+label+' | '+total+' | '+success+' | '+fail+' | '+top.replaceAll('|','/').slice(0,95)+' |');
      if(fail>0){
        const statusSummary=[...errorStatuses].sort((a,b)=>a[0]-b[0]).map(([code,n])=>code+'='+n).join(', ');
        const safe=p=>p.replace(/[|<>\r\n]/g,'_').slice(0,115);
        const badPaths=[...errorPaths].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([path,n])=>safe(path)+' ('+n+')').join('; ')||'not visible in sampled groups';
        notes.push(label+': '+fail+' sampled 4xx/5xx requests; status breakdown '+statusSummary+'; top failing paths: '+badPaths+'. These may be 404s for old URLs, not WAF blocks.');
      }
      if(agent==='OAI-SearchBot'||agent==='bingbot'||agent==='Googlebot'){
        const best=[...paths].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([path,n])=>path.replace(/[|<>\r\n]/g,'_').slice(0,105)+' ('+n+')').join('; ');
        notes.push(label+' top sampled paths: '+(best||'none'));
        notes.push(label+' canonical NOV170/NOV188 paths represented among the top 100 grouped rows: '+
          (couponHits.get('/coupon/nov170')||0)+' / '+(couponHits.get('/coupon/nov188')||0)+'. This is not a complete crawl-history count.');
      }
      if(total===0)notes.push(label+': no *sampled* matching requests in this 23h window; this does NOT prove that this service stopped crawling.');
    } catch(err){
      errors++;lines.push('| '+label+' | unavailable | — | — | — |');
      notes.push(label+': analytics query unavailable ('+String(err.message).slice(0,75)+').');
    }
  }
  if(measured===0) notes.push('No successful Cloudflare analytics dataset query. Existing deployment token likely needs Zone Analytics:Read, or zone access is limited.');
  if(errors)notes.push('Only successful query rows are interpretable. Never report missing data as zero traffic.');
  writeReport();
}
main().catch(e=>{unavailable('Unexpected analytics report error: '+String(e.message).slice(0,100));});
