// Correct only misleading PRESENT-TENSE seasonal claims in articles.
// Never rewrite stored article JSON, coupon values, dates, slugs, historic years or links.
const sale=/عروض|خصومات|خصم|كوبون|كود\s*خصم|بروموكود|تخفيضات|موسم|رمضان|الجمعة البيضاء|sale|offers?|discounts?|season|deals?|coupon|promo/i;
const active=/الآن|حاليًا|حاليا|اليوم|ساري|متاح(?:ة)?|current|today|this year|available now|active/i;
const past=/كان|كانت|في عام|تاريخي|سابق|انتهى|expired|historical|previous|was|were|in 20\d{2}/i;
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
function oldClaim(html,year){
  const t=visible(html);
  return !past.test(t)&&!forecast.test(t)&&((mismatched(t,year)&&sale.test(t)&&active.test(t))||(oldPhone.test(t)&&newest.test(t)));
}
// Titles and headings describe CURRENT coupons, unless expressly historical or a forecast.
export function refreshCurrentSeasonLabel(text,{date=new Date()}={}){
  const d=context(date);
  if(!sale.test(text)||past.test(text)||forecast.test(text))return String(text||'');
  return String(text||'').replace(/\b20\d{2}\b/g,match=>{
    const y=+match;
    return y>=2020&&y<=d.year+2&&y!==d.year?String(d.year):match;
  });
}
export function staleCurrentClaims(html,year=context(new Date()).year){
  return [...String(html||'').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].filter(m=>oldClaim(m[1],year)).map(m=>m[1].slice(0,150));
}
function refreshTextParts(inner,{year,seasonal,english}){
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
      value=value.replace(/\b20\d{2}\b/g,found=>{
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
  out=out.replace(/(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi,(full,a,inner,c)=>{
    if(!oldClaim(inner,d.year))return full;
    const t=visible(inner);
    const seasonal=mismatched(t,d.year)&&sale.test(t)&&active.test(t);
    const safe=refreshTextParts(inner,{year:d.year,seasonal,english});
    const month=english?enMonths[d.month-1]:arMonths[d.month-1];
    const note=english?
      ' For '+month+' '+d.year+', confirm current offers, models and coupon terms at Noon checkout.':
      ' في '+month+' '+d.year+'، راجع العروض والموديلات وشروط الكوبون الفعلية في سلة نون.';
    corrected++;
    return a+safe+note+c;
  });
  return {html:out,corrected};
}
