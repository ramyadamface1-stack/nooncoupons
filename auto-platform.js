import app from './final-platform.js';
export {ControlPlane} from './platform.js';
export {GeneratorControl} from './admin-runtime.js';
import {renderAdmin} from './admin-page.js';
import {secureLogin} from './secure-admin-auth.js';
import {handleAdminApi,getGeneratorConfig,getGeneratorStatus,updateGeneratorStatus,generatorLock,generatorUnlock,isAdmin,bulkTick} from './admin-runtime.js';
import {readState,pickTopic,publishGenerated} from './generator-core-v2.js';
import {generateWithWorkersAI,workersAiBudget,isWorkersAiFreeQuotaError} from './workers-ai-generator.js';
import {BULK_ENGINE_INFO} from './bulk-generator.js';

const VERSION='generator-5.0-quality-first';
const PLATFORM_VERSION='platform-1.6-quality-first';
const STATIC_SITEMAPS=['pages','guides','coupons','coupons-saudi','coupons-uae'];
const now=()=>new Date().toISOString();
const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dec=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300,s-maxage=300'}});
async function r2json(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}

function articleCss(){return `<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827}.site-head{background:#111827;color:#fff}.head-in{width:min(1120px,94%);margin:auto;padding:18px 0;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}.brand{font-weight:900;font-size:20px}.site-head a{color:#fff;text-decoration:none;margin-inline-end:14px}.crumbs{width:min(940px,94%);margin:20px auto 0;font-size:14px;color:#64748b}.crumbs a{color:#5b21b6}.wrap{width:min(940px,94%);margin:18px auto 48px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:clamp(18px,4vw,42px);line-height:2;box-shadow:0 16px 42px rgba(15,23,42,.06)}.hero{margin:-8px 0 26px}.hero img,.article-visual img{display:block;width:100%;height:auto;aspect-ratio:1200/760;object-fit:contain;background:#fffdf0;border-radius:18px;border:1px solid #e5e7eb}.hero figcaption,.article-visual figcaption{font-size:13px;color:#64748b;text-align:center;padding:9px 8px}.quality-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 20px}.quality-meta span{font-size:12px;padding:5px 9px;background:#ecfdf3;border:1px solid #a7f3d0;border-radius:999px}.wrap h1{font-size:clamp(28px,5vw,42px);line-height:1.45;margin-top:8px}.wrap h2{font-size:clamp(22px,3vw,29px);line-height:1.55;margin-top:42px}.wrap h3{font-size:19px;line-height:1.6}.wrap p,.wrap li{font-size:17px}.direct-answer{background:#fffbea;border-right:5px solid #FEEE00;padding:18px;border-radius:14px}.article-toc{background:#f8fafc;padding:13px 16px;border-radius:13px;margin:18px 0}.article-toc a{margin-inline-end:10px}.wrap a{color:#5b21b6}.wrap table{width:100%;border-collapse:collapse;display:table;margin:18px 0}.wrap td,.wrap th{border:1px solid #dbe3ec;padding:10px;text-align:right}.wrap th{background:#f8fafc}.article-visual{margin:34px auto;max-width:840px}.coupon-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px;background:#f8fafc;border-radius:14px}.coupon-actions button,.coupon-actions a{border:0;border-radius:11px;padding:12px 15px;font-weight:800;text-decoration:none}.coupon-actions button{background:#111827;color:#fff;cursor:pointer}.coupon-actions a{background:#FEEE00;color:#111}.copy-feedback{min-height:1.3em;color:#087a3e;font-weight:700}.faq details{border:1px solid #e5e7eb;border-radius:13px;padding:10px 14px;margin:10px 0}.faq summary{cursor:pointer}.faq summary h3{display:inline}.methodology,.sources{background:#f8fafc;border:1px solid #e5e7eb;padding:16px;border-radius:14px}.eyebrow{font-size:13px!important;color:#64748b;font-weight:800}.article-byline{margin:16px 0 24px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;color:#475569;line-height:1.8}.article-byline a{color:#5b21b6;font-weight:800}.article-visual img[loading="lazy"]{content-visibility:auto}@media(max-width:680px){.wrap{width:96%;padding:18px;border-radius:16px}.wrap p,.wrap li{font-size:16px}.wrap table{display:block;overflow-x:auto}.head-in{padding:14px 3%}}
</style>`}
function copyJs(){return `<script>document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.dataset.copyCode||'';const box=b.parentElement?.querySelector('.copy-feedback');try{await navigator.clipboard.writeText(code);if(box)box.textContent='تم نسخ '+code+' بنجاح';const old=b.textContent;b.textContent='✓ تم النسخ';setTimeout(()=>{b.textContent=old;if(box)box.textContent=''},1800)}catch{if(box)box.textContent='الكود: '+code}});</script>`}

async function bulkArticlePage(u,env){
  if(!env.CONTENT_FINAL)return null;
  const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug)return null;
  const o=await env.CONTENT_FINAL.get('articles/'+slug+'.html');
  if(!o)return null;
  const md=o.customMetadata||{};
  if(!String(md.p||'').startsWith('programmatic-cloudflare:'))return null;
  const title=dec(md.t)||slug,meta=dec(md.m),country=md.c==='AE'?'AE':'SA',coupon=String(md.cp||''),keyword=dec(md.kw)||title,quality=Number(md.q||0),qualityFloor=Number(md.qf||0),checks=Number(md.qc||0),origin=env.SITE_ORIGIN||u.origin;
  const body=await o.text(),canonical=origin+'/articles/'+encodeURI(slug),market=country==='SA'?'السعودية':'الإمارات',lang=country==='SA'?'ar-SA':'ar-AE',marketPath=country==='SA'?'/saudi-arabia':'/uae',published=md.at||now(),modified=o.uploaded?new Date(o.uploaded).toISOString():published;
  const imgPath=`/assets/coupon-svg/${encodeURIComponent(slug)}/1.svg?v=5&coupon=${encodeURIComponent(coupon)}&country=${country}`,featured=origin+imgPath;
  const images=[1,2,3,4,5].map(v=>origin+`/assets/coupon-svg/${encodeURIComponent(slug)}/${v}.svg?v=5&coupon=${encodeURIComponent(coupon)}&country=${country}`);
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':origin+'/#organization',name:'كوبونات نون',url:origin},
    {'@type':'Organization','@id':origin+'/authors/editorial-team#team',name:'فريق تحرير كوبونات نون',url:origin+'/authors/editorial-team',parentOrganization:{'@id':origin+'/#organization'}},
    {'@type':'WebSite','@id':origin+'/#website',url:origin,name:'كوبونات نون',inLanguage:'ar'},
    {'@type':'ImageObject','@id':featured+'#image',url:featured,contentUrl:featured,width:1200,height:760,caption:keyword,inLanguage:lang},
    {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:origin+'/'},{'@type':'ListItem',position:2,name:market,item:origin+marketPath},{'@type':'ListItem',position:3,name:title,item:canonical}]},
    {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:title,description:meta,inLanguage:lang,isPartOf:{'@id':origin+'/#website'},breadcrumb:{'@id':canonical+'#breadcrumb'},primaryImageOfPage:{'@id':featured+'#image'}},
    {'@type':'Article','@id':canonical+'#article',headline:title,description:meta,inLanguage:lang,mainEntityOfPage:{'@id':canonical+'#webpage'},datePublished:published,dateModified:modified,author:{'@id':origin+'/authors/editorial-team#team'},publisher:{'@id':origin+'/#organization'},image:images,about:[{'@type':'Thing',name:'Noon'},{'@type':'Thing',name:keyword},{'@type':'Place',name:market}]}
  ]};
  const schema=JSON.stringify(graph).replace(/</g,'\\u003c');
  const qualityBits=`<div class="quality-meta"><span>Quality ${quality||'—'}/100</span>${qualityFloor?`<span>أقل مجموعة ${qualityFloor}/100</span>`:''}${checks?`<span>${checks} فحص آلي</span>`:''}<span>${esc(coupon)}</span><span>نون ${market}</span></div>`;
  const byline=`<aside class="article-byline" aria-label="معلومات التحرير"><strong><a href="/authors/editorial-team">فريق تحرير كوبونات نون</a></strong><span> · نُشر ${esc(new Date(published).toLocaleDateString('ar-EG'))} · آخر تحديث ${esc(new Date(modified).toLocaleDateString('ar-EG'))}</span><br><small>محتوى مستقل وفق <a href="/editorial-policy">السياسة التحريرية</a> و<a href="/coupon-verification">منهجية التحقق من الكوبونات</a>.</small></aside>`;
  const h=`<!doctype html><html lang="${lang}" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(meta)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(featured)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="760"><meta property="og:locale" content="${country==='SA'?'ar_SA':'ar_AE'}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(meta)}"><meta name="twitter:image" content="${esc(featured)}"><link rel="preload" as="image" href="${esc(imgPath)}" type="image/svg+xml"><script type="application/ld+json" data-schema="article">${schema}</script>${articleCss()}</head><body><header class="site-head"><div class="head-in"><div class="brand">كوبونات نون</div><nav aria-label="التنقل الرئيسي"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/blog">المدونة</a><a href="${marketPath}">${market}</a></nav></div></header><nav class="crumbs" aria-label="مسار الصفحة"><a href="/">الرئيسية</a> ← <a href="${marketPath}">${market}</a> ← <span aria-current="page">${esc(title)}</span></nav><main class="wrap"><figure class="hero"><img src="${imgPath}" alt="${esc(keyword)} — كوبون نون ${market} ${esc(coupon)}" title="${esc(title)}" width="1200" height="760" loading="eager" fetchpriority="high" decoding="async"><figcaption>${esc(keyword)} · ${esc(coupon)} · نون ${market}</figcaption></figure>${byline}${qualityBits}${body}</main>${copyJs()}</body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=0,s-maxage=600','x-content-type-options':'nosniff'}});
}

async function bulkBlogPage(req,env,ctx){
  const latest=await r2json(env,'bulk/latest.json',{articles:[]});
  if(!(latest.articles||[]).length)return null;
  let legacy=[];
  try{const r=await app.fetch(new Request(new URL('/api/state',req.url),{headers:{accept:'application/json'}}),env,ctx);if(r.ok){const s=await r.json();legacy=(s.articles||[]).filter(a=>a.status==='published')}}catch{}
  const seen=new Set(),all=[];
  for(const a of [...(latest.articles||[]),...legacy]){if(!a?.slug||seen.has(a.slug))continue;seen.add(a.slug);all.push(a)}
  all.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const cards=all.slice(0,240).map(a=>{const country=a.country==='AE'?'AE':'SA',market=country==='SA'?'السعودية':'الإمارات',img=`/assets/coupon-svg/${encodeURIComponent(a.slug)}/1.svg?v=5&coupon=${encodeURIComponent(a.coupon||(country==='AE'?'OPS58':'OPS32'))}&country=${country}`,floor=a.qualityFloor?` · Floor ${a.qualityFloor}`:'';return `<article class="card"><a href="/articles/${encodeURI(a.slug)}"><img src="${img}" alt="${esc(a.primaryKeyword||a.title)}" title="${esc(a.title||a.primaryKeyword||'')}" width="1200" height="760" loading="lazy" decoding="async"></a><span class="tag">${market}</span><h2><a href="/articles/${encodeURI(a.slug)}">${esc(a.title)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><div class="meta">Quality ${a.quality||'—'}${floor} · ${esc(a.coupon||'')}</div><a class="read" href="/articles/${encodeURI(a.slug)}">اقرأ المقال ←</a></article>`}).join('');
  const origin=env.SITE_ORIGIN||new URL(req.url).origin;
  const h=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مدونة كوبونات نون | أحدث الأدلة</title><meta name="description" content="أحدث مقالات وأدلة نون السعودية والإمارات مع مراجعة الكوبونات والسعر النهائي قبل الدفع."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${origin}/blog"><style>body{margin:0;font-family:Tahoma,Arial;background:#f8fafc;color:#111827}.w{width:min(1180px,94%);margin:auto}header{background:#111827;color:#fff;padding:24px 0}header a{color:#fff;margin-left:16px}.hero{padding:30px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:16px}.card img{width:100%;height:auto;border-radius:13px}.card a{color:#5b21b6;text-decoration:none}.tag{display:inline-block;margin-top:12px;background:#ede9fe;color:#5b21b6;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800}.card h2{font-size:19px;line-height:1.6}.meta{font-size:12px;color:#64748b;margin:10px 0}.read{font-weight:800}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.grid{grid-template-columns:1fr}}</style></head><body><header><div class="w"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/saudi-arabia">السعودية</a><a href="/uae">الإمارات</a></div></header><main class="w"><section class="hero"><h1>مدونة كوبونات نون</h1><p>مقالات لا تُنشر إلا بعد اجتياز بوابة الجودة والتحقق من البلد والكوبون والتفرد الدلالي.</p></section><section class="grid">${cards}</section></main></body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
}

async function sitemapIndex(env,origin){
  const days=await r2json(env,'bulk/days.json',{days:[]});
  const items=[];
  for(const d of days.days||[])for(let i=Number(d.shards||0)-1;i>=0;i--)items.push({loc:`${origin}/sitemap-articles-${d.day}-${i}.xml`,lastmod:d.updatedAt||`${d.day}T23:59:59.000Z`});
  for(const n of STATIC_SITEMAPS)items.push({loc:`${origin}/sitemap-${n}.xml`,lastmod:null});
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.map(x=>`<sitemap><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</sitemap>`).join('')}</sitemapindex>`;
}

async function articleSitemap(path,env,origin){
  const m=path.match(/^\/sitemap-articles-(\d{4}-\d{2}-\d{2})-(\d+)\.xml$/);if(!m)return null;
  const day=m[1],shard=Number(m[2]),d=await r2json(env,`bulk/day/${day}/${shard}.json`,null);if(!d)return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  const urls=(d.articles||[]).map(a=>`<url><loc>${esc(origin+'/articles/'+encodeURI(a.slug))}</loc><lastmod>${esc(a.updatedAt||a.createdAt||day)}</lastmod></url>`).join('');
  return xml(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

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
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(u.pathname==='/sitemap.xml')return xml(await sitemapIndex(env,origin));
    if(u.pathname.startsWith('/sitemap-articles-')){const r=await articleSitemap(u.pathname,env,origin);if(r)return r}
    if(u.pathname==='/blog'){const r=await bulkBlogPage(req,env,ctx);if(r)return r}
    if(u.pathname.startsWith('/articles/')){const r=await bulkArticlePage(u,env);if(r)return r}
    if(u.pathname==='/api/ai/generate')return json({error:'legacy_external_generation_disabled',version:VERSION,provider:'workers-ai',externalProviders:false,use:'/api/admin/generate-now'},410);
    if(u.pathname==='/api/platform-health')return json({ok:true,version:PLATFORM_VERSION,generatorVersion:VERSION,control:Boolean(env.CONTROL),r2:Boolean(env.CONTENT_FINAL),workersAI:Boolean(env.AI),bulkProgrammatic:true,bulkEngine:BULK_ENGINE_INFO.version,qualityFirst:true,bulkDailyTarget:Number(env.BULK_DAILY_TARGET||0),ai:{provider:'workers-ai',externalProviders:false,legacyProvidersRemoved:true},time:now()});
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
    if(u.pathname==='/api/admin/bulk-now'&&req.method==='POST'){
      if(!(await isAdmin(req,env)))return json({error:'unauthorized'},401);
      return json(await bulkTick(env));
    }
    if(u.pathname==='/api/admin/status'){
      const r=await handleAdminApi(req,env);if(!r)return r;if(!r.ok)return r;
      try{const d=await r.json();delete d.groqReady;d.workersAIReady=Boolean(env.AI);d.generatorVersion=VERSION;d.activeProvider='workers-ai + '+BULK_ENGINE_INFO.version;d.externalProviders=false;d.qualityFirst=true;d.config={...(d.config||{}),model:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'};return json(d,r.status)}catch{return r}
    }
    if(u.pathname.startsWith('/api/admin/')){const r=await handleAdminApi(req,env);if(r)return r}
    if(u.pathname==='/api/generator-health'){
      const [cfg,status,st]=await Promise.all([getGeneratorConfig(env),getGeneratorStatus(env),readState(env)]),workersAI=workersAiBudget(env,st,status);
      const workersAiArticles=(st.articles||[]).filter(a=>a.status==='published'&&String(a.provider||'').startsWith('workers-ai:')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),lastWorkersAiSuccess=workersAiArticles[0]||null;
      const bulkTotal=Math.max(0,Number(status.bulkPublishedTotal||0)),bulkToday=String(status.bulkDay||'')===now().slice(0,10)?Math.max(0,Number(status.bulkPublishedToday||0)):0;
      const legacyCount=(st.articles||[]).length,legacyPublished=(st.articles||[]).filter(a=>a.status==='published').length;
      return json({ok:true,version:VERSION,cron:'* * * * *',enabled:cfg.enabled,publishPolicy:'Quality first: publish only useful unique articles that pass score>=95, no P0 issues, core group floor>=88, 1000-2000 words, country/coupon/brand locks; daily target is a maximum not a quota',preferredProvider:'workers-ai',providers:{workersAI:workersAI.binding,programmaticCloudflare:true,external:false},legacyProvidersRemoved:true,workersAI,workersAiPublishedTotal:workersAiArticles.length,lastWorkersAiSuccess:lastWorkersAiSuccess?{slug:lastWorkersAiSuccess.slug,createdAt:lastWorkersAiSuccess.createdAt,provider:lastWorkersAiSuccess.provider,quality:lastWorkersAiSuccess.quality,country:lastWorkersAiSuccess.country,coupon:lastWorkersAiSuccess.coupon}:null,models:{workersAI:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'},bulk:{enabled:Number(env.BULK_DAILY_TARGET||0)>0,engine:status.bulkEngine||BULK_ENGINE_INFO.version,qualityFirst:true,topicSpace:BULK_ENGINE_INFO.topicSpace,blueprints:BULK_ENGINE_INFO.blueprints,dailyTarget:Number(env.BULK_DAILY_TARGET||0),batchSize:Number(env.BULK_BATCH_SIZE||2),publishedToday:bulkToday,publishedTotal:bulkTotal,lastRun:status.bulkLastRun||null,lastError:status.bulkLastError||null,lastSlug:status.bulkLastSlug||null,lastQuality:status.bulkLastQuality??null,lastQualityFloor:status.bulkLastQualityFloor??null,lastGroups:status.bulkLastGroups||null,lastWordCount:status.bulkLastWordCount??null,rejectedQuality:Number(status.bulkRejectedQuality||0),rejectedDuplicate:Number(status.bulkRejectedDuplicate||0)},r2Ready:Boolean(env.CONTENT_FINAL),controlReady:Boolean(env.CONTROL),generatorControlReady:Boolean(env.GENERATOR_CONTROL),articleCount:legacyCount+bulkTotal,publishedCount:legacyPublished+bulkTotal,draftCount:(st.articles||[]).filter(a=>a.status==='draft').length,status});
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)ctx.waitUntil(app.scheduled(event,env,ctx));
    ctx.waitUntil(runOnce(env));
    ctx.waitUntil(bulkTick(env));
  }
};
