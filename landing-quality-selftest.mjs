import crypto from 'node:crypto';
import {commercePaths} from './commerce-taxonomy.js';
import {commerceLanding} from './commerce-pages-v2.js';
import {enhanceLandingPage,LANDING_CONTENT_V3} from './landing-content-v3.js';
import {enhanceSpecialtyLanding,LANDING_SPECIALTY_V4} from './landing-specialty-v4.js';

const origin='https://noondealsnow.com';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths=commercePaths().filter(p=>/^\/(saudi|uae)\/(categories|category\/|brand\/|model\/|compare\/)/.test(p));
if(paths.length<276)throw new Error(`route count regressed: ${paths.length}`);
const hashes=new Set(),seeds=new Set(),focusHeaders=new Set();
let min=Infinity,max=0,minChars=Infinity,minImages=Infinity,specialized=0;
for(const path of paths){
  // Exercise the actual commerce page first. A bare mock has no Organization,
  // CollectionPage or BreadcrumbList and gives misleading structured-data failures.
  const base=await commerceLanding(path,origin,{});
  if(!base?.ok)throw new Error(`missing commerce page ${path}`);
  let res=await enhanceLandingPage(path,origin,base,{});
  res=await enhanceSpecialtyLanding(path,origin,res);
  if(res.status!==200)throw new Error(`bad status ${path}`);
  const wc=Number(res.headers.get('x-landing-word-count')||0),cc=Number(res.headers.get('x-landing-char-count')||0),imgs=Number(res.headers.get('x-landing-images')||0);
  const seed=res.headers.get('x-landing-unique-seed');
  const focus=res.headers.get('x-landing-semantic-focus')||'';
  if(wc<LANDING_CONTENT_V3.minWords||wc>2500)throw new Error(`focused guide word range ${path}: ${wc}`);
  if(cc<LANDING_CONTENT_V3.minChars)throw new Error(`char floor ${path}: ${cc}`);
  if(imgs<LANDING_CONTENT_V3.imagesPerLanding)throw new Error(`image floor ${path}: ${imgs}`);
  if(!seed)throw new Error(`missing seed ${path}`);
  if(res.headers.get('x-landing-specialty')!=='v4')throw new Error(`missing specialty header ${path}`);
  if(!focus)throw new Error(`missing semantic focus ${path}`);
  const html=await res.text();
  for(const needle of ['landing-depth-v3','landing-specialty-v4','منهجية التحرير والتحقق','ملخص سريع قبل الشراء','landing-visuals','landing-definitions','landing-keywords','landing-coupon-guide','advanced-guide','long-guide-section','<svg','كيف تختلف هذه الصفحة عن الصفحات الأخرى؟','الشفافية والمصادر قبل اتخاذ القرار'])if(!html.includes(needle))throw new Error(`missing ${needle} ${path}`);
  const ldJson=[...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(match=>{const data=JSON.parse(match[1]);return data['@graph']||[data]});
  for(const type of ['Organization','WebSite','CollectionPage','BreadcrumbList','FAQPage']){
    if(ldJson.filter(item=>item['@type']===type).length!==1)throw new Error(`duplicate or missing ${type} ${path}`);
  }
  const page=ldJson.find(item=>item['@type']==='CollectionPage');
  const breadcrumb=ldJson.find(item=>item['@type']==='BreadcrumbList');
  const faq=ldJson.find(item=>item['@type']==='FAQPage');
  if(page.url!==origin+path||page.breadcrumb?.['@id']!==breadcrumb['@id'])throw new Error(`canonical schema mismatch ${path}`);
  if(breadcrumb.itemListElement?.at(-1)?.item!==origin+path)throw new Error(`breadcrumb leaf mismatch ${path}`);
  if((html.match(/rel="canonical"/g)||[]).length!==1||!html.includes(`href="${origin+path}"`))throw new Error(`canonical HTML mismatch ${path}`);
  if(!Array.isArray(faq.mainEntity)||faq.mainEntity.length<4)throw new Error(`empty FAQ ${path}`);
  for(const item of faq.mainEntity){
    if(!html.includes(`<summary>${esc(item.name)}</summary>`))throw new Error(`invisible FAQ question ${path}`);
    if(!html.includes(`<p>${esc(item.acceptedAnswer?.text)}</p>`))throw new Error(`FAQ answer text differs from JSON-LD ${path}`);
  }
  if(html.includes('specialty-focus'))specialized++;
  const h=crypto.createHash('sha256').update(html).digest('hex');
  hashes.add(h);seeds.add(seed);focusHeaders.add(focus);min=Math.min(min,wc);max=Math.max(max,wc);minChars=Math.min(minChars,cc);minImages=Math.min(minImages,imgs);
}
if(hashes.size!==paths.length)throw new Error(`duplicate rendered pages ${hashes.size}/${paths.length}`);
if(seeds.size!==paths.length)throw new Error(`duplicate route seeds ${seeds.size}/${paths.length}`);
if(specialized!==paths.length)throw new Error(`unspecialized routes ${specialized}/${paths.length}`);
console.log(JSON.stringify({ok:true,routes:paths.length,uniqueRenders:hashes.size,uniqueSeeds:seeds.size,specializedRoutes:specialized,semanticFocusVariants:focusHeaders.size,minWords:min,maxWords:max,minChars,imagesPerLanding:minImages,definitions:true,keywordClusters:true,couponGuide:true,contentVersion:LANDING_CONTENT_V3.version,specialtyVersion:LANDING_SPECIALTY_V4.version,schema:LANDING_CONTENT_V3.schema,seo:LANDING_CONTENT_V3.seo,geoAeo:LANDING_CONTENT_V3.geoAeo,eeat:LANDING_CONTENT_V3.eeat,semanticDifferentiation:LANDING_SPECIALTY_V4.semanticDifferentiation},null,2));
