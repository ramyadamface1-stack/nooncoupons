import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLOBAL_PUBLICATION_SPACING_MS,GLOBAL_PUBLICATION_MAX_PER_MINUTE,GLOBAL_PUBLICATION_POLICY} from '../publication-rate-limit.js';
import {GeneratorControl} from '../admin-runtime.js';
class MemoryStorage{
 constructor(){this.data=new Map()}
 async get(key){return this.data.get(key)}
 async put(key,value){this.data.set(key,value)}
 async transaction(callback){return callback(this)}
}
test('120-per-hour headroom uses shared durable atomic 30s permit, not quality bypass',async()=>{
 assert.equal(GLOBAL_PUBLICATION_SPACING_MS,30_000);
 assert.equal(GLOBAL_PUBLICATION_MAX_PER_MINUTE,2);
 const worker=readFileSync('admin-runtime.js','utf8');
 assert.match(worker,/const globalDue=lastAtMs\?lastAtMs\+GLOBAL_PUBLICATION_SPACING_MS:0;/);
 assert.match(worker,/if\(isAiV2\)await txn\.put\(aiKey,/);
 assert.match(worker,/this\.ctx\.storage\.transaction\(async txn=>/);
 assert.ok(worker.includes('this.ctx.storage.transaction('));
 const storage=new MemoryStorage();
 const doInstance=new GeneratorControl({storage},{});
 const post=()=>doInstance.fetch(new Request('https://generator.internal/publication-slot',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({market:'SA',source:'test-100-hour-capacity'})
 }));
 const originalNow=Date.now,base=Date.parse('2026-11-03T12:00:00Z');
 try{
  Date.now=()=>base;
  const first=await post();assert.equal(first.status,200);
  assert.equal((await first.json()).policy,GLOBAL_PUBLICATION_POLICY);
  Date.now=()=>base+29_999;
  const forbidden=await post();assert.equal(forbidden.status,429);
  Date.now=()=>base+30_000;
  const second=await post();assert.equal(second.status,200);
  Date.now=()=>base+60_000;
  const third=await post();assert.equal(third.status,200);
  assert.equal(storage.data.get('publication-rate-v1').lastAtMs,base+60_000);
 }finally{Date.now=originalNow}
});
