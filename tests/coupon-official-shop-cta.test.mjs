import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET} from '../approved-coupons.js';
import {readFileSync} from 'node:fs';

const urls={SA:'https://www.noon.com/saudi-ar/',AE:'https://www.noon.com/uae-ar/'};
for(const market of ['SA','AE']){
  for(const code of HOMEPAGE_COUPONS_BY_MARKET[market]){
    test('approved '+market+' coupon '+code+' has clear official-store CTA and real-click attribution only',async()=>{
      const res=await app.fetch(new Request('https://noondealsnow.com/coupon/'+code.toLowerCase()),{});
      assert.equal(res.status,200);
      const html=await res.text();
      const article=(html.match(/<article class="coupon">[\s\S]*?<\/article>/)||[])[0]||'';
      assert.ok(article,'single coupon card must exist');
      assert.match(article,new RegExp('data-copy="'+code+'"'));
      const links=[...article.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]);
      const official=links.filter(a=>a.includes('data-shop-click="'+code+'"'));
      assert.equal(official.length,1,'exactly one official checkout action for this coupon');
      assert.ok(official[0].includes('href="'+urls[market]+'"'));
      assert.ok(official[0].includes('data-market="'+market+'"'));
      assert.ok(official[0].includes('data-placement="featured_coupon"'));
      assert.ok(official[0].includes('rel="sponsored noopener noreferrer"'));
      assert.ok(official[0].includes('target="_blank"'));
      const outboundHref=official[0].match(/href="([^"]+)"/)?.[1]||'';
      const destination=new URL(outboundHref);
      assert.equal(destination.hostname,'www.noon.com');
      assert.equal(destination.search,'','official CTA must not inject affiliate or tracking parameters');
      assert.match(article,new RegExp('افتح نون '+(market==='SA'?'السعودية':'الإمارات')+' وجرّب '+code));
      assert.match(html,new RegExp('rel="canonical" href="https://noondealsnow.com/coupon/'+code.toLowerCase()+'"'));
    });
  }
}
test('real visitor click dispatch is owned by existing conversion system; no invented purchase',()=>{
  const runtime=readFileSync(new URL('../brand-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/el.hasAttribute\('data-shop-click'\)\?'shop_click'/);
  assert.match(runtime,/destination_host/);
  const coupon=readFileSync(new URL('../index.js',import.meta.url),'utf8');
  assert.ok(!coupon.includes("gtag('event','purchase'"));
  assert.ok(coupon.includes('data-shop-click="${code}"'));
});
