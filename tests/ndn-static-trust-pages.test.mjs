import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root='.ndn-static-assets';
const paths=['/editorial-policy','/coupon-verification','/authors/editorial-team','/disclaimer'];
test('editorial trust pages remain quota-free and have honest canonical metadata',()=>{
 for(const route of paths){
  const file=root+route+'.html';
  assert.ok(existsSync(file),'missing static trust path '+route);
  const html=readFileSync(file,'utf8');
  assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com'+route+'">'));
  assert.ok(html.includes('<meta name="robots" content="index,follow,max-image-preview:large">'));
  assert.ok(html.includes('<meta name="ndn-static-editorial-policy" content="v1">'));
  assert.ok(html.includes('<html lang="ar" dir="rtl">'));
  assert.ok(html.includes('G-1551Z7DJ2C'),'GA4 missing '+route);
  assert.ok(html.includes('href="/contact"'));
  assert.ok(html.includes('https://schema.org'));
  assert.ok(html.includes('لا')||html.includes('ليس'),'explicit limitations required '+route);
  assert.ok(!html.includes('خصم مضمون لكل المستخدمين'),'no unconditional coupon promise');
 }
 const homepage=readFileSync(root+'/index.html','utf8');
 for(const p of paths)assert.ok(homepage.includes('href="'+p+'"'));
});
