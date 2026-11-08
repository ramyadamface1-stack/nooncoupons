import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../automation/ai-v2/config.json' with {type:'json'};
import {managedRuntimeConfig,decideTick} from '../ai-scheduler-v2/worker.mjs';
import {AI_V2_INTERVALS} from '../admin-runtime.js';

const enabledEnv={AI_V2_RUNTIME_ENABLED:'true'};
const noopFetch=async()=>{throw Error('should not access public policy while runtime is disabled')};
const policy=(enabled,intervalMinutes)=>async()=>new Response(JSON.stringify({ok:true,enabled,intervalMinutes}),{status:200});
test('admin control intervals match scheduler and exclude unsafe subminute dispatch',()=>{
  assert.deepEqual([...AI_V2_INTERVALS],[1,5,10,15,30,60]);
});
test('requires the explicit production activation secret before contacting control policy',async()=>{
  const inactive=await managedRuntimeConfig(config,{},noopFetch);
  assert.equal(inactive.enabled,false);
  assert.equal(inactive.controlStatus,'ACTIVATION_NOT_ENABLED');
});
test('running admin policy configures safe minute cadence',async()=>{
  const active=await managedRuntimeConfig(config,enabledEnv,policy(true,1));
  assert.equal(active.enabled,true);
  assert.equal(active.intervalMinutes,1);
  const t=Date.parse('2026-11-07T19:05:19Z');
  assert.equal(decideTick(active,t,t).due,true);
});
test('running admin policy can change cadence without changing quality controls',async()=>{
  const active=await managedRuntimeConfig(config,enabledEnv,policy(true,5));
  assert.equal(active.enabled,true);
  assert.equal(active.intervalMinutes,5);
  assert.equal(active.safety.keepLegacyCron,true);
  const five=Date.parse('2026-11-07T19:05:19Z');
  assert.equal(decideTick(active,five,five).due,true);
  assert.equal(decideTick(active,five+60000,five+60000).due,false);
});
test('admin pause blocks all production dispatches',async()=>{
  const paused=await managedRuntimeConfig(config,enabledEnv,policy(false,1));
  assert.equal(paused.enabled,false);
  const t=Date.parse('2026-11-07T19:08:19Z');
  assert.equal(decideTick(paused,t,t).due,false);
});
test('malformed, failing or unreachable policy never dispatches',async()=>{
  const scenarios=[
    async()=>new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:0}),{status:200}),
    async()=>new Response(JSON.stringify({ok:false,enabled:true,intervalMinutes:1}),{status:200}),
    async()=>new Response('{}',{status:503}),
    async()=>{throw Error('network failed')}
  ];
  for(const fetchFn of scenarios){
    const s=await managedRuntimeConfig(config,enabledEnv,fetchFn);
    assert.equal(s.enabled,false);
  }
});
