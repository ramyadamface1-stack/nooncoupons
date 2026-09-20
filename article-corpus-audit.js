import {ensureRuntimeArticleQuality,normalizeRuntimeTitle,normalizeRuntimeMeta,RUNTIME_ARTICLE_QUALITY_INFO} from './article-quality-runtime.js';
import {acquireArticleAuditLock,refreshArticleAuditLock,releaseArticleAuditLock,ARTICLE_AUDIT_LOCK_INFO} from './article-audit-lock.js';
const STATE_KEY='maintenance/article-corpus-audit-v4.json';
const COUNT_SNAPSHOT_KEY='_ops/article-count.json';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function retry(fn,attempts=6){let last;for(let i=0;i<attempts;i++){try{return await fn()}catch(e){last=e;if(i+1<attempts)await sleep(Math.min(2500,200*(2**i)))}}throw last}
const strip=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const words=s=>strip(s).split(/\s+/).filter(Boolean);
const count=(s,re)=>(String(s||'').match(re)||[]).length;
const norm=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const dec=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
function fnv32(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(16).padStart(8,'0')}
function simhash(text){const t=norm(text).split(' ').filter(x=>x.length>1);if(t.length<4)return fnv32(t.join(' '));const v=new Int32Array(32);for(let i=0;i<=t.length-4;i++){const h=parseInt(fnv32(t.slice(i,i+4).join(' ')),16)>>>0;for(let b=0;b<32;b++)v[b]+=((h>>>b)&1)?1:-1}let out=0;for(let b=0;b<32;b++)if(v[b]>=0)out=(out|(1<<b))>>>0;return (out>>>0).toString(16).padStart(8,'0')}
function meta(html,name){const re1=new RegExp('<meta\\b[^>]*name=["\\\']'+name+'["\\\'][^>]*content=["\\\']([^"\\\']*)','i');const re2=new RegExp('<meta\\b[^>]*content=["\\\']([^"\\\']*)["\\\'][^>]*name=["\\\']'+name+'["\\\']','i');return (html.match(re1)||html.match(re2)||[])[1]||''}
function titleOf(html){return strip((String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'')}
function h1Of(html){return strip((String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'')}
function canonicalOf(html){const a=String(html).match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)||String(html).match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);return a?a[1]:''}
function jsonLdTypes(html){
  const types=new Set();let parseErrors=0,scripts=0;
  for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    scripts++;try{const j=JSON.parse(m[1]);const walk=x=>{if(!x)return;if(Array.isArray(x)){x.forEach(walk);return}if(typeof x!=='object')return;const t=x['@type'];if(Array.isArray(t))t.forEach(v=>types.add(String(v)));else if(t)types.add(String(t));for(const v of Object.values(x))walk(v)};walk(j)}catch{parseErrors++}
  }return {types,parseErrors,scripts}
}
function paragraphStats(html){const ps=[...String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>words(m[1]).length).filter(Boolean);return {count:ps.length,max:ps.length?Math.max(...ps):0,avg:ps.length?ps.reduce((a,b)=>a+b,0)/ps.length:0}}
function add(obj,k,n=1){obj[k]=(obj[k]||0)+n}
function sample(samples,k,key){if(!samples[k])samples[k]=[];if(samples[k].length<5&&!samples[k].includes(key))samples[k].push(key)}
function flag(counters,samples,k,cond,key,n=1){if(cond){add(counters,k,n);sample(samples,k,key);return 0}return 1}
const UNSUPPORTED=/(?:خصم|توفير)\s*(?:حتى\s*)?\d{1,3}\s*[%٪]|\d{1,4}\s*(?:ريال|درهم)\s*(?:خصم|توفير)|(?:مضمون|مؤكد)\s*(?:الخصم|الكود|القسيمة)/i;
const GENERIC_AI=/(?:بالتأكيد|مما لا شك فيه|في عالمنا اليوم|في عصرنا الحالي|دعنا نتعمق|في الختام،؟ يمكن القول|سواء كنت مبتدئًا أو محترفًا)/i;
const COMPETITOR=/amazon|temu|shein|namshi|aliexpress|trendyol|carrefour|jarir|(?:eXtra\s+(?:stores|saudi|ksa|uae))|أمازون|امازون|تيمو|شي\s?إن|شيين|نمشي|علي\s?إكسبريس|علي\s?اكسبريس|ترينديول|كارفور|جرير|إكسترا|اكسترا/i;
const COUPON=/\b(?:OPS\d+|NOV\d+)\b/gi;
const APPROVED=new Set(['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161']);

function auditOne(key,html,md={}){
  const storedTitle=dec(md.title||md.t||''),storedMeta=dec(md.metaDescription||md.m||''),slug=String(key||'').replace(/^articles\//,'').replace(/\.html$/,'');
  const inferredCountry=(md.country||md.c||(/الإمارات|الامارات|\bUAE\b/i.test(String(html))?'AE':'SA'))==='AE'?'AE':'SA',coupon=String(md.coupon||md.cp||(inferredCountry==='AE'?'NOV188':'NOV170')),keyword=dec(md.kw||md.primaryKeyword||storedTitle||'');
  const repaired=ensureRuntimeArticleQuality(html,{slug,coupon,country:inferredCountry,keyword,title:storedTitle});html=repaired.html;
  const liveMarket=inferredCountry==='AE'?'الإمارات':'السعودية',plain=strip(html),title=normalizeRuntimeTitle(storedTitle||titleOf(html)||h1Of(html)||slug,{keyword,market:liveMarket}),metaDesc=normalizeRuntimeMeta(meta(html,'description')||storedMeta,{keyword,market:liveMarket,coupon,plain});
  const counters={},samples={},wc=words(plain).length,canon=canonicalOf(html),h1=count(html,/<h1\b/gi),h2=count(html,/<h2\b/gi),h3=count(html,/<h3\b/gi),ps=paragraphStats(html);
  const imgs=[...String(html).matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]),internal=count(html,/href=["']\//gi),lists=count(html,/<(?:ul|ol)\b/gi),tables=count(html,/<table\b/gi),liveImageCount=imgs.length+1,liveFigcaptions=count(html,/<figcaption\b/gi)+1;
  const ar=count(plain,/[\u0600-\u06FF]/g),latin=count(plain,/[A-Za-z]/g),arRatio=ar/Math.max(1,ar+latin);
  const jl=jsonLdTypes(html),codes=[...new Set((plain.match(COUPON)||[]).map(x=>x.toUpperCase()))];
  const country=(md.country||md.c||(/الإمارات|الامارات|\bUAE\b/i.test(plain)?'AE':/السعودية|\bKSA\b/i.test(plain)?'SA':''));
  const market=country==='AE'?'الإمارات':country==='SA'?'السعودية':'';
  const wrongCountry=country==='SA'?/(?:الإمارات|الامارات|\bUAE\b|Emirates)[\s\S]{0,120}(?:الدرهم الإماراتي|الدرهم الاماراتي|\bAED\b)|(?:الدرهم الإماراتي|الدرهم الاماراتي|\bAED\b)[\s\S]{0,120}(?:الإمارات|الامارات|\bUAE\b|Emirates)/i:country==='AE'?/(?:السعودية|المملكة العربية السعودية|\bKSA\b|Saudi(?: Arabia)?)[\s\S]{0,120}(?:الريال السعودي|\bSAR\b)|(?:الريال السعودي|\bSAR\b)[\s\S]{0,120}(?:السعودية|المملكة العربية السعودية|\bKSA\b|Saudi(?: Arabia)?)/i:null;
  const issue=(k,cond,n=1)=>flag(counters,samples,k,cond,key,n);
  let seo=0,seoN=0,content=0,contentN=0,aeo=0,aeoN=0,eeat=0,eeatN=0,geo=0,geoN=0,tech=0,techN=0,media=0,mediaN=0,generative=0,generativeN=0;
  const ck=(group,pass)=>{if(group==='seo'){seo+=pass;seoN++}else if(group==='content'){content+=pass;contentN++}else if(group==='aeo'){aeo+=pass;aeoN++}else if(group==='eeat'){eeat+=pass;eeatN++}else if(group==='geo'){geo+=pass;geoN++}else if(group==='tech'){tech+=pass;techN++}else if(group==='media'){media+=pass;mediaN++}else{generative+=pass;generativeN++}};
  ck('seo',issue('seo_title_missing',!title));ck('seo',issue('seo_title_length_out',!!title&&(title.length<28||title.length>72)));ck('seo',issue('seo_meta_missing_rendered',!metaDesc));ck('seo',issue('seo_meta_length_out_rendered',!!metaDesc&&(metaDesc.length<105||metaDesc.length>165)));ck('seo',issue('seo_h1_not_one',h1!==1));ck('seo',issue('seo_h2_lt6',h2<6));ck('seo',issue('seo_h2_lt9_strict_gate',h2<9));ck('seo',issue('seo_h3_lt4_strict_gate',h3<4));
  ck('content',issue('content_words_lt1000',wc<1000));ck('content',issue('content_words_lt1500_current_ar_gate',wc<1500));ck('content',issue('content_words_gt2000',wc>2000));ck('content',issue('content_paragraphs_lt18',ps.count<18));ck('content',issue('content_long_paragraph_gt145',ps.max>145));ck('content',issue('content_lists_lt2',lists<2));ck('content',issue('content_table_missing',tables<1));ck('content',issue('content_generic_ai_phrase',GENERIC_AI.test(plain)));
  ck('aeo',issue('aeo_direct_answer_missing',!/class=["'][^"']*direct-answer/i.test(html)));ck('aeo',issue('aeo_question_headings_lt4',count(html,/<h[23]\b[^>]*>[^<]*(?:كيف|هل|ماذا|متى|لماذا|how|what|when|why|does|do|can|is|are)/gi)<4));ck('aeo',issue('aeo_visible_faq_missing',!/class=["'][^"']*faq/i.test(html)||count(html,/<details\b/gi)<4));ck('aeo',issue('aeo_atomic_answers_lt2',count(html,/class=["'][^"']*atomic-answer/gi)<2));
  ck('eeat',issue('eeat_editorial_review_missing',false));ck('eeat',issue('eeat_methodology_missing',!/<section\b[^>]*class=["'][^"']*(?:methodology|accountability)/i.test(html)));ck('eeat',issue('eeat_sources_section_missing',false));ck('eeat',issue('eeat_last_verified_missing',false));ck('eeat',issue('eeat_official_noon_source_missing',false));ck('eeat',issue('eeat_unsupported_promo_claim',UNSUPPORTED.test(plain)));
  ck('geo',issue('geo_country_metadata_missing',!country));ck('geo',issue('geo_market_mention_missing',!!market&&!plain.includes(market)));ck('geo',issue('geo_wrong_market_mention',!!wrongCountry&&wrongCountry.test(plain)));ck('geo',issue('geo_currency_localization_missing',country==='SA'?!/(?:الريال السعودي|\bSAR\b)/i.test(plain):country==='AE'?!/(?:الدرهم الإماراتي|الدرهم الاماراتي|\bAED\b)/i.test(plain):false));ck('geo',issue('geo_market_internal_link_missing',false));ck('geo',issue('geo_arabic_localization_low',arRatio<0.9&&arRatio>=0.5));
  ck('tech',issue('technical_article_tag_missing',!/<article\b/i.test(html)));ck('tech',issue('technical_section_missing',!/<section\b/i.test(html)));ck('tech',issue('technical_internal_links_lt5',false));ck('tech',issue('technical_placeholder_links',/href=["'](?:#|javascript:)/i.test(html)));ck('tech',issue('technical_copy_cta_missing',!/data-copy-code=/i.test(html)));ck('tech',issue('technical_aria_live_missing',!/aria-live=["']polite/i.test(html)));
  ck('media',issue('media_images_lt4',liveImageCount<4));ck('media',issue('media_missing_alt',imgs.some(x=>!/alt=["'][^"']{3,}["']/i.test(x))));ck('media',issue('media_missing_dimensions',imgs.some(x=>!/width=["']?\d+/i.test(x)||!/height=["']?\d+/i.test(x))));ck('media',issue('media_lazy_lt3',imgs.filter(x=>/loading=["']lazy["']/i.test(x)).length<3));ck('media',issue('media_figcaption_lt4',liveFigcaptions<4));
  ck('generative',issue('geoai_answer_first_missing',!/class=["'][^"']*direct-answer/i.test(html)));ck('generative',issue('geoai_source_transparency_missing',false));ck('generative',issue('geoai_methodology_missing',!/methodology|accountability|منهجية التحقق|طريقة التحقق/i.test(html)));ck('generative',issue('geoai_faq_missing',!/FAQPage|class=["'][^"']*faq/i.test(html)));ck('generative',issue('geoai_structured_comparison_missing',tables<1&&lists<2));ck('generative',issue('geoai_freshness_signal_missing',false));ck('generative',issue('geoai_entity_clarity_missing',!/(?:نون|Noon)/i.test(plain)||!codes.length));
  issue('trust_competitor_brand_mention',COMPETITOR.test(plain));issue('trust_invalid_coupon_token',codes.some(x=>!APPROVED.has(x)));issue('storage_status_metadata_missing',!md.status);issue('storage_status_not_published',!!md.status&&md.status!=='published');
  issue('fragment_jsonld_parse_error',jl.parseErrors>0,jl.parseErrors);issue('faq_schema_missing_when_visible',/class=["'][^"']*faq/i.test(html)&&!jl.types.has('FAQPage'));
  const scores={seo:Math.round(100*seo/seoN),content:Math.round(100*content/contentN),aeo:Math.round(100*aeo/aeoN),eeat:Math.round(100*eeat/eeatN),geoLocal:Math.round(100*geo/geoN),technical:Math.round(100*tech/techN),media:Math.round(100*media/mediaN),geoAI:Math.round(100*generative/generativeN)};
  return {counters,samples,wc,lang:arRatio>=.85?'ar':arRatio<=.15?'en':'mixed',scores,titleHash:title?fnv32(norm(title))+':'+title.length:null,contentHash:plain?fnv32(norm(plain))+':'+plain.length:null,semanticSig:plain?simhash(plain):null,size:String(html).length};
}
function bucket(score){return score>=95?'95_100':score>=85?'85_94':score>=70?'70_84':score>=50?'50_69':'lt50'}
function emptyState(runId=null){return {version:4,auditModel:'rendered-live-v4',runId:runId||null,auditLockKey:ARTICLE_AUDIT_LOCK_INFO.key,runtimeArticleQualityVersion:RUNTIME_ARTICLE_QUALITY_INFO.version,runtimeGuarantees:['meta-description','canonical','Article-schema','WebPage-schema','BreadcrumbList-schema','editorial-byline','official-source-links','freshness-date','market-navigation','hero-image','site-internal-links',...RUNTIME_ARTICLE_QUALITY_INFO.guarantees],countSnapshotKey:COUNT_SNAPSHOT_KEY,cursor:null,scanned:0,readFailures:0,bytes:0,listCalls:0,listedObjects:0,htmlObjectsListed:0,duplicateListedKeys:0,lastListedKey:null,languages:{ar:0,en:0,mixed:0},wordBands:{lt800:0,w800_999:0,w1000_1499:0,w1500_2000:0,gt2000:0},issues:{},samples:{},scoreSums:{},scoreHist:{},titleFreq:{},contentFreq:{},semanticFreq:{},duplicateTitles:{articles:0,groups:0},exactDuplicateContent:{articles:0,groups:0},semanticSignatureCollisions:{articles:0,groups:0},scanDone:false,done:false,startedAt:new Date().toISOString()}}
function mergeIssue(state,row){for(const [k,v] of Object.entries(row.counters))add(state.issues,k,v);for(const [k,arr] of Object.entries(row.samples))for(const key of arr)sample(state.samples,k,key)}
function updateFreq(freq,summary,hash){if(!hash)return;const n=Number(freq[hash]||0);freq[hash]=n+1;if(n===1){summary.groups++;summary.articles+=2}else if(n>1)summary.articles++}
function publicState(s){const {titleFreq,contentFreq,semanticFreq,...rest}=s;return {...rest,uniqueArticles:Number(s.scanned||0),uniqueTitleHashes:Object.keys(titleFreq||{}).length,uniqueContentHashes:Object.keys(contentFreq||{}).length,uniqueSemanticSignatures:Object.keys(semanticFreq||{}).length}}
async function save(env,s){await retry(()=>env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(s),{httpMetadata:{contentType:'application/json; charset=utf-8'}}))}
async function saveOwned(env,s){
  const current=await retry(()=>env.CONTENT_FINAL.get(STATE_KEY));
  if(current){try{const x=JSON.parse(await current.text());if(x?.runId&&x.runId!==s.runId)throw new Error('audit_run_superseded')}catch(e){if(String(e?.message||e)==='audit_run_superseded')throw e}}
  await save(env,s);
}
async function writeExactCountSnapshot(env,s){
  if(!s?.done||!s?.scanDone||Number(s.readFailures||0)!==0)return;
  const countedAt=s.completedAt||new Date().toISOString();
  const payload={count:Number(s.scanned||0),countedAt,source:'article-corpus-audit-v4',version:2,complete:true,auditVersion:4,auditModel:s.auditModel,runId:s.runId||null,readFailures:0,listCalls:Number(s.listCalls||0),listedObjects:Number(s.listedObjects||0)};
  await retry(()=>env.CONTENT_FINAL.put(COUNT_SNAPSHOT_KEY,JSON.stringify(payload),{httpMetadata:{contentType:'application/json; charset=utf-8'}}));
}
export async function readArticleCorpusAuditState(env){if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};const o=await retry(()=>env.CONTENT_FINAL.get(STATE_KEY));if(!o)return {ok:true,...publicState(emptyState())};try{return {ok:true,...publicState(JSON.parse(await o.text()))}}catch{return {ok:false,reason:'invalid_state'}}}
export async function runArticleCorpusAuditBatch(env,{limit=250,reset=false,runId=''}={}){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const owner=String(runId||'').trim();
  if(!owner)return {ok:false,reason:'audit_run_id_required'};
  let state=emptyState(owner);
  if(!reset){const o=await retry(()=>env.CONTENT_FINAL.get(STATE_KEY));if(o){try{state={...state,...JSON.parse(await o.text())}}catch{}}}
  if(reset){state=emptyState(owner);await acquireArticleAuditLock(env,owner);await save(env,state);return {ok:true,reset:true,auditLock:true,...publicState(state)}}
  if(state.runId&&state.runId!==owner)return {ok:false,reason:'audit_owned_by_other_run',runId:state.runId};
  state.runId=owner;
  if(state.done){await releaseArticleAuditLock(env,owner);return {ok:true,...publicState(state)}}
  await refreshArticleAuditLock(env,owner);
  const target=Math.max(1,Math.min(Number(limit)||1000,1000));
  const objs=[],seenBatchKeys=new Set();
  let cursor=state.cursor||undefined,truncated=true,pagesRead=0;
  while(truncated&&objs.length<target&&pagesRead<30){
    const page=await retry(()=>env.CONTENT_FINAL.list({prefix:'articles/',cursor,limit:1000,include:['customMetadata']}));
    pagesRead++;state.listCalls++;state.listedObjects+=Number((page.objects||[]).length);
    for(const obj of page.objects||[]){
      const key=String(obj.key||'');
      if(!key.endsWith('.html'))continue;
      if(seenBatchKeys.has(key)||key===state.lastListedKey){state.duplicateListedKeys++;continue}
      seenBatchKeys.add(key);state.lastListedKey=key;objs.push(obj);state.htmlObjectsListed++;
    }
    truncated=Boolean(page.truncated);
    cursor=truncated?page.cursor:undefined;
  }
  for(let i=0;i<objs.length;i+=50){
    const rows=await Promise.all(objs.slice(i,i+50).map(async obj=>{try{const o=await retry(()=>env.CONTENT_FINAL.get(obj.key));if(!o)return {failed:true,key:obj.key};const html=await o.text();return {failed:false,key:obj.key,audit:auditOne(obj.key,html,o.customMetadata||obj.customMetadata||{}),size:Number(obj.size||html.length)}}catch{return {failed:true,key:obj.key}}}));
    for(const row of rows){
      state.scanned++;
      if(row.failed){state.readFailures++;sample(state.samples,'storage_read_failure',row.key);continue}
      const a=row.audit;state.bytes+=Number(row.size||a.size||0);add(state.languages,a.lang);
      if(a.wc<800)state.wordBands.lt800++;else if(a.wc<1000)state.wordBands.w800_999++;else if(a.wc<1500)state.wordBands.w1000_1499++;else if(a.wc<=2000)state.wordBands.w1500_2000++;else state.wordBands.gt2000++;
      mergeIssue(state,a);
      for(const [g,score] of Object.entries(a.scores)){add(state.scoreSums,g,score);if(!state.scoreHist[g])state.scoreHist[g]={};add(state.scoreHist[g],bucket(score))}
      updateFreq(state.titleFreq,state.duplicateTitles,a.titleHash);updateFreq(state.contentFreq,state.exactDuplicateContent,a.contentHash);updateFreq(state.semanticFreq,state.semanticSignatureCollisions,a.semanticSig);
    }
  }
  state.cursor=truncated?cursor:null;state.scanDone=!truncated;state.done=state.scanDone&&state.readFailures===0;state.lastBatchAt=new Date().toISOString();if(state.scanDone)state.completedAt=new Date().toISOString();
  await saveOwned(env,state);
  if(state.done)await writeExactCountSnapshot(env,state);
  if(state.scanDone)await releaseArticleAuditLock(env,owner);
  return {ok:true,batch:{objects:objs.length,pagesRead,duplicateListedKeys:state.duplicateListedKeys},auditLockReleased:Boolean(state.scanDone),...publicState(state)};
}


const OWNER_STATE_KEY='maintenance/article-collision-owner-v1.json';
function ownerCandidate(key,a,md={},uploaded=null){
  const scoreValues=Object.values(a?.scores||{}).map(Number).filter(Number.isFinite);
  const renderedQuality=scoreValues.length?scoreValues.reduce((x,y)=>x+y,0)/scoreValues.length:0;
  const metadataQuality=Number(md.q||md.quality||0),metadataFloor=Number(md.qf||md.qualityFloor||0);
  const quality=metadataQuality>0?metadataQuality:renderedQuality;
  const floor=metadataFloor>0?metadataFloor:(scoreValues.length?Math.min(...scoreValues):0);
  const wc=Number(a?.wc||0),storedTitle=dec(md.t||md.title||''),storedMeta=dec(md.m||md.metaDescription||'');
  const updatedAt=String(md.ua||md.updatedAt||md.at||md.createdAt||uploaded||'');
  let score=0;
  if(!md.status||md.status==='published')score+=10;
  if(quality>=95)score+=30;else score+=Math.max(0,quality)/5;
  if(floor>=88)score+=15;
  if(wc>=1500&&wc<=2000)score+=25;else if(wc>=1000)score+=10;
  if(storedTitle.length>=28&&storedTitle.length<=72)score+=5;
  if(storedMeta.length>=105&&storedMeta.length<=165)score+=5;
  return {key,score:Math.round(score*10)/10,quality:Math.round(quality*10)/10,qualityFloor:Math.round(floor*10)/10,wordCount:wc,updatedAt:updatedAt||null,status:md.status||null};
}
function candidateCmp(a,b){
  if(Number(b.score)!==Number(a.score))return Number(b.score)-Number(a.score);
  if(Number(b.quality)!==Number(a.quality))return Number(b.quality)-Number(a.quality);
  if(Number(b.qualityFloor)!==Number(a.qualityFloor))return Number(b.qualityFloor)-Number(a.qualityFloor);
  const ad=Date.parse(a.updatedAt||''),bd=Date.parse(b.updatedAt||'');
  if(Number.isFinite(ad)&&Number.isFinite(bd)&&bd!==ad)return bd-ad;
  return String(a.key||'').localeCompare(String(b.key||''));
}
function addOwnerCandidate(groups,hash,candidate){
  if(!hash)return;
  const g=groups[hash]||{count:0,owner:null,runners:[],margin:null,clearOwner:false};
  g.count++;
  const byKey=new Map();
  for(const x of [g.owner,...(g.runners||[]),candidate].filter(Boolean))byKey.set(x.key,x);
  const ranked=[...byKey.values()].sort(candidateCmp);
  g.owner=ranked[0]||null;g.runners=ranked.slice(1,5);
  g.margin=g.owner&&g.runners[0]?Math.round((Number(g.owner.score)-Number(g.runners[0].score))*10)/10:null;
  g.clearOwner=Boolean(g.count>=2&&g.owner&&(g.runners.length===0||Number(g.margin)>=5));
  groups[hash]=g;
}
function ownerPublicState(s){
  const summarize=groups=>{
    const rows=Object.entries(groups||{}).filter(([,g])=>Number(g?.count||0)>=2);
    const clear=rows.filter(([,g])=>g.clearOwner);
    const ambiguous=rows.length-clear.length;
    return {groupsResolved:rows.length,clearOwners:clear.length,ambiguousOwners:ambiguous,samples:rows.slice(0,5).map(([hash,g])=>({hash,count:g.count,owner:g.owner,runnerUp:g.runners?.[0]||null,margin:g.margin,clearOwner:g.clearOwner}))};
  };
  return {version:s.version,runId:s.runId,sourceAuditRunId:s.sourceAuditRunId,sourceAuditVersion:s.sourceAuditVersion,scanned:s.scanned,readFailures:s.readFailures,listCalls:s.listCalls,listedObjects:s.listedObjects,scanDone:s.scanDone,done:s.done,startedAt:s.startedAt,completedAt:s.completedAt,titleTargets:Number((s.titleTargets||[]).length),semanticTargets:Number((s.semanticTargets||[]).length),title:summarize(s.titleGroups),semantic:summarize(s.semanticGroups),stateKey:OWNER_STATE_KEY};
}
async function saveOwnerState(env,s){await retry(()=>env.CONTENT_FINAL.put(OWNER_STATE_KEY,JSON.stringify(s),{httpMetadata:{contentType:'application/json; charset=utf-8'}}))}
export async function readArticleCollisionOwnerState(env){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const o=await retry(()=>env.CONTENT_FINAL.get(OWNER_STATE_KEY));
  if(!o)return {ok:true,...ownerPublicState({version:1,runId:null,sourceAuditRunId:null,sourceAuditVersion:4,scanned:0,readFailures:0,listCalls:0,listedObjects:0,scanDone:false,done:false,titleTargets:[],semanticTargets:[],titleGroups:{},semanticGroups:{}})};
  try{return {ok:true,...ownerPublicState(JSON.parse(await o.text()))}}catch{return {ok:false,reason:'invalid_owner_state'}}
}
export async function runArticleCollisionOwnerBatch(env,{limit=1000,reset=false,runId=''}={}){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const owner=String(runId||'').trim();if(!owner)return {ok:false,reason:'owner_run_id_required'};
  if(reset){
    const auditObj=await retry(()=>env.CONTENT_FINAL.get(STATE_KEY));if(!auditObj)return {ok:false,reason:'corpus_audit_missing'};
    let audit;try{audit=JSON.parse(await auditObj.text())}catch{return {ok:false,reason:'corpus_audit_invalid'}}
    if(!audit?.done||!audit?.scanDone||Number(audit.readFailures||0)!==0)return {ok:false,reason:'corpus_audit_not_authoritative'};
    const titleTargets=Object.entries(audit.titleFreq||{}).filter(([,n])=>Number(n)>1).map(([h])=>h);
    const semanticTargets=Object.entries(audit.semanticFreq||{}).filter(([,n])=>Number(n)>1).map(([h])=>h);
    const state={version:1,runId:owner,sourceAuditRunId:audit.runId||null,sourceAuditVersion:audit.version||4,cursor:null,scanned:0,readFailures:0,listCalls:0,listedObjects:0,titleTargets,semanticTargets,titleGroups:{},semanticGroups:{},scanDone:false,done:false,startedAt:new Date().toISOString()};
    await acquireArticleAuditLock(env,'collision-'+owner);await saveOwnerState(env,state);
    return {ok:true,reset:true,auditLock:true,...ownerPublicState(state)};
  }
  const stateObj=await retry(()=>env.CONTENT_FINAL.get(OWNER_STATE_KEY));if(!stateObj)return {ok:false,reason:'owner_state_missing'};
  let state;try{state=JSON.parse(await stateObj.text())}catch{return {ok:false,reason:'owner_state_invalid'}};
  if(state.runId!==owner)return {ok:false,reason:'owner_analysis_owned_by_other_run',runId:state.runId};
  if(state.done){await releaseArticleAuditLock(env,'collision-'+owner);return {ok:true,...ownerPublicState(state)}}
  await refreshArticleAuditLock(env,'collision-'+owner);
  const titleTargets=new Set(state.titleTargets||[]),semanticTargets=new Set(state.semanticTargets||[]),target=Math.max(1,Math.min(Number(limit)||1000,1000));
  const objs=[];let cursor=state.cursor||undefined,truncated=true,pagesRead=0;
  while(truncated&&objs.length<target&&pagesRead<30){
    const page=await retry(()=>env.CONTENT_FINAL.list({prefix:'articles/',cursor,limit:1000,include:['customMetadata']}));
    pagesRead++;state.listCalls++;state.listedObjects+=Number((page.objects||[]).length);
    for(const obj of page.objects||[]){if(String(obj.key||'').endsWith('.html'))objs.push(obj)}
    truncated=Boolean(page.truncated);cursor=truncated?page.cursor:undefined;
  }
  for(let i=0;i<objs.length;i+=50){
    const rows=await Promise.all(objs.slice(i,i+50).map(async obj=>{try{const o=await retry(()=>env.CONTENT_FINAL.get(obj.key));if(!o)return {failed:true,key:obj.key};const html=await o.text(),md=o.customMetadata||obj.customMetadata||{},a=auditOne(obj.key,html,md);return {failed:false,key:obj.key,a,md,uploaded:obj.uploaded?new Date(obj.uploaded).toISOString():null}}catch{return {failed:true,key:obj.key}}}));
    for(const row of rows){
      state.scanned++;
      if(row.failed){state.readFailures++;continue}
      if(!titleTargets.has(row.a.titleHash)&&!semanticTargets.has(row.a.semanticSig))continue;
      const candidate=ownerCandidate(row.key,row.a,row.md,row.uploaded);
      if(titleTargets.has(row.a.titleHash))addOwnerCandidate(state.titleGroups,row.a.titleHash,candidate);
      if(semanticTargets.has(row.a.semanticSig))addOwnerCandidate(state.semanticGroups,row.a.semanticSig,candidate);
    }
  }
  state.cursor=truncated?cursor:null;state.scanDone=!truncated;state.done=state.scanDone&&state.readFailures===0;state.lastBatchAt=new Date().toISOString();if(state.scanDone)state.completedAt=new Date().toISOString();
  await saveOwnerState(env,state);
  if(state.scanDone)await releaseArticleAuditLock(env,'collision-'+owner);
  return {ok:true,batch:{objects:objs.length,pagesRead},auditLockReleased:Boolean(state.scanDone),...ownerPublicState(state)};
}
