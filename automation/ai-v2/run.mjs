import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cadence,validateConfig,assertTopic,mayCallProvider,qualityPreflight} from './guardrails.mjs';
import {checkpointState} from './r2-checkpoints.mjs';
import {readCheckpointRest as readCheckpoint,saveCheckpointRest as saveCheckpoint} from './r2-checkpoints-http.mjs';
import {callProvider} from './providers.mjs';
import {geminiKeyInventory,selectGeminiKey} from './gemini-key-pool.mjs';
import {groqKeyInventory,selectGroqKey} from './groq-key-pool.mjs';
import {buildEnglishAiV2Article} from './native-article.mjs';
import {buildSaudiAiV2Article} from './native-arabic-article.mjs';
import {publicationReadyTopic,resumableCheckpoint,queueInventory,queueScanWindow,nextQueueCursor,queueCursorAfterScan,safeSaudiDeterministicRecovery,SA_SAFE_RECOVERY_REVISION} from './topic-queue.mjs';
import {quotaCooldownSeconds,providerCircuitId,providerCircuitActive} from './provider-circuit.mjs';
import {summarizeSectionAttribution} from './attribution.mjs';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const topics=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url)));
const runStartedAt=Date.now();
const report=(status,reason,data={})=>console.log('AI_V2_REPORT '+JSON.stringify({site:'noondealsnow',status,reason,elapsedMs:Date.now()-runStartedAt,...data}));
const now=()=>new Date().toISOString();
const hash=s=>createHash('sha256').update(s).digest('hex');
validateConfig(config);

async function run(){
  // Isolated, finite GitHub Actions canary: NEVER enables the live Cron Worker.
  // Normal scheduling continues to respect the disabled main config.
  const oneOffCanary=process.env.AI_ONE_OFF_CANARY==='true'&&
    ['NoonDealsNow AI V2 One-off Canary','NoonDealsNow AI V2 Groq Resume Canary','NoonDealsNow AI V2 Groq Content Retry Canary','NoonDealsNow AI V2 Trim and Publish Canary','NoonDealsNow AI V2 Next UAE Quality Canary','NoonDealsNow AI V2 Short Draft Recovery Canary','NoonDealsNow AI V2 Saudi Quality Canary','NoonDealsNow AI V2 Saudi Quality Recovery Canary'].includes(process.env.GITHUB_WORKFLOW)&&
    process.env.GITHUB_EVENT_NAME==='push';
  const approvedCronDispatch=process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&
    process.env.GITHUB_WORKFLOW==='NoonDealsNow AI V2 - Safe Checkpoints and Preflight'&&
    process.env.AI_PREFLIGHT_ONLY==='false';
  const runConfig=(oneOffCanary||approvedCronDispatch)?{...config,enabled:true}:config;
  const due=cadence(runConfig,Number(process.env.AI_SCHEDULED_MS||Date.now()));
  const geminiKeys=geminiKeyInventory(process.env);
  const groqKeys=groqKeyInventory(process.env);
  if(process.env.AI_PREFLIGHT_ONLY==='true'){
    report('PREFLIGHT',due.reason,{enabled:config.enabled,targetPerHour:config.targetPerHour,mode:config.publicationMode,hasGemini:geminiKeys.hasGemini,geminiNewKeys:geminiKeys.newCount,geminiNewAuthKeys:geminiKeys.newAuthCount,geminiOldKeys:geminiKeys.oldCount,geminiSelectedSource:geminiKeys.selectedSource,hasGroq:groqKeys.hasGroq,groqNewKeys:groqKeys.newCount,groqExtraKeys:groqKeys.extraCount,groqEligibleKeys:groqKeys.eligibleCount,geminiExtraKeys:geminiKeys.extraCount,hasPrivateStorageToken:Boolean(process.env.CLOUDFLARE_API_TOKEN),freeBudgetApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true'});return;
  }
  if(!due.due){report('SKIPPED',due.reason);return}
  const savedOnly=oneOffCanary&&process.env.AI_REPROCESS_SAVED_DRAFT==='true'&&process.env.AI_NO_PROVIDER_CALLS==='true';
  const blocked=mayCallProvider({config:runConfig,freeApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true',checkpointWritable:Boolean(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID),topicReserved:true,hasAnyKey:Boolean(geminiKeys.hasGemini||groqKeys.hasGroq||savedOnly)});
  if(blocked){report('SKIPPED',blocked);return}
  const safeSaudiCanary=oneOffCanary&&['NoonDealsNow AI V2 Saudi Quality Canary','NoonDealsNow AI V2 Saudi Quality Recovery Canary'].includes(process.env.GITHUB_WORKFLOW)&&process.env.AI_SA_ONE_OFF==='true';
  let selected;
  const explicitGroqResume=oneOffCanary&&process.env.AI_RESUME_PAUSED_QUOTA==='true'&&process.env.AI_PROVIDER_OVERRIDE==='groq';
  const cursorId=hash('noondealsnow|ai-v2|round-robin-cursor-v1').slice(0,24);
  // Keep historical one-off recovery semantics untouched. Production reads a
  // maximum of eight article checkpoints per invocation, not the whole queue.
  const oldCursor=oneOffCanary?null:await readCheckpoint(config,cursorId);
  const positions=oneOffCanary?topics.map((_,i)=>i):queueScanWindow(topics.length,oldCursor?.cursor);
  let checked=0,lastChecked=null;
  for(const position of positions){
    const topic=topics[position];
    lastChecked=position;
    if(!publicationReadyTopic(topic))continue;
    if(oneOffCanary&&topic.country!==String(process.env.AI_CANARY_MARKET||'AE'))continue;
    // An explicitly targeted zero-provider recovery must never select another
    // draft from the queue or accidentally spend a different topic's quota.
    if(oneOffCanary&&process.env.AI_CANARY_SLUG&&topic.slug!==process.env.AI_CANARY_SLUG)continue;
    checked++;
    const articleId=assertTopic(topic,config),saved=await readCheckpoint(config,articleId);
    const explicitIncompleteRetry=explicitGroqResume&&process.env.AI_RESUME_INCOMPLETE==='true'&&
      saved?.state==='BLOCKED_REVIEW'&&saved?.errorCategory==='INCOMPLETE_RESPONSE';
    if(!resumableCheckpoint(saved,{savedOnly,manualGroqResume:explicitGroqResume,manualIncompleteRetry:explicitIncompleteRetry,nativeGateRepair:safeSaudiCanary&&savedOnly,autoSafeSaudiRecovery:!oneOffCanary,topic}))continue;
    selected={topic,articleId,saved};break;
  }
  if(!oneOffCanary&&lastChecked!==null){
    // Fail closed if the queue cursor cannot be persisted. This prevents
    // repeated scans and makes successful scheduled runs progress durably.
    const next=queueCursorAfterScan(topics.length,lastChecked,Boolean(selected));
    await saveCheckpoint(config,{articleId:cursorId,state:'QUEUE_CURSOR',cursor:next,
      createdAt:oldCursor?.createdAt||now(),version:Number(oldCursor?.version||0)+1});
  }
  if(!selected){
    report('SKIPPED',oneOffCanary?'NO_ELIGIBLE_TOPIC':'QUEUE_WINDOW_EMPTY',
      {queue:queueInventory(topics),checked,scanLimit:positions.length,nextCursor:oneOffCanary?null:nextQueueCursor(topics.length,lastChecked)});
    return;
  }
  const {topic,articleId}=selected;
  let state=selected.saved;
  const recoveredWithoutAI=!oneOffCanary&&safeSaudiDeterministicRecovery(state,topic);
  if(recoveredWithoutAI){
    // This stamp is persisted with the next PREPARED or BLOCKED checkpoint.
    // A new quality failure will not be retried automatically every minute.
    state={...state,deterministicRecoveryRevision:SA_SAFE_RECOVERY_REVISION};
  }
  if(savedOnly&&(!state||state.sectionIndex!==topic.sections.length)){report('BLOCKED','SAVED_DRAFT_NOT_READY_FOR_NO_AI_REPROCESS',{articleId});return}
  // An uncertain publish is never automatically retried. Inspect only the
  // public URL; do not spend AI tokens or repeat potentially committed writes.
  if(['PUBLISH_REQUEST_SENT','UNKNOWN_PUBLICATION_OUTCOME','DEPLOYING'].includes(state?.state)){
    const url=config.domain+'/articles/'+encodeURIComponent(topic.slug);
    let live=false;
    try{const res=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'cache-control':'no-cache'}});
      live=res.status===200&&(await res.text()).includes(topic.coupon);
    }catch{}
    if(live){
      await saveCheckpoint(config,checkpointState(state,'LIVE_VERIFIED',{liveVerifiedAt:now(),liveUrl:url}));
      report('LIVE_VERIFIED','RESUMED_AFTER_AMBIGUOUS_PUBLISH',{articleId,url});
    }else{
      // The write may have committed even when the network response was lost.
      // Preserve it as an ambiguous quarantine record; the queue excludes it
      // from future unattended attempts, while manual reconciliation remains
      // possible from its immutable R2 checkpoint and public URL.
      if(state.state!=='UNKNOWN_PUBLICATION_OUTCOME'){
        state=await saveCheckpoint(config,checkpointState(state,'UNKNOWN_PUBLICATION_OUTCOME',{
          errorCategory:'PUBLISH_PUBLIC_URL_NOT_VERIFIED',reviewRequired:true,
          lastPublicVerificationAt:now(),candidateLiveUrl:url
        }));
      }
      report('BLOCKED','PUBLISH_OUTCOME_QUARANTINED_FOR_REVIEW',{articleId,formerState:state.state,livePublished:false});
    }
    return;
  }
  if(!state){
    let live;
    try{live=await fetch(config.domain+'/articles/'+encodeURIComponent(topic.slug),{method:'GET',signal:AbortSignal.timeout(15000)})}
    catch{report('SKIPPED','LIVE_DUPLICATE_PRECHECK_UNAVAILABLE');return}
    if(live.status!==404){report('SKIPPED',live.status===200?'POSSIBLE_EXISTING_LIVE_ARTICLE':'LIVE_PRECHECK_HTTP_'+live.status);return}
    state=await saveCheckpoint(config,{articleId,topic,createdAt:now(),state:'PLANNED',version:0,sections:[],sectionIndex:0,pendingResponse:null});
  }
  if(state.state==='REQUEST_SENT'){
    state=await saveCheckpoint(config,checkpointState(state,'UNKNOWN_REQUEST_OUTCOME',{errorCategory:'PREVIOUS_PROVIDER_REQUEST_MAY_HAVE_BEEN_BILLED'}));
    report('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{articleId});return;
  }
  // A confirmed Gemini 429 is NOT retried. An explicitly approved, isolated
  // one-time job may resume the exact saved section using a different provider.
  const priority=config.providerPriority||['gemini','groq'];
  const available={gemini:geminiKeys.hasGemini,groq:groqKeys.hasGroq};
  // Only request the NEXT missing section. Prefer Groq, but fall back to
  // Gemini when Groq is in quota cooldown, and rotate Gemini key cooldowns.
  // Completed drafts reach publication with no provider calls.
  const needsProvider=state.sectionIndex<topic.sections.length;
  const chooseCredential=async index=>{
    const preferred=explicitGroqResume?['groq']:priority;
    for(const candidateProvider of preferred){
      if(!available[candidateProvider])continue;
      // Legacy Groq quota is global, but Gemini service errors are scoped to
      // one MODEL: fallback to the vetted free Flash-Lite model if 3.8 is down.
      const globalCircuitId=providerCircuitId(candidateProvider,hash);
      if(providerCircuitActive(await readCheckpoint(config,globalCircuitId)))continue;
      const models=candidateProvider==='gemini'
        ?[config.models.gemini,config.models.geminiFallback].filter(Boolean)
        :[config.models.groq];
      for(const candidateModel of [...new Set(models)]){
        const modelCircuitId=providerCircuitId(candidateProvider,hash,hash('model|'+candidateModel).slice(0,12));
        const modelCircuit=await readCheckpoint(config,modelCircuitId);
        if(providerCircuitActive(modelCircuit))continue;
        const poolSize=candidateProvider==='gemini'?geminiKeys.eligibleCount:groqKeys.eligibleCount;
        for(let n=0;n<poolSize;n++){
          const credential=candidateProvider==='gemini'
            ?selectGeminiKey(process.env,index+n)
            :selectGroqKey(process.env,index+n);
          if(!credential?.key)continue;
          const keyRef=hash(credential.key).slice(0,12); // never store the secret
          const usePerKey=candidateProvider==='gemini'||credential.source!=='GROQ_API_KEY';
          const circuitId=providerCircuitId(candidateProvider,hash,usePerKey?keyRef:null);
          const circuit=await readCheckpoint(config,circuitId);
          if(providerCircuitActive(circuit))continue;
          return {provider:candidateProvider,model:candidateModel,modelCircuitId,modelCircuit,
            credential,keyRef,circuitId,circuit};
        }
      }
    }
    return null;
  };
  if(needsProvider&&!Object.values(available).some(Boolean)){
    report('SKIPPED','NO_FREE_PROVIDER_AVAILABLE',{articleId});return;
  }
  let calls=0,lastProvider=null;
  while(state.sectionIndex<topic.sections.length){
    if(calls>=config.limits.maxProviderCallsPerRun){report('CHECKPOINTED','CALL_BUDGET_LIMIT',{articleId,sectionIndex:state.sectionIndex});return}
    const index=state.sectionIndex;
    if(state.state==='RESPONSE_RECEIVED'&&state.pendingResponse){
      const html=state.pendingResponse;
      state=await saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{sections:[...state.sections,{heading:topic.sections[index],html,hash:hash(html)}],sectionIndex:index+1,pendingResponse:null}));
      continue;
    }
    const chosen=await chooseCredential(index);
    if(!chosen){
      report('SKIPPED','ALL_FREE_PROVIDERS_IN_COOLDOWN',{articleId,enabledProviders:priority.filter(p=>available[p])});
      return;
    }
    const {provider,model,modelCircuitId,modelCircuit,credential,keyRef,circuitId,circuit}=chosen;
    lastProvider=provider;
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
    state=await saveCheckpoint(config,checkpointState(state,'REQUEST_SENT',{sentAt:now(),pendingSection:index,lastRequestStatus:'UNKNOWN',keySource:credential.source,keySlot:credential.keySlot}));calls++;
    let result;
    try{result=await callProvider({provider,model,key:credential.key,prompt})}
    catch{
      await saveCheckpoint(config,checkpointState(state,'UNKNOWN_REQUEST_OUTCOME',{errorCategory:'NETWORK_OR_TIMEOUT_AFTER_REQUEST_SENT'}));
      report('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{articleId,sectionIndex:index,provider,calls});return;
    }
    if(!result.ok){
      const quota=result.category==='QUOTA'&&result.httpStatus===429;
      const temporary=result.category==='PROVIDER_TEMPORARY'&&[500,502,503,504].includes(result.httpStatus);
      const next=quota?'PAUSED_QUOTA':temporary?'PAUSED_PROVIDER':'BLOCKED_REVIEW';
      // Confirmed provider HTTP errors are checkpointed; network uncertainty
      // still stays quarantined above and must never be retried automatically.
      state=await saveCheckpoint(config,checkpointState(state,next,{
        errorCategory:result.category,lastRequestStatus:result.httpStatus,retryAfter:result.retryAfter||null
      }));
      if(quota||temporary){
        const pauseSec=quota?quotaCooldownSeconds(result.retryAfter):300;
        const pauseCircuitId=temporary?modelCircuitId:circuitId;
        const oldPause=temporary?modelCircuit:circuit;
        try{await saveCheckpoint(config,{articleId:pauseCircuitId,
          state:quota?'PAUSED_QUOTA':'PAUSED_PROVIDER',provider,createdAt:now(),
          resumeAt:new Date(Date.now()+pauseSec*1000).toISOString(),version:Number(oldPause?.version||0)+1});}
        catch(e){report('BLOCKED','PROVIDER_CIRCUIT_WRITE_FAILED',{provider,articleId});return}
        // No section is regenerated or discarded. On the next iteration the
        // selector skips the paused provider/key and tries another free source
        // in the SAME GitHub run, subject to the strict 5-request maximum.
        console.log('AI_V2_PROVIDER_FAILOVER '+JSON.stringify({
          provider,model,keyRef,articleId,httpStatus:result.httpStatus,
          fallbackPreference:provider==='groq'?'gemini':'healthy-free-provider',
          calls,sectionIndex:index,pauseSeconds:pauseSec
        }));
        continue;
      }
      report('BLOCKED',next,{articleId,provider,keyRef,httpStatus:result.httpStatus,reason:result.category,calls});return;
    }
    const html=result.content.trim();
    if(!html||html.includes(String.fromCharCode(96).repeat(3))||/<script\b|<iframe\b|<form\b/i.test(html)){
      await saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{errorCategory:'UNSAFE_SECTION_HTML'}));
      report('BLOCKED','UNSAFE_SECTION',{articleId,index});return;
    }
    // A single atomic, read-back-verified checkpoint contains the complete
    // confirmed response and incremented section index. If interrupted before
    // this write, REQUEST_SENT remains and forbids an unbilled blind retry.
    state=await saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{
      sections:[...state.sections,{heading:topic.sections[index],html,hash:hash(html),provider,keyRef}],
      sectionIndex:index+1,pendingResponse:null,requestId:result.requestId||null,
      lastRequestStatus:200,provider,model}));
  }
  // On a later tick, reuse exactly the previously audited draft. Waiting
  // for the global DO publication slot must not rebuild or re-save its R2
  // checkpoint, and must never spend another provider request.
  let native,check;
  if(state.state==='PREPARED_FOR_NATIVE_AUDIT'){
    native={article:state.nativeArticle,topic:state.nativeTopic};
    const savedHtml=native.article?.html;
    if(typeof savedHtml!=='string'||state.contentHash!==hash(savedHtml)||
       native.article?.slug!==topic.slug||native.article?.country!==topic.country||
       native.topic?.slug!==topic.slug||native.topic?.country!==topic.country||
       state.qualityPreview?.pass!==true){
      report('BLOCKED','PREPARED_CHECKPOINT_INTEGRITY_FAILED',{articleId});return;
    }
    check=qualityPreflight({html:savedHtml,topic},config);
    if(!check.pass){report('BLOCKED','PREPARED_CHECKPOINT_QUALITY_CHANGED',{articleId,violations:check.violations});return}
  }else{
    // Build one full SEO document from already checkpointed AI sections.
    // This deterministic step never calls an AI provider.
    try{native=topic.country==='SA'?buildSaudiAiV2Article(topic,state.sections):buildEnglishAiV2Article(topic,state.sections)}
    catch(e){await saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{errorCategory:String(e?.message||e).slice(0,80)}));report('BLOCKED','NATIVE_RENDER_FAILED',{articleId});return}
    const draftHtml=native.article.html;
    check=qualityPreflight({html:draftHtml,topic},config);
    if(!check.pass){
      await saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{qualityPreview:check,errorCategory:check.violations.join(',')}));
      report('DRAFT_SAVED','NATIVE_PREFLIGHT_FAILED',{articleId,words:check.wordCount,violations:check.violations,livePublished:false});return;
    }
    // One read-back-verified PREPARED checkpoint replaces the redundant
    // VALIDATING and PREPARED writes; native Worker independently audits again.
    state=await saveCheckpoint(config,checkpointState(state,'PREPARED_FOR_NATIVE_AUDIT',{
      nativeArticle:native.article,nativeTopic:native.topic,qualityPreview:check,
      draftHtml:draftHtml,contentHash:hash(draftHtml),errorCategory:null}));
  }
  const html=native.article.html;
  // Historical incomplete checkpoints are intentionally attributed to UNKNOWN.
  // New full drafts record only opaque provider key fingerprints.
  const attribution=summarizeSectionAttribution(state.sections);
  const token=process.env.NOONDEALSNOW_AI_SITE_PUBLISH_TOKEN;
  if(!token){report('CHECKPOINTED','SITE_PUBLISH_TOKEN_MISSING',{articleId,words:check.wordCount,livePublished:false});return}
  // The native Worker re-runs full quality, schema, novelty and 60s DO gate.
  // Save an ambiguous-HTTP boundary BEFORE the request; no blind retries.
  state=await saveCheckpoint(config,checkpointState(state,'PUBLISH_REQUEST_SENT',{publishRequestedAt:now()}));
  let response,payload;
  try{
    response=await fetch(config.domain+'/api/internal/ai-v2/publish',{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({topic:native.topic,article:native.article,
        checkpoint:{articleId,state:'PREPARED_FOR_NATIVE_AUDIT',contentHash:hash(html),attribution}}),
      signal:AbortSignal.timeout(45000)});
    payload=await response.json();
  }catch{
    await saveCheckpoint(config,checkpointState(state,'UNKNOWN_PUBLICATION_OUTCOME',{errorCategory:'PUBLISH_HTTP_OUTCOME_UNKNOWN'}));
    report('BLOCKED','PUBLISH_HTTP_OUTCOME_UNKNOWN',{articleId,livePublished:false});return;
  }
  if(!response.ok||payload?.ok!==true){
    const reason=String(payload?.reason||'NATIVE_PUBLISH_DENIED');
    const recoverable=['GLOBAL_PUBLICATION_SLOT_NOT_DUE','GLOBAL_PUBLICATION_SLOT_NOT_GRANTED'].includes(reason);
    await saveCheckpoint(config,checkpointState(state,recoverable?'PREPARED_FOR_NATIVE_AUDIT':'BLOCKED_REVIEW',{
      errorCategory:reason,nativeGateDiagnostics:payload?.diagnostics||null}));
    report('BLOCKED',reason,{articleId,words:check.wordCount,quality:payload?.diagnostics?.score||null,http:response.status,livePublished:false});return;
  }
  state=await saveCheckpoint(config,checkpointState(state,'DEPLOYING',{liveUrl:payload.url,storedAt:now(),nativeQuality:payload.quality}));
  let verified=false;
  try{
    const res=await fetch(payload.url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});
    verified=res.status===200&&(await res.text()).includes(topic.coupon);
  }catch{}
  if(!verified){report('CHECKPOINTED','STORED_BUT_LIVE_NOT_VERIFIED',{articleId,url:payload.url,livePublished:false});return}
  await saveCheckpoint(config,checkpointState(state,'LIVE_VERIFIED',{liveVerifiedAt:now(),liveUrl:payload.url}));
  report('LIVE_VERIFIED','NATIVE_QUALITY_AND_PUBLIC_URL_VERIFIED',{articleId,url:payload.url,quality:payload.quality,words:check.wordCount,provider:attribution?.provider||lastProvider,keyRef:attribution?.keyRef||null,providerMixed:attribution?.mixed||false,calls,livePublished:true});
}
run().catch(e=>{console.error('AI_V2_SAFE_FAILURE '+String(e?.message||e).slice(0,250));process.exitCode=1});
