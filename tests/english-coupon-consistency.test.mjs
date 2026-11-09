import test from 'node:test';
import assert from 'node:assert/strict';
import {presentMarketCouponText,reconcileSourceCouponJsonLd} from '../rescue-article-conversion.js';
import {serveEnglishCanaryArticle} from '../english-canary.js';
import {readFileSync} from 'node:fs';

const slug='en-iphone-duo-noon-abu-dhabi-coupon-code';
const base='https://noondealsnow.com/en/articles/'+slug;
const faq={'@context':'https://schema.org','@type':'FAQPage',
  mainEntity:[{'@type':'Question',name:'How do I use NOV186?',
    acceptedAnswer:{'@type':'Answer',text:'Apply NOV186 and check your cart.'}}]};
const source='<article lang="en-AE"><h1>Noon UAE buyer guide</h1>'+
  '<p class="direct-answer">Quick answer: copy NOV186 at Noon checkout.</p>'+
  '<button data-copy-code="NOV186" aria-label="Copy Noon coupon NOV186" title="Copy NOV186">Copy NOV186</button>'+
  '<p>Check NOV186 eligibility on Noon before paying.</p>'+
  '<a href="/coupon/nov186">Read coupon NOV186 details</a>'+
  '<script type="application/ld+json" data-schema="faq">'+JSON.stringify(faq)+'</script></article>';
const rec={
  slug,title:'iPhone Duo Noon Abu Dhabi coupon code',metaDescription:'Copy NOV186 in your cart',
  country:'AE',coupon:'NOV188',status:'published',languageSource:'native-intent-v6-canary',
  quality:98,qualityFloor:92,primaryKeyword:'iPhone Duo Noon Abu Dhabi coupon code',
  createdAt:'2026-10-01T00:31:00Z',updatedAt:'2026-10-01T00:31:00Z',
  indexable:true,categoryKey:'mobiles',intent:'coupon',canary:false
};

function fixture(){
  const reads=[];let writes=0;
  const env={SITE_ORIGIN:'https://noondealsnow.com',CONTENT_FINAL:{
    async get(key){
      reads.push(key);
      if(key==='english-canary/state.json')return {json:async()=>({records:[rec],cursor:760001})};
      if(key==='english-canary/publish-journal-v1.json')return null;
      if(key==='articles/'+slug+'.html')return {text:async()=>source,customMetadata:{cp:'NOV188',c:'AE',status:'published'}};
      return null;
    },
    async put(){writes++;throw Error('R2 write forbidden for article display')},
    async list(){writes++;throw Error('R2 list forbidden for article display')}
  }};
  return {env,stats:()=>({reads,writes})};
}

test('explicit canonical article code changes only display content and copy CTA, preserving links and code script',()=>{
  const script='<script>const originalCode="NOV186";</script>';
  const html=presentMarketCouponText(source+script,'AE','NOV188');
  assert.match(html,/Quick answer: copy NOV188/);
  assert.match(html,/data-copy-code="NOV188"/);
  assert.match(html,/aria-label="Copy Noon coupon NOV188"/);
  assert.match(html,/title="Copy NOV188"/);
  assert.match(html,/>Copy NOV188<\/button>/);
  assert.match(html,/href="\/coupon\/nov186"/);
  assert.match(html,/const originalCode="NOV186"/);
  const schemaHtml=reconcileSourceCouponJsonLd(html,'AE','NOV188');
  assert.match(schemaHtml,/How do I use NOV188/);
  assert.match(schemaHtml,/Apply NOV188 and check your cart/);
  assert.doesNotMatch(schemaHtml,/>Copy NOV186<\/button>/);
});

test('an AE page cannot adopt an SA-only selected code; default historic rescue is unchanged',()=>{
  const wrong=presentMarketCouponText('<p>Copy NOV170</p>','AE','NOV170');
  assert.match(wrong,/NOV188/);
  assert.equal(presentMarketCouponText('<p>Copy NOV186</p>','AE'),'<p>Copy NOV188</p>');
  assert.match(presentMarketCouponText('<p>Copy NOV188</p>','SA','NOV170'),/NOV170/);
});

test('published English article renders recorded approved coupon across summary, CTA, FAQ and meta without changing R2',async()=>{
  const f=fixture();
  const res=await serveEnglishCanaryArticle(new Request(base+'?utm_source=test'),f.env);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('x-english-canary'),'v1');
  const html=await res.text();
  assert.match(html,/<dd>NOV188<\/dd>/);
  assert.match(html,/Quick answer: copy NOV188/);
  assert.match(html,/data-copy-code="NOV188"/);
  assert.match(html,/aria-label="Copy Noon coupon NOV188"/);
  assert.match(html,/How do I use NOV188/);
  assert.match(html,/Apply NOV188 and check your cart/);
  assert.match(html,/content="Copy NOV188 in your cart"/);
  const articleSchemaMatch=html.match(/<script type="application\/ld\+json" data-schema="article">([\s\S]*?)<\/script>/);
  assert.ok(articleSchemaMatch,'structured Article schema must exist');
  const nodes=JSON.parse(articleSchemaMatch[1])['@graph'];
  assert.equal(nodes.find(n=>n['@type']==='WebSite').name,'Noon Deals Now');
  for(const kind of ['WebPage','Article']){
    assert.equal(nodes.find(n=>n['@type']===kind).description,'Copy NOV188 in your cart',kind+' description must use recorded code');
  }
  assert.match(html,/href="\/coupon\/nov186"/); // no link rewrites
  assert.match(html,/rel="canonical" href="https:\/\/noondealsnow.com\/en\/articles\/en-iphone-duo-noon-abu-dhabi-coupon-code"/);
  assert.doesNotMatch(html,/>Copy NOV186<\/button>/);
  assert.equal(f.stats().writes,0);
  assert.ok(f.stats().reads.includes('articles/'+slug+'.html'));
  assert.match(source,/NOV186/,'immutable stored source stays intact');
});

test('new alignment is limited to controlled English page render, not Arabic market routing',()=>{
  const src=readFileSync(new URL('../english-canary.js',import.meta.url),'utf8');
  assert.match(src,/const safeCoupon=normalizeMarketCoupon\(rec.coupon,rec.country\),raw=reconcileSourceCouponJsonLd\(/);
  assert.match(src,/presentMarketCouponText\(await o.text\(\),rec.country,safeCoupon\)/);
  assert.match(src,/r2PutArticleCreateOnly\(env/);
});
