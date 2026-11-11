// Direct Cloudflare Cron → Gemini/Groq → encrypted/private R2 → native publish.
// No GitHub URL, token, workflow, dispatch or browser-held generation loop.
import {eleventhEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n11.mjs';
import {batchArticlePrompt,parseArticleBatch} from '../automation/ai-v2/article-batch.mjs';
import {buildSaudiAiV2Article} from '../automation/ai-v2/native-arabic-article.mjs';
import {buildEnglishAiV2Article} from '../automation/ai-v2/native-article.mjs';
import {listDirectKeys} from './keys.mjs';

const ROOT='_ops/noondealsnow-direct-ai-v1/',READY=ROOT+'ready/';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const out=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const utc=()=>new Date().toISOString();
const topicByMarket={SA:eleventhEditorialTopicWave.filter(x=>x.country==='SA'),
  AE:eleventhEditorialTopicWave.filter(x=>x.country==='AE')};
async function jsonGet(env,key,fallback=null){
 try{const obj=await env.CONTENT_FINAL.get(key);return obj?await obj.json():fallback}catch{return fallback}
}
async function jsonPut(env,key,value,options){
 return env.CONTENT_FINAL.put(key,JSON.stringify(value),{
  httpMetadata:{contentType:'application/json; charset=utf-8'},...options});
}
async function fingerprint(value){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('')}
async function withLease(env,name,run){
 const key=ROOT+'lease/'+name+'.json',id=crypto.randomUUID(),now=Date.now();
 let existing=await env.CONTENT_FINAL.get(key),older=null,conditional;
 if(existing){
  older=await existing.json().catch(()=>null);
  if(Number(older?.until||0)>now)return {ok:false,reason:'LEASE_ACTIVE'};
  conditional={etagMatches:existing.etag};
 }else conditional={etagDoesNotMatch:'*'};
 const acquired=await jsonPut(env,key,{id,until:now+8*60000}, {onlyIf:conditional});
 if(!acquired)return {ok:false,reason:'LEASE_RACE'};
 try{return await run()}finally{
  try{const current=await jsonGet(env,key);if(current?.id===id)await env.CONTENT_FINAL.delete(key)}catch{}
 }
}
async function policy(env){
 const response=await fetch('https://noondealsnow.com/api/ai-v2-control-policy',{
  headers:{'cache-control':'no-store'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('CONTROL_UNAVAILABLE');
 const p=await response.json();
 if(p?.ok!==true||typeof p.enabled!=='boolean'||
   !Number.isInteger(p.intervalMinutes)||p.intervalMinutes<1||p.intervalMinutes>15||
   !Number.isInteger(p.publishingIntervalMinutes)||p.publishingIntervalMinutes<1||p.publishingIntervalMinutes>15)
  throw Error('CONTROL_POLICY_NOT_VERIFIED');
 return p;
}
async function logState(env,patch){
 const data={...patch,at:utc(),engine:'cloudflare-direct-r2-v1'};
 await jsonPut(env,ROOT+'status.json',data);
 return data;
}
async function providerRequest(provider,key,model,prompt){
 const headers={'content-type':'application/json'};
 let url,body;
 if(provider==='gemini'){
  url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  headers['x-goog-api-key']=key;
  body={contents:[{parts:[{text:prompt}]}],
    generationConfig:{maxOutputTokens:6000,thinkingConfig:{thinkingLevel:'LOW'}}};
 }else{
  url='https://api.groq.com/openai/v1/chat/completions';headers.authorization='Bearer '+key;
  body={model,temperature:0.65,max_completion_tokens:6000,reasoning_effort:'low',
   include_reasoning:false,messages:[{role:'system',content:'Return only exactly five original HTML H2 sections for a buyer guide; no unverified savings claims.'},{role:'user',content:prompt}]};
 }
 const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(105000)});
 if(!response.ok)return {ok:false,http:response.status,reason:response.status===429?'PROVIDER_QUOTA':response.status>=500?'PROVIDER_TEMPORARY':'PROVIDER_REJECTED'};
 const j=await response.json();
 const content=provider==='gemini'?(j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('')
  :String(j.choices?.[0]?.message?.content||'');
 return content.length>1200?{ok:true,content}:{ok:false,reason:'PROVIDER_INCOMPLETE'};
}
async function generate(env,market){
 return withLease(env,'generate-'+market,async()=>{
  const topics=topicByMarket[market],cursorKey=ROOT+'cursor/'+market+'.json';
  if(!topics.length)return logState(env,{phase:'WAITING_TOPICS',market});
  // Verify Cloudflare-side credentials BEFORE reserving any topic/checkpoint.
  // Without keys, a canary must not permanently burn an article identity.
  let keys;
  try{keys=await listDirectKeys(env,{includePlain:true})}
  catch{return logState(env,{phase:'KEY_STORAGE_UNAVAILABLE',market})}
  const pool=[...keys.gemini.map(key=>({provider:'gemini',key})),...keys.groq.map(key=>({provider:'groq',key}))];
  if(!pool.length)return logState(env,{phase:'KEYS_MISSING',market});
  const previous=await jsonGet(env,cursorKey,{next:0});
  const start=Math.max(0,Number(previous?.next||0));
  let topic=null,position=null,slot=null;
  // Eight cheap R2 HEADs at most, no content fetch and no mass enumeration.
  for(let step=0;step<8;step++){
   const index=(start+step)%topics.length,candidate=topics[index];
   const published=await env.CONTENT_FINAL.head('articles/'+candidate.slug+'.html');
   const checkpoint=await env.CONTENT_FINAL.head(ROOT+'checkpoint/'+candidate.slug+'.json');
   if(!published&&!checkpoint){topic=candidate;position=index;slot=step;break}
  }
  if(!topic){
   await jsonPut(env,cursorKey,{next:(start+8)%topics.length,at:utc()});
   return logState(env,{phase:'WAITING_TOPICS',market});
  }
  // Persist before provider POST. Ambiguous provider outcomes are never retried.
  await jsonPut(env,cursorKey,{next:(position+1)%topics.length,at:utc()});
  const checkpointKey=ROOT+'checkpoint/'+topic.slug+'.json';
  const initial={state:'REQUEST_SENT',slug:topic.slug,market,createdAt:utc(),providerCalls:0};
  const reserved=await jsonPut(env,checkpointKey,initial,{onlyIf:{etagDoesNotMatch:'*'}});
  if(!reserved)return logState(env,{phase:'RESERVATION_COLLISION',market});
  const models=['gemini-3.1-flash-lite','gemini-3.5-flash-lite','gemini-3.8-flash'];
  let result=null,chosen=null,calls=0;
  for(let attempt=0;attempt<Math.min(3,pool.length);attempt++){
   const entry=pool[(start+attempt)%pool.length],model=entry.provider==='groq'?'openai/gpt-oss-120b':models[Math.floor(start/Math.max(1,pool.length)+attempt)%models.length];
   chosen={provider:entry.provider,model,keyRef:(await fingerprint(entry.key)).slice(0,12)};calls++;
   try{result=await providerRequest(entry.provider,entry.key,model,batchArticlePrompt(topic))}
   catch{
    await jsonPut(env,checkpointKey,{...initial,state:'UNKNOWN_REQUEST_OUTCOME',provider:entry.provider,
      model,providerCalls:calls,at:utc()});
    return logState(env,{phase:'PROVIDER_NETWORK_UNKNOWN',market,provider:entry.provider,calls});
   }
   if(result.ok||![429,500,502,503,504].includes(result.http))break;
  }
  if(!result?.ok){
   await jsonPut(env,checkpointKey,{...initial,state:result?.reason||'PROVIDER_BLOCKED',
      provider:chosen?.provider,model:chosen?.model,providerCalls:calls,at:utc()});
   return logState(env,{phase:result?.reason||'PROVIDER_BLOCKED',market,calls});
  }
  const parsed=parseArticleBatch(result.content);
  if(!parsed.ok||parsed.sections.length!==5){
   await jsonPut(env,checkpointKey,{...initial,state:'QUALITY_REJECTED',reason:parsed.reason,providerCalls:calls,at:utc()});
   return logState(env,{phase:'BATCH_QUALITY_REJECTED',market,calls});
  }
  let article,finalTopic;
  try{
   const sections=parsed.sections.map((html,i)=>({heading:topic.sections[i],html}));
   const made=market==='SA'?buildSaudiAiV2Article(topic,sections):buildEnglishAiV2Article(topic,sections);
   article=made.article||made;finalTopic=made.topic||topic;
  }catch{
   await jsonPut(env,checkpointKey,{...initial,state:'ASSEMBLY_REJECTED',at:utc()});
   return logState(env,{phase:'ASSEMBLY_REJECTED',market});
  }
  if(!article.html||article.slug!==topic.slug){
   await jsonPut(env,checkpointKey,{...initial,state:'ASSEMBLY_INVALID',at:utc()});
   return logState(env,{phase:'ASSEMBLY_INVALID',market});
  }
  const contentHash=await fingerprint(article.html),articleId=(await fingerprint(topic.slug)).slice(0,24);
  const readyKey=READY+Date.now()+'-'+topic.slug+'.json';
  const prepared={state:'READY',topic:finalTopic,article,
    checkpoint:{articleId,state:'PREPARED_FOR_NATIVE_AUDIT',contentHash,
      attribution:{provider:chosen.provider,keyRef:chosen.keyRef,contributors:[{provider:chosen.provider,keyRef:chosen.keyRef,sections:5}],mixed:false}},
    preparedAt:utc(),readyKey};
  const stored=await jsonPut(env,readyKey,prepared,{onlyIf:{etagDoesNotMatch:'*'}});
  if(!stored)throw Error('READY_WRITE_NOT_CONFIRMED');
  await jsonPut(env,checkpointKey,{...initial,state:'READY',provider:chosen.provider,model:chosen.model,
    providerCalls:calls,readyKey,at:utc()});
  return logState(env,{phase:'READY_CREATED',market,slug:topic.slug,provider:chosen.provider,readyKey,calls});
 });
}
async function verifyLive(record){
 const path='https://noondealsnow.com/articles/'+record.topic.slug;
 try{
  const response=await fetch(path,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(16000)});
  if(!response.ok)return false;
  const body=await response.text();
  return body.includes(record.topic.coupon)&&body.includes('<article');
 }catch{return false}
}
async function publishOne(env,p){
 if(!p.enabled)return {ok:false,reason:'PAUSED'};
 const minute=Math.floor(Date.now()/60000);
 if(minute%p.publishingIntervalMinutes!==0)return {ok:false,reason:'PUBLICATION_INTERVAL_NOT_DUE'};
 return withLease(env,'publisher',async()=>{
  const ready=await env.CONTENT_FINAL.list({prefix:READY,limit:12});
  if(!ready.objects.length)return {ok:false,reason:'NO_READY_STOCK'};
  for(const item of ready.objects){
   let record=await jsonGet(env,item.key);if(!record||!record.topic?.slug)continue;
   if(record.state==='LIVE_VERIFIED'){await env.CONTENT_FINAL.delete(item.key);continue}
   if(record.state==='UNKNOWN_PUBLICATION_OUTCOME'){
    if(await verifyLive(record)){
     await jsonPut(env,ROOT+'checkpoint/'+record.topic.slug+'.json',{state:'LIVE_VERIFIED',slug:record.topic.slug,publishedAt:utc()});
     await env.CONTENT_FINAL.delete(item.key);
     return {ok:true,reason:'RECONCILED_LIVE_VERIFIED',slug:record.topic.slug};
    }
    continue; // Never retry an uncertain POST.
   }
   if(record.state!=='READY')continue;
   const exists=await env.CONTENT_FINAL.head('articles/'+record.topic.slug+'.html');
   if(exists){
    if(await verifyLive(record)){
     await env.CONTENT_FINAL.delete(item.key);
     return {ok:true,reason:'ALREADY_LIVE_VERIFIED',slug:record.topic.slug};
    }
    continue;
   }
   if(!env.SITE_PUBLISH_TOKEN)return {ok:false,reason:'NATIVE_PUBLISH_TOKEN_MISSING'};
   record.state='UNKNOWN_PUBLICATION_OUTCOME';
   await jsonPut(env,item.key,record);
   let response,answer;
   try{
    response=await fetch('https://noondealsnow.com/api/internal/ai-v2/publish',{
     method:'POST',headers:{authorization:'Bearer '+env.SITE_PUBLISH_TOKEN,'content-type':'application/json'},
     body:JSON.stringify({topic:record.topic,article:record.article,checkpoint:record.checkpoint}),
     signal:AbortSignal.timeout(45000)});
    answer=await response.json();
   }catch{
    return {ok:false,reason:'PUBLISH_TRANSPORT_UNKNOWN',slug:record.topic.slug};
   }
   if(answer?.ok===true&&response.ok){
    if(await verifyLive(record)){
     await jsonPut(env,ROOT+'checkpoint/'+record.topic.slug+'.json',{state:'LIVE_VERIFIED',slug:record.topic.slug,publishedAt:utc()});
     await env.CONTENT_FINAL.delete(item.key);
     return {ok:true,reason:'LIVE_VERIFIED',slug:record.topic.slug};
    }
    return {ok:false,reason:'STORED_AWAITING_VERIFICATION',slug:record.topic.slug};
   }
   if(response.status===409&&answer?.reason==='GLOBAL_PUBLICATION_SLOT_NOT_DUE'){
    record.state='READY';await jsonPut(env,item.key,record);
    return {ok:false,reason:'PUBLICATION_SLOT_NOT_DUE'};
   }
   if(response.status===409&&['NATIVE_QUALITY_BLOCKED','DUPLICATE_INTENT','COUPON_FRESHNESS_BLOCK','INVALID_HTML_SIZE'].includes(answer?.reason)){
    record.state='BLOCKED_REVIEW';await jsonPut(env,item.key,record);
    return {ok:false,reason:answer.reason,slug:record.topic.slug};
   }
   return {ok:false,reason:'PUBLISH_OUTCOME_UNVERIFIED',slug:record.topic.slug};
  }
  return {ok:false,reason:'NO_ELIGIBLE_READY'};
 });
}
export async function directTick(env,{scheduledAt=Date.now()}={}){
 if(!env.CONTENT_FINAL)return {ok:false,reason:'R2_BINDING_MISSING'};
 if(env.DIRECT_AI_STAGE!=='production')return {ok:false,reason:'CANARY_NOT_ACTIVE'};
 let p;
 try{p=await policy(env)}catch(e){return logState(env,{phase:String(e?.message||'POLICY_UNAVAILABLE')})}
 if(!p.enabled)return logState(env,{phase:'PAUSED_MANUALLY'});
 const minute=Math.floor(Number(scheduledAt)/60000);
 const published=await publishOne(env,p).catch(()=>({ok:false,reason:'PUBLICATION_UNAVAILABLE'}));
 const force=await jsonGet(env,ROOT+'manual-request.json',null);
 if(minute%p.intervalMinutes!==0&&!(force?.pending&&Date.now()-Date.parse(force.createdAt)<120000)){
  return logState(env,{phase:'WAITING_GENERATION_INTERVAL',published:published.ok?published.slug:null,publishReason:published.reason});
 }
 const market=minute%2?'AE':'SA';
 let result;
 try{result=await generate(env,market)}catch(e){result={phase:'GENERATION_TRANSIENT_UNAVAILABLE',reason:String(e?.message||'unknown').slice(0,65)}}
 if(force?.pending)await jsonPut(env,ROOT+'manual-request.json',{pending:false,handledAt:utc()});
 return {ok:true,engine:'cloudflare-direct-r2-v1',market,generation:result,publishing:published};
}
export async function requestDirectGeneration(env){
 if(env.DIRECT_AI_STAGE!=='production')
  return {dispatched:false,reason:'DIRECT_ENGINE_CANARY_NOT_ACTIVE',githubUsed:false};
 const p=await policy(env);
 if(!p.enabled)return {dispatched:false,reason:'SCHEDULER_PAUSED',githubUsed:false};
 // An accepted button must actually have the prerequisites to produce and
 // publish. Never claim the request was queued if all Cloudflare keys are gone.
 if(!env.SITE_PUBLISH_TOKEN)
  return {dispatched:false,reason:'NATIVE_PUBLISH_TOKEN_MISSING',githubUsed:false};
 let keys;
 try{keys=await listDirectKeys(env,{includePlain:true})}
 catch{return {dispatched:false,reason:'DIRECT_KEY_STORAGE_UNAVAILABLE',githubUsed:false}}
 if(!keys.gemini.length&&!keys.groq.length)
  return {dispatched:false,reason:'DIRECT_PROVIDER_KEYS_MISSING',githubUsed:false};
 await jsonPut(env,ROOT+'manual-request.json',{pending:true,createdAt:utc()});
 return {dispatched:true,scheduledVia:'cloudflare-cron-next-minute',githubUsed:false};
}
export async function directStatus(env){
 const [p,status,ready]=await Promise.all([
  policy(env).catch(()=>null),jsonGet(env,ROOT+'status.json'),env.CONTENT_FINAL.list({prefix:READY,limit:100})
 ]);
 return {ok:true,schedulerEnabled:p?.enabled===true&&env.DIRECT_AI_STAGE==='production',intervalMinutes:p?.intervalMinutes||null,
  publishingIntervalMinutes:p?.publishingIntervalMinutes||null,
  source:'cloudflare-cron-r2-direct',controlStatus:p?(env.DIRECT_AI_STAGE==='production'?'POLICY_VERIFIED':'CANARY_NOT_ACTIVE'):'POLICY_UNAVAILABLE',
  dispatchPolicy:'direct-cloudflare-ai-generation-no-github',githubRuntime:false,directStage:env.DIRECT_AI_STAGE||'unset',
  freeOnly:true,readyCount:ready.objects.filter(x=>!x.key.endsWith('/')).length,
  lastGeneration:status||null,verifiedMarkets:['SA','AE']};
}
// Authenticated service-binding RPC only: never include these credential
// counts on public /health, and never serialize actual Gemini/Groq key values.
export async function directAdminStatus(env){
 const base=await directStatus(env);
 let keysReadable=false,geminiCount=0,groqCount=0;
 try{
  const keys=await listDirectKeys(env,{includePlain:true});
  geminiCount=keys.gemini.length;groqCount=keys.groq.length;
  keysReadable=true;
 }catch{}
 const publishTokenConfigured=Boolean(env.SITE_PUBLISH_TOKEN);
 const activationBlockers=[];
 if(!keysReadable)activationBlockers.push('DIRECT_KEY_STORAGE_UNAVAILABLE');
 else if(geminiCount+groqCount===0)activationBlockers.push('DIRECT_PROVIDER_KEYS_MISSING');
 if(!publishTokenConfigured)activationBlockers.push('NATIVE_PUBLISH_TOKEN_MISSING');
 if(env.DIRECT_AI_STAGE!=='production')activationBlockers.push('DIRECT_ENGINE_CANARY_NOT_ACTIVE');
 if(base.controlStatus==='POLICY_UNAVAILABLE')activationBlockers.push('CONTROL_POLICY_UNAVAILABLE');
 return {...base,
  credentials:{geminiCount,groqCount,readable:keysReadable,publishTokenConfigured},
  readyForActivation:activationBlockers.length===0,
  activationBlockers};
}

export default {
 async fetch(request,env){
  if(new URL(request.url).pathname!=='/health')return out({ok:false,error:'not_found'},404);
  return out(await directStatus(env));
 },
 async scheduled(event,env,ctx){ctx.waitUntil(directTick(env,{scheduledAt:event?.scheduledTime||Date.now()}))}
};
