import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runNativePublicationWindow} from '../cloudflare-ai-direct/engine.mjs';

const source=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');
test('single-flight publication uses one and only one native POST opportunity per minute',async()=>{
 const minute=Date.parse('2026-11-12T23:10:00.000Z');
 const writes=[],sleepDurations=[],postCalls=[];
 const env={CONTENT_FINAL:{
  async put(key,value){writes.push({key,data:JSON.parse(value)});return {etag:'ok'}}
 }};
 const output=await runNativePublicationWindow(env,{enabled:true,publishingIntervalMinutes:1},{
  scheduledAt:minute,clock:()=>minute+1000,
  sleep:async ms=>sleepDurations.push(ms),
  publish:async()=>{postCalls.push('post');return {ok:true,reason:'LIVE_VERIFIED',slug:'uae-buyer-new-safe-article-nov188-2026-n11'};}
 });
 assert.deepEqual(sleepDurations,[34000]);
 assert.equal(postCalls.length,1);
 assert.equal(output.length,1);
 assert.equal(output[0].reason,'LIVE_VERIFIED');
 assert.equal(writes.length,1);
 assert.equal(writes[0].data.results.length,1);
 assert.equal(writes[0].data.containsRawKeys,false);
 assert.match(writes[0].key,/publication-observation\.json$/);
});
test('single-flight publication preserves unknown errors without repeating a native request',async()=>{
 let calls=0;
 const writes=[];
 const env={CONTENT_FINAL:{async put(_key,value){writes.push(JSON.parse(value));return {etag:'ok'}}}};
 const result=await runNativePublicationWindow(env,{enabled:true,publishingIntervalMinutes:1},{
  scheduledAt:Date.parse('2026-11-12T23:11:00Z'),
  clock:()=>Date.parse('2026-11-12T23:11:36Z'),
  sleep:async()=>{throw Error('NO_SLEEP')},
  publish:async()=>{calls++;throw Error('TRANSIENT_FAILURE_WITH_SECRET_NOT_TO_LOG')}
 });
 assert.equal(calls,1);
 assert.deepEqual(result,[{ok:false,reason:'PUBLICATION_UNAVAILABLE'}]);
 assert.equal(writes[0].results[0].reason,'PUBLICATION_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(writes),/SECRET_NOT_TO_LOG/);
});
test('READY articles are examined before any uncertain POST reconciliation',()=>{
 const unknown=source.indexOf("if(record.state==='UNKNOWN_PUBLICATION_OUTCOME')",source.indexOf('async function publishOne'));
 const ready=source.indexOf("if(record.state!=='READY')continue",unknown);
 const delayed=source.indexOf('if(unresolved.length){',ready);
 assert.ok(unknown>0&&ready>unknown&&delayed>ready);
 assert.match(source,/unresolved\.push\(\{key:item\.key,record\}\)/);
 assert.match(source,/UNRESOLVED_PUBLICATION_RETAINED/);
 assert.match(source,/const publications=runNativePublicationWindow\(env,p,\{scheduledAt\}\)/);
 assert.doesNotMatch(source,/const firstPublication=publishOne\(env,p\)/);
 assert.doesNotMatch(source,/const secondPublication=/);
});
