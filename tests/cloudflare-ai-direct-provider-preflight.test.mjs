import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectDirectProviderEligibility} from '../cloudflare-ai-direct/provider-eligibility.mjs';
const PREFIX='_ops/noondealsnow-direct-ai-v1/';
const fingerprint=async raw=>(raw==='gemini-a'?'a':'b').repeat(64);
const window={attempts:[{provider:'gemini',keyIndex:0},{provider:'groq',keyIndex:0}],
 next:{geminiNext:1,groqNext:1}};
const keys={gemini:['gemini-a'],groq:['groq-a']};
const fixture=({cooldown=null,reject=false,broken=false}={})=>{
 let requests=0;
 const bucket={
  async head(key){requests++;return reject&&key===PREFIX+'provider-rejected/groq/'+('b'.repeat(12))+'.json'?{etag:'r'}:null},
  async get(key){requests++;if(broken)throw Error('R2 outage');
   if(key===PREFIX+'provider-quota-cooldown/gemini/'+('a'.repeat(12))+'.json'&&cooldown)
    return {json:async()=>cooldown};
   return null;
  },
  async put(){throw Error('PREFLIGHT_MUST_NOT_RESERVE_OR_SPEND')}
 };
 return {bucket,requests:()=>requests};
};
test('expired cooldown is available, active cooldown is not, and fully rejected credentials never reach the provider',async()=>{
 const now=Date.parse('2026-11-23T20:00:00Z');
 const f=fixture({cooldown:{until:'2026-11-23T20:15:00Z'},reject:true});
 const r=await inspectDirectProviderEligibility(f.bucket,keys,window,{fingerprint,atMs:now});
 assert.deepEqual(r.eligible,[]);
 assert.deepEqual(r.diagnostics,{considered:2,cooling:1,rejected:1,unreadable:0,eligible:0});
 assert.ok(f.requests()>=3);
 const g=fixture({cooldown:{until:'2026-11-23T19:45:00Z'}});
 const resumed=await inspectDirectProviderEligibility(g.bucket,keys,window,{fingerprint,atMs:now});
 assert.deepEqual(resumed.eligible,window.attempts);
 assert.equal(resumed.diagnostics.eligible,2);
});
test('malformed cooldown is fail-closed; missing R2 metadata cannot trigger a speculative LLM call',async()=>{
 const invalid=fixture({cooldown:{until:'not-a-real-date'}});
 const report=await inspectDirectProviderEligibility(invalid.bucket,keys,window,{fingerprint,atMs:1000});
 assert.equal(report.diagnostics.eligible,1);
 assert.equal(report.diagnostics.unreadable,1);
 assert.deepEqual(report.eligible,[window.attempts[1]]);
 const outage=fixture({broken:true});
 await assert.rejects(
  inspectDirectProviderEligibility(outage.bucket,keys,window,{fingerprint,atMs:1000}),/R2 outage/);
});
test('real engine checks provider availability BEFORE creating checkpoint, respecting no-repeat publication safety',()=>{
 const engine=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');
 const p=engine.indexOf('eligibleKeys=await inspectDirectProviderEligibility');
 const q=engine.indexOf("const checkpointKey=ROOT+'checkpoint/'+topic.slug+'.json'");
 assert.ok(p>0&&q>p,'topic identity must not be reserved before quota preflight');
 assert.match(engine,/if\(!eligibleKeys\.eligible\.length\)\{/);
 assert.match(engine,/topicReserved:false,providerCalls:0/);
 assert.match(engine,/for\(const selected of eligibleKeys\.eligible\)/);
 assert.match(engine,/if\(action==='QUARANTINE_UNKNOWN'\)/);
 assert.match(engine,/state:'UNKNOWN_REQUEST_OUTCOME'/);
 assert.match(engine,/planDirectProviderWindow\(/);
 assert.doesNotMatch(engine,/api\.github\.com|actions\/workflows|GITHUB_DISPATCH_TOKEN/);
});

test('ambiguous provider 503 freezes future key selection but never retries the original unknown article',async()=>{
 const code=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');
 const quarantine=code.slice(code.indexOf("if(action==='QUARANTINE_UNKNOWN')"),code.indexOf("   break;",code.indexOf("if(action==='QUARANTINE_UNKNOWN')")));
 assert.match(quarantine,/state:'UNKNOWN_REQUEST_OUTCOME'/);
 assert.match(quarantine,/planQuotaCooldown\(entry\.provider,/);
 assert.match(quarantine,/PROVIDER_TEMPORARY_5XX/);
 assert.match(quarantine,/jsonPut\(env,cooldownKey/);
 assert.match(quarantine,/PROVIDER_HTTP_OUTCOME_UNKNOWN/);
 assert.doesNotMatch(quarantine,/providerRequest\(/);
 const provider=fixture({cooldown:{reason:'PROVIDER_TEMPORARY_5XX',http:503,
  until:'2026-11-23T20:45:00.000Z'}});
 const plan=await inspectDirectProviderEligibility(provider.bucket,keys,window,{fingerprint,
  atMs:Date.parse('2026-11-23T20:25:00Z')});
 assert.deepEqual(plan.eligible,[window.attempts[1]]);
 assert.equal(plan.diagnostics.cooling,1);
});
