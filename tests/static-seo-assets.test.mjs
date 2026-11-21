import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

test('Only canonical public SEO files may bypass Worker request quota',()=>{
  const cfg=JSON.parse(readFileSync('wrangler.new-account-production.jsonc','utf8'));
  assert.deepEqual(cfg.assets,{directory:'./.ndn-static-assets',run_worker_first:false});
  assert.equal(cfg.triggers.crons.length,0);
  execFileSync(process.execPath,['scripts/build-ndn-static-seo-assets.mjs'],{stdio:'pipe'});
  const names=readdirSync('.ndn-static-assets').sort();
  assert.deepEqual(names,['llms.txt','robots.txt','sitemap-core.xml']);
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
    const start=robots.indexOf('User-agent: '+agent+'\\n');
    assert.ok(start>=0);
    const following=robots.slice(start+('User-agent: '+agent+'\\n').length);
    return following.split(/\\nUser-agent: |\\nSitemap: /)[0];
  };
  assert.ok(getGroup('GPTBot').includes('Disallow: /articles/'));
  assert.ok(getGroup('GPTBot').includes('Disallow: /en/articles/'));
  for(const agent of ['*','OAI-SearchBot']){
    assert.ok(!getGroup(agent).includes('Disallow: /articles/'));
    assert.ok(!getGroup(agent).includes('Disallow: /en/articles/'));
  }
  assert.ok(!robots.includes('Disallow: /coupon/'));
  assert.ok(!names.some(x=>x.endsWith('.html')));
});
