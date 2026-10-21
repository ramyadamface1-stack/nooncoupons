import test from 'node:test';
import assert from 'node:assert/strict';
import {rescueSignedReadBounded} from '../r2-emergency-readonly.js';
const env={NOON_RESCUE_R2_ACCESS_KEY_ID:'test-public-r2-key',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'test-public-r2-secret'};
async function withFetch(handler,fn){
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=(url,opts)=>{calls++;assert.match(url,/nooncoupons-content-v2/);assert.match(opts.headers.authorization,/AWS4-HMAC-SHA256/);return handler(calls)};
  try{await fn(()=>calls)}finally{globalThis.fetch=old}
}
test('transient 503 retries exactly once and returns the valid 200 source',async()=>{
  await withFetch(n=>new Response(n===1?'temporarily busy':'<html>OK</html>',{status:n===1?503:200}),async calls=>{
    const r=await rescueSignedReadBounded(env,'articles/example.html');
    assert.equal(r.status,200);assert.match(await r.text(),/OK/);assert.equal(calls(),2);
  });
});
test('persistent transient 429 does not retry indefinitely',async()=>{
  await withFetch(()=>new Response('rate limited',{status:429}),async calls=>{
    const r=await rescueSignedReadBounded(env,'bulk/days.json');
    assert.equal(r.status,429);assert.equal(calls(),2);
  });
});
test('missing object 404 and denied 403 never retry',async()=>{
  for(const status of [403,404]){
    await withFetch(()=>new Response('cannot read',{status}),async calls=>{
      const r=await rescueSignedReadBounded(env,'articles/example.html');
      assert.equal(r.status,status);assert.equal(calls(),1);
    });
  }
});
test('one transient connection failure retries once',async()=>{
  await withFetch(n=>n===1?Promise.reject(new Error('socket closed')):new Response('good',{status:200}),async calls=>{
    const r=await rescueSignedReadBounded(env,'seo-rescue/index.json');
    assert.equal(r.status,200);assert.equal(calls(),2);
  });
});
test('persistent connection failure bubbles up after exactly two attempts',async()=>{
  await withFetch(()=>Promise.reject(new Error('connection unavailable')),async calls=>{
    await assert.rejects(()=>rescueSignedReadBounded(env,'seo-rescue/index.json'),/connection unavailable/);
    assert.equal(calls(),2);
  });
});
