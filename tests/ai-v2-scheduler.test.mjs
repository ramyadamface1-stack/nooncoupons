import test from 'node:test';
import assert from 'node:assert/strict';
import {decideTick,dispatchDue,githubHttpStatus,effectiveRuntimeConfig,probeProductionCapacity} from '../ai-scheduler-v2/worker.mjs';
import config from '../automation/ai-v2/config.json' with {type:'json'};
const start=Date.parse('2026-11-01T12:00:00.000Z');
test('default disables dispatch',()=>{assert.equal(decideTick(config,start,start).reason,'SCHEDULER_DISABLED')});
test('exactly sixty one-minute slots in an hour',()=>{
const c={...config,enabled:true};let count=0;
for(let i=0;i<60;i++){const t=start+i*60000;if(decideTick(c,t,t+1000).due)count++}
assert.equal(count,60);
assert.equal(decideTick(c,start+60000,start+60000).reason,'DUE');
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
 assert.equal(body.ref,'main');
 assert.equal(body.inputs.preflight_only,'true');assert.equal(body.inputs.scheduled_ms,String(start));
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

test('one real scheduled-minute diagnostic dispatch only, with no AI calls',async()=>{
 const ms=Date.parse(config.schedulerDiagnostic.fromUtc);
 const last=Date.parse(config.schedulerDiagnostic.untilUtc);
 assert.equal(decideTick(config,ms-60000,ms-60000).reason,'SCHEDULER_DISABLED');
 assert.equal(decideTick(config,last+60000,last+60000).reason,'SCHEDULER_DISABLED');
 assert.equal(decideTick(config,ms,ms+1000).reason,'DIAGNOSTIC_PREFLIGHT_DUE');
 let calls=[];
 const result=await dispatchDue({config,scheduledTime:ms,actualTime:ms+1000,token:'fake',logger:()=>{},fetchFn:async (url,init)=>{
   calls.push({url,method:init.method||'GET',body:init.body||null});
   if(url.endsWith('/dispatches'))return new Response(null,{status:204});
   if(url.includes('event=workflow_dispatch')&&!url.includes('&status='))return new Response(JSON.stringify({workflow_runs:[]}),{status:200});
   return new Response(JSON.stringify({total_count:0}),{status:200});
 }});
 assert.equal(result.dispatched,true);
 assert.equal(calls.length,4);
 const body=JSON.parse(calls[3].body);
 assert.equal(body.inputs.preflight_only,'true');
 assert.equal(body.inputs.scheduled_ms,String(ms));
});

test('bounded diagnostic stops after one accepted GitHub workflow_dispatch',async()=>{
 const ms=Date.parse(config.schedulerDiagnostic.fromUtc)+60000;
 const received=new Date(Date.parse(config.schedulerDiagnostic.fromUtc)).toISOString();
 let calls=[];
 const result=await dispatchDue({config,scheduledTime:ms,actualTime:ms+500,token:'fake',logger:()=>{},fetchFn:async (url,init)=>{
   calls.push(url);
   if(url.includes('event=workflow_dispatch')&&!url.includes('&status='))return new Response(JSON.stringify({workflow_runs:[{event:'workflow_dispatch',created_at:received}]}),{status:200});
   if(url.endsWith('/dispatches'))throw Error('NO_REPEATED_DISPATCH');
   return new Response(JSON.stringify({total_count:0}),{status:200});
 }});
 assert.equal(result.dispatched,false);
 assert.equal(result.reason,'DIAGNOSTIC_ALREADY_RECEIVED');
 assert.equal(calls.length,3);
});

test('real Cloudflare Cron timestamps may contain second and millisecond offsets',()=>{
 const from=Date.parse(config.schedulerDiagnostic.fromUtc);
 const actualScheduledTime=from+19812;
 const decision=decideTick(config,actualScheduledTime,actualScheduledTime+1000);
 assert.equal(decision.due,true);
 assert.equal(decision.preflightOnly,true);
 assert.equal(decision.reason,'DIAGNOSTIC_PREFLIGHT_DUE');
});

test('scheduler only activates when the explicit Cloudflare secret is present; one-minute rhythm is preserved',async()=>{
 const inert=effectiveRuntimeConfig(config,{});
 assert.equal(inert.enabled,false);
 const active=effectiveRuntimeConfig(config,{AI_V2_RUNTIME_ENABLED:'true'});
 assert.equal(active.enabled,true);
 assert.equal(active.publicationMode,'live_verified');
 assert.equal(active.safety.keepLegacyCron,true);
 assert.equal(active.safety.noAutomaticPublishUntilLiveBridgeVerified,false);
 assert.equal(decideTick(active,start+19812,start+21000).due,true);
 let requests=[];
 const out=await dispatchDue({config:active,scheduledTime:start+19812,actualTime:start+20000,token:'fake',logger:()=>{},
  fetchFn:async(url,init)=>{
   requests.push({url,method:init.method||'GET',body:init.body});
   return url.endsWith('/dispatches')?new Response(null,{status:204}):new Response(JSON.stringify({total_count:0}),{status:200});
  }});
 assert.equal(out.dispatched,true);
 assert.equal(JSON.parse(requests[0].body).inputs.preflight_only,'false');
 assert.equal(requests.length,1);
 assert.ok(requests[0].url.endsWith('/dispatches'));
});

test('a push-time safety run cannot block one-minute dispatch or share publisher concurrency',async()=>{
 const observed=[];
 const result=await dispatchDue({config:{...config,enabled:true,publicationMode:'live_verified',
  safety:{...config.safety,noAutomaticPublishUntilLiveBridgeVerified:false}},
  scheduledTime:start,actualTime:start,token:'test-nonsecret',logger:()=>{},
  fetchFn:async(url)=>{
   observed.push(url);
   if(url.endsWith('/dispatches'))return new Response(null,{status:204});
   // A current push safety run is not a workflow_dispatch event and must
   // not appear in a provider response filtered by event=workflow_dispatch.
   if(url.includes('event=workflow_dispatch&status='))return new Response(JSON.stringify({total_count:0,workflow_runs:[]}),{status:200});
   throw Error('RUN_STATUS_QUERY_MISSING_DISPATCH_EVENT_FILTER');
  }
 });
 assert.equal(result.reason,'DISPATCH_ACCEPTED');
 assert.equal(result.dispatched,true);
 assert.equal(observed.length,1);
 assert.ok(observed[0].endsWith('/dispatches'));

});

test('production minute does not skip while prior SA/AE jobs are still finishing',async()=>{
 const live=effectiveRuntimeConfig(config,{AI_V2_RUNTIME_ENABLED:'true'});
 let calls=[],scheduled=start+60000;
 const out=await dispatchDue({config:live,scheduledTime:scheduled,actualTime:scheduled+1000,
  token:'fake',logger:()=>{},fetchFn:async(url,init)=>{
   calls.push({url,method:init.method||'GET'});
   if(!url.endsWith('/dispatches'))throw Error('RUN_GATING_WOULD_DROP_THIS_MINUTE');
   return new Response(null,{status:204});
  }});
 assert.equal(out.dispatched,true);
 assert.deepEqual(calls.map(x=>x.method),['POST']);
});

test('scheduler suppresses wasting GitHub Actions time when Cloudflare responds 1027',async()=>{
 let calls=0;
 const limited=await probeProductionCapacity(async()=>{calls++;return new Response('Error 1027: plan limits',{status:429})});
 assert.deepEqual(limited,{allowed:false,reason:'CLOUDFLARE_1027_DAILY_LIMIT'});
 assert.equal(calls,1);
 const healthy=await probeProductionCapacity(async()=>new Response('{}',{status:200}));
 assert.deepEqual(healthy,{allowed:true,verified:true});
 const uncertain=await probeProductionCapacity(async()=>{throw Error('network')});
 assert.deepEqual(uncertain,{allowed:true,verified:false});
});

test('live scheduler probes cheap public health instead of high-CPU generator status',async()=>{
 let seen=[];
 const result=await probeProductionCapacity(async (url)=>{
  seen.push(url);
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
 });
 assert.deepEqual(seen,['https://noondealsnow.com/api/health']);
 assert.equal(result.allowed,true);
 assert.equal(result.verified,true);
});
