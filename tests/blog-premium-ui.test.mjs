import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOG_PREMIUM_CSS,blogPremiumHero,blogCardCategory,BLOG_PREMIUM_INFO} from '../blog-premium-ui.js';
import {couponSvg,featuredSvg,SVG_LAYOUT_INFO} from '../svg-engine.js';
import {spawnSync} from 'node:child_process';

test('professional blog presents two actual market coupons, a balanced hero and only one region filter',()=>{
 const sample=blogPremiumHero({title:'مدونة كوبونات نون',description:'دليل الشراء',articles:9736,pages:650,page:2,market:'SA',latestPublishedAt:'2026-11-22T18:36:00Z'});
 assert.match(sample,/data-blog-premium="v1"/);
 assert.equal((sample.match(/<h1>/g)||[]).length,1);
 assert.match(sample,/9,736/);assert.match(sample,/650/);
 assert.match(sample,/href="\/saudi\/noon-coupon-code"/);
 assert.match(sample,/href="\/uae\/noon-coupon-code"/);
 assert.match(sample,/NOV170/);assert.match(sample,/NOV188/);
 assert.match(sample,/توقيت القاهرة/);
 assert.match(sample,/href="\/blog\/saudi" aria-current="page" class="active"/);
 assert.match(sample,/href="\/golden-keywords"/);
 assert.ok(!/تم التحقق|موثق|خصم مضمون/.test(sample));
 assert.match(BLOG_PREMIUM_CSS,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(BLOG_PREMIUM_CSS,/@media\(max-width:570px\)/);
 assert.match(BLOG_PREMIUM_CSS,/\.card\.leadCard/);
 assert.equal(BLOG_PREMIUM_INFO.staticSafe,true);
});
test('article cards classify the actual topic without inventing sales or duplicate pages',()=>{
 assert.equal(blogCardCategory('جوال سامسونج S26 Ultra','saudi-buyer-samsung-galaxy'),'جوالات وهواتف');
 assert.equal(blogCardCategory('Perfumes Noon UAE','uae-buyer-perfume'),'العطور والجمال');
 assert.equal(blogCardCategory('عربات أطفال جوي','saudi-buyer-joie-stroller'),'الأم والطفل');
 assert.equal(blogCardCategory('Pressure cooker Instant Pot','saudi-buyer-instant-pot-cooker'),'المنزل والمطبخ');
 assert.equal(blogCardCategory('Random buying guide','unknown'),'أدلة الشراء');
});
test('all five premium cover variants show a giant code and correct Arabic/English heading',()=>{
 assert.equal(SVG_LAYOUT_INFO.version,12);
 for(const market of ['SA','AE'])for(let i=1;i<=5;i++){
  const code=market==='SA'?'NOV170':'NOV188';
  const svg=couponSvg({country:market,coupon:code,title:'Samsung Galaxy Noon Coupon',variant:i});
  assert.match(svg,/width="1600" height="1000" viewBox="0 0 1600 1000"/);
  assert.match(svg,/data-noon-cover="coupon-first-v12"/);
  assert.match(svg,/font-size="136"/);
  assert.ok(svg.includes(code));
  assert.match(svg,market==='SA'?/كوبون خصم نون/:/NOON DISCOUNT COUPON/);
  assert.doesNotMatch(svg,/discount up to|verified savings|10% off/i);
  assert.doesNotMatch(svg,/&(?!amp;|lt;|gt;|quot;|apos;|#(?:\d+|x[0-9a-f]+);)/i,'invalid SVG XML entity in '+market+' variant '+i);
 }
 assert.match(featuredSvg({country:'SA',coupon:'NOV170'}),/كوبون خصم نون/);
});

test('Every market and SVG theme parses as actual well-formed XML, even with an ampersand in the subject',()=>{
 const validate="import sys, xml.etree.ElementTree as ET; r=ET.fromstring(sys.stdin.read()); assert r.tag.endswith('svg'); assert r.attrib['width']=='1600'; assert r.attrib['height']=='1000'";
 for(const country of ['SA','AE'])for(let variant=1;variant<=5;variant++){
  const code=country==='SA'?'NOV170':'NOV188';
  const svg=couponSvg({country,variant,coupon:code,title:'Noon TV & Audio, seller verification'});
  const parsed=spawnSync('python3',['-c',validate],{input:svg,encoding:'utf8',timeout:5000});
  assert.equal(parsed.status,0,country+' variant '+variant+': '+parsed.stderr);
 }
});
