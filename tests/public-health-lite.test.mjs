import test from 'node:test';
import assert from 'node:assert/strict';
import {englishCanaryHealth} from '../english-canary.js';
import commerce from '../commerce-entry.js';

function envWithBoundedHealth({recordsTotal=84}={}){
  const keys=[],doPaths=[];
  const env={
    SITE_ORIGIN:'https://noondealsnow.com',BULK_DAILY_TARGET:'60',
    GENERATOR_CONTROL:{
      idFromName:()=>({name:'primary'}),
      get:()=>({fetch:async url=>{
        const path=new URL(url).pathname;doPaths.push(path);
        if(path==='/status')return new Response(JSON.stringify({backend:'do-v2',bulkDay:new Date().toISOString().slice(0,10),bulkPublishedTotal:120,
          bulkPublishedToday:7,bulkDailyTarget:60,bulkLastSlug:'last-good-article'}));
        if(path==='/english-scheduler')return new Response(JSON.stringify({status:'complete',
          recordsTotal,completedAt:'2026-11-19T15:00:00Z'}));
        return new Response(null,{status:404});
      }})
    },
    CONTENT_FINAL:{get:async key=>{
      keys.push(key);
      if(key==='english-canary/public-recent-v1.json')
        return {json:async()=>({version:1,articles:[{slug:'en-test-light',country:'AE',coupon:'NOV188',intent:'buyer'}]})};
      if(key==='_ops/article-count.json')
        return {json:async()=>({count:2255,countedAt:'2026-11-18T14:00:00Z',complete:false})};
      return null;
    }}
  };
  return {env,keys,doPaths};
}

test('public English health uses bounded scheduler and recent records, never giant authoring state',async()=>{
  const {env,keys}=envWithBoundedHealth();
  const health=await englishCanaryHealth(env,{light:true});
  assert.equal(health.ok,true);
  assert.equal(health.fullStateRead,false);
  assert.equal(health.controlled.recordsTotal,84);
  assert.equal(health.controlled.publishedToday,null);
  assert.equal(health.controlled.records.length,1);
  assert.ok(!keys.includes('english-canary/state.json'));
  assert.ok(!keys.includes('english-canary/publish-journal-v1.json'));
});

test('public content stats use bounded DO status and mark unavailable dimensions as unknown',async()=>{
  const {env,keys,doPaths}=envWithBoundedHealth();
  const response=await commerce.fetch(new Request('https://noondealsnow.com/api/content-stats'),env,{});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.ok,true);
  assert.equal(result.arabic,120);
  assert.equal(result.english,84);
  assert.equal(result.liveTrackedPublished,204);
  assert.equal(result.health.source,'durable-object-status-lite');
  assert.equal(result.publishedTodaySaudiWorkersAI,null);
  assert.equal(result.englishByCountry.AE,null);
  assert.ok(doPaths.includes('/status'));
  assert.ok(doPaths.includes('/english-scheduler'));
  for(const forbidden of ['english-canary/state.json','english-canary/publish-journal-v1.json',
    '_ops/ai-v2-publication-ledger-v1.json'])assert.ok(!keys.includes(forbidden));
});

test('public health leaves missing scheduler counts null instead of inventing zero',async()=>{
  const {env}=envWithBoundedHealth({recordsTotal:null});
  const health=await englishCanaryHealth(env,{light:true});
  assert.equal(health.countAvailable,false);
  assert.equal(health.controlled.published,null);
});
