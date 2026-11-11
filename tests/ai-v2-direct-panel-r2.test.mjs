import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');

test('site admin imports keys only into Cloudflare encrypted R2 with session and CSRF',()=>{
 const source=read('admin-runtime.js'),cfg=JSON.parse(read('wrangler.new-account-production.jsonc'));
 assert.match(source,/if\(!\(await isAdmin\(req,env\)\)\)return json\(\{error:'unauthorized'\},401\)/);
 assert.match(source,/if\(origin&&origin!==u.origin\)return json/);
 assert.match(source,/req\.headers\.get\('sec-fetch-site'\)==='cross-site'/);
 assert.match(source,/env\.AI_V2_DIRECT_ADMIN\.keyInventory\(\)/);
 assert.match(source,/env\.AI_V2_DIRECT_ADMIN\.importKeys\(\{/);
 assert.match(source,/env\.AI_V2_DIRECT_ADMIN\.dispatchOnce\(\)/);
 assert.match(source,/direct_engine_canary_not_active/);
 assert.doesNotMatch(source,/const token=String\(env\.NOON_GITHUB_SECRETS_ADMIN_TOKEN/);
 assert.ok(cfg.services.some(x=>x.binding==='AI_V2_DIRECT_ADMIN'&&x.service==='noondealsnow-ai-direct-r2'));
 assert.ok(cfg.services.some(x=>x.binding==='AI_V2_DIRECT_HEALTH'&&x.service==='noondealsnow-ai-direct-r2'));
});
test('Arabic operator now uses Cloudflare key inventory, not a GitHub PAT',()=>{
 const panel=read('system1-control-center.js');
 assert.doesNotMatch(panel,/id="githubToken"|\$\('githubToken'\)|provider:\$\('keyProvider'\).value,keys:text,githubToken/);
 assert.match(panel,/عرض مفاتيح Cloudflare/);
 assert.match(panel,/حفظ مشفر في R2/);
 assert.match(panel,/api\/admin\/ai-v2-key-import/);
 assert.match(panel,/api\/admin\/ai-v2-keys/);
 assert.match(panel,/2026|R2/);
});
test('stable master key is created once, never put in code or R2',()=>{
 const workflow=read('.github/workflows/deploy-noondealsnow-cloudflare-direct-r2.yml');
 assert.match(workflow,/wrangler secret list --config cloudflare-ai-direct\/wrangler\.jsonc/);
 assert.match(workflow,/wrangler secret put NDN_KEYS_MASTER/);
 assert.match(workflow,/R2_ENCRYPTION_KEY=PRESERVED/);
 const engine=read('cloudflare-ai-direct/keys.mjs');
 assert.match(engine,/crypto\.subtle\.encrypt/);
 assert.match(engine,/AES-GCM/);
 assert.doesNotMatch(engine,/console\.log\(.*key/);
});

test('dashboard independently displays Cloudflare direct canary stage and refuses false manual-run success',()=>{
 const ui=read('system1-control-center.js');
 assert.match(ui,/id="directEngineBanner"/);
 assert.match(ui,/\/api\/admin\/ai-v2-direct\/status/);
 assert.match(ui,/direct_engine_canary_not_active/);
 assert.match(ui,/d\.schedulerEnabled===true&&d\.githubRuntime===false&&d\.directStage==='production'/);
 assert.doesNotMatch(ui,/github_token_expired|github_token_permissions/);
});

test('SYSTEM1 displays private direct readiness without confusing old GitHub generator with Cloudflare engine',()=>{
 const ui=read('system1-control-center.js');
 const admin=read('admin-runtime.js');
 for(const name of ['direct_provider_keys_missing','direct_key_storage_unavailable','native_publish_token_missing'])
  assert.ok(ui.includes(name),'Missing Arabic UI blocker '+name);
 assert.match(ui,/d\.credentials\|\|\{\}/);
 assert.match(ui,/d\.readyForActivation===true/);
 assert.match(admin,/DIRECT_PROVIDER_KEYS_MISSING:'direct_provider_keys_missing'/);
 assert.match(admin,/NATIVE_PUBLISH_TOKEN_MISSING:'native_publish_token_missing'/);
 assert.doesNotMatch(admin,/GITHUB_TOKEN_INVALID_OR_EXPIRED:'github_token_expired'/);
});
