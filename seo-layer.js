import app from './site.js';

const ORIGIN='https://nooncoupons.ramychatgptgcoupons.workers.dev';
const CODES=['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'];
const CATEGORIES=['electronics','mobiles','laptops','gaming','tv','home-appliances','kitchen','home','fashion-men','fashion-women','kids-fashion','beauty','perfumes','grocery','baby','toys','sports','health','watches','jewelry','bags','shoes','automotive','tools','books','stationery','pet-supplies','travel','garden','office','smart-home','audio','cameras','tablets','wearables','coffee','air-care','cleaning','lighting','gifts','deals','new-arrivals'];
const GUIDES=['how-to-use-noon-coupon','coupon-not-working','saudi-noon-saving-guide','uae-noon-saving-guide','first-order-guide','payment-methods-and-coupons','coupon-vs-offer','smart-cart-checklist'];
const TRUST=['/editorial-policy','/coupon-verification','/authors/editorial-team','/disclaimer','/terms'];

const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
const urlset=paths=>`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${ORIGIN}${p}</loc></url>`).join('')}</urlset>`;
const index=()=>`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['pages','categories','guides','coupons','coupons-saudi','coupons-uae'].map(n=>`<sitemap><loc>${ORIGIN}/sitemap-${n}.xml</loc></sitemap>`).join('')}</sitemapindex>`;

function countryCoupon(code,market){
  const sa=market==='SA';
  const country=sa?'السعودية':'الإمارات';
  const path=sa?`/saudi-arabia/coupon/${code.toLowerCase()}`:`/uae/coupon/${code.toLowerCase()}`;
  const alt=sa?`/uae/coupon/${code.toLowerCase()}`:`/saudi-arabia/coupon/${code.toLowerCase()}`;
  const title=`كود نون ${code} ${country} | تجربة الكود داخل السلة`;
  const desc=`صفحة مخصصة لكود نون ${code} في ${country}. انسخ الكود وجرّبه وتحقق من الخصم والأهلية داخل السلة قبل الدفع.`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><meta name="robots" content="index,follow"><link rel="canonical" href="${ORIGIN}${path}"><link rel="alternate" hreflang="ar-SA" href="${ORIGIN}/saudi-arabia/coupon/${code.toLowerCase()}"><link rel="alternate" hreflang="ar-AE" href="${ORIGIN}/uae/coupon/${code.toLowerCase()}"><style>body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f7f8fc;color:#111827}.wrap{width:min(850px,92%);margin:48px auto}.card{background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(17,24,39,.08)}h1{font-size:42px}.code{font:900 30px monospace;letter-spacing:3px;padding:16px;border:2px dashed #8b5cf6;background:#faf8ff;border-radius:16px;text-align:center}.btn{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:13px;background:#6d28d9;color:#fff;text-decoration:none;font-weight:900}.muted{color:#667085;line-height:1.9}.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.links a{color:#5b21b6}</style></head><body><main class="wrap"><a href="${sa?'/saudi-arabia':'/uae'}">← نون ${country}</a><article class="card"><p class="muted">نون ${country}</p><h1>${title}</h1><p class="muted">${desc}</p><div class="code">${code}</div><a class="btn" href="/coupons">عرض كل الأكواد</a><h2>كيف تتحقق من الكود؟</h2><p class="muted">أضف المنتجات للسلة في متجر ${country}، أدخل الكود كما هو، ثم راجع إجمالي الطلب. لا ننسب نسبة خصم أو حدًا أقصى للكود بدون شروط موثقة.</p><div class="links"><a href="${alt}">نفس الكود في ${sa?'الإمارات':'السعودية'}</a><a href="/coupon-verification">منهجية التحقق</a><a href="/editorial-policy">السياسة التحريرية</a></div></article></main></body></html>`;
}

export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/sitemap.xml') return xml(index());
    if(path==='/sitemap-pages.xml') return xml(urlset(['/', '/coupons','/saudi-arabia','/uae','/categories','/blog','/shopping-world','/about','/contact','/privacy','/faq','/noon-coupon-code-saudi-uae',...TRUST]));
    if(path==='/sitemap-categories.xml') return xml(urlset(CATEGORIES.map(x=>`/category/${x}`)));
    if(path==='/sitemap-guides.xml') return xml(urlset(GUIDES.map(x=>`/guide/${x}`)));
    if(path==='/sitemap-coupons.xml') return xml(urlset(CODES.map(x=>`/coupon/${x.toLowerCase()}`)));
    if(path==='/sitemap-coupons-saudi.xml') return xml(urlset(CODES.map(x=>`/saudi-arabia/coupon/${x.toLowerCase()}`)));
    if(path==='/sitemap-coupons-uae.xml') return xml(urlset(CODES.map(x=>`/uae/coupon/${x.toLowerCase()}`)));
    let m=path.match(/^\/(saudi-arabia|uae)\/coupon\/(nov\d+)$/i);
    if(m){const code=m[2].toUpperCase();if(CODES.includes(code))return new Response(countryCoupon(code,m[1]==='saudi-arabia'?'SA':'AE'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, s-maxage=300'}});}
    return app.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
