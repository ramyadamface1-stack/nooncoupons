// One provider response can contain five fully saved original sections.
// Every resulting article still passes the unchanged native SEO gate.
const wordCount=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().split(/\s+/).filter(Boolean).length;
export function batchArticlePrompt(topic){
 if(!['SA','AE'].includes(topic?.country)||!Array.isArray(topic.sections)||topic.sections.length!==5)throw Error('INVALID_BATCH_TOPIC');
 return [
  'Create five ORIGINAL and detailed consumer shopping guide sections. Language: '+(topic.country==='SA'?'Saudi Arabic':'UAE English')+'. Return HTML ONLY, starting with <h2>.',
  'Title subject: '+topic.topic+'. Brand: '+topic.brand+'. Category: '+topic.category+'. Approved coupon '+topic.coupon+'.',
  'The EXACT five sections in order are:',
  ...topic.sections.map((s,i)=>(i+1)+'. '+s),
  'Write EXACTLY FIVE <h2> headings, in order. Each heading has 3-5 substantive <p> paragraphs. No other h2 elements, article wrapper, H1 or Markdown.',
  'Target 240-260 non-repetitive words under EACH of the five headings. Give practical model-comparison and purchase-checklist advice specific to each exact section.',
  'No invented live prices, tests, discount rates, current stock or seller promises. Official store checkout determines any coupon acceptance.',
  'Do not imply that a verified seller, badge, marketplace or warranty automatically guarantees a genuine, original, safe or factory-tested product. Seller authenticity, return eligibility and model specifications must be verified on the current listing; describe checks, never promise an outcome.',
  'Never invent hands-on testing, personal use, manufacturer certifications, exclusive offers, independent lab results, store endorsement or product-specific performance facts. Differentiate buyer questions using the actual focus and product category rather than repeating seller and coupon paragraphs.',
  'The ONLY coupon code allowed in the article is '+topic.coupon+'. Do not mention other offer codes, invented alphanumeric promo tokens or unverifiable model numbers.',
  'CRITICAL: Do NOT write any numerical percentage savings, fixed discount, guaranteed coupon, or a claim that this code will save a specific amount. The native trust audit rejects such claims, even when qualified as examples. Describe only how to compare the real checkout totals.',
  'Never claim a product has a particular specification without asking the reader to verify the exact listing. Avoid promotional filler and duplication.',
  'Each heading must address a DIFFERENT concrete buyer decision from its heading, with unique checks and actionable steps rather than a reusable generic coupon or seller paragraph. Avoid repeating the same wording across headings. Explain how to verify model numbers, dimensions or safety information only where relevant, without inventing the values.',
  'No links, scripts, event attributes, style, code fences or extra titles. End cleanly after fifth section.'
 ].join('\n');
}
// Prevent a common scaled-content failure: the model may assert that a
// marketplace badge or seller check GUARANTEES a genuine model. No product
// feed or independent test is supplied to this task, so such claims cannot
// be published. Explicit negative statements ("does not guarantee") are fine.
export function editorialSellerClaimReason(raw){
 const text=String(raw||'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ');
 const patterns=[
  /(?:seller verification|verified seller|verifying the seller|trusted seller)[^.!?]{0,190}?(?:guarantee(?:s|d)?|ensure(?:s|d)?|prove(?:s|d)?|certif(?:ies|ied)|factory-standard|authenticity)/gi,
  /(?:التحقق من (?:هوية )?البائع|البائع الموثوق|البائع المعتمد)[^.؟!]{0,160}?(?:يضمن|تضمن|يؤكد|يكفل|أصلي|الأصالة)/g
 ];
 for(const re of patterns)for(const m of text.matchAll(re)){
  if(/\\b(?:does not|cannot|never|not)\\s+(?:automatically\\s+)?(?:guarantee|ensure|prove|certify)\\b/i.test(m[0])||
     /(?:لا|لم|لن)\\s+(?:يضمن|تضمن|يؤكد|يكفل)/.test(m[0]))continue;
  return 'BATCH_UNVERIFIED_SELLER_GUARANTEE';
 }
 const repeated=(text.match(/seller verification|التحقق من البائع/gi)||[]).length;
 if(repeated>10)return 'BATCH_SELLER_TEMPLATE_REPETITION';
 return null;
}
export function parseArticleBatch(input){
 const html=String(input||'').trim();
 if(html.length<1200||html.length>180000)return {ok:false,reason:'BATCH_SIZE_INVALID',sections:[]};
 if(/<\s*(?:script|iframe|form|object|style|h1|article|section)\b|javascript\s*:|\son[a-z]+\s*=/i.test(html))
  return {ok:false,reason:'BATCH_UNSAFE_HTML',sections:[]};
 const editorialIssue=editorialSellerClaimReason(html);
 if(editorialIssue)return {ok:false,reason:editorialIssue,sections:[]};
 const heads=[...html.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2\s*>/gi)];
 if(heads.length===0||heads.length>5||html.slice(0,heads[0].index).trim())
  return {ok:false,reason:'BATCH_HEADINGS_INVALID',sections:[]};
 const sections=[];
 for(let i=0;i<heads.length;i++){
  const section=html.slice(heads[i].index,i+1<heads.length?heads[i+1].index:html.length).trim();
  if(wordCount(section)<140||wordCount(section)>600||!/<p\b/i.test(section)){
   // Preserve complete sections already paid for if the final response was
   // truncated. Resume from the first missing section after durable R2 save.
   if(!sections.length)return {ok:false,reason:'BATCH_CONTENT_THIN',sections:[]};
   break;
  }
  sections.push(section);
 }
 return {ok:true,reason:sections.length===5?'BATCH_COMPLETE':'BATCH_PARTIAL',sections};
}
