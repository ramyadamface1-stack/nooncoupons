import app from './final-platform.js';
export {ControlPlane} from './platform.js';
export {GeneratorControl} from './admin-runtime.js';
import {renderAdmin} from './admin-page.js';
import {secureLogin} from './secure-admin-auth.js';
import {handleAdminApi,getGeneratorConfig,getGeneratorStatus,updateGeneratorStatus,generatorLock,generatorUnlock,isAdmin} from './admin-runtime.js';
import {readState,pickTopic,publishGenerated} from './generator-core-v2.js';
import {generateWithWorkersAI,workersAiBudget,isWorkersAiFreeQuotaError} from './workers-ai-generator.js';

const VERSION='generator-3.2-cloudflare-only-clean';
const PLATFORM_VERSION='platform-1.3-cloudflare-only';
const now=()=>new Date().toISOString();
const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function aiUsage(status,callsUsed=0){
  const day=now().slice(0,10);
  const base=String(status?.workersAiDay||'')===day?Math.max(0,Number(status?.workersAiCallsToday||0)):0;
  return {workersAiDay:day,workersAiCallsToday:base+Math.max(0,Number(callsUsed||0))};
}

async function runOnce(env,{manual=false}={}){
  const cfg=await getGeneratorConfig(env);
  if(!cfg.enabled&&!manual)return {skipped:'paused'};
  const runId=crypto.randomUUID(),lock=await generatorLock(env,runId);
  if(lock.status===409)return {skipped:'already_running'};
  const started=Date.now(),status=await getGeneratorStatus(env),attempt=Number(status.attempts||0);
  let workersAiCallsUsed=0;
  try{
    const st=await readState(env),topic=pickTopic(st,attempt);
    if(!topic)throw new Error('topic_pool_exhausted');
    const budget=workersAiBudget(env,st,status);
    if(!budget.binding){
      const next={...aiUsage(status,0),attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:'workers_ai_binding_missing',lastOperationalState:'workers-ai-unavailable',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);return {ok:true,skipped:'workers_ai_binding_missing',budget};
    }
    if(!budget.available){
      const reason=budget.quotaBlocked?'workers_ai_free_quota_exhausted':budget.remaining<=0?'workers_ai_daily_article_cap':'workers_ai_daily_call_cap';
      if(budget.quotaBlocked)return {ok:true,skipped:reason,budget,resumesAt:budget.quotaResetAt};
      if(String(status.lastError||'')===reason&&String(status.workersAiDay||'')===now().slice(0,10))return {ok:true,skipped:reason,budget};
      const next={...aiUsage(status,0),attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:reason,lastOperationalState:'workers-ai-capped',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);return {ok:true,skipped:reason,budget};
    }
    let out;
    try{out=await generateWithWorkersAI(env,topic,cfg,st,attempt,status);workersAiCallsUsed=Number(out.callsUsed||0)}
    catch(e){workersAiCallsUsed=Number(e?.workersAiCallsUsed||0);throw e}
    if(out.skipped){
      const next={...aiUsage(status,workersAiCallsUsed),attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:String(out.reason||'workers_ai_skipped'),lastOperationalState:'workers-ai-skipped',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);return {ok:true,skipped:out.reason||'workers_ai_skipped',budget:out.budget};
    }
    const usage=aiUsage(status,workersAiCallsUsed);
    if(!out.audit.productionReady)throw Object.assign(new Error('quality_gate_'+out.audit.score+'_words_'+out.audit.wordCount),{workersAiCallsUsed});
    const rec=await publishGenerated(env,out.article,topic,out.audit,out.provider);
    const next={...usage,attempts:attempt+1,published:Number(status.published||0)+1,drafted:Number(status.drafted||0),failed:Number(status.failed||0),lastRun:now(),lastSuccess:now(),lastError:null,lastOperationalState:'published',lastSlug:rec.slug,lastTitle:rec.title,lastKeyword:rec.primaryKeyword,lastProvider:out.provider,lastQuality:out.audit.score,lastWordCount:out.audit.wordCount,lastDurationMs:Date.now()-started};
    await updateGeneratorStatus(env,next);
    return {ok:true,record:rec,audit:out.audit,provider:out.provider,workersAiCallsUsed,budget:out.budget};
  }catch(e){
    const usage=aiUsage(status,workersAiCallsUsed||Number(e?.workersAiCallsUsed||0)),quotaHit=isWorkersAiFreeQuotaError(e);
    const next={...usage,attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0)+(quotaHit?0:1),skippedNoAI:Number(status.skippedNoAI||0)+(quotaHit?1:0),lastRun:now(),lastError:quotaHit?'workers_ai_free_quota_exhausted':String(e?.message||e),lastOperationalState:quotaHit?'workers-ai-free-quota-exhausted':'workers-ai-error',lastDurationMs:Date.now()-started,...(quotaHit?{workersAiQuotaDay:now().slice(0,10),workersAiQuotaBlockedAt:now()}:{})};
    await updateGeneratorStatus(env,next);
    return {ok:false,error:next.lastError,resumesAt:quotaHit?new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()+1)).toISOString():undefined};
  }finally{await generatorUnlock(env,runId)}
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/api/ai/generate')return json({error:'legacy_external_generation_disabled',version:VERSION,provider:'workers-ai',externalProviders:false,use:'/api/admin/generate-now'},410);
    if(u.pathname==='/api/platform-health')return json({ok:true,version:PLATFORM_VERSION,generatorVersion:VERSION,control:Boolean(env.CONTROL),r2:Boolean(env.CONTENT_FINAL),workersAI:Boolean(env.AI),ai:{provider:'workers-ai',externalProviders:false,legacyProvidersRemoved:true},time:now()});
    if(u.pathname==='/api/state'&&req.method==='GET'){
      const r=await app.fetch(req,env,ctx);if(!r.ok)return r;
      try{const s=await r.json();s.settings={...(s.settings||{}),aiPrimary:'workers-ai',aiFallback:null,targetWords:1500,minWords:1000,qualityThreshold:95};return json(s,r.status)}catch{return r}
    }
    if(u.pathname==='/admin'||u.pathname==='/admin/')return renderAdmin(req,env);
    if(u.pathname==='/api/admin/login'&&req.method==='POST')return secureLogin(req,env);
    if(u.pathname==='/api/admin/generate-now'&&req.method==='POST'){
      if(!(await isAdmin(req,env)))return json({error:'unauthorized'},401);
      return json(await runOnce(env,{manual:true}));
    }
    if(u.pathname==='/api/admin/status'){
      const r=await handleAdminApi(req,env);if(!r)return r;if(!r.ok)return r;
      try{const d=await r.json();delete d.groqReady;d.workersAIReady=Boolean(env.AI);d.generatorVersion=VERSION;d.activeProvider='workers-ai';d.externalProviders=false;d.config={...(d.config||{}),model:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'};return json(d,r.status)}catch{return r}
    }
    if(u.pathname.startsWith('/api/admin/')){const r=await handleAdminApi(req,env);if(r)return r}
    if(u.pathname==='/api/generator-health'){
      const [cfg,status,st]=await Promise.all([getGeneratorConfig(env),getGeneratorStatus(env),readState(env)]),workersAI=workersAiBudget(env,st,status);
      const workersAiArticles=(st.articles||[]).filter(a=>a.status==='published'&&String(a.provider||'').startsWith('workers-ai:')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),lastWorkersAiSuccess=workersAiArticles[0]||null;
      return json({ok:true,version:VERSION,cron:'* * * * *',enabled:cfg.enabled,publishPolicy:'Cloudflare Workers AI only; quota-aware auto resume; quality>=95; 1000-2000 words; strict brand/country/coupon locks; repair only when close to pass; no external providers',preferredProvider:'workers-ai',providers:{workersAI:workersAI.binding,anyAI:workersAI.binding,external:false},legacyProvidersRemoved:true,workersAI,workersAiPublishedTotal:workersAiArticles.length,lastWorkersAiSuccess:lastWorkersAiSuccess?{slug:lastWorkersAiSuccess.slug,createdAt:lastWorkersAiSuccess.createdAt,provider:lastWorkersAiSuccess.provider,quality:lastWorkersAiSuccess.quality,country:lastWorkersAiSuccess.country,coupon:lastWorkersAiSuccess.coupon}:null,models:{workersAI:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'},r2Ready:Boolean(env.CONTENT_FINAL),controlReady:Boolean(env.CONTROL),generatorControlReady:Boolean(env.GENERATOR_CONTROL),articleCount:(st.articles||[]).length,publishedCount:(st.articles||[]).filter(a=>a.status==='published').length,draftCount:(st.articles||[]).filter(a=>a.status==='draft').length,status});
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){if(app.scheduled)ctx.waitUntil(app.scheduled(event,env,ctx));ctx.waitUntil(runOnce(env))}
};
