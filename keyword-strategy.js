const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();

const SCENARIO_MAP={
  'قبل الدفع':'قبل الدفع',
  'وقت العروض':'وقت العروض',
  'مع الشحن':'مع تكلفة الشحن',
  'قبل اختيار البائع':'قبل اختيار البائع',
  'عند مقارنة الأسعار':'عند مقارنة الأسعار',
  'بدون شراء زائد':'بدون شراء غير ضروري',
  'عند رفض الكود':'عند رفض الكود',
  'مع سلة كبيرة':'مع سلة كبيرة',
  'للطلب الأول':'للطلب الأول',
  'لحساب حالي':'للحساب الحالي',
  'قبل تغيير طريقة الدفع':'قبل تغيير طريقة الدفع',
  'قبل الإرجاع':'قبل الإرجاع',
  'مع مراجعة الضمان':'مع مراجعة الضمان',
  'عند شراء عدة قطع':'عند شراء عدة قطع',
  'من الهاتف':'من تطبيق الهاتف',
  'من المتصفح':'من المتصفح',
  'عند تغير السعر':'عند تغير السعر',
  'مع ميزانية محددة':'بميزانية محددة',
  'مع أكثر من بائع':'مع أكثر من بائع',
  'بعد إضافة رسوم الشحن':'بعد إضافة رسوم الشحن'
};

function scenario(t){return SCENARIO_MAP[t.scenario]||clean(t.scenario)}
function use(t){return clean(t.useCase)}
function market(t){return clean(t.market)}
function cat(t){return clean(t.category)}
function factor(t){return clean(t.factor)}

const BUILDERS={
  coupon:t=>`كود خصم نون ${market(t)} على ${cat(t)} ${scenario(t)}`,
  howto:t=>`طريقة استخدام كود خصم نون ${market(t)} عند شراء ${cat(t)} ${scenario(t)}`,
  compare:t=>`كيف أقارن سعر ${cat(t)} على نون ${market(t)} ${scenario(t)}`,
  trouble:t=>`كود نون لا يعمل على ${cat(t)} في ${market(t)} ${scenario(t)}`,
  question:t=>`هل كود خصم نون يعمل على ${cat(t)} في ${market(t)} ${scenario(t)}`,
  seller:t=>`كيف أختار بائع ${cat(t)} على نون ${market(t)} ${scenario(t)}`,
  decision:t=>`دليل شراء ${cat(t)} من نون ${market(t)} لـ${use(t)} ${scenario(t)}`,
  finalprice:t=>`كيف أحسب السعر النهائي لـ${cat(t)} على نون ${market(t)} ${scenario(t)}`,
  value:t=>`كيف أوفر عند شراء ${cat(t)} من نون ${market(t)} ${scenario(t)}`,
  cart:t=>`مراجعة سلة ${cat(t)} على نون ${market(t)} ${scenario(t)}`,
  timing:t=>`متى أستخدم كود نون عند شراء ${cat(t)} في ${market(t)} ${scenario(t)}`,
  smartbuy:t=>`نصائح شراء ${cat(t)} من نون ${market(t)} لـ${use(t)} ${scenario(t)}`,
  eligibility:t=>`شروط استخدام كود نون على ${cat(t)} في ${market(t)} ${scenario(t)}`,
  checklist:t=>`قائمة فحص قبل شراء ${cat(t)} من نون ${market(t)} ${scenario(t)}`,
  multi:t=>`استخدام كود نون عند شراء عدة منتجات من ${cat(t)} في ${market(t)} ${scenario(t)}`,
  returns:t=>`الإرجاع والكوبون عند شراء ${cat(t)} من نون ${market(t)} ${scenario(t)}`,
  warranty:t=>`الضمان والكوبون عند شراء ${cat(t)} من نون ${market(t)} ${scenario(t)}`,
  budget:t=>`شراء ${cat(t)} من نون ${market(t)} بميزانية محددة مع مراجعة ${factor(t)}`
};

function naturalTitle(kw,t){
  if(kw.length<=68)return kw;
  const shortMap={
    coupon:`كود خصم نون ${market(t)} على ${cat(t)}`,
    howto:`استخدام كود خصم نون ${market(t)} لشراء ${cat(t)}`,
    compare:`مقارنة سعر ${cat(t)} على نون ${market(t)}`,
    trouble:`حل مشكلة كود نون مع ${cat(t)} في ${market(t)}`,
    question:`هل كود نون يعمل على ${cat(t)} في ${market(t)}؟`,
    seller:`اختيار بائع ${cat(t)} على نون ${market(t)}`,
    decision:`دليل شراء ${cat(t)} من نون ${market(t)}`,
    finalprice:`حساب السعر النهائي لـ${cat(t)} على نون ${market(t)}`,
    value:`التوفير عند شراء ${cat(t)} من نون ${market(t)}`,
    cart:`مراجعة سلة ${cat(t)} على نون ${market(t)}`,
    timing:`متى تستخدم كود نون مع ${cat(t)} في ${market(t)}؟`,
    smartbuy:`شراء ${cat(t)} من نون ${market(t)} بذكاء`,
    eligibility:`شروط كود نون على ${cat(t)} في ${market(t)}`,
    checklist:`قبل شراء ${cat(t)} من نون ${market(t)}: قائمة فحص`,
    multi:`شراء عدة منتجات من ${cat(t)} على نون ${market(t)}`,
    returns:`الإرجاع والكوبون عند شراء ${cat(t)} من نون ${market(t)}`,
    warranty:`الضمان والكوبون عند شراء ${cat(t)} من نون ${market(t)}`,
    budget:`شراء ${cat(t)} من نون ${market(t)} بميزانية محددة`
  };
  return clean(shortMap[t.intent]||kw).slice(0,68);
}

export function applyKeywordStrategy(topic){
  const builder=BUILDERS[topic.intent]||BUILDERS.decision;
  const kw=clean(builder(topic));
  const slug=slugify(kw);
  const title=naturalTitle(kw,topic);
  const words=kw.split(/\s+/).filter(Boolean).length;
  return {...topic,kw,slug,title,keywordStrategy:'search-intent-v1',keywordWordCount:words,searchIntentFamily:topic.intent};
}

export const KEYWORD_STRATEGY_INFO={
  version:'search-intent-v1',
  philosophy:'natural-query-first',
  markets:['SA','AE'],
  intents:Object.keys(BUILDERS),
  avoids:['keyword-stuffing','coupon-claim-invention','country-leakage'],
  maxRecommendedWords:16
};
