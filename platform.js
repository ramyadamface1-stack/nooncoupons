import publicApp from './seo-layer.js';
import {QUALITY_CRITERIA_COUNT} from './quality-criteria.js';
import {SEED_ARTICLES} from './seed-articles.js';
import {SEED_BATCH_A} from './seed-batch-a.js';
import {SEED_BATCH_B} from './seed-batch-b.js';
import {SEED_BATCH_C} from './seed-batch-c.js';
import {APPROVED_COUPON_CODES,isApprovedCoupon,normalizeApprovedCoupon,replaceUnapprovedCouponTokens} from './approved-coupons.js';

const ALL_SEED_ARTICLES=[...SEED_ARTICLES,...SEED_BATCH_A,...SEED_BATCH_B,...SEED_BATCH_C];
const CODES=APPROVED_COUPON_CODES;
const LIVE_MARKETS=['SA','AE'];
const now=()=>new Date().toISOString();
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const wc=s=>String(s||'').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
const normKw=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim();
const kwTokens=s=>new Set(normKw(s).split(/\s+/).filter(x=>x.length>2));
const overlap=(a,b)=>{const A=kwTokens(a),B=kwTokens(b);let n=0;for(const x of A)if(B.has(x))n++;return n};
const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const auth=(req,env)=>Boolean(env.ADMIN_TOKEN)&&req.headers.get('authorization')==='Bearer '+env.ADMIN_TOKEN;
const makeState=()=>({
  version:2,
  markets:{SA:{enabled:true,label:'السعودية'},AE:{enabled:true,label:'الإمارات'},EG:{enabled:false,label:'مصر'}},
  coupons:CODES.flatMap(code=>LIVE_MARKETS.map(country=>({id:country+'-'+code,code,country,status:'active',verified:false,priority:100,updatedAt:now()}))),
  articles:[],
  settings:{brand:'Noon',qualityThreshold:95,minWords:1500,targetWords:1700,aiPrimary:'workers-ai',aiFallback:null},
  audit:[]
});

async function body(req){try{return await req.json()}catch{return {}}}
async function ctl(env,path,init){const id=env.CONTROL.idFromName('primary');return env.CONTROL.get(id).fetch('https://control.internal'+path,init)}
async function state(env){const r=await ctl(env,'/state');if(!r.ok){let detail='';try{detail=await r.text()}catch{}throw new Error('control_state_'+r.status+':'+detail.slice(0,240))}return r.json()}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function auditArticle(a){
  const title=String(a.title||''),meta=String(a.metaDescription||''),content=String(a.html||''),plain=content.replace(/<[^>]+>/g,' '),country=String(a.country||''),coupon=String(a.coupon||''),primary=String(a.primaryKeyword||'');
  const n=wc(content),checks=[];const add=(name,pass,weight=1)=>checks.push({name,pass:!!pass,weight});
  add('Article Identity',title.length>=20&&title.length<=70,2);
  add('Brand Relevance',/نون|Noon/i.test(title+' '+plain),2);
  add('Country Relevance',country==='SA'?/السعودية|Saudi/i.test(plain):country==='AE'?/الإمارات|UAE|Emirates/i.test(plain):false,2);
  add('Coupon Relevance',coupon?plain.includes(coupon):true,2);
  add('Primary Keyword',primary?normKw(plain).includes(normKw(primary)):false,2);
  add('Title SEO',title.length>=30&&title.length<=68,2);
  add('Meta Description',meta.length>=95&&meta.length<=165,2);
  add('URL / Slug',Boolean(a.slug&&String(a.slug).length<=120),1);
  add('H1 Optimization',(content.match(/<h1\b/gi)||[]).length===1,2);
  add('H2 Hierarchy',(content.match(/<h2\b/gi)||[]).length>=6,2);
  add('H3 Hierarchy',(content.match(/<h3\b/gi)||[]).length>=1,1);
  add('Content Length',n>=Number(a.minWords||1500)&&n<=2000,4);
  add('FAQ Section',/FAQ|الأسئلة الشائعة|سؤال/i.test(content),2);
  add('Internal Linking',(content.match(/href=["']\//gi)||[]).length>=3,1);
  add('External Linking',/https:\/\/www\.noon\.com\//i.test(content),1);
  add('Schema Markup',/application\/ld\+json/i.test(content),2);
  add('Coupon Copy Button',/data-copy-code|clipboard|نسخ الكود/i.test(content),2);
  add('Try-It CTA',/جرّب|استخدم الكود|Try/i.test(content),1);
  const unsupported=/(\d{1,2}%|خصم\s*\d+|حتى\s*\d+)/g.test(plain)&&!/مصدر|وفق|شروط|موثق|السلة/i.test(plain);
  add('Unsupported Claims',!unsupported,5);
  const leakage=/amazon|temu|shein|namshi|aliexpress|trendyol|carrefour|jarir|extra|أمازون|امازون|تيمو|شي\s?إن|شيين|نمشي|علي\s?إكسبريس|ترينديول|كارفور|جرير|إكسترا|اكسترا/i.test(plain);
  add('Cross-Brand Isolation',!leakage,5);
  const wrongCountry=country==='SA'?/(نون\s*)?(الإمارات|الامارات)|\bUAE\b|Emirates/i.test(plain):country==='AE'?/(نون\s*)?(السعودية|المملكة العربية السعودية)|\bKSA\b|Saudi(?: Arabia)?/i.test(plain):true;
  add('Country Lock',!wrongCountry,5);
  const codes=[...new Set((plain.match(/\b(?:OPS\d+|NOV\d+)\b/gi)||[]).map(x=>x.toUpperCase()))];
  const couponCode=String(coupon||'').toUpperCase(),couponLock=!couponCode||(isApprovedCoupon(couponCode)&&codes.length>=1&&codes.every(x=>isApprovedCoupon(x)&&x===couponCode));
  add('Coupon Lock',couponLock,5);
  const total=checks.reduce((s,c)=>s+c.weight,0),passed=checks.reduce((s,c)=>s+(c.pass?c.weight:0),0),score=Math.round(passed/total*1000)/10;
  const hardPass=!unsupported&&!leakage&&!wrongCountry&&couponLock&&n>=Number(a.minWords||1500)&&n<=2000;
  return {score,wordCount:n,checks,productionReady:hardPass&&score>=95};
}

async function save(req,env){
  if(!auth(req,env))return json({error:'unauthorized'},401);
  const b=await body(req),a=b.article||b,audit=auditArticle(a),current=await state(env);
  const slug=slugify(a.slug||a.title),nk=normKw(a.primaryKeyword||'');
  const conflict=(current.articles||[]).find(x=>(nk&&normKw(x.primaryKeyword||'')===nk||x.slug===slug)&&x.slug!==slug);
  if(conflict)return json({error:'keyword_or_slug_cannibalization',conflictsWith:{slug:conflict.slug,title:conflict.title}},409);
  if(!audit.productionReady&&!b.forceDraft)return json({error:'quality_gate_failed',audit},422);
  if(!env.CONTENT_FINAL)return json({error:'R2 binding missing'},503);
  const rec={id:crypto.randomUUID(),slug,title:a.title||slug,metaDescription:a.metaDescription||'',country:a.country,coupon:a.coupon||'',status:b.status||'draft',scheduledAt:b.scheduledAt||null,createdAt:now(),updatedAt:now(),quality:audit.score,qualityCoverage:100,provider:a.provider||null,primaryKeyword:a.primaryKeyword||''};
  await env.CONTENT_FINAL.put('articles/'+slug+'.html',String(a.html||''),{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{title:rec.title,country:rec.country,status:rec.status}});
  const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});
  return json({ok:true,record:await r.json(),audit});
}

async function seedIfNeeded(env){
  if(!env.CONTROL||!env.CONTENT_FINAL)return {seeded:0,reason:'bindings_missing'};
  const s=await state(env),existing=new Set((s.articles||[]).map(a=>a.slug));
  let seeded=0;
  for(const source of ALL_SEED_ARTICLES){
    if(existing.has(source.slug))continue;
    const fallback=source.country==='AE'?'NOV188':'NOV170',coupon=normalizeApprovedCoupon(source.coupon,fallback);
    const a={...source,coupon,title:replaceUnapprovedCouponTokens(source.title,coupon),metaDescription:replaceUnapprovedCouponTokens(source.metaDescription,coupon),primaryKeyword:replaceUnapprovedCouponTokens(source.primaryKeyword||'',coupon),html:replaceUnapprovedCouponTokens(source.html,coupon)};
    const audit=auditArticle({...a,minWords:1000});
    const rec={id:crypto.randomUUID(),slug:a.slug,title:a.title,metaDescription:a.metaDescription,country:a.country,coupon:a.coupon,status:'published',scheduledAt:null,createdAt:now(),updatedAt:now(),quality:audit.score,qualityCoverage:100,provider:'manual-openai-seed',primaryKeyword:a.primaryKeyword||''};
    await env.CONTENT_FINAL.put('articles/'+a.slug+'.html',a.html,{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{title:a.title,country:a.country,status:'published',coupon:a.coupon}});
    await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});
    existing.add(a.slug);seeded++;
  }
  return {seeded,totalSeedArticles:ALL_SEED_ARTICLES.length};
}

async function blogPage(env){
  await seedIfNeeded(env);
  const s=await state(env),articles=(s.articles||[]).filter(a=>a.status==='published');
  const cards=articles.map(a=>`<article class="card"><span class="tag">${a.country==='SA'?'السعودية':'الإمارات'}</span><h2><a href="/articles/${encodeURI(a.slug)}">${esc(a.title)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><div class="meta">${esc(a.coupon||'')} · ${a.country==='SA'?'السعودية':'الإمارات'}</div><a class="read" href="/articles/${encodeURI(a.slug)}">اقرأ المقال ←</a></article>`).join('');
  const origin=env.SITE_ORIGIN||'';
  const h=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مدونة كوبونات نون | أدلة السعودية والإمارات</title><meta name="description" content="مقالات وأدلة عملية عن كوبونات نون السعودية والإمارات، مقارنة الأكواد، حل مشاكل القسائم، وأدلة شراء حسب الفئات."><link rel="canonical" href="${origin}/blog"><style>body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827}header{background:#111827;color:#fff;padding:28px 0}.w{width:min(1160px,92%);margin:auto}nav a{color:#fff;margin-left:18px}.hero{padding:34px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:20px;box-shadow:0 10px 28px rgba(15,23,42,.05)}.card h2{font-size:20px;line-height:1.6}.card a{color:#5b21b6;text-decoration:none}.tag{display:inline-block;background:#ede9fe;color:#5b21b6;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700}.meta{color:#64748b;font-size:12px;margin:12px 0}.read{font-weight:800}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.grid{grid-template-columns:1fr}}</style></head><body><header><div class="w"><nav><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/saudi">السعودية</a><a href="/uae">الإمارات</a></nav></div></header><main class="w"><section class="hero"><h1>مدونة كوبونات نون</h1><p>كل مقال منشور هنا راجعه فريق التحرير للتأكد من السوق والكود والمعلومات الأساسية قبل ظهوره للزوار.</p></section><section class="grid">${cards}</section></main></body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
}

function articleSchema(rec,env){
  const url=(env.SITE_ORIGIN||'')+'/articles/'+rec.slug,market=rec.country==='SA'?'السعودية':'الإمارات';
  const faq=[
    {'@type':'Question',name:'هل الكوبون مضمون لكل المستخدمين؟',acceptedAnswer:{'@type':'Answer',text:'لا. الأهلية النهائية تتحدد داخل سلة نون وشروط الحملة وقت الاستخدام.'}},
    {'@type':'Question',name:'كيف أتحقق من أفضل نتيجة؟',acceptedAnswer:{'@type':'Answer',text:'جرّب الكود على السلة وتحقق من الإجمالي النهائي قبل الدفع.'}},
    {'@type':'Question',name:'هل تختلف النتائج بين الأسواق؟',acceptedAnswer:{'@type':'Answer',text:'قد تختلف الأهلية والنتائج بين الأسواق، لذلك استخدم صفحة الدولة الصحيحة واختبر داخل السلة.'}}
  ];
  return [
    {'@context':'https://schema.org','@type':'Article',headline:rec.title,description:rec.metaDescription||'',mainEntityOfPage:url,inLanguage:'ar',datePublished:rec.createdAt||rec.updatedAt,dateModified:rec.updatedAt||rec.createdAt,about:['Noon','كوبونات نون',market],author:{'@type':'Organization',name:'كوبونات نون'},publisher:{'@type':'Organization',name:'كوبونات نون',url:env.SITE_ORIGIN||''}},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:(env.SITE_ORIGIN||'')+'/'},{'@type':'ListItem',position:2,name:'المدونة',item:(env.SITE_ORIGIN||'')+'/blog'},{'@type':'ListItem',position:3,name:rec.title,item:url}]},
    {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq}
  ];
}

async function articlePage(path,env){
  const slug=decodeURIComponent(path.split('/').filter(Boolean).pop()),s=await state(env),rec=s.articles.find(a=>a.slug===slug&&a.status==='published');
  if(!rec||!env.CONTENT_FINAL)return null;
  const o=await env.CONTENT_FINAL.get('articles/'+slug+'.html');if(!o)return null;
  let b=await o.text();
  const related=(s.articles||[]).filter(a=>a.status==='published'&&a.country===rec.country&&a.slug!==rec.slug).map(a=>({...a,_rel:overlap((rec.primaryKeyword||rec.title),(a.primaryKeyword||a.title))+overlap(rec.title,a.title)})).sort((a,b)=>b._rel-a._rel||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,5);
  const marketUrl=rec.country==='SA'?'/saudi-arabia':'/uae',marketName=rec.country==='SA'?'نون السعودية':'نون الإمارات';
  const internal=`<aside class="related"><h2>روابط مفيدة داخل الموقع</h2><ul><li><a href="/">الرئيسية</a></li><li><a href="${marketUrl}">${marketName}</a></li><li><a href="/coupons">جميع أكواد نون</a></li><li><a href="/categories">التصنيفات</a></li><li><a href="/blog">كل الأدلة والمقالات</a></li>${related.map(a=>`<li><a href="/articles/${encodeURI(a.slug)}">${esc(a.title)}</a></li>`).join('')}</ul></aside>`;
  const external='<aside class="source"><h2>مصدر خارجي رسمي</h2><p>للتحقق النهائي من السعر والأهلية وشروط العرض، راجع <a href="https://www.noon.com/" rel="noopener external sponsored">موقع نون الرسمي</a> قبل الدفع. السلة وشروط نون الحالية هي المرجع النهائي.</p></aside>';
  b=b.replace(/<\/article>\s*$/i,internal+external+'</article>');
  const schemas=articleSchema(rec,env).map(x=>'<script type="application/ld+json">'+JSON.stringify(x).replace(/</g,'\\u003c')+'</script>').join('');
  const canonical=(env.SITE_ORIGIN||'')+'/articles/'+encodeURI(slug);
  const h=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(rec.title)}</title><meta name="description" content="${esc(rec.metaDescription||'')}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(rec.title)}"><meta property="og:description" content="${esc(rec.metaDescription||'')}"><meta property="og:url" content="${canonical}">${schemas}<style>body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#111827;background:#fff}.a{width:min(920px,92%);margin:40px auto;line-height:2}.a img,.a svg{max-width:100%;height:auto}.a a{color:#5b21b6}.related,.source{margin:28px 0;padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:#fafafa}.related ul{columns:2;gap:30px}@media(max-width:640px){.related ul{columns:1}}</style></head><body><main class="a">${b}</main></body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=0,s-maxage=600'}});
}

async function privacyHash(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function randomHex(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}

export class ControlPlane{
  constructor(ctx,env){this.ctx=ctx;this.env=env}
  async get(){
    let s=await this.ctx.storage.get('state'),dirty=false;
    if(!s){s=makeState();dirty=true}
    else{
      if(!s||typeof s!=='object'||Array.isArray(s))s=makeState(),dirty=true;
      const settings={...(s.settings||{})};
      if(settings.aiPrimary!=='workers-ai'){settings.aiPrimary='workers-ai';dirty=true}
      if(settings.aiFallback!==null){settings.aiFallback=null;dirty=true}
      if(Number(settings.targetWords||0)!==1700){settings.targetWords=1700;dirty=true}
      if(Number(settings.minWords||0)!==1500){settings.minWords=1500;dirty=true}
      if(Number(settings.qualityThreshold||0)!==95){settings.qualityThreshold=95;dirty=true}
      s.settings=settings;
      const expectedCoupons=CODES.flatMap(code=>LIVE_MARKETS.map(country=>({id:country+'-'+code,code,country,status:'active',verified:false,priority:100,updatedAt:now()})));
      const currentCodes=new Set((Array.isArray(s.coupons)?s.coupons:[]).map(x=>String(x?.code||'').toUpperCase()));
      if(currentCodes.size!==CODES.length||CODES.some(code=>!currentCodes.has(code))){s.coupons=expectedCoupons;dirty=true}
      if(!Array.isArray(s.articles)){s.articles=[];dirty=true}
      s.articles=s.articles.map(a=>{
        const fallback=a?.country==='AE'?'NOV188':'NOV170',coupon=normalizeApprovedCoupon(a?.coupon,fallback);
        const next={...a,coupon,title:replaceUnapprovedCouponTokens(a?.title||'',coupon),metaDescription:replaceUnapprovedCouponTokens(a?.metaDescription||'',coupon),primaryKeyword:replaceUnapprovedCouponTokens(a?.primaryKeyword||'',coupon)};
        if(coupon!==a?.coupon||next.title!==a?.title||next.metaDescription!==a?.metaDescription||next.primaryKeyword!==(a?.primaryKeyword||''))dirty=true;
        return next;
      });
      if(!Array.isArray(s.audit)){s.audit=[];dirty=true}
      if(s.version!==3){s.version=3;dirty=true}
    }
    if(dirty){try{await this.ctx.storage.put('state',s)}catch(e){s.storageMigrationWarning=String(e?.message||e).slice(0,220)}}
    return s;
  }
  async fetch(req){
    try{
    const u=new URL(req.url);
    if(u.pathname==='/ping')return json({ok:true,class:'ControlPlane',version:5,uniqueArticleVisits:true,rawIpStored:false,conversionEvents:true,eventPiiStored:false});
    if(u.pathname==='/state')return json(await this.get());
    if(u.pathname==='/visit'&&req.method==='POST'){
      const b=await req.json(),path=String(b?.path||'').slice(0,500),ip=String(b?.ip||'').slice(0,100);
      if(!/^\/(?:en\/)?articles\//.test(path)||!ip)return json({ok:false,error:'invalid_visit'},400);
      let pepper=await this.ctx.storage.get('visit-pepper-v1');
      if(!pepper){pepper=randomHex(32);await this.ctx.storage.put('visit-pepper-v1',pepper)}
      const pathHash=await privacyHash(path),visitorHash=await privacyHash(pepper+'|'+ip+'|'+pathHash),seenKey='visit-seen:'+pathHash+':'+visitorHash,totalKey='visit-total:'+pathHash;
      if(await this.ctx.storage.get(seenKey))return json({ok:true,unique:false});
      const current=await this.ctx.storage.get(totalKey)||{path,count:0,lastAt:null};
      const next={path,count:Math.max(0,Number(current.count||0))+1,lastAt:now()};
      await this.ctx.storage.put({[seenKey]:1,[totalKey]:next});
      return json({ok:true,unique:true,count:next.count});
    }
    if(u.pathname==='/visits-batch'&&req.method==='POST'){
      const b=await req.json(),paths=[...new Set((Array.isArray(b?.paths)?b.paths:[]).map(x=>String(x||'').slice(0,500)).filter(x=>/^\/(?:en\/)?articles\//.test(x)))].slice(0,800);
      const pairs=await Promise.all(paths.map(async path=>[path,'visit-total:'+await privacyHash(path)]));
      const keys=pairs.map(x=>x[1]),stored=keys.length?await this.ctx.storage.get(keys):new Map(),counts={};
      for(const [path,key] of pairs){const row=stored instanceof Map?stored.get(key):null;counts[path]=Math.max(0,Number(row?.count||0))}
      return json({ok:true,privacy:'sha256-with-private-do-pepper',rawIpStored:false,counts});
    }
    if(u.pathname==='/event'&&req.method==='POST'){
      const b=await req.json(),type=String(b?.type||''),path=String(b?.path||'/').slice(0,500),label=String(b?.label||'').replace(/[<>]/g,'').slice(0,120);
      const allowed=new Set(['copy_code','open_noon','share_whatsapp','share_x','share_facebook','web_share']);
      if(!allowed.has(type)||!path.startsWith('/'))return json({ok:false,error:'invalid_event'},400);
      const key='conversion-events-v1',current=await this.ctx.storage.get(key)||{version:1,totals:{},paths:{},updatedAt:null};
      current.totals[type]=Math.max(0,Number(current.totals[type]||0))+1;
      const p=current.paths[path]||{path,total:0,events:{},lastAt:null};
      p.total=Math.max(0,Number(p.total||0))+1;p.events[type]=Math.max(0,Number(p.events[type]||0))+1;p.lastAt=now();if(label)p.lastLabel=label;
      current.paths[path]=p;current.updatedAt=now();
      const entries=Object.entries(current.paths);
      if(entries.length>250){
        entries.sort((a,b)=>Number(b[1]?.total||0)-Number(a[1]?.total||0)||String(b[1]?.lastAt||'').localeCompare(String(a[1]?.lastAt||'')));
        current.paths=Object.fromEntries(entries.slice(0,250));
      }
      await this.ctx.storage.put(key,current);
      return json({ok:true,stored:'aggregate-only',piiStored:false});
    }
    if(u.pathname==='/events-summary'&&req.method==='GET'){
      const current=await this.ctx.storage.get('conversion-events-v1')||{version:1,totals:{},paths:{},updatedAt:null};
      const topPaths=Object.values(current.paths||{}).sort((a,b)=>Number(b?.total||0)-Number(a?.total||0)).slice(0,50);
      return json({ok:true,privacy:'aggregate-events-only',piiStored:false,totals:current.totals||{},topPaths,updatedAt:current.updatedAt||null});
    }
    if(u.pathname==='/article'&&req.method==='POST'){
      const rec=await req.json(),s=await this.get(),i=s.articles.findIndex(a=>a.slug===rec.slug);
      if(i>=0)s.articles[i]={...s.articles[i],...rec};else s.articles.unshift(rec);
      s.audit.unshift({at:now(),action:'article_upsert',slug:rec.slug});s.audit=s.audit.slice(0,500);
      await this.ctx.storage.put('state',s);return json(rec);
    }
    if(u.pathname==='/publish-due'&&req.method==='POST'){
      const s=await this.get(),t=Date.now();let n=0;
      for(const a of s.articles)if(a.status==='scheduled'&&a.scheduledAt&&Date.parse(a.scheduledAt)<=t){a.status='published';a.updatedAt=now();n++}
      if(n)await this.ctx.storage.put('state',s);return json({published:n});
    }
    return json({error:'not_found'},404);
    }catch(e){return json({error:'control_plane_exception',message:String(e?.message||e).slice(0,500)},500)}
  }
}

export default{
  async fetch(req,env,ctx){
    const p=new URL(req.url).pathname.replace(/\/+$/,'')||'/';
    if(p==='/api/control-health'){try{const r=await ctl(env,'/ping');return json({ok:r.ok,status:r.status,body:await r.json()})}catch(e){return json({ok:false,error:String(e?.message||e)},503)}}
    if(p==='/api/control-diag'){const probe=async name=>{try{const id=env.CONTROL.idFromName(name),r=await env.CONTROL.get(id).fetch('https://control.internal/ping');return {name,status:r.status,ok:r.ok}}catch(e){return {name,status:0,ok:false,error:String(e?.message||e).slice(0,160)}}};const a=await probe('primary'),b=await probe('nov-diagnostic-20260918');const clean=x=>String(x||'').replace(/[<>]/g,'').replace(/\s+/g,' ').slice(0,90),ae=clean(a.error||'none'),be=clean(b.error||'none'),title=`Control p-${a.status}-${a.ok?'ok':'fail'} d-${b.status}-${b.ok?'ok':'fail'} ${ae||be}`,detail=`primary: ${ae} | probe: ${be}`;return new Response(`<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><title>${title}</title></head><body><h1>${title}</h1><p>${detail}</p></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
    if(p==='/api/platform-health')return json({ok:true,version:'platform-1.4-cloudflare-only',control:Boolean(env.CONTROL),r2:Boolean(env.CONTENT_FINAL),criteria:QUALITY_CRITERIA_COUNT,markets:LIVE_MARKETS,ai:{provider:'workers-ai',binding:Boolean(env.AI),externalProviders:false},time:now()});
    if(p==='/api/state'){await seedIfNeeded(env);return json(await state(env))}
    if(p==='/api/ai/generate'&&req.method==='POST')return json({error:'legacy_external_generation_disabled',provider:'workers-ai',externalProviders:false},410);
    if(p==='/api/articles'&&req.method==='POST')return save(req,env);
    if(p==='/api/audit'&&req.method==='POST'){if(!auth(req,env))return json({error:'unauthorized'},401);return json(auditArticle(await body(req)))}
    if(p==='/blog')return blogPage(env);
    if(p.startsWith('/articles/')){await seedIfNeeded(env);const r=await articlePage(p,env);if(r)return r}
    return publicApp.fetch(req,env,ctx);
  },
  async scheduled(e,env,ctx){ctx.waitUntil(seedIfNeeded(env));ctx.waitUntil(ctl(env,'/publish-due',{method:'POST'}));if(publicApp.scheduled)ctx.waitUntil(publicApp.scheduled(e,env,ctx))}
};
