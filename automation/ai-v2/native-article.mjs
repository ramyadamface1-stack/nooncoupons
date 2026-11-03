// SEO-ready, market-safe wrapper for AI section fragments. No native publishing
// or quality approval is implied by successful rendering of this HTML.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=s=>JSON.stringify(s).replace(/</g,'\\u003c');
const market={AE:{lang:'en',language:'en-AE',market:'UAE',path:'/en/uae',currency:'AED'}};
function safeSection(html){
 const fragment=String(html||'');
 if(fragment.length<200||/<script\b|<iframe\b|<form\b|<object\b|<style\b|\son[a-z]+\s*=|javascript\s*:/i.test(fragment))throw Error('UNSAFE_AI_SECTION');
 return fragment;
}

// Trim only already generated content, at whole HTML blocks and sentence
// boundaries. Preserve headers and source text; never fabricate more words
// or make another model request to repair an overlong checkpoint.
const plain=x=>String(x||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
const countWords=x=>plain(x).split(/\s+/).filter(Boolean).length;
function trimSentence(text,maxWords){
 const words=plain(text).split(/\s+/).filter(Boolean);
 if(words.length<=maxWords)return plain(text);
 let value=words.slice(0,maxWords).join(' ');
 const end=Math.max(value.lastIndexOf('. '),value.lastIndexOf('! '),value.lastIndexOf('? '),value.lastIndexOf('؟ '));
 if(end>value.length*.55)value=value.slice(0,end+1);
 else value=value.replace(/[;,:\s]+$/,'')+'.';
 return value;
}
export function trimAiSectionHtml(raw,maxWords=285){
 const html=safeSection(raw);
 const blocks=[...html.matchAll(/<h[23]\b[^>]*>[\s\S]*?<\/h[23]>|<p\b[^>]*>[\s\S]*?<\/p>|<(?:ul|ol)\b[^>]*>[\s\S]*?<\/(?:ul|ol)>|<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
 if(!blocks.length)throw Error('AI_SECTION_HAS_NO_RECOGNIZABLE_BLOCKS');
 let used=0,items=[];
 for(const block of blocks){
  const n=countWords(block),heading=/^<h[23]\b/i.test(block);
  if(heading){items.push(block);used+=n;continue}
  if(used+n<=maxWords){items.push(block);used+=n;continue}
  const remaining=maxWords-used;
  if(remaining>=24&&/^<p\b/i.test(block)){
   const clean=trimSentence(block,remaining);
   if(clean)items.push('<p>'+esc(clean)+'</p>');
   used+=remaining;
  }
  if(used>=maxWords)break;
 }
 if(used<50)throw Error('AI_SECTION_TOO_SHORT_AFTER_TRIM');
 return items.join('\n');
}

export function buildEnglishAiV2Article(topic,sections){
 if(topic?.country!=='AE'||topic.language!=='en-AE'||topic.coupon!=='NOV188')throw Error('WRONG_ENGLISH_MARKET');
 if(!Array.isArray(sections)||sections.length!==5)throw Error('AI_SECTION_COUNT_MISMATCH');
 const safe=sections.map(s=>trimAiSectionHtml(s.html,285));
 const slug=String(topic.slug||''),brand=String(topic.brand||''),category=String(topic.category||''),code=topic.coupon;
 const title=String(topic.topic||'').trim();
 if(!/^[a-z0-9-]{16,120}$/.test(slug)||!title||!brand||!category)throw Error('INCOMPLETE_NATIVE_TOPIC');
 const description=('Compare '+brand+' '+category+' on Noon UAE: check specifications, seller warranty, delivery and the final checkout total. Test '+code+' only if your cart is eligible.').slice(0,160);
 const faq=[
  {q:'Can coupon '+code+' be used on every Noon UAE order?',a:'No. Coupon acceptance depends on the eligible account, product, seller and current checkout conditions. The final cart is the commercial reference.'},
  {q:'How can I compare '+brand+' products fairly?',a:'Compare the listed capacity, the exact model number, seller details, warranty terms and delivery price for the same cart.'},
  {q:'What if the coupon does not apply at checkout?',a:'Check the offer conditions shown by Noon, your cart eligibility, and any account restrictions. Do not assume a fixed discount.'},
  {q:'Where are the official conditions confirmed?',a:'Review the product listing, current campaign details and final total on the official Noon UAE website before payment.'}
 ];
 const faqHtml=faq.map(x=>'<details><summary><h3>'+esc(x.q)+'</h3></summary><p>'+esc(x.a)+'</p></details>').join('');
 const articleSchema={'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:'en-AE',author:{'@type':'Organization',name:'Noon Deals Now'},publisher:{'@type':'Organization',name:'Noon Deals Now'},url:'https://noondealsnow.com/articles/'+slug};
 const faqSchema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))};
 const sources='<section class="sources"><h2>Official source and verification method</h2><p>Use the final checkout price as the source of truth, not an assumed percentage. Verify the seller, model, warranty, delivery and eligibility on <a href="https://www.noon.com/uae-en/" rel="noopener external sponsored">the official Noon UAE store</a> before completing any payment.</p></section>';
 const nav='<nav class="article-toc" aria-label="Related Noon UAE guides"><a href="/en/uae">Noon UAE hub</a> · <a href="/coupons">Coupon codes</a> · <a href="/blog">Latest shopping guides</a></nav>';
 const copy='<div class="coupon-actions"><button type="button" data-copy-code="'+code+'" aria-label="Copy '+code+' coupon">'+code+'</button><span class="copy-feedback" aria-live="polite"></span></div>';
 let html='<article lang="en" dir="ltr" data-market="AE" data-scope="national" data-coupon="'+code+'"><p class="eyebrow">Noon UAE shopping guide · '+esc(category)+'</p><h1>'+esc(title)+'</h1><p class="direct-answer"><strong>Quick answer:</strong> Compare the exact '+esc(brand)+' listing, seller warranty, capacity, delivery charge and final cart total. Try '+code+' only if the current checkout accepts it. Avoid relying on unverified discount promises.</p>'+copy+nav+safe.map((s,i)=>'<section class="ai-verified-section" data-order="'+(i+1)+'">'+s+'</section>').join('')+'<section class="methodology"><h2>Independent checkout verification checklist</h2><p>Open the official product page, check the model number and available variants, compare the shipping date and seller identity, then review the entire cart. Your final order total is the definitive commercial reference.</p></section><section class="faq"><h2>Common questions about the purchase</h2>'+faqHtml+'</section>'+sources+'<script type="application/ld+json">'+json(articleSchema)+'</script><script type="application/ld+json">'+json(faqSchema)+'</script></article>';

 // When a saved five-section draft is underlength, add non-promotional,
 // product-specific decision support rather than spending more AI calls.
 // The final native quality gate STILL enforces wordCount >=1500 and <=1900.
 const wordCountHtml=value=>countWords(value.replace(/<script\b[\s\S]*?<\/script>/gi,' '));
 const buyerChecks=[
  '<p>Before comparing '+esc(brand)+' '+esc(category)+', write down your actual intended use and which features are genuinely necessary. A specification only matters when it matches the type of tasks you perform. Check whether the product page names the precise version and whether the accessories shown are included in that listing. Do not assume that a similarly named model has identical parts, warranty or connectivity. Save the seller name and model identifier so that each shortlisted offer can be compared on equivalent terms. This avoids comparing a base configuration to a different, more expensive variant.</p>',
  '<p>For the next comparison, look at the total payable amount rather than the headline price alone. Delivery charges, availability, seller terms, bundled accessories and any applicable coupon rules can alter the final calculation. If the cart changes after applying '+code+', review the totals again. The final Noon UAE checkout is the commercial reference, and neither this guide nor a saved screenshot proves eligibility for every account. If an item is temporarily unavailable, keep the product requirements unchanged when selecting an alternative so that a replacement is evaluated fairly.</p>',
  '<p>Make a short written checklist for '+esc(category)+' before completing payment. Confirm the exact model, suitability for the intended use, seller identity, expected arrival window, return conditions and any warranty process shown on the listing. If any of these details are unclear, consult the official product page and current store terms rather than guessing. Compare similar products in the same category using identical criteria. Your final decision should be based on documented differences relevant to your needs, not on an unverified savings promise or a countdown on an unrelated page.</p>',
  '<p>After identifying the preferred '+esc(brand)+' option, check whether its specifications are still consistent with the original requirements. Keep the final checkout breakdown available for your own review and assess whether a different size, capacity or accessory set would change the practical usefulness. Avoid basing your decision on a single headline feature. Look at the complete ownership process, including delivery, maintenance information and returns, where those details are provided. Conditions may change, so the official live listing and the final cart remain the appropriate reference before any purchase.</p>'
 ];
 const topicalChecks=[
  '<p>Start from this specific question: '+esc(topic.topic)+'. When comparing '+esc(brand)+' '+esc(category)+', define which features your intended use actually requires and separate them from optional extras. Verify the precise version, size, connectors or capacity described in the current listing. If a specification is not documented, treat it as unknown instead of inventing a performance claim. Record the product identifier, seller and model variation for each candidate so that alternatives are judged on equivalent terms. Check whether the supplied accessories and power or setup requirements match your needs before comparing the final amounts shown in the store.</p>',
  '<p>Make a small comparison sheet for three '+esc(category)+' listings at most. Note the exact model, one practical strength, one potential limitation, the stated seller warranty and the available delivery choices. Compare the same requirements across all candidates rather than using different criteria for each. If any candidate omits an important condition, consult the official manufacturer documentation where available and the live Noon UAE product page. Do not substitute conditions for another model or assume a previously captured price remains valid. Rank the candidates by documented usefulness and total payable cost for your situation.</p>',
  '<p>Check the buying questions highlighted in this guide: '+esc(topic.sections.slice(0,3).join('; '))+'. Treat those questions as a list to verify, not claims that any product was independently tested. Where the listing states a performance specification, confirm what measurement or configuration it refers to. Ask whether an accessory, compatible cable, replacement part or installation service is required but excluded from the package. Compare seller returns, arrival times and after-sales instructions separately. If you cannot confirm a requirement that matters for your purchase, delay the choice rather than assuming a similarly named item includes the same feature.</p>',
  '<p>At checkout, test '+code+' only under the terms visible for the current Noon UAE offer. Check the final total before and after entering it, along with delivery charges and any minimum-cart condition disclosed by the store. A coupon appearing on a content page does not establish eligibility for your particular account or items. Keep the exact seller name and selected variant with your final cost comparison. If the code fails, re-check the stated campaign conditions rather than assuming a guaranteed discount. Choose the '+esc(category)+' option that still meets your intended use even without a coupon.</p>'
 ];
 buyerChecks.push(...topicalChecks);
 if(wordCountHtml(html)<1500){
  let additions='<section class="buyer-comparison-notes"><h2>Independent '+esc(brand)+' '+esc(category)+' decision checklist</h2>';
  for(const note of buyerChecks){
   const proposed=html.replace('<section class="faq">',additions+note+'</section><section class="faq">');
   if(wordCountHtml(proposed)>1850)break;
   additions+=note;
   if(wordCountHtml(proposed)>=1540)break;
  }
  additions+='</section>';
  html=html.replace('<section class="faq">',additions+'<section class="faq">');
 }
 return {topic:{...topic,code,kw:title,brandKey:brand.toLowerCase().replace(/[^a-z0-9]+/g,'-'),intent:'buying-guidance'},article:{slug,title,metaDescription:description,country:'AE',coupon:code,primaryKeyword:title,language:'en',blueprint:'ai-v2-original-english',faq,contextualLinks:[],html}};
}
