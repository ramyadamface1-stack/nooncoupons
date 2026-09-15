import {MARKETS,CATEGORIES,BRANDS,COMPARISONS,marketKey,categoryKeyForArticle,articleCommerceLinks} from './commerce-taxonomy.js';

const hash=s=>{let n=2166136261;for(const c of String(s||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=(xs)=>[...new Set((xs||[]).filter(Boolean))];

const CATEGORY_MODEL_KEYS={
  apple:{mobiles:['iphone','iphone-pro','iphone-plus-pro-max'],electronics:['ipad'],computers:['macbook'],audio:['airpods']},
  samsung:{mobiles:['galaxy-s','galaxy-a','galaxy-z'],electronics:['galaxy-tab']},
  xiaomi:{mobiles:['xiaomi','redmi-note','poco'],electronics:['xiaomi']},
  oppo:{mobiles:['reno','find','a-series']},
  honor:{mobiles:['magic','x-series','number-series']},
  huawei:{mobiles:['mate','pura','nova'],computers:['matebook']},
  motorola:{mobiles:['edge','moto-g','razr']},
  vivo:{mobiles:['x-series','v-series','y-series']},
  sony:{gaming:['playstation'],electronics:['bravia'],audio:['headphones']},
  lg:{electronics:['oled'],appliances:['home-appliances']},
  hp:{computers:['pavilion','victus','printers'],electronics:['printers']},
  lenovo:{computers:['ideapad','thinkpad','legion'],gaming:['legion']},
  asus:{computers:['vivobook','zenbook','rog'],gaming:['rog']},
  acer:{computers:['aspire','nitro','predator'],gaming:['nitro','predator']},
  dell:{computers:['inspiron','latitude','alienware']},
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
function suffixOnce(text,suffix){const s=String(text||'').trim(),x=String(suffix||'').trim();return !x||s.toLowerCase().includes(x.toLowerCase())?s:`${s} ${x}`.trim()}
function modelKeysFor(brandKey,categoryKey){const all=Object.keys(BRANDS[brandKey]?.models||{}),mapped=CATEGORY_MODEL_KEYS[brandKey]?.[categoryKey];if(Array.isArray(mapped))return mapped.filter(k=>all.includes(k));const categories=BRANDS[brandKey]?.categories||[];return categories.length===1?all:[]}

export function applyCommerceTarget(topic={},seed){
  const n=seedFor(topic,seed),market=marketKey(topic.country),categoryKey=categoryKeyForArticle({category:topic.category,categoryKey:topic.categoryKey});
  let brandKey=null,modelKey=null,comparisonKey=null,targetLabel=CATEGORIES[categoryKey]?.label||topic.category||'';
  let kw=String(topic.kw||''),title=String(topic.title||topic.kw||'');
  {
    const brandKeys=Object.keys(BRANDS).filter(k=>BRANDS[k].categories?.includes(categoryKey)),comparisonKeys=Object.keys(COMPARISONS),comparisonMode=categoryKey==='mobiles'&&n%9===0;
    if(comparisonMode){
      comparisonKey=comparisonKeys[Math.floor(n/9)%comparisonKeys.length];
      const cmp=COMPARISONS[comparisonKey];brandKey=cmp.a;
      const models=modelKeysFor(brandKey,'mobiles');if(models.length)modelKey=models[Math.floor(n/3)%models.length];
      targetLabel=cmp.title;kw=suffixOnce(kw,cmp.title);title=suffixOnce(title,cmp.title);
    }else if(brandKeys.length){
      brandKey=brandKeys[n%brandKeys.length];
      const models=modelKeysFor(brandKey,categoryKey);if(models.length)modelKey=models[Math.floor(n/Math.max(1,brandKeys.length))%models.length];
      targetLabel=modelKey?`${BRANDS[brandKey].label} ${BRANDS[brandKey].models[modelKey].label}`:BRANDS[brandKey].label;
      kw=suffixOnce(kw,targetLabel);title=suffixOnce(title,targetLabel);
    }
  }
  const meta={market,categoryKey,brandKey,modelKey,comparisonKey};
  const landingPath=deepestPath(meta),commerceLinks=articleCommerceLinks({...topic,...meta,title,primaryKeyword:kw});
  return {...topic,kw,title,topicIndex:topic.topicIndex??n,...meta,landingPath,targetLabel,commerceLinks};
}

export function commerceRecordFields(topic={}){
  const t=applyCommerceTarget(topic,topic.topicIndex);
  return {market:t.market,categoryKey:t.categoryKey,brandKey:t.brandKey,modelKey:t.modelKey,comparisonKey:t.comparisonKey,landingPath:t.landingPath,commerceTarget:t.targetLabel,commerceTaxonomyVersion:COMMERCE_GENERATOR_INFO.version};
}

export function decorateArticleCommerce(article={},topic={}){
  const t=applyCommerceTarget(topic,topic.topicIndex),fields=commerceRecordFields(t),links=uniq((t.commerceLinks||[]).map(x=>x?.path)).map(path=>{const item=(t.commerceLinks||[]).find(x=>x.path===path);return {path,label:item?.label||path}});
  let html=String(article.html||'');
  if(html&&!html.includes('id="generated-commerce-links"')){
    const nav=`<nav id="generated-commerce-links" data-category-key="${esc(fields.categoryKey)}" data-brand-key="${esc(fields.brandKey||'')}" data-model-key="${esc(fields.modelKey||'')}" data-comparison-key="${esc(fields.comparisonKey||'')}" data-landing-path="${esc(fields.landingPath)}" aria-label="مسار الشراء المرتبط"><h2>استكمل قرار الشراء</h2><ul>${links.map(x=>`<li><a href="${esc(x.path)}">${esc(x.label)}</a></li>`).join('')}</ul></nav>`;
    html=/<\/article>/i.test(html)?html.replace(/<\/article>/i,nav+'</article>'):html+nav;
  }
  return {...article,...fields,html};
}

export const COMMERCE_GENERATOR_INFO={version:4,mode:'explicit-generator-taxonomy',metadata:['categoryKey','brandKey','modelKey','comparisonKey','landingPath'],categoryRoutes:Object.keys(CATEGORIES).length,brandRoutes:Object.keys(BRANDS).length,modelRoutes:Object.values(BRANDS).reduce((n,b)=>n+Object.keys(b.models).length,0),comparisonRoutes:Object.keys(COMPARISONS).length,markets:Object.keys(MARKETS).length,brandModelTargeting:'category-aware-compatible-models',internalLinks:true};
