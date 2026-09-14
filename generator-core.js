import {makeSeedArticle} from './seed-factory.js';

const CODES=['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'];
const COUNTRIES=['SA','AE'];
const DEFAULT_MODEL='openai/gpt-oss-120b';
const now=()=>new Date().toISOString();
const norm=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim();
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const wc=s=>String(s||'').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
const parse=s=>JSON.parse(String(s||'').trim().replace(/^```json\s*/i,'').replace(/```$/,''));

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

export function pickTopic(state,attempt=0){
  const existing=new Set((state.articles||[]).map(a=>norm(a.primaryKeyword||'')));
  const total=CATEGORIES.length*ANGLES.length*MODIFIERS.length*CODES.length*COUNTRIES.length;
  for(let step=0;step<Math.min(total,12000);step++){
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

function promptFor(t,cfg,existing){
  const market=t.country==='SA'?'saudi-arabia':'uae';
  return `اكتب مقالة عربية أصلية احترافية لموقع متخصص في كوبونات Noon ${t.countryName}.\nPrimary keyword: ${t.kw}\nCategory: ${t.category}\nIntent: ${t.intent}\nCoupon code: ${t.code}\nBrand Lock=Noon فقط. Country Lock=${t.country}.\nممنوع اختلاق نسبة خصم أو حد أقصى أو مدة صلاحية أو أهلية. لا تقل إن 10% عرض فعلي داخل النص؛ تصميمات SVG لها قالب بصري مستقل فقط. السلة وشروط نون الحالية هي المرجع النهائي.\nالمقال يجب أن يكون Answer-first وSEO/AEO/GEO/E-E-A-T، H1 واحد، 8 H2 على الأقل، H3، جدول مقارنة، FAQ من 4 أسئلة، خطوات استخدام، troubleshooting، قرار شراء، وروابط داخلية إلى / و/${market} و/coupons و/blog و/categories، ورابط خارجي إلى https://www.noon.com/. أضف CTA نسخ وتجربة وJSON-LD Article+FAQPage+BreadcrumbList.\nالحد الأدنى ${cfg.minWords} كلمة والهدف ${cfg.targetWords}. لا تكرر عبارات عامة ولا تذكر منافسين.\nتجنب الكلمات المنشورة التالية: ${existing.slice(0,45).join(' | ')}\nأعد JSON صالح فقط بالمفاتيح title,metaDescription,slug,primaryKeyword,secondaryKeywords,html,faq,sources,claims.`;
}

async function groq(env,prompt,keyIndex=0){
  const keys=[env.GROQ_API_KEY_1,env.GROQ_API_KEY_2].filter(Boolean);
  if(!keys.length)throw new Error('groq_keys_missing');
  const key=keys[keyIndex%keys.length];
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key},body:JSON.stringify({model:env.GROQ_MODEL||DEFAULT_MODEL,messages:[{role:'system',content:'Return one strict JSON object only. No markdown fences.'},{role:'user',content:prompt}],temperature:.55,response_format:{type:'json_object'},max_completion_tokens:12000})});
  if(!r.ok)throw new Error('groq_'+r.status+'_'+(await r.text()).slice(0,180));
  const d=await r.json();return d?.choices?.[0]?.message?.content||'';
}

function fallback(t){
  return makeSeedArticle({slug:slugify(t.kw),title:t.title.slice(0,68),metaDescription:(`دليل عملي حول ${t.kw} مع استخدام ${t.code} ومقارنة السعر النهائي وحل مشاكل الكوبون قبل الدفع على نون ${t.countryName}.`).slice(0,160),country:t.country,coupon:t.code,keyword:t.kw,focus:`${t.category} ${t.modifier}`,detail1:`عند شراء ${t.category} راجع المواصفات والبائع والسعر الأساسي قبل تطبيق القسيمة. ${t.modifier} اجعل المقارنة على نفس السلة حتى تكون النتيجة قابلة للقياس.`,detail2:`استخدم ${t.code} ككود متاح للتجربة فقط، ولا تفترض نسبة خصم ثابتة أو أهلية موحدة. السلة هي المرجع النهائي.`,detail3:`إذا لم يعمل الكود، اختبر سلة أصغر وغيّر عاملًا واحدًا في كل مرة، ثم قارن السعر النهائي والشحن والتوصيل قبل اتخاذ القرار.`,decision:`أفضل قرار في ${t.category} هو المنتج الذي يحقق احتياجك بسعر نهائي مناسب بعد مقارنة البائع والشروط، ثم يأتي دور القسيمة كأداة لتحسين الصفقة.`,variant:t.variant});
}

export function auditGenerated(a,t,cfg){
  const content=String(a.html||''),plain=content.replace(/<[^>]+>/g,' '),checks=[];const add=(n,p,w)=>checks.push({name:n,pass:!!p,weight:w});
  const n=wc(content);
  add('word_count',n>=cfg.minWords,20);add('primary_keyword',norm(plain).includes(norm(a.primaryKeyword||t.kw)),10);add('coupon',plain.includes(t.code),8);add('brand',/نون|Noon/i.test(plain),8);add('country',t.country==='SA'?/السعودية|Saudi/i.test(plain):/الإمارات|UAE|Emirates/i.test(plain),8);add('h1',(content.match(/<h1\b/gi)||[]).length===1,8);add('h2',(content.match(/<h2\b/gi)||[]).length>=6,8);add('faq',/الأسئلة الشائعة|FAQ/i.test(plain),6);add('internal',(content.match(/href=["']\//gi)||[]).length>=4,6);add('external',/https:\/\/www\.noon\.com\//i.test(content),5);add('schema',/application\/ld\+json/i.test(content),5);add('meta',String(a.metaDescription||'').length>=95,4);add('cta',/data-copy-code|Try it|جرّب|نسخ/i.test(content),4);
  const leak=/amazon|temu|shein|namshi|أمازون|شي إن|تيمو/i.test(plain);add('brand_lock',!leak,12);const wrong=t.country==='SA'?/نون الإمارات|UAE Noon/i.test(plain):/نون السعودية|Saudi Noon/i.test(plain);add('country_lock',!wrong,12);
  const total=checks.reduce((s,x)=>s+x.weight,0),passed=checks.reduce((s,x)=>s+(x.pass?x.weight:0),0),score=Math.round(passed/total*1000)/10;
  return {score,wordCount:n,checks,productionReady:score>=cfg.qualityThreshold&&n>=cfg.minWords&&!leak&&!wrong};
}

export async function generateArticle(env,topic,cfg,state,attempt=0){
  const existing=(state.articles||[]).map(x=>x.primaryKeyword||'').filter(Boolean);
  const keysReady=Boolean(env.GROQ_API_KEY_1||env.GROQ_API_KEY_2);
  let article,provider='local-fallback';
  if(keysReady){
    try{article=parse(await groq(env,promptFor(topic,cfg,existing),attempt%2));provider='groq:'+String(env.GROQ_MODEL||DEFAULT_MODEL)}catch(e1){
      try{article=parse(await groq(env,promptFor(topic,cfg,existing),(attempt+1)%2));provider='groq-rotated:'+String(env.GROQ_MODEL||DEFAULT_MODEL)}catch(e2){article=fallback(topic);provider='local-fallback'}
    }
  }else article=fallback(topic);
  article.country=topic.country;article.coupon=topic.code;article.primaryKeyword=article.primaryKeyword||topic.kw;article.slug=slugify(article.slug||article.title||topic.kw);
  let audit=auditGenerated(article,topic,cfg);
  if(!audit.productionReady&&keysReady){
    const bad=audit.checks.filter(x=>!x.pass).map(x=>x.name).join(', ');
    const rp=`أصلح المقال التالي ليجتاز بوابة الجودة. لا تغير الدولة ${topic.country} ولا الكوبون ${topic.code} ولا الكلمة الأساسية ${topic.kw}. المشاكل: ${bad}. زد القيمة الفعلية وتجنب التكرار. أعد JSON بنفس المفاتيح فقط.\n${JSON.stringify(article)}`;
    try{const repaired=parse(await groq(env,rp,(attempt+1)%2));repaired.country=topic.country;repaired.coupon=topic.code;repaired.primaryKeyword=topic.kw;repaired.slug=slugify(repaired.slug||repaired.title||topic.kw);article=repaired;audit=auditGenerated(article,topic,cfg);provider+=' + repair'}catch{}
  }
  return {article,audit,provider,keysReady};
}

export async function publishGenerated(env,article,topic,audit,provider){
  const st=await readState(env);if((st.articles||[]).some(x=>norm(x.primaryKeyword||'')===norm(article.primaryKeyword||'')))throw new Error('keyword_cannibalization');
  const slug=slugify(article.slug||article.title||article.primaryKeyword);const rec={id:crypto.randomUUID(),slug,title:article.title||slug,metaDescription:article.metaDescription||'',country:topic.country,coupon:topic.code,status:'published',scheduledAt:null,createdAt:now(),updatedAt:now(),quality:audit.score,qualityCoverage:100,provider,primaryKeyword:article.primaryKeyword||topic.kw};
  await env.CONTENT_FINAL.put('articles/'+slug+'.html',String(article.html||''),{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{title:rec.title,country:rec.country,status:'published'}});
  const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});if(!r.ok)throw new Error('control_article_'+r.status);return rec;
}

export const GENERATOR_DEFAULTS={enabled:true,model:DEFAULT_MODEL,targetWords:1800,minWords:1000,qualityThreshold:95};
