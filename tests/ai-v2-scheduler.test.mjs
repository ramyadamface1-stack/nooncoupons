import test from 'node:test';
import assert from 'node:assert/strict';
import {decideTick,dispatchDue,githubHttpStatus} from '../ai-scheduler-v2/worker.mjs';
import config from '../automation/ai-v2/config.json' with {type:'json'};
const start=Date.parse('2026-11-01T12:00:00.000Z');
test('default disables dispatch',()=>{assert.equal(decideTick(config,start,start).reason,'SCHEDULER_DISABLED')});
test('exactly twelve five-minute slots in an hour',()=>{
const c={...config,enabled:true};let count=0;
for(let i=0;i<60;i++){const t=start+i*60000;if(decideTick(c,t,t+1000).due)count++}
assert.equal(count,12);
assert.equal(decideTick(c,start+60000,start+60000).reason,'INTERVAL_NOT_ELAPSED');
});
test('clock-skew and unsupported intervals are rejected',()=>{
const c={...config,enabled:true};
assert.equal(decideTick(c,start,start+181000).reason,'CLOCK_SKEW');
assert.equal(decideTick({...c,intervalMinutes:7},start,start).reason,'INVALID_INTERVAL');
});

test('dispatch cannot run when disabled, even with a token',async()=>{
 let calls=0;
 const answer=await dispatchDue({config,scheduledTime:start,actualTime:start,token:'fake',fetchFn:async()=>{calls++;throw Error('unexpected')},logger:()=>{}});
 assert.equal(answer.dispatched,false);assert.equal(answer.reason,'SCHEDULER_DISABLED');assert.equal(calls,0);
});
test('enabled scheduler verifies workflow runs, then dispatches one token-free preflight mock',async()=>{
 let calls=[],lines=[];
 const response=await dispatchDue({
  config:{...config,enabled:true},scheduledTime:start,actualTime:start,token:'fake',
  logger:line=>lines.push(line),
  fetchFn:async(url,init)=>{
   calls.push({url,method:init.method||'GET',body:init.body||null});
   if(url.endsWith('/dispatches'))return new Response(null,{status:204});
   return new Response(JSON.stringify({total_count:0}),{status:200});
  }
 });
 assert.equal(response.reason,'DISPATCH_ACCEPTED');assert.equal(response.dispatched,true);
 assert.deepEqual(calls.map(x=>x.method),['GET','GET','POST']);
 const body=JSON.parse(calls[2].body);
 assert.equal(body.ref,'main');assert.equal(body.inputs.scheduled_ms,String(start));
 assert.equal(lines.length,1);
 assert.equal(lines[0].includes('fake'),false);
});
test('running workflow stops dispatch without triggering HTTP POST',async()=>{
 let calls=0;
 const result=await dispatchDue({config:{...config,enabled:true},scheduledTime:start,actualTime:start,token:'not-real',logger:()=>{},
 fetchFn:async()=>{calls++;return new Response(JSON.stringify({total_count:1}),{status:200})}});
 assert.equal(result.reason,'WORKFLOW_ALREADY_RUNNING');assert.equal(calls,1);
});
test('missing token, 401 and 403 reject safely',async()=>{
 assert.equal((await dispatchDue({config:{...config,enabled:true},scheduledTime:start,actualTime:start,logger:()=>{}})).reason,'DISPATCH_TOKEN_MISSING');
 for(const status of [401,403]){
  const result=await dispatchDue({config:{...config,enabled:true},scheduledTime:start,actualTime:start,token:'fake',logger:()=>{},
   fetchFn:async()=>new Response('{}',{status})});
  assert.equal(result.reason,githubHttpStatus(status));assert.equal(result.dispatched,false);
 }
});
