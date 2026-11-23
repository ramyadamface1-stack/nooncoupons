// Read-only, no credentials. Checks the live HTTP HTML seen by *synthetic*
// search user-agents; this is NOT proof a verified search-engine IP can crawl.
import {appendFileSync} from 'node:fs';
import {verifyCouponPage,isXmlSitemap} from './geo-crawler-checks.mjs';

const targets=[
  ['NoonDealsNow Saudi NOV170','https://noondealsnow.com/coupon/nov170','NOV170'],
  ['NoonDealsNow UAE NOV188','https://noondealsnow.com/coupon/nov188','NOV188'],
  ['NoonDealsNow Saudi canonical','https://noondealsnow.com/saudi-arabia/noon-coupon-code','NOV170'],
  ['NoonDealsNow UAE canonical','https://noondealsnow.com/uae/noon-coupon-code','NOV188']
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
for(const domain of ['noondealsnow.com']){
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
    const checked=verifyCouponPage({url,status:response.status,html:body,headers:response.headers,code});
    const {ok,canonicalMatches:canonical,visible,noindex}=checked;
    cases.push({page,agent,status:response.status,ok,reason:ok?'ok':'canonical, noindex or code missing'});
    if(!ok)problems.push(page+' '+agent+': status='+response.status+' canonical='+canonical+' code='+visible+' noindex='+noindex);
  }catch(e){cases.push({page,agent,status:0,ok:false,reason:'request error'});problems.push(page+' '+agent+': '+String(e).slice(0,150))}
}
// Detect GET/HEAD divergence on known indexable XML sitemaps. Google/Bing
// can preflight a URL with HEAD; a published GET 200 must not yield HEAD 404.
// One deliberately unknown shard guards against falsely returning 200 for all.
const sitemapHeadCases=[
  {path:'/sitemap-hubs.xml',expected:200},
  {path:'/sitemap-priority.xml',expected:200},
  {path:'/sitemap-rescue-articles-32.xml',expected:200},
  {path:'/sitemap-rescue-articles-999.xml',expected:404}
];
async function fetchStatus(url,method){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{method,headers:{'user-agent':'NoonDealsNow-public-sitemap-readonly-test/1.0','accept':'application/xml,*/*;q=0.5'},redirect:'follow',signal:AbortSignal.timeout(20000)});
      const status=response.status;
      const xml=(response.headers.get('content-type')||'').includes('xml');
      const mime=response.headers.get('content-type')||'';
      const body=method==='GET'?await response.text():'';
      if(method!=='GET')await response.body?.cancel();
      if(status>=500&&attempt===0)continue;
      return {status,xml,mime,body};
    }catch(e){lastError=e}
  }
  throw lastError||new Error('503 after retry');
}
for(const item of sitemapHeadCases){
  const url='https://noondealsnow.com'+item.path;
  try{
    const head=await fetchStatus(url,'HEAD');
    const get=item.expected===200?await fetchStatus(url,'GET'):null;
    // Cloudflare Static Assets correctly serve HEAD 200 without the private
    // dynamic-worker marker. Only HTTP parity and actual GET XML matter.
    const ok=head.status===item.expected&&(item.expected!==200||
      (head.xml&&isXmlSitemap({status:get?.status,mime:get?.mime,body:get?.body})));
    cases.push({page:'NoonDealsNow '+item.path,agent:'HEAD/GET parity',status:String(head.status)+'/'+(get?.status??'n/a'),ok});
    if(!ok)problems.push('Sitemap HTTP/XML mismatch: '+item.path+' HEAD='+head.status+' GET='+(get?.status??'not tested')+' xmlMime='+head.xml);
  }catch(e){cases.push({page:'NoonDealsNow '+item.path,agent:'HEAD/GET parity',status:0,ok:false});problems.push('Sitemap method check '+item.path+': '+String(e).slice(0,120))}
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
