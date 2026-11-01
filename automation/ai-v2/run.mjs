import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cadence,validateConfig,assertTopic,mayCallProvider,qualityPreflight} from './guardrails.mjs';
import {readCheckpoint,saveCheckpoint,checkpointState} from './r2-checkpoints.mjs';
import {callProvider} from './providers.mjs';
import {geminiKeyInventory,selectGeminiKey} from './gemini-key-pool.mjs';
import {buildEnglishAiV2Article} from './native-article.mjs';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const topics=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url)));
const report=(status,reason,data={})=>console.log('AI_V2_REPORT '+JSON.stringify({site:'noondealsnow',status,reason,...data}));
const now=()=>new Date().toISOString();
const hash=s=>createHash('sha256').update(s).digest('hex');
validateConfig(config);

async function run(){
  // Isolated, finite GitHub Actions canary: NEVER enables the live Cron Worker.
  // Normal scheduling continues to respect the disabled main config.
  const oneOffCanary=process.env.AI_ONE_OFF_CANARY==='true'&&
    process.env.GITHUB_WORKFLOW==='NoonDealsNow AI V2 One-off Canary'&&
    process.env.GITHUB_EVENT_NAME==='push';
  const runConfig=oneOffCanary?{...config,enabled:true}:config;
  const due=cadence(runConfig,Number(process.env.AI_SCHEDULED_MS||Date.now()));
  const geminiKeys=geminiKeyInventory(process.env);
  if(process.env.AI_PREFLIGHT_ONLY==='true'){
    report('PREFLIGHT',due.reason,{enabled:config.enabled,targetPerHour:config.targetPerHour,mode:config.publicationMode,hasGemini:geminiKeys.hasGemini,geminiNewKeys:geminiKeys.newCount,geminiNewAuthKeys:geminiKeys.newAuthCount,geminiOldKeys:geminiKeys.oldCount,geminiSelectedSource:geminiKeys.selectedSource,hasGroq:Boolean(process.env.GROQ_API_KEY),hasPrivateStorageToken:Boolean(process.env.CLOUDFLARE_API_TOKEN),freeBudgetApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true'});return;
  }
  if(!due.due){report('SKIPPED',due.reason);return}
  const blocked=mayCallProvider({config:runConfig,freeApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true',checkpointWritable:Boolean(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID),topicReserved:true,hasAnyKey:Boolean(geminiKeys.hasGemini||process.env.GROQ_API_KEY)});
  if(blocked){report('SKIPPED',blocked);return}
  let selected;
  for(const topic of topics){
    if(oneOffCanary&&topic.country!=='AE')continue;
    const articleId=assertTopic(topic,config),saved=readCheckpoint(config,articleId);
    if(['BLOCKED_REVIEW','QUALITY_PASSED','COMMITTED','DEPLOYING','LIVE_VERIFIED','FAILED_FINAL','PAUSED_QUOTA','UNKNOWN_REQUEST_OUTCOME'].includes(saved?.state))continue;
    selected={topic,articleId,saved};break;
  }
  if(!selected){report('SKIPPED','NO_ELIGIBLE_TOPIC');return}
  const {topic,articleId}=selected;
  let state=selected.saved;
  // An uncertain publish is never automatically retried. Inspect only the
  // public URL; do not spend AI tokens or repeat potentially committed writes.
  if(['PUBLISH_REQUEST_SENT','UNKNOWN_PUBLICATION_OUTCOME','DEPLOYING'].includes(state?.state)){
    const url=config.domain+'/articles/'+encodeURIComponent(topic.slug);
    let live=false;
    try{const res=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'cache-control':'no-cache'}});
      live=res.status===200&&(await res.text()).includes(topic.coupon);
    }catch{}
    if(live){saveCheckpoint(config,checkpointState(state,'LIVE_VERIFIED',{liveVerifiedAt:now(),liveUrl:url}));report('LIVE_VERIFIED','RESUMED_AFTER_AMBIGUOUS_PUBLISH',{articleId,url});}
    else report('BLOCKED','PUBLISH_OUTCOME_REQUIRES_REVIEW',{articleId,state:state.state});
    return;
  }
  if(!state){
    let live;
    try{live=await fetch(config.domain+'/articles/'+encodeURIComponent(topic.slug),{method:'GET',signal:AbortSignal.timeout(15000)})}
    catch{report('SKIPPED','LIVE_DUPLICATE_PRECHECK_UNAVAILABLE');return}
    if(live.status!==404){report('SKIPPED',live.status===200?'POSSIBLE_EXISTING_LIVE_ARTICLE':'LIVE_PRECHECK_HTTP_'+live.status);return}
    state=saveCheckpoint(config,{articleId,topic,createdAt:now(),state:'PLANNED',version:0,sections:[],sectionIndex:0,pendingResponse:null});
  }
  if(state.state==='REQUEST_SENT'){
    state=saveCheckpoint(config,checkpointState(state,'UNKNOWN_REQUEST_OUTCOME',{errorCategory:'PREVIOUS_PROVIDER_REQUEST_MAY_HAVE_BEEN_BILLED'}));
    report('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{articleId});return;
  }
  if(topic.country!=='AE'){report('SKIPPED','ARABIC_NATIVE_RENDERER_PENDING',{articleId});return}
  const provider=geminiKeys.hasGemini?'gemini':'groq',model=config.models[provider];
  let calls=0;
  while(state.sectionIndex<topic.sections.length){
    if(calls>=config.limits.maxProviderCallsPerRun){report('CHECKPOINTED','CALL_BUDGET_LIMIT',{articleId,sectionIndex:state.sectionIndex});return}
    const index=state.sectionIndex;
    if(state.state==='RESPONSE_RECEIVED'&&state.pendingResponse){
      const html=state.pendingResponse;
      state=saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{sections:[...state.sections,{heading:topic.sections[index],html,hash:hash(html)}],sectionIndex:index+1,pendingResponse:null}));
      continue;
    }
    const credential=provider==='gemini'?selectGeminiKey(process.env,index):{key:process.env.GROQ_API_KEY,keySlot:0,source:'GROQ_API_KEY'};
    if(!credential){report('SKIPPED','PROVIDER_KEY_UNAVAILABLE',{provider});return}
    state=saveCheckpoint(config,checkpointState(state,'REQUEST_PENDING',{provider,model,pendingSection:index,keySource:credential.source,keySlot:credential.keySlot}));
    const prompt=[
      'Write an original, useful '+(topic.country==='SA'?'Saudi Arabic':'UAE English')+' consumer shopping article SECTION, valid HTML fragment only.',
      'Topic: '+topic.topic+'. Brand: '+topic.brand+'. Category: '+topic.category+'.',
      'Country: '+topic.country+'. Coupon: '+topic.coupon+'.',
      'Required section: '+topic.sections[index]+'.',
      'Provide 285-315 genuine words using h2 and p/list tags. Do not reproduce earlier sections.',
      'No fake discounts, dates, prices, testimonials, purchases, warranty promises or assumptions about coupon acceptance.',
      'No HTML head, JS, CSS, whole-article H1 or markdown code fences.'
    ].join('\n');
    // Persist the ambiguous billing boundary before sending the HTTP request.
    state=saveCheckpoint(config,checkpointState(state,'REQUEST_SENT',{sentAt:now(),pendingSection:index,lastRequestStatus:'UNKNOWN',keySource:credential.source,keySlot:credential.keySlot}));calls++;
    let result;
    try{result=await callProvider({provider,model,key:credential.key,prompt})}
    catch{
      saveCheckpoint(config,checkpointState(state,'UNKNOWN_REQUEST_OUTCOME',{errorCategory:'NETWORK_OR_TIMEOUT_AFTER_REQUEST_SENT'}));
      report('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{articleId,sectionIndex:index,provider,calls});return;
    }
    if(!result.ok){
      const next=result.category==='QUOTA'?'PAUSED_QUOTA':'BLOCKED_REVIEW';
      saveCheckpoint(config,checkpointState(state,next,{errorCategory:result.category,lastRequestStatus:result.httpStatus,retryAfter:result.retryAfter||null}));
      report('BLOCKED',next,{articleId,provider,httpStatus:result.httpStatus,reason:result.category,calls});return;
    }
    const html=result.content.trim();
    if(!html||html.includes(String.fromCharCode(96).repeat(3))||/<script\b|<iframe\b|<form\b/i.test(html)){
      saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{errorCategory:'UNSAFE_SECTION_HTML'}));
      report('BLOCKED','UNSAFE_SECTION',{articleId,index});return;
    }
    state=saveCheckpoint(config,checkpointState(state,'RESPONSE_RECEIVED',{pendingResponse:html,requestId:result.requestId||null,lastRequestStatus:200,provider,model}));
    state=saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{sections:[...state.sections,{heading:topic.sections[index],html,hash:hash(html)}],sectionIndex:index+1,pendingResponse:null}));
  }
  // Build one full, SEO-reviewable document from already checkpointed AI
  // sections. This deterministic step NEVER calls the provider.
  let native;
  try{native=buildEnglishAiV2Article(topic,state.sections)}
  catch(e){saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{errorCategory:String(e?.message||e).slice(0,80)}));report('BLOCKED','NATIVE_RENDER_FAILED',{articleId});return}
  const html=native.article.html;
  state=saveCheckpoint(config,checkpointState(state,'VALIDATING',{draftHtml:html,contentHash:hash(html)}));
  const check=qualityPreflight({html,topic},config);
  if(!check.pass){
    saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{qualityPreview:check,errorCategory:check.violations.join(',')}));
    report('DRAFT_SAVED','NATIVE_PREFLIGHT_FAILED',{articleId,words:check.wordCount,violations:check.violations,livePublished:false});return;
  }
  state=saveCheckpoint(config,checkpointState(state,'PREPARED_FOR_NATIVE_AUDIT',{
    nativeArticle:native.article,nativeTopic:native.topic,qualityPreview:check,errorCategory:null}));
  const token=process.env.NOONDEALSNOW_AI_SITE_PUBLISH_TOKEN;
  if(!token){report('CHECKPOINTED','SITE_PUBLISH_TOKEN_MISSING',{articleId,words:check.wordCount,livePublished:false});return}
  // The native Worker re-runs full quality, schema, novelty and 60s DO gate.
  // Save an ambiguous-HTTP boundary BEFORE the request; no blind retries.
  state=saveCheckpoint(config,checkpointState(state,'PUBLISH_REQUEST_SENT',{publishRequestedAt:now()}));
  let response,payload;
  try{
    response=await fetch(config.domain+'/api/internal/ai-v2/publish',{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({topic:native.topic,article:native.article,
        checkpoint:{articleId,state:'PREPARED_FOR_NATIVE_AUDIT',contentHash:hash(html)}}),
      signal:AbortSignal.timeout(45000)});
    payload=await response.json();
  }catch{
    saveCheckpoint(config,checkpointState(state,'UNKNOWN_PUBLICATION_OUTCOME',{errorCategory:'PUBLISH_HTTP_OUTCOME_UNKNOWN'}));
    report('BLOCKED','PUBLISH_HTTP_OUTCOME_UNKNOWN',{articleId,livePublished:false});return;
  }
  if(!response.ok||payload?.ok!==true){
    const reason=String(payload?.reason||'NATIVE_PUBLISH_DENIED');
    const recoverable=['GLOBAL_PUBLICATION_SLOT_NOT_DUE','GLOBAL_PUBLICATION_SLOT_NOT_GRANTED'].includes(reason);
    saveCheckpoint(config,checkpointState(state,recoverable?'PREPARED_FOR_NATIVE_AUDIT':'BLOCKED_REVIEW',{
      errorCategory:reason,nativeGateDiagnostics:payload?.diagnostics||null}));
    report('BLOCKED',reason,{articleId,words:check.wordCount,quality:payload?.diagnostics?.score||null,http:response.status,livePublished:false});return;
  }
  state=saveCheckpoint(config,checkpointState(state,'DEPLOYING',{liveUrl:payload.url,storedAt:now(),nativeQuality:payload.quality}));
  let verified=false;
  try{
    const res=await fetch(payload.url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});
    verified=res.status===200&&(await res.text()).includes(topic.coupon);
  }catch{}
  if(!verified){report('CHECKPOINTED','STORED_BUT_LIVE_NOT_VERIFIED',{articleId,url:payload.url,livePublished:false});return}
  saveCheckpoint(config,checkpointState(state,'LIVE_VERIFIED',{liveVerifiedAt:now(),liveUrl:payload.url}));
  report('LIVE_VERIFIED','NATIVE_QUALITY_AND_PUBLIC_URL_VERIFIED',{articleId,url:payload.url,quality:payload.quality,words:check.wordCount,provider,calls,livePublished:true});
}
run().catch(e=>{console.error('AI_V2_SAFE_FAILURE '+String(e?.message||e).slice(0,250));process.exitCode=1});
