import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {rescueSitemapResponse} from '../r2-emergency-readonly.js';

const path='/sitemap-rescue-images-25.xml';
const segment={version:1,articles:[
  {slug:'نون-سعودية-اختبار-coupon-2026',country:'SA',lastmod:'2026-11-08'},
  {slug:'uae-buyer-test-nov188',country:'AE',lastmod:'2026-11-08'}
]};
const manifest={version:1,count:2,segments:[{n:25,count:2,key:'seo-rescue/articles-25.json'}],englishSegments:[]};
const render=payload=>spawnSync('node',['scripts/geo-prebuilt-rescue-xml-render.mjs'],
  {input:JSON.stringify(payload),encoding:'utf8',timeout:10000});

test('prebuilt image canary matches current runtime HTML/XML exact bytes',async()=>{
  const result=render({path,manifest,segment});
  assert.equal(result.status,0,result.stderr);
  const env={CONTENT_FINAL:{get:async key=>{
    if(key==='seo-rescue/index.json')return {text:async()=>JSON.stringify(manifest)};
    if(key==='seo-rescue/articles-25.json')return {text:async()=>JSON.stringify(segment)};
    return null;
  }}};
  const actual=await rescueSitemapResponse(path,env);
  assert.equal(actual.status,200);
  assert.equal(result.stdout,await actual.text());
  assert.equal((result.stdout.match(/<url>/g)||[]).length,2);
  assert.equal((result.stdout.match(/<image:image>/g)||[]).length,2);
});
test('prebuilder refuses absent/mismatched published manifest and unsupported paths',()=>{
  const wrong=render({path,manifest:{...manifest,segments:[{n:25,count:1,key:'seo-rescue/articles-25.json'}]},segment});
  assert.notEqual(wrong.status,0);
  const unknown=render({path:'/sitemap-rescue-images-24.xml',manifest,segment});
  assert.notEqual(unknown.status,0);
  const noPaths=render({path:'/sitemap.xml',manifest,segment});
  assert.notEqual(noPaths.status,0);
});
test('CI R2 prebuilder has immutable source and write-only derivative guards',()=>{
  const source=readFileSync(new URL('../.github/scripts/prebuild-rescue-xml-canary.py',import.meta.url),'utf8');
  assert.match(source,/TARGETS = \(\("images", 9\), \("images", 25\), \("articles", 32\)\)/);
  assert.match(source,/PREFIX = "seo-rescue\/prebuilt-xml\/"/);
  assert.match(source,/source-etag/);
  assert.match(source,/read-back verification failed/);
  assert.doesNotMatch(source,/delete_object\(|delete_objects\(/);
});
