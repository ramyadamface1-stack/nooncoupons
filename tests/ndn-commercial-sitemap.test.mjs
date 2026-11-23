import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='.ndn-static-assets',origin='https://noondealsnow.com';
test('commercial and trust sitemaps list only confirmed indexable canonical pages',()=>{
 const xml=readFileSync(root+'/sitemap-commercial.xml','utf8');
 const urls=[...xml.matchAll(/<loc>([^<>]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(urls.length,89);
 assert.equal(new Set(urls).size,88);
 for(const url of urls){
  assert.ok(url.startsWith(origin+'/'),url);
  const path=url.slice(origin.length);
  const html=readFileSync(root+path+'.html','utf8');
  assert.ok(html.includes('<link rel="canonical" href="'+url+'">'),path);
  assert.ok(html.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),path);
 }
 assert.ok(urls.includes(origin+'/editorial-policy'));
 assert.ok(urls.includes(origin+'/brands'));
 assert.ok(urls.includes(origin+'/saudi/buying-guide/samsung-s26-ultra'));
 assert.ok(urls.includes(origin+'/saudi/buying-guide/existing-customers'));
 assert.ok(urls.includes(origin+'/uae/buying-guide/existing-customers'));
 assert.ok(urls.includes(origin+'/uae/buying-guide/mini-led-tv'));
 for(const path of ['/golden-keywords','/saudi/golden-keywords','/uae/golden-keywords'])assert.ok(urls.includes(origin+path),path);
 for(const brand of ['apple','samsung','xiaomi','nike','dyson','loreal','versace']){
   for(const country of ['saudi','uae'])assert.ok(urls.includes(origin+'/'+country+'/brand/'+brand),country+'/'+brand);
 }
 assert.ok(urls.includes(origin+'/saudi/category/mobiles'));
 assert.ok(urls.includes(origin+'/saudi-arabia/noon-coupon-code'));
 assert.ok(!urls.includes(origin+'/saudi/noon-coupon-code'));// duplicate route consolidates to historic canonical
 assert.ok(urls.includes(origin+'/uae/noon-coupon-code'));
 assert.ok(!urls.includes(origin+'/saudi/category/electronics'));
 const rootXml=readFileSync(root+'/sitemap.xml','utf8');
 assert.ok(rootXml.includes('<sitemap><loc>'+origin+'/sitemap-commercial.xml</loc></sitemap>'));
 const robots=readFileSync(root+'/robots.txt','utf8');
 assert.ok(robots.includes('Sitemap: '+origin+'/sitemap-commercial.xml'));
 assert.ok(robots.includes('Sitemap: '+origin+'/sitemap.xml'));
 const llms=readFileSync(root+'/llms.txt','utf8');
 assert.ok(llms.includes('Country-specific coupon buying guides'));
 assert.ok(llms.includes('/saudi-arabia/noon-coupon-code (Saudi Arabia: NOV170)'));
 assert.ok(llms.includes('/uae/noon-coupon-code (United Arab Emirates: NOV188)'));
});
