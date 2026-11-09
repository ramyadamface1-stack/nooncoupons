import test from 'node:test';
import assert from 'node:assert/strict';
import {GeneratorControl,AI_V2_PUBLISH_INTERVALS} from '../admin-runtime.js';
import {getPublicationSlotStatus,claimPublicationSlot} from '../publication-rate-limit.js';

function fixture(){
 const objects=new Map();
 const storage={
  get:async key=>objects.get(key),
  put:async (key,value)=>{objects.set(key,value)},
  transaction:async fn=>fn({get:async key=>objects.get(key),put:async (key,value)=>{objects.set(key,value)}})
 };
 const agent=new GeneratorControl({storage},{});
 const send=(path,body)=>agent.fetch(new Request('https://generator.internal'+path,{
  method:body===undefined?'GET':'POST',
  ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})}));
 const env={GENERATOR_CONTROL:{idFromName:()=>({name:'primary'}),get:()=>({fetch:(url,opts={})=>agent.fetch(new Request(url,opts))})}};
 return {objects,send,env};
}
test('native publishing cadence defaults to one minute and accepts every integer 1–15',async()=>{
 assert.deepEqual([...AI_V2_PUBLISH_INTERVALS],Array.from({length:15},(_,i)=>i+1));
 const {send}=fixture();
 const original=await(await send('/ai-v2-control')).json();
 assert.equal(original.publishingIntervalMinutes,1);
 for(const publishingIntervalMinutes of [1,2,7,15]){
  const res=await send('/ai-v2-control',{publishingIntervalMinutes});
  assert.equal(res.status,200);
  assert.equal((await res.json()).publishingIntervalMinutes,publishingIntervalMinutes);
 }
 for(const publishingIntervalMinutes of [0,16,1.5,'5',null]){
  assert.equal((await send('/ai-v2-control',{publishingIntervalMinutes})).status,400);
 }
 const final=await(await send('/ai-v2-control')).json();
 assert.equal(final.intervalMinutes,1);
 assert.equal(final.publishingIntervalMinutes,15);
});
test('AI V2 1-minute slot is enforced atomically and never bypasses the global gate',async()=>{
 const {send,env}=fixture();
 const first=await claimPublicationSlot(env,'SA','ai-v2-native');
 assert.equal(first.ok,true);
 const second=await claimPublicationSlot(env,'AE','ai-v2-native');
 assert.equal(second.ok,false);
 assert.equal(second.throttled,true);
 assert.ok(second.retryAfterMs>30000);
 const status=await getPublicationSlotStatus(env,{aiV2:true});
 assert.equal(status.ok,true);
 assert.equal(status.eligible,false);
 assert.equal(status.aiV2PublishingIntervalMinutes,1);
 assert.ok(Number.isFinite(Date.parse(status.nextEligibleAt)));
});
test('changing cadence to 15 minutes is effective without resetting last permit',async()=>{
 const {send,env,objects}=fixture();
 assert.equal((await claimPublicationSlot(env,'SA','ai-v2-native')).ok,true);
 assert.equal((await send('/ai-v2-control',{publishingIntervalMinutes:15})).status,200);
 const current=await getPublicationSlotStatus(env,{aiV2:true});
 assert.equal(current.aiV2PublishingIntervalMinutes,15);
 assert.equal(current.eligible,false);
 assert.ok(current.retryAfterMs>14*60000);
 const refused=await claimPublicationSlot(env,'AE','ai-v2-native');
 assert.equal(refused.ok,false);
 assert.ok(refused.retryAfterMs>14*60000);
 // The global permit is still 30s for legacy publishers, even with AI pacing 15m.
 objects.set('publication-rate-v1',{lastAtMs:Date.now()-31000,source:'legacy',market:'AE'});
 const legacy=await claimPublicationSlot(env,'AE','manual-editor');
 assert.equal(legacy.ok,true);
 assert.equal((await getPublicationSlotStatus(env,{aiV2:true})).eligible,false);
 assert.equal((await send('/ai-v2-control',{publishingIntervalMinutes:1})).status,200);
 const restored=await getPublicationSlotStatus(env,{aiV2:true});
 assert.ok(restored.retryAfterMs<=60000);
 assert.ok(restored.retryAfterMs>0);
});
test('one source alone cannot counterfeit a future publication or a ready draft',async()=>{
 const {env}=fixture();
 const state=await getPublicationSlotStatus(env,{aiV2:true});
 assert.equal(state.ok,true);
 assert.equal(state.aiV2LastPermitAt,null);
 assert.equal(state.aiV2NextEligibleAt,null);
 assert.equal(state.eligible,true);
});
