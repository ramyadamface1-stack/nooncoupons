// Independent read-only indexABILITY audit, NOT Google Search Console's index status.
// Bounded public HTTP GETs only, no Cloudflare API or article writes, no inference
// that an article is unindexed simply because Search Console lacks query clicks.
import {appendFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {extractCanonical,hasNoindex} from './geo-crawler-checks.mjs';

const ORIGIN='https://noondealsnow.com';
const MAX_PAGES=32;
const UA='NoonDealsNow-Indexability-Diagnostic/1.0 (+https://noondealsnow.com/about)';
const sample=(items,n)=>{
 const arr=[...new Set(items)];
 if(arr.length<=n)return arr;
 return [...new Set(Array.from({length:n},(_,i)=>arr[Math.round(i*(arr.length-1)/(n-1))]))];
};
export function locs(xml){
 return [...String(xml||'').matchAll(/<(?:[a-z0-9_-]+:)?loc\b[^>]*>([^<>]+)<\/(?:[a-z0-9_-]+:)?loc>/gi)]
  .map(x=>x[1].replaceAll('&amp;','&').trim());
}
export function xmlKind(xml){
 const b=String(xml||'');
 return /<(?:[a-z0-9_-]+:)?sitemapindex\b/i.test(b)?'index':
 /<(?:[a-z0-9_-]+:)?urlset\b/i.test(b)?'urls':'invalid';
}
export function classifyPage(url,response,html){
 const canonical=extractCanonical(html);
 let canonicalMatches=false;
 try{canonicalMatches=Boolean(canonical)&&new URL(canonical,url).href===new URL(url).href}catch{}
 const noindex=hasNoindex(html,response.headers);
 const status=response.status;
 const reasons=[];
 if(status!==200)reasons.push(status===429?'WORKER_QUOTA_429':'HTTP_'+status);
 if(!/html/i.test(response.headers?.get?.('content-type')||''))reasons.push('NOT_HTML');
 if(!canonicalMatches)reasons.push('CANONICAL_MISMATCH_OR_MISSING');
 if(noindex)reasons.push('NOINDEX');
 if(!/<h1\b/i.test(html))reasons.push('NO_H1');
 return {url,status,canonical,canonicalMatches,noindex,
  result:reasons.length?'FAIL':'PASS',reasons};
}
function safe(url,origin=ORIGIN){
 try{const parsed=new URL(url);
  return parsed.origin===origin&&!parsed.username&&!parsed.password&&parsed.protocol==='https:';}catch{return false}
}
async function get(url,fetcher){
 const res=await fetcher(url,{headers:{'user-agent':UA,'accept':'text/html,application/xml,*/*;q=0.8',
  'cache-control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(15000)});
 const body=await res.text();
 if(body.length>3000000)throw Error('OVERSIZED_PUBLIC_RESPONSE');
 return {res,body};
}
export async function auditIndexability({origin=ORIGIN,fetcher=fetch,maxPages=MAX_PAGES}={}){
 if(!Number.isInteger(maxPages)||maxPages<4||maxPages>MAX_PAGES)throw Error('UNSAFE_PAGE_SAMPLE_LIMIT');
 const sources=[],warnings=[],candidates=[];
 const readXml=async(url,kind)=>{
  const {res,body}=await get(url,fetcher);
  if(res.status!==200||!/(xml)/i.test(res.headers.get('content-type')||'')||xmlKind(body)!==kind)
   throw Error('XML_NOT_AVAILABLE_'+res.status+'_'+new URL(url).pathname);
  return body;
 };
 let aiRoots=[];
 try{
  const ai=await readXml(origin+'/sitemap-ai-v2.xml','index');
  aiRoots=locs(ai).filter(u=>safe(u,origin)&&/^\/sitemap-ai-v2-\d+\.xml$/.test(new URL(u).pathname));
  if(!aiRoots.length)throw Error('AI_V2_HAS_NO_SHARDS');
  for(const url of sample(aiRoots,Math.min(5,aiRoots.length))){
   const xml=await readXml(url,'urls');
   const urls=locs(xml).filter(u=>safe(u,origin)&&new URL(u).pathname.startsWith('/articles/'));
   sources.push({type:'ai-v2',sitemap:url,totalInShard:urls.length});
   candidates.push(...sample(urls,4));
  }
 }catch(e){warnings.push('AI_V2_SOURCE_'+String(e.message||e).slice(0,100))}
 try{
  const xml=await readXml(origin+'/sitemap-commercial.xml','urls');
  const urls=locs(xml).filter(u=>safe(u,origin));
  sources.push({type:'commercial',sitemap:origin+'/sitemap-commercial.xml',totalInShard:urls.length});
  const targets=[
   '/saudi-arabia/noon-coupon-code','/uae/noon-coupon-code',
   '/saudi/buying-guide/existing-customers','/uae/buying-guide/existing-customers',
   '/saudi/buying-guide/first-order','/uae/buying-guide/first-order'
  ];
  for(const path of targets){
   const url=origin+path;
   if(urls.includes(url))candidates.push(url);
   else warnings.push('COMMERCIAL_TARGET_NOT_IN_SITEMAP_'+path);
  }
  candidates.push(...sample(urls,4));
 }catch(e){warnings.push('COMMERCIAL_SOURCE_'+String(e.message||e).slice(0,100))}
 // An archived shard with zero indexable URLs is NOT evidence that old
 // articles are missing or unindexed. Flag it for sitemap cleanup only.
 try{
  const xml=await readXml(origin+'/sitemap.xml','index');
  const shards=locs(xml).filter(u=>safe(u,origin)&&/^\/sitemap-articles-20\d{2}-\d{2}-\d{2}-\d+\.xml$/.test(new URL(u).pathname));
  if(!shards.length)warnings.push('HISTORICAL_SHARDS_NOT_IN_ROOT');
  for(const url of sample(shards,Math.min(shards.length,3))){
   const body=await readXml(url,'urls');
   const all=locs(body).filter(u=>safe(u,origin)&&new URL(u).pathname.startsWith('/articles/'));
   sources.push({type:'historical',sitemap:url,totalInShard:all.length});
   if(all.length===0)warnings.push('EMPTY_REFERENCED_SITEMAP_'+new URL(url).pathname);
   else candidates.push(...sample(all,1));
  }
 }catch(e){warnings.push('HISTORICAL_SOURCE_'+String(e.message||e).slice(0,100))}
 const urls=[...new Set(candidates)].filter(u=>safe(u,origin)).slice(0,maxPages);
 const results=[];
 // Small batch concurrency ensures this health check cannot flood Workers.
 for(let i=0;i<urls.length;i+=4){
  const batch=await Promise.all(urls.slice(i,i+4).map(async url=>{
   try{const {res,body}=await get(url,fetcher);return classifyPage(url,res,body)}
   catch(e){return {url,status:0,result:'FAIL',reasons:['NETWORK_OR_TIMEOUT'],errorName:e?.name||'Error'}}
  }));
  results.push(...batch);
 }
 const counts={passed:results.filter(x=>x.result==='PASS').length,
  failed:results.filter(x=>x.result==='FAIL').length};
 return {version:1,kind:'PUBLIC_HTTP_INDEXABILITY_ONLY_NOT_GOOGLE_INDEX_STATUS',
  generatedAt:new Date().toISOString(),origin,checked:results.length,...counts,
  sampledSitemaps:sources,warnings,results};
}
export function reportMarkdown(report){
 const rows=report.results.map(x=>
  '| '+new URL(x.url).pathname.replaceAll('|','%7C')+' | '+x.status+' | '+x.result+' | '+(x.reasons||[]).join(', ')+' |');
 return [
 '# NoonDealsNow public indexability sample',
 '',
 '**This is HTTP/canonical/noindex evidence only. It cannot say which URLs Google has indexed.**',
 '',
 'Checked '+report.checked+' pages; passed '+report.passed+'; failed '+report.failed+'.',
 'Sampled sitemap files: '+report.sampledSitemaps.length+'.',
 '',
 '| URL path | HTTP | Technical status | Issues |',
 '|---|---:|---|---|',...rows,'',
 '## Sitemap warnings',
 ...(report.warnings.length?report.warnings.map(w=>'- '+w):['- None']),
 '',
 'For Google index status use Google Search Console URL Inspection / Page Indexing export.',
 ].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await auditIndexability().catch(e=>({version:1,origin:ORIGIN,
  checked:0,passed:0,failed:1,sampledSitemaps:[],warnings:['AUDIT_EXCEPTION_'+String(e?.message||e)],results:[]}));
 const summary=reportMarkdown(report);
 console.log(summary);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
 if(process.env.GITHUB_WORKSPACE)writeFileSync('ndn-indexability-sample.json',JSON.stringify(report,null,2));
 // A quota outage or missing public XML is a real technical failure, but
 // empty archival shards are logged rather than deleting any article URL.
 if(report.failed||report.warnings.some(x=>/^(AI_V2_SOURCE_|COMMERCIAL_SOURCE_|HISTORICAL_SOURCE_|AUDIT_EXCEPTION_)/.test(x)))
  process.exitCode=1;
}
