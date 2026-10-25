import test from 'node:test';
import assert from 'node:assert/strict';
import {existingDestinationR2Binding,recordPublishedR2ArticleInBlogFeed} from '../r2-remote-existing-bucket.js';
import {emergencyPublicR2Response} from '../r2-emergency-readonly.js';
import {publicEdgeTtlSeconds} from '../r2-public-cache-policy.js';

test('after an approved published R2 article PUT, the real-time blog feed is written in SAME bucket',async()=>{
  const old=globalThis.fetch,memory=new Map(),keys=[];
  globalThis.fetch=async (url,init)=>{
    let path=decodeURIComponent(new URL(url).pathname).replace(/^\/nooncoupons-content-v2\//,'');
    keys.push({key:path,method:init.method});
    if(init.method==='GET'){
      if(!memory.has(path))return new Response('<Error>NoSuchKey</Error>',{status:404});
      return new Response(memory.get(path),{status:200,headers:{'content-type':'application/json','etag':'"prev1"'}});
    }
    if(init.method==='PUT'){
      memory.set(path,new TextDecoder().decode(init.body));
      return new Response(null,{status:200,headers:{etag:'"new1"'}});
    }
    throw Error('unexpected mock request');
  };
  const env={REMOTE_EXISTING_R2_ENABLED:'true',PUBLICATION_FEED_ENABLED:'true',NOON_RESCUE_R2_ACCESS_KEY_ID:'FAKE_TEST_ID',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'FAKE_TEST_SECRET'};
  try{
    const r2=existingDestinationR2Binding(env);
    const slug='متابعة-الخصم-في-نون-السعودية-اليوم';
    const rec=await r2.put('articles/'+slug+'.html','<h1>خبرة التسوق في نون السعودية</h1>',{customMetadata:{status:'published',c:'SA',t:encodeURIComponent('مراجعة سلة نون السعودية اليوم'),q:'100',at:'2026-10-25T04:31:10Z'},httpMetadata:{contentType:'text/html'}});
    assert.equal(rec.key,'articles/'+slug+'.html');
    const live=JSON.parse(memory.get('blog/latest-live-v1.json'));
    assert.equal(live.articles[0].slug,slug);
    assert.equal(live.articles[0].country,'SA');
    assert.equal(live.articles[0].quality,100);
    assert.equal(live.articles[0].title,'مراجعة سلة نون السعودية اليوم');
    assert.deepEqual(keys.map(x=>x.method),['PUT','GET','PUT']);
  }finally{globalThis.fetch=old}
});
test('the journal does not overwrite existing article on conditional 412 (or journal drafts)',async()=>{
  let called=0,old=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    called++;
    return new Response(null,{status:412});
  };
  try{
    const env={PUBLICATION_FEED_ENABLED:'true',NOON_RESCUE_R2_ACCESS_KEY_ID:'TEST',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'TEST'};
    const binding=existingDestinationR2Binding(env);
    const result=await binding.put('articles/already-present.html','x',{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{status:'published',c:'SA'}});
    assert.equal(result,null);
    assert.equal(called,1,'cannot update blog feed for a refused duplicate write');
    assert.equal((await recordPublishedR2ArticleInBlogFeed(env,'articles/draft.html',{status:'draft'})).skipped,'not_published_article');
  }finally{globalThis.fetch=old}
});
test('feed is searchable on the public blog with no new routes, no new resources',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async (url,init)=>{
    const path=decodeURIComponent(new URL(url).pathname);
    if(path.endsWith('/blog/latest-live-v1.json'))return new Response(JSON.stringify({articles:[
      {slug:'published-noon-recent-article',title:'أحدث مقال في نون السعودية',country:'SA',status:'published',createdAt:'2026-10-25T05:10:10Z',coupon:'NOV170'}
    ]}),{status:200,headers:{'content-type':'application/json'}});
    if(path.endsWith('/bulk/latest.json'))return new Response('{"articles":[]}',{status:200,headers:{'content-type':'application/json'}});
    throw Error('unknown R2 mock: '+path);
  };
  const env={R2_RESCUE_READONLY_ENABLED:'true',NOON_RESCUE_R2_ACCESS_KEY_ID:'TEST',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'TEST'};
  try{
    const r=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog/saudi'),env);
    assert.equal(r.status,200);
    const body=await r.text();
    assert.match(body,/published-noon-recent-article/);
    assert.match(body,/أحدث مقال في نون السعودية/);
    assert.match(body,/NOV170/);
  }finally{globalThis.fetch=old}
});
test('blog homepage caches no longer hide latest publication for five minutes',()=>{
  assert.equal(publicEdgeTtlSeconds('/blog'),30);
  assert.equal(publicEdgeTtlSeconds('/blog/saudi'),30);
  assert.equal(publicEdgeTtlSeconds('/blog/uae'),30);
  assert.equal(publicEdgeTtlSeconds('/sitemap.xml'),900);
  assert.equal(publicEdgeTtlSeconds('/articles/verified-old-article'),600);
});
