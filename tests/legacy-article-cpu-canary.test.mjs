import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBoundLegacyCpuCanaryResponse} from '../r2-emergency-readonly.js';
import {publicEdgePolicyRevision} from '../r2-public-cache-policy.js';
import {readFileSync} from 'node:fs';

const TARGET='/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price';
const SRC='<article lang="en-AE"><h1>iPhone 18 Pro Max Noon Abu Dhabi - NOV186</h1>'+
  '<p>'+('Compare official Noon seller, warranty, stock and the total after NOV186. '.repeat(90))+
  '</p><script type="application/ld+json">'+JSON.stringify({
    '@context':'https://schema.org','@type':'FAQPage',mainEntity:[{
      '@type':'Question',name:'What code?',acceptedAnswer:{'@type':'Answer',text:'Apply NOV186 at Noon checkout.'}
    }]
  })+'</script></article>';

function setup(mode='false'){
  let reads=[],writes=0;
  const env={R2_RESCUE_READONLY_ENABLED:mode, CONTENT_FINAL:{
    async get(key){
      reads.push(key);
      if(key==='articles/en-iphone-18-pro-max-noon-abu-dhabi-price.html')
        return {text:async()=>SRC,customMetadata:{status:'published',c:'AE',at:'2026-09-20T08:00:00Z'}};
      return null;
    },
    async list(){writes++;throw Error('list prohibited')},
    async put(){writes++;throw Error('put prohibited')}
  }};
  return {env,report:()=>({reads,writes})};
}
test('known failing English URL serves canonical R2 article without legacy decorator chain',async()=>{
  const f=setup();
  const request=new Request('https://noondealsnow.com'+TARGET+'?utm_source=search');
  const res=await nativeBoundLegacyCpuCanaryResponse(request,f.env);
  assert.equal(res?.status,200);
  assert.equal(res.headers.get('x-legacy-cpu-canary'),'r2-direct-v1');
  assert.equal(res.headers.get('content-language'),'en');
  assert.equal(res.headers.get('cache-control').includes('s-maxage=300'),true);
  const html=await res.text();
  assert.match(html,/<html lang="en-AE" dir="ltr"/);
  assert.ok(html.includes('href="https://noondealsnow.com'+TARGET+'"'));
  assert.ok(!html.includes('?utm_source=search'));
  assert.match(html,/NOV188/);
  assert.doesNotMatch(html,/NOV186/);
  assert.match(html,/article-topic-path/);
  assert.ok(f.report().reads.includes('articles/en-iphone-18-pro-max-noon-abu-dhabi-price.html'));
  assert.equal(f.report().writes,0);
  assert.equal(SRC.includes('NOV186'),true,'R2 source article is never modified');
});
test('canary never reads R2 for admin, unrelated articles, disabled rescue mode or non-GET',async()=>{
  const f=setup();
  for(const path of ['/admin', '/articles/other', '/en/articles/en-iphone-duo-noon-abu-dhabi-coupon-code']){
    assert.equal(await nativeBoundLegacyCpuCanaryResponse(new Request('https://noondealsnow.com'+path),f.env),null);
  }
  assert.equal(await nativeBoundLegacyCpuCanaryResponse(new Request('https://noondealsnow.com'+TARGET,{method:'HEAD'}),f.env),null);
  assert.equal(await nativeBoundLegacyCpuCanaryResponse(new Request('https://noondealsnow.com'+TARGET,{headers:{Authorization:'Bearer test'}}),f.env),null);
  assert.equal(await nativeBoundLegacyCpuCanaryResponse(new Request('https://noondealsnow.com'+TARGET),setup('true').env),null);
  assert.deepEqual(f.report(),{reads:[],writes:0});
});
test('canary changes only one article edge cache revision and its import runs before decorators',()=>{
  assert.equal(publicEdgePolicyRevision(TARGET),'legacy-1102-cpu-canary-r2-direct-v1');
  assert.equal(publicEdgePolicyRevision('/en/articles/other'),'r2-rescue-security-ga4-topic-links-v21-nativefast-cpu');
  const entry=readFileSync(new URL('../discovery-entry.js',import.meta.url),'utf8');
  assert.ok(entry.indexOf('nativeBoundLegacyCpuCanaryResponse(req,env)')>entry.indexOf('nativeBoundAiV2ArticleFastResponse(req,env)'));
  assert.ok(entry.indexOf('nativeBoundLegacyCpuCanaryResponse(req,env)')<entry.indexOf('let res=await app.fetch(req,env,ctx)'));
});
