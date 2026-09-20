import {QUALITY_CRITERIA,QUALITY_CRITERIA_COUNT} from './quality-criteria.js';
import {isApprovedCoupon} from './approved-coupons.js';

const strip=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const words=s=>strip(s).split(/\s+/).filter(Boolean);
const count=(s,re)=>(String(s||'').match(re)||[]).length;
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n||0)*10)/10));
const pct=(a,b)=>b?100*a/b:0;

function tokens(s){return norm(s).split(' ').filter(x=>x.length>1)}
function overlap(a,b){const A=new Set(tokens(a)),B=new Set(tokens(b));if(!B.size)return 0;let hit=0;for(const x of B)if(A.has(x))hit++;return hit/B.size}
function paragraphStats(html){const ps=[...String(html||'').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>words(m[1]).length).filter(Boolean);return {count:ps.length,avg:ps.length?ps.reduce((a,b)=>a+b,0)/ps.length:0,max:ps.length?Math.max(...ps):0}}
function duplicateParagraphRatio(html){const ps=[...String(html||'').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>norm(strip(m[1]))).filter(x=>x.length>80);if(!ps.length)return 0;return 1-(new Set(ps).size/ps.length)}
function exactOccurrences(text,phrase){const p=norm(phrase);if(!p)return 0;return norm(text).split(p).length-1}

function fnv32(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return h>>>0}
export function contentSignature(text){const t=tokens(strip(text));if(t.length<4)return fnv32(t.join(' ')).toString(16).padStart(8,'0');const v=new Int32Array(32);for(let i=0;i<=t.length-4;i++){const h=fnv32(t.slice(i,i+4).join(' '));for(let b=0;b<32;b++)v[b]+=((h>>>b)&1)?1:-1}let out=0;for(let b=0;b<32;b++)if(v[b]>=0)out=(out|(1<<b))>>>0;return out.toString(16).padStart(8,'0')}
export function signatureDistance(a,b){if(!a||!b)return 32;let x=(parseInt(a,16)^parseInt(b,16))>>>0,c=0;while(x){x&=x-1;c++}return c}

export function preAuditSemanticGate(article,semanticRecent=[]){
  const html=String(article?.html||''),plain=strip(html),signature=contentSignature(plain);
  const distances=(Array.isArray(semanticRecent)?semanticRecent:[]).map(r=>signatureDistance(signature,r?.signature)).filter(Number.isFinite);
  const minSignatureDistance=distances.length?Math.min(...distances):32;
  return {pass:minSignatureDistance>=6,plain,signature,minSignatureDistance};
}

function addCheck(list,group,name,pass,weight=1,{critical=false,note=''}={}){list.push({group,name,pass:Boolean(pass),weight,critical,note})}
function groupScores(checks){const names=[...new Set(checks.map(x=>x.group))],out={};for(const g of names){const c=checks.filter(x=>x.group===g),w=c.reduce((s,x)=>s+x.weight,0),p=c.reduce((s,x)=>s+(x.pass?x.weight:0),0);out[g]=clamp(pct(p,w))}return out}

const COMPETITOR=/amazon|temu|shein|namshi|aliexpress|trendyol|carrefour|jarir|extra|أمازون|امازون|تيمو|شي\s?إن|شيين|نمشي|علي\s?إكسبريس|علي\s?اكسبريس|ترينديول|كارفور|جرير|إكسترا|اكسترا/i;
const GENERIC_AI=/(?:بالتأكيد|مما لا شك فيه|في عالمنا اليوم|في عصرنا الحالي|دعنا نتعمق|في الختام،؟ يمكن القول|سواء كنت مبتدئًا أو محترفًا)/i;
const UNSUPPORTED_PROMO=/(?:خصم|توفير)\s*(?:حتى\s*)?\d{1,3}\s*[%٪]|\d{1,4}\s*(?:ريال|درهم)\s*(?:خصم|توفير)|(?:مضمون|مؤكد)\s*(?:الخصم|الكود|القسيمة)/i;

export function auditSeoArticle(article,topic,opts={}){
  const semanticPreflight=opts.semanticPreflight&&typeof opts.semanticPreflight==='object'?opts.semanticPreflight:null;
  const html=String(article?.html||''),plain=semanticPreflight?.plain||strip(html),wordCount=words(plain).length,keyword=String(article?.primaryKeyword||topic?.kw||''),title=String(article?.title||''),meta=String(article?.metaDescription||''),slug=String(article?.slug||'');
  const country=topic?.country==='AE'?'AE':'SA',market=country==='SA'?'السعودية':'الإمارات',currency=country==='SA'?'الريال السعودي':'الدرهم الإماراتي',currencyCode=country==='SA'?'SAR':'AED',wrongCountry=country==='SA'?/(?:الإمارات|الامارات|\bUAE\b|Emirates)/i:/(?:السعودية|المملكة العربية السعودية|\bKSA\b|Saudi(?: Arabia)?)/i;
  const checks=[],pstats=paragraphStats(html),h1=count(html,/<h1\b/gi),h2=count(html,/<h2\b/gi),h3=count(html,/<h3\b/gi),imgs=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  const codes=[...new Set((plain.match(/\b[A-Z]{2,8}\d{1,6}\b/g)||[]).map(x=>x.toUpperCase()))],targetCode=String(topic?.code||article?.coupon||'').toUpperCase();
  const ar=count(plain,/[\u0600-\u06FF]/g),latin=count(plain,/[A-Za-z]/g),arabicRatio=ar/Math.max(1,ar+latin);
  const intro=strip(html.slice(0,Math.min(html.length,7000))),exactKw=exactOccurrences(plain,keyword),sig=semanticPreflight?.signature||contentSignature(plain);
  const recent=Array.isArray(opts.recent)?opts.recent:[],semanticRecent=Array.isArray(opts.semanticRecent)?opts.semanticRecent:recent,distances=semanticPreflight?[]:semanticRecent.map(r=>signatureDistance(sig,r.signature)).filter(Number.isFinite),minSignatureDistance=Number.isFinite(Number(semanticPreflight?.minSignatureDistance))?Number(semanticPreflight.minSignatureDistance):(distances.length?Math.min(...distances):32);
  const recentKeywords=new Set(recent.map(r=>norm(r.primaryKeyword||''))),recentSlugs=new Set(recent.map(r=>String(r.slug||'')));

  addCheck(checks,'seo','article_identity',Boolean(keyword&&title&&slug),3,{critical:true});
  addCheck(checks,'seo','title_length',title.length>=28&&title.length<=72,2);
  addCheck(checks,'seo','title_keyword_alignment',overlap(title,keyword)>=0.55,3,{critical:true});
  addCheck(checks,'seo','meta_length',meta.length>=105&&meta.length<=165,2);
  addCheck(checks,'seo','meta_alignment',overlap(meta,keyword)>=0.3&&meta.includes(market),2);
  addCheck(checks,'seo','clean_slug',slug.length>=12&&slug.length<=120&&!/--/.test(slug),2);
  addCheck(checks,'seo','one_h1',h1===1,3,{critical:true});
  const h1Text=strip((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
  addCheck(checks,'seo','h1_intent_alignment',overlap(h1Text,keyword)>=0.55,3,{critical:true});
  addCheck(checks,'seo','keyword_in_intro',overlap(intro,keyword)>=0.4,2);
  addCheck(checks,'seo','keyword_not_stuffed',exactKw>=1&&exactKw<=5,2);
  addCheck(checks,'seo','heading_hierarchy',h2>=9&&h3>=4,2);

  const minWords=Math.max(1500,Number(opts.minWords||1500));
  addCheck(checks,'content','word_count',wordCount>=Math.max(minWords,1150)&&wordCount<=1900,5,{critical:wordCount<minWords||wordCount>2000,note:String(wordCount)});
  addCheck(checks,'content','paragraph_count',pstats.count>=18,2);
  addCheck(checks,'content','paragraph_readability',pstats.avg>=18&&pstats.avg<=90&&pstats.max<=145,2);
  addCheck(checks,'content','lists',count(html,/<(?:ul|ol)\b/gi)>=2,1);
  addCheck(checks,'content','decision_table',/<table\b/i.test(html)&&/<th\b/i.test(html),2);
  addCheck(checks,'content','answer_box',/class=["'][^"']*(?:direct-answer|answer-box)/i.test(html),2);
  addCheck(checks,'content','category_depth',Boolean(topic?.category)&&plain.includes(topic.category)&&(topic?.factors||[]).filter(x=>plain.includes(x)).length>=3,3);
  addCheck(checks,'content','scenario_depth',Boolean(topic?.scenario)&&plain.includes(topic.scenario),2);
  addCheck(checks,'content','use_case_depth',Boolean(topic?.useCase)&&plain.includes(topic.useCase),2);
  addCheck(checks,'content','troubleshooting',/ماذا تفعل|حل المشكلة|لم يعمل|رفض (?:الكود|القسيمة)|استكشاف/i.test(plain),2);
  addCheck(checks,'content','decision_support',/قرار|قارن|مصفوفة|معيار|استبعاد/i.test(plain)&&/<table\b/i.test(html),2);
  const dupRatio=duplicateParagraphRatio(html);
  addCheck(checks,'content','low_internal_redundancy',dupRatio<=0.06,3,{critical:dupRatio>0.18,note:dupRatio.toFixed(3)});

  addCheck(checks,'trust','brand_lock',!COMPETITOR.test(plain),4,{critical:true});
  addCheck(checks,'trust','country_lock',!wrongCountry.test(plain),4,{critical:true});
  addCheck(checks,'trust','coupon_lock',codes.length>=1&&codes.every(x=>x===targetCode),5,{critical:true,note:codes.join(',')});
  addCheck(checks,'trust','no_unsupported_promo_claim',!UNSUPPORTED_PROMO.test(plain),5,{critical:true});
  addCheck(checks,'trust','official_source',/https:\/\/www\.noon\.com\//i.test(html),3,{critical:true});
  addCheck(checks,'trust','verification_methodology',/منهجية التحقق|طريقة التحقق|كيف نتحقق/i.test(plain),2);
  addCheck(checks,'trust','reviewer_signal',/مراجعة تحريرية|المراجع|فريق تحرير/i.test(plain),2);
  addCheck(checks,'trust','last_verified',/<time\b[^>]*datetime=/i.test(html)&&/آخر تحقق|آخر مراجعة/i.test(plain),2);
  addCheck(checks,'trust','source_transparency',/المصدر الرسمي|مصدر التحقق|نون الرسمي/i.test(plain),2);

  addCheck(checks,'aeo','answer_first',/class=["'][^"']*direct-answer/i.test(html)&&strip((html.match(/class=["'][^"']*direct-answer[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|aside)>/i)||[])[1]||'').length>=80,4);
  addCheck(checks,'aeo','question_headings',count(html,/<h[23]\b[^>]*>[^<]*(?:كيف|هل|ماذا|متى|لماذا)/gi)>=4,3);
  addCheck(checks,'aeo','visible_faq',/class=["'][^"']*faq/i.test(html)&&count(html,/<details\b/gi)>=4,4);
  addCheck(checks,'aeo','faq_data',Array.isArray(article?.faq)&&article.faq.length>=4,3);
  addCheck(checks,'aeo','faq_schema',/FAQPage/i.test(html)&&/application\/ld\+json/i.test(html),2);
  addCheck(checks,'aeo','atomic_answers',count(html,/class=["'][^"']*atomic-answer/gi)>=2,2);

  addCheck(checks,'geo','country_localization',plain.includes(market),4,{critical:true});
  addCheck(checks,'geo','currency_localization',plain.includes(currency)&&plain.includes(currencyCode),3);
  addCheck(checks,'geo','market_internal_link',country==='SA'?/href=["']\/saudi(?:["']|\/)/i.test(html):/href=["']\/uae(?:["']|\/)/i.test(html),2);
  addCheck(checks,'geo','national_scope_truthful',/data-scope=["']national["']/i.test(html),2);
  addCheck(checks,'geo','arabic_localization',arabicRatio>=0.9,3,{critical:arabicRatio<0.78,note:arabicRatio.toFixed(3)});

  addCheck(checks,'eeat','publisher',/NoonCoupons|كوبونات نون/i.test(plain),2);
  addCheck(checks,'eeat','editorial_review',/فريق تحرير NoonCoupons|فريق تحرير كوبونات نون/i.test(plain),3);
  addCheck(checks,'eeat','verification_note',/لا نفترض|لا ندعي|لا نعد|السلة.*المرجع|شروط نون.*المرجع/i.test(plain),3);
  addCheck(checks,'eeat','method_section',/<section\b[^>]*class=["'][^"']*(?:methodology|accountability)/i.test(html),3);
  addCheck(checks,'eeat','source_section',/<section\b[^>]*class=["'][^"']*sources/i.test(html),2);
  addCheck(checks,'eeat','experience_signal',/اختبر|دوّن|قارن|راجع.*السلة/i.test(plain),2);

  addCheck(checks,'technical','semantic_article',/<article\b/i.test(html)&&/<section\b/i.test(html),2);
  addCheck(checks,'technical','internal_links',count(html,/href=["']\//gi)>=5,3);
  addCheck(checks,'technical','external_link_hygiene',/rel=["'][^"']*noopener[^"']*external/i.test(html),2);
  addCheck(checks,'technical','schema_present',/application\/ld\+json/i.test(html),2);
  addCheck(checks,'technical','accessible_copy',/data-copy-code=/i.test(html)&&/aria-label=/i.test(html)&&/aria-live=/i.test(html),2);
  addCheck(checks,'technical','valid_heading_depth',h1===1&&h2>=9&&h3>=4,2);
  addCheck(checks,'technical','no_placeholder_links',!/href=["'](?:#|javascript:)/i.test(html),2);

  const imageGood=imgs.filter(x=>/alt=["'][^"']{12,}["']/i.test(x)&&/title=["'][^"']+["']/i.test(x)&&/width=["']?1200/i.test(x)&&/height=["']?760/i.test(x)).length;
  addCheck(checks,'image','image_count',imgs.length>=4,3);
  addCheck(checks,'image','image_attributes',imageGood>=4,3);
  addCheck(checks,'image','lazy_loading',imgs.filter(x=>/loading=["']lazy["']/i.test(x)).length>=4,2);
  const alts=imgs.map(x=>(x.match(/alt=["']([^"']+)/i)||[])[1]).filter(Boolean);
  addCheck(checks,'image','alt_uniqueness',alts.length>=4&&new Set(alts).size===alts.length,2);
  addCheck(checks,'image','svg_role_diversity',imgs.filter(x=>/\/assets\/coupon-svg\//i.test(x)).length>=4,2);
  addCheck(checks,'image','figure_context',count(html,/<figure\b/gi)>=4&&count(html,/<figcaption\b/gi)>=4,2);

  addCheck(checks,'ux','coupon_discovery',intro.includes(targetCode),3);
  addCheck(checks,'ux','copy_cta',count(html,/data-copy-code=/gi)>=2,2);
  addCheck(checks,'ux','try_flow',count(html,/href=["']https:\/\/www\.noon\.com\//gi)>=2,2);
  addCheck(checks,'ux','copy_feedback',/aria-live=["']polite/i.test(html),2);
  addCheck(checks,'ux','toc_or_jump_nav',/class=["'][^"']*(?:article-toc|quick-nav)/i.test(html),2);
  addCheck(checks,'ux','scannability',h2>=9&&pstats.max<=145&&/<table\b/i.test(html),2);

  addCheck(checks,'language','language_purity',arabicRatio>=0.9,4);
  addCheck(checks,'language','no_generic_ai_phrases',!GENERIC_AI.test(plain),3);
  const sentenceBuckets=new Set((plain.match(/[^.!؟]+[.!؟]/g)||[]).map(x=>Math.min(20,Math.round(words(x).length/4))));
  addCheck(checks,'language','sentence_variety',sentenceBuckets.size>=4,2);
  addCheck(checks,'language','punctuation',count(plain,/،|؛|؟/g)>=8,1);

  const sameKeyword=recentKeywords.has(norm(keyword)),sameSlug=recentSlugs.has(slug);
  addCheck(checks,'uniqueness','unique_keyword',!sameKeyword,4,{critical:sameKeyword});
  addCheck(checks,'uniqueness','unique_slug',!sameSlug,4,{critical:sameSlug});
  addCheck(checks,'uniqueness','semantic_distance',minSignatureDistance>=6,6,{critical:minSignatureDistance<4,note:String(minSignatureDistance)});
  addCheck(checks,'uniqueness','blueprint_diversity',recent.length<3||!recent.slice(0,3).every(r=>r.blueprint===article?.blueprint),2);

  const groups=groupScores(checks),weights={seo:15,content:18,trust:15,aeo:9,geo:7,eeat:8,technical:8,image:6,ux:6,language:4,uniqueness:14};
  let sum=0,total=0;for(const [g,v] of Object.entries(groups)){const gw=weights[g]||1;sum+=v*gw;total+=gw}
  const score=clamp(sum/Math.max(1,total)),p0=checks.filter(x=>x.critical&&!x.pass),failed=checks.filter(x=>!x.pass),groupFloor=Math.min(...['seo','content','trust','aeo','geo','eeat','technical','uniqueness'].map(g=>groups[g]??0)),threshold=Math.max(95,Number(opts.threshold||opts.qualityThreshold||95));
  const productionReady=p0.length===0&&score>=threshold&&groupFloor>=88&&wordCount>=minWords&&wordCount<=2000;
  return {score,scoreMode:'compliance-gated-v2',wordCount,productionReady,signature:sig,minSignatureDistance,plain,groups,checks,failed:failed.map(x=>x.name),p0:p0.map(x=>x.name),measuredChecks:checks.length,criteriaCatalogCount:QUALITY_CRITERIA_COUNT,criteriaCatalog:QUALITY_CRITERIA,groupFloor,arabicRatio:Math.round(arabicRatio*1000)/1000};
}

export function auditSummary(a){return {score:a.score,scoreMode:a.scoreMode||'compliance-gated-v2',wordCount:a.wordCount,productionReady:a.productionReady,groups:a.groups,p0:a.p0,failed:a.failed,minSignatureDistance:a.minSignatureDistance,signature:a.signature,measuredChecks:a.measuredChecks,criteriaCatalogCount:a.criteriaCatalogCount}}


function englishShingleSet(text,n=5){const a=words(norm(text));const out=new Set();for(let i=0;i<=a.length-n;i++)out.add(a.slice(i,i+n).join(' '));return out}
function englishJaccardDistance(a,b){const A=englishShingleSet(a),B=englishShingleSet(b);if(!A.size||!B.size)return 1;let inter=0;for(const x of A)if(B.has(x))inter++;return 1-inter/(A.size+B.size-inter)}
export function auditEnglishSeoArticle(article,topic,opts={}){
 const html=String(article?.html||''),plain=strip(html),wordCount=words(plain).length,keyword=String(article?.primaryKeyword||topic?.nativeKeyword||''),title=String(article?.title||''),meta=String(article?.metaDescription||''),slug=String(article?.slug||''),checks=[];
 const latin=count(plain,/[A-Za-z]/g),ar=count(plain,/[؀-ۿ]/g),englishRatio=latin/Math.max(1,latin+ar),h1=count(html,/<h1\b/gi),h2=count(html,/<h2\b/gi),pstats=paragraphStats(html),targetCode=String(topic?.code||article?.coupon||'').toUpperCase(),couponTokens=[...new Set((plain.match(/\b(?:OPS|NOV)\d+\b/gi)||[]).map(x=>x.toUpperCase()))];
 const recent=Array.isArray(opts.recent)?opts.recent:[],sig=contentSignature(plain),distances=recent.map(r=>signatureDistance(sig,r.signature)).filter(Number.isFinite),minSignatureDistance=distances.length?Math.min(...distances):32,jaccardDistances=recent.map(r=>r.plain?englishJaccardDistance(plain,r.plain):1),minJaccardDistance=jaccardDistances.length?Math.min(...jaccardDistances):1;
 addCheck(checks,'seo','identity',Boolean(keyword&&title&&slug),4,{critical:true});addCheck(checks,'seo','title_alignment',overlap(title,keyword)>=.45,4,{critical:true});addCheck(checks,'seo','meta',meta.length>=105&&meta.length<=165,3);addCheck(checks,'seo','one_h1',h1===1,4,{critical:true});
 addCheck(checks,'content','word_floor',wordCount>=900&&wordCount<=1800,5,{critical:wordCount<750||wordCount>2000,note:String(wordCount)});addCheck(checks,'content','sections',h2>=6&&h2<=18,3,{critical:h2>20,note:String(h2)});addCheck(checks,'content','readability',pstats.count>=8&&pstats.max<=150,2);
 addCheck(checks,'trust','official_source',/https:\/\/www\.noon\.com\//i.test(html),5,{critical:true});addCheck(checks,'trust','approved_coupon',couponTokens.length>=1&&couponTokens.every(isApprovedCoupon)&&isApprovedCoupon(targetCode),5,{critical:true});addCheck(checks,'trust','no_fixed_unverified_discount',!/(?:save|discount)\s+(?:up to\s+)?\d{1,3}%|guaranteed coupon|guaranteed discount/i.test(plain),5,{critical:true});addCheck(checks,'trust','checkout_truth',/checkout|cart/i.test(plain)&&/source of truth|final reference|final commercial reference/i.test(plain),3);
 addCheck(checks,'language','english_document',/<article\b[^>]*lang=["']en["']/i.test(html)&&/dir=["']ltr["']/i.test(html),5,{critical:true});addCheck(checks,'language','english_purity',englishRatio>=.94,5,{critical:englishRatio<.85,note:englishRatio.toFixed(3)});
 addCheck(checks,'ux','copy_code',/data-copy-code=/i.test(html)&&plain.includes(targetCode),4,{critical:true});addCheck(checks,'ux','copy_accessibility',/aria-label=/i.test(html)&&/aria-live=/i.test(html),2);
 addCheck(checks,'aeo','answer_first',/class=["'][^"']*direct-answer/i.test(html),3);addCheck(checks,'aeo','faq',Array.isArray(article?.faq)&&article.faq.length>=3&&count(html,/<details\b/gi)>=3,3);
 addCheck(checks,'technical','semantic',/<article\b/i.test(html)&&/<section\b/i.test(html),3);addCheck(checks,'technical','internal_navigation',/href=["']\/en\//i.test(html),2);
 const sameKeyword=recent.some(r=>norm(r.primaryKeyword||'')===norm(keyword)),sameSlug=recent.some(r=>String(r.slug||'')===slug);addCheck(checks,'uniqueness','unique_keyword',!sameKeyword,5,{critical:sameKeyword});addCheck(checks,'uniqueness','unique_slug',!sameSlug,5,{critical:sameSlug});addCheck(checks,'uniqueness','semantic_distance',minJaccardDistance>=.18,5,{critical:minJaccardDistance<.10,note:minJaccardDistance.toFixed(3)});
 const groups=groupScores(checks),weights={seo:16,content:16,trust:18,language:14,ux:10,aeo:8,technical:8,uniqueness:18};let sum=0,total=0;for(const [g,v] of Object.entries(groups)){const w=weights[g]||1;sum+=v*w;total+=w}const score=clamp(sum/Math.max(1,total)),p0=checks.filter(x=>x.critical&&!x.pass),failed=checks.filter(x=>!x.pass),groupFloor=Math.min(...Object.values(groups)),threshold=Math.max(92,Number(opts.threshold||92)),productionReady=p0.length===0&&score>=threshold&&groupFloor>=82;
 return {score,wordCount,productionReady,signature:sig,minSignatureDistance,minJaccardDistance:Math.round(minJaccardDistance*1000)/1000,plain,groups,failed:failed.map(x=>x.name),p0:p0.map(x=>x.name),englishRatio:Math.round(englishRatio*1000)/1000,measuredChecks:checks.length};
}
