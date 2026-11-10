const sale=/عروض|خصومات|تخفيضات|موسم|رمضان|الجمعة البيضاء|sale|offers?|discounts?|season|deals?/i;
const active=/الآن|حاليًا|حاليا|اليوم|ساري|متاح(?:ة)?|current|today|this year|available now|active/i;
const past=/كان|كانت|في عام|تاريخي|سابق|انتهى|expired|historical|previous|was|were|in 20\d{2}/i;
const oldPhone=/iPhone\s*1[0-7]|(?:آيفون|ايفون)\s*1[0-7]|Galaxy\s*S2[0-5]|\bS2[0-5]\b/i;
const newest=/الأحدث|أحدث|احدث|latest|newest|current generation/i;
const arMonths=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const enMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
function context(date){const f=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'numeric'}).formatToParts(date);return {year:+f.find(x=>x.type==='year').value,month:+f.find(x=>x.type==='month').value};}
function oldClaim(html,year){const t=html.replace(/<[^>]+>/g,' ');return !past.test(t)&&(([...t.matchAll(/\b(20\d{2})\b/g)].some(m=>+m[1]>=2020&&+m[1]<year)&&sale.test(t)&&active.test(t))||(oldPhone.test(t)&&newest.test(t)));}
export function staleCurrentClaims(html,year=context(new Date()).year){return [...String(html||'').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].filter(m=>oldClaim(m[1],year)).map(m=>m[1].slice(0,150));}
export function refreshLiveTemporalArticleHtml(html,{date=new Date(),english=false}={}){const d=context(date);let corrected=0;const out=String(html||'').replace(/(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi,(full,a,inner,c)=>{if(/<(?:a|img|time|figure)\b/i.test(inner)||!oldClaim(inner,d.year))return full;corrected++;return a+(english?'For '+enMonths[d.month-1]+' '+d.year+', review the live offer and product model on Noon checkout; previous years are historical.':'لعروض '+arMonths[d.month-1]+' '+d.year+'، راجع الموسم الحالي وتوافر المنتج وشروط الكود في نون؛ عروض السنوات السابقة ليست عروضًا جارية.')+c});return {html:out,corrected};}
