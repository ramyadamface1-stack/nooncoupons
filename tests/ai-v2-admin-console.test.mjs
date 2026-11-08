import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {renderAdmin} from '../admin-page.js';
import {handleAdminApi} from '../admin-runtime.js';

const origin='https://noondealsnow.com';
function env(){
 return {GENERATOR_CONTROL:{
  idFromName:()=>1,get:()=>({fetch:async url=>{
   if(String(url).includes('/session'))return Response.json({
     email:'ramyshahin02@gmail.com',expires:'2099-01-01T00:00:00Z'
   });
   return Response.json({enabled:true,intervalMinutes:1,updatedAt:null});
  }})
 }};
}
test('admin dashboard renders new key sections, real-status bar and all operator buttons',async()=>{
 const response=await renderAdmin(new Request(origin+'/admin',{headers:{cookie:'nc_admin=fake-valid-cookie'}}),env());
 assert.equal(response.status,200);
 const html=await response.text();
 for(const id of ['aiV2Panel','aiV2HealthBar','aiV2GeminiKeys','aiV2GroqKeys',
  'aiV2KeyFile','aiV2BulkKeys','aiV2Provider','aiV2GithubToken',
  'aiV2StartBtn','aiV2StopBtn','aiV2ImportBtn','aiV2RunNowBtn','aiV2LoadSecretsBtn',
  'aiV2VerifiedHour','aiV2LastChecked'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/\/api\/admin\/ai-v2-monitor/);
 assert.match(html,/\/api\/admin\/ai-v2-key-import/);
 assert.match(html,/إنشاء|حفظ المفاتيح مشفرة/);
 assert.match(response.headers.get('x-robots-tag'),/noindex/);
});
test('anonymous user cannot access key management or monitor routes',async()=>{
 for(const p of ['/api/admin/ai-v2-keys','/api/admin/ai-v2-key-import','/api/admin/ai-v2-run-now']){
  const req=new Request(origin+p,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  const res=await handleAdminApi(req,env());
  assert.equal(res.status,401,p);
 }
});
test('admin API rejects cross-origin key submissions before GitHub network requests',async()=>{
 const res=await handleAdminApi(new Request(origin+'/api/admin/ai-v2-key-import',{
  method:'POST',headers:{cookie:'nc_admin=fake-valid-cookie',origin:'https://evil.invalid','content-type':'application/json'},
  body:JSON.stringify({provider:'gemini',keys:'placeholder'})
 }),env());
 assert.equal(res.status,403);
 assert.equal((await res.json()).error,'invalid_origin');
});
test('admin GitHub operations require explicit scoped secret credential',async()=>{
 const res=await handleAdminApi(new Request(origin+'/api/admin/ai-v2-keys',{
  method:'POST',headers:{cookie:'nc_admin=fake-valid-cookie',origin,'content-type':'application/json'},
  body:'{}'
 }),env());
 assert.equal(res.status,409);
 const json=await res.json();
 assert.equal(json.error,'github_token_required');
});

test('served admin dashboard JavaScript parses successfully in browser syntax',async()=>{
 const r=await renderAdmin(new Request(origin+'/admin',{headers:{cookie:'nc_admin=fake-valid-cookie'}}),env());
 const html=await r.text();
 const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>=1);
 for(const script of scripts)assert.doesNotThrow(()=>new Script(script[1]),'admin interactive JS must parse');
});
