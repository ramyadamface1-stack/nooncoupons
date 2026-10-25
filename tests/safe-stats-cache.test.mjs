import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeStatsMemo} from '../safe-stats-cache.js';
test('expensive stats request memoizes and preserves the published counts',async()=>{
  const run=createSafeStatsMemo({ttlMs:60000});
  let reads=0;
  const f=()=>{reads++;return {ok:true,total:150000,arabic:130000,english:20000}};
  const first=await run(f);
  const second=await run(f);
  assert.equal(reads,1);
  assert.equal(first.total,second.total);
  assert.equal(second.statsCache.hit,true);
});
test('coalesces concurrent stats reads, never doubles expensive R2 aggregation',async()=>{
  const run=createSafeStatsMemo({ttlMs:60000});
  let reads=0;
  const work=async()=>{reads++;await Promise.resolve();return {ok:true,total:42}};
  const [a,b,c]=await Promise.all([run(work),run(work),run(work)]);
  assert.equal(reads,1);
  assert.equal(a.total,42);assert.equal(b.total,42);assert.equal(c.total,42);
});
test('stale fallback is labeled and a failed first read still fails',async()=>{
  const run=createSafeStatsMemo({ttlMs:-1,maxStaleMs:60000});
  await assert.rejects(()=>createSafeStatsMemo()(()=>{throw Error('down')}),/down/);
  await run(()=>({ok:true,total:5}));
  const s=await run(()=>{throw Error('down')});
  assert.equal(s.total,5);
  assert.equal(s.statsCache.stale,true);
});
