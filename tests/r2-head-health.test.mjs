import test from 'node:test';
import assert from 'node:assert/strict';
import {healthR2ObjectExists,HEALTH_HEAD_TTL_MS} from '../r2-health-head-cache.js';

test('health probes coalesce hundreds of repeated HEAD calls, refresh on expiry and do not cache failures',async()=>{
  const original=Date.now;
  let now=500_000,heads=0,fail=false;
  Date.now=()=>now;
  const env={CONTENT_FINAL:{head:async key=>{
    assert.equal(key,'articles/en-probe.html');
    heads++;
    if(fail)throw Error('temporary R2 problem');
    return {key};
  }}};
  try{
    const checked=await Promise.all(Array.from({length:100},()=>healthR2ObjectExists(env,'articles/en-probe.html')));
    assert.equal(heads,1);
    assert.ok(checked.every(Boolean));
    for(let i=0;i<100;i++)assert.equal(await healthR2ObjectExists(env,'articles/en-probe.html'),true);
    assert.equal(heads,1);
    now+=HEALTH_HEAD_TTL_MS+1;
    assert.equal(await healthR2ObjectExists(env,'articles/en-probe.html'),true);
    assert.equal(heads,2);
    now+=HEALTH_HEAD_TTL_MS+1;
    fail=true;
    await assert.rejects(healthR2ObjectExists(env,'articles/en-probe.html'));
    assert.equal(heads,3);
    fail=false;
    assert.equal(await healthR2ObjectExists(env,'articles/en-probe.html'),true);
    assert.equal(heads,4,'transient failure must not be cached');
  }finally{Date.now=original}
});

test('health probe cache never contaminates duplicate-detection publisher',async()=>{
  const {readFileSync}=await import('node:fs');
  const health=readFileSync(new URL('../english-canary.js',import.meta.url),'utf8');
  assert.match(health,/await healthR2ObjectExists\(env,'articles\/'\+r\.slug\+'\.html'\)/);
  assert.match(health,/async function r2HeadSafe\(/);
  assert.match(health,/await withDeadline\(env\.CONTENT_FINAL\.head\(key\)/);
  assert.match(health,/onlyIf=new Headers\(\{'If-None-Match':'\*'\}\)/);
});
