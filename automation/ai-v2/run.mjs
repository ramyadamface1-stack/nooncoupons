import {readFileSync} from 'node:fs';
import {probeLiveArticleBeforeDraft} from './live-precheck.mjs';
import {buildSafeMonitor,writeSafeMonitor} from './runtime-telemetry.mjs';
import {createHash} from 'node:crypto';
import {cadence,validateConfig,assertTopic,mayCallProvider,qualityPreflight} from './guardrails.mjs';
import {checkpointState} from './r2-checkpoints.mjs';
import {ambiguousPublicationState,reconcileAmbiguousPublication,MAX_READ_ONLY_RECONCILIATIONS_PER_RUN} from './publication-reconciliation.mjs';
import {readCheckpointRest as readCheckpoint,saveCheckpointRest as saveCheckpoint} from './r2-checkpoints-http.mjs';
import {callProvider} from './providers.mjs';
import {geminiKeyInventory,selectGeminiKey} from './gemini-key-pool.mjs';
import {groqKeyInventory,selectGroqKey} from './groq-key-pool.mjs';
import {buildEnglishAiV2Article} from './native-article.mjs';
import {buildSaudiAiV2Article} from './native-arabic-article.mjs';
import {publicationReadyTopic,resumableCheckpoint,queueInventory,queueScanWindow,marketQueueScanWindow,queueExpansionBridgeWindow,queueRotatingFreshWaveWindow,nextQueueCursor,queueCursorAfterScan,queueCursorAnchorForScan,pausedProviderNextCursor,safeSaudiDeterministicRecovery,SA_SAFE_RECOVERY_REVISION,safeSaudiFilesystemRecovery,SA_FILESYSTEM_RECOVERY_REVISION,safeEnglishDeterministicRecovery,AE_SAFE_RECOVERY_REVISION} from './topic-queue.mjs';
import {quotaCooldownSeconds,temporaryCooldown,providerCircuitId,providerModelKeyCircuitId,providerCircuitActive,createProviderCircuitSnapshot,providerFailoverOrder} from './provider-circuit.mjs';
import {summarizeSectionAttribution} from './attribution.mjs';
import {confirmedSlotRetryDelay} from './slot-retry.mjs';
import {batchArticlePrompt,parseArticleBatch} from './article-batch.mjs';
import {expandedEditorialTopics} from './topic-expansion.mjs';
import {newEditorialTopicWave} from './topic-refresh.mjs';
import {thirdEditorialTopicWave} from './topic-refresh-n3.mjs';
import {fourthEditorialTopicWave} from './topic-refresh-n4.mjs';
import {fifthEditorialTopicWave} from './topic-refresh-n5.mjs';
import {sixthEditorialTopicWave} from './topic-refresh-n6.mjs';
import {seventhEditorialTopicWave} from './topic-refresh-n7.mjs';
import {eighthEditorialTopicWave} from './topic-refresh-n8.mjs';
import {ninthEditorialTopicWave} from './topic-refresh-n9.mjs';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const baseTopics=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url)));
const existingTopicCount=baseTopics.length+expandedEditorialTopics.length+newEditorialTopicWave.length+thirdEditorialTopicWave.length;
// Only append; historical private checkpoint identities and cursor positions stay fixed.
const fifthWaveStart=baseTopics.length+expandedEditorialTopics.length+newEditorialTopicWave.length+thirdEditorialTopicWave.length+fourthEditorialTopicWave.length;
const sixthWaveStart=fifthWaveStart+fifthEditorialTopicWave.length;
const seventhWaveStart=sixthWaveStart+sixthEditorialTopicWave.length;
const eighthWaveStart=seventhWaveStart+seventhEditorialTopicWave.length;
const ninthWaveStart=eighthWaveStart+eighthEditorialTopicWave.length;
const topics=[...baseTopics,...expandedEditorialTopics,...newEditorialTopicWave,...thirdEditorialTopicWave,...fourthEditorialTopicWave,...fifthEditorialTopicWave,...sixthEditorialTopicWave,...seventhEditorialTopicWave,...eighthEditorialTopicWave,...ninthEditorialTopicWave];
let runStartedAt=Date.now();
let lastReportStatus=null,lastSafeReport=null,lastSelectedCredential=null,jobBatchOrdinal=0;
const report=(status,reason,data={})=>{
  lastReportStatus=status;
  lastSafeReport={status,reason,url:typeof data?.url==='string'?data.url:null};
  console.log('AI_V2_REPORT '+JSON.stringify({site:'noondealsnow',status,reason,elapsedMs:Date.now()-runStartedAt,...data}));
};
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
  const queueMarket=String(process.env.AI_QUEUE_MARKET||'').trim().toUpperCase();
  if(queueMarket&&!['SA','AE'].includes(queueMarket))throw Error('INVALID_QUEUE_MARKET');
  if(queueMarket&&oneOffCanary)throw Error('CANARY_MARKET_QUEUE_CONFLICT');
  const savedOnly=oneOffCanary&&process.env.AI_REPROCESS_SAVED_DRAFT==='true'&&process.env.AI_NO_PROVIDER_CALLS==='true';
  const blocked=mayCallProvider({config:runConfig,freeApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true',checkpointWritable:Boolean(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID),topicReserved:true,hasAnyKey:Boolean(geminiKeys.hasGemini||groqKeys.hasGroq||savedOnly)});
  if(blocked){report('SKIPPED',blocked);return}
  // Test production availability BEFORE any R2 checkpoint reads or writes.
  // This protects GitHub runner minutes and free R2 operations during a 1027.
  // The already-saved queue cursor remains unchanged while the site is down.
  try{
    const siteHealth=await fetch(config.domain+'/api/health',{
      headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)
    });
    if(siteHealth.status===429){
      const body=(await siteHealth.text()).slice(0,3000);
      report('SKIPPED',/1027/.test(body)?'CLOUDFLARE_1027_DAILY_LIMIT':'SITE_RATE_LIMITED',
        {http:429,providerCalls:0,checkpointReads:0,checkpointWrites:0,livePublished:false});
      return;
    }
    if(!siteHealth.ok){
      report('SKIPPED','SITE_HEALTH_UNAVAILABLE',{http:siteHealth.status,
        providerCalls:0,checkpointReads:0,checkpointWrites:0,livePublished:false});
      return;
    }
    const healthPayload=await siteHealth.json().catch(()=>null);
    if(healthPayload?.ok!==true){
      report('SKIPPED','SITE_HEALTH_INVALID_RESPONSE',{http:siteHealth.status,providerCalls:0,checkpointReads:0,checkpointWrites:0,livePublished:false});
      return;
    }
  }catch{
    report('SKIPPED','SITE_HEALTH_NETWORK_UNKNOWN',{
      providerCalls:0,checkpointReads:0,checkpointWrites:0,livePublished:false});
    return;
  }
  const safeSaudiCanary=oneOffCanary&&['NoonDealsNow AI V2 Saudi Quality Canary','NoonDealsNow AI V2 Saudi Quality Recovery Canary'].includes(process.env.GITHUB_WORKFLOW)&&process.env.AI_SA_ONE_OFF==='true';
  let selected;
  const explicitGroqResume=oneOffCanary&&process.env.AI_RESUME_PAUSED_QUOTA==='true'&&process.env.AI_PROVIDER_OVERRIDE==='groq';
  // Two market jobs in one workflow use disjoint, stable private R2 cursors.
  // They cannot select the same topic; legacy cursor and checkpoint identities
  // are unchanged, so old completed/uncertain drafts remain protected.
  const cursorId=hash(queueMarket?'noondealsnow|ai-v2|market-queue-v1|'+queueMarket:'noondealsnow|ai-v2|round-robin-cursor-v1').slice(0,24);
  // Keep historical one-off recovery semantics untouched. A normal market job
  // reads at most 24 own-market checkpoints, not 12 mixed-market checkpoints.
  const oldCursor=oneOffCanary?null:await readCheckpoint(config,cursorId);
  const firstPosition=queueMarket&&oldCursor?.cursor==null?baseTopics.length+(queueMarket==='AE'?1:0):oldCursor?.cursor;
  const firstWindow=oneOffCanary?topics.map((_,i)=>i):(queueMarket?marketQueueScanWindow(topics,queueMarket,firstPosition):queueScanWindow(topics.length,firstPosition));
  // Old window: up to 24 checkpoint reads. Two 4-entry append-only bridges
  // preserve the previous 8-entry reserve budget; fresh N7 opportunities
  // rotate as the durable cursor progresses. Existing topic IDs never change.
  const positions=[...firstWindow,...(oneOffCanary?[]:[
    ...queueExpansionBridgeWindow(topics.length,existingTopicCount,firstWindow,4),
    ...queueRotatingFreshWaveWindow(topics.length,ninthWaveStart,firstWindow,4)
  ])];
  let checked=0,lastChecked=null,checkpointStates={},reconciliationAttempts=0,reconciledLive=0;
  // If all free sources are cooling down, do not pin the global queue to an
  // unfinished article. Its immutable R2 checkpoint survives; later cycles
  // can find it again, while another ready draft may publish without AI.
  const yieldProviderBlockedCursor=async reason=>{
    if(oneOffCanary||lastChecked===null)return;
    const cursor=pausedProviderNextCursor(topics.length,lastChecked,reason);
    await saveCheckpoint(config,{articleId:cursorId,state:'QUEUE_CURSOR',cursor,
      createdAt:oldCursor?.createdAt||now(),version:Number(oldCursor?.version||0)+2});
    console.log('AI_V2_QUEUE_YIELD '+JSON.stringify({reason,from:lastChecked,nextCursor:cursor}));
  };
  for(const position of positions){
    const topic=topics[position];
    lastChecked=position;
    if(queueMarket&&topic.country!==queueMarket)continue;
    if(!publicationReadyTopic(topic))continue;
    if(oneOffCanary&&topic.country!==String(process.env.AI_CANARY_MARKET||'AE'))continue;
    // An explicitly targeted zero-provider recovery must never select another
    // draft from the queue or accidentally spend a different topic's quota.
    if(oneOffCanary&&process.env.AI_CANARY_SLUG&&topic.slug!==process.env.AI_CANARY_SLUG)continue;
    checked++;
    const articleId=assertTopic(topic,config),saved=await readCheckpoint(config,articleId);
    const checkpointStatus=String(saved?.state||'UNSTARTED');
    checkpointStates[checkpointStatus]=(checkpointStates[checkpointStatus]||0)+1;
    const explicitIncompleteRetry=explicitGroqResume&&process.env.AI_RESUME_INCOMPLETE==='true'&&
      saved?.state==='BLOCKED_REVIEW'&&saved?.errorCategory==='INCOMPLETE_RESPONSE';
    if(!resumableCheckpoint(saved,{savedOnly,manualGroqResume:explicitGroqResume,manualIncompleteRetry:explicitIncompleteRetry,nativeGateRepair:safeSaudiCanary&&savedOnly,autoSafeSaudiRecovery:!oneOffCanary,autoSafeSaudiFilesystemRecovery:!oneOffCanary,autoSafeEnglishRecovery:!oneOffCanary,autoReadOnlyReconcile:!oneOffCanary,topic}))continue;
    // Reconcile a bounded number of old uncertain writes without letting
    // them monopolize this minute's generation/publishing opportunity.
    // Only GET the public URL; NEVER replay an ambiguous publish POST.
    if(!oneOffCanary&&ambiguousPublicationState(saved)){
      if(reconciliationAttempts>=MAX_READ_ONLY_RECONCILIATIONS_PER_RUN)continue;
      const outcome=await reconcileAmbiguousPublication({
        domain:config.domain,topic,checkpoint:saved,
        persist:(phase,patch)=>saveCheckpoint(config,checkpointState(saved,phase,patch))
      });
      reconciliationAttempts++;
      if(outcome.status==='LIVE_VERIFIED')reconciledLive++;
      console.log('AI_V2_READ_ONLY_RECONCILE '+JSON.stringify({
        market:topic.country,articleId,status:outcome.status,reason:outcome.reason
      }));
      continue;
    }
    selected={topic,articleId,saved};break;
  }
  if(!oneOffCanary&&lastChecked!==null){
    // Fail closed if the queue cursor cannot be persisted. This prevents
    // repeated scans and makes successful scheduled runs progress durably.
    // Supplemental bridge/fresh-wave slots are opportunistic probes, not the
    // durable primary scan. Without a selection, advancing to their final slot
    // jumps over thousands of older, uninspected queued topics.
    const anchor=queueCursorAnchorForScan(firstWindow,lastChecked,Boolean(selected));
    const next=queueCursorAfterScan(topics.length,anchor,Boolean(selected));
    await saveCheckpoint(config,{articleId:cursorId,state:'QUEUE_CURSOR',cursor:next,
      createdAt:oldCursor?.createdAt||now(),version:Number(oldCursor?.version||0)+1});
  }
  if(!selected){
    report('SKIPPED',oneOffCanary?'NO_ELIGIBLE_TOPIC':'QUEUE_WINDOW_EMPTY',
      {queue:queueInventory(topics),checked,scanLimit:positions.length,checkpointStates,reconciliationAttempts,reconciledLive,nextCursor:oneOffCanary?null:nextQueueCursor(topics.length,queueCursorAnchorForScan(firstWindow,lastChecked,false))});
    return;
  }
  const {topic,articleId}=selected;
  let state=selected.saved;
  const filesystemRescue=!oneOffCanary&&safeSaudiFilesystemRecovery(state,topic);
  const recoveredWithoutAI=!oneOffCanary&&(safeSaudiDeterministicRecovery(state,topic)||safeEnglishDeterministicRecovery(state,topic)||filesystemRescue);
  if(recoveredWithoutAI){
    // This stamp is persisted with the next PREPARED or BLOCKED checkpoint.
    // A new quality failure will not be retried automatically every minute.
    state={...state,deterministicRecoveryRevision:topic.country==='AE'?AE_SAFE_RECOVERY_REVISION:SA_SAFE_RECOVERY_REVISION,
      ...(filesystemRescue?{filesystemRecoveryRevision:SA_FILESYSTEM_RECOVERY_REVISION}:{})};
  }
  if(savedOnly&&(!state||state.sectionIndex!==topic.sections.length)){report('BLOCKED','SAVED_DRAFT_NOT_READY_FOR_NO_AI_REPROCESS',{articleId});return}
  // This path is retained for targeted one-off canaries. Scheduled runs
  // reconcile ambiguous writes in the queue scan and keep looking for work.
  if(ambiguousPublicationState(state)){
    const outcome=await reconcileAmbiguousPublication({
      domain:config.domain,topic,checkpoint:state,
      persist:(phase,patch)=>saveCheckpoint(config,checkpointState(state,phase,patch))
    });
    report(outcome.status,outcome.reason,{
      articleId,url:outcome.url,formerState:outcome.formerState,
      livePublished:outcome.livePublished
    });
    return;
  }
  if(!state){
    // A transient Cloudflare 5xx must never be interpreted as an absent
    // article. Retry only bounded public GET reads, never publication writes.
    const precheck=await probeLiveArticleBeforeDraft(
      config.domain+'/articles/'+encodeURIComponent(topic.slug));
    if(precheck.status!==404){
      report('SKIPPED',precheck.status===200?'POSSIBLE_EXISTING_LIVE_ARTICLE':
        precheck.status===null?'LIVE_DUPLICATE_PRECHECK_UNAVAILABLE':'LIVE_PRECHECK_HTTP_'+precheck.status,
        {precheckAttempts:precheck.attempts});
      return;
    }
    state=await saveCheckpoint(config,{articleId,topic,createdAt:now(),state:'PLANNED',version:0,sections:[],sectionIndex:0,pendingResponse:null});
  }
  if(state.state==='REQUEST_SENT'){
    state=await saveCheckpoint(config,checkpointState(state,'UNKNOWN_REQUEST_OUTCOME',{errorCategory:'PREVIOUS_PROVIDER_REQUEST_MAY_HAVE_BEEN_BILLED'}));
    report('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{articleId});return;
  }
  // A confirmed Gemini 429 is NOT retried. An explicitly approved, isolated
  // one-time job may resume the exact saved section using a different provider.
  // Split initial provider preference across market runners when both are
  // healthy, reducing synchronized 429s from repeatedly probing one service.
  const priority=queueMarket==='SA'?['gemini','groq']:(config.providerPriority||['gemini','groq']);
  // Rotate approved keys over UTC minutes, isolated markets and the second
  // article in one job; every key's durable quota/circuit pause still applies.
  const credentialOffset=Math.floor(Number(process.env.AI_SCHEDULED_MS||Date.now())/60000)+
    (queueMarket==='AE'?1:0)+jobBatchOrdinal;
  const available={gemini:geminiKeys.hasGemini,groq:groqKeys.hasGroq};
  // Only request the NEXT missing section. Prefer Groq, but fall back to
  // Gemini when Groq is in quota cooldown, and rotate Gemini key cooldowns.
  // Completed drafts reach publication with no provider calls.
  const needsProvider=state.sectionIndex<topic.sections.length;
  const providerCircuits=createProviderCircuitSnapshot(id=>readCheckpoint(config,id),state=>saveCheckpoint(config,state));
  // On a definitive 5xx, try another free MODEL/provider during this run;
  // another key for the failed model may be tested at the next cron minute.
  // This bounds outage probes while keeping per-model+key cooldown isolated.
  const temporarilyFailedModelsThisRun=new Set();
  let lastQuotaRejectedProvider=null;
  const chooseCredential=async index=>{
    const preferred=explicitGroqResume?['groq']:providerFailoverOrder(priority,lastQuotaRejectedProvider);
    for(const candidateProvider of preferred){
      if(!available[candidateProvider])continue;
      // Legacy Groq quota is global, but Gemini service errors are scoped to
      // one MODEL: fallback to the vetted free Flash-Lite model if 3.8 is down.
      const globalCircuitId=providerCircuitId(candidateProvider,hash);
      if(providerCircuitActive(await providerCircuits.read(globalCircuitId)))continue;
      const models=candidateProvider==='gemini'
        ?[config.models.gemini,config.models.geminiFallback,config.models.geminiTertiary].filter(Boolean)
        :[config.models.groq];
      for(const candidateModel of [...new Set(models)]){
        if(temporarilyFailedModelsThisRun.has(candidateProvider+'|'+candidateModel))continue;
        const modelCircuitId=providerCircuitId(candidateProvider,hash,hash('model|'+candidateModel).slice(0,12));
        const modelCircuit=await providerCircuits.read(modelCircuitId);
        if(providerCircuitActive(modelCircuit))continue;
        const poolSize=candidateProvider==='gemini'?geminiKeys.eligibleCount:groqKeys.eligibleCount;
        for(let n=0;n<poolSize;n++){
          const credential=candidateProvider==='gemini'
            ?selectGeminiKey(process.env,index+n+credentialOffset)
            :selectGroqKey(process.env,index+n+credentialOffset);
          if(!credential?.key)continue;
          const keyRef=hash(credential.key).slice(0,12); // never store the secret
          const usePerKey=candidateProvider==='gemini'||credential.source!=='GROQ_API_KEY';
          const circuitId=providerCircuitId(candidateProvider,hash,usePerKey?keyRef:null);
          const circuit=await providerCircuits.read(circuitId);
          if(providerCircuitActive(circuit))continue;
          const modelKeyCircuitId=providerModelKeyCircuitId(candidateProvider,candidateModel,keyRef,hash);
          const modelKeyCircuit=await providerCircuits.read(modelKeyCircuitId);
          if(providerCircuitActive(modelKeyCircuit))continue;
          lastSelectedCredential={provider:candidateProvider,model:candidateModel,keyRef,
            source:credential.source,at:now()};
          return {provider:candidateProvider,model:candidateModel,modelCircuitId,modelCircuit,
            modelKeyCircuitId,modelKeyCircuit,credential,keyRef,circuitId,circuit};
        }
      }
    }
    return null;
  };
  if(needsProvider&&!Object.values(available).some(Boolean)){
    await yieldProviderBlockedCursor('NO_FREE_PROVIDER_AVAILABLE');
    report('SKIPPED','NO_FREE_PROVIDER_AVAILABLE',{articleId});return;
  }
  let calls=0,lastProvider=null;
  while(state.sectionIndex<topic.sections.length){
    if(calls>=config.limits.maxProviderCallsPerRun){await yieldProviderBlockedCursor('CALL_BUDGET_LIMIT');report('CHECKPOINTED','CALL_BUDGET_LIMIT',{articleId,sectionIndex:state.sectionIndex});return}
    const index=state.sectionIndex;
    if(state.state==='RESPONSE_RECEIVED'&&state.pendingResponse){
      const html=state.pendingResponse;
      state=await saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{sections:[...state.sections,{heading:topic.sections[index],html,hash:hash(html)}],sectionIndex:index+1,pendingResponse:null}));
      continue;
    }
    const chosen=await chooseCredential(index);
    if(!chosen){
      await yieldProviderBlockedCursor('ALL_FREE_PROVIDERS_IN_COOLDOWN');
      report('SKIPPED','ALL_FREE_PROVIDERS_IN_COOLDOWN',{articleId,enabledProviders:priority.filter(p=>available[p])});
      return;
    }
    const {provider,model,modelCircuitId,modelCircuit,modelKeyCircuitId,modelKeyCircuit,credential,keyRef,circuitId,circuit}=chosen;
    lastProvider=provider;
    const batching=!oneOffCanary&&index===0&&state.sections.length===0;
    const prompt=batching?batchArticlePrompt(topic):[
      'Write an original, useful '+(topic.country==='SA'?'Saudi Arabic':'UAE English')+' consumer shopping article SECTION, valid HTML fragment only.',
      'Topic: '+topic.topic+'. Brand: '+topic.brand+'. Category: '+topic.category+'.',
      'Country: '+topic.country+'. Coupon: '+topic.coupon+'.',
      'Required section: '+topic.sections[index]+'.',
      'Provide 285-315 genuine words using h2 and p/list tags. Do not reproduce earlier sections.',
      'No fake discounts, dates, prices, testimonials, purchases, warranty promises or assumptions about coupon acceptance.',
      'Never write numerical savings percentages, fixed discounts, a guaranteed discount, or a promised coupon result. Compare only the final actual cart totals.',
      'No HTML head, JS, CSS, whole-article H1 or markdown code fences.'
    ].join('\n');
    // Persist the ambiguous billing boundary before sending the HTTP request.
    state=await saveCheckpoint(config,checkpointState(state,'REQUEST_SENT',{sentAt:now(),pendingSection:index,lastRequestStatus:'UNKNOWN',keySource:credential.source,keySlot:credential.keySlot}));calls++;
    let result;
    try{result=await callProvider({provider,model,key:credential.key,prompt,maxOutputTokens:batching?5800:null})}
    catch{
      await saveCheckpoint(config,checkpointState(state,'UNKNOWN_REQUEST_OUTCOME',{errorCategory:'NETWORK_OR_TIMEOUT_AFTER_REQUEST_SENT'}));
      report('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{articleId,sectionIndex:index,provider,calls});return;
    }
    if(!result.ok){
      const quota=result.category==='QUOTA'&&result.httpStatus===429;
      const temporary=result.category==='PROVIDER_TEMPORARY'&&[500,502,503,504].includes(result.httpStatus);
      // A definitive 401/403 is NOT an ambiguous charge. Quarantine ONLY
      // the rejected credential for 24h, not the saved article or Gemini pool.
      // Never retry that key; try a different approved free key/provider.
      const invalidAuth=(result.category==='INVALID_KEY'&&result.httpStatus===401)||
        (result.category==='PROVIDER_PERMISSION'&&result.httpStatus===403);
      const next=quota?'PAUSED_QUOTA':(temporary||invalidAuth)?'PAUSED_PROVIDER':'BLOCKED_REVIEW';
      // Confirmed provider HTTP errors are checkpointed; network uncertainty
      // still stays quarantined above and must never be retried automatically.
      state=await saveCheckpoint(config,checkpointState(state,next,{
        errorCategory:result.category,lastRequestStatus:result.httpStatus,retryAfter:result.retryAfter||null
      }));
      if(quota||temporary||invalidAuth){
        const backoff=temporary?temporaryCooldown(result.retryAfter,modelKeyCircuit):null;
        const pauseSec=invalidAuth?86400:quota?quotaCooldownSeconds(result.retryAfter):backoff.seconds;
        const pauseCircuitId=temporary?modelKeyCircuitId:circuitId;
        const oldPause=temporary?modelKeyCircuit:circuit;
        if(temporary)temporarilyFailedModelsThisRun.add(provider+'|'+model);
        try{await providerCircuits.write({articleId:pauseCircuitId,
          state:quota?'PAUSED_QUOTA':'PAUSED_PROVIDER',provider,createdAt:now(),
          ...(temporary?{model,keyRef,temporaryFailStreak:backoff.streak,lastTemporaryAt:now()}:{}),
          ...(invalidAuth?{errorCategory:result.category,lastRequestStatus:result.httpStatus,keyRef}:{}),
          resumeAt:new Date(Date.now()+pauseSec*1000).toISOString(),version:Number(oldPause?.version||0)+1});}
        catch(e){report('BLOCKED','PROVIDER_CIRCUIT_WRITE_FAILED',{provider,articleId});return}
        // After a confirmed 429, prefer a different approved free provider
        // before exhausting the entire per-run budget on sibling keys.
        if(quota)lastQuotaRejectedProvider=provider;
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
    if(batching){
      const parsed=parseArticleBatch(html);
      if(!parsed.ok){
        await saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{
          errorCategory:parsed.reason,lastRequestStatus:200,provider,model}));
        report('BLOCKED','BATCH_CONTENT_INVALID',{articleId,reason:parsed.reason,provider,calls});return;
      }
      // Atomic immutable checkpoint: save received content from this one
      // definitive provider HTTP response. A partial output resumes with the
      // original single-section flow, without regenerating earlier sections.
      state=await saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{
        sections:parsed.sections.map((fragment,i)=>({heading:topic.sections[i],html:fragment,hash:hash(fragment),provider,keyRef})),
        sectionIndex:parsed.sections.length,pendingResponse:null,requestId:result.requestId||null,
        lastRequestStatus:200,provider,model}));
      console.log('AI_V2_BATCH_SECTIONS '+JSON.stringify({articleId,received:parsed.sections.length,calls}));
      continue;
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
  // A confirmed HTTP 409 from the global minute permit means the Worker did
  // not write the article. Wait once for the official next-eligible timestamp,
  // without another model request or weakening the atomic 60-second DO gate.
  const body=JSON.stringify({topic:native.topic,article:native.article,
    checkpoint:{articleId,state:'PREPARED_FOR_NATIVE_AUDIT',contentHash:hash(html),attribution}});
  async function requestPublish(){
    const response=await fetch(config.domain+'/api/internal/ai-v2/publish',{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body,signal:AbortSignal.timeout(45000)});
    const responseBody=await response.text();
    let payload;
    try{payload=JSON.parse(responseBody)}
    catch{payload={ok:false,reason:response.status===429&&/1027/.test(responseBody)
      ?'CLOUDFLARE_1027_DAILY_LIMIT':'NATIVE_PUBLISH_HTTP_'+response.status};}
    return {response,payload};
  }
  let response,payload;
  try{
    ({response,payload}=await requestPublish());
    const waitMs=confirmedSlotRetryDelay({
      httpStatus:response.status,reason:payload?.reason,nextEligibleAt:payload?.nextEligibleAt
    });
    if(waitMs!==null){
      // Acknowledged 409 is a definite no-write, so persist the safe resume
      // point BEFORE waiting. A crash cannot trigger an unverified re-publish.
      state=await saveCheckpoint(config,checkpointState(state,'PREPARED_FOR_NATIVE_AUDIT',{
        errorCategory:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:payload.nextEligibleAt
      }));
      console.log('AI_V2_CONFIRMED_SLOT_WAIT '+JSON.stringify({articleId,waitMs}));
      if(waitMs>0)await new Promise(resolve=>setTimeout(resolve,waitMs));
      state=await saveCheckpoint(config,checkpointState(state,'PUBLISH_REQUEST_SENT',{
        publishRequestedAt:now(),retryOf:'CONFIRMED_409_NO_WRITE'
      }));
      ({response,payload}=await requestPublish());
    }
  }catch{
    await saveCheckpoint(config,checkpointState(state,'UNKNOWN_PUBLICATION_OUTCOME',{errorCategory:'PUBLISH_HTTP_OUTCOME_UNKNOWN'}));
    report('BLOCKED','PUBLISH_HTTP_OUTCOME_UNKNOWN',{articleId,livePublished:false});return;
  }
  if(!response.ok||payload?.ok!==true){
    const reason=String(payload?.reason||'NATIVE_PUBLISH_DENIED');
    const edge5xx=response.status>=500&&response.status<600&&/^NATIVE_PUBLISH_HTTP_/.test(reason);
    if(edge5xx){
      // An HTML 5xx has no durable "not written" acknowledgement. Check the
      // exact existing public URL; never resend an ambiguous publish request.
      const url=config.domain+'/articles/'+encodeURIComponent(topic.slug);
      let live=false;
      try{
        const res=await fetch(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(16000)});
        live=res.status===200&&(await res.text()).includes(topic.coupon);
      }catch{}
      if(live){
        await saveCheckpoint(config,checkpointState(state,'LIVE_VERIFIED',{liveVerifiedAt:now(),liveUrl:url}));
        report('LIVE_VERIFIED','PUBLISH_5XX_BUT_ARTICLE_ALREADY_PUBLIC',{articleId,url,livePublished:true});return;
      }
      await saveCheckpoint(config,checkpointState(state,'UNKNOWN_PUBLICATION_OUTCOME',{
        errorCategory:'NATIVE_PUBLISH_EDGE_5XX_OUTCOME_UNKNOWN',lastRequestStatus:response.status,
        candidateLiveUrl:url,lastPublicVerificationAt:now(),reviewRequired:true
      }));
      report('BLOCKED','PUBLISH_5XX_OUTCOME_QUARANTINED',{articleId,http:response.status,livePublished:false});return;
    }
    const recoverable=['GLOBAL_PUBLICATION_SLOT_NOT_DUE','GLOBAL_PUBLICATION_SLOT_NOT_GRANTED','CLOUDFLARE_1027_DAILY_LIMIT'].includes(reason);
    await saveCheckpoint(config,checkpointState(state,recoverable?'PREPARED_FOR_NATIVE_AUDIT':'BLOCKED_REVIEW',{
      errorCategory:reason,nativeGateDiagnostics:payload?.diagnostics||null}));
    report('BLOCKED',reason,{articleId,words:check.wordCount,quality:payload?.diagnostics?.score||null,http:response.status,
      qualityDiagnostics:reason==='NATIVE_QUALITY_BLOCKED'?{
        p0:payload?.diagnostics?.p0||[],failed:payload?.diagnostics?.failed||[],
        schemas:payload?.diagnostics?.schemas||[],duplicates:payload?.diagnostics?.duplicates||[],
        indexation:payload?.diagnostics?.indexation||[]}:null,livePublished:false});return;
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
async function runScheduledBatch(){
  const liveDispatch=process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&
    process.env.GITHUB_WORKFLOW==='NoonDealsNow AI V2 - Safe Checkpoints and Preflight'&&
    process.env.AI_PREFLIGHT_ONLY==='false'&&['SA','AE'].includes(process.env.AI_QUEUE_MARKET);
  // Up to three serial verified articles per healthy market amortize runner startup; never
  // multiply preflight or canary calls. Every article keeps its own verified
  // R2 checkpoint, native quality audit and atomic global publication permit.
  const maximum=liveDispatch?3:1,jobStarted=Date.now();
  let published=0;
  for(let i=0;i<maximum;i++){
    if(i>0&&Date.now()-jobStarted>150000)break;
    jobBatchOrdinal=i;
    runStartedAt=Date.now();
    lastReportStatus=null;
    await run();
    if(lastReportStatus!=='LIVE_VERIFIED')break;
    published++;
  }
  console.log('AI_V2_JOB_BATCH '+JSON.stringify({market:process.env.AI_QUEUE_MARKET||null,
    verifiedArticles:published,maxArticles:maximum,elapsedMs:Date.now()-jobStarted}));
}
runScheduledBatch().then(async()=>{
  // Five-minute census, plus immediate verified successes, keeps free R2 reads
  // bounded and shows actual per-key quota cooldowns without provider calls.
  const market=String(process.env.AI_QUEUE_MARKET||'').toUpperCase();
  if(!['SA','AE'].includes(market))return;
  const isCensusMinute=Math.floor(Date.now()/60000)%5===0;
  if(!isCensusMinute&&lastReportStatus!=='LIVE_VERIFIED')return;
  try{
    const monitor=await buildSafeMonitor(process.env,{market,lastReport:lastSafeReport,lastSelected:lastSelectedCredential});
    const saved=await writeSafeMonitor(monitor);
    console.log('AI_V2_SAFE_MONITOR '+JSON.stringify({market,ok:saved.ok,
      reason:saved.ok?'UPDATED':saved.reason,
      configuredGemini:monitor.providers.gemini.total,configuredGroq:monitor.providers.groq.total,
      quotaWaitingGemini:monitor.providers.gemini.counts.quotaWait,
      quotaWaitingGroq:monitor.providers.groq.counts.quotaWait}));
  }catch(e){
    console.warn('AI_V2_MONITOR_NON_FATAL '+String(e?.message||e).slice(0,100));
  }
}).catch(e=>{console.error('AI_V2_SAFE_FAILURE '+String(e?.message||e).slice(0,250));process.exitCode=1});
