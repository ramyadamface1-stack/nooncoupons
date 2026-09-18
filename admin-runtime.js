import {GENERATOR_DEFAULTS,readState} from './generator-core-v2.js';
import {runProgrammaticBatch,BULK_RUNTIME_LIMITS} from './bulk-generator.js';
import {runLegacyUpgradeBatchV2} from './legacy-upgrader-v2.js';
import {gscSeoDropsSnapshot} from './gsc-snapshot.js';

const ADMIN_EMAIL='ramyshahin02@gmail.com';
const now=()=>new Date().toISOString();
const enc=new TextEncoder();
const json=(x,s=200,extra={})=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const toHex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(s){return toHex(await crypto.subtle.digest('SHA-256',enc.encode(String(s||''))))}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const p of raw.split(';')){const [k,...v]=p.trim().split('=');if(k===name)return decodeURIComponent(v.join('='))}return ''}
async function body(req){try{return await req.json()}catch{return {}}}
async function gctl(env,path,init){const id=env.GENERATOR_CONTROL.idFromName('primary');return env.GENERATOR_CONTROL.get(id).fetch('https://generator.internal'+path,init)}
async function ctl(env,path,init){const id=env.CONTROL.idFromName('primary');return env.CONTROL.get(id).fetch('https://control.internal'+path,init)}
async function r2json(env,key,fallback){
  if(!env.CONTENT_FINAL)return fallback;
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{const o=await env.CONTENT_FINAL.get(key);return o?await o.json():fallback}
    catch(e){last=e;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,40*attempt))}
  }
  throw last||new Error('r2_status_read_failed');
}

const R2_GENERATOR_CONFIG_KEY='_ops/generator-config.json';
const R2_GENERATOR_STATUS_KEY='_ops/generator-status.json';
const R2_GENERATOR_LOCK_KEY='_ops/generator-lock.json';
const R2_SEO_SETTINGS_KEY='_ops/seo-settings.json';
const BULK_RUN_LOCK_MS=5*60*1000;

export function chooseAdaptiveBulkBatch(env,status={}){
  const catchupGoal=Math.max(0,Number(env.BULK_CATCHUP_TOTAL||30000));
  const publishedTotal=Math.max(0,Number(status.bulkPublishedTotal||0));
  const steadyBatch=Math.max(1,Number(env.BULK_BATCH_SIZE||16));
  const maxCatchup=Math.max(steadyBatch,Math.min(BULK_RUNTIME_LIMITS.maxBatchSize,Number(env.BULK_CATCHUP_BATCH_SIZE||64)));
  const minCatchup=Math.max(steadyBatch,Math.min(maxCatchup,Number(env.BULK_CATCHUP_MIN_BATCH_SIZE||32)));
  const targetMs=Math.max(30000,Math.min(58000,Number(env.BULK_CATCHUP_TARGET_BATCH_MS||52000)));
  const lastPublished=Math.max(0,Number(status.bulkLastBatchPublished||0));
  const lastDurationMs=Math.max(0,Number(status.bulkLastBatchDurationMs||0));
  let adaptive=maxCatchup,reason='cold_start_max';
  if(publishedTotal>=catchupGoal)return {batchSize:steadyBatch,mode:'steady',reason:'catchup_complete',targetMs,minCatchup,maxCatchup,lastPublished,lastDurationMs};
  if(lastPublished>0&&lastDurationMs>0){
    const projected=Math.floor(lastPublished*targetMs/lastDurationMs);
    adaptive=Math.max(minCatchup,Math.min(maxCatchup,projected||minCatchup));
    reason=adaptive<maxCatchup?'duration_target':'max_within_target';
  }
  return {batchSize:adaptive,mode:'catchup-adaptive',reason,targetMs,minCatchup,maxCatchup,lastPublished,lastDurationMs};
}

function cleanSeoToken(v,max=300){const s=String(v??'').trim();return /^[A-Za-z0-9._:@+\-]*$/.test(s)&&s.length<=max?s:''}
function cleanSeoText(v,max=500){return String(v??'').replace(/[<>]/g,'').trim().slice(0,max)}
function normalizeRouteOverrides(raw){
  const out={},source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  for(const [path,value] of Object.entries(source).slice(0,100)){
    if(!/^\/[A-Za-z0-9_\-/%\u0600-\u06FF.]*$/.test(path)||!value||typeof value!=='object'||Array.isArray(value))continue;
    const row={};
    if(value.title)row.title=cleanSeoText(value.title,180);
    if(value.description)row.description=cleanSeoText(value.description,320);
    if(value.canonical){const v=String(value.canonical).trim();if(v.startsWith('/')&&!v.startsWith('//'))row.canonical=v.slice(0,300)}
    if(['index,follow','noindex,follow','noindex,nofollow'].includes(value.robots))row.robots=value.robots;
    if(value.ogTitle)row.ogTitle=cleanSeoText(value.ogTitle,180);
    if(value.ogDescription)row.ogDescription=cleanSeoText(value.ogDescription,320);
    if(value.ogImage){const v=String(value.ogImage).trim();if(v.startsWith('/')&&!v.startsWith('//'))row.ogImage=v.slice(0,300)}
    if(Object.keys(row).length)out[path]=row;
  }
  return out;
}
export function defaultSeoSettings(){
  return {version:1,siteName:'Noon Deals Now',defaultOgImage:'/favicon.svg',googleVerification:'',bingVerification:'',yandexVerification:'',pinterestVerification:'',twitterSite:'',facebookAppId:'',routeOverrides:{},updatedAt:null};
}
export async function getSeoSettings(env){
  const existing=await r2json(env,R2_SEO_SETTINGS_KEY,null);
  return {...defaultSeoSettings(),...(existing||{}),routeOverrides:normalizeRouteOverrides(existing?.routeOverrides||{})};
}
async function saveSeoSettings(env,input={}){
  const current=await getSeoSettings(env);
  const next={...current,
    siteName:cleanSeoText(input.siteName??current.siteName,120)||'Noon Deals Now',
    defaultOgImage:(()=>{const v=String(input.defaultOgImage??current.defaultOgImage??'').trim();return v.startsWith('/')&&!v.startsWith('//')?v.slice(0,300):'/favicon.svg'})(),
    googleVerification:cleanSeoToken(input.googleVerification??current.googleVerification),
    bingVerification:cleanSeoToken(input.bingVerification??current.bingVerification),
    yandexVerification:cleanSeoToken(input.yandexVerification??current.yandexVerification),
    pinterestVerification:cleanSeoToken(input.pinterestVerification??current.pinterestVerification),
    twitterSite:cleanSeoText(input.twitterSite??current.twitterSite,80),
    facebookAppId:cleanSeoToken(input.facebookAppId??current.facebookAppId,120),
    routeOverrides:normalizeRouteOverrides(input.routeOverrides??current.routeOverrides),
    updatedAt:now(),version:1
  };
  return r2putJson(env,R2_SEO_SETTINGS_KEY,next);
}

async function r2putJson(env,key,value){
  if(!env.CONTENT_FINAL)throw new Error('r2_binding_missing');
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await env.CONTENT_FINAL.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
      return value;
    }catch(e){last=e;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,60*attempt))}
  }
  throw last||new Error('r2_status_put_failed');
}
function defaultGeneratorConfig(env){
  return {...GENERATOR_DEFAULTS,enabled:true,model:env.WORKERS_AI_MODEL||GENERATOR_DEFAULTS.model,provider:'workers-ai',externalProviders:false,targetWords:1700,minWords:1500,qualityThreshold:95,backend:'r2-v1',updatedAt:now()};
}
async function bootstrapGeneratorStatus(env){
  const day=now().slice(0,10),days=await r2json(env,'bulk/days.json',{days:[]}),latest=await r2json(env,'bulk/latest.json',{articles:[]});
  const rows=Array.isArray(days?.days)?days.days:[],todayRow=rows.find(x=>x?.day===day),total=rows.reduce((s,x)=>s+Math.max(0,Number(x?.count||0)),0);
  const topicMax=(latest?.articles||[]).reduce((m,x)=>Math.max(m,Number(x?.topicIndex||0)),0);
  return {attempts:0,published:0,failed:0,lastRun:null,lastSuccess:null,lastError:null,recent:[],bulkDay:day,bulkPublishedTotal:total,bulkPublishedToday:Math.max(0,Number(todayRow?.count||0)),bulkCursorV2:Math.max(500000,topicMax+1),bulkRunningAt:null,legacyUpgradeTotal:0,legacyUpgradeRemaining:null,legacyUpgradeComplete:false,legacyUpgradePausedForConsolidation:true,backend:'r2-v1',updatedAt:now()};
}
export async function getGeneratorConfig(env){
  const existing=await r2json(env,R2_GENERATOR_CONFIG_KEY,null);
  if(existing?.backend==='r2-v1')return {...defaultGeneratorConfig(env),...existing,enabled:true,externalProviders:false};
  return r2putJson(env,R2_GENERATOR_CONFIG_KEY,defaultGeneratorConfig(env));
}
export async function getGeneratorStatus(env){
  const existing=await r2json(env,R2_GENERATOR_STATUS_KEY,null);
  if(existing?.backend==='r2-v1')return existing;
  const boot=await bootstrapGeneratorStatus(env);return r2putJson(env,R2_GENERATOR_STATUS_KEY,boot);
}
export async function updateGeneratorStatus(env,patch){
  const current=await getGeneratorStatus(env),next={...current,...patch,backend:'r2-v1',updatedAt:now()};
  next.recent=[{at:now(),ok:!patch.lastError,slug:patch.lastSlug||null,error:patch.lastError||null},...(current.recent||[])].slice(0,100);
  return r2putJson(env,R2_GENERATOR_STATUS_KEY,next);
}
export async function generatorLock(env,runId){
  const lock=await r2json(env,R2_GENERATOR_LOCK_KEY,null),lockedAt=Date.parse(lock?.at||'');
  if(lock&&Number.isFinite(lockedAt)&&Date.now()-lockedAt<240000)return new Response(JSON.stringify({ok:false,lock}),{status:409,headers:{'content-type':'application/json'}});
  await r2putJson(env,R2_GENERATOR_LOCK_KEY,{id:runId,at:now(),backend:'r2-v1'});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
}
export async function generatorUnlock(env,runId){
  const lock=await r2json(env,R2_GENERATOR_LOCK_KEY,null);
  if(!lock||!runId||lock.id===runId)try{await env.CONTENT_FINAL.delete(R2_GENERATOR_LOCK_KEY)}catch{}
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
}
export async function bulkTick(env){
  const status=await getGeneratorStatus(env),runningAt=Date.parse(status.bulkRunningAt||'');
  if(Number.isFinite(runningAt)&&Date.now()-runningAt<BULK_RUN_LOCK_MS)return {ok:true,skipped:'bulk_already_running',backend:'r2-v1',bulkPublishedToday:Number(status.bulkPublishedToday||0)};
  const cfg=await getGeneratorConfig(env),locked={...status,bulkRunningAt:now(),backend:'r2-v1'};await r2putJson(env,R2_GENERATOR_STATUS_KEY,locked);
  try{
    const adaptive=chooseAdaptiveBulkBatch(env,locked),effectiveBatch=adaptive.batchSize;
    const bulk=await runProgrammaticBatch(env,cfg,locked,{dailyTarget:Number(env.BULK_DAILY_TARGET||32000),batchSize:effectiveBatch});
    const next={...locked,...(bulk.patch||{}),bulkRunningAt:null,backend:'r2-v1',updatedAt:now()};await r2putJson(env,R2_GENERATOR_STATUS_KEY,next);
    return {ok:true,backend:'r2-v1',adaptiveBatch:adaptive,bulk:{ok:bulk.ok,skipped:bulk.skipped||null,engine:bulk.engine||null,records:bulk.records||[],tries:bulk.tries||0,rejectedQuality:bulk.rejectedQuality||0,rejectedDuplicate:bulk.rejectedDuplicate||0},summary:{bulkPublishedToday:Number(next.bulkPublishedToday||0),bulkPublishedTotal:Number(next.bulkPublishedTotal||0),bulkDailyTarget:Number(next.bulkDailyTarget||env.BULK_DAILY_TARGET||32000),bulkCursorV2:Number(next.bulkCursorV2||0)}};
  }catch(e){
    const next={...locked,bulkRunningAt:null,bulkLastRun:now(),bulkLastError:String(e?.message||e),backend:'r2-v1',updatedAt:now()};await r2putJson(env,R2_GENERATOR_STATUS_KEY,next);return {ok:false,backend:'r2-v1',error:next.bulkLastError};
  }
}

export class GeneratorControl{
  constructor(ctx,env){this.ctx=ctx;this.env=env}
  async config(){
    let c=await this.ctx.storage.get('config'),dirty=false;
    if(!c){c={...GENERATOR_DEFAULTS,createdAt:now()};dirty=true}
    if(c.enabled!==true){c.enabled=true;dirty=true}
    const model=this.env.WORKERS_AI_MODEL||GENERATOR_DEFAULTS.model;
    if(c.model!==model){c.model=model;dirty=true}
    if(c.provider!=='workers-ai'){c.provider='workers-ai';dirty=true}
    if(c.externalProviders!==false){c.externalProviders=false;dirty=true}
    if(!Number.isFinite(Number(c.targetWords))){c.targetWords=GENERATOR_DEFAULTS.targetWords;dirty=true}
    if(!Number.isFinite(Number(c.minWords))||Number(c.minWords)<1500){c.minWords=Math.max(1500,Number(GENERATOR_DEFAULTS.minWords||1500));dirty=true}
    if(!Number.isFinite(Number(c.qualityThreshold))){c.qualityThreshold=GENERATOR_DEFAULTS.qualityThreshold;dirty=true}
    if(dirty)await this.ctx.storage.put('config',c);
    return c;
  }
  async status(){return (await this.ctx.storage.get('status'))||{attempts:0,published:0,failed:0,lastRun:null,lastSuccess:null,lastError:null,recent:[],bulkPublishedTotal:0,bulkPublishedToday:0,bulkCursor:0,legacyUpgradeTotal:0,legacyUpgradeRemaining:null,legacyUpgradeComplete:false,legacyUpgradeCursorV2:0,legacyUpgradePassV2:1,legacyUpgradePausedForConsolidation:false}}
  async fetch(req){
    const u=new URL(req.url),p=u.pathname;
    if(p==='/config'&&req.method==='GET')return json(await this.config());
    if(p==='/config'&&req.method==='POST'){
      const b=await req.json(),c=await this.config(),next={...c};
      if('enabled' in b)next.enabled=true;
      if('targetWords' in b)next.targetWords=Math.max(1200,Math.min(1800,Number(b.targetWords)||1500));
      if('minWords' in b)next.minWords=Math.max(1500,Math.min(1800,Number(b.minWords)||1500));
      if('qualityThreshold' in b)next.qualityThreshold=Math.max(95,Math.min(100,Number(b.qualityThreshold)||95));
      next.model=this.env.WORKERS_AI_MODEL||GENERATOR_DEFAULTS.model;next.provider='workers-ai';next.externalProviders=false;next.updatedAt=now();
      await this.ctx.storage.put('config',next);return json(next);
    }
    if(p==='/status'&&req.method==='GET')return json(await this.status());
    if(p==='/status'&&req.method==='POST'){
      const b=await req.json(),s={...(await this.status()),...b};
      s.recent=[{at:now(),ok:!b.lastError,slug:b.lastSlug||null,error:b.lastError||null},...(s.recent||[])].slice(0,100);
      await this.ctx.storage.put('status',s);return json(s);
    }
    if(p==='/bulk-tick'&&req.method==='POST'){
      const status=await this.status(),runningAt=Date.parse(status.bulkRunningAt||'');
      if(Number.isFinite(runningAt)&&Date.now()-runningAt<BULK_RUN_LOCK_MS)return json({ok:true,skipped:'bulk_already_running',bulkPublishedToday:Number(status.bulkPublishedToday||0),legacyUpgradeTotal:Number(status.legacyUpgradeTotal||0)});
      const cfg=await this.config(),locked={...status,bulkRunningAt:now()};
      await this.ctx.storage.put('status',locked);
      try{
        const terminalLegacy=Boolean(locked.legacyUpgradePausedForConsolidation);
        const legacy=terminalLegacy?{ok:true,skipped:'legacy_upgrade_paused_for_consolidation',records:[],scanned:0,rejected:0,invalid:0,pass:Number(locked.legacyUpgradePassV2||4),passFinished:true,failures:[],patch:{legacyUpgradeLastRun:now(),legacyUpgradeLastError:null,legacyUpgradeNeedsConsolidation:true,legacyUpgradePausedForConsolidation:true}}:await runLegacyUpgradeBatchV2(this.env,cfg,locked,{batchSize:Number(this.env.LEGACY_UPGRADE_BATCH_SIZE||4)});
        const afterLegacy={...locked,...(legacy.patch||{})};
        await this.ctx.storage.put('status',afterLegacy);
        const adaptive=chooseAdaptiveBulkBatch(this.env,afterLegacy),effectiveBatch=adaptive.batchSize;
        const bulk=await runProgrammaticBatch(this.env,cfg,afterLegacy,{dailyTarget:Number(this.env.BULK_DAILY_TARGET||32000),batchSize:effectiveBatch});
        const next={...afterLegacy,...(bulk.patch||{}),bulkRunningAt:null};
        await this.ctx.storage.put('status',next);
        return json({ok:true,adaptiveBatch:adaptive,legacyUpgrade:{ok:legacy.ok,skipped:legacy.skipped||null,records:legacy.records||[],scanned:legacy.scanned||0,rejected:legacy.rejected||0,invalid:legacy.invalid||0,pass:legacy.pass||next.legacyUpgradePassV2||1,passFinished:Boolean(legacy.passFinished),failures:legacy.failures||[]},bulk:{ok:bulk.ok,skipped:bulk.skipped||null,engine:bulk.engine||null,records:bulk.records||[],tries:bulk.tries||0,rejectedQuality:bulk.rejectedQuality||0,rejectedDuplicate:bulk.rejectedDuplicate||0},summary:{legacyUpgradeTotal:Number(next.legacyUpgradeTotal||0),legacyUpgradeRemaining:next.legacyUpgradeRemaining==null?null:Number(next.legacyUpgradeRemaining),legacyUpgradeComplete:Boolean(next.legacyUpgradeComplete),legacyUpgradeNeedsConsolidation:Boolean(next.legacyUpgradeNeedsConsolidation),legacyUpgradePausedForConsolidation:Boolean(next.legacyUpgradePausedForConsolidation),legacyUpgradeRecoveryActive:Boolean(next.legacyUpgradeRecoveryActive),legacyUpgradePassV2:Number(next.legacyUpgradePassV2||1),legacyUpgradeCursorV2:Number(next.legacyUpgradeCursorV2||0),bulkPublishedToday:Number(next.bulkPublishedToday||0),bulkPublishedTotal:Number(next.bulkPublishedTotal||0),bulkDailyTarget:Number(next.bulkDailyTarget||this.env.BULK_DAILY_TARGET||32000),bulkCursorV2:Number(next.bulkCursorV2||0)}});
      }catch(e){
        const next={...locked,bulkRunningAt:null,bulkLastRun:now(),bulkLastError:String(e?.message||e),legacyUpgradeLastError:String(e?.message||e)};
        await this.ctx.storage.put('status',next);return json({ok:false,error:next.bulkLastError},500);
      }
    }
    if(p==='/lock'&&req.method==='POST'){
      const b=await req.json(),lock=await this.ctx.storage.get('lock');
      if(lock&&Date.now()-Date.parse(lock.at)<240000)return json({ok:false,lock},409);
      await this.ctx.storage.put('lock',{id:b.runId,at:now()});return json({ok:true});
    }
    if(p==='/unlock'&&req.method==='POST'){
      const b=await req.json(),lock=await this.ctx.storage.get('lock');
      if(!lock||!b.runId||lock.id===b.runId)await this.ctx.storage.delete('lock');return json({ok:true});
    }
    if(p==='/session'&&req.method==='POST'){const b=await req.json();await this.ctx.storage.put('session:'+b.hash,{email:b.email,expires:b.expires});return json({ok:true})}
    if(p==='/session'&&req.method==='GET'){const s=await this.ctx.storage.get('session:'+u.searchParams.get('hash'));if(!s||Date.parse(s.expires)<=Date.now())return json({ok:false},401);return json(s)}
    if(p==='/session'&&req.method==='DELETE'){await this.ctx.storage.delete('session:'+u.searchParams.get('hash'));return json({ok:true})}
    return json({error:'not_found'},404);
  }
}

export async function isAdmin(req,env){
  const raw=cookie(req,'nc_admin');if(!raw)return false;
  const r=await gctl(env,'/session?hash='+await sha256(raw));if(!r.ok)return false;
  const s=await r.json();return s?.email===ADMIN_EMAIL&&Date.parse(s.expires)>Date.now();
}

export async function handleAdminApi(req,env){
  const u=new URL(req.url),p=u.pathname;
  if(!(await isAdmin(req,env)))return json({error:'unauthorized'},401);
  if(p==='/api/admin/logout'&&req.method==='POST'){
    const raw=cookie(req,'nc_admin');if(raw)await gctl(env,'/session?hash='+await sha256(raw),{method:'DELETE'});
    return json({ok:true},200,{'set-cookie':'nc_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'});
  }
  if(p==='/api/admin/status'){
    const [cfg,gs,st]=await Promise.all([getGeneratorConfig(env),getGeneratorStatus(env),readState(env)]);
    const bulkTotal=Math.max(0,Number(gs.bulkPublishedTotal||0));
    return json({articleCount:(st.articles||[]).length+bulkTotal,publishedCount:(st.articles||[]).filter(x=>x.status==='published').length+bulkTotal,workersAIReady:Boolean(env.AI),externalProviders:false,bulk:{publishedToday:Number(gs.bulkPublishedToday||0),publishedTotal:bulkTotal,dailyTarget:Number(gs.bulkDailyTarget||env.BULK_DAILY_TARGET||32000),lastRun:gs.bulkLastRun||null,lastError:gs.bulkLastError||null},legacyUpgrade:{upgradedTotal:Number(gs.legacyUpgradeTotal||0),remaining:gs.legacyUpgradeRemaining==null?null:Number(gs.legacyUpgradeRemaining),complete:Boolean(gs.legacyUpgradeComplete),needsConsolidation:Boolean(gs.legacyUpgradeNeedsConsolidation),pausedForConsolidation:Boolean(gs.legacyUpgradePausedForConsolidation),recoveryActive:Boolean(gs.legacyUpgradeRecoveryActive),pass:Number(gs.legacyUpgradePassV2||1),cursor:Number(gs.legacyUpgradeCursorV2||0),lastRun:gs.legacyUpgradeLastRun||null,lastError:gs.legacyUpgradeLastError||null,lastQuality:gs.legacyUpgradeLastQuality??null,lastQualityFloor:gs.legacyUpgradeLastQualityFloor??null,lastWordCount:gs.legacyUpgradeLastWordCount??null,failureSamples:gs.legacyUpgradeFailureSamples||[]},config:cfg,generator:gs});
  }
  if(p==='/api/admin/seo-drops'&&req.method==='GET')return json(gscSeoDropsSnapshot());
    if(p==='/api/admin/seo-settings'&&req.method==='GET')return json(await getSeoSettings(env));
  if(p==='/api/admin/seo-settings'&&req.method==='PUT'){
    const b=await body(req);
    return json({ok:true,settings:await saveSeoSettings(env,b)});
  }
  if(p==='/api/admin/generator'&&req.method==='POST'){
    const b=await body(req),allowed={};
    for(const k of ['enabled','targetWords','minWords','qualityThreshold'])if(k in b)allowed[k]=k==='enabled'?true:b[k];
    return gctl(env,'/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(allowed)});
  }
  if(p==='/api/admin/articles'){
    const [st,latest]=await Promise.all([readState(env),r2json(env,'bulk/latest.json',{articles:[]})]);
    const articles=[...(latest.articles||[]),...(st.articles||[])].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,800);
    const paths=articles.map(x=>String(x.urlPath||((String(x.language||'').toLowerCase()==='en'?'/en/articles/':'/articles/')+x.slug)));
    let visitCounts={};
    try{
      const vr=await ctl(env,'/visits-batch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({paths})});
      if(vr.ok)visitCounts=(await vr.json()).counts||{};
    }catch{}
    const withVisits=articles.map((x,i)=>({...x,uniqueVisits:Math.max(0,Number(visitCounts[paths[i]]||0))}));
    return json({articles:withVisits,bulkLatestCount:(latest.articles||[]).length,visitMetric:'unique-ip-per-article',rawIpStored:false});
  }
  if(p==='/api/admin/article'&&req.method==='GET'){
    const slug=u.searchParams.get('slug')||'',st=await readState(env),rec=(st.articles||[]).find(x=>x.slug===slug);
    if(!rec)return json({error:'not_found_for_editing',note:'Programmatic bulk articles are immutable in admin v1'},404);
    const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get('articles/'+slug+'.html'):null;return json({record:rec,html:o?await o.text():''});
  }
  if(p==='/api/admin/article'&&req.method==='PUT'){
    const b=await body(req),st=await readState(env),old=(st.articles||[]).find(x=>x.slug===b.slug);
    if(!old)return json({error:'not_found'},404);
    const rec={...old,title:b.title||old.title,metaDescription:b.metaDescription??old.metaDescription,primaryKeyword:b.primaryKeyword??old.primaryKeyword,status:b.status||old.status,updatedAt:now()};
    if(typeof b.html==='string'&&env.CONTENT_FINAL)await env.CONTENT_FINAL.put('articles/'+rec.slug+'.html',b.html,{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{title:rec.title,country:rec.country,status:rec.status}});
    const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});return json({ok:true,record:await r.json()});
  }
  return null;
}

export async function adminPage(){return json({error:'use_renderAdmin'},410)}
