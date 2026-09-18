import {buildUsefulArticle} from './bulk-content-engine.js';
import {auditSeoArticle,auditSummary} from './quality-audit.js';

const now=()=>new Date().toISOString();
const enc=s=>encodeURIComponent(String(s||'')).slice(0,1800);
const ALLOWED_CODES=new Set(['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161']);
const RECENT_LIMIT=180;
const MAX_PASSES=4;
const RECOVERY_PASS=4;

const GROUPS=[
  {re:/جوال|هاتف|موبايل|ساعة ذكية|قابل.*للارتداء|كاميرا/i,category:'الجوالات والأجهزة الذكية',factors:['سعة التخزين','عمر البطارية','الإصدار','الضمان','حالة المنتج'],uses:['الاستخدام اليومي','التصوير','العمل','الألعاب','السفر'],checks:['توافق الشبكات','الإصدار الإقليمي','الملحقات المرفقة','سياسة الضمان والإرجاع']},
  {re:/لابتوب|كمبيوتر|تابلت|طابعة|شاشة|راوتر|تخزين|ألعاب|gaming/i,category:'الكمبيوتر والإلكترونيات',factors:['المعالج','الذاكرة','التخزين','الشاشة','الضمان'],uses:['الدراسة','العمل','البرمجة','الألعاب','التنقل'],checks:['نظام التشغيل','المنافذ والاتصال','الإصدار','قابلية الترقية']},
  {re:/سماعة|صوت|audio|speaker/i,category:'الصوتيات',factors:['نوع الاتصال','جودة الميكروفون','عمر البطارية','الراحة','العزل'],uses:['المكالمات','التمارين','السفر','الألعاب','الاستماع اليومي'],checks:['التوافق مع الجهاز','نوع الشحن','المقاس والراحة','سياسة الضمان']},
  {re:/تلفزيون|شاشة تلفزيون|tv/i,category:'التلفزيونات والشاشات',factors:['المقاس','الدقة','معدل التحديث','المنافذ','الضمان'],uses:['الأفلام','الألعاب','غرفة صغيرة','غرفة كبيرة','استخدام متعدد'],checks:['المسافة المناسبة للمشاهدة','المداخل المطلوبة','الحامل أو القاعدة','الإصدار الإقليمي']},
  {re:/أزياء|ازياء|ملابس|حذاء|أحذية|احذية|حقيبة|حقائب/i,category:'الأزياء والإكسسوارات',factors:['المقاس','الخامة','القصة','اللون','سياسة الإرجاع'],uses:['الاستخدام اليومي','العمل','السفر','مناسبة','هدية'],checks:['دليل المقاسات','وصف الخامة','صور المنتج','شروط الاستبدال والإرجاع']},
  {re:/عطر|تجميل|بشرة|شعر|عناية/i,category:'الجمال والعناية',factors:['نوع المنتج','الملاءمة للاستخدام','الحجم','المكونات المعلنة','سياسة الإرجاع'],uses:['روتين يومي','السفر','هدية','تجربة منتج','إعادة شراء'],checks:['وصف الاستخدام','قائمة المكونات المعلنة','الحجم الفعلي','بيانات البائع']},
  {re:/مطبخ|قهوة|طبخ|قلاية|خلاط|أجهزة منزلية|اجهزة منزلية/i,category:'المطبخ والأجهزة المنزلية',factors:['السعة','الأبعاد','سهولة التنظيف','الاستخدام المقصود','الضمان'],uses:['طبخ يومي','عائلة','استخدام متكرر','مطبخ محدود','هدية منزلية'],checks:['السعة الفعلية','الأبعاد قبل الشراء','تعليمات العناية','شروط الضمان']},
  {re:/أثاث|اثاث|ديكور|مفروش|إضاءة|اضاءة|تنظيم المنزل|تنظيف/i,category:'المنزل والديكور',factors:['الأبعاد','الخامة','اللون','سهولة الصيانة','ملاءمة المساحة'],uses:['غرفة صغيرة','منزل جديد','تنظيم المنزل','استخدام يومي','هدية منزلية'],checks:['قياس المساحة','تفاصيل الخامة','طريقة التجميع','سياسة الإرجاع']},
  {re:/بقالة|غذاء|طعام|مشروب/i,category:'البقالة',factors:['حجم العبوة','سعر الوحدة','التخزين','عدد القطع','وصف المنتج'],uses:['شراء أسبوعي','تخزين منزلي','عائلة','شخص واحد','شراء متكرر'],checks:['حجم العبوة','وحدة القياس','متطلبات التخزين','وصف المنتج']},
  {re:/طفل|أطفال|اطفال|مواليد|لعبة|العاب تعليم/i,category:'الأطفال والمواليد',factors:['الفئة العمرية المعلنة','المقاس','الخامة','سهولة الاستخدام','سياسة الإرجاع'],uses:['لعب يومي','تعلم','سفر','هدية','استخدام مشترك'],checks:['العمر المعلن','المقاسات','إرشادات الاستخدام','تفاصيل المنتج']},
  {re:/رياضة|لياقة|تخييم|دراج/i,category:'الرياضة واللياقة',factors:['المقاس','الوزن','الخامة','نوع الاستخدام','سهولة التخزين'],uses:['تمارين منزلية','نادي','مبتدئ','استخدام منتظم','سفر'],checks:['حدود الاستخدام المعلنة','الأبعاد','الخامة','متطلبات التخزين']},
  {re:/سفر|شنط سفر|حقيبة سفر/i,category:'السفر',factors:['الأبعاد','الوزن','السعة','الخامة','سهولة الحركة'],uses:['رحلة قصيرة','رحلة طويلة','طيران','عمل','عائلة'],checks:['الأبعاد المعلنة','الوزن الفارغ','العجلات أو المقابض','سياسة الضمان']},
  {re:/سيارة|سيارات|auto/i,category:'إكسسوارات السيارات',factors:['التوافق','المقاس','طريقة التركيب','الخامة','الضمان'],uses:['استخدام يومي','رحلة','تنظيم السيارة','حماية','هدية'],checks:['المقاس المتوافق','طريقة التثبيت','تفاصيل المنتج','سياسة الإرجاع']},
  {re:/مكتب|مدرسة|قرطاسية/i,category:'المكتب والدراسة',factors:['التوافق','الحجم','سهولة الاستخدام','الخامة','الضمان'],uses:['مكتب منزلي','دراسة','شركة صغيرة','تنقل','استخدام يومي'],checks:['التوافق مع احتياجك','الأبعاد','الخامة','الدعم والضمان']},
  {re:/حيوان|حيوانات أليفة|حيوانات اليفة/i,category:'مستلزمات الحيوانات الأليفة',factors:['المقاس','النوع المستهدف','الخامة','سهولة التنظيف','الكمية'],uses:['استخدام يومي','سفر','منزل صغير','شراء متكرر','هدية'],checks:['المقاس المناسب','نوع الحيوان المعلن','تعليمات الاستخدام','تفاصيل الخامة']}
];
const FALLBACK={category:'التسوق من نون',factors:['ملاءمة المنتج','السعر النهائي','البائع','الشحن','الإرجاع'],uses:['شراء عملي','مقارنة الخيارات','ميزانية محددة','طلب متكرر','شراء هدية'],checks:['وصف المنتج','بيانات البائع','رسوم الشحن','سياسة الإرجاع']};
const SCENARIOS=['قبل الدفع','مع الشحن','عند مقارنة البائعين','عند تغير السعر','مع ميزانية محددة','عند رفض الكود','مع سلة متعددة المنتجات','قبل مراجعة الإرجاع','بعد تثبيت المنتج','قبل تغيير طريقة الدفع','عند شراء أكثر من قطعة','قبل اختيار العرض النهائي'];
const CONTEXT_OPENERS=[
  'الفارق هنا لا يأتي من القسيمة وحدها؛ نقطة القياس الأساسية هي المنتج نفسه قبل أي محاولة خصم.',
  'هذه الصفحة تعالج القرار من زاوية السلة الفعلية، لذلك نثبت العناصر أولًا ثم نقيس أثر كل تغيير.',
  'لمنع المقارنات المضللة، نفصل بين قرار اختيار المنتج وقرار تجربة القسيمة ونوثق النتيجة في النهاية.',
  'القيمة العملية في هذا السيناريو هي تقليل المتغيرات: نفس المنتج، نفس البائع، ثم تغيير عامل واحد فقط.',
  'بدل مطاردة رقم خصم، نستخدم خطوات قابلة لإعادة الاختبار حتى تعرف هل الصفقة مناسبة أصلًا أم لا.',
  'هذه الزاوية مفيدة عندما تكون الخيارات كثيرة؛ نرتب المعايير ثم نختبر الكود بعد تضييق البدائل.'
];
const CONTEXT_CLOSERS=[
  'إذا لم تتحسن التكلفة النهائية أو وضوح الصفقة، فالنتيجة الصحيحة هي عدم توسيع السلة فقط من أجل الكوبون.',
  'أي اختلاف في الإصدار أو البائع يعيد المقارنة إلى نقطة الصفر لأننا لم نعد نقيس الصفقة نفسها.',
  'القرار النهائي يبقى مرتبطًا بالقيمة التي تحصل عليها، وليس برسالة قبول الكود وحدها.',
  'احتفظ بملاحظة قصيرة للإجمالي قبل وبعد التجربة؛ هذه أبسط طريقة لمنع الخلط بين تغير السعر وأثر الكود.',
  'إذا ظهرت رسالة أهلية مختلفة، اتبع شروط نون الحالية ولا تحاول استنتاج قاعدة عامة من حساب واحد.',
  'بهذا الأسلوب تصبح الصفحة أداة قرار وليست مجرد مكان لعرض كود.'
];

function h32(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function pick(a,n,off=0){return a[(n+off)%a.length]}
function inferIntent(text){if(/رفض|لا يعمل|مشكلة/.test(text))return ['trouble','حل مشكلة الكوبون'];if(/مقارن|سعر/.test(text))return ['compare','مقارنة عملية'];if(/كيف|طريقة|استخدام/.test(text))return ['howto','طريقة الاستخدام'];if(/بائع/.test(text))return ['seller','اختيار البائع'];if(/دليل|شراء/.test(text))return ['decision','دليل شراء'];if(/هل/.test(text))return ['question','إجابة عملية'];return ['coupon','كود خصم'];}
function inferGroup(text){return GROUPS.find(x=>x.re.test(text))||FALLBACK}
function market(country){return country==='AE'?{name:'الإمارات',currency:'الدرهم الإماراتي',currencyCode:'AED',path:'/uae'}:{name:'السعودية',currency:'الريال السعودي',currencyCode:'SAR',path:'/saudi-arabia'}}
function cleanKeyword(rec){return String(rec.primaryKeyword||rec.title||'').replace(/\s+/g,' ').trim().slice(0,180)}

export function buildLegacyTopic(rec,variant=0,pass=1){
  const text=(rec.primaryKeyword||'')+' '+(rec.title||'')+' '+(rec.slug||''),group=inferGroup(text),seed=h32((rec.slug||text)+'|'+variant+'|'+pass),m=market(rec.country),[intent,intentLabel]=inferIntent(text),kw=cleanKeyword(rec);
  return {country:rec.country==='AE'?'AE':'SA',market:m.name,currency:m.currency,currencyCode:m.currencyCode,marketPath:m.path,category:group.category,profileKey:'legacy',factors:group.factors,checks:group.checks,useCase:pick(group.uses,seed,variant+pass),factor:pick(group.factors,seed,variant*2+pass),scenario:pick(SCENARIOS,seed,variant*3+pass),code:String(rec.coupon||'').toUpperCase(),intent,intentLabel,kw,slug:rec.slug,topicIndex:seed,totalTopicSpace:0};
}

function differentiate(article,topic,rec,variant=0,pass=1){
  const seed=h32((rec.slug||topic.kw)+'|differentiate|'+variant+'|'+pass),f1=topic.factors[seed%topic.factors.length],f2=topic.factors[(seed+2)%topic.factors.length],f3=topic.factors[(seed+4)%topic.factors.length],c1=topic.checks[seed%topic.checks.length],c2=topic.checks[(seed+1)%topic.checks.length],open=pick(CONTEXT_OPENERS,seed,variant),close=pick(CONTEXT_CLOSERS,seed,pass+variant);
  const recovery=pass===RECOVERY_PASS?`<p class="legacy-recovery">في جولة الاسترداد نعامل «${topic.kw}» كقرار مستقل: نثبت سوق ${topic.market}، ونقارن ${topic.useCase} مع ${topic.factor} في سيناريو ${topic.scenario}، ثم نوثق سبب الاستبعاد أو القبول قبل تجربة الكود. الهدف هو أن تكون الصفحة مفيدة لهذا البحث تحديدًا لا نسخة من دليل عام.</p>`:'';
  const section=`<section class="legacy-specific" data-legacy-pass="${pass}"><h2>زاوية عملية خاصة بهذا القرار</h2><p>${open} في ${topic.category} نركز هنا على ${topic.useCase}، ونستخدم ${topic.factor} كعامل حسم أول بدل القفز مباشرة إلى السعر. هذا يجعل المقارنة مرتبطة باحتياج واضح ويقلل احتمال شراء خيار لا يناسب الاستخدام الفعلي.</p>${recovery}<p>طبّق اختبارًا من ثلاث طبقات: أولًا راجع ${f1} و${f2}، ثم تحقق من ${c1} و${c2}، وبعدها فقط قارن الإجمالي النهائي في ${topic.scenario}. لو تغيّر أحد هذه العناصر بين محاولتين، لا تعتبر فرق السعر ناتجًا عن القسيمة وحدها.</p><h3>قائمة تحقق مختصرة قبل الحسم</h3><ul><li>ثبت المنتج والبائع قبل تجربة الكود.</li><li>راجع ${f3} باعتباره عاملًا قد يغيّر قيمة الصفقة حتى لو كان السعر أقل.</li><li>دوّن الإجمالي قبل الكود وبعده ورسوم الشحن إن ظهرت.</li><li>لا تنقل نتيجة حساب أو سوق مختلف إلى هذه السلة.</li><li>إذا لم تتضح النتيجة، صغّر السلة ثم أعد إضافة العناصر تدريجيًا.</li></ul><p>${close}</p></section>`;
  article.html=String(article.html||'').replace(/<section class="methodology accountability">/i,section+'<section class="methodology accountability">');
  return article;
}

export function buildLegacyUpgradeCandidate(rec,{variant=0,pass=1,recent=[],cfg={}}={}){
  const code=String(rec.coupon||'').toUpperCase();if(!rec.slug||!['SA','AE'].includes(rec.country)||!ALLOWED_CODES.has(code)||!cleanKeyword(rec))return {ok:false,invalid:true,reason:'invalid_legacy_record'};
  const topic=buildLegacyTopic({...rec,coupon:code},variant,pass),cursor=h32(rec.slug)+variant*997+pass*7919,article=differentiate(buildUsefulArticle(topic,cursor),topic,rec,variant,pass);
  article.slug=rec.slug;article.primaryKeyword=cleanKeyword(rec);article.country=topic.country;article.coupon=code;
  const audit=auditSeoArticle(article,topic,{...cfg,minWords:Math.max(1500,Number(cfg.minWords||1500)),threshold:Math.max(95,Number(cfg.qualityThreshold||95)),recent:recent.filter(x=>x.slug!==rec.slug)});
  return {ok:audit.productionReady,topic,article,audit};
}

async function ctl(env,path,init){const id=env.CONTROL.idFromName('primary');return env.CONTROL.get(id).fetch('https://control.internal'+path,init)}
async function readState(env){return (await ctl(env,'/state')).json()}
async function readJson(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}
async function writeRecent(env,records){if(!records.length)return;const cur=await readJson(env,'legacy-upgrade/recent.json',{version:2,articles:[]}),seen=new Set(records.map(x=>x.slug)),articles=[...records.slice().reverse(),...(cur.articles||[]).filter(x=>!seen.has(x.slug))].slice(0,RECENT_LIMIT);await env.CONTENT_FINAL.put('legacy-upgrade/recent.json',JSON.stringify({version:2,updatedAt:now(),articles}),{httpMetadata:{contentType:'application/json; charset=utf-8'}})}

export async function runLegacyUpgradeBatchV2(env,cfg,status,{batchSize=4}={}){
  if(!env.CONTROL||!env.CONTENT_FINAL)return {ok:false,error:'legacy_upgrade_bindings_missing',patch:{legacyUpgradeLastError:'bindings_missing',legacyUpgradeLastRun:now()}};
  const st=await readState(env),all=(st.articles||[]).filter(a=>a.status==='published'),alreadyUpgraded=all.filter(a=>String(a.provider||'').startsWith('programmatic-cloudflare:v2-legacy-upgrade')).length,remainingBefore=all.filter(a=>!String(a.provider||'').startsWith('workers-ai:')&&!String(a.provider||'').startsWith('programmatic-cloudflare:v2-legacy-upgrade')).length;
  if(!remainingBefore)return {ok:true,skipped:'legacy_upgrade_complete',records:[],patch:{legacyUpgradeTotal:alreadyUpgraded,legacyUpgradeComplete:true,legacyUpgradeRemaining:0,legacyUpgradeLastRun:now(),legacyUpgradeLastError:null,legacyUpgradeNeedsConsolidation:false,legacyUpgradePausedForConsolidation:false,legacyUpgradeRecoveryActive:false}};
  const bulk=await readJson(env,'bulk/latest.json',{articles:[]}),oldRecent=await readJson(env,'legacy-upgrade/recent.json',{articles:[]}),recent=[...(oldRecent.articles||[]),...(bulk.articles||[])].slice(0,RECENT_LIMIT);
  const batch=Math.max(1,Math.min(6,Number(batchSize||4))),records=[],failures=[];let scanned=0,rejected=0,invalid=0,pass=Math.max(1,Number(status.legacyUpgradePassV2||1)),cursor=Math.max(0,Number(status.legacyUpgradeCursorV2||0));
  if(cursor>=all.length){
    if(pass>=MAX_PASSES)return {ok:true,skipped:'legacy_upgrade_consolidation_required',records:[],patch:{legacyUpgradeTotal:alreadyUpgraded,legacyUpgradeRemaining:remainingBefore,legacyUpgradeComplete:false,legacyUpgradeNeedsConsolidation:true,legacyUpgradePausedForConsolidation:true,legacyUpgradeRecoveryActive:false,legacyUpgradePassV2:pass,legacyUpgradeCursorV2:all.length,legacyUpgradeLastRun:now(),legacyUpgradeLastError:null}};
    cursor=0;pass++;
  }
  const variantLimit=pass===RECOVERY_PASS?18:12;
  while(cursor<all.length&&records.length<batch&&scanned<80){
    const rec=all[cursor++];scanned++;
    if(String(rec.provider||'').startsWith('workers-ai:')||String(rec.provider||'').startsWith('programmatic-cloudflare:v2-legacy-upgrade'))continue;
    let chosen=null,best=null;
    for(let variant=0;variant<variantLimit;variant++){
      const c=buildLegacyUpgradeCandidate(rec,{variant,pass,recent,cfg});
      if(c.invalid){invalid++;best=c;break}
      if(!best||c.audit.score>best.audit.score||(c.audit.score===best.audit.score&&c.audit.groupFloor>best.audit.groupFloor))best=c;
      if(c.ok){chosen=c;break}
    }
    if(!chosen){rejected++;if(best?.audit)failures.push({slug:rec.slug,score:best.audit.score,floor:best.audit.groupFloor,distance:best.audit.minSignatureDistance,p0:best.audit.p0,failed:best.audit.failed.slice(0,8)});continue}
    const {topic,article,audit}=chosen,updatedAt=now(),summary=auditSummary(audit),provider='programmatic-cloudflare:v2-legacy-upgrade';
    const next={...rec,title:article.title,metaDescription:article.metaDescription,country:topic.country,coupon:topic.code,status:'published',updatedAt,quality:audit.score,qualityGroups:audit.groups,qualityFloor:audit.groupFloor,qualityChecks:audit.measuredChecks,provider,primaryKeyword:article.primaryKeyword,wordCount:audit.wordCount,signature:audit.signature,blueprint:article.blueprint,contentPolicy:'helpful-quality-first',p0:[],auditSummary:summary,legacyUpgradedAt:updatedAt,legacyUpgradePass:pass};
    await env.CONTENT_FINAL.put('articles/'+rec.slug+'.html',String(article.html||''),{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{t:enc(next.title),m:enc(next.metaDescription),c:next.country,cp:next.coupon,q:String(next.quality),qf:String(next.qualityFloor),qc:String(next.qualityChecks),p:provider,kw:enc(next.primaryKeyword),sig:next.signature,bp:String(next.blueprint),at:rec.createdAt||updatedAt,updatedAt,status:'published'}});
    const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)});if(!r.ok)throw new Error('legacy_control_update_'+r.status);
    const compact={slug:next.slug,primaryKeyword:next.primaryKeyword,signature:next.signature,quality:next.quality,qualityFloor:next.qualityFloor,wordCount:next.wordCount,provider,blueprint:next.blueprint,updatedAt};records.push(compact);recent.unshift(compact);if(recent.length>RECENT_LIMIT)recent.pop();
  }
  await writeRecent(env,records);
  let nextCursor=cursor,nextPass=pass,passFinished=cursor>=all.length,remaining=Math.max(0,remainingBefore-records.length),needsConsolidation=false,pausedForConsolidation=false;
  if(passFinished&&remaining>0){if(pass<MAX_PASSES){nextCursor=0;nextPass=pass+1}else{needsConsolidation=true;pausedForConsolidation=true;nextCursor=all.length}}
  const previousFailures=Array.isArray(status.legacyUpgradeFailureSamples)?status.legacyUpgradeFailureSamples:[],failureSamples=[...failures,...previousFailures].slice(0,12),upgradedTotal=alreadyUpgraded+records.length,last=records.at(-1)||null;
  return {ok:true,records,scanned,rejected,invalid,pass,passFinished,failures,patch:{legacyUpgradeTotal:upgradedTotal,legacyUpgradeRemaining:remaining,legacyUpgradeComplete:remaining===0,legacyUpgradeNeedsConsolidation:needsConsolidation,legacyUpgradePausedForConsolidation:pausedForConsolidation,legacyUpgradeRecoveryActive:pass===RECOVERY_PASS&&remaining>0&&!pausedForConsolidation,legacyUpgradePassV2:nextPass,legacyUpgradeCursorV2:nextCursor,legacyUpgradeLastRun:now(),legacyUpgradeLastError:records.length?'':(remaining&&!pausedForConsolidation?'no_legacy_article_passed':null),legacyUpgradeLastSlug:last?.slug||status.legacyUpgradeLastSlug||null,legacyUpgradeLastQuality:last?.quality??status.legacyUpgradeLastQuality??null,legacyUpgradeLastQualityFloor:last?.qualityFloor??status.legacyUpgradeLastQualityFloor??null,legacyUpgradeLastWordCount:last?.wordCount??status.legacyUpgradeLastWordCount??null,legacyUpgradeRejected:Number(status.legacyUpgradeRejected||0)+rejected,legacyUpgradeInvalid:Number(status.legacyUpgradeInvalid||0)+invalid,legacyUpgradeFailureSamples:failureSamples}};
}
