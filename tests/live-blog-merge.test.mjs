import test from 'node:test';
import assert from 'node:assert/strict';
import {emergencyPublicR2Response} from '../r2-emergency-readonly.js';

const bulkRows=Array.from({length:30},(_,i)=>({
  slug:'old-sample-'+String(i).padStart(2,'0'),
  title:'Old published '+i,country:i%2?'AE':'SA',status:'published',
  createdAt:'2026-10-18T07:00:00.000Z',quality:100
}));
const recentRows=[
  {slug:'new-noon-saudi-live-today',country:'SA',title:'New Saudi Live Today',status:'published',createdAt:'2026-10-21T10:00:00.000Z',quality:100},
  {slug:'new-noon-uae-live-today',country:'AE',title:'New UAE Live Today',status:'published',createdAt:'2026-10-21T09:00:00.000Z',quality:100},
  {slug:'draft-must-not-show',country:'SA',title:'DRAFT',status:'draft',createdAt:'2026-10-21T12:00:00.000Z'},
  {slug:'old-sample-00',country:'SA',title:'Same URL must deduplicate',status:'published',createdAt:'2026-10-20T12:00:00.000Z'}
];
let controlCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname;
  assert.match(String(url),/e4c35f8a50a7b2e4cfb9d6c534962603\.r2\.cloudflarestorage\.com/);
  assert.match(options.headers.authorization,/AWS4-HMAC-SHA256/);
  if(path.endsWith('/bulk/latest.json'))return new Response(JSON.stringify({articles:bulkRows}),{status:200,headers:{'content-type':'application/json'}});
  return new Response('Not found',{status:404});
};
const env={
  NOON_RESCUE_R2_ACCESS_KEY_ID:'test-key-only',
  NOON_RESCUE_R2_SECRET_ACCESS_KEY:'test-secret-only',
  R2_RESCUE_READONLY_ENABLED:'true',
  CONTENT_FINAL:{async get(key){
    if(key==='bulk/latest.json')return {async text(){return JSON.stringify({articles:bulkRows})}};
    return null;
  }},
  CONTROL:{idFromName(name){assert.equal(name,'primary');return 'primary'},
    get(id){assert.equal(id,'primary');return {async fetch(req){controlCalls++;return new Response(JSON.stringify({articles:recentRows}),{status:200,headers:{'content-type':'application/json'}})}}}
  }
};
async function request(path,current=env){
  return emergencyPublicR2Response(new Request('https://noondealsnow.com'+path),current);
}
test('combined blog shows newest REAL published items first and 15 cards without duplicate/draft',async()=>{
  const res=await request('/blog'),html=await res.text();
  assert.equal(res.status,200);
  assert.equal((html.match(/<article class="card"/g)||[]).length,15);
  assert.ok(html.indexOf('New Saudi Live Today')<html.indexOf('New UAE Live Today'));
  assert.ok(html.indexOf('New UAE Live Today')<html.indexOf('Old published'));
  assert.ok(!html.includes('draft-must-not-show'));
  assert.equal((html.match(/href="\/articles\/old-sample-00"/g)||[]).length,2);
  assert.match(html,/CollectionPage/);
  assert.match(html,/ItemList/);
});
test('country blog pages isolate real newest Saudi vs UAE articles',async()=>{
  const sa=await (await request('/blog/saudi')).text(),ae=await (await request('/blog/uae')).text();
  assert.match(sa,/New Saudi Live Today/);
  assert.ok(!sa.includes('New UAE Live Today'));
  assert.match(ae,/New UAE Live Today/);
  assert.ok(!ae.includes('New Saudi Live Today'));
  assert.equal((sa.match(/<article class="card"/g)||[]).length,15);
  assert.equal((ae.match(/<article class="card"/g)||[]).length,15);
  assert.ok(controlCalls>=2);
});
test('state DO unavailable: old R2 snapshot still displays and no 500',async()=>{
  const fail={...env,CONTROL:{idFromName:()=>1,get:()=>({fetch:async()=>{throw Error('private DO unavailable')}})}};
  const res=await request('/blog',fail),html=await res.text();
  assert.equal(res.status,200);
  assert.equal((html.match(/<article class="card"/g)||[]).length,15);
  assert.ok(!html.includes('New Saudi Live Today'));
});
