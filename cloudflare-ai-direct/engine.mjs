// Direct Cloudflare Cron → Gemini/Groq → encrypted/private R2 → native publish.
// No GitHub URL, token, workflow, dispatch or browser-held generation loop.
import {eleventhEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n11.mjs';
import {batchArticlePrompt,parseArticleBatch} from '../automation/ai-v2/article-batch.mjs';
import {buildSaudiAiV2Article} from '../automation/ai-v2/native-arabic-article.mjs';
import {buildEnglishAiV2Article} from '../automation/ai-v2/native-article.mjs';
import {listDirectKeys} from './keys.mjs';
import {providerOutcomeAction} from './provider-response.mjs';
import {planDirectProviderWindow} from './provider-window.mjs';
import {directTopicAt,directTopicSpaceLength,DIRECT_TOPIC_SPACE_VERSION} from './topic-space.mjs';
import {withDirectLease} from './lease.mjs';

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
 // Last-any-market and per-market status are independent.
 const data={...patch,at:utc(),engine:'cloudflare-direct-r2-v1'};
 if(['SA','AE'].includes(data.market))
  await jsonPut(env,ROOT+'status-'+data.market.toLowerCase()+'.json',data);
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
async function generate(env,market,{maxProviderAttempts=3,preferredProvider=null,allowFallback=true}={}){
 return withDirectLease(env,'generate-'+market,async()=>{
  const topics=topicByMarket[market],cursorKey=ROOT+'cursor/'+market+'.json';
  if(!topics.length)return logState(env,{phase:'WAITING_TOPICS',market});
  // Verify Cloudflare-side credentials BEFORE reserving any topic/checkpoint.
  // Without keys, a canary must not permanently burn an article identity.
  let keys;
  try{keys=await listDirectKeys(env,{includePlain:true})}
  catch{return logState(env,{phase:'KEY_STORAGE_UNAVAILABLE',market})}
  if(!keys.gemini.length&&!keys.groq.length)return logState(env,{phase:'KEYS_MISSING',market});
  if(preferredProvider==='groq'&&!keys.groq.length&&!allowFallback)
   return logState(env,{phase:'GROQ_KEYS_MISSING',market});
  const previous=await jsonGet(env,cursorKey,{next:0});
  const space=directTopicSpaceLength(topics);
  // Upgrade old N11 cursors directly to fresh append-only scoped topics.
  // Never start with the already exhausted original wave after cutover.
  const oldNext=Number(previous?.next||0);
  const start=previous?.space===DIRECT_TOPIC_SPACE_VERSION&&Number.isSafeInteger(oldNext)&&oldNext>=0
   ?oldNext%space:topics.length;
  let topic=null,position=null,slot=null;
  // Eight cheap R2 HEADs at most, no content fetch and no mass enumeration.
  for(let step=0;step<8;step++){
   const index=(start+step)%space,candidate=directTopicAt(topics,index);
   if(!candidate)continue;
   const published=await env.CONTENT_FINAL.head('articles/'+candidate.slug+'.html');
   const checkpoint=await env.CONTENT_FINAL.head(ROOT+'checkpoint/'+candidate.slug+'.json');
   if(!published&&!checkpoint){topic=candidate;position=index;slot=step;break}
  }
  if(!topic){
   await jsonPut(env,cursorKey,{space:DIRECT_TOPIC_SPACE_VERSION,next:(start+8)%space,at:utc()});
   return logState(env,{phase:'WAITING_TOPICS',market});
  }
  // Persist before provider POST. Ambiguous provider outcomes are never retried.
  await jsonPut(env,cursorKey,{space:DIRECT_TOPIC_SPACE_VERSION,next:(position+1)%space,at:utc()});
  const checkpointKey=ROOT+'checkpoint/'+topic.slug+'.json';
  const initial={state:'REQUEST_SENT',slug:topic.slug,market,createdAt:utc(),providerCalls:0};
  const reserved=await jsonPut(env,checkpointKey,initial,{onlyIf:{etagDoesNotMatch:'*'}});
  if(!reserved)return logState(env,{phase:'RESERVATION_COLLISION',market});
  // An independently persisted cursor per provider ensures Groq is selected
  // for AE whenever configured; neither provider can starve behind the other.
  // Reserve all three candidate slots BEFORE making the first provider POST.
  const keyCursor=ROOT+'provider-rotation/'+market+'.json';
  const previousKeys=await jsonGet(env,keyCursor);
  const window=planDirectProviderWindow({gemini:keys.gemini.length,groq:keys.groq.length},{
    market,previous:previousKeys,maxAttempts:maxProviderAttempts,preferredProvider,allowFallback});
  const advanced=await jsonPut(env,keyCursor,{...window.next,at:utc()});
  if(!advanced)return logState(env,{phase:'KEY_ROTATION_WRITE_UNCONFIRMED',market});
  const models=['gemini-3.1-flash-lite','gemini-3.5-flash-lite','gemini-3.8-flash'];
  let result=null,chosen=null,calls=0;
  for(const selected of window.attempts){
   const entry={provider:selected.provider,key:keys[selected.provider][selected.keyIndex]};
   const model=entry.provider==='groq'?'openai/gpt-oss-120b':
    models[(start+selected.keyIndex)%models.length];
   const keyRef=(await fingerprint(entry.key)).slice(0,12);
   const authRejectKey=ROOT+'provider-rejected/'+entry.provider+'/'+keyRef+'.json';
   // Authentication failures are permanent for that credential until the
   // owner updates the key pool; never send another request with a known 401.
   if(await env.CONTENT_FINAL.head(authRejectKey))continue;
   chosen={provider:entry.provider,model,keyRef};calls++;
   try{result=await providerRequest(entry.provider,entry.key,model,batchArticlePrompt(topic))}
   catch{
    await jsonPut(env,checkpointKey,{...initial,state:'UNKNOWN_REQUEST_OUTCOME',provider:entry.provider,
      model,providerCalls:calls,at:utc()});
    return logState(env,{phase:'PROVIDER_NETWORK_UNKNOWN',market,provider:entry.provider,calls});
   }
   const action=providerOutcomeAction(result);
   if(action==='ACCEPT')break;
   // A definitive 429 had no completed output: another free key is safe.
   if(action==='NEXT_FREE_KEY')continue;
   if(action==='NEXT_VALID_KEY'){
    // A rejected 401/403 has no generated content. Persist the redacted key
    // fingerprint before trying another distinct credential, at most 3 total.
    const saved=await jsonPut(env,authRejectKey,{provider:entry.provider,
     keyRef:chosen.keyRef,http:result.http,at:utc()},{onlyIf:{etagDoesNotMatch:'*'}});
    if(!saved)return logState(env,{phase:'KEY_REJECTION_WRITE_UNCONFIRMED',market,
      provider:entry.provider,http:result.http,calls});
    continue;
   }
   // A 5xx may follow a model completion or quota consumption. Never
   // automatically resend the same prompt with a different key/provider.
   if(action==='QUARANTINE_UNKNOWN'){
    await jsonPut(env,checkpointKey,{...initial,state:'UNKNOWN_REQUEST_OUTCOME',
     provider:entry.provider,model,providerCalls:calls,lastRequestStatus:result.http,at:utc()});
    return logState(env,{phase:'PROVIDER_HTTP_OUTCOME_UNKNOWN',market,
     provider:entry.provider,http:result.http,calls});
   }
   break;
  }
  if(!result?.ok){
   await jsonPut(env,checkpointKey,{...initial,state:result?.reason||'PROVIDER_BLOCKED',
      provider:chosen?.provider,model:chosen?.model,providerCalls:calls,at:utc()});
   return logState(env,{phase:result?.reason||'PROVIDER_BLOCKED',market,calls,
     provider:chosen?.provider||null,http:result?.http||null});
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
 return withDirectLease(env,'publisher',async()=>{
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
// Cloudflare-only smoke stage: one attempt per market, at most two AI
// generation requests in total (apart from bounded definite 429 key fallback).
// Never publish from canary; leave legacy publishing safely in place.
async function canaryGenerateOnce(env,scheduledAt){
 let p;
 try{p=await policy(env)}catch(e){return logState(env,{phase:'CANARY_POLICY_UNAVAILABLE',reason:String(e?.message||'UNKNOWN').slice(0,65)})}
 if(!p.enabled)return logState(env,{phase:'CANARY_PAUSED'});
 if(!env.SITE_PUBLISH_TOKEN)return logState(env,{phase:'CANARY_NATIVE_PUBLISH_TOKEN_MISSING'});
 const market=Math.floor(Number(scheduledAt)/60000)%2?'AE':'SA';
 const attemptKey=ROOT+'canary-once-v2/'+market+'.json';
 const prior=await jsonGet(env,attemptKey,null);
 if(prior)return {ok:prior.state==='READY_CREATED',market,phase:'CANARY_ATTEMPT_ALREADY_RECORDED',
  recordedState:prior.state,articleSlug:prior.slug||null};
 let keys;
 try{keys=await listDirectKeys(env,{includePlain:true})}
 catch{return logState(env,{phase:'CANARY_KEY_STORAGE_UNAVAILABLE',market})}
 if(!keys.gemini.length&&!keys.groq.length)return logState(env,{phase:'CANARY_KEYS_MISSING',market});
 // Record BEFORE provider POST: if Worker CPU/time limits terminate this
 // invocation, a repeated Cron tick must not silently spend more quota.
 const reservation=await jsonPut(env,attemptKey,{state:'STARTED',market,at:utc()},
  {onlyIf:{etagDoesNotMatch:'*'}});
 if(!reservation)return {ok:false,market,phase:'CANARY_RESERVATION_RACE'};
 let result;
 try{result=await generate(env,market,{maxProviderAttempts:1,initialKeyOffset:market==='SA'?3:Math.floor(keys.gemini.length/2)+1})}
 catch(e){result={phase:'CANARY_GENERATION_EXCEPTION',reason:String(e?.message||'UNKNOWN').slice(0,65)}}
 const completed=result?.phase==='READY_CREATED',state=completed?'READY_CREATED':'BLOCKED';
 await jsonPut(env,attemptKey,{state,market,reason:result?.phase||'UNKNOWN',slug:result?.slug||null,at:utc()});
 return {ok:completed,market,phase:completed?'CANARY_READY_CREATED':'CANARY_GENERATION_BLOCKED',
  reason:result?.phase||'UNKNOWN',slug:result?.slug||null};
}
// Exactly one Groq network attempt, isolated from normal generation and
// publishing. Do not consume an unknown number of keys on repeated cron ticks.
async function canaryGroqOnce(env){
 let p;
 try{p=await policy(env)}catch{return {ok:false,phase:'GROQ_CANARY_POLICY_UNAVAILABLE'}}
 if(!p.enabled)return {ok:false,phase:'GROQ_CANARY_PAUSED'};
 let keys;
 try{keys=await listDirectKeys(env,{includePlain:true})}
 catch{return {ok:false,phase:'GROQ_CANARY_KEYS_UNAVAILABLE'}}
 if(!keys.groq.length)return {ok:false,phase:'GROQ_CANARY_KEYS_MISSING'};
 const marker=ROOT+'canary-groq-once-v3.json';
 const existing=await jsonGet(env,marker);
 if(existing)return {ok:existing.state==='READY_CREATED',phase:'GROQ_CANARY_ALREADY_RECORDED',
  recordedState:existing.state,provider:existing.provider||null};
 const claimed=await jsonPut(env,marker,{state:'STARTED',at:utc()},
  {onlyIf:{etagDoesNotMatch:'*'}});
 if(!claimed)return {ok:false,phase:'GROQ_CANARY_CLAIM_RACE'};
 let result;
 try{result=await generate(env,'AE',{maxProviderAttempts:3,preferredProvider:'groq',allowFallback:false})}
 catch{result={phase:'GROQ_CANARY_UNKNOWN_OUTCOME'}};
 const completed=result?.phase==='READY_CREATED'&&result?.provider==='groq';
 await jsonPut(env,marker,{state:completed?'READY_CREATED':'BLOCKED',provider:'groq',
  reason:result?.phase||'UNKNOWN',at:utc()});
 return {ok:completed,phase:completed?'GROQ_CANARY_READY_CREATED':'GROQ_CANARY_BLOCKED',
  reason:result?.phase||'UNKNOWN',provider:'groq'};
}
// A single Cloudflare-only native-publication pilot. Existing GitHub
// publication retains the shared atomic site slot; this pilot cannot bypass it.
// Never repeat a request unless the native bridge proves NO WRITE occurred.
export async function canaryPublishOnce(env,{publish=publishOne,clock=Date.now}={}){
 if(!env?.CONTENT_FINAL)return {ok:false,reason:'R2_BINDING_MISSING'};
 let p;
 try{p=await policy(env)}catch{return {ok:false,reason:'CANARY_POLICY_UNAVAILABLE'}}
 if(!p.enabled)return {ok:false,reason:'CANARY_PAUSED'};
 if(!env.SITE_PUBLISH_TOKEN)return {ok:false,reason:'NATIVE_PUBLISH_TOKEN_MISSING'};
 const marker=ROOT+'canary-publish-once-v1.json';
 let object=null,prior=null;
 try{
  object=await env.CONTENT_FINAL.get(marker);
  if(object)prior=await object.json();
 }catch{return {ok:false,reason:'CANARY_MARKER_UNAVAILABLE'}}
 if(object&&(!prior||!Number.isInteger(prior.attempts)||
   !['STARTED','WAIT_SLOT','VERIFIED','BLOCKED_UNKNOWN'].includes(prior.state)))
  return {ok:false,reason:'CANARY_MARKER_INVALID'};
 if(prior?.state!=='WAIT_SLOT'&&prior)return {ok:prior.state==='VERIFIED',
   reason:'CANARY_PUBLISH_ALREADY_RECORDED',state:prior.state,slug:prior.slug||null};
 if((prior?.attempts||0)>=5)return {ok:false,reason:'CANARY_PUBLISH_ATTEMPT_LIMIT'};
 if(prior?.at&&clock()-Date.parse(prior.at)<55000)
  return {ok:false,reason:'CANARY_PUBLISH_COOLDOWN'};
 let listing,record;
 try{
  listing=await env.CONTENT_FINAL.list({prefix:READY,limit:2});
  if(listing.truncated||listing.objects.length!==1)
   return {ok:false,reason:'CANARY_READY_STOCK_NOT_SINGLE'};
  record=await jsonGet(env,listing.objects[0].key);
 }catch{return {ok:false,reason:'CANARY_READY_UNAVAILABLE'}}
 if(record?.state!=='READY'||record?.topic?.country!=='AE'||
   record?.topic?.coupon!=='NOV188'||typeof record.topic.slug!=='string'||
   !record.topic.slug.startsWith('uae-'))
  return {ok:false,reason:'CANARY_READY_NOT_VALIDATED'};
 const attempts=(prior?.attempts||0)+1,at=new Date(clock()).toISOString();
 const written=await jsonPut(env,marker,{state:'STARTED',attempts,slug:record.topic.slug,at},
  {onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'}});
 if(!written)return {ok:false,reason:'CANARY_PUBLISH_CLAIM_RACE'};
 let outcome;
 try{outcome=await publish(env,p)}
 catch{outcome={ok:false,reason:'PUBLISH_TRANSPORT_UNKNOWN'}}
 const verified=outcome?.ok===true&&
  ['LIVE_VERIFIED','RECONCILED_LIVE_VERIFIED','ALREADY_LIVE_VERIFIED'].includes(outcome.reason)&&
  outcome.slug===record.topic.slug;
 const noWrite=outcome?.ok===false&&
  ['PUBLICATION_SLOT_NOT_DUE','PUBLICATION_INTERVAL_NOT_DUE','LEASE_ACTIVE'].includes(outcome.reason);
 const state=verified?'VERIFIED':noWrite?'WAIT_SLOT':'BLOCKED_UNKNOWN';
 const reason=typeof outcome?.reason==='string'&&/^[A-Z_]{3,70}$/.test(outcome.reason)?
  outcome.reason:'UNKNOWN_PUBLISH_RESULT';
 await jsonPut(env,marker,{state,reason,attempts,slug:record.topic.slug,at:new Date(clock()).toISOString()});
 return {ok:verified,reason,state,attempts,slug:record.topic.slug};
}
export async function directTick(env,{scheduledAt=Date.now()}={}){
 if(!env.CONTENT_FINAL)return {ok:false,reason:'R2_BINDING_MISSING'};
 if(env.DIRECT_AI_STAGE==='canary-generation')return canaryGenerateOnce(env,scheduledAt);
 if(env.DIRECT_AI_STAGE==='canary-groq-generation')return canaryGroqOnce(env);
 if(env.DIRECT_AI_STAGE==='canary-publish')return canaryPublishOnce(env);
 if(env.DIRECT_AI_STAGE!=='production')return {ok:false,reason:'CANARY_NOT_ACTIVE'};
 let p;
 try{p=await policy(env)}catch(e){return logState(env,{phase:String(e?.message||'POLICY_UNAVAILABLE')})}
 if(!p.enabled)return logState(env,{phase:'PAUSED_MANUALLY'});
 const minute=Math.floor(Number(scheduledAt)/60000);
 // Publish opportunities are independent from new generation. The second
 // bounded attempt is offset by 35 seconds and still obeys the global
 // atomic 30-second site permit; a slot collision never bypasses the gate.
 const firstPublication=publishOne(env,p).catch(()=>({ok:false,reason:'PUBLICATION_UNAVAILABLE'}));
 const secondPublication=(async()=>{
  const delay=Math.max(0,Math.min(35000,minute*60000+35000-Date.now()));
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  return publishOne(env,p).catch(()=>({ok:false,reason:'PUBLICATION_UNAVAILABLE'}));
 })();
 const publications=Promise.all([firstPublication,secondPublication]);
 const force=await jsonGet(env,ROOT+'manual-request.json',null);
 if(minute%p.intervalMinutes!==0&&!(force?.pending&&Date.now()-Date.parse(force.createdAt)<120000)){
  const published=await publications;
  return logState(env,{phase:'WAITING_GENERATION_INTERVAL',
   published:published.filter(x=>x.ok).map(x=>x.slug),
   publishReasons:published.map(x=>x.reason)});
 }
 // Both markets generate concurrently; each uses its own atomic R2 lease,
 // checkpoint and provider cursor. No GitHub runner generates articles.
 const generated=await Promise.allSettled(['SA','AE'].map(async market=>{
  try{return await generate(env,market)}
  catch{return {phase:'GENERATION_TRANSIENT_UNAVAILABLE',market}}
 }));
 const published=await publications;
 if(force?.pending)await jsonPut(env,ROOT+'manual-request.json',{pending:false,handledAt:utc()});
 return {ok:true,engine:'cloudflare-direct-r2-v1',parallelMarkets:['SA','AE'],
  generation:generated.map((x,i)=>x.status==='fulfilled'?x.value:{phase:'GENERATION_UNCONFIRMED',market:['SA','AE'][i]}),
  publishing:published};
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
 const [p,status,ready,saStatus,aeStatus,canarySA,canaryAE,pilotMarker,groqMarker]=await Promise.all([
  policy(env).catch(()=>null),jsonGet(env,ROOT+'status.json'),env.CONTENT_FINAL.list({prefix:READY,limit:100}),
  jsonGet(env,ROOT+'status-sa.json'),jsonGet(env,ROOT+'status-ae.json'),
  env.DIRECT_AI_STAGE==='canary-generation'?jsonGet(env,ROOT+'canary-once-v2/SA.json'):null,
  env.DIRECT_AI_STAGE==='canary-generation'?jsonGet(env,ROOT+'canary-once-v2/AE.json'):null,
  env.DIRECT_AI_STAGE==='canary-publish'?jsonGet(env,ROOT+'canary-publish-once-v1.json'):null,
  env.DIRECT_AI_STAGE==='canary-groq-generation'?jsonGet(env,ROOT+'canary-groq-once-v3.json'):null
 ]);
 const canaryAttempt=row=>{
  if(!row||typeof row!=='object')return null;
  const state=['STARTED','READY_CREATED','BLOCKED'].includes(row.state)?row.state:'UNKNOWN';
  const phase=typeof row.reason==='string'&&/^[A-Z_]{3,70}$/.test(row.reason)?row.reason:null;
  const at=typeof row.at==='string'&&Number.isFinite(Date.parse(row.at))?row.at:null;
  return {state,phase,at};
 };
 return {ok:true,schedulerEnabled:p?.enabled===true&&env.DIRECT_AI_STAGE==='production',
  canaryGenerationEnabled:env.DIRECT_AI_STAGE==='canary-generation',
  groqCanaryEnabled:env.DIRECT_AI_STAGE==='canary-groq-generation',
  groqCanary:groqMarker?{state:groqMarker.state,provider:groqMarker.provider||null,
   reason:groqMarker.reason||null,at:groqMarker.at||null}:null,
  canaryPublishingEnabled:env.DIRECT_AI_STAGE==='canary-publish',canaryPublishMaxAttempts:5,
  canaryMaxAttemptsPerMarket:1,canaryWave:2,
  intervalMinutes:p?.intervalMinutes||null,
  publishingIntervalMinutes:p?.publishingIntervalMinutes||null,
  source:'cloudflare-cron-r2-direct',controlStatus:p?(env.DIRECT_AI_STAGE==='production'?'POLICY_VERIFIED':
   env.DIRECT_AI_STAGE==='canary-generation'?'CANARY_GENERATION_ONLY':
   env.DIRECT_AI_STAGE==='canary-publish'?'CANARY_PUBLISH_ONLY':
   env.DIRECT_AI_STAGE==='canary-groq-generation'?'GROQ_CANARY_ONLY':'CANARY_NOT_ACTIVE'):'POLICY_UNAVAILABLE',
  dispatchPolicy:'direct-cloudflare-ai-generation-no-github',githubRuntime:false,directStage:env.DIRECT_AI_STAGE||'unset',
  freeOnly:true,readyCount:ready.objects.filter(x=>!x.key.endsWith('/')).length,
  readyCountExact:ready.truncated!==true,
  canaryAttempts:env.DIRECT_AI_STAGE==='canary-generation'?{SA:canaryAttempt(canarySA),AE:canaryAttempt(canaryAE)}:null,
  canaryPublication:env.DIRECT_AI_STAGE==='canary-publish'&&pilotMarker?{
   state:['STARTED','WAIT_SLOT','VERIFIED','BLOCKED_UNKNOWN'].includes(pilotMarker.state)?pilotMarker.state:'UNKNOWN',
   attempts:Number.isInteger(pilotMarker.attempts)?pilotMarker.attempts:0,
   reason:typeof pilotMarker.reason==='string'&&/^[A-Z_]{3,70}$/.test(pilotMarker.reason)?pilotMarker.reason:null,
   slug:typeof pilotMarker.slug==='string'&&/^[a-z0-9-]+$/.test(pilotMarker.slug)?pilotMarker.slug:null,
   at:typeof pilotMarker.at==='string'&&Number.isFinite(Date.parse(pilotMarker.at))?pilotMarker.at:null}:null,
  lastGeneration:status||null,
  marketGeneration:{SA:saStatus||null,AE:aeStatus||null},
  verifiedMarkets:['SA','AE']};
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
