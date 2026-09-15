import app from './final-platform.js';
export {ControlPlane} from './platform.js';
export {GeneratorControl} from './admin-runtime.js';
import {renderAdmin} from './admin-page.js';
import {secureLogin} from './secure-admin-auth.js';
import {handleAdminApi,getGeneratorConfig,getGeneratorStatus,updateGeneratorStatus,generatorLock,generatorUnlock,isAdmin} from './admin-runtime.js';
import {readState,pickTopic,generateArticle,publishGenerated,auditGenerated,providerReadiness} from './generator-core-v2.js';

const now=()=>new Date().toISOString();
const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function hardenFallback(out,topic,cfg){
  if(out.audit.productionReady||!String(out.provider).startsWith('local-fallback'))return out;
  let h=String(out.article.html||'');
  const extras=`<section class="coupon-action"><h2>جرّب الكود على السلة الفعلية</h2><p>انسخ الكود <strong>${topic.code}</strong> ثم افتح نون وتحقق من النتيجة داخل السلة قبل الدفع.</p><button type="button" data-copy-code="${topic.code}">نسخ الكود ${topic.code}</button> <a href="https://www.noon.com/" rel="noopener external sponsored">Try it on Noon</a></section>`;
  if(!/https:\/\/www\.noon\.com\//i.test(h))h=h.replace(/<\/article>\s*$/i,extras+'</article>');
  else if(!/data-copy-code/i.test(h))h=h.replace(/<\/article>\s*$/i,extras+'</article>');
  out.article.html=h;out.audit=auditGenerated(out.article,topic,cfg);return out;
}

async function runOnce(env,{manual=false}={}){
  const cfg=await getGeneratorConfig(env);
  if(!cfg.enabled&&!manual)return {skipped:'paused'};
  const runId=crypto.randomUUID(),lock=await generatorLock(env,runId);
  if(lock.status===409)return {skipped:'already_running'};
  const started=Date.now(),status=await getGeneratorStatus(env),attempt=Number(status.attempts||0);
  try{
    const st=await readState(env),topic=pickTopic(st,attempt);
    if(!topic)throw new Error('topic_pool_exhausted');
    let out=await generateArticle(env,topic,cfg,st,attempt);
    out=hardenFallback(out,topic,cfg);
    if(!out.audit.productionReady)throw new Error('quality_gate_'+out.audit.score+'_words_'+out.audit.wordCount+(out.lastProviderError?'_provider_fallback':''));
    const rec=await publishGenerated(env,out.article,topic,out.audit,out.provider);
    const next={attempts:attempt+1,published:Number(status.published||0)+1,failed:Number(status.failed||0),lastRun:now(),lastSuccess:now(),lastError:null,lastSlug:rec.slug,lastTitle:rec.title,lastKeyword:rec.primaryKeyword,lastProvider:out.provider,lastDurationMs:Date.now()-started};
    await updateGeneratorStatus(env,next);
    return {ok:true,record:rec,audit:out.audit,provider:out.provider,providerReadiness:out.providerReadiness,lastProviderError:out.lastProviderError||null};
  }catch(e){
    const next={attempts:attempt+1,published:Number(status.published||0),failed:Number(status.failed||0)+1,lastRun:now(),lastError:String(e?.message||e),lastDurationMs:Date.now()-started};
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
      const providers=providerReadiness(env);
      return json({
        ok:true,
        version:'generator-2.0',
        cron:'* * * * *',
        enabled:cfg.enabled,
        preferredProvider:env.AI_PRIMARY_PROVIDER||'gemini',
        providers,
        models:{gemini:env.GEMINI_MODEL||'gemini-3.5-flash',grok:env.GROK_MODEL||'grok-4.3',groq:env.GROQ_MODEL||'openai/gpt-oss-120b'},
        r2Ready:Boolean(env.CONTENT_FINAL),
        controlReady:Boolean(env.CONTROL),
        generatorControlReady:Boolean(env.GENERATOR_CONTROL),
        articleCount:(st.articles||[]).length,
        publishedCount:(st.articles||[]).filter(a=>a.status==='published').length,
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
