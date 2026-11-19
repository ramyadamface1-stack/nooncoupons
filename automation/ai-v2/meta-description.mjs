// Keep AI V2 snippets meaningful and complete. Arbitrary .slice() used to
// publish Saudi and UAE descriptions ending mid-sentence on Google surfaces.
// This is copy formatting only; it never changes an article, date or URL.
export function nativeArticleMetaDescription({country,brand,category,code}){
 const name=String(brand||'').replace(/\s+/g,' ').trim();
 const kind=String(category||'').replace(/\s+/g,' ').trim();
 const coupon=String(code||'').trim().toUpperCase();
 if(country==='SA'){
  const candidates=[
   `قارن ${kind} من ${name} على نون السعودية: راجع المواصفات والبائع والضمان والشحن، ثم جرّب ${coupon} في السلة وتحقق من السعر النهائي.`,
   `قارن ${kind} على نون السعودية، وراجع البائع والضمان والشحن. جرّب ${coupon} في السلة وتحقق من السعر النهائي.`,
   `دليل التسوق على نون السعودية: راجع المواصفات والبائع والضمان والشحن، ثم جرّب ${coupon} وتحقق من إجمالي السلة.`
  ];
  return candidates.find(x=>x.length<=160)||candidates.at(-1);
 }
 if(country==='AE'){
  const candidates=[
   `Compare ${name} ${kind} on Noon UAE: check specifications, seller, warranty and delivery. Try ${coupon} at checkout and verify the final total.`,
   `Compare ${kind} on Noon UAE. Check seller, warranty and delivery, then try ${coupon} at checkout if eligible.`,
   `Noon UAE buying guide: check the seller, warranty, delivery and final cart total. Try ${coupon} at checkout if eligible.`
  ];
  return candidates.find(x=>x.length<=160)||candidates.at(-1);
 }
 throw new Error('UNSUPPORTED_META_MARKET');
}
