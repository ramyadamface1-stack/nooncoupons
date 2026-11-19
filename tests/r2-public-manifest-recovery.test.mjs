import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecentPublicManifest} from '../r2-public-manifest.js';

test('a missing or failing first R2 binding cannot permanently pin the manifest read',async()=>{
  assert.deepEqual(await readRecentPublicManifest({}),{articles:[]});
  assert.deepEqual(await readRecentPublicManifest({CONTENT_FINAL:{get(){throw Error('R2 temporarily unavailable')}}}),{articles:[]});
  let reads=0;
  const value={version:1,articles:[{slug:'recovered-public-article',country:'SA'}]};
  const env={CONTENT_FINAL:{get:async()=>{reads++;return {json:async()=>value}}}};
  const results=await Promise.all(Array.from({length:8},()=>readRecentPublicManifest(env)));
  for(const result of results)assert.deepEqual(result,value);
  assert.equal(reads,1,'concurrent requests should share one successful R2 read');
  assert.deepEqual(await readRecentPublicManifest(env),value);
  assert.equal(reads,1,'fresh snapshot must be reused');
});
