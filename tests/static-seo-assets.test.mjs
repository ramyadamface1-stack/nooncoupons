import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

test('Only canonical public SEO files may bypass Worker request quota',()=>{
  const cfg=JSON.parse(readFileSync('wrangler.new-account-production.jsonc','utf8'));
  assert.deepEqual(cfg.assets,{directory:'./.ndn-static-assets',run_worker_first:false});
  assert.equal(cfg.triggers.crons.length,0);
  execFileSync(process.execPath,['scripts/build-ndn-static-seo-assets.mjs'],{stdio:'pipe'});
  execFileSync(process.execPath,['scripts/build-ndn-static-market-sitemaps.mjs'],{stdio:'pipe'});
  const names=readdirSync('.ndn-static-assets').sort();
  assert.deepEqual(names,['llms.txt','robots.txt','sitemap-core.xml','sitemap-coupons-saudi.xml','sitemap-coupons-uae.xml','sitemap-coupons.xml','sitemap-guides.xml','sitemap-pages.xml']);
  assert.ok(!names.includes('index.html')&&!names.includes('404.html'));
  const robots=readFileSync('.ndn-static-assets/robots.txt','utf8');
  const core=readFileSync('.ndn-static-assets/sitemap-core.xml','utf8');
  const llms=readFileSync('.ndn-static-assets/llms.txt','utf8');
  for(const str of [
   'User-agent: *','Disallow: /admin','Disallow: /api/',
   'User-agent: GPTBot','Disallow: /assets/coupon-svg/',
   'User-agent: OAI-SearchBot','Sitemap: https://noondealsnow.com/sitemap.xml',
   'Sitemap: https://noondealsnow.com/sitemap-ai-v2.xml'
  ])assert.ok(robots.includes(str),'Missing robots line: '+str);
  assert.ok(core.includes('<urlset'));
  for(const code of ['nov170','nov188'])assert.ok(core.includes('https://noondealsnow.com/coupon/'+code));
  assert.ok(llms.includes('NOV170')&&llms.includes('NOV188'));
  const getGroup=(agent)=>{
    const lines=robots.split(String.fromCharCode(10));
    const i=lines.indexOf('User-agent: '+agent);
    assert.ok(i>=0);
    const following=lines.slice(i+1);
    const finish=following.findIndex(line=>line.startsWith('User-agent:')||line.startsWith('Sitemap:'));
    return following.slice(0,finish>=0?finish:undefined).join(' ');
  };
  assert.ok(getGroup('GPTBot').includes('Disallow: /articles/'));
  assert.ok(getGroup('GPTBot').includes('Disallow: /en/articles/'));
  for(const agent of ['*','OAI-SearchBot']){
    assert.ok(!getGroup(agent).includes('Disallow: /articles/'));
    assert.ok(!getGroup(agent).includes('Disallow: /en/articles/'));
  }
  assert.ok(!robots.includes('Disallow: /coupon/'));
  assert.ok(!names.some(x=>x.endsWith('.html')));
  for(const name of ['pages','guides','coupons','coupons-saudi','coupons-uae']){
    const filename='sitemap-'+name+'.xml';
    const body=readFileSync('.ndn-static-assets/'+filename,'utf8');
    assert.match(body,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.ok(!/<html|<script|<!DOCTYPE/i.test(body));
    const urls=[...body.matchAll(/<loc>([^<>]+)<\/loc>/g)].map(m=>m[1]);
    assert.ok(urls.length>0);
    assert.equal(urls.length,new Set(urls).size);
    for(const url of urls){
      assert.ok(url.startsWith('https://noondealsnow.com/'));
      assert.ok(!/\/api\/|\/admin\//i.test(url));
    }
  }
  const sa=readFileSync('.ndn-static-assets/sitemap-coupons-saudi.xml','utf8');
  const ae=readFileSync('.ndn-static-assets/sitemap-coupons-uae.xml','utf8');
  assert.ok(sa.includes('https://noondealsnow.com/coupon/nov170'));
  assert.ok(!sa.includes('https://noondealsnow.com/coupon/nov188'));
  assert.ok(ae.includes('https://noondealsnow.com/coupon/nov188'));
  assert.ok(!ae.includes('https://noondealsnow.com/coupon/nov170'));
  assert.ok(readFileSync('.ndn-static-assets/sitemap-pages.xml','utf8').includes('<loc>https://noondealsnow.com/</loc>'));
});
