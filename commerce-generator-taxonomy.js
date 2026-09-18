import {MARKETS,CATEGORIES,BRANDS,COMPARISONS,marketKey,categoryKeyForArticle,articleCommerceLinks} from './commerce-taxonomy.js';

const hash=s=>{let n=2166136261;for(const c of String(s||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=(xs)=>[...new Set((xs||[]).filter(Boolean))];
const moneyLinks=(market)=>{const base=market==='uae'?'/uae':'/saudi-arabia',country=market==='uae'?'الإمارات':'السعودية';return [
 {path:base+'/noon-coupon-code',label:'كود خصم نون '+country},
 {path:base+'/noon-coupon-code-today',label:'أكواد نون '+country+' اليوم'},
 {path:base+'/noon-coupon-code-2026',label:'أكواد نون '+country+' 2026'}
]};

const CATEGORY_MODEL_KEYS={
  apple:{mobiles:['iphone','iphone-pro','iphone-plus-pro-max'],tablets:['ipad'],laptops:['macbook'],audio:['airpods']},
  samsung:{mobiles:['galaxy-s','galaxy-a','galaxy-z'],tablets:['galaxy-tab']},
  xiaomi:{mobiles:['xiaomi','redmi-note','poco'],tablets:['xiaomi'],electronics:['xiaomi']},
  oppo:{mobiles:['reno','find','a-series']},
  honor:{mobiles:['magic','x-series','number-series'],tablets:['magic']},
  huawei:{mobiles:['mate','pura','nova'],tablets:['mate'],laptops:['matebook']},
  motorola:{mobiles:['edge','moto-g','razr']},
  vivo:{mobiles:['x-series','v-series','y-series']},
  sony:{gaming:['playstation'],tvs:['bravia'],audio:['headphones']},
  lg:{tvs:['oled'],appliances:['home-appliances']},
  hp:{laptops:['pavilion','victus'],computers:['printers']},
  lenovo:{laptops:['ideapad','thinkpad','legion'],computers:['ideapad','thinkpad'],gaming:['legion']},
  asus:{laptops:['vivobook','zenbook','rog'],computers:['vivobook','zenbook'],gaming:['rog']},
  acer:{laptops:['aspire','nitro','predator'],gaming:['nitro','predator']},
  dell:{laptops:['inspiron','latitude','alienware'],computers:['inspiron','latitude']},
  logitech:{computers:['mx-series','g-series'],gaming:['g-series']},
  jbl:{audio:['flip','charge','tune'],electronics:['flip','charge','tune']},
  dyson:{appliances:['vacuum'],beauty:['airwrap'],'home-kitchen':['vacuum','air']},
  philips:{appliances:['air-fryer'],beauty:['grooming'],'home-kitchen':['air-fryer','coffee']},
  braun:{beauty:['grooming','silkepil']},
  nike:{shoes:['running','lifestyle','training'],sports:['running','training'],'men-fashion':['lifestyle'],'women-fashion':['lifestyle']},
  adidas:{shoes:['running','originals','football'],sports:['running','football'],'men-fashion':['originals'],'women-fashion':['originals']},
  puma:{shoes:['running','lifestyle'],sports:['running'],'men-fashion':['lifestyle'],'women-fashion':['lifestyle']},
  skechers:{shoes:['walking','running'],sports:['walking','running']},
  americanTourister:{bags:['backpacks','luggage'],travel:['luggage']},
  samsonite:{bags:['business','luggage'],travel:['luggage']},
  pampers:{'baby-kids':['diapers','pants']},
  lego:{'baby-kids':['classic','technic']},
  nivea:{beauty:['skincare','body']},
  loreal:{beauty:['hair','makeup','skincare']}
};

function seedFor(topic,seed){const n=Number(seed);return Number.isFinite(n)?Math.abs(Math.trunc(n)):hash([topic?.kw,topic?.title,topic?.category,topic?.country].join('|'))}
function deepestPath(meta){if(meta.comparisonKey)return `/${meta.market}/compare/${meta.comparisonKey}`;if(meta.brandKey&&meta.modelKey)return `/${meta.market}/model/${meta.brandKey}/${meta.modelKey}`;if(meta.brandKey)return `/${meta.market}/brand/${meta.brandKey}`;return `/${meta.market}/category/${meta.categoryKey}`}
function modelKeysFor(brandKey,categoryKey){const all=Object.keys(BRANDS[brandKey]?.models||{}),mapped=CATEGORY_MODEL_KEYS[brandKey]?.[categoryKey];if(Array.isArray(mapped))return mapped.filter(k=>all.includes(k));const categories=BRANDS[brandKey]?.categories||[];return categories.length===1?all:[]}
const PRIORITY_BRANDS={
 mobiles:['apple','samsung','xiaomi','oppo','honor','huawei'],
 laptops:['apple','lenovo','asus','hp','dell','acer'],
 tablets:['apple','samsung','xiaomi','huawei'],
 gaming:['sony','lenovo','asus','acer'],
 tvs:['samsung','lg','sony'],
 appliances:['dyson','philips','lg'],
 shoes:['nike','adidas','skechers','puma'],
 bags:['samsonite','americanTourister'],
 beauty:['dyson','philips','braun','nivea','loreal']
};
function weightedBrands(categoryKey,brandKeys){
 const preferred=(PRIORITY_BRANDS[categoryKey]||[]).filter(k=>brandKeys.includes(k));
 return preferred.length?[...preferred,...preferred,...brandKeys]:brandKeys;
}

function brandCategoryLabel(brandKey,categoryKey){const brand=BRANDS[brandKey]?.label||brandKey,category=CATEGORIES[categoryKey]?.label||categoryKey;return `${brand} ${category}`.trim()}
function catalogTargetKeys(topic,categoryKey){
  const brandKey=topic?.catalogBrandKey&&BRANDS[topic.catalogBrandKey]?.categories?.includes(categoryKey)?topic.catalogBrandKey:null;
  const allowedModels=brandKey?modelKeysFor(brandKey,categoryKey):[];
  const modelKey=brandKey&&topic?.catalogModelKey&&allowedModels.includes(topic.catalogModelKey)?topic.catalogModelKey:null;
  return {brandKey,modelKey};
}

export function boundedCoverageCorrection(seed,underTarget=[]){
 const n=Math.abs(Number(seed)||0),u=new Set(Array.isArray(underTarget)?underTarget:[]);
 if(u.has('category')&&n%11===0)return 'category';
 if(u.has('brand')&&n%13===0)return 'brand';
 if(u.has('model')&&n%17===0)return 'model';
 if(u.has('comparison')&&n%19===0)return 'comparison';
 return '';
}

export function applyCommerceTarget(topic={},seed,coverageSignal={}){
  const n=seedFor(topic,seed),market=marketKey(topic.country),categoryKey=categoryKeyForArticle({category:topic.category,categoryKey:topic.categoryKey});
  let brandKey=null,modelKey=null,comparisonKey=null,targetLabel=CATEGORIES[categoryKey]?.label||topic.category||'';
  const kw=String(topic.kw||''),title=String(topic.title||topic.kw||'');
  const eligibleBrands=Object.keys(BRANDS).filter(k=>BRANDS[k].categories?.includes(categoryKey)),brandKeys=weightedBrands(categoryKey,eligibleBrands),comparisonKeys=Object.keys(COMPARISONS),correction=boundedCoverageCorrection(n,coverageSignal?.underTarget),comparisonMode=categoryKey==='mobiles'&&(n%6===0||correction==='comparison'),categoryOnlyMode=n%7===0||correction==='category',brandOnlyMode=n%5===0||correction==='brand',modelBoost=correction==='model';
  const catalogKeys=catalogTargetKeys(topic,categoryKey),catalogSpecific=['brand','model','product-intent'].includes(String(topic.catalogLevel||''))&&catalogKeys.brandKey;
  if(catalogSpecific){
    brandKey=catalogKeys.brandKey;modelKey=catalogKeys.modelKey;
    targetLabel=String(topic.catalogTarget||'').trim()||(modelKey?`${BRANDS[brandKey].label} ${BRANDS[brandKey].models[modelKey].label}`:brandCategoryLabel(brandKey,categoryKey));
  }else if(categoryOnlyMode){
    targetLabel=CATEGORIES[categoryKey]?.label||topic.category||'';
  }else if(comparisonMode){
    comparisonKey=comparisonKeys[Math.floor(n/9)%comparisonKeys.length];
    const cmp=COMPARISONS[comparisonKey];brandKey=cmp.a;
    const models=modelKeysFor(brandKey,'mobiles');if(models.length)modelKey=models[Math.floor(n/3)%models.length];
    targetLabel=cmp.title;
  }else if(brandKeys.length){
    brandKey=brandKeys[n%brandKeys.length];
    const models=modelKeysFor(brandKey,categoryKey);if(models.length&&!brandOnlyMode)modelKey=models[Math.floor(n/Math.max(1,brandKeys.length))%models.length];if(modelBoost&&models.length)modelKey=models[n%models.length];
    targetLabel=modelKey?`${BRANDS[brandKey].label} ${BRANDS[brandKey].models[modelKey].label}`:brandCategoryLabel(brandKey,categoryKey);
  }
  const meta={market,categoryKey,brandKey,modelKey,comparisonKey};
  const landingPath=deepestPath(meta),commerceLinks=[...articleCommerceLinks({...topic,...meta,title,primaryKeyword:kw}),...moneyLinks(market)];
  return {...topic,kw,title,topicIndex:topic.topicIndex??n,...meta,landingPath,targetLabel,commerceTarget:targetLabel,commercePrompt:`اربط الدليل تجاريًا بموضوع ${targetLabel} داخل ${CATEGORIES[categoryKey]?.label||topic.category||''} دون تغيير نية البحث الأساسية أو حشو الكلمة المفتاحية.`,commerceLinks};
}

export function commerceCoverageTarget(categoryKey){
  const priority=Object.prototype.hasOwnProperty.call(PRIORITY_BRANDS,categoryKey);
  return priority
    ? {categoryDirectMin:12,brandDirectMin:16,modelDirectMin:28,comparisonDirectMin:categoryKey==='mobiles'?10:0}
    : {categoryDirectMin:12,brandDirectMin:10,modelDirectMin:12,comparisonDirectMin:0};
}

export function commerceRecordFields(topic={}){
  const t=applyCommerceTarget(topic,topic.topicIndex);
  return {market:t.market,categoryKey:t.categoryKey,brandKey:t.brandKey,modelKey:t.modelKey,comparisonKey:t.comparisonKey,landingPath:t.landingPath,commerceTarget:t.targetLabel,commerceTaxonomyVersion:COMMERCE_GENERATOR_INFO.version};
}

export function decorateArticleCommerce(article={},topic={}){
  const t=applyCommerceTarget(topic,topic.topicIndex),fields=commerceRecordFields(t),links=uniq((t.commerceLinks||[]).map(x=>x?.path)).map(path=>{const item=(t.commerceLinks||[]).find(x=>x.path===path);return {path,label:item?.label||path}});
  let html=String(article.html||'');
  if(html&&!html.includes('id="generated-commerce-links"')){
    const target=t.targetLabel||CATEGORIES[fields.categoryKey]?.label||topic.category||'';
    const category=CATEGORIES[fields.categoryKey]?.label||topic.category||'';
    const context=`<section id="generated-commerce-context" data-commerce-target="${esc(target)}"><h2>مسار شراء مرتبط: ${esc(target)}</h2><p>يرتبط هذا الدليل بصفحة ${esc(target)} داخل ${esc(category)} لأن الهدف هو الانتقال من نية البحث الحالية إلى أقرب قسم أو براند أو عائلة منتج بدون تغيير معنى الكلمة الأساسية. راجع النسخة والبائع والضمان والسعر النهائي على نون قبل الشراء.</p><p>استخدم الروابط التالية لاستكمال المقارنة، ثم ارجع إلى السلة الحية لاختبار الكود على نفس المنتج ونفس البائع. وجود هذا الربط لا يعني أن كل منتج من البراند أو العائلة مناسب لنفس الاستخدام؛ هو مسار تنظيمي للوصول إلى محتوى أكثر تحديدًا.</p></section>`;
    const nav=`<nav id="generated-commerce-links" data-category-key="${esc(fields.categoryKey)}" data-brand-key="${esc(fields.brandKey||'')}" data-model-key="${esc(fields.modelKey||'')}" data-comparison-key="${esc(fields.comparisonKey||'')}" data-landing-path="${esc(fields.landingPath)}" aria-label="مسار الشراء المرتبط"><strong class="generated-commerce-links-title">استكمل قرار الشراء</strong><ul>${links.map(x=>`<li><a href="${esc(x.path)}">${esc(x.label)}</a></li>`).join('')}</ul></nav>`;
    const block=context+nav;
    html=/<\/article>/i.test(html)?html.replace(/<\/article>/i,block+'</article>'):html+block;
  }
  return {...article,...fields,commerceTarget:t.targetLabel,html};
}

export const COMMERCE_GENERATOR_INFO={version:7,mode:'explicit-generator-taxonomy',metadata:['categoryKey','brandKey','modelKey','comparisonKey','landingPath'],categoryRoutes:Object.keys(CATEGORIES).length,brandRoutes:Object.keys(BRANDS).length,modelRoutes:Object.values(BRANDS).reduce((n,b)=>n+Object.keys(b.models).length,0),comparisonRoutes:Object.keys(COMPARISONS).length,markets:Object.keys(MARKETS).length,brandModelTargeting:'catalog-intent-preserving-category-aware',primaryKeywordMutation:false,internalLinks:true,moneyHubLinks:true,priorityBrandWeighting:true,comparisonCadence:'1-in-6-mobile',categoryOnlyCadence:'1-in-7',brandOnlyCadence:'1-in-5',coverageTargets:'category-aware',adaptiveCorrection:'bounded-only',adaptiveCadence:'11/13/17/19'};
