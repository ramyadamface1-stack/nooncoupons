import crypto from 'node:crypto';
import {commercePaths} from './commerce-taxonomy.js';
import {enhanceLandingPage,LANDING_CONTENT_V3} from './landing-content-v3.js';
import {enhanceSpecialtyLanding,LANDING_SPECIALTY_V4} from './landing-specialty-v4.js';

const origin='https://nooncoupons.ramychatgptgcoupons.workers.dev';
const base=()=>new Response('<!doctype html><html lang="ar" dir="rtl"><head><title>base</title></head><body><main><h1>base</h1></main></body></html>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
const paths=commercePaths();
if(paths.length<276)throw new Error(`route count regressed: ${paths.length}`);
const hashes=new Set(),seeds=new Set(),focusHeaders=new Set();
let min=Infinity,max=0,specialized=0;
for(const path of paths){
  let res=await enhanceLandingPage(path,origin,base());
  res=await enhanceSpecialtyLanding(path,origin,res);
  if(res.status!==200)throw new Error(`bad status ${path}`);
  const wc=Number(res.headers.get('x-landing-word-count')||0),cc=Number(res.headers.get('x-landing-char-count')||0),imgs=Number(res.headers.get('x-landing-images')||0);
  const seed=res.headers.get('x-landing-unique-seed');
  const focus=res.headers.get('x-landing-semantic-focus')||'';
  if(wc<5000)throw new Error(`word floor ${path}: ${wc}`);if(cc<5000)throw new Error(`char floor ${path}: ${cc}`);if(imgs<3)throw new Error(`image floor ${path}: ${imgs}`);
  if(!seed)throw new Error(`missing seed ${path}`);
  if(res.headers.get('x-landing-specialty')!=='v4')throw new Error(`missing specialty header ${path}`);
  if(!focus)throw new Error(`missing semantic focus ${path}`);
  const html=await res.text();
  for(const needle of ['landing-depth-v3','landing-specialty-v4','FAQPage','WebPage','Organization','منهجية التحرير والتحقق','ملخص الكيانات والنية','landing-visuals','landing-definitions','landing-keywords','landing-coupon-guide','<svg','كيف تختلف هذه الصفحة عن الصفحات الأخرى؟','الشفافية والمصادر قبل اتخاذ القرار'])if(!html.includes(needle))throw new Error(`missing ${needle} ${path}`);
  if(html.includes('specialty-focus'))specialized++;
  const h=crypto.createHash('sha256').update(html).digest('hex');
  hashes.add(h);seeds.add(seed);focusHeaders.add(focus);min=Math.min(min,wc);max=Math.max(max,wc);
}
if(hashes.size!==paths.length)throw new Error(`duplicate rendered pages ${hashes.size}/${paths.length}`);
if(seeds.size!==paths.length)throw new Error(`duplicate route seeds ${seeds.size}/${paths.length}`);
if(specialized!==paths.length)throw new Error(`unspecialized routes ${specialized}/${paths.length}`);
console.log(JSON.stringify({ok:true,routes:paths.length,uniqueRenders:hashes.size,uniqueSeeds:seeds.size,specializedRoutes:specialized,semanticFocusVariants:focusHeaders.size,minWords:min,maxWords:max,contentVersion:LANDING_CONTENT_V3.version,specialtyVersion:LANDING_SPECIALTY_V4.version,schema:LANDING_CONTENT_V3.schema,seo:LANDING_CONTENT_V3.seo,geoAeo:LANDING_CONTENT_V3.geoAeo,eeat:LANDING_CONTENT_V3.eeat,semanticDifferentiation:LANDING_SPECIALTY_V4.semanticDifferentiation},null,2));
