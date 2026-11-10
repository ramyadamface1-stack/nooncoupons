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
test('direct Cloudflare key inventory fails closed when private service binding is unavailable',async()=>{
 const res=await handleAdminApi(new Request(origin+'/api/admin/ai-v2-keys',{
  method:'POST',headers:{cookie:'nc_admin=fake-valid-cookie',origin,'content-type':'application/json'},
  body:'{}'
 }),env());
 assert.equal(res.status,503);
 const json=await res.json();
 assert.equal(json.error,'direct_cloudflare_binding_missing');
});

test('served admin dashboard JavaScript parses successfully in browser syntax',async()=>{
 const r=await renderAdmin(new Request(origin+'/admin',{headers:{cookie:'nc_admin=fake-valid-cookie'}}),env());
 const html=await r.text();
 const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>=1);
 for(const script of scripts){try{new Script(script[1],{filename:'rendered-admin-inline.js'})}catch(e){throw Error('Admin inline JS syntax: '+String(e.stack||e).split('\n').slice(0,7).join('\n'))}}
});

test('manual action requires enabled admin policy, but NOT a browser GitHub PAT',async()=>{
 const base=env(),calls=[];
 base.AI_V2_DIRECT_ADMIN={status:async()=>({schedulerEnabled:true,githubRuntime:false}),dispatchOnce:async()=>{calls.push('rpc');return {ok:true,dispatched:true,reason:'DIRECT_REQUEST_QUEUED'}}};
 const req=new Request(origin+'/api/admin/ai-v2-run-now',{method:'POST',
    headers:{cookie:'nc_admin=fake-valid-cookie',origin,'content-type':'application/json'},
    body:'{}'});
 const res=await handleAdminApi(req,base);
 assert.equal(res.status,202);
 const output=await res.json();
 assert.equal(output.dispatched,true);
 assert.equal(output.published,false);
 assert.deepEqual(calls,['rpc']);
});

test('admin cannot bypass a scheduler that is not verified: private RPC refuses',async()=>{
 const base=env(),calls=[];
 base.AI_V2_DIRECT_ADMIN={status:async()=>({schedulerEnabled:false,githubRuntime:false}),dispatchOnce:async()=>{
   calls.push('rpc');return {dispatched:false,reason:'SCHEDULER_PAUSED'};
 }};
 const req=new Request(origin+'/api/admin/ai-v2-run-now',{method:'POST',
   headers:{cookie:'nc_admin=fake-valid-cookie',origin,'content-type':'application/json'},
   body:'{}'});
 const res=await handleAdminApi(req,base);
 assert.equal(res.status,409);
 assert.equal((await res.json()).error,'direct_engine_canary_not_active');
 assert.deepEqual(calls,[]);
});
test('manual action never starts concurrent generation if scheduler reports busy',async()=>{
 const base=env(),calls=[];
 base.AI_V2_DIRECT_ADMIN={status:async()=>({schedulerEnabled:true,githubRuntime:false}),dispatchOnce:async()=>{
   calls.push('rpc');return {ok:false,dispatched:false,reason:'PUBLISHER_BUSY_SKIP_DISPATCH'};
 }};
 const res=await handleAdminApi(new Request(origin+'/api/admin/ai-v2-run-now',{method:'POST',
   headers:{cookie:'nc_admin=fake-valid-cookie',origin,'content-type':'application/json'},
   body:'{}'}),base);
 assert.equal(res.status,409);
 assert.equal((await res.json()).error,'generation_already_running');
 assert.deepEqual(calls,['rpc']);
});
test('manual action fails closed when scheduler RPC is not configured, never asks for browser PAT',async()=>{
 const res=await handleAdminApi(new Request(origin+'/api/admin/ai-v2-run-now',{method:'POST',
   headers:{cookie:'nc_admin=fake-valid-cookie',origin,'content-type':'application/json'},
   body:'{}'}),env());
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'direct_cloudflare_binding_missing');
});
test('old generator button visibly routes to Gemini/Groq and never triggers legacy generation',async()=>{
 const response=await renderAdmin(new Request(origin+'/admin',{headers:{cookie:'nc_admin=fake-valid-cookie'}}),env());
 const html=await response.text();
 assert.match(html,/id="generatorPanel"><h2>نظام Workers AI القديم/);
 assert.match(html,/id="generateBtn" type="button">افتح مولد Gemini \/ Groq/);
 assert.match(html,/id="aiV2Markets"/);
 assert.match(html,/QUEUE_WINDOW_EMPTY/);
 assert.ok(!html.includes("$('generateBtn').onclick=generateNow"),'legacy generate button must not issue generation');
 assert.match(html,/لا يوجد توليد أو نشر مؤكد/);
});
