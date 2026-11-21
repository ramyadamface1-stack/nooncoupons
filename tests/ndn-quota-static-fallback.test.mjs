import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync} from 'node:fs';

test('commercial and guide HTML remains quota-independent while sensitive paths stay Worker-only',()=>{
  execFileSync(process.execPath,['scripts/build-ndn-quota-static-fallback.mjs'],{stdio:'pipe'});
  const cfg=JSON.parse(readFileSync('wrangler.new-account-production.jsonc','utf8'));
  assert.equal(cfg.assets.run_worker_first,false);
  const paths=['index.html','coupons.html','saudi.html','uae.html','blog.html',
    'coupon/nov170.html','coupon/nov188.html'];
  for(const path of paths){
    const html=readFileSync('.ndn-static-assets/'+path,'utf8');
    assert.match(html,/<meta name="ndn-quota-static-rescue" content="v1">/);
    assert.match(html,/<link rel="canonical" href="https:\/\/noondealsnow\.com\//);
    assert.match(html,/<html lang="ar" dir="rtl">/);
    if(path!=='blog.html')assert.match(html,/data-copy=/);
    else assert.match(html,/href="\/guide\//);
    assert.doesNotMatch(html,/Cloudflare.*1027/i);
  }
  for(const path of ['admin.html','admin/index.html','api/health.html','articles/index.html',
    'en/articles/index.html','404.html']){
    assert.equal(existsSync('.ndn-static-assets/'+path),false,path);
  }
  for(const code of ['NOV170','NOV188']){
    const text=readFileSync('.ndn-static-assets/coupon/'+code.toLowerCase()+'.html','utf8');
    assert.ok(text.includes('data-copy="'+code+'"'));
    assert.ok(text.includes('noon.com/'));
  }
  const all=readdirSync('.ndn-static-assets',{recursive:true}).filter(f=>f.endsWith('.html'));
  assert.equal(all.length,28);
});
