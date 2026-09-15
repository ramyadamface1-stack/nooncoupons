import crypto from 'node:crypto';
import {commercePaths} from './commerce-taxonomy.js';
import {enhanceLandingPage,LANDING_CONTENT_V3} from './landing-content-v3.js';

const origin='https://nooncoupons.ramychatgptgcoupons.workers.dev';
const base=()=>new Response('<!doctype html><html lang="ar" dir="rtl"><head><title>base</title></head><body><main><h1>base</h1></main></body></html>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
const paths=commercePaths();
if(paths.length<110)throw new Error(`route count regressed: ${paths.length}`);
const hashes=new Set(),seeds=new Set();
let min=Infinity,max=0;
for(const path of paths){
  const res=await enhanceLandingPage(path,origin,base());
  if(res.status!==200)throw new Error(`bad status ${path}`);
  const wc=Number(res.headers.get('x-landing-word-count')||0);
  const seed=res.headers.get('x-landing-unique-seed');
  if(wc<5000)throw new Error(`word floor ${path}: ${wc}`);
  if(!seed)throw new Error(`missing seed ${path}`);
  const html=await res.text();
  for(const needle of ['landing-depth-v3','FAQPage','WebPage','Organization','منهجية التحرير والتحقق','ملخص الكيانات والنية'])if(!html.includes(needle))throw new Error(`missing ${needle} ${path}`);
  const h=crypto.createHash('sha256').update(html).digest('hex');
  hashes.add(h);seeds.add(seed);min=Math.min(min,wc);max=Math.max(max,wc);
}
if(hashes.size!==paths.length)throw new Error(`duplicate rendered pages ${hashes.size}/${paths.length}`);
if(seeds.size!==paths.length)throw new Error(`duplicate route seeds ${seeds.size}/${paths.length}`);
console.log(JSON.stringify({ok:true,routes:paths.length,uniqueRenders:hashes.size,uniqueSeeds:seeds.size,minWords:min,maxWords:max,contentVersion:LANDING_CONTENT_V3.version,schema:LANDING_CONTENT_V3.schema,seo:LANDING_CONTENT_V3.seo,geoAeo:LANDING_CONTENT_V3.geoAeo,eeat:LANDING_CONTENT_V3.eeat},null,2));
