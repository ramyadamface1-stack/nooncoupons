import test from 'node:test';
import assert from 'node:assert/strict';
import { emergencyPublicR2Response } from '../r2-emergency-readonly.js';

const EN_SLUG='en-test-buying-noon-uae-guide';
const AR_SLUG='native-test-noon-saudi-shopping-guide';
const nativeArticle='<h1>اختبار استعادة كود خصم نون السعودية</h1><p>Verified useful content for archive test.</p><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article","headline":"Source"},{"@type":"FAQPage","mainEntity":[]}]}</script>';
const nextDate=new Date('2026-10-17T13:00:00.000Z');
const objects=new Map([
  ['articles/'+AR_SLUG+'.html',{body:nativeArticle,customMetadata:{status:'published',c:'SA',at:'2026-10-17T13:00:00.000Z'},httpMetadata:{contentType:'text/html'},uploaded:nextDate}],
  ['bulk/latest.json',{body:JSON.stringify({articles:Array.from({length:15},(_,i)=>({slug:'native-test-'+i,country:'SA',status:'published',indexable:true,title:'Noon Saudi Test '+i}))}),customMetadata:{},httpMetadata:{contentType:'application/json'},uploaded:nextDate}],
  ['seo-rescue/index.json',{body:JSON.stringify({version:1,count:1500,segments:[{n:0,key:'seo-rescue/articles-0.json',count:1500}]}),customMetadata:{},httpMetadata:{contentType:'application/json'},uploaded:nextDate}],
  ['seo-rescue/articles-0.json',{body:JSON.stringify({version:1,articles:[{slug:AR_SLUG,country:'SA',lastmod:'2026-10-17'}]}),customMetadata:{},httpMetadata:{contentType:'application/json'},uploaded:nextDate}]
]);
function object(key){const o=objects.get(key);return o?{...o,text:async()=>o.body}:null}
const calls={get:[],list:[]};
const nativeEnv={
  R2_RESCUE_READONLY_ENABLED:'true',
  CONTENT_FINAL:{
    async get(k){calls.get.push(k);return object(k)},
    async list(options){
      calls.list.push(options);
      return {objects:[{key:'articles/'+AR_SLUG+'.html'}],truncated:false,cursor:''}
    }
  }
};
const page=(path)=>new Request('https://noondealsnow.com'+path,{method:'GET'});

test('destination Worker serves a published article from native R2 with ZERO S3 keys',async()=>{
  const res=await emergencyPublicR2Response(page('/articles/'+AR_SLUG),nativeEnv);
  const html=await res.text();
  assert.equal(res.status,200);
  assert.match(html,/<h1>اختبار استعادة كود/);
  assert.match(html,/og:image/);
  assert.match(html,/<img/);
  assert.match(html,/FAQPage/);
  assert.ok(!html.includes('"headline":"Source"'),'duplicate Article source JSON-LD stripped');
  assert.ok(calls.get.includes('articles/'+AR_SLUG+'.html'));
});
test('destination archive uses native R2 .list cursor instead of signed S3 LIST',async()=>{
  const res=await emergencyPublicR2Response(page('/blog/archive/all'),nativeEnv);
  const html=await res.text();
  assert.equal(res.status,200);
  assert.match(html,/native-test-noon-saudi-shopping-guide/);
  assert.equal(calls.list.at(-1).prefix,'articles/');
  assert.equal(calls.list.at(-1).limit,15);
});
test('destination sitemap reads native JSON manifests and returns XML',async()=>{
  const res=await emergencyPublicR2Response(page('/sitemap-rescue-articles-0.xml'),nativeEnv);
  const xml=await res.text();
  assert.equal(res.status,200);
  assert.match(xml,/<urlset/);
  assert.match(xml,/native-test-noon-saudi-shopping-guide/);
  assert.match(res.headers.get('content-type'),/xml/);
});
test('destination blog lists 15 links and never needs S3 credentials',async()=>{
  const res=await emergencyPublicR2Response(page('/blog'),nativeEnv);
  const html=await res.text();
  assert.equal(res.status,200);
  assert.equal((html.match(/<article class="card"/g)||[]).length,15);
});
test('old account retains secret-backed cross-account signed R2 GET (no native binding)',async()=>{
  const original=globalThis.fetch;
  const hit=[];
  globalThis.fetch=async(input,init)=>{
    hit.push({url:String(input),hasSignature:/AWS4-HMAC-SHA256/.test(init?.headers?.authorization||'')});
    return new Response('<h1>Old Worker Signed Fallback Works</h1><p>Restored</p>',{
      status:200,headers:{'Content-Type':'text/html','x-amz-meta-status':'published','x-amz-meta-c':'SA'}
    });
  };
  try{
    const env={
      R2_RESCUE_READONLY_ENABLED:'true',
      NOON_RESCUE_R2_ACCESS_KEY_ID:'TEST_ACCESS_KEY_ONLY',
      NOON_RESCUE_R2_SECRET_ACCESS_KEY:'TEST_SECRET_KEY_ONLY'
    };
    const res=await emergencyPublicR2Response(page('/articles/old-signed-rescue-sample'),env);
    const html=await res.text();
    assert.equal(res.status,200);
    assert.match(html,/Old Worker Signed Fallback Works/);
    assert.equal(hit.length,1);
    assert.equal(hit[0].hasSignature,true);
    assert.match(hit[0].url,/e4c35f8a50a7b2e4cfb9d6c534962603\.r2\.cloudflarestorage\.com/);
  }finally{globalThis.fetch=original}
});
test('all admin POST and R2 private keys remain inaccessible through rescue GET',async()=>{
  const res=await emergencyPublicR2Response(new Request('https://noondealsnow.com/api/admin/export',{method:'GET'}),nativeEnv);
  assert.equal(res,null);
  const put=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog',{method:'POST'}),nativeEnv);
  assert.equal(put,null);
});
