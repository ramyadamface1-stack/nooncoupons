import {auditGenerated} from './generator-core-v2.js';

const MODEL_DEFAULT='@cf/zai-org/glm-4.7-flash';
const FALLBACK_MODEL_DEFAULT='@cf/google/gemma-4-26b-a4b-it';
const now=()=>new Date().toISOString();
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const wc=s=>String(s||'').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plainText=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

export function isWorkersAiFreeQuotaError(error){
  const s=String(error?.message||error||'').toLowerCase();
  return /\b4006\b|daily free allocation|10[,.]?000\s+neurons|10000\s+neurons|used up your daily free|free allocation.*neurons/.test(s);
}

function isRetryableTechnicalError(error){
  if(isWorkersAiFreeQuotaError(error))return false;
  const s=String(error?.message||error||'').toLowerCase();
  return /empty_response|too_short|timeout|timed out|\b429\b|\b3040\b|capacity|temporar|overloaded|internal/.test(s);
}

export function workersAiBudget(env,state,status={}){
  const articleCap=Math.max(0,Math.min(100,Number(env.WORKERS_AI_DAILY_CAP||60)));
  const callCap=Math.max(articleCap,Math.min(200,Number(env.WORKERS_AI_DAILY_CALL_CAP||80)));
  const day=now().slice(0,10);
  const used=(state?.articles||[]).filter(a=>String(a.createdAt||'').slice(0,10)===day&&String(a.provider||'').startsWith('workers-ai:')).length;
  const callsUsed=String(status?.workersAiDay||'')===day?Math.max(0,Number(status?.workersAiCallsToday||0)):0;
  const quotaBlocked=String(status?.workersAiQuotaDay||'')===day;
  return {
    binding:Boolean(env.AI),
    model:env.WORKERS_AI_MODEL||MODEL_DEFAULT,
    fallbackModel:env.WORKERS_AI_FALLBACK_MODEL||FALLBACK_MODEL_DEFAULT,
    cap:articleCap,
    used,
    remaining:Math.max(0,articleCap-used),
    callCap,
    callsUsed,
    callRemaining:Math.max(0,callCap-callsUsed),
    quotaBlocked,
    quotaResetAt:new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()+1)).toISOString(),
    available:Boolean(env.AI)&&!quotaBlocked&&used<articleCap&&callsUsed<callCap
  };
}

function basePrompt(t,cfg,existing){
  const market=t.country==='SA'?'saudi-arabia':'uae';
  const target=Math.max(Number(cfg.minWords||1000)+200,Math.min(Number(cfg.targetWords||1500),1600));
  return `اكتب نص HTML عربي كامل لمقال أصلي عالي الجودة لموقع كوبونات نون. أعد HTML فقط بدون JSON وبدون Markdown fences وبدون <html> أو <body> أو <script> أو <h1>.

الدولة الوحيدة: ${t.countryName} (${t.country})
الكلمة الأساسية التي يجب أن تظهر طبيعيًا: ${t.kw}
التصنيف: ${t.category}
نية البحث: ${t.intent}
الكوبون الوحيد المسموح بذكره وتجربته: ${t.code}

قواعد إلزامية:
- Brand Lock = Noon فقط ولا تذكر أي متجر منافس.
- Country Lock = ${t.country} فقط، ولا تذكر سوق نون الآخر حتى كمثال أو مقارنة.
- Coupon Lock = ${t.code} فقط، ولا تذكر أي كود NOV آخر.
- ممنوع اختلاق نسبة خصم أو حد أقصى أو مدة صلاحية أو أهلية أو claim تجاري غير متحقق.
- وضّح أن النتيجة النهائية للكوبون تتحقق داخل سلة نون قبل الدفع.
- Answer-first ثم شرح عملي عميق، بدون حشو أو إعادة صياغة نفس الفقرة.
- اكتب 8 أقسام H2 على الأقل وH3 عند الحاجة.
- أضف جدول HTML مفيد للمقارنة أو قائمة قرار واضحة.
- أضف خطوات استخدام الكوبون، troubleshooting، مقارنة السعر النهائي، قرار شراء، ونصائح خاصة بـ ${t.category}.
- أضف قسم H2 بعنوان "الأسئلة الشائعة" وفيه 4 أسئلة H3 على الأقل وإجابات مباشرة.
- أضف روابط داخلية طبيعية إلى / و/${market} و/coupons و/blog و/categories.
- أضف رابطًا خارجيًا واحدًا إلى https://www.noon.com/ مع rel="noopener external sponsored".
- أضف CTA فيه زر <button type="button" data-copy-code="${t.code}"> لنسخ الكود وتجربته.
- لا تضف JSON-LD؛ النظام سيضيفه برمجيًا.
- الحد الأدنى الفعلي ${cfg.minWords} كلمة والهدف قرابة ${target} كلمة، وممنوع تجاوز 2000 كلمة.
- اجعل النص عربيًا طبيعيًا وواضحًا، ولا تستخدم Lorem ipsum أو As an AI.
- لا تستخدم تفكيرًا مطولًا أو مقدمة خارج المقال؛ ابدأ مباشرة بالمحتوى وأكمله للنهاية.

تجنب تكرار زوايا هذه الكلمات المنشورة: ${existing.slice(0,16).join(' | ')}.`;
}

function stripReasoning(s){
  return String(s||'')
    .replace(/<think>[\s\S]*?<\/think>/gi,'')
    .replace(/^```(?:html)?\s*/i,'')
    .replace(/```$/,'')
    .trim();
}

function textFromResult(r){
  const seen=new Set();
  const walk=(v,depth=0)=>{
    if(depth>7||v==null)return '';
    if(typeof v==='string')return v.trim();
    if(typeof v!=='object'||seen.has(v))return '';
    seen.add(v);
    const priority=['response','content','text','output_text','generated_text','answer','completion'];
    for(const k of priority){if(k in v){const x=walk(v[k],depth+1);if(x)return x}}
    if(Array.isArray(v)){for(const x of v){const t=walk(x,depth+1);if(t)return t}return ''}
    for(const k of ['choices','result','output','message','messages','data']){if(k in v){const x=walk(v[k],depth+1);if(x)return x}}
    return '';
  };
  return stripReasoning(walk(r));
}

function extractHtml(text){
  let x=stripReasoning(text);
  if(!x)throw new Error('workers_ai_empty_response');
  if(x[0]==='{'){
    try{const j=JSON.parse(x);if(typeof j?.html==='string')x=j.html;else if(typeof j?.content==='string')x=j.content}catch{}
  }
  x=x.replace(/<!doctype[^>]*>/gi,'')
    .replace(/<\/?html[^>]*>/gi,'')
    .replace(/<\/?body[^>]*>/gi,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,'')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi,'')
    .replace(/javascript:/gi,'')
    .replace(/<h1\b[^>]*>/gi,'<h2>')
    .replace(/<\/h1>/gi,'</h2>')
    .trim();
  if(!x||wc(x)<220)throw new Error('workers_ai_too_short_'+wc(x));
  return x;
}

async function callWorkers(env,prompt,{temperature=.34,maxTokens=4800,model}={}){
  if(!env.AI)throw new Error('workers_ai_binding_missing');
  const chosen=model||env.WORKERS_AI_MODEL||MODEL_DEFAULT;
  const r=await env.AI.run(chosen,{
    messages:[
      {role:'system',content:'أنت محرر عربي دقيق لمحتوى التجارة الإلكترونية. اكتب المقال النهائي مباشرة كـ HTML فقط، بلا تفكير ظاهر أو شرح قبل النص. لا تختلق خصمًا أو شرطًا أو أهلية.'},
      {role:'user',content:prompt}
    ],
    temperature,
    reasoning_effort:'low',
    max_completion_tokens:maxTokens
  });
  const text=textFromResult(r);
  return {html:extractHtml(text),provider:`workers-ai:${chosen}`};
}

function faqData(t){
  return [
    {question:`كيف أستخدم ${t.code} على نون ${t.countryName}؟`,answer:`انسخ الكود ${t.code} وأضف المنتجات إلى السلة ثم أدخل الكود قبل الدفع وتحقق من النتيجة التي تعرضها سلة نون.`},
    {question:`هل يضمن ${t.code} نسبة خصم ثابتة؟`,answer:'لا. لا نفترض نسبة ثابتة أو أهلية موحدة؛ نتيجة السلة الحالية وشروط نون هي المرجع النهائي.'},
    {question:`ماذا أفعل إذا لم يعمل الكود على ${t.category}؟`,answer:'راجع الدولة والمنتجات والبائع وطريقة الدفع، ثم جرّب تغيير عامل واحد في كل مرة وتحقق من رسالة السلة.'},
    {question:'هل أقارن السعر قبل أم بعد تطبيق الكوبون؟',answer:'قارن السعر النهائي بعد الخصم مع الشحن والتوصيل وسياسة الإرجاع، وليس قيمة الخصم وحدها.'}
  ];
}

function schemaBlock(article,t,faq){
  const origin='https://nooncoupons.ramychatgptgcoupons.workers.dev';
  const url=`${origin}/articles/${article.slug}`;
  const graph=[
    {'@type':'Article',headline:article.title,description:article.metaDescription,inLanguage:'ar',mainEntityOfPage:url,author:{'@type':'Organization',name:'كوبونات نون'},publisher:{'@type':'Organization',name:'كوبونات نون'}},
    {'@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.question,acceptedAnswer:{'@type':'Answer',text:x.answer}}))},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'الرئيسية',item:origin+'/'},
      {'@type':'ListItem',position:2,name:'المدونة',item:origin+'/blog'},
      {'@type':'ListItem',position:3,name:article.title,item:url}
    ]}
  ];
  return `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`;
}

function buildArticle(body,t){
  const title=String(t.title||t.kw).slice(0,68);
  const meta=(`دليل عملي حول ${t.kw} مع خطوات استخدام ${t.code}، مقارنة السعر النهائي، وحل مشاكل الكوبون قبل الدفع على نون ${t.countryName}.`).slice(0,158);
  const slug=slugify(t.kw),faq=faqData(t);let h=body;
  if(!/data-copy-code/i.test(h))h+=`<section class="coupon-action"><h2>جرّب الكود في السلة</h2><p>انسخ <strong>${esc(t.code)}</strong> وتحقق من النتيجة داخل سلة نون قبل الدفع.</p><button type="button" data-copy-code="${esc(t.code)}">نسخ الكود ${esc(t.code)}</button></section>`;
  if(!/الأسئلة الشائعة|FAQ/i.test(h))h+=`<section class="faq"><h2>الأسئلة الشائعة</h2>${faq.map(x=>`<h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p>`).join('')}</section>`;
  h+=`<nav class="related-links" aria-label="روابط مفيدة"><h2>روابط تساعدك قبل الشراء</h2><ul><li><a href="/">الرئيسية</a></li><li><a href="/${t.country==='SA'?'saudi-arabia':'uae'}">نون ${esc(t.countryName)}</a></li><li><a href="/coupons">كل الكوبونات</a></li><li><a href="/blog">المدونة</a></li><li><a href="/categories">التصنيفات</a></li></ul><p><a href="https://www.noon.com/" rel="noopener external sponsored">تحقق من السلة على نون</a></p></nav>`;
  const article={title,metaDescription:meta,slug,primaryKeyword:t.kw,secondaryKeywords:[t.category,`كود ${t.code}`,`نون ${t.countryName}`,t.modifier].filter(Boolean),faq,sources:['https://www.noon.com/'],claims:[],country:t.country,coupon:t.code,html:''};
  article.html=`<article lang="ar" dir="rtl"><h1>${esc(title)}</h1><p><strong>${esc(t.kw)}</strong>: هذا الدليل يركز على التحقق العملي من السعر النهائي والكوبون داخل سلة نون ${esc(t.countryName)} قبل الدفع.</p>${h}${schemaBlock(article,t,faq)}</article>`;
  return article;
}

function strictAudit(article,t,cfg,base){
  const plain=plainText(article?.html||''),wordCount=wc(article?.html||'');
  const codes=[...new Set((plain.match(/\bNOV\d{3}\b/gi)||[]).map(x=>x.toUpperCase()))];
  const competitor=/amazon|temu|shein|namshi|aliexpress|trendyol|carrefour|jarir|extra|أمازون|امازون|تيمو|شي\s?إن|شيين|نمشي|علي\s?إكسبريس|علي\s?اكسبريس|ترينديول|كارفور|جرير|إكسترا|اكسترا/i;
  const wrongCountry=t.country==='SA'?/(نون\s*)?(الإمارات|الامارات)|\bUAE\b|Emirates/i:/(نون\s*)?(السعودية|المملكة العربية السعودية)|\bKSA\b|Saudi(?: Arabia)?/i;
  const ar=(plain.match(/[\u0600-\u06FF]/g)||[]).length,latin=(plain.match(/[A-Za-z]/g)||[]).length,arabicRatio=ar/Math.max(1,ar+latin);
  const hard=[
    {name:'word_count_max_2000',pass:wordCount<=2000},
    {name:'arabic_content',pass:arabicRatio>=0.78},
    {name:'coupon_lock',pass:codes.length>=1&&codes.every(x=>x===String(t.code).toUpperCase())},
    {name:'brand_lock_strict',pass:!competitor.test(plain)},
    {name:'country_lock_strict',pass:!wrongCountry.test(plain)}
  ];
  const hardPass=hard.every(x=>x.pass);
  return {...base,wordCount,score:hardPass?base.score:Math.min(Number(base.score||0),94.9),checks:[...(base.checks||[]),...hard],productionReady:Boolean(base.productionReady)&&hardPass&&wordCount>=Number(cfg.minWords||1000)&&wordCount<=2000,hardGate:{pass:hardPass,arabicRatio:Math.round(arabicRatio*1000)/1000,codes}};
}

function repairPrompt(t,cfg,article,audit){
  const failed=(audit?.checks||[]).filter(x=>!x.pass).map(x=>x.name).join(', '),plain=String(article?.html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').slice(0,24000);
  return `أعد كتابة/توسيع/اختصار BODY HTML التالي لمقال نون بحيث يعالج هذه المشاكل فقط: ${failed}.
أعد HTML BODY فقط بدون JSON وبدون <h1> وبدون <script>.
الدولة الوحيدة ${t.countryName} (${t.country})، الكوبون الوحيد ${t.code}، الكلمة الأساسية ${t.kw}.
ممنوع اختلاق نسبة خصم أو شروط. أزل أي متجر منافس، وأزل أي ذكر لسوق نون غير ${t.countryName}، وأزل أي كود NOV غير ${t.code}. المطلوب بين ${cfg.minWords} و2000 كلمة مفيدة، 8 H2، H3، FAQ، روابط داخلية، رابط Noon، CTA data-copy-code، ومحتوى عربي طبيعي غير مكرر. لا تستخدم تفكيرًا مطولًا واكتب النسخة النهائية مباشرة.

المحتوى الحالي:
${plain}`;
}

function retryPrompt(t,cfg,existing,lastError){
  return `${basePrompt(t,cfg,existing)}\
\
هذه محاولة إعادة بعد فشل تقني سابق (${String(lastError||'unknown').slice(0,120)}). ابدأ مباشرة بأول عنصر HTML مفيد، لا تكتب شرحًا قبل HTML، وأكمل المقال حتى النهاية بدون JSON أو Markdown.`;
}

export async function generateWithWorkersAI(env,topic,cfg,state,attempt=0,status={}){
  const budget=workersAiBudget(env,state,status);
  if(!budget.available){
    const reason=!budget.binding?'workers_ai_binding_missing':budget.quotaBlocked?'workers_ai_free_quota_exhausted':budget.callRemaining<=0?'workers_ai_daily_call_cap':'workers_ai_daily_article_cap';
    return {skipped:true,reason,budget,callsUsed:0};
  }
  const existing=(state?.articles||[]).map(a=>a.primaryKeyword||'').filter(Boolean);
  const maxCalls=Math.max(1,Math.min(2,budget.callRemaining));
  let callsUsed=0,lastError=null,article=null,audit=null,provider=`workers-ai:${budget.model}`;

  for(let i=0;i<maxCalls;i++){
    try{
      callsUsed++;
      const repairing=Boolean(i>0&&article&&audit);
      const retryingTechnical=Boolean(i>0&&!article&&lastError);
      const prompt=i===0?basePrompt(topic,cfg,existing):repairing?repairPrompt(topic,cfg,article,audit):retryPrompt(topic,cfg,existing,lastError);
      const selectedModel=retryingTechnical?budget.fallbackModel:budget.model;
      const out=await callWorkers(env,prompt,{temperature:i===0?.34:.22,maxTokens:i===0?4800:5000,model:selectedModel});
      article=buildArticle(out.html,topic);
      audit=strictAudit(article,topic,cfg,auditGenerated(article,topic,cfg));
      provider=i===0?out.provider:repairing?`${provider} + repair:${out.provider}`:out.provider;
      if(audit.productionReady)break;
      lastError='quality_gate_'+audit.score+'_words_'+audit.wordCount;
      const repairWorthIt=i===0&&budget.callRemaining>=2&&audit.wordCount>=850&&audit.wordCount<=2100&&Number(audit.score||0)>=90;
      if(!repairWorthIt)break;
    }catch(e){
      lastError=String(e?.message||e);
      if(isWorkersAiFreeQuotaError(e)||i+1>=maxCalls||!isRetryableTechnicalError(e)){
        const err=new Error(lastError);err.workersAiCallsUsed=callsUsed;err.workersAiBudget=budget;throw err;
      }
      article=null;audit=null;
    }
  }

  if(!article){const err=new Error(lastError||'workers_ai_no_article');err.workersAiCallsUsed=callsUsed;throw err}
  return {article,audit,provider,keysReady:true,workersAI:true,budget,callsUsed,repairUsed:callsUsed>1,lastProviderError:lastError&&!audit?.productionReady?lastError:null};
}
