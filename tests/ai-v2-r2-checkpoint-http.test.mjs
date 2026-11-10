import test from 'node:test';
import assert from 'node:assert/strict';
import {saveCheckpointRest,readCheckpointRest} from '../automation/ai-v2/r2-checkpoints-http.mjs';

const config={checkpoint:{bucket:'nooncoupons-content-v2',prefix:'_ops/ai-v2-checkpoints/'}};
const base={articleId:'b'.repeat(24),state:'REQUEST_SENT',version:8,sections:[],sectionIndex:0};
const opts=fetchFn=>({accountId:'a'.repeat(32),token:'not-a-real-secret-for-tests',fetchFn});
const json=body=>new Response(body,{status:200,headers:{'content-type':'application/json'}});

test('timed-out R2 PUT is accepted only after exact GET readback, with no duplicate write',async()=>{
 let body=null;const methods=[];
 const state=await saveCheckpointRest(config,base,opts(async(_url,request)=>{
  methods.push(request.method);
  if(request.method==='PUT'){body=request.body;throw Error('The operation was aborted due to timeout')}
  return json(body);
 }));
 assert.deepEqual(state,JSON.parse(body));
 assert.deepEqual(methods,['PUT','GET']);
});

test('transport error with missing or mismatched R2 readback stays unverified, never re-PUT',async()=>{
 for(const readResult of [new Response('Not Found',{status:404}),
  json(JSON.stringify({...base,version:7,updatedAt:'2026-11-10T00:00:00Z'}))]){
  const methods=[];
  await assert.rejects(saveCheckpointRest(config,base,opts(async(_url,req)=>{
   methods.push(req.method);
   if(req.method==='PUT')throw Error('timeout');
   return readResult;
  })),/R2_HTTP_PUT_TRANSPORT_OUTCOME_UNVERIFIED/);
  assert.deepEqual(methods,['PUT','GET']);
 }
});

test('HTTP 503 after an R2 PUT still allows exactly one verified read-only recovery',async()=>{
 const methods=[];let body;
 const state=await saveCheckpointRest(config,base,opts(async(_url,req)=>{
  methods.push(req.method);
  if(req.method==='PUT'){body=req.body;return new Response('worker failure',{status:503})}
  return json(body);
 }));
 assert.deepEqual(state,JSON.parse(body));
 assert.deepEqual(methods,['PUT','GET']);
});

test('successful R2 PUT and transient readback GET timeout may recover with one more GET',async()=>{
 const methods=[];let body,reads=0;
 const state=await saveCheckpointRest(config,base,opts(async(_url,req)=>{
  methods.push(req.method);
  if(req.method==='PUT'){body=req.body;return new Response('ok',{status:200})}
  reads++;
  if(reads===1)throw Error('The operation was aborted due to timeout');
  return json(body);
 }));
 assert.deepEqual(state,JSON.parse(body));
 assert.deepEqual(methods,['PUT','GET','GET']);
});

test('persistent readback failures and definite 403 stay fail-closed',async()=>{
 const onTimeout=[];await assert.rejects(saveCheckpointRest(config,base,opts(async(_url,req)=>{
  onTimeout.push(req.method);
  if(req.method==='PUT')return new Response('ok',{status:200});
  throw Error('timeout');
 })),/R2_HTTP_CHECKPOINT_READBACK_UNVERIFIED/);
 assert.deepEqual(onTimeout,['PUT','GET','GET']);
 const definite=[];
 await assert.rejects(saveCheckpointRest(config,base,opts(async(_url,req)=>{
  definite.push(req.method);
  return new Response('forbidden',{status:403});
 })),/R2_HTTP_PUT_403/);
 assert.deepEqual(definite,['PUT']);
});

test('GET checkpoints still validates stored checkpoint identity and does not write anything',async()=>{
 const methods=[];
 const state=await readCheckpointRest(config,base.articleId,opts(async(_url,req)=>{
  methods.push(req.method);
  return json(JSON.stringify(base));
 }));
 assert.equal(state.articleId,base.articleId);
 assert.deepEqual(methods,['GET']);
});
