const CODES=['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'];
const COUNTRIES=['SA','AE'];
const WORKERS_AI_MODEL='@cf/zai-org/glm-4.7-flash';
const now=()=>new Date().toISOString();
const norm=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim();
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const wc=s=>String(s||'').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;

async function ctl(env,path,init){const id=env.CONTROL.idFromName('primary');return env.CONTROL.get(id).fetch('https://control.internal'+path,init)}
export async function readState(env){return (await ctl(env,'/state')).json()}

const CATEGORIES=['الجوالات','اللابتوبات','التابلت','السماعات','الساعات الذكية','التلفزيونات','أجهزة الألعاب','إكسسوارات الألعاب','الكاميرات','إكسسوارات الكمبيوتر','الأزياء النسائية','الأزياء الرجالية','الأحذية','الحقائب','العطور','مستحضرات التجميل','العناية بالبشرة','العناية بالشعر','العناية الشخصية','الأجهزة المنزلية','المطبخ','الأثاث','الديكور','أدوات التنظيف','البقالة','مستلزمات المدرسة','ألعاب الأطفال','مستلزمات المواليد','الرياضة واللياقة','الهدايا','شنط السفر','إكسسوارات السيارات','المكتب المنزلي','الأجهزة القابلة للارتداء','الطابعات','الشاشات','الراوترات','التخزين الخارجي','الأجهزة الصوتية','منتجات القهوة','أدوات الطبخ','المفروشات','الإضاءة','تنظيم المنزل','معدات التخييم','الدراجات','الألعاب التعليمية','مستلزمات الحيوانات الأليفة'];
const MODIFIERS=['قبل الدفع','وقت العروض','للعملاء الحاليين','للطلب الأول','مع الشحن','مع مقارنة البائعين','مع مقارنة الأسعار','بدون شراء زائد','للتوفير الحقيقي','قبل اختيار البائع','قبل تغيير طريقة الدفع','مع مراجعة الإرجاع','مع فحص الضمان','عند شراء أكثر من منتج','مع سلة متعددة الفئات','مع سلة من عدة بائعين','على الهاتف','من المتصفح','لشراء ذكي','مع حل مشاكل الكود'];
const ANGLES=[
(cn,cat,code,m)=>({kw:`كود خصم نون ${cn} ${cat} ${m}`,title:`كود خصم نون ${cn} ${cat}: دليل عملي ${m}`,intent:'transactional'}),
(cn,cat,code,m)=>({kw:`أفضل كوبون نون ${cn} ${cat} ${m}`,title:`أفضل كوبون نون ${cn} ${cat}: كيف تقارن النتيجة ${m}`,intent:'commercial'}),
(cn,cat,code,m)=>({kw:`طريقة استخدام كود نون ${cn} عند شراء ${cat} ${m}`,title:`طريقة استخدام كود نون ${cn} عند شراء ${cat} ${m}`,intent:'how-to'}),
(cn,cat,code,m)=>({kw:`مقارنة كوبونات نون ${cn} ${cat} ${m}`,title:`مقارنة كوبونات نون ${cn} ${cat}: أي كود أفضل ${m}؟`,intent:'comparison'}),
(cn,cat,code,m)=>({kw:`لماذا لا يعمل كود نون ${cn} على ${cat} ${m}`,title:`لماذا لا يعمل كود نون ${cn} على ${cat}؟ حلول ${m}`,intent:'troubleshooting'}),
(cn,cat,code,m)=>({kw:`هل يعمل كود نون ${cn} على ${cat} ${m}`,title:`هل يعمل كود نون ${cn} على ${cat}؟ التحقق ${m}`,intent:'question'}),
(cn,cat,code,m)=>({kw:`توفير نون ${cn} ${cat} ${m}`,title:`توفير نون ${cn} ${cat}: كيف تخفض التكلفة ${m}`,intent:'commercial'}),
(cn,cat,code,m)=>({kw:`شراء ${cat} من نون ${cn} باستخدام كوبون ${m}`,title:`شراء ${cat} من نون ${cn} باستخدام كوبون ${m}`,intent:'transactional'}),
(cn,cat,code,m)=>({kw:`مقارنة أسعار ${cat} على نون ${cn} ${m}`,title:`مقارنة أسعار ${cat} على نون ${cn} ${m}`,intent:'comparison'}),
(cn,cat,code,m)=>({kw:`كود ${code} نون ${cn} ${cat} ${m}`,title:`كود ${code} على نون ${cn} لشراء ${cat} ${m}`,intent:'coupon-specific'}),
(cn,cat,code,m)=>({kw:`كوبون ${code} نون ${cn} ${cat} ${m}`,title:`كوبون ${code} نون ${cn} ${cat}: ما الذي تتحقق منه ${m}؟`,intent:'coupon-specific'}),
(cn,cat,code,m)=>({kw:`خصومات نون ${cn} ${cat} ${m}`,title:`خصومات نون ${cn} ${cat}: كيف تتحقق من التوفير ${m}`,intent:'informational-commercial'}),
(cn,cat,code,m)=>({kw:`أفضل وقت لشراء ${cat} من نون ${cn} ${m}`,title:`أفضل وقت لشراء ${cat} من نون ${cn} ${m}`,intent:'decision'}),
(cn,cat,code,m)=>({kw:`اختيار بائع ${cat} على نون ${cn} ${m}`,title:`اختيار بائع ${cat} على نون ${cn} ${m}`,intent:'decision'}),
(cn,cat,code,m)=>({kw:`سعر ${cat} بعد كود نون ${cn} ${m}`,title:`سعر ${cat} بعد كود نون ${cn}: حساب التوفير ${m}`,intent:'comparison'}),
(cn,cat,code,m)=>({kw:`حل مشكلة كوبون نون ${cn} ${cat} ${m}`,title:`حل مشكلة كوبون نون ${cn} عند شراء ${cat} ${m}`,intent:'troubleshooting'}),
(cn,cat,code,m)=>({kw:`هل الخصم المباشر أفضل من كود نون ${cn} ${cat} ${m}`,title:`الخصم المباشر أم كود نون ${cn} لشراء ${cat} ${m}؟`,intent:'decision'}),
(cn,cat,code,m)=>({kw:`دليل شراء ${cat} من نون ${cn} بكوبون ${m}`,title:`دليل شراء ${cat} من نون ${cn} بكوبون ${m}`,intent:'guide'})
];

export function providerReadiness(env){
  return {workersAI:Boolean(env.AI),any:Boolean(env.AI),external:false};
}

export function pickTopic(state,attempt=0){
  const existing=new Set((state.articles||[]).map(a=>norm(a.primaryKeyword||'')));
  const total=CATEGORIES.length*ANGLES.length*MODIFIERS.length*CODES.length*COUNTRIES.length;
  for(let step=0;step<Math.min(total,16000);step++){
    const n=(attempt+step)%total;
    let q=n;
    const country=COUNTRIES[q%COUNTRIES.length];q=Math.floor(q/COUNTRIES.length);
    const code=CODES[q%CODES.length];q=Math.floor(q/CODES.length);
    const modifier=MODIFIERS[q%MODIFIERS.length];q=Math.floor(q/MODIFIERS.length);
    const angle=ANGLES[q%ANGLES.length];q=Math.floor(q/ANGLES.length);
    const category=CATEGORIES[q%CATEGORIES.length];
    const countryName=country==='SA'?'السعودية':'الإمارات';
    const t=angle(countryName,category,code,modifier);
    if(!existing.has(norm(t.kw)))return {...t,country,code,category,modifier,countryName,variant:n%4};
  }
  return null;
}

export function auditGenerated(a,t,cfg){
  const content=String(a.html||''),plain=content.replace(/<[^>]+>/g,' '),checks=[];const add=(n,p,w)=>checks.push({name:n,pass:!!p,weight:w});
  const n=wc(content),codes=[...new Set((plain.match(/\bNOV\d{3}\b/gi)||[]).map(x=>x.toUpperCase()))];
  add('word_count',n>=Number(cfg.minWords||1000)&&n<=2000,20);
  add('primary_keyword',norm(plain).includes(norm(a.primaryKeyword||t.kw)),10);
  add('coupon',codes.length>=1&&codes.every(x=>x===String(t.code).toUpperCase()),10);
  add('brand',/نون|Noon/i.test(plain),8);
  add('country',t.country==='SA'?/السعودية|Saudi/i.test(plain):/الإمارات|UAE|Emirates/i.test(plain),8);
  add('h1',(content.match(/<h1\b/gi)||[]).length===1,8);
  add('h2',(content.match(/<h2\b/gi)||[]).length>=6,8);
  add('faq',/الأسئلة الشائعة|FAQ/i.test(plain),6);
  add('internal',(content.match(/href=["']\//gi)||[]).length>=4,6);
  add('external',/https:\/\/www\.noon\.com\//i.test(content),5);
  add('schema',/application\/ld\+json/i.test(content),5);
  add('meta',String(a.metaDescription||'').length>=95,4);
  add('cta',/data-copy-code|Try it|جرّب|نسخ/i.test(content),4);
  add('sources',Array.isArray(a.sources)&&a.sources.length>=1,4);
  add('faq_data',Array.isArray(a.faq)&&a.faq.length>=4,4);
  const leak=/amazon|temu|shein|namshi|aliexpress|trendyol|carrefour|jarir|extra|أمازون|امازون|تيمو|شي\s?إن|شيين|نمشي|علي\s?إكسبريس|علي\s?اكسبريس|ترينديول|كارفور|جرير|إكسترا|اكسترا/i.test(plain);
  add('brand_lock',!leak,12);
  const wrong=t.country==='SA'?/(نون\s*)?(الإمارات|الامارات)|\bUAE\b|Emirates/i:/(نون\s*)?(السعودية|المملكة العربية السعودية)|\bKSA\b|Saudi(?: Arabia)?/i;
  const wrongCountry=wrong.test(plain);add('country_lock',!wrongCountry,12);
  const ar=(plain.match(/[\u0600-\u06FF]/g)||[]).length,latin=(plain.match(/[A-Za-z]/g)||[]).length,arabicRatio=ar/Math.max(1,ar+latin);add('arabic_content',arabicRatio>=0.78,8);
  const total=checks.reduce((s,x)=>s+x.weight,0),passed=checks.reduce((s,x)=>s+(x.pass?x.weight:0),0),score=Math.round(passed/total*1000)/10;
  return {score,wordCount:n,checks,productionReady:score>=Number(cfg.qualityThreshold||95)&&n>=Number(cfg.minWords||1000)&&n<=2000&&!leak&&!wrongCountry&&arabicRatio>=0.78};
}

export async function generateArticle(){
  throw new Error('legacy_external_generator_disabled_use_generateWithWorkersAI');
}

export async function publishGenerated(env,article,topic,audit,provider){
  const st=await readState(env);
  const slug=slugify(article.slug||article.title||article.primaryKeyword);
  const duplicate=(st.articles||[]).find(x=>x.slug===slug||norm(x.primaryKeyword||'')===norm(article.primaryKeyword||''));
  if(duplicate)throw new Error('keyword_or_slug_cannibalization');
  if(!env.CONTENT_FINAL)throw new Error('r2_binding_missing');
  const rec={id:crypto.randomUUID(),slug,title:article.title||slug,metaDescription:article.metaDescription||'',country:topic.country,coupon:topic.code,status:'published',scheduledAt:null,createdAt:now(),updatedAt:now(),quality:audit.score,qualityCoverage:100,provider,primaryKeyword:article.primaryKeyword||topic.kw};
  await env.CONTENT_FINAL.put('articles/'+slug+'.html',String(article.html||''),{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{title:rec.title,country:rec.country,status:'published',provider:String(provider).slice(0,100)}});
  const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});
  if(!r.ok)throw new Error('control_article_'+r.status);
  return rec;
}

export const GENERATOR_DEFAULTS={enabled:true,model:WORKERS_AI_MODEL,targetWords:1500,minWords:1000,qualityThreshold:95};
