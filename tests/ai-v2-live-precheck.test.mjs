import test from 'node:test';
import assert from 'node:assert/strict';
import {probeLiveArticleBeforeDraft} from '../automation/ai-v2/live-precheck.mjs';
const url='https://noondealsnow.com/articles/saudi-buyer-safe-precheck-2026';
const client=statuses=>{
  const seen=[];
  return {seen,fetchFn:async(uri,opts)=>{
    seen.push({uri,method:opts.method,hasTimeout:Boolean(opts.signal)});
    const next=statuses[seen.length-1];
    if(next==='throw')throw Error('temporary network failure');
    return {status:next};
  }};
};
test('only an explicit 404 authorizes a new article draft',async()=>{
  const c=client([404]),result=await probeLiveArticleBeforeDraft(url,{fetchFn:c.fetchFn});
  assert.deepEqual(result,{status:404,attempts:1});
  assert.equal(c.seen[0].method,'GET');
  assert.equal(c.seen[0].hasTimeout,true);
});
test('HTTP 200 proves existing article and is never retried',async()=>{
  const c=client([200,404]);
  assert.deepEqual(await probeLiveArticleBeforeDraft(url,{fetchFn:c.fetchFn}),{status:200,attempts:1});
  assert.equal(c.seen.length,1);
});
test('intermittent edge 503 may recover to a 404 using GET only',async()=>{
  const c=client([503,502,404]),pauses=[];
  const result=await probeLiveArticleBeforeDraft(url,{fetchFn:c.fetchFn,pause:async n=>pauses.push(n)});
  assert.deepEqual(result,{status:404,attempts:3});
  assert.deepEqual(pauses,[500,1000]);
  assert.deepEqual(c.seen.map(x=>x.method),['GET','GET','GET']);
});
test('persistent Cloudflare 5xx fails closed and never claims absence',async()=>{
  const c=client([503,503,503]);
  assert.deepEqual(await probeLiveArticleBeforeDraft(url,{fetchFn:c.fetchFn,pause:async()=>{}}),{status:503,attempts:3});
  assert.equal(c.seen.length,3);
});
test('network unknown followed by 200 remains an existing-page result',async()=>{
  const c=client(['throw',200]);
  assert.deepEqual(await probeLiveArticleBeforeDraft(url,{fetchFn:c.fetchFn,pause:async()=>{}}),{status:200,attempts:2});
});
test('HTTP 429 and 403 never cause repeated probes',async()=>{
  for(const status of [429,403]){
    const c=client([status,404]);
    assert.deepEqual(await probeLiveArticleBeforeDraft(url,{fetchFn:c.fetchFn}),{status,attempts:1});
    assert.equal(c.seen.length,1);
  }
});
test('invalid URLs and unbounded retries are rejected',async()=>{
  await assert.rejects(probeLiveArticleBeforeDraft('http://invalid/articles/x'),/INVALID_/);
  await assert.rejects(probeLiveArticleBeforeDraft(url,{attempts:100}),/INVALID_/);
});
