import {MARKETS,CATEGORIES,BRANDS,COMPARISONS,marketKey,categoryKeyForArticle,articleCommerceLinks} from './commerce-taxonomy.js';

const hash=s=>{let n=2166136261;for(const c of String(s||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=(xs)=>[...new Set((xs||[]).filter(Boolean))];

function seedFor(topic,seed){const n=Number(seed);return Number.isFinite(n)?Math.abs(Math.trunc(n)):hash([topic?.kw,topic?.title,topic?.category,topic?.country].join('|'))}
function deepestPath(meta){if(meta.comparisonKey)return `/${meta.market}/compare/${meta.comparisonKey}`;if(meta.brandKey&&meta.modelKey)return `/${meta.market}/model/${meta.brandKey}/${meta.modelKey}`;if(meta.brandKey)return `/${meta.market}/brand/${meta.brandKey}`;return `/${meta.market}/category/${meta.categoryKey}`}
function suffixOnce(text,suffix){const s=String(text||'').trim(),x=String(suffix||'').trim();return !x||s.toLowerCase().includes(x.toLowerCase())?s:`${s} ${x}`.trim()}

export function applyCommerceTarget(topic={},seed){
  const n=seedFor(topic,seed),market=marketKey(topic.country),categoryKey=categoryKeyForArticle({category:topic.category,categoryKey:topic.categoryKey});
  let brandKey=null,modelKey=null,comparisonKey=null,targetLabel=CATEGORIES[categoryKey]?.label||topic.category||'';
  let kw=String(topic.kw||''),title=String(topic.title||topic.kw||'');
  {
    const eligibleBrands=Object.keys(BRANDS).filter(k=>BRANDS[k].categories?.includes(categoryKey));
    const brandKeys=eligibleBrands,comparisonKeys=Object.keys(COMPARISONS),comparisonMode=categoryKey==='mobiles'&&n%9===0;
    if(comparisonMode){
      comparisonKey=comparisonKeys[Math.floor(n/9)%comparisonKeys.length];
      const cmp=COMPARISONS[comparisonKey];brandKey=cmp.a;
      const models=Object.keys(BRANDS[brandKey].models);modelKey=models[Math.floor(n/3)%models.length];
      targetLabel=cmp.title;kw=suffixOnce(kw,cmp.title);title=suffixOnce(title,cmp.title);
    }else if(brandKeys.length){
      brandKey=brandKeys[n%brandKeys.length];
      const models=Object.keys(BRANDS[brandKey].models);modelKey=models[Math.floor(n/Math.max(1,brandKeys.length))%models.length];
      targetLabel=`${BRANDS[brandKey].label} ${BRANDS[brandKey].models[modelKey].label}`;
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

export const COMMERCE_GENERATOR_INFO={version:3,mode:'explicit-generator-taxonomy',metadata:['categoryKey','brandKey','modelKey','comparisonKey','landingPath'],categoryRoutes:Object.keys(CATEGORIES).length,brandRoutes:Object.keys(BRANDS).length,modelRoutes:Object.values(BRANDS).reduce((n,b)=>n+Object.keys(b.models).length,0),comparisonRoutes:Object.keys(COMPARISONS).length,markets:Object.keys(MARKETS).length,brandModelTargeting:'all-eligible-categories',internalLinks:true};
