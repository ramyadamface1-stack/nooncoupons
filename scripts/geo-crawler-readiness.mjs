// Read-only, no credentials. Checks the live HTTP HTML seen by *synthetic*
// search user-agents; this is NOT proof a verified search-engine IP can crawl.
import {appendFileSync} from 'node:fs';

const targets=[
  ['NoonCoupons RAMY25 answer','https://nooncoupons.com/noon-discount-code','RAMY25'],
  ['NoonCoupons RAMY25 canonical','https://nooncoupons.com/coupon/ramy25-ramadan','RAMY25'],
  ['NoonDealsNow Saudi NOV170','https://noondealsnow.com/coupon/nov170','NOV170'],
  ['NoonDealsNow UAE NOV188','https://noondealsnow.com/coupon/nov188','NOV188']
];
const agents=['OAI-SearchBot','Googlebot','Bingbot'];
const cases=[];const problems=[];

async function fetchText(url,agent){
  let last;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{headers:{
        'user-agent':'Mozilla/5.0 (compatible; '+agent+'/1.0; automated-readonly-visibility-monitor)',
        'accept':'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
      },redirect:'follow',signal:AbortSignal.timeout(18000)});
      const body=await response.text();
      if(response.status>=500&&attempt===0){last={response,body};continue}
      return {response,body};
    }catch(e){last=e}
  }
  if(last?.response)return last;
  throw last;
}
for(const domain of ['nooncoupons.com','noondealsnow.com']){
  try{
    const {response,body}=await fetchText('https://'+domain+'/robots.txt','OAI-SearchBot');
    const allowed=!/(?:^|\n)Disallow:\s*\/\s*(?:\n|$)/i.test(body);
    const botNamed=/^User-agent:\s*OAI-SearchBot\s*$/im.test(body);
    const ok=response.status===200&&allowed&&botNamed;
    cases.push({page:domain+' robots',agent:'OAI-SearchBot',status:response.status,ok,reason:ok?'ok':'Robots fetch/access review'});
    if(!ok)problems.push(domain+'/robots.txt: '+response.status+', inspect OAI search rule');
  }catch(e){problems.push(domain+'/robots.txt: '+String(e).slice(0,120))}
}
for(const [page,url,code] of targets)for(const agent of agents){
  try{
    const {response,body}=await fetchText(url,agent);
    const canonicalTags=[...body.matchAll(/<link\b[^>]*\brel=['"]canonical['"][^>]*>/ig)].map(x=>x[0]);
    const canonical=canonicalTags.some(t=>t.includes('href="'+url+'"')||t.includes("href='"+url+"'"));
    const robotsTags=[...body.matchAll(/<meta\b[^>]*\bname=['"]robots['"][^>]*>/ig)].map(x=>x[0]).join(' ');
    const noindex=/noindex/i.test(robotsTags);
    const visible=body.includes(code);
    const ok=response.status===200&&canonical&&!noindex&&visible;
    cases.push({page,agent,status:response.status,ok,reason:ok?'ok':'canonical, noindex or code missing'});
    if(!ok)problems.push(page+' '+agent+': status='+response.status+' canonical='+canonical+' code='+visible+' noindex='+noindex);
  }catch(e){cases.push({page,agent,status:0,ok:false,reason:'request error'});problems.push(page+' '+agent+': '+String(e).slice(0,150))}
}
const report=[
  '# Noon GEO/AEO synthetic crawler readiness',
  '',
  'Timestamp: '+new Date().toISOString(),
  '',
  '**Synthetic User-Agent requests only. These are NOT verified crawler-IP traffic, indexing evidence, AI citations, or purchases.**',
  '',
  '| Page | Agent | HTTP | Check |',
  '|---|---|---:|---|',
  ...cases.map(x=>'| '+x.page+' | '+x.agent+' | '+x.status+' | '+(x.ok?'PASS':'FAIL')+' |'),
  '',
  problems.length?'## New technical failures':'## Result',
  ...(problems.length?problems.map(p=>'- '+p):['All synthetic HTTP/canonical/robots/code checks passed. Google Search indexing still needs separate GSC monitoring.'])
].join('\n');
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,report+'\n');
if(problems.length)process.exitCode=1;
