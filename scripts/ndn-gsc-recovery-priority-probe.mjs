// Read-only HTTP audit for previously impression-bearing URLs in the owner's
// 2026-11-23 Search Console export. NEVER treats a GSC impression as proof
// of indexing now, nor a synthetic request as a real Googlebot crawl.
// Stable limited list of public URLs from the private source export; no keys.
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {classifyPage} from './ndn-article-indexability-sample.mjs';
const base='https://noondealsnow.com';
export const priorities=[
 ['/',281,'commercial'],
 ['/saudi',390,'commercial'],
 ['/coupons',102,'commercial'],
 ['/saudi/categories',47,'commercial'],
 ['/saudi/category/mobiles',62,'commercial'],
 ['/saudi/category/computers',30,'commercial'],
 ['/uae',26,'commercial'],
 ['/en/uae',29,'commercial'],
 ['/en/uae/noon-coupon-code',48,'commercial'],
 ['/saudi-arabia/noon-coupon-code',26,'commercial'],
 ['/guide/how-to-use-noon-coupon',26,'commercial'],
 ['/guide/noon-yellow-friday',23,'commercial'],
 ['/en/uae/product/iphone-18-pro-max',62,'editorial'],
 ['/en/uae/category/home-kitchen',71,'editorial'],
 ['/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price',162,'editorial'],
 ['/en/articles/en-noon-cart-coupon-uae-grocery-checkout-guide',90,'editorial'],
 ['/en/articles/en-iphone-duo-noon-abu-dhabi-deals',36,'editorial'],
 ['/en/articles/en-iphone-18-pro-max-noon-sharjah-deals',17,'editorial'],
 ['/en/articles/en-iphone-18-pro-max-noon-dubai-price',13,'editorial'],
 ['/en/articles/en-iphone-duo-noon-sharjah-buying-guide',12,'editorial'],
 ['/en/articles/en-noon-coupon-code-uae-grocery-checkout-checklist',44,'editorial'],
 ['/en/articles/en-samsung-galaxy-s26-ultra-noon-dubai-deals',25,'editorial'],
 ['/en/articles/en-iphone-duo-noon-abu-dhabi-seller-guide',7,'editorial'],
 ['/en/articles/en-iphone-18-pro-noon-dubai-coupon-code',6,'editorial'],
 ['/en/articles/en-iphone-duo-noon-sharjah-deals',4,'editorial'],
 ['/faq',2,'commercial']
];
const agent='NoonDealsNow-GSC-Priority-Recovery-Diagnostic/1.0';
export async function checkOne(path,impressions,type,fetcher=fetch){
 const url=base+path;
 try{
  const response=await fetcher(url,{
   headers:{'user-agent':agent,'accept':'text/html,*/*;q=0.7'},
   redirect:'follow',signal:AbortSignal.timeout(16000)});
  const html=await response.text();
  if(html.length>3000000)throw Error('OVERSIZED_HTML');
  // Some legacy landing URLs intentionally point at a single
  // canonical coupon hub. Flag for editorial review, do not rewrite.
  const result=classifyPage(url,response,html);
  // The older English coupon URL intentionally resolves SEO signals to the
  // single canonical UAE coupon hub. This is not a new indexing defect.
  const expectedLegacyUaeAlias=path==='/en/uae/noon-coupon-code'&&
   response.status===200&&result.noindex===true&&
   result.canonical===base+'/uae/noon-coupon-code';
  return {...result,
   result:expectedLegacyUaeAlias?'EXPECTED_CANONICAL_ALIAS':result.result,
   reasons:expectedLegacyUaeAlias?[]:result.reasons,
   impressions,type};
 }catch(e){
  return {url,status:0,result:'FAIL',reasons:['NETWORK_OR_TIMEOUT'],
    errorName:String(e?.name||'Error').slice(0,30),impressions,type};
 }
}
export async function checkAll(fetcher=fetch){
 const results=[];
 for(let i=0;i<priorities.length;i+=3){
  const batch=await Promise.all(priorities.slice(i,i+3).map(([path,impressions,type])=>
   checkOne(path,impressions,type,fetcher)));
  results.push(...batch);
 }
 return {version:1,source:'OWNER_GSC_EXPORT_2026_11_23',
  caveat:'URL technical health only; not Google indexed/not indexed status',
  generatedAt:new Date().toISOString(),checked:results.length,
  passed:results.filter(x=>x.result==='PASS'||x.result==='EXPECTED_CANONICAL_ALIAS').length,
  failed:results.filter(x=>x.result==='FAIL').length,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const x=await checkAll();
 const lines=['# NoonDealsNow: GSC impression-bearing URL HTTP/canonical audit',
  'This is **not** a verified Googlebot crawl or URL Inspection result.',
  'Checked: '+x.checked+'; passed: '+x.passed+'; flagged: '+x.failed,
  '| Page | GSC impressions | HTTP | Technical result | Reason | Canonical |',
  '|---|---:|---:|---|---|---|',
  ...x.results.map(r=>'| '+new URL(r.url).pathname.replaceAll('|','%7C')+
   ' | '+r.impressions+' | '+r.status+' | '+r.result+
   ' | '+(r.reasons||[]).join(', ')+' | '+(r.canonical||'')+' |')];
 const output=lines.join('\n');
 console.log(output);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,output+'\n');
 if(x.failed)process.exitCode=1;
}
