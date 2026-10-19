import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicArticleMetadata,ARTICLE_METADATA_HEAD_TTL_MS} from '../r2-public-article-metadata-cache.js';

test('public article decorator calls coalesce one R2 HEAD within an isolate',async()=>{
  let calls=0;
  const env={CONTENT_FINAL:{async head(key){
    calls++;
    await Promise.resolve();
    return {key,customMetadata:{country:'AE',cat:'mobiles'}};
  }}};
  const [commerce,network]=await Promise.all([
    readPublicArticleMetadata(env,'r2-meta-coalesce-123'),
    readPublicArticleMetadata(env,'r2-meta-coalesce-123')
  ]);
  const subsequent=await readPublicArticleMetadata(env,'r2-meta-coalesce-123');
  assert.equal(calls,1);
  assert.equal(commerce,network);
  assert.equal(commerce,subsequent);
  assert.equal(subsequent.customMetadata.country,'AE');
  assert.equal(ARTICLE_METADATA_HEAD_TTL_MS,300000);
});

test('missing article HEAD is cached only on public render, not publication duplicate gates',async()=>{
  let calls=0;
  const env={CONTENT_FINAL:{async head(){calls++;return null}}};
  assert.equal(await readPublicArticleMetadata(env,'r2-meta-null-123'),null);
  assert.equal(await readPublicArticleMetadata(env,'r2-meta-null-123'),null);
  assert.equal(calls,1);
  assert.equal(await readPublicArticleMetadata({CONTENT_FINAL:null},'other'),null);
});

test('transient R2 failure is not cached and can recover',async()=>{
  let calls=0;
  const env={CONTENT_FINAL:{async head(){calls++;if(calls===1)throw Error('transient');return {customMetadata:{c:'SA'}}}}};
  await assert.rejects(readPublicArticleMetadata(env,'r2-meta-error-123'),/transient/);
  const response=await readPublicArticleMetadata(env,'r2-meta-error-123');
  assert.equal(calls,2);
  assert.equal(response.customMetadata.c,'SA');
});

test('distinct public articles get distinct metadata cache entries',async()=>{
  let calls=0;
  const env={CONTENT_FINAL:{async head(key){calls++;return {key}}}};
  const a=await readPublicArticleMetadata(env,'r2-meta-distinct-a');
  const b=await readPublicArticleMetadata(env,'r2-meta-distinct-b');
  assert.equal(calls,2);
  assert.notEqual(a.key,b.key);
});
