import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {SYSTEM1_HTML,renderSystem1} from '../system1-control-center.js';
import {readSystem1Keywords,system1AdminSummary} from '../system1-admin-data.js';
import {handleAdminApi} from '../admin-runtime.js';

const origin='https://noondealsnow.com';
function mockEnv(){
 return {GENERATOR_CONTROL:{idFromName:()=>1,get:()=>({fetch:async url=>{
  if(String(url).includes('/session'))return Response.json({email:'ramyshahin02@gmail.com',expires:'2099-01-01T00:00:00Z'});
  return Response.json({enabled:true,intervalMinutes:1});
 }})}};
}
const session=new Request(origin+'/admin/system1',{headers:{cookie:'nc_admin=fake'}});

test('SYSTEM1 renders all ten organized tabs and separates generation/publishing status',async()=>{
 const result=await renderSystem1(session,mockEnv());
 assert.equal(result.status,200);
 const html=await result.text();
 for(const tab of ['overview','keywords','generation','keys','quota','stockpile','publishing','quality','articles','diagnostics']){
   assert.match(html,new RegExp('data-tab="'+tab+'"'));
   assert.match(html,new RegExp('id="view-'+tab+'"'));
 }
 assert.equal((html.match(/class="navbtn/g)||[]).length,10);
 assert.match(html,/id="genState"/);assert.match(html,/id="pubState"/);
 assert.match(html,/admin\/legacy/);
 assert.match(result.headers.get('x-robots-tag'),/noindex/);
 assert.match(result.headers.get('cache-control'),/no-store/);
 assert.doesNotMatch(html,/id="publishInterval"[^>]*>/);
 const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 for(const code of scripts)assert.doesNotThrow(()=>new Script(code[1]));
});
test('SYSTEM1 is private and refuses anonymous access',async()=>{
 const result=await renderSystem1(new Request(origin+'/admin/system1'),mockEnv());
 assert.equal(result.status,302);
 assert.equal(result.headers.get('location'),'/admin');
 for(const url of ['/api/admin/system1/summary','/api/admin/system1/keywords']){
   const response=await handleAdminApi(new Request(origin+url),mockEnv());
   assert.equal(response.status,401);
 }
});
test('SYSTEM1 status reports unknown stockpile and unverified publication separately',async()=>{
 const env={CONTENT_FINAL:{get:async()=>null}};
 const result=await system1AdminSummary(env,{
  monitor:async()=>({ok:true,status:'queue-no-eligible-topics',scheduler:{reachable:true,enabled:true,intervalMinutes:1},
   providers:{gemini:{total:43},groq:{total:1}},markets:[],verified:{ledgerAvailable:true,lastHour:{total:0},last24Hours:{total:4}}}),
  control:async()=>({enabled:true,intervalMinutes:1})
 });
 assert.equal(result.generation.status,'WAITING_ELIGIBLE_TOPIC');
 assert.equal(result.publishing.status,'NO_VERIFIED_PUBLICATION_LAST_HOUR');
 assert.equal(result.publishing.publicationIntervalMinutes,null);
 assert.equal(result.providers.gemini.total,43);
 assert.equal(result.capabilities.fiveStoredValidatedVisuals,false);
 assert.equal(result.stockpile.available,false);
 assert.equal(result.warnings.includes('READY_STOCKPILE_NOT_MEASURED'),true);
});
test('R2 keyword inventory is bounded, searchable and does not claim live statuses',async()=>{
 const rows=[{country:'SA',keyword:'مقارنة جوالات سامسونج قبل الطلب',slug:'saudi-samsung-checklist-test',brand:'Samsung',category:'جوالات'},
  {country:'AE',keyword:'Noon UAE air fryer comparison',slug:'uae-ninja-airfryer-checklist',brand:'Ninja',category:'Air fryers'}];
 const env={CONTENT_FINAL:{get:async key=>{
   assert.equal(key,'_ops/system1/keyword-opportunities-v1.json');
   return {size:400,text:async()=>JSON.stringify({version:1,generatedAt:'2026-11-09T00:00:00Z',total:2,items:rows})};
 }}};
 const data=await readSystem1Keywords(env,{market:'SA',q:'Samsung'});
 assert.equal(data.ok,true);assert.equal(data.available,true);
 assert.equal(data.items.length,1);assert.equal(data.items[0].country,'SA');
 assert.equal(data.seoDemandMeasured,false);assert.equal(data.mutableQueue,false);
 assert.equal((await readSystem1Keywords(env,{market:'INVALID'})).ok,false);
 assert.equal((await readSystem1Keywords(env,{limit:300})).ok,false);
});
test('no R2 keyword snapshot is unknown, never an invented empty queue',async()=>{
 const x=await readSystem1Keywords({CONTENT_FINAL:{get:async()=>null}});
 assert.equal(x.ok,true);assert.equal(x.available,false);assert.equal(x.total,null);
});
