import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryHtml} from '../discovery-entry.js';

const base={status:'published',quality:98,qualityFloor:92,wordCount:1800,publishedAt:'2026-11-20T10:00:00Z',createdAt:'2026-11-20T10:00:00Z'};

test('mixed-market homepage recent cards respect English and Arabic language and direction',()=>{
  const articles=[
    {...base,slug:'en-uae-mouse',urlPath:'/en/articles/en-uae-mouse',country:'AE',title:'Noon UAE mouse buying guide',language:'en',metaDescription:''},
    {...base,slug:'saudi-arabic-guide',urlPath:'/articles/saudi-arabic-guide',country:'SA',title:'دليل شراء السعودية',language:'ar',metaDescription:''}
  ];
  const html=discoveryHtml('/',articles);
  assert.match(html,/<article class="dl-card" dir="ltr" lang="en"><small>UAE<\/small>/);
  assert.match(html,/<article class="dl-card" dir="rtl" lang="ar"><small>السعودية<\/small>/);
  assert.match(html,/href="\/en\/articles\/en-uae-mouse"[^>]*>Read article ←/);
  assert.match(html,/href="\/articles\/saudi-arabic-guide"[^>]*>اقرأ المقال ←/);
  assert.match(html,/Compare product suitability, seller, delivery and final cart total/);
  assert.match(html,/دليل عملي قبل الشراء واستخدام الكوبون/);
});

test('legacy English article recognized by language source with no explicit language',()=>{
  const html=discoveryHtml('/uae',[{...base,slug:'en-uae-legacy',country:'AE',title:'UAE product guide',languageSource:'native-intent-v6-canary'}]);
  assert.match(html,/dir="ltr" lang="en"/);
  assert.match(html,/href="\/en\/articles\/en-uae-legacy"/);
  assert.match(html,/Read article ←/);
  assert.doesNotMatch(html,/<article class="dl-card" dir="rtl"/);
});
