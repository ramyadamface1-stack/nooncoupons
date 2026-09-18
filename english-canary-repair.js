import {isApprovedCoupon,normalizeApprovedCoupon,replaceUnapprovedCouponTokens} from './approved-coupons.js';
const STATE_KEY='english-canary/state.json';
const MARKER_KEY='english-canary/repair-guide-guide-v1.json';
const CLEANUP_MARKER_KEY='english-canary/reconcile-two-canaries-v1.json';
const QUALITY_MARKER_KEY='english-canary/quality-copy-v2.json';
const HTML_MARKER_KEY='english-canary/html-copy-v1.json';
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
const BAD_QUALITY_SLUGS=['en-best-time-to-try-a-noon-coupon-uae-office-cart-test'];
const TARGET_SET=new Set(TARGET_SLUGS);
const UNINTENDED_SET=new Set(UNINTENDED_CONTROLLED_SLUGS);
const BAD_QUALITY_SET=new Set(BAD_QUALITY_SLUGS);
const bad=/\bguide\s+guide\b/i;
const badVariant=/\bcart\s+test\b/i;
const sanitize=s=>String(s??'').replace(/\bguide\s+guide\b/gi,'guide');
const sanitizeHtmlCopy=s=>String(s??'').replace(/\bcart\s+test\b/gi,'checkout checklist').replace(/\bguide\s+guide\b/gi,'guide');
const now=()=>new Date().toISOString();
const decode=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const encode=s=>encodeURIComponent(String(s||'')).slice(0,900);
const json=(x,status=200)=>new Response(JSON.stringify(x,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function wordSafeMeta(text,max=155){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(clean.length<=max)return clean;
  const hard=clean.slice(0,Math.max(1,max-1));
  const cut=hard.lastIndexOf(' ');
  const body=(cut>=Math.floor(max*0.68)?hard.slice(0,cut):hard).replace(/[\s,;:\-–—.]+$/g,'');
  return `${body}.`;
}
function completeMeta(record){
  const kw=String(record?.primaryKeyword||record?.title||'').replace(/\bguide\s+guide\b/gi,'guide').replace(/\s+/g,' ').trim();
  const code=String(record?.coupon||'').trim();
  const metaLead=/\bguide$/i.test(kw)?kw:`${kw} guide`;
  const long=`Practical ${metaLead}. Copy ${code}, verify cart eligibility, seller and shipping, then confirm the final checkout total.`;
  const short=`Practical ${metaLead}. Copy ${code}, verify eligibility and confirm the final checkout total.`;
  return wordSafeMeta(long.length<=155?long:short,155);
}
function copyQualityClean(record){
  const meta=String(record?.metaDescription||'');
  const combined=[record?.slug,record?.title,record?.primaryKeyword,meta].join(' ');
  return Boolean(meta)&&meta.length<=155&&/[.!?]$/.test(meta)&&!bad.test(meta)&&!badVariant.test(combined)&&meta===completeMeta(record);
}

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

async function ensureLegacyGuideRepair(env){
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

export async function repairEnglishControlledQualityV2(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const existing=await readMarker(env,QUALITY_MARKER_KEY);
  if(existing?.complete)return {ok:true,skipped:'already_repaired',marker:existing};
  const {state}=await loadState(env);
  if(!state||!Array.isArray(state.records))return {ok:false,error:'canary_state_missing'};

  const badRows=state.records.filter(r=>BAD_QUALITY_SET.has(r?.slug)||badVariant.test([r?.slug,r?.title,r?.primaryKeyword].join(' ')));
  const unsafe=badRows.filter(r=>r?.languageSource!=='native-intent-v6-canary'||r?.canary!==false||r?.phase!=='controlled');
  if(unsafe.length)return {ok:false,error:'quality_drop_identity_mismatch',unsafe:unsafe.map(r=>({slug:r.slug,canary:r.canary,phase:r.phase,languageSource:r.languageSource}))};

  const dropped=new Set(badRows.map(r=>r.slug));
  const repairedAt=now();
  let metaChanged=0;
  const records=state.records.filter(r=>!dropped.has(r?.slug)).map(r=>{
    if(r?.languageSource!=='native-intent-v6-canary')return r;
    const next=completeMeta(r);
    if(next!==String(r.metaDescription||''))metaChanged++;
    return {...r,metaDescription:next,metadataRepairV2:'english-copy-v2'};
  });

  const metadataResults=[];
  for(const r of records){
    if(r?.languageSource!=='native-intent-v6-canary')continue;
    const row=await inspectArticle(env,r.slug);
    if(!row.present)return {ok:false,error:'quality_article_missing',slug:r.slug};
    const customMetadata={...row.md,m:encode(r.metaDescription),copyRepair:'english-copy-v2'};
    await env.CONTENT_FINAL.put(row.key,row.html,{httpMetadata:row.httpMetadata,customMetadata});
    metadataResults.push({slug:r.slug,metaDescription:r.metaDescription,metadataUpdated:true});
  }
  for(const r of badRows)await env.CONTENT_FINAL.delete('articles/'+r.slug+'.html');

  const target=Math.max(2,Number(state.controlledTarget||2));
  const repairedState={...state,records,controlledStatus:records.length>=target?'complete':'active',lastError:null,qualityCopyRepair:'english-copy-v2',qualityCopyRepairAt:repairedAt};
  await env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(repairedState),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  const marker={complete:true,version:'english-copy-v2',completedAt:repairedAt,metaChanged,dropped:[...dropped],droppedCount:dropped.size,stateRecordsBefore:state.records.length,stateRecordsAfter:records.length,metadataResults};
  await env.CONTENT_FINAL.put(QUALITY_MARKER_KEY,JSON.stringify(marker),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return {ok:true,repaired:true,marker};
}

export async function repairEnglishStoredHtmlV1(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const existing=await readMarker(env,HTML_MARKER_KEY);
  if(existing?.complete)return {ok:true,skipped:'already_repaired',marker:existing};
  const {state}=await loadState(env);
  if(!state||!Array.isArray(state.records))return {ok:false,error:'canary_state_missing'};
  const rows=state.records.filter(r=>r?.languageSource==='native-intent-v6-canary');
  const results=[];
  for(const r of rows){
    const row=await inspectArticle(env,r.slug);
    if(!row.present)return {ok:false,error:'html_article_missing',slug:r.slug};
    const cleanHtml=sanitizeHtmlCopy(row.html);
    const changed=cleanHtml!==row.html;
    if(changed){
      const customMetadata={...row.md,htmlCopyRepair:'html-copy-v1'};
      await env.CONTENT_FINAL.put(row.key,cleanHtml,{httpMetadata:row.httpMetadata,customMetadata});
    }
    results.push({slug:r.slug,changed,clean:!bad.test(cleanHtml)&&!badVariant.test(cleanHtml)});
  }
  if(!results.every(x=>x.clean))return {ok:false,error:'html_copy_still_dirty',results};
  const marker={complete:true,version:'html-copy-v1',completedAt:now(),checked:results.length,changed:results.filter(x=>x.changed).map(x=>x.slug),changedCount:results.filter(x=>x.changed).length,results};
  await env.CONTENT_FINAL.put(HTML_MARKER_KEY,JSON.stringify(marker),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return {ok:true,repaired:true,marker};
}

export async function repairEnglishCanaryLegacyMetadata(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const legacy=await ensureLegacyGuideRepair(env);
  if(!legacy.ok)return legacy;
  const quality=await repairEnglishControlledQualityV2(env);
  if(!quality.ok)return {ok:false,legacy,quality};
  const html=await repairEnglishStoredHtmlV1(env);
  return {ok:html.ok,legacy,quality,html};
}

export async function englishCanaryRepairHealth(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const {state}=await loadState(env);
  const rows=Array.isArray(state?.records)?state.records:[];
  const targetRows=rows.filter(r=>TARGET_SET.has(r?.slug));
  const stateChecks=TARGET_SLUGS.map(slug=>{const r=targetRows.find(x=>x.slug===slug);return {slug,present:Boolean(r),clean:Boolean(r)&&!bad.test(String(r.metaDescription||'')),metaDescription:r?.metaDescription||null}});
  const articleChecks=[];
  for(const slug of TARGET_SLUGS){const a=await inspectArticle(env,slug);articleChecks.push({slug,present:a.present,htmlClean:a.htmlClean,metadataClean:a.metadataClean});}
  const marker=await readMarker(env,MARKER_KEY),cleanupMarker=await readMarker(env,CLEANUP_MARKER_KEY),qualityMarker=await readMarker(env,QUALITY_MARKER_KEY),htmlMarker=await readMarker(env,HTML_MARKER_KEY);

  const identityProblems=rows.filter(r=>r?.languageSource!=='native-intent-v6-canary'||(TARGET_SET.has(r.slug)?r.canary!==true:(r.canary!==false||r.phase!=='controlled'))).map(r=>r.slug);
  const unexpectedR2=[];
  for(const slug of [...UNINTENDED_CONTROLLED_SLUGS,...BAD_QUALITY_SLUGS]){try{if(await env.CONTENT_FINAL.head('articles/'+slug+'.html'))unexpectedR2.push(slug)}catch{}}

  const qualityState=rows.map(r=>({slug:r.slug,clean:copyQualityClean(r),metaDescription:r.metaDescription||null}));
  const qualityR2=[];
  for(const r of rows){
    const a=await inspectArticle(env,r.slug);
    qualityR2.push({slug:r.slug,present:a.present,metadataMatches:a.present&&a.meta===String(r.metaDescription||''),variantClean:a.present&&!badVariant.test([a.html,a.meta].join(' ')),guideClean:a.present&&!bad.test(a.html)});
  }

  const baselineClean=stateChecks.every(x=>x.present&&x.clean)&&articleChecks.every(x=>x.present&&x.htmlClean&&x.metadataClean);
  const baselineReconciled=cleanupMarker?.complete===true&&cleanupMarker?.version==='two-canaries-v1';
  const htmlRepairComplete=htmlMarker?.complete===true&&htmlMarker?.version==='html-copy-v1';
  const target=Math.max(2,Number(state?.controlledTarget||2));
  const currentQualityClean=rows.length>=2&&qualityState.every(x=>x.clean)&&qualityR2.every(x=>x.present&&x.metadataMatches&&x.variantClean&&x.guideClean)&&identityProblems.length===0&&unexpectedR2.length===0&&htmlRepairComplete;
  const expansionComplete=rows.length>=target;
  const ok=baselineClean&&baselineReconciled&&currentQualityClean;
  return {ok,version:'english-copy-v2',targetCount:TARGET_SLUGS.length,controlledTarget:target,totalStateRecords:rows.length,expansionComplete,remaining:Math.max(0,target-rows.length),unexpectedEnglishRecords:identityProblems,unexpectedR2Objects:unexpectedR2,stateClean:qualityState.every(x=>x.clean),r2HtmlClean:qualityR2.every(x=>x.present&&x.variantClean&&x.guideClean),r2MetadataClean:qualityR2.every(x=>x.present&&x.metadataMatches),reconciledToTwo:baselineReconciled,baselineReconciled,htmlRepairComplete,controlledQualityClean:currentQualityClean,state:stateChecks,articles:articleChecks,qualityState,qualityR2,marker,cleanupMarker,qualityMarker,htmlMarker};
}

export async function serveEnglishCanaryRepairHealth(env){const h=await englishCanaryRepairHealth(env);return json(h,h.ok?200:503)}

export const ENGLISH_CANARY_REPAIR_INFO={version:'english-copy-v2',legacyVersion:'guide-guide-v1',reconciliation:'two-canaries-v1',htmlVersion:'html-copy-v1',targets:[...TARGET_SLUGS],unintended:[...UNINTENDED_CONTROLLED_SLUGS],qualityDrops:[...BAD_QUALITY_SLUGS],stateKey:STATE_KEY,markerKey:MARKER_KEY,cleanupMarkerKey:CLEANUP_MARKER_KEY,qualityMarkerKey:QUALITY_MARKER_KEY,htmlMarkerKey:HTML_MARKER_KEY};
