import test from 'node:test';
import assert from 'node:assert/strict';
import app,{isPublicHtmlHeadRoute,mirrorGetForPublicHead} from '../discovery-entry.js';

const root='https://noondealsnow.com';

test('only public HTML routes qualify for GET-derived HEAD metadata',()=>{
  for(const path of [
    '/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price',
    '/articles/saudi-noon-coupon',
    '/en/uae/product/iphone-18-pro-max',
    '/saudi/category/computers',
    '/coupons','/blog/archive','/en/saudi'
  ])assert.equal(isPublicHtmlHeadRoute(path),true,path);
  for(const path of [
    '/','/api/health','/admin','/sitemap.xml','/sitemap-hubs.xml',
    '/robots.txt','/favicon.svg','/assets/main.js','/en'
  ])assert.equal(isPublicHtmlHeadRoute(path),false,path);
});

test('HEAD mirrors the canonical GET status, caching and indexing headers without a body',async()=>{
  const url=root+'/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price?ref=search';
  let count=0;
  const res=await mirrorGetForPublicHead(new Request(url,{method:'HEAD'}),async req=>{
    count++;
    assert.equal(req.method,'GET');
    assert.equal(req.url,url);
    assert.equal(req.headers.get('x-internal-seo-head-parity'),'1');
    return new Response('<html>indexed</html>',{status:200,headers:{
      'content-type':'text/html; charset=utf-8',
      'x-robots-tag':'index, follow',
      'cache-control':'public, max-age=30',
      'content-length':'20'
    }});
  });
  assert.equal(count,1);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('x-robots-tag'),'index, follow');
  assert.equal(res.headers.get('cache-control'),'public, max-age=30');
  assert.equal(res.headers.has('content-length'),false);
  assert.equal(res.headers.get('x-public-html-head-parity'),'get-status-v1');
  assert.equal(await res.text(),'');
});

test('HEAD preserves a genuinely missing page and its noindex directive',async()=>{
  const res=await mirrorGetForPublicHead(new Request(root+'/articles/absent',{method:'HEAD'}),
    async()=>new Response('Not found',{status:404,headers:{'x-robots-tag':'noindex, follow'}}));
  assert.equal(res.status,404);
  assert.equal(res.headers.get('x-robots-tag'),'noindex, follow');
  assert.equal(await res.text(),'');
});

test('real English product hub serves identical GET/HEAD metadata and a direct official-store buying path',async()=>{
  globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
  const env={SITE_ORIGIN:root,CONTENT_FINAL:{get:async()=>null}};
  const url=root+'/en/uae/product/iphone-18-pro-max';
  const get=await app.fetch(new Request(url),env,{waitUntil:()=>{}});
  const body=await get.text();
  const head=await app.fetch(new Request(url,{method:'HEAD'}),env,{waitUntil:()=>{}});
  assert.equal(get.status,200);
  assert.equal(head.status,get.status);
  assert.equal(head.headers.get('x-robots-tag'),get.headers.get('x-robots-tag'));
  assert.equal(head.headers.get('x-public-html-head-parity'),'get-status-v1');
  assert.equal(await head.text(),'');
  assert.match(body,/<title>[^<]+ \| Noon Deals Now<\/title>/);
  assert.match(body,/Find on Noon UAE/);
  assert.match(body,/https:\/\/www\.noon\.com\/uae-en\/search\?q=iPhone%2018%20Pro%20Max/);
  assert.match(body,/Prices and availability change/);
});
