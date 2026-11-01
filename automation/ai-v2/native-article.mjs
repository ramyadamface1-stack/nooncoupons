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
 if(used<180)throw Error('AI_SECTION_TOO_SHORT_AFTER_TRIM');
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
 const html='<article lang="en" dir="ltr" data-market="AE" data-scope="national" data-coupon="'+code+'"><p class="eyebrow">Noon UAE shopping guide · '+esc(category)+'</p><h1>'+esc(title)+'</h1><p class="direct-answer"><strong>Quick answer:</strong> Compare the exact '+esc(brand)+' listing, seller warranty, capacity, delivery charge and final cart total. Try '+code+' only if the current checkout accepts it. Avoid relying on unverified discount promises.</p>'+copy+nav+safe.map((s,i)=>'<section class="ai-verified-section" data-order="'+(i+1)+'">'+s+'</section>').join('')+'<section class="methodology"><h2>Independent checkout verification checklist</h2><p>Open the official product page, check the model number and available variants, compare the shipping date and seller identity, then review the entire cart. Your final order total is the definitive commercial reference.</p></section><section class="faq"><h2>Common questions about the purchase</h2>'+faqHtml+'</section>'+sources+'<script type="application/ld+json">'+json(articleSchema)+'</script><script type="application/ld+json">'+json(faqSchema)+'</script></article>';
 return {topic:{...topic,code,kw:title,brandKey:brand.toLowerCase().replace(/[^a-z0-9]+/g,'-'),intent:'buying-guidance'},article:{slug,title,metaDescription:description,country:'AE',coupon:code,primaryKeyword:title,language:'en',blueprint:'ai-v2-original-english',faq,contextualLinks:[],html}};
}
