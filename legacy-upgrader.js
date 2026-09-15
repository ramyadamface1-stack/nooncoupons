import {buildUsefulArticle} from './bulk-content-engine.js';
import {auditSeoArticle,auditSummary} from './quality-audit.js';

const now=()=>new Date().toISOString();
const enc=s=>encodeURIComponent(String(s||'')).slice(0,1800);
const ALLOWED_CODES=new Set(['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161']);
const RECENT_LIMIT=160;

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
const SCENARIOS=['قبل الدفع','مع الشحن','عند مقارنة البائعين','عند تغير السعر','مع ميزانية محددة','عند رفض الكود','مع سلة متعددة المنتجات','قبل مراجعة الإرجاع'];

function h32(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function pick(a,n,off=0){return a[(n+off)%a.length]}
function inferIntent(text){if(/رفض|لا يعمل|مشكلة/.test(text))return ['trouble','حل مشكلة الكوبون'];if(/مقارن|سعر/.test(text))return ['compare','مقارنة عملية'];if(/كيف|طريقة|استخدام/.test(text))return ['howto','طريقة الاستخدام'];if(/بائع/.test(text))return ['seller','اختيار البائع'];if(/دليل|شراء/.test(text))return ['decision','دليل شراء'];if(/هل/.test(text))return ['question','إجابة عملية'];return ['coupon','كود خصم'];}
function inferGroup(text){return GROUPS.find(x=>x.re.test(text))||FALLBACK}
function market(country){return country==='AE'?{name:'الإمارات',currency:'الدرهم الإماراتي',currencyCode:'AED',path:'/uae'}:{name:'السعودية',currency:'الريال السعودي',currencyCode:'SAR',path:'/saudi-arabia'}}
function cleanKeyword(rec){return String(rec.primaryKeyword||rec.title||'').replace(/\s+/g,' ').trim().slice(0,180)}

function legacyTopic(rec,variant=0){
  const text=(rec.primaryKeyword||'')+' '+(rec.title||'')+' '+(rec.slug||''),group=inferGroup(text),seed=h32((rec.slug||text)+'|'+variant),m=market(rec.country),[intent,intentLabel]=inferIntent(text),kw=cleanKeyword(rec);
  return {country:rec.country==='AE'?'AE':'SA',market:m.name,currency:m.currency,currencyCode:m.currencyCode,marketPath:m.path,category:group.category,profileKey:'legacy',factors:group.factors,checks:group.checks,useCase:pick(group.uses,seed,variant),factor:pick(group.factors,seed,variant*2+1),scenario:pick(SCENARIOS,seed,variant*3+2),code:String(rec.coupon||'').toUpperCase(),intent,intentLabel,kw,slug:rec.slug,topicIndex:seed,totalTopicSpace:0};
}

async function ctl(env,path,init){const id=env.CONTROL.idFromName('primary');return env.CONTROL.get(id).fetch('https://control.internal'+path,init)}
async function readState(env){return (await ctl(env,'/state')).json()}
async function readJson(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}
async function writeRecent(env,records){if(!records.length)return;const cur=await readJson(env,'legacy-upgrade/recent.json',{version:1,articles:[]}),seen=new Set(records.map(x=>x.slug)),articles=[...records.slice().reverse(),...(cur.articles||[]).filter(x=>!seen.has(x.slug))].slice(0,RECENT_LIMIT);await env.CONTENT_FINAL.put('legacy-upgrade/recent.json',JSON.stringify({version:1,updatedAt:now(),articles}),{httpMetadata:{contentType:'application/json; charset=utf-8'}})}

export async function runLegacyUpgradeBatch(env,cfg,status,{batchSize=4}={}){
  if(!env.CONTROL||!env.CONTENT_FINAL)return {ok:false,error:'legacy_upgrade_bindings_missing',patch:{legacyUpgradeLastError:'bindings_missing',legacyUpgradeLastRun:now()}};
  const st=await readState(env),all=(st.articles||[]).filter(a=>a.status==='published'),eligible=all.filter(a=>!String(a.provider||'').startsWith('workers-ai:')&&!String(a.provider||'').startsWith('programmatic-cloudflare:v2-legacy-upgrade'));
  if(!eligible.length)return {ok:true,skipped:'legacy_upgrade_complete',records:[],patch:{legacyUpgradeComplete:true,legacyUpgradeRemaining:0,legacyUpgradeLastRun:now(),legacyUpgradeLastError:null}};
  const bulk=await readJson(env,'bulk/latest.json',{articles:[]}),oldRecent=await readJson(env,'legacy-upgrade/recent.json',{articles:[]}),recent=[...(oldRecent.articles||[]),...(bulk.articles||[])].slice(0,RECENT_LIMIT);
  const batch=Math.max(1,Math.min(6,Number(batchSize||4))),records=[];let scanned=0,rejected=0,invalid=0;
  for(const rec of eligible){
    if(records.length>=batch||scanned>=batch*12)break;scanned++;
    const code=String(rec.coupon||'').toUpperCase();if(!rec.slug||!['SA','AE'].includes(rec.country)||!ALLOWED_CODES.has(code)||!cleanKeyword(rec)){invalid++;continue}
    let chosen=null;
    for(let variant=0;variant<5;variant++){
      const topic=legacyTopic({...rec,coupon:code},variant),article=buildUsefulArticle(topic,h32(rec.slug)+variant);
      article.slug=rec.slug;article.primaryKeyword=cleanKeyword(rec);article.country=topic.country;article.coupon=code;
      const audit=auditSeoArticle(article,topic,{...cfg,minWords:Math.max(1000,Number(cfg.minWords||1000)),threshold:Math.max(95,Number(cfg.qualityThreshold||95)),recent:recent.filter(x=>x.slug!==rec.slug)});
      if(audit.productionReady){chosen={topic,article,audit};break}
    }
    if(!chosen){rejected++;continue}
    const {topic,article,audit}=chosen,updatedAt=now(),summary=auditSummary(audit),provider='programmatic-cloudflare:v2-legacy-upgrade';
    const next={...rec,title:article.title,metaDescription:article.metaDescription,country:topic.country,coupon:code,status:'published',updatedAt,quality:audit.score,qualityGroups:audit.groups,qualityFloor:audit.groupFloor,qualityChecks:audit.measuredChecks,provider,primaryKeyword:article.primaryKeyword,wordCount:audit.wordCount,signature:audit.signature,blueprint:article.blueprint,contentPolicy:'helpful-quality-first',p0:[],auditSummary:summary,legacyUpgradedAt:updatedAt};
    await env.CONTENT_FINAL.put('articles/'+rec.slug+'.html',String(article.html||''),{httpMetadata:{contentType:'text/html; charset=utf-8'},customMetadata:{t:enc(next.title),m:enc(next.metaDescription),c:next.country,cp:next.coupon,q:String(next.quality),qf:String(next.qualityFloor),qc:String(next.qualityChecks),p:provider,kw:enc(next.primaryKeyword),sig:next.signature,bp:String(next.blueprint),at:rec.createdAt||updatedAt,updatedAt,status:'published'}});
    const r=await ctl(env,'/article',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)});if(!r.ok)throw new Error('legacy_control_update_'+r.status);
    const compact={slug:next.slug,primaryKeyword:next.primaryKeyword,signature:next.signature,quality:next.quality,qualityFloor:next.qualityFloor,wordCount:next.wordCount,provider,updatedAt};records.push(compact);recent.unshift(compact);if(recent.length>RECENT_LIMIT)recent.pop();
  }
  await writeRecent(env,records);
  const upgradedTotal=Math.max(0,Number(status.legacyUpgradeTotal||0))+records.length,remaining=Math.max(0,eligible.length-records.length),last=records.at(-1)||null;
  return {ok:true,records,scanned,rejected,invalid,patch:{legacyUpgradeTotal:upgradedTotal,legacyUpgradeRemaining:remaining,legacyUpgradeComplete:remaining===0,legacyUpgradeLastRun:now(),legacyUpgradeLastError:records.length?'':(eligible.length?'no_legacy_article_passed':null),legacyUpgradeLastSlug:last?.slug||status.legacyUpgradeLastSlug||null,legacyUpgradeLastQuality:last?.quality??status.legacyUpgradeLastQuality??null,legacyUpgradeLastQualityFloor:last?.qualityFloor??status.legacyUpgradeLastQualityFloor??null,legacyUpgradeLastWordCount:last?.wordCount??status.legacyUpgradeLastWordCount??null,legacyUpgradeRejected:Number(status.legacyUpgradeRejected||0)+rejected,legacyUpgradeInvalid:Number(status.legacyUpgradeInvalid||0)+invalid}};
}
