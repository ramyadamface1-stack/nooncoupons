import {auditGenerated} from './generator-core-v2.js';

const MODEL_DEFAULT='@cf/zai-org/glm-4.7-flash';
const now=()=>new Date().toISOString();
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const parse=s=>{const x=String(s||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();try{return JSON.parse(x)}catch{}const a=x.indexOf('{'),b=x.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(x.slice(a,b+1));throw new Error('workers_ai_invalid_json')};

export function workersAiBudget(env,state){
  const cap=Math.max(0,Math.min(100,Number(env.WORKERS_AI_DAILY_CAP||30)));
  const day=now().slice(0,10);
  const used=(state?.articles||[]).filter(a=>String(a.createdAt||'').slice(0,10)===day&&String(a.provider||'').startsWith('workers-ai:')).length;
  return {binding:Boolean(env.AI),model:env.WORKERS_AI_MODEL||MODEL_DEFAULT,cap,used,remaining:Math.max(0,cap-used),available:Boolean(env.AI)&&used<cap};
}

function promptFor(t,cfg,existing){
  const market=t.country==='SA'?'saudi-arabia':'uae';
  return `اكتب مقالة عربية أصلية عالية الجودة لموقع كوبونات نون، بدون اختلاق أي معلومة تجارية.\nالدولة: ${t.countryName} (${t.country})\nالكلمة الأساسية: ${t.kw}\nالتصنيف: ${t.category}\nنية البحث: ${t.intent}\nالكوبون المتاح للتجربة فقط: ${t.code}\n\nقواعد إلزامية:\n- Brand Lock = Noon فقط، ولا تذكر أي متجر منافس.\n- Country Lock = ${t.country} فقط.\n- ممنوع اختلاق نسبة خصم أو حد أقصى أو صلاحية أو أهلية أو ادعاء أن الكود يعمل لكل شخص.\n- اذكر بوضوح أن النتيجة النهائية تُتحقق داخل سلة نون.\n- Answer-first ثم شرح عميق ومفيد، وليس حشوًا.\n- H1 واحد، و8 H2 على الأقل، وH3، وجدول مقارنة، وخطوات استخدام، وقسم troubleshooting، وقسم قرار شراء.\n- FAQ من 4 إلى 7 أسئلة بإجابات مباشرة.\n- روابط داخلية إلى / و/${market} و/coupons و/blog و/categories.\n- رابط خارجي واحد على الأقل إلى https://www.noon.com/ مع rel مناسب.\n- CTA لنسخ الكود وتجربته، واستخدم data-copy-code="${t.code}".\n- أضف JSON-LD صالحًا لـ Article وFAQPage وBreadcrumbList داخل HTML.\n- الحد الأدنى ${cfg.minWords} كلمة، والهدف ${cfg.targetWords} كلمة.\n- metaDescription بين 105 و160 حرفًا.\n- sources يجب أن تكون قائمة وتحتوي فقط مصادر استخدمتها فعليًا؛ عند عدم التحقق من شروط عرض محدد استخدم https://www.noon.com/ فقط كمصدر عام ولا تنسب له أرقامًا.\n- لا تستخدم عبارات مثل As an AI أو Lorem ipsum.\n\nتجنب تكرار هذه الكلمات المنشورة: ${existing.slice(0,55).join(' | ')}\n\nأعد JSON صالح فقط، بدون markdown fences، بالمفاتيح التالية بالضبط:\ntitle, metaDescription, slug, primaryKeyword, secondaryKeywords, html, faq, sources, claims.`;
}

function textFromResult(r){
  if(typeof r==='string')return r;
  if(typeof r?.response==='string')return r.response;
  if(typeof r?.result?.response==='string')return r.result.response;
  if(typeof r?.choices?.[0]?.message?.content==='string')return r.choices[0].message.content;
  if(typeof r?.result?.choices?.[0]?.message?.content==='string')return r.result.choices[0].message.content;
  return '';
}

async function callWorkers(env,prompt){
  if(!env.AI)throw new Error('workers_ai_binding_missing');
  const model=env.WORKERS_AI_MODEL||MODEL_DEFAULT;
  const r=await env.AI.run(model,{
    messages:[
      {role:'system',content:'أنت محرر عربي متخصص في التجارة الإلكترونية. أعد JSON فقط، والتزم بعدم اختلاق أي خصم أو شرط.'},
      {role:'user',content:prompt}
    ],
    temperature:0.45,
    max_completion_tokens:9000,
    response_format:{type:'json_object'}
  });
  const text=textFromResult(r);
  if(!text)throw new Error('workers_ai_empty_response');
  return {article:parse(text),provider:`workers-ai:${model}`};
}

export async function generateWithWorkersAI(env,topic,cfg,state,attempt=0){
  const budget=workersAiBudget(env,state);
  if(!budget.available)return {skipped:true,reason:budget.binding?'workers_ai_daily_cap':'workers_ai_binding_missing',budget};
  const existing=(state?.articles||[]).map(a=>a.primaryKeyword||'').filter(Boolean);
  let out=await callWorkers(env,promptFor(topic,cfg,existing));
  let article=out.article;
  article.country=topic.country;
  article.coupon=topic.code;
  article.primaryKeyword=topic.kw;
  article.slug=slugify(article.slug||article.title||topic.kw);
  let audit=auditGenerated(article,topic,cfg);
  let repairUsed=false;
  if(!audit.productionReady&&budget.remaining>1){
    const failed=audit.checks.filter(x=>!x.pass).map(x=>x.name).join(', ');
    const repairPrompt=`أصلح JSON المقال التالي حتى يجتاز بوابة الجودة بدون اختلاق أي claim. لا تغير الدولة ${topic.country} ولا الكوبون ${topic.code} ولا الكلمة الأساسية ${topic.kw}. المشاكل: ${failed}. أعد JSON كامل بنفس المفاتيح فقط.\n${JSON.stringify(article)}`;
    const repaired=await callWorkers(env,repairPrompt);
    article=repaired.article;
    article.country=topic.country;article.coupon=topic.code;article.primaryKeyword=topic.kw;article.slug=slugify(article.slug||article.title||topic.kw);
    audit=auditGenerated(article,topic,cfg);
    out.provider+=` + repair:${repaired.provider}`;
    repairUsed=true;
  }
  return {article,audit,provider:out.provider,keysReady:true,workersAI:true,budget,repairUsed,lastProviderError:null};
}
