import test from 'node:test';
import assert from 'node:assert/strict';
import brandRuntime from '../brand-runtime.js';
import articleRuntime from '../auto-platform.js';

const ORIGIN='https://noondealsnow.com';

test('site favicon is a scalable, explicitly high-resolution organization mark',async()=>{
  const response=await brandRuntime.fetch(new Request(ORIGIN+'/favicon.svg'),{},{});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')||'',/image\/svg\+xml/);
  const svg=await response.text();
  assert.match(svg,/<svg\b[^>]*width="256"[^>]*height="256"/);
  assert.match(svg,/viewBox="0 0 64 64"/);
});

test('R2 article uses one 1600x1000 hero and social image without false human-review assertions',async()=>{
  const slug='test-noon-schema-article';
  const env={SITE_ORIGIN:ORIGIN,CONTENT_FINAL:{
    async get(key){
      if(key!=='articles/'+slug+'.html')return null;
      return {
        customMetadata:{status:'published',c:'SA',cp:'NOV170',t:'دليل شراء الأجهزة من نون السعودية',kw:'شراء الأجهزة من نون',at:'2026-11-15T10:00:00Z'},
        uploaded:new Date('2026-11-15T10:00:00Z'),
        async text(){return '<h2>قبل الشراء</h2><p>راجع وصف المنتج وسعر السلة قبل استخدام الكوبون.</p>'}
      };
    }
  }};
  const response=await articleRuntime.fetch(new Request(ORIGIN+'/articles/'+slug),env,{});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/<meta property="og:image:width" content="1600">/);
  assert.match(html,/<meta property="og:image:height" content="1000">/);
  assert.match(html,/<figure class="hero"><img[^>]*width="1600" height="1000"/);
  assert.doesNotMatch(html,/تمت مراجعة الصفحة تحريرياً/);
  assert.match(html,/معلومات الكوبون والسوق/);
  assert.match(html,/"width":1600,"height":1000/);
});
