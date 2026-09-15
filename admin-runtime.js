import {GENERATOR_DEFAULTS,readState} from './generator-core-v2.js';
import {runProgrammaticBatch} from './bulk-generator.js';
import {runLegacyUpgradeBatchV2} from './legacy-upgrader-v2.js';

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
async function r2json(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}

export async function getGeneratorConfig(env){return (await gctl(env,'/config')).json()}
export async function getGeneratorStatus(env){return (await gctl(env,'/status')).json()}
export async function updateGeneratorStatus(env,patch){return (await gctl(env,'/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patch)})).json()}
export async function generatorLock(env,runId){return gctl(env,'/lock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId})})}
export async function generatorUnlock(env,runId){return gctl(env,'/unlock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId})})}
export async function bulkTick(env){const r=await gctl(env,'/bulk-tick',{method:'POST'});return r.json()}

export class GeneratorControl{
  constructor(ctx,env){this.ctx=ctx;this.env=env}
  async config(){
    let c=await this.ctx.storage.get('config'),dirty=false;
    if(!c){c={...GENERATOR_DEFAULTS,createdAt:now()};dirty=true}
    const model=this.env.WORKERS_AI_MODEL||GENERATOR_DEFAULTS.model;
    if(c.model!==model){c.model=model;dirty=true}
    if(c.provider!=='workers-ai'){c.provider='workers-ai';dirty=true}
    if(c.externalProviders!==false){c.externalProviders=false;dirty=true}
    if(!Number.isFinite(Number(c.targetWords))){c.targetWords=GENERATOR_DEFAULTS.targetWords;dirty=true}
    if(!Number.isFinite(Number(c.minWords))){c.minWords=GENERATOR_DEFAULTS.minWords;dirty=true}
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
      if('enabled' in b)next.enabled=Boolean(b.enabled);
      if('targetWords' in b)next.targetWords=Math.max(1200,Math.min(1800,Number(b.targetWords)||1500));
      if('minWords' in b)next.minWords=Math.max(1000,Math.min(1400,Number(b.minWords)||1000));
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
      if(Number.isFinite(runningAt)&&Date.now()-runningAt<55000)return json({ok:true,skipped:'bulk_already_running',bulkPublishedToday:Number(status.bulkPublishedToday||0),legacyUpgradeTotal:Number(status.legacyUpgradeTotal||0)});
      const cfg=await this.config(),locked={...status,bulkRunningAt:now()};
      await this.ctx.storage.put('status',locked);
      try{
        const terminalLegacy=Boolean(locked.legacyUpgradePausedForConsolidation);
        const legacy=terminalLegacy?{ok:true,skipped:'legacy_upgrade_paused_for_consolidation',records:[],scanned:0,rejected:0,invalid:0,pass:Number(locked.legacyUpgradePassV2||4),passFinished:true,failures:[],patch:{legacyUpgradeLastRun:now(),legacyUpgradeLastError:null,legacyUpgradeNeedsConsolidation:true,legacyUpgradePausedForConsolidation:true}}:await runLegacyUpgradeBatchV2(this.env,cfg,locked,{batchSize:Number(this.env.LEGACY_UPGRADE_BATCH_SIZE||4)});
        const afterLegacy={...locked,...(legacy.patch||{})};
        await this.ctx.storage.put('status',afterLegacy);
        const bulk=await runProgrammaticBatch(this.env,cfg,afterLegacy,{dailyTarget:Number(this.env.BULK_DAILY_TARGET||2000),batchSize:Number(this.env.BULK_BATCH_SIZE||2)});
        const next={...afterLegacy,...(bulk.patch||{}),bulkRunningAt:null};
        await this.ctx.storage.put('status',next);
        return json({ok:true,legacyUpgrade:{ok:legacy.ok,skipped:legacy.skipped||null,records:legacy.records||[],scanned:legacy.scanned||0,rejected:legacy.rejected||0,invalid:legacy.invalid||0,pass:legacy.pass||next.legacyUpgradePassV2||1,passFinished:Boolean(legacy.passFinished),failures:legacy.failures||[]},bulk:{ok:bulk.ok,skipped:bulk.skipped||null,engine:bulk.engine||null,records:bulk.records||[],tries:bulk.tries||0,rejectedQuality:bulk.rejectedQuality||0,rejectedDuplicate:bulk.rejectedDuplicate||0},summary:{legacyUpgradeTotal:Number(next.legacyUpgradeTotal||0),legacyUpgradeRemaining:next.legacyUpgradeRemaining==null?null:Number(next.legacyUpgradeRemaining),legacyUpgradeComplete:Boolean(next.legacyUpgradeComplete),legacyUpgradeNeedsConsolidation:Boolean(next.legacyUpgradeNeedsConsolidation),legacyUpgradePausedForConsolidation:Boolean(next.legacyUpgradePausedForConsolidation),legacyUpgradeRecoveryActive:Boolean(next.legacyUpgradeRecoveryActive),legacyUpgradePassV2:Number(next.legacyUpgradePassV2||1),legacyUpgradeCursorV2:Number(next.legacyUpgradeCursorV2||0),bulkPublishedToday:Number(next.bulkPublishedToday||0),bulkPublishedTotal:Number(next.bulkPublishedTotal||0),bulkDailyTarget:Number(next.bulkDailyTarget||this.env.BULK_DAILY_TARGET||2000),bulkCursorV2:Number(next.bulkCursorV2||0)}});
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
    return json({articleCount:(st.articles||[]).length+bulkTotal,publishedCount:(st.articles||[]).filter(x=>x.status==='published').length+bulkTotal,workersAIReady:Boolean(env.AI),externalProviders:false,bulk:{publishedToday:Number(gs.bulkPublishedToday||0),publishedTotal:bulkTotal,dailyTarget:Number(gs.bulkDailyTarget||env.BULK_DAILY_TARGET||2000),lastRun:gs.bulkLastRun||null,lastError:gs.bulkLastError||null},legacyUpgrade:{upgradedTotal:Number(gs.legacyUpgradeTotal||0),remaining:gs.legacyUpgradeRemaining==null?null:Number(gs.legacyUpgradeRemaining),complete:Boolean(gs.legacyUpgradeComplete),needsConsolidation:Boolean(gs.legacyUpgradeNeedsConsolidation),pausedForConsolidation:Boolean(gs.legacyUpgradePausedForConsolidation),recoveryActive:Boolean(gs.legacyUpgradeRecoveryActive),pass:Number(gs.legacyUpgradePassV2||1),cursor:Number(gs.legacyUpgradeCursorV2||0),lastRun:gs.legacyUpgradeLastRun||null,lastError:gs.legacyUpgradeLastError||null,lastQuality:gs.legacyUpgradeLastQuality??null,lastQualityFloor:gs.legacyUpgradeLastQualityFloor??null,lastWordCount:gs.legacyUpgradeLastWordCount??null,failureSamples:gs.legacyUpgradeFailureSamples||[]},config:cfg,generator:gs});
  }
  if(p==='/api/admin/generator'&&req.method==='POST'){
    const b=await body(req),allowed={};
    for(const k of ['enabled','targetWords','minWords','qualityThreshold'])if(k in b)allowed[k]=b[k];
    return gctl(env,'/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(allowed)});
  }
  if(p==='/api/admin/articles'){
    const [st,latest]=await Promise.all([readState(env),r2json(env,'bulk/latest.json',{articles:[]})]);
    const articles=[...(latest.articles||[]),...(st.articles||[])].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    return json({articles:articles.slice(0,800),bulkLatestCount:(latest.articles||[]).length});
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
