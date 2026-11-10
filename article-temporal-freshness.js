// Correct only misleading PRESENT-TENSE seasonal claims in articles.
// Never rewrite stored article JSON, coupon values, dates, slugs, historic years or links.
const sale=/عروض|خصومات|خصم|كوبون|كود\s*خصم|بروموكود|تخفيضات|موسم|رمضان|الجمعة البيضاء|sale|offers?|discounts?|season|deals?|coupon|promo/i;
const active=/الآن|حاليًا|حاليا|اليوم|ساري|متاح(?:ة)?|current|today|this year|available now|active/i;
const past=/كان|كانت|في عام|تاريخي|أرشيف|الأرشيف|سابق|انتهى|expired|historical|previous|was|were|in 20\d{2}/i;
const forecast=/توقعات|متوقع|القادم|العام المقبل|معاينة|preview|upcoming|forecast|prediction|next year/i;
const oldPhone=/iPhone\s*1[0-7]|(?:آيفون|ايفون)\s*1[0-7]|Galaxy\s*S2[0-5]|\bS2[0-5]\b/i;
const newest=/الأحدث|أحدث|احدث|latest|newest|current generation/i;
const arMonths=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const enMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
function context(date){
  const f=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'numeric'}).formatToParts(date);
  return {year:+f.find(x=>x.type==='year').value,month:+f.find(x=>x.type==='month').value};
}
const visible=s=>String(s||'').replace(/<[^>]+>/g,' ');
const mismatched=(s,year)=>[...String(s).matchAll(/\b(20\d{2})\b/g)].some(m=>+m[1]>=2020&&+m[1]<=year+2&&+m[1]!==year);
function oldClaim(html,year,month){
  const t=normalizedAuditText(html);
  return !past.test(t)&&!forecast.test(t)&&((((mismatched(t,year)||staleMonth(t,year,month))&&sale.test(t)&&active.test(t)))||(oldPhone.test(t)&&newest.test(t)));
}
// Titles and headings describe CURRENT coupons, unless expressly historical or a forecast.
export function refreshCurrentSeasonLabel(text,{date=new Date()}={}){
  const d=context(date),raw=String(text||'');
  if(!(sale.test(raw)||currentGuide.test(raw))||past.test(raw)||forecast.test(raw))return raw;
  const normalized=raw.replace(/[٠-٩۰-۹]/g,c=>{
    const n=c.charCodeAt(0);return String(n>=0x6F0?n-0x6F0:n-0x660);
  });
  return refreshCampaignMonth(normalized,d.year,d.month).replace(/\b20\d{2}\b/g,match=>{
    const y=+match;
    return y>=2020&&y<=d.year+2&&y!==d.year?String(d.year):match;
  });
}
// Audit the ORIGINAL article across all categories without changing HTML or timestamps.
const currentGuide=/(?:دليل (?:شراء|اختيار)|أفضل|أحدث|احدث|عروض|خصومات|تخفيضات|موسم|رمضان|كود خصم|buying guide|shopping guide|best|offers?|discounts?|deals?|coupon)/i;
const archive=/(?:أرشيف|الأرشيف|تاريخي|historical|archived?|released|launched|تاريخ الإطلاق)/i;
function normalizedAuditText(s){
  return visible(s).replace(/[٠-٩۰-۹]/g,c=>{
    const n=c.charCodeAt(0);return String(n>=0x6F0?n-0x6F0:n-0x660);
  }).replace(/\s+/g,' ').trim();
}
function staleMonth(text,year,month){
  const months=[['يناير','january'],['فبراير','february'],['مارس','march'],['أبريل','ابريل','april'],['مايو','may'],['يونيو','june'],['يوليو','july'],['أغسطس','اغسطس','august'],['سبتمبر','september'],['أكتوبر','اكتوبر','october'],['نوفمبر','november'],['ديسمبر','december']];
  return months.some((names,i)=>i+1<month&&names.some(n=>new RegExp('(?:^|\\s)'+n+'\\s+'+year+'(?:$|\\W)','i').test(text)));
}
// Refresh only present-tense commercial MONTH/YEAR labels. Historical article
// metadata, launch years and archived campaign references remain unmodified.
const monthYearPattern=new RegExp('('+[...arMonths,...enMonths,'ابريل','اغسطس','اكتوبر'].join('|')+')\\s+(20\\d{2})','giu');
function refreshCampaignMonth(text,year,month){
  return String(text).replace(monthYearPattern,(match,label,found)=>{
    const normalized=label.toLowerCase().replace(/^ابريل$/,'أبريل').replace(/^اغسطس$/,'أغسطس').replace(/^اكتوبر$/,'أكتوبر');
    const originalMonth=arMonths.findIndex(m=>m===normalized)+1 ||
      enMonths.findIndex(m=>m.toLowerCase()===normalized)+1;
    const oldYear=Number(found);
    if(!originalMonth||oldYear<2020||oldYear>year+2||
      !(oldYear!==year||originalMonth<month))return match;
    return (/^[a-z]/i.test(label)?enMonths[month-1]:arMonths[month-1])+' '+year;
  });
}
export function staleCurrentClaims(html,year=context(new Date()).year,month=context(new Date()).month){
  const found=[];
  for(const m of String(html||'').matchAll(/<(title|h[1-6]|p|li|td|th|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
    const tag=m[1].toLowerCase(),text=normalizedAuditText(m[2]);
    if(!text||past.test(text)||forecast.test(text)||archive.test(text))continue;
    const heading=tag==='title'||/^h[1-6]$/.test(tag);
    if(oldClaim(text,year)||(heading&&mismatched(text,year)&&currentGuide.test(text))||
      (staleMonth(text,year,month)&&currentGuide.test(text)&&(heading||active.test(text))))
      found.push(text.slice(0,180));
  }
  return found;
}
function refreshTextParts(inner,{year,month,seasonal,english}){
  let inAnchor=false,inTime=false;
  return inner.split(/(<[^>]*>)/g).map(piece=>{
    if(/^<\s*a\b/i.test(piece))inAnchor=true;
    if(/^<\s*time\b/i.test(piece))inTime=true;
    if(/^</.test(piece)){
      if(/^<\s*\/a\b/i.test(piece))inAnchor=false;
      if(/^<\s*\/time\b/i.test(piece))inTime=false;
      return piece;
    }
    if(inAnchor||inTime)return piece;
    let value=piece;
    if(seasonal){
      value=refreshCampaignMonth(value,year,month).replace(/\b20\d{2}\b/g,found=>{
        const y=+found;
        return y>=2020&&y<=year+2&&y!==year?String(year):found;
      }).replace(/متاح(?:ة)?\s*الآن|ساري(?:ة)?\s*الآن|available\s+now|currently\s+active/gi,
        english?'subject to live verification':'بحسب التوافر والشروط الحالية');
    }
    return value.replace(/(?:أحدث\s*(?:إصدار|جيل)?|احدث\s*(?:اصدار|جيل)?|latest|newest)(?=\s*(?:iPhone|آيفون|ايفون|Galaxy|S2[0-5]))/gi,
      english?'previous-generation':'من الإصدارات السابقة');
  }).join('');
}
export function refreshLiveTemporalArticleHtml(html,{date=new Date(),english=false}={}){
  const d=context(date);
  let corrected=0;
  let out=String(html||'');
  out=out.replace(/(<(?:title|h[1-6])\b[^>]*>)([^<>]*)(<\/(?:title|h[1-6])>)/gi,(full,a,label,c)=>{
    const fresh=refreshCurrentSeasonLabel(label,{date});
    if(fresh!==label)corrected++;
    return a+fresh+c;
  });
  out=out.replace(/(<(p|li|td|th|figcaption)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,(full,a,tag,inner,c)=>{
    if(!oldClaim(inner,d.year,d.month))return full;
    const t=visible(inner);
    const seasonal=(mismatched(normalizedAuditText(t),d.year)||staleMonth(normalizedAuditText(t),d.year,d.month))&&sale.test(t)&&active.test(t);
    const safe=refreshTextParts(inner,{year:d.year,month:d.month,seasonal,english});
    const month=english?enMonths[d.month-1]:arMonths[d.month-1];
    const note=english?
      ' For '+month+' '+d.year+', confirm current offers, models and coupon terms at Noon checkout.':
      ' في '+month+' '+d.year+'، راجع العروض والموديلات وشروط الكوبون الفعلية في سلة نون.';
    corrected++;
    return a+safe+note+c;
  });
  return {html:out,corrected};
}
