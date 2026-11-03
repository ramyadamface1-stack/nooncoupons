import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRecentPublicManifest} from '../r2-public-manifest.js';
import {englishPublicRecentRecords} from '../english-canary.js';
test('compact public feed is preferred and never loads original full bulk index',async()=>{
 const calls=[];
 const env={CONTENT_FINAL:{get:async key=>{
  calls.push(key);
  if(key==='bulk/public-compact-v1.json')return {json:async()=>({version:1,articles:[{slug:'a',country:'SA'}]})};
  throw Error('unexpected full source');
 }}};
 const r=await readRecentPublicManifest(env);assert.equal(r.articles.length,1);
 assert.deepEqual(calls,['bulk/public-compact-v1.json']);
});
test('English public rendering uses bounded compact feed instead of full publication state',async()=>{
 let count=0;
 const env={CONTENT_FINAL:{get:async key=>{count++;assert.equal(key,'english-canary/public-recent-v1.json');return {json:async()=>({version:1,articles:[{slug:'en-test-a',country:'AE',coupon:'NOV188',metaDescription:'Valid user guide'}]})}}}};
 const r=await englishPublicRecentRecords(env);
 assert.equal(r.length,1);assert.equal(r[0].slug,'en-test-a');assert.equal(count,1);
});

test('blog imports compact public feed and avoids the full legacy /api/state path',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../auto-platform.js',import.meta.url),'utf8');
 assert.ok(code.includes("import {readRecentPublicManifest} from './r2-public-manifest.js';"));
 const segment=code.split('async function bulkBlogPage(')[1].split('function staticSitemapPaths(')[0];
 assert.ok(segment.includes('readRecentPublicManifest(env)'));
 assert.ok(segment.includes('mergeNativeBlogRows(nativeRead,[],latest.articles'));
 assert.ok(!segment.includes('app.fetch('));
});
