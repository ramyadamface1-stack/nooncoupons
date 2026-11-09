import test from 'node:test';
import assert from 'node:assert/strict';
import {createSystem1VisualSet,inspectSystem1VisualSet,SYSTEM1_VISUAL_KINDS} from '../automation/ai-v2/system1-visuals.mjs';

const article={slug:'saudi-samsung-storage-warranty-seller-checklist-2026',country:'SA',brand:'Samsung',coupon:'NOV170'};
test('SYSTEM1 produces five unique real SVGs 1600x1000 in English and no fabricated discount',()=>{
 const files=createSystem1VisualSet(article);
 assert.equal(files.length,5);
 assert.deepEqual(files.map(x=>x.kind),SYSTEM1_VISUAL_KINDS);
 assert.equal(new Set(files.map(x=>x.sha256)).size,5);
 for(const file of files){
  assert.match(file.svg,/width="1600" height="1000"/);
  assert.match(file.svg,/viewBox="0 0 1600 1000"/);
  assert.match(file.svg,/NOV170/);
  assert.doesNotMatch(file.svg,/[\u0600-\u06FF]/);
  assert.doesNotMatch(file.svg,/\b[0-9]+%\s*(OFF|DISCOUNT)\b/i);
  assert.ok(file.alt.includes('Samsung'));
 }
 assert.equal(inspectSystem1VisualSet(files).ok,true);
 assert.equal(inspectSystem1VisualSet(files).visualHumanReviewed,false);
});
test('visual generator refuses off-market coupon and dangerous slug',()=>{
 assert.throws(()=>createSystem1VisualSet({...article,coupon:'NOV188'}),/INVALID_SYSTEM1_VISUAL_INPUT/);
 assert.throws(()=>createSystem1VisualSet({...article,slug:'../../escape'}),/INVALID_SYSTEM1_VISUAL_INPUT/);
 assert.throws(()=>createSystem1VisualSet({...article,country:'EG'}),/INVALID_SYSTEM1_VISUAL_INPUT/);
});
test('checksum or a duplicated design cannot pass the quality validator',()=>{
 const files=createSystem1VisualSet({...article,country:'AE',coupon:'NOV188'});
 files[1]={...files[0]};
 assert.equal(inspectSystem1VisualSet(files).ok,false);
 const good=createSystem1VisualSet(article);
 good[2].svg+='modified';
 assert.equal(inspectSystem1VisualSet(good).ok,false);
});
