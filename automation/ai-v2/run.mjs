import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cadence,validateConfig,assertTopic,mayCallProvider,qualityPreflight,checkpointState} from './guardrails.mjs';
import {readCheckpoint,saveCheckpoint} from './r2-checkpoints.mjs';
import {callProvider} from './providers.mjs';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const topics=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url)));
const report=(status,reason,data={})=>console.log('AI_V2_REPORT '+JSON.stringify({site:'noondealsnow',status,reason,...data}));
const now=()=>new Date().toISOString();
const hash=s=>createHash('sha256').update(s).digest('hex');
validateConfig(config);

async function run(){
  const due=cadence(config,Number(process.env.AI_SCHEDULED_MS||Date.now()));
  if(process.env.AI_PREFLIGHT_ONLY==='true'){
    report('PREFLIGHT',due.reason,{enabled:config.enabled,targetPerHour:config.targetPerHour,mode:config.publicationMode,hasGemini:Boolean(process.env.GEMINI_API_KEY),hasGroq:Boolean(process.env.GROQ_API_KEY),hasPrivateStorageToken:Boolean(process.env.CLOUDFLARE_API_TOKEN),freeBudgetApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true'});return;
  }
  if(!due.due){report('SKIPPED',due.reason);return}
  const blocked=mayCallProvider({config,freeApproved:process.env.NOONDEALSNOW_AI_FREE_ONLY_APPROVED==='true',checkpointWritable:Boolean(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID),topicReserved:true,hasAnyKey:Boolean(process.env.GEMINI_API_KEY||process.env.GROQ_API_KEY)});
  if(blocked){report('SKIPPED',blocked);return}
  let selected;
  for(const topic of topics){
    const articleId=assertTopic(topic,config),saved=readCheckpoint(config,articleId);
    if(['BLOCKED_REVIEW','QUALITY_PASSED','COMMITTED','DEPLOYING','LIVE_VERIFIED','FAILED_FINAL','PAUSED_QUOTA','UNKNOWN_REQUEST_OUTCOME'].includes(saved?.state))continue;
    selected={topic,articleId,saved};break;
  }
  if(!selected){report('SKIPPED','NO_ELIGIBLE_TOPIC');return}
  const {topic,articleId}=selected;
  let state=selected.saved;
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
  const provider=process.env.GEMINI_API_KEY?'gemini':'groq',key=provider==='gemini'?process.env.GEMINI_API_KEY:process.env.GROQ_API_KEY,model=config.models[provider];
  let calls=0;
  while(state.sectionIndex<topic.sections.length){
    if(calls>=config.limits.maxProviderCallsPerRun){report('CHECKPOINTED','CALL_BUDGET_LIMIT',{articleId,sectionIndex:state.sectionIndex});return}
    const index=state.sectionIndex;
    if(state.state==='RESPONSE_RECEIVED'&&state.pendingResponse){
      const html=state.pendingResponse;
      state=saveCheckpoint(config,checkpointState(state,'DRAFT_SAVED',{sections:[...state.sections,{heading:topic.sections[index],html,hash:hash(html)}],sectionIndex:index+1,pendingResponse:null}));
      continue;
    }
    state=saveCheckpoint(config,checkpointState(state,'REQUEST_PENDING',{provider,model,pendingSection:index}));
    const prompt=[
      'Write an original, useful '+(topic.country==='SA'?'Saudi Arabic':'UAE English')+' consumer shopping article SECTION, valid HTML fragment only.',
      'Topic: '+topic.topic+'. Brand: '+topic.brand+'. Category: '+topic.category+'.',
      'Country: '+topic.country+'. Coupon: '+topic.coupon+'.',
      'Required section: '+topic.sections[index]+'.',
      'Provide 310-390 genuine words using h2 and p/list tags. Do not reproduce earlier sections.',
      'No fake discounts, dates, prices, testimonials, purchases, warranty promises or assumptions about coupon acceptance.',
      'No HTML head, JS, CSS, whole-article H1 or markdown code fences.'
    ].join('\n');
    // Persist the ambiguous billing boundary before sending the HTTP request.
    state=saveCheckpoint(config,checkpointState(state,'REQUEST_SENT',{sentAt:now(),pendingSection:index,lastRequestStatus:'UNKNOWN'}));calls++;
    let result;
    try{result=await callProvider({provider,model,key,prompt})}
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
  const html='<article lang="'+topic.language+'" dir="'+(topic.country==='SA'?'rtl':'ltr')+'"><h1>'+topic.topic+' | '+topic.coupon+'</h1>'+state.sections.map(s=>s.html).join('\n')+'</article>';
  state=saveCheckpoint(config,checkpointState(state,'VALIDATING',{draftHtml:html,contentHash:hash(html)}));
  const check=qualityPreflight({html,topic},config);
  // Existing site's production quality, images, DO 60s permit and R2 feed
  // must be integrated and verified before any live publication.
  saveCheckpoint(config,checkpointState(state,'BLOCKED_REVIEW',{qualityPreview:check,errorCategory:check.pass?'NATIVE_SITE_PUBLISHING_GATE_PENDING':check.violations.join(',')}));
  report('DRAFT_SAVED','NATIVE_GATE_PENDING',{articleId,sections:state.sections.length,words:check.wordCount,previewPassed:check.pass,provider,calls,checkpointReadBack:true,livePublished:false});
}
run().catch(e=>{console.error('AI_V2_SAFE_FAILURE '+String(e?.message||e).slice(0,250));process.exitCode=1});
