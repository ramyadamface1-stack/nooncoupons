import test from 'node:test';
import assert from 'node:assert/strict';
import {enhanceLandingPage, LANDING_CONTENT_V3} from '../landing-content-v3.js';
import {commerceLanding} from '../commerce-pages-v2.js';

const ORIGIN='https://noondealsnow.com';
const original=()=>new Response('<!doctype html><html><head></head><body><main><h1>Existing landing</h1></main></body></html>',{
  headers:{'content-type':'text/html; charset=utf-8'}
});

test('Arabic landing content is focused, stable and keeps the existing markup',async()=>{
  const res=await enhanceLandingPage('/saudi/category/mobiles',ORIGIN,original());
  const html=await res.text(),wordCount=Number(res.headers.get('x-landing-word-count'));
  assert.ok(html.includes('<h1>Existing landing</h1>'));
  assert.ok(wordCount>=1800&&wordCount<=2500,`unexpected guide length: ${wordCount}`);
  assert.ok(html.length<35000,`landing depth should not add 200 KB to mobile HTML: ${html.length}`);
  assert.equal((html.match(/class="long-guide-section"/g)||[]).length,4);
  assert.equal(res.headers.get('x-landing-content'),'v5');
  assert.equal(LANDING_CONTENT_V3.minWords,1800);
  assert.ok(!html.includes('dateModified":"2026-09-26'));
  assert.ok(!html.includes('16 سبتمبر 2026'));
  assert.ok(!html.includes('ما الذي يجب مراجعته في الأحذية والملابس؟'),'mobile pages should not inject fashion FAQs');
  assert.ok(html.includes('ما الذي يختلف في الإلكترونيات والأجهزة؟'));
  const again=await enhanceLandingPage('/saudi/category/mobiles',ORIGIN,new Response(html,{headers:{'content-type':'text/html'}}));
  assert.equal(await again.text(),html,'reapplication must not duplicate guides');
});

test('Fashion landings receive fashion-specific FAQs, without unrelated electronics questions',async()=>{
  const res=await enhanceLandingPage('/saudi/category/shoes',ORIGIN,original());
  const html=await res.text();
  assert.ok(html.includes('ما الذي يجب مراجعته في الأحذية والملابس؟'));
  assert.ok(!html.includes('ما الذي يختلف في الإلكترونيات والأجهزة؟'));
});

test('Arabic landing displays only metadata-matched, indexable, same-market article links',async()=>{
  let reads=0;
  const rows=[
    {slug:'saudi-mobiles-guide',title:'دليل الجوالات',country:'SA',categoryKey:'mobiles',indexable:true},
    {slug:'uae-mobiles-guide',country:'AE',categoryKey:'mobiles',indexable:true},
    {slug:'hidden-mobiles-guide',country:'SA',categoryKey:'mobiles',indexable:false},
    {slug:'unrelated-beauty-guide',country:'SA',categoryKey:'beauty',indexable:true},
    {slug:'unsafe/slug',country:'SA',categoryKey:'mobiles',indexable:true}
  ];
  const env={CONTENT_FINAL:{get:async()=>{reads++;return {json:async()=>({version:1,articles:rows})}}}};
  const res=await enhanceLandingPage('/saudi/category/mobiles',ORIGIN,original(),env);
  const html=await res.text();
  assert.ok(html.includes('href="/articles/saudi-mobiles-guide"'),`matched article missing; manifest reads=${reads}`);
  for(const slug of ['uae-mobiles-guide','hidden-mobiles-guide','unrelated-beauty-guide','unsafe/slug'])assert.ok(!html.includes('/articles/'+slug));
  assert.equal(reads,1,'shared manifest must not be read repeatedly for one request');
});

test('English product and coupon leaf pages include themselves in breadcrumb schema',async()=>{
  for(const path of ['/en/uae/product/iphone-18-pro-max','/en/uae/noon-coupon-code']){
    const res=await commerceLanding(path,ORIGIN,{});
    assert.equal(res.status,200);
    const html=await res.text();
    const ldJson=html.match(/<script type="application\/ld\+json" data-schema="english-collection">([\s\S]*?)<\/script>/);
    assert.ok(ldJson,`missing collection JSON-LD: ${path}`);
    const graph=JSON.parse(ldJson[1])['@graph'];
    const breadcrumbs=graph.find(x=>x['@type']==='BreadcrumbList')?.itemListElement||[];
    assert.equal(breadcrumbs.at(-1)?.item,ORIGIN+path);
    assert.equal(breadcrumbs.length,3);
    assert.equal(graph.find(x=>x['@type']==='CollectionPage')?.url,ORIGIN+path);
    if(path.includes('/product/')){
      assert.match(html,/Compare the same iPhone 18 Pro Max listing/);
      assert.match(html,/Apple brand guide \(Arabic\)/);
      assert.ok(!html.includes('"@type":"Offer"'),'no unverified price offers');
    }
  }
});

test('Arabic commercial routes emit one unambiguous canonical breadcrumb and organization graph',async()=>{
  for(const [path,neededParent] of [
    ['/saudi/category/mobiles','/saudi/categories'],
    ['/uae/brand/apple','/uae'],
    ['/uae/model/apple/iphone-plus-pro-max','/uae/brand/apple'],
    ['/saudi/categories','/saudi']
  ]){
    const base=await commerceLanding(path,ORIGIN,{});
    assert.equal(base.status,200);
    const enriched=await enhanceLandingPage(path,ORIGIN,base,{});
    const html=await enriched.text();
    const scripts=[...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    const graph=scripts.flatMap(s=>{
      const data=JSON.parse(s[1]);
      return data['@graph']||[data];
    });
    const breadcrumbs=graph.filter(x=>x['@type']==='BreadcrumbList');
    const organizations=graph.filter(x=>x['@type']==='Organization');
    const pages=graph.filter(x=>x['@type']==='CollectionPage');
    assert.equal(breadcrumbs.length,1,`${path} should not generate two BreadcrumbLists`);
    assert.equal(organizations.length,1,`${path} should not generate two publishers`);
    assert.equal(pages.length,1);
    assert.equal(breadcrumbs[0]['@id'],ORIGIN+path+'#breadcrumb');
    assert.equal(pages[0].breadcrumb['@id'],breadcrumbs[0]['@id']);
    const items=breadcrumbs[0].itemListElement;
    assert.equal(items[0].item,ORIGIN+'/');
    assert.equal(items.at(-1).item,ORIGIN+path);
    assert.ok(items.some(x=>x.item===ORIGIN+neededParent));
    assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
    assert.equal(graph.filter(x=>x['@type']==='FAQPage').length,1);
  }
});
