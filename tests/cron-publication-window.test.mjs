import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedPublicationWait,awaitPublicationWindow} from '../cron-publication-window.js';

test('already eligible publisher starts immediately without a new permit claim',async()=>{
 let calls=0;const r=await awaitPublicationWindow(async()=>{calls++;return {ok:true,eligible:true}},{
   sleep:async()=>{throw Error('unnecessary_wait')}
 });
 assert.deepEqual(r,{ok:true,waitMs:0});assert.equal(calls,1);
});
test('clock skew of 4.2 seconds is retried once in SAME minute and reverified',async()=>{
 const sleeps=[],responses=[{ok:true,eligible:false,retryAfterMs:4200,nextEligibleAt:'2026-10-25T04:00:04Z'}, {ok:true,eligible:true}];
 const result=await awaitPublicationWindow(async()=>responses.shift(),{sleep:async(ms)=>sleeps.push(ms)});
 assert.deepEqual(result,{ok:true,waitMs:4350});
 assert.deepEqual(sleeps,[4350]);
});
test('long wait beyond 54 seconds defers rather than adding a second publisher',async()=>{
 let waits=0;const result=await awaitPublicationWindow(async()=>({ok:true,eligible:false,retryAfterMs:59000}),{sleep:async()=>{waits++}});
 assert.equal(result.ok,false);assert.equal(result.reason,'wait_exceeds_cron_safe_window');assert.equal(waits,0);
});
test('closed or failing global DO permit always blocks',async()=>{
 const result=await awaitPublicationWindow(async()=>({ok:false,error:'publication_control_unavailable'}));
 assert.equal(result.ok,false);assert.equal(result.reason,'global_publication_gate_unavailable');
});
test('a competing publisher that still owns the DO slot after sleep blocks retry',async()=>{
 let count=0;const result=await awaitPublicationWindow(async()=>++count===1?{ok:true,eligible:false,retryAfterMs:1100}:{ok:true,eligible:false,retryAfterMs:900},{sleep:async()=>{}});
 assert.equal(result.ok,false);assert.equal(result.reason,'publication_gate_still_busy_after_wait');assert.equal(count,2);
});
test('malformed slot timestamp fails closed',()=>{
 assert.equal(plannedPublicationWait({ok:true,eligible:false,retryAfterMs:null,nextEligibleAt:'not-a-date'}).ok,false);
});
