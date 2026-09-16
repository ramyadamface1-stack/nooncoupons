const STATE_KEY='english-canary/state.json';
const MARKER_KEY='english-canary/repair-guide-guide-v1.json';
const CLEANUP_MARKER_KEY='english-canary/reconcile-two-canaries-v1.json';
const TARGET_SLUGS=[
  'en-noon-coupon-eligibility-saudi-arabia-travel-guide',
  'en-smart-buying-on-noon-uae-headphones-and-audio-guide'
];
const UNINTENDED_CONTROLLED_SLUGS=[
  'en-noon-cart-coupon-saudi-arabia-office-guide',
  'en-noon-final-price-uae-kids-guide',
  'en-noon-coupon-code-saudi-arabia-home-guide',
  'en-noon-coupon-eligibility-uae-beauty-guide',
  'en-smart-buying-on-noon-saudi-arabia-laptops-and-computing-checkout-guide',
  'en-noon-final-price-uae-sports-and-fitness-shopping-guide',
  'en-best-time-to-try-a-noon-coupon-saudi-arabia-tvs-and-displays-shopping-guide',
  'en-noon-cart-coupon-uae-home-and-kitchen-checkout-guide'
];
const TARGET_SET=new Set(TARGET_SLUGS);
const UNINTENDED_SET=new Set(UNINTENDED_CONTROLLED_SLUGS);
const bad=/\bguide\s+guide\b/i;
const sanitize=s=>String(s??'').replace(/\bguide\s+guide\b/gi,'guide');
const now=()=>new Date().toISOString();
const decode=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const encode=s=>encodeURIComponent(String(s||'')).slice(0,900);
const json=(x,status=200)=>new Response(JSON.stringify(x,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function loadState(env){
  const o=await env.CONTENT_FINAL?.get(STATE_KEY);
  if(!o)return {object:null,state:null};
  return {object:o,state:await o.json()};
}

async function inspectArticle(env,slug){
  const key='articles/'+slug+'.html';
  const o=await env.CONTENT_FINAL?.get(key);
  if(!o)return {slug,key,present:false,htmlClean:false,metadataClean:false};
  const html=await o.text(),md={...(o.customMetadata||{})},meta=decode(md.m||'');
  return {slug,key,present:true,html,md,httpMetadata:o.httpMetadata||{contentType:'text/html; charset=utf-8'},htmlClean:!bad.test(html),metadataClean:!bad.test(meta),meta};
}

async function readMarker(env,key){
  try{const o=await env.CONTENT_FINAL?.get(key);return o?await o.json():null}catch{return null}
}

export async function reconcileEnglishCanaryToTwo(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const prior=await readMarker(env,CLEANUP_MARKER_KEY);
  if(prior?.complete)return {ok:true,skipped:'already_reconciled',marker:prior};
  const {state}=await loadState(env);
  if(!state||!Array.isArray(state.records))return {ok:false,error:'canary_state_missing'};

  const unknown=state.records.filter(r=>r?.languageSource==='native-intent-v6-canary'&&!TARGET_SET.has(r?.slug)&&!UNINTENDED_SET.has(r?.slug));
  if(unknown.length)return {ok:false,error:'unknown_english_records_present',unknown:unknown.map(r=>r.slug)};

  const unintended=state.records.filter(r=>UNINTENDED_SET.has(r?.slug));
  const unsafe=unintended.filter(r=>r?.languageSource!=='native-intent-v6-canary'||r?.phase!=='controlled'||r?.canary!==false);
  if(unsafe.length)return {ok:false,error:'unintended_record_identity_mismatch',unsafe:unsafe.map(r=>({slug:r.slug,languageSource:r.languageSource,phase:r.phase,canary:r.canary}))};

  for(const r of unintended)await env.CONTENT_FINAL.delete('articles/'+r.slug+'.html');
  const records=state.records.filter(r=>!UNINTENDED_SET.has(r?.slug));
  const reconciled={...state,records,controlledTarget:2,status:records.length>=2?'complete':'active',controlledStatus:records.length>=2?'complete':'active',reconciledToTwoAt:now(),reconciliation:'two-canaries-v1'};
  await env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(reconciled),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  const marker={complete:true,version:'two-canaries-v1',completedAt:now(),kept:[...TARGET_SLUGS],removed:unintended.map(r=>r.slug),removedCount:unintended.length,stateRecordsBefore:state.records.length,stateRecordsAfter:records.length};
  await env.CONTENT_FINAL.put(CLEANUP_MARKER_KEY,JSON.stringify(marker),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return {ok:true,reconciled:true,marker};
}

export async function repairEnglishCanaryLegacyMetadata(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const reconciliation=await reconcileEnglishCanaryToTwo(env);
  if(!reconciliation.ok)return {ok:false,error:'reconciliation_failed',reconciliation};
  const existing=await env.CONTENT_FINAL.get(MARKER_KEY);
  if(existing){
    try{const marker=await existing.json();if(marker?.complete)return {ok:true,skipped:'already_repaired',marker,reconciliation}}catch{}
  }
  const {state}=await loadState(env);
  if(!state||!Array.isArray(state.records))return {ok:false,error:'canary_state_missing'};
  const matched=state.records.filter(r=>TARGET_SET.has(r?.slug));
  if(matched.length!==TARGET_SLUGS.length)return {ok:false,error:'target_records_missing',matched:matched.map(r=>r.slug)};

  const inspected=[];
  for(const slug of TARGET_SLUGS){
    const row=await inspectArticle(env,slug);
    if(!row.present)return {ok:false,error:'target_article_missing',slug};
    inspected.push(row);
  }

  let stateChanged=false;
  const records=state.records.map(r=>{
    if(!TARGET_SET.has(r?.slug))return r;
    const next=sanitize(r.metaDescription);
    if(next!==String(r.metaDescription??''))stateChanged=true;
    return {...r,metaDescription:next,metadataRepair:'guide-guide-v1'};
  });

  const articleResults=[];
  for(const row of inspected){
    const cleanHtml=sanitize(row.html),cleanMeta=sanitize(row.meta),htmlChanged=cleanHtml!==row.html,metadataChanged=cleanMeta!==row.meta;
    const customMetadata={...row.md};
    if('m' in customMetadata||cleanMeta)customMetadata.m=encode(cleanMeta);
    customMetadata.metaRepair='guide-guide-v1';
    await env.CONTENT_FINAL.put(row.key,cleanHtml,{httpMetadata:row.httpMetadata,customMetadata});
    articleResults.push({slug:row.slug,htmlChanged,metadataChanged,htmlClean:!bad.test(cleanHtml),metadataClean:!bad.test(cleanMeta)});
  }

  const repairedState={...state,records,metadataRepair:'guide-guide-v1',metadataRepairAt:now()};
  await env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(repairedState),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  const marker={complete:true,version:'guide-guide-v1',completedAt:now(),targets:[...TARGET_SLUGS],stateChanged,articles:articleResults,totalStateRecords:state.records.length};
  await env.CONTENT_FINAL.put(MARKER_KEY,JSON.stringify(marker),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return {ok:true,repaired:true,marker,reconciliation};
}

export async function englishCanaryRepairHealth(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const {state}=await loadState(env);
  const rows=Array.isArray(state?.records)?state.records:[];
  const targetRows=rows.filter(r=>TARGET_SET.has(r?.slug));
  const stateChecks=TARGET_SLUGS.map(slug=>{const r=targetRows.find(x=>x.slug===slug);return {slug,present:Boolean(r),clean:Boolean(r)&&!bad.test(String(r.metaDescription||'')),metaDescription:r?.metaDescription||null}});
  const articleChecks=[];
  for(const slug of TARGET_SLUGS){const a=await inspectArticle(env,slug);articleChecks.push({slug,present:a.present,htmlClean:a.htmlClean,metadataClean:a.metadataClean});}
  const marker=await readMarker(env,MARKER_KEY),cleanupMarker=await readMarker(env,CLEANUP_MARKER_KEY);
  const unexpected=rows.filter(r=>r?.languageSource==='native-intent-v6-canary'&&!TARGET_SET.has(r?.slug)).map(r=>r.slug);
  const unexpectedR2=[];
  for(const slug of UNINTENDED_CONTROLLED_SLUGS){try{if(await env.CONTENT_FINAL.head('articles/'+slug+'.html'))unexpectedR2.push(slug)}catch{}}
  const clean=stateChecks.every(x=>x.present&&x.clean)&&articleChecks.every(x=>x.present&&x.htmlClean&&x.metadataClean);
  const reconciled=rows.length===2&&unexpected.length===0&&unexpectedR2.length===0&&cleanupMarker?.complete===true&&cleanupMarker?.version==='two-canaries-v1';
  return {ok:clean&&reconciled,version:'guide-guide-v1',targetCount:TARGET_SLUGS.length,totalStateRecords:rows.length,unexpectedEnglishRecords:unexpected,unexpectedR2Objects:unexpectedR2,stateClean:stateChecks.every(x=>x.present&&x.clean),r2HtmlClean:articleChecks.every(x=>x.present&&x.htmlClean),r2MetadataClean:articleChecks.every(x=>x.present&&x.metadataClean),reconciledToTwo:reconciled,state:stateChecks,articles:articleChecks,marker,cleanupMarker};
}

export async function serveEnglishCanaryRepairHealth(env){const h=await englishCanaryRepairHealth(env);return json(h,h.ok?200:503)}

export const ENGLISH_CANARY_REPAIR_INFO={version:'guide-guide-v1',reconciliation:'two-canaries-v1',targets:[...TARGET_SLUGS],unintended:[...UNINTENDED_CONTROLLED_SLUGS],stateKey:STATE_KEY,markerKey:MARKER_KEY,cleanupMarkerKey:CLEANUP_MARKER_KEY};
