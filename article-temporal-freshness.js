const sale=/عروض|خصومات|تخفيضات|موسم|رمضان|الجمعة البيضاء|sale|offers?|discounts?|season|deals?/i;
const active=/الآن|حاليًا|حاليا|اليوم|ساري|متاح(?:ة)?|current|today|this year|available now|active/i;
const past=/كان|كانت|في عام|تاريخي|سابق|انتهى|expired|historical|previous|was|were|in 20\d{2}/i;
const oldPhone=/iPhone\s*1[0-7]|(?:آيفون|ايفون)\s*1[0-7]|Galaxy\s*S2[0-5]|\bS2[0-5]\b/i;
const newest=/الأحدث|أحدث|احدث|latest|newest|current generation/i;
const arMonths=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const enMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
function context(date){const f=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'numeric'}).formatToParts(date);return {year:+f.find(x=>x.type==='year').value,month:+f.find(x=>x.type==='month').value};}
function oldClaim(html,year){const t=html.replace(/<[^>]+>/g,' ');return !past.test(t)&&(([...t.matchAll(/\b(20\d{2})\b/g)].some(m=>+m[1]>=2020&&+m[1]<year)&&sale.test(t)&&active.test(t))||(oldPhone.test(t)&&newest.test(t)));}
// Read-only audit across headings, lists, tables and paragraphs. This function
// intentionally NEVER changes publishedAt/datePublished/dateModified or historic data.
function editorialText(html){
  return String(html||'').replace(/<[^>]+>/g,' ').replace(/[٠-٩۰-۹]/g,c=>{
    const n=c.charCodeAt(0);return String(n>=0x6F0?n-0x6F0:n-0x660);
  }).replace(/\s+/g,' ').trim();
}
const editorialGuide=/(?:دليل (?:شراء|اختيار)|أفضل|أحدث|احدث|عروض|خصومات|تخفيضات|موسم|رمضان|كود خصم|buying guide|shopping guide|best|offers?|discounts?|deals?|coupon)/i;
function oldMonthClaim(text,year,month){
  const a=[['يناير','january'],['فبراير','february'],['مارس','march'],['أبريل','ابريل','april'],['مايو','may'],['يونيو','june'],['يوليو','july'],['أغسطس','اغسطس','august'],['سبتمبر','september'],['أكتوبر','اكتوبر','october'],['نوفمبر','november'],['ديسمبر','december']];
  return a.some((names,i)=>i+1<month&&names.some(n=>new RegExp('(?:^|\\s)'+n+'\\s+'+year+'(?:$|\\W)','i').test(text)));
}
export function staleCurrentClaims(html,year=context(new Date()).year,month=context(new Date()).month){
  const found=[];
  for(const match of String(html||'').matchAll(/<(title|h[1-6]|p|li|th|td|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
    const tag=match[1].toLowerCase(),text=editorialText(match[2]);
    if(!text||past.test(text))continue;
    const oldYear=[...text.matchAll(/\b(20\d{2})\b/g)].some(m=>+m[1]>=2020&&+m[1]<year);
    const datedMonth=oldMonthClaim(text,year,month);
    const heading=tag==='title'||/^h[1-6]$/.test(tag);
    if(oldClaim(text,year)||(heading&&oldYear&&editorialGuide.test(text))||((heading||active.test(text))&&datedMonth&&editorialGuide.test(text)))
      found.push(text.slice(0,180));
  }
  return found;
}
export function refreshLiveTemporalArticleHtml(html,{date=new Date(),english=false}={}){const d=context(date);let corrected=0;const out=String(html||'').replace(/(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi,(full,a,inner,c)=>{if(/<(?:a|img|time|figure)\b/i.test(inner)||!oldClaim(inner,d.year))return full;corrected++;return a+(english?'For '+enMonths[d.month-1]+' '+d.year+', review the live offer and product model on Noon checkout; previous years are historical.':'لعروض '+arMonths[d.month-1]+' '+d.year+'، راجع الموسم الحالي وتوافر المنتج وشروط الكود في نون؛ عروض السنوات السابقة ليست عروضًا جارية.')+c});return {html:out,corrected};}
