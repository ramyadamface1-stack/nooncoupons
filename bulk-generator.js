import {makeSeedArticle} from './seed-factory.js';
import {pickTopic,auditGenerated} from './generator-core-v2.js';

const now=()=>new Date().toISOString();
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const enc=s=>encodeURIComponent(String(s||'')).slice(0,1800);
const MAX_LATEST=300;
const SHARD_SIZE=100;

function safeMeta(topic){
  let x=`دليل عملي حول ${topic.kw} على نون ${topic.countryName} مع خطوات تجربة ${topic.code} ومراجعة السعر النهائي والبائع والشحن قبل الدفع بدون ادعاءات خصم غير موثقة.`;
  if(x.length<105)x+=' مع نصائح واضحة لاتخاذ قرار شراء أفضل والتحقق من نتيجة السلة.';
  return x.slice(0,158);
}

function topicDetails(t,n){
  const v=n%6,cat=t.category,mod=t.modifier,intent=t.intent;
  const d1=[
    `في ${cat} ابدأ بالمواصفات التي تؤثر في استخدامك اليومي، ثم قارن المنتجات المتقاربة فعلًا بدل مقارنة أسماء أو أسعار فقط. عبارة ${mod} تعني أن القرار يجب أن يبقى مرتبطًا بالسلة الفعلية وبالمنتج الذي تحتاجه، وليس بوجود القسيمة وحده.`,
    `عند شراء ${cat} رتّب المعايير قبل فتح السلة: الاستخدام، المواصفات، البائع، التوصيل والإرجاع. بعد ذلك اختبر الكود على الخيار الأقرب لاحتياجك. بهذه الطريقة يصبح ${mod} جزءًا من مقارنة منضبطة بدل أن يتحول إلى سبب لزيادة قيمة الطلب بلا داعٍ.`,
    `أفضل طريقة للتعامل مع ${cat} هي فصل قرار المنتج عن قرار الخصم. اختر أولًا ما يناسبك من حيث المواصفات والبائع، ثم استخدم ${t.code} لاختبار أثر القسيمة. في سيناريو ${mod} دوّن السعر قبل التطبيق وبعده حتى تكون المقارنة قابلة للمراجعة.`,
    `لأن فئة ${cat} قد تضم بدائل كثيرة، لا تبدأ من الكود. قلّل القائمة إلى عدة خيارات متقاربة في المواصفات، ثم راجع السعر النهائي بعد الشحن. عند ${mod} يصبح الاختبار على نفس السلة أهم من أي رقم ترويجي مكتوب خارج صفحة الدفع.`,
    `في موضوع ${cat} قد يختلف السعر بسبب البائع أو الإصدار أو الملحقات، لذلك تأكد أن المقارنة بين منتجات متكافئة. بعد تثبيت المنتج جرّب ${t.code} ثم راجع الإجمالي. هذا أكثر دقة خصوصًا ${mod}.`,
    `تعامل مع شراء ${cat} كقرار له مرحلتان: اختيار المنتج المناسب ثم تحسين التكلفة. الكود ${t.code} ينتمي للمرحلة الثانية فقط. عندما يكون هدفك ${mod} لا تسمح للقسيمة أن تغيّر المواصفات الأساسية التي اخترتها من البداية.`
  ][v];
  const d2=[
    `نية البحث هنا هي ${intent}. لذلك ركّز على الإجراء الذي يساعدك على الحسم: مقارنة السعر النهائي، التأكد من البائع، ثم اختبار الكود مرة واحدة بصورة صحيحة. إذا لم تظهر نتيجة مناسبة، غيّر عاملًا واحدًا في السلة بدل تكرار المحاولة نفسها.`,
    `لأن النية ${intent}، فالمعلومة المفيدة هي ما يغير قرارك فعلًا. راقب إجمالي الطلب بعد تطبيق القسيمة، وراجع الشحن وموعد التوصيل والإرجاع. لا تعتبر رسالة قبول الكود وحدها دليلًا على أن الصفقة أصبحت أفضل.`,
    `زاوية ${intent} تحتاج نتيجة عملية أكثر من وصف عام. سجّل السعر الأساسي، طبّق ${t.code}، ثم قارِن الإجمالي النهائي. إذا تغيّر المنتج أو البائع أثناء التجربة أعد القياس من البداية حتى لا تنسب فرقًا غير متعلق بالكود إلى القسيمة.`,
    `في بحث من نوع ${intent} يجب أن يكون الجواب قابلًا للتنفيذ. اختبر القسيمة على السلة الحالية، ثم راجع تكلفة الشحن وأي اختلاف في البائع. إذا لم يتحسن القرار النهائي فلا يوجد سبب لزيادة الطلب فقط من أجل مطاردة خصم.`,
    `المحتوى الموجّه لنية ${intent} يكون أفضل عندما يختصر الطريق إلى قرار واضح. لذلك نركز على القياس داخل السلة بدل الوعود العامة، ونستخدم ${t.code} كأداة اختبار فقط مع إبقاء شروط نون الحالية هي المرجع النهائي.`,
    `عند نية ${intent} لا تحتاج قائمة طويلة من الادعاءات؛ تحتاج طريقة تحقق. جرّب ${t.code}، راقب الإجمالي، وافحص أي رسالة أهلية تظهر لك. بعد ذلك قرر على أساس السعر النهائي وقيمة المنتج لا على أساس وجود كلمة خصم.`
  ][(v+2)%6];
  const d3=[
    `إذا كانت النتيجة غير واضحة، أعد الاختبار بسلة أصغر مرتبطة بـ${cat}. هذه الخطوة تساعد على معرفة ما إذا كان عنصر معين أو بائع معين يغير سلوك القسيمة. بعد فهم السبب أعد بناء السلة بالشكل الأنسب لك وراجع الإجمالي مرة أخيرة قبل الدفع.`,
    `لو لم يعمل الكود كما توقعت، لا تفترض سببًا غير موثق. راجع الدولة والحساب والمنتج وطريقة الدفع وما يظهر في السلة. في ${cat} قد يكون اختلاف الإصدار أو البائع كافيًا لتغيير المقارنة، لذلك اختبر بتدرج واحتفظ بنفس المنتج أثناء القياس.`,
    `عند وجود عدة عناصر من ${cat}، جرّب أولًا عنصرًا واحدًا ثم أضف البقية تدريجيًا. الهدف هو فهم أثر كل تغيير. وبعد الوصول إلى سلة مستقرة، طبّق ${t.code} وراجع السعر النهائي بدل الاعتماد على رسالة القبول فقط.`,
    `إذا كانت السلة تضم أكثر من بائع، افصل الاختبار مؤقتًا لمعرفة أين تتغير النتيجة. لا يعني ذلك أن تقسيم الطلب هو الأفضل دائمًا؛ بعد التشخيص قارن التكلفة الكاملة والتوصيل والإرجاع قبل اتخاذ القرار النهائي.`,
    `الخطأ الأكثر شيوعًا هو تغيير المنتج والبائع والكود في الوقت نفسه، ثم محاولة تفسير النتيجة. ثبّت عناصر المقارنة، وغيّر عاملًا واحدًا كل مرة. هذا مهم في ${cat} لأن فروق المواصفات قد تكون أكبر من أثر القسيمة نفسها.`,
    `لو وصلت إلى نتيجة غير مرضية، توقف عن تكرار نفس المحاولة. ارجع لمعايير شراء ${cat}، راجع بدائل المنتج والبائع، ثم أعد اختبار ${t.code} على سلة واضحة. القرار الجيد هو ما يجمع الملاءمة والتكلفة النهائية.`
  ][(v+4)%6];
  const decision=`بالنسبة إلى ${t.kw}، القرار الأفضل هو اختيار ${cat} المناسب أولًا ثم تجربة ${t.code} داخل سلة نون ${t.countryName}. ${mod} قارن الإجمالي النهائي والبائع والشحن والإرجاع، ولا تعتمد على ادعاء غير موثق خارج السلة.`;
  return {d1,d2,d3,decision};
}

function sanitizeCountry(html,country){
  if(country==='SA')return String(html).replace(/الإمارات|الامارات|\bUAE\b|Emirates/gi,'سوق مختلف');
  return String(html).replace(/السعودية|المملكة العربية السعودية|\bKSA\b|Saudi(?: Arabia)?/gi,'سوق مختلف');
}

function enrich(article,t){
  const faq=[
    {question:`كيف أستخدم ${t.code} على نون ${t.countryName}؟`,answer:`انسخ ${t.code} وأدخله في خانة القسيمة ثم راجع الإجمالي النهائي داخل السلة قبل الدفع.`},
    {question:`هل نتيجة ${t.code} ثابتة لكل حساب؟`,answer:'لا. الأهلية والنتيجة النهائية تظهر داخل السلة وشروط نون الحالية هي المرجع.'},
    {question:`ماذا أفعل إذا لم يعمل الكود على ${t.category}؟`,answer:'راجع المنتج والبائع والحساب وطريقة الدفع، ثم جرّب سلة أصغر وغيّر عاملًا واحدًا كل مرة.'},
    {question:'كيف أقارن التوفير بصورة صحيحة؟',answer:'قارن إجمالي الطلب النهائي على نفس السلة مع مراجعة الشحن والبائع والإرجاع، وليس رسالة قبول الكود فقط.'}
  ];
  let h=sanitizeCountry(article.html,t.country);
  const extra=`<section class="programmatic-action"><h2>تحقق من النتيجة على نون</h2><p>انسخ <strong>${t.code}</strong> وجرّبه على سلتك الحالية، ثم اجعل الإجمالي الظاهر قبل الدفع هو المرجع النهائي.</p><button type="button" data-copy-code="${t.code}">نسخ الكود ${t.code}</button><p><a href="https://www.noon.com/" rel="noopener external sponsored">فتح موقع نون الرسمي</a></p><p><a href="/coupons">كل الكوبونات</a> · <a href="/blog">المدونة</a> · <a href="/categories">التصنيفات</a></p></section>`;
  h=h.replace(/<script type="application\/ld\+json">/i,extra+'<script type="application/ld+json">');
  if(!/data-copy-code/i.test(h))h=h.replace(/<\/article>\s*$/i,extra+'</article>');
  article.html=h;
  article.faq=faq;
  article.sources=['https://www.noon.com/'];
  article.claims=[];
  return article;
}

export function buildProgrammaticArticle(topic,cursor=0){
  const d=topicDetails(topic,cursor);
  const article=makeSeedArticle({
    slug:slugify(topic.kw),
    title:String(topic.title||topic.kw).slice(0,68),
    metaDescription:safeMeta(topic),
    country:topic.country,
    coupon:topic.code,
    keyword:topic.kw,
    focus:`${topic.category} ${topic.modifier}`,
    detail1:d.d1,
    detail2:d.d2,
    detail3:d.d3,
    decision:d.decision,
    variant:cursor%4
  });
  return enrich(article,topic);
}

async function readJson(env,key,fallback){
  try{const o=await env.CONTENT_FINAL.get(key);return o?await o.json():fallback}catch{return fallback}
}

async function writeCatalogs(env,day,countBefore,records){
  if(!records.length)return;
  const latest=await readJson(env,'bulk/latest.json',{version:1,articles:[]});
  const seen=new Set(records.map(r=>r.slug));
  const merged=[...records.slice().reverse(),...(latest.articles||[]).filter(r=>!seen.has(r.slug))].slice(0,MAX_LATEST);
  await env.CONTENT_FINAL.put('bulk/latest.json',JSON.stringify({version:1,updatedAt:now(),articles:merged}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});

  const groups=new Map();
  records.forEach((r,i)=>{const shard=Math.floor((countBefore+i)/SHARD_SIZE);if(!groups.has(shard))groups.set(shard,[]);groups.get(shard).push(r)});
  for(const [shard,items] of groups){
    const key=`bulk/day/${day}/${shard}.json`;
    const current=await readJson(env,key,{version:1,day,shard,articles:[]});
    const have=new Set((current.articles||[]).map(r=>r.slug));
    const articles=[...(current.articles||[]),...items.filter(r=>!have.has(r.slug))];
    await env.CONTENT_FINAL.put(key,JSON.stringify({version:1,day,shard,updatedAt:now(),articles}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  }

  const days=await readJson(env,'bulk/days.json',{version:1,days:[]});
  const newCount=countBefore+records.length;
  const row={day,count:newCount,shards:Math.ceil(newCount/SHARD_SIZE),updatedAt:now()};
  const next=[row,...(days.days||[]).filter(x=>x.day!==day)].sort((a,b)=>String(b.day).localeCompare(String(a.day))).slice(0,3650);
  await env.CONTENT_FINAL.put('bulk/days.json',JSON.stringify({version:1,updatedAt:now(),days:next}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
}

export async function runProgrammaticBatch(env,cfg,status,{dailyTarget=2000,batchSize=2}={}){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing',patch:{bulkLastError:'r2_binding_missing',bulkLastRun:now()}};
  const day=now().slice(0,10);
  const countBefore=String(status.bulkDay||'')===day?Math.max(0,Number(status.bulkPublishedToday||0)):0;
  const target=Math.max(0,Math.min(5000,Number(dailyTarget||2000)));
  const batch=Math.max(1,Math.min(5,Number(batchSize||2)));
  if(countBefore>=target)return {ok:true,skipped:'daily_target_reached',records:[],patch:{bulkDay:day,bulkPublishedToday:countBefore,bulkDailyTarget:target,bulkLastRun:now(),bulkLastError:null}};

  let cursor=Math.max(0,Number(status.bulkCursor||0)),tries=0;
  const records=[];
  while(records.length<batch&&countBefore+records.length<target&&tries<batch*10){
    const currentCursor=cursor++;
    tries++;
    const topic=pickTopic({articles:[]},currentCursor);
    if(!topic)break;
    const article=buildProgrammaticArticle(topic,currentCursor);
    const audit=auditGenerated(article,topic,{...cfg,minWords:Math.max(1000,Number(cfg.minWords||1000)),qualityThreshold:Math.max(95,Number(cfg.qualityThreshold||95))});
    if(!audit.productionReady)continue;
    const key='articles/'+article.slug+'.html';
    if(await env.CONTENT_FINAL.head(key))continue;
    const createdAt=now();
    const rec={slug:article.slug,title:article.title,metaDescription:article.metaDescription,country:topic.country,coupon:topic.code,status:'published',createdAt,updatedAt:createdAt,quality:audit.score,provider:'programmatic-cloudflare:v1',primaryKeyword:topic.kw,wordCount:audit.wordCount};
    await env.CONTENT_FINAL.put(key,String(article.html||''),{
      httpMetadata:{contentType:'text/html; charset=utf-8'},
      customMetadata:{t:enc(rec.title),m:enc(rec.metaDescription),c:rec.country,cp:rec.coupon,q:String(rec.quality),p:rec.provider,kw:enc(rec.primaryKeyword),at:createdAt,status:'published'}
    });
    records.push(rec);
  }
  await writeCatalogs(env,day,countBefore,records);
  const total=Math.max(0,Number(status.bulkPublishedTotal||0))+records.length;
  const patch={bulkDay:day,bulkPublishedToday:countBefore+records.length,bulkPublishedTotal:total,bulkDailyTarget:target,bulkCursor:cursor,bulkLastRun:now(),bulkLastError:records.length?'':(countBefore>=target?null:'no_programmatic_article_passed'),bulkLastSlug:records.at(-1)?.slug||status.bulkLastSlug||null,bulkLastQuality:records.at(-1)?.quality??status.bulkLastQuality??null,bulkLastWordCount:records.at(-1)?.wordCount??status.bulkLastWordCount??null};
  return {ok:true,records,tries,patch};
}
