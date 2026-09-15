import app from './final-platform.js';
export {ControlPlane} from './platform.js';
export {GeneratorControl} from './admin-runtime.js';
import {renderAdmin} from './admin-page.js';
import {secureLogin} from './secure-admin-auth.js';
import {handleAdminApi,getGeneratorConfig,getGeneratorStatus,updateGeneratorStatus,generatorLock,generatorUnlock,isAdmin} from './admin-runtime.js';
import {readState,pickTopic,generateArticle,publishGenerated,auditGenerated,providerReadiness} from './generator-core-v2.js';
import {generateWithWorkersAI,workersAiBudget} from './workers-ai-generator.js';

const now=()=>new Date().toISOString();
const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
async function ctl(env,path,init){const id=env.CONTROL.idFromName('primary');return env.CONTROL.get(id).fetch('https://control.internal'+path,init)}

function aiUsage(status,callsUsed=0){
  const day=now().slice(0,10);
  const base=String(status?.workersAiDay||'')===day?Math.max(0,Number(status?.workersAiCallsToday||0)):0;
  return {workersAiDay:day,workersAiCallsToday:base+Math.max(0,Number(callsUsed||0))};
}

function hardenFallback(out,topic,cfg){
  if(out.audit.productionReady||!String(out.provider).startsWith('local-fallback'))return out;
  let h=String(out.article.html||'');
  const extras=`<section class="coupon-action"><h2>جرّب الكود على السلة الفعلية</h2><p>انسخ الكود <strong>${topic.code}</strong> ثم افتح نون وتحقق من النتيجة داخل السلة قبل الدفع.</p><button type="button" data-copy-code="${topic.code}">نسخ الكود ${topic.code}</button> <a href="https://www.noon.com/" rel="noopener external sponsored">Try it on Noon</a></section>`;
  if(!/https:\/\/www\.noon\.com\//i.test(h))h=h.replace(/<\/article>\s*$/i,extras+'</article>');
  else if(!/data-copy-code/i.test(h))h=h.replace(/<\/article>\s*$/i,extras+'</article>');
  out.article.html=h;out.audit=auditGenerated(out.article,topic,cfg);return out;
}

async function saveFallbackDraft(env,article,topic,audit,provider){
  if(!env.CONTENT_FINAL||!env.CONTROL)throw new Error('draft_storage_missing');
  const slug=slugify(article.slug||article.title||topic.kw);
  const rec={id:crypto.randomUUID(),slug,title:article.title||slug,metaDescription:article.metaDescription||'',country:topic.country,coupon:topic.code,status:'draft',scheduledAt:null,createdAt:now(),updatedAt:now(),quality:audit.score,qualityCoverage:100,provider,primaryKeyword:article.primaryKeyword||topic.kw};
  await env.CONTENT_FINAL.put('articles/'+slug+'.html',String(article.html||''),{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{title:rec.title,country:rec.country,status:'draft',provider:String(provider).slice(0,100)}});
  const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});
  if(!r.ok)throw new Error('control_draft_'+r.status);
  return rec;
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
    let out=await generateArticle(env,topic,cfg,st,attempt);

    if(String(out.provider||'').startsWith('local-fallback')&&env.AI){
      try{
        const wai=await generateWithWorkersAI(env,topic,cfg,st,attempt,status);
        workersAiCallsUsed=Number(wai.callsUsed||0);
        if(!wai.skipped)out=wai;
        else out.lastProviderError=(out.lastProviderError?out.lastProviderError+' | ':'')+String(wai.reason||'workers_ai_skipped');
      }catch(e){
        workersAiCallsUsed=Number(e?.workersAiCallsUsed||0);
        out.lastProviderError=(out.lastProviderError?out.lastProviderError+' | ':'')+'workers-ai:'+String(e?.message||e);
      }
    }

    out=hardenFallback(out,topic,cfg);
    const usage=aiUsage(status,workersAiCallsUsed);

    if(String(out.provider||'').startsWith('local-fallback')){
      if(manual){
        const rec=await saveFallbackDraft(env,out.article,topic,out.audit,out.provider);
        const next={...usage,attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0)+1,failed:Number(status.failed||0),lastRun:now(),lastSuccess:now(),lastError:out.lastProviderError||null,lastSlug:rec.slug,lastTitle:rec.title,lastKeyword:rec.primaryKeyword,lastProvider:'local-fallback-draft',lastDurationMs:Date.now()-started};
        await updateGeneratorStatus(env,next);
        return {ok:true,draft:true,record:rec,audit:out.audit,provider:'local-fallback-draft',lastProviderError:out.lastProviderError||null};
      }
      const next={...usage,attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:out.lastProviderError||'no_publishable_ai_provider',lastProvider:'local-fallback-blocked',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);
      return {ok:true,skipped:'local_fallback_not_published',reason:next.lastError};
    }

    if(!out.audit.productionReady)throw new Error('quality_gate_'+out.audit.score+'_words_'+out.audit.wordCount+(out.lastProviderError?'_provider_fallback':''));
    const rec=await publishGenerated(env,out.article,topic,out.audit,out.provider);
    const next={...usage,attempts:attempt+1,published:Number(status.published||0)+1,drafted:Number(status.drafted||0),failed:Number(status.failed||0),lastRun:now(),lastSuccess:now(),lastError:null,lastSlug:rec.slug,lastTitle:rec.title,lastKeyword:rec.primaryKeyword,lastProvider:out.provider,lastDurationMs:Date.now()-started};
    await updateGeneratorStatus(env,next);
    return {ok:true,record:rec,audit:out.audit,provider:out.provider,providerReadiness:out.providerReadiness,lastProviderError:out.lastProviderError||null,workersAiCallsUsed};
  }catch(e){
    const usage=aiUsage(status,workersAiCallsUsed||Number(e?.workersAiCallsUsed||0));
    const next={...usage,attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0)+1,lastRun:now(),lastError:String(e?.message||e),lastDurationMs:Date.now()-started};
    await updateGeneratorStatus(env,next);
    return {ok:false,error:next.lastError};
  }finally{await generatorUnlock(env,runId)}
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/admin'||u.pathname==='/admin/')return renderAdmin(req,env);
    if(u.pathname==='/api/admin/login'&&req.method==='POST')return secureLogin(req,env);
    if(u.pathname==='/api/admin/generate-now'&&req.method==='POST'){
      if(!(await isAdmin(req,env)))return json({error:'unauthorized'},401);
      return json(await runOnce(env,{manual:true}));
    }
    if(u.pathname.startsWith('/api/admin/')){
      const r=await handleAdminApi(req,env);if(r)return r;
    }
    if(u.pathname==='/api/generator-health'){
      const [cfg,status,st]=await Promise.all([getGeneratorConfig(env),getGeneratorStatus(env),readState(env)]);
      const providers=providerReadiness(env),workersAI=workersAiBudget(env,st,status);
      return json({
        ok:true,
        version:'generator-2.2',
        cron:'* * * * *',
        enabled:cfg.enabled,
        publishPolicy:'quality-gated AI only; local-fallback=draft/manual-only',
        preferredProvider:env.AI_PRIMARY_PROVIDER||'gemini',
        providers:{...providers,workersAI:workersAI.binding,anyAI:Boolean(providers.any||workersAI.binding)},
        workersAI,
        models:{gemini:env.GEMINI_MODEL||'gemini-3.5-flash',grok:env.GROK_MODEL||'grok-4.3',groq:env.GROQ_MODEL||'openai/gpt-oss-120b',workersAI:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'},
        r2Ready:Boolean(env.CONTENT_FINAL),
        controlReady:Boolean(env.CONTROL),
        generatorControlReady:Boolean(env.GENERATOR_CONTROL),
        articleCount:(st.articles||[]).length,
        publishedCount:(st.articles||[]).filter(a=>a.status==='published').length,
        draftCount:(st.articles||[]).filter(a=>a.status==='draft').length,
        status
      });
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)ctx.waitUntil(app.scheduled(event,env,ctx));
    ctx.waitUntil(runOnce(env));
  }
};
