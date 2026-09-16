import app from './site.js';

const ORIGIN='https://noondealsnow.com';
const CODES=['OPS32','OPS56','OPS47','OPS48','OPS43','OPS41','OPS38','OPS58'];
const CATEGORIES=['electronics','mobiles','laptops','gaming','tv','home-appliances','kitchen','home','fashion-men','fashion-women','kids-fashion','beauty','perfumes','grocery','baby','toys','sports','health','watches','jewelry','bags','shoes','automotive','tools','books','stationery','pet-supplies','travel','garden','office','smart-home','audio','cameras','tablets','wearables','coffee','air-care','cleaning','lighting','gifts','deals','new-arrivals'];
const GUIDES=['how-to-use-noon-coupon','coupon-not-working','saudi-noon-saving-guide','uae-noon-saving-guide','first-order-guide','payment-methods-and-coupons','coupon-vs-offer','smart-cart-checklist'];
const TRUST=['/editorial-policy','/coupon-verification','/authors/editorial-team','/disclaimer','/terms'];
const UPDATED='2026-09-16';
const moneyPath=(market,kind='main')=>`${market==='SA'?'/saudi-arabia':'/uae'}/noon-coupon-code${kind==='today'?'-today':kind==='year'?'-2026':''}`;
const MONEY=[
  ['/saudi-arabia/noon-coupon-code','كود خصم نون السعودية','صفحة مركزة لاكتشاف وتجربة أكواد نون السعودية الحالية قبل الدفع.','SA'],
  ['/saudi-arabia/noon-coupon-code-today','كود خصم نون السعودية اليوم','تحقق سريع من أكواد نون السعودية المتاحة للتجربة اليوم وطريقة اختبارها داخل السلة.','SA'],
  ['/saudi-arabia/noon-coupon-code-2026','كود خصم نون السعودية 2026','دليل محدث لأكواد نون السعودية في 2026 مع خطوات التحقق من الأهلية والإجمالي النهائي.','SA'],
  ['/uae/noon-coupon-code','كود خصم نون الإمارات','صفحة مركزة لاكتشاف وتجربة أكواد نون الإمارات الحالية قبل الدفع.','AE'],
  ['/uae/noon-coupon-code-today','كود خصم نون الإمارات اليوم','تحقق سريع من أكواد نون الإمارات المتاحة للتجربة اليوم وطريقة اختبارها داخل السلة.','AE'],
  ['/uae/noon-coupon-code-2026','كود خصم نون الإمارات 2026','دليل محدث لأكواد نون الإمارات في 2026 مع خطوات التحقق من الأهلية والإجمالي النهائي.','AE']
];

const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
const urlset=paths=>`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${ORIGIN}${p}</loc></url>`).join('')}</urlset>`;
const index=()=>`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['pages','money','categories','guides','coupons','coupons-saudi','coupons-uae'].map(n=>`<sitemap><loc>${ORIGIN}/sitemap-${n}.xml</loc></sitemap>`).join('')}</sitemapindex>`;

function countryCoupon(code,market){
  const sa=market==='SA';
  const country=sa?'السعودية':'الإمارات';
  const path=sa?`/saudi-arabia/coupon/${code.toLowerCase()}`:`/uae/coupon/${code.toLowerCase()}`;
  const alt=sa?`/uae/coupon/${code.toLowerCase()}`:`/saudi-arabia/coupon/${code.toLowerCase()}`;
  const title=`كود نون ${code} ${country} | تجربة الكود داخل السلة`;
  const desc=`صفحة مخصصة لكود نون ${code} في ${country}. انسخ الكود وجرّبه وتحقق من الخصم والأهلية داخل السلة قبل الدفع.`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><meta name="robots" content="index,follow"><link rel="canonical" href="${ORIGIN}${path}"><link rel="alternate" hreflang="ar-SA" href="${ORIGIN}/saudi-arabia/coupon/${code.toLowerCase()}"><link rel="alternate" hreflang="ar-AE" href="${ORIGIN}/uae/coupon/${code.toLowerCase()}"><style>body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f7f8fc;color:#111827}.wrap{width:min(850px,92%);margin:48px auto}.card{background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(17,24,39,.08)}h1{font-size:42px}.code{font:900 30px monospace;letter-spacing:3px;padding:16px;border:2px dashed #8b5cf6;background:#faf8ff;border-radius:16px;text-align:center}.btn{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:13px;background:#6d28d9;color:#fff;text-decoration:none;font-weight:900}.muted{color:#667085;line-height:1.9}.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.links a{color:#5b21b6}</style></head><body><main class="wrap"><a href="${sa?'/saudi-arabia':'/uae'}">← نون ${country}</a><article class="card"><p class="muted">نون ${country}</p><h1>${title}</h1><p class="muted">${desc}</p><div class="code">${code}</div><a class="btn" href="/coupons">عرض كل الأكواد</a><div class="links"><a href="${sa?'/saudi-arabia/noon-coupon-code':'/uae/noon-coupon-code'}">صفحة كود خصم نون ${country}</a><a href="${sa?'/saudi-arabia/noon-coupon-code-today':'/uae/noon-coupon-code-today'}">أكواد اليوم</a><a href="${sa?'/saudi-arabia/noon-coupon-code-2026':'/uae/noon-coupon-code-2026'}">أكواد 2026</a></div><h2>كيف تتحقق من الكود؟</h2><p class="muted">أضف المنتجات للسلة في متجر ${country}، أدخل الكود كما هو، ثم راجع إجمالي الطلب. لا ننسب نسبة خصم أو حدًا أقصى للكود بدون شروط موثقة.</p><div class="links"><a href="${alt}">نفس الكود في ${sa?'الإمارات':'السعودية'}</a><a href="/coupon-verification">منهجية التحقق</a><a href="/editorial-policy">السياسة التحريرية</a></div></article></main></body></html>`;
}

function moneyPage(row){
  const [path,title,desc,market]=row,sa=market==='SA',country=sa?'السعودية':'الإمارات',marketPath=sa?'/saudi-arabia':'/uae';
  const codes=CODES.map(c=>`<article class="c"><h2>${c}</h2><p>كود متاح للتجربة على نون ${country}. الأهلية وقيمة الخصم النهائية يحددهما متجر نون وقت الطلب.</p><a href="${marketPath}/coupon/${c.toLowerCase()}">تفاصيل وتجربة ${c}</a></article>`).join('');
  const graph={'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':ORIGIN+path,url:ORIGIN+path,name:title,description:desc,inLanguage:'ar',dateModified:UPDATED,isPartOf:{'@type':'WebSite','@id':ORIGIN+'/#website',url:ORIGIN,name:'Noon Deals Now'},about:[{'@type':'Thing',name:'Noon coupon codes'},{'@type':'Place',name:country}]},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:ORIGIN+'/'},{'@type':'ListItem',position:2,name:'نون '+country,item:ORIGIN+marketPath},{'@type':'ListItem',position:3,name:title,item:ORIGIN+path}]},{'@type':'FAQPage',mainEntity:[['هل الأكواد مضمونة لكل حساب؟','لا. أهلية الكود والخصم الفعلي يعتمدان على شروط نون والسلة والحساب وقت الطلب.'],['كيف أتحقق من الكود؟','ثبّت المنتجات والبائع، أدخل الكود في السلة، ثم قارن الإجمالي النهائي قبل وبعد التطبيق.'],['هل الصفحة خاصة بنفس الدولة؟',`نعم، هذه الصفحة مخصصة لنون ${country} ولا تنقل نتائج سوق آخر باعتبارها مؤكدة هنا.`]].map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}]};
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | أكواد نون الحالية</title><meta name="description" content="${desc} جرّب الأكواد الحالية وتحقق من الخصم داخل السلة قبل الدفع."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${ORIGIN+path}"><script type="application/ld+json">${JSON.stringify(graph).replace(/</g,'\\u003c')}</script><style>body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827}.w{width:min(1050px,92%);margin:auto}.hero{background:#111827;color:white;padding:52px 0}.hero h1{font-size:clamp(34px,6vw,58px);margin:10px 0}.hero p,.lead{line-height:1.9;color:#cbd5e1}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:28px 0}.c{background:white;border:1px solid #e5e7eb;border-radius:18px;padding:20px}.c a{font-weight:900;color:#5b21b6}.answer{background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:18px;margin-top:24px;line-height:1.9}@media(max-width:650px){.grid{grid-template-columns:1fr}}</style></head><body><header class="hero"><div class="w"><a href="${marketPath}" style="color:#ddd6fe">نون ${country}</a><h1>${title}</h1><p>${desc}</p></div></header><main class="w"><section class="answer"><strong>الإجابة المختصرة:</strong> جرّب الأكواد أدناه على نفس السلة، ولا تعتمد على نسبة أو أهلية غير ظاهرة في متجر نون. الإجمالي النهائي داخل نون هو المرجع.<br><small>آخر مراجعة تحريرية: 16 سبتمبر 2026 · السوق: نون ${country}</small></section><section class="grid">${codes}</section><section><h2>متى تستخدم هذه الصفحة؟</h2><p>استخدمها عندما تبحث عن كود خصم نون ${country} قبل إنهاء الطلب، ثم انتقل إلى صفحة الكود المحدد لمعرفة طريقة التجربة. صفحات الأقسام والبراندات مخصصة لاختيار المنتجات والمقارنة، بينما هذه الصفحة هي المرجع الرئيسي لنية البحث عن الكوبون حتى لا تتنافس صفحات الموقع على نفس الاستعلام.</p><h2>طريقة التحقق قبل الدفع</h2><p>اختر المنتج والبائع أولًا، سجّل إجمالي السلة، ثم جرّب الكود دون تغيير المنتجات. بعد التطبيق راجع الخصم والشحن والإجمالي النهائي. بهذه الطريقة تستطيع معرفة أثر الكود الحقيقي بدل الخلط بين تغير السعر وتغير القسيمة.</p><p><a href="${marketPath}/categories">تصفح أقسام نون ${country}</a> · <a href="/coupon-verification">منهجية التحقق من الأكواد</a> · <a href="/editorial-policy">السياسة التحريرية</a> · <a href="/coupons">كل الأكواد</a></p></section></main></body></html>`;
}

export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/sitemap.xml') return xml(index());
    if(path==='/sitemap-money.xml') return xml(urlset(MONEY.map(x=>x[0])));
    if(path==='/sitemap-pages.xml') return xml(urlset(['/', '/coupons','/saudi-arabia','/uae','/categories','/blog','/shopping-world','/about','/contact','/privacy','/faq','/noon-coupon-code-saudi-uae',...TRUST]));
    if(path==='/sitemap-categories.xml') return xml(urlset(CATEGORIES.map(x=>`/category/${x}`)));
    if(path==='/sitemap-guides.xml') return xml(urlset(GUIDES.map(x=>`/guide/${x}`)));
    if(path==='/sitemap-coupons.xml') return xml(urlset(CODES.map(x=>`/coupon/${x.toLowerCase()}`)));
    if(path==='/sitemap-coupons-saudi.xml') return xml(urlset(CODES.map(x=>`/saudi-arabia/coupon/${x.toLowerCase()}`)));
    if(path==='/sitemap-coupons-uae.xml') return xml(urlset(CODES.map(x=>`/uae/coupon/${x.toLowerCase()}`)));
    const money=MONEY.find(x=>x[0]===path);if(money)return new Response(moneyPage(money),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=0,s-maxage=300','x-money-page':'gsc-v1'}});
    let m=path.match(/^\/(saudi-arabia|uae)\/coupon\/(ops\d+)$/i);
    if(m){const code=m[2].toUpperCase();if(CODES.includes(code))return new Response(countryCoupon(code,m[1]==='saudi-arabia'?'SA':'AE'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, s-maxage=300'}});}
    return app.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
