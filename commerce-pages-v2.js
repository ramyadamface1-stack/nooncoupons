import {
  MARKETS,
  CATEGORIES,
  BRANDS,
  COMPARISONS,
  commerceMeta,
  articleCommerceLinks,
  commercePaths,
  COMMERCE_TAXONOMY_INFO,
  CITIES,
  CATEGORY_VISUALS,
} from './commerce-taxonomy.js';
import {englishCanaryRecords} from './english-canary.js';

const CODES = ['OPS32','OPS56','OPS47','OPS48','OPS43','OPS41','OPS38','OPS58'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc = (s) => encodeURI(String(s || ''));
const safeJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
const EN_CATEGORY_LABELS={electronics:'Electronics',mobiles:'Mobiles',laptops:'Laptops',tablets:'Tablets',tvs:'TVs',computers:'Computers',gaming:'Gaming',audio:'Audio','home-kitchen':'Home & Kitchen',appliances:'Appliances',beauty:'Beauty','women-fashion':"Women's Fashion",'men-fashion':"Men's Fashion",shoes:'Shoes',bags:'Bags','baby-kids':'Baby & Kids',sports:'Sports',automotive:'Automotive',grocery:'Grocery',travel:'Travel','school-supplies':'School Supplies',gifts:'Gifts',pets:'Pet Supplies'};

const CSS = `
*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827}
a{color:inherit}.w{width:min(1180px,92%);margin:auto}.hero{padding:44px 0;background:linear-gradient(135deg,#111827,#312e81);color:#fff}
.hero h1{font-size:clamp(30px,5vw,50px);line-height:1.3;margin:14px 0}.hero p,.lead{line-height:1.9;color:#667085}.hero p{color:#e5e7eb;max-width:900px}.crumbs,.chips{display:flex;gap:8px;flex-wrap:wrap}.crumbs a{color:#ddd6fe}
.section{padding:30px 0}.section h2{font-size:clamp(23px,3vw,32px)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}
.card,.box{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:18px}.card h3{line-height:1.55;margin:8px 0}.card p{color:#667085;line-height:1.8}.card a{text-decoration:none}.visual-card{min-height:220px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;position:relative}.visual-card:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 15% 15%,rgba(109,40,217,.12),transparent 45%);pointer-events:none}.category-art{width:100%;height:auto;display:block;margin:-4px 0 14px}.visual-icon{font-size:30px;line-height:1}.visual-theme{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6d28d9;font-weight:900}.country-hero{padding:58px 0;background:linear-gradient(135deg,#111827,#312e81);color:#fff}.city-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.read{color:#6d28d9;font-weight:900}
.chips a{display:inline-block;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:9px 13px;text-decoration:none;font-weight:800}.coupon{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;background:#fffbeb;border:1px solid #fde68a;border-radius:20px;padding:20px;margin:24px 0}
.code{display:inline-block;background:#111827;color:#fff;border-radius:10px;padding:7px 11px;font-weight:900}.cta{display:inline-block;background:#facc15;text-decoration:none;font-weight:900;padding:13px 16px;border-radius:12px}.check{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.check .box{line-height:1.85}.spider{padding:28px 0;background:#111827;color:#fff}.empty{background:#fff;border:1px dashed #cbd5e1;border-radius:18px;padding:20px;color:#64748b}.table{width:100%;border-collapse:collapse;background:#fff}.table th,.table td{border:1px solid #e5e7eb;padding:12px;text-align:right;vertical-align:top}
@media(max-width:900px){.grid,.grid4,.city-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.grid,.grid4,.city-grid,.check,.coupon{grid-template-columns:1fr}}
`;

async function latestArticles(env) {
  try {
    const obj = await env.CONTENT_FINAL?.get('bulk/latest.json');
    const data = obj ? await obj.json() : {articles: []};
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

function codeFor(seed) {
  let n = 0;
  for (const c of String(seed || '')) n = (n * 33 + c.charCodeAt(0)) >>> 0;
  return CODES[n % CODES.length];
}

function marketRows(all, market) {
  return all.filter((a) => a?.slug && a.indexable !== false && a.country === MARKETS[market].country);
}

function articleCard(a) {
  return `<article class="card"><small>${a.country === 'AE' ? 'الإمارات' : 'السعودية'}</small><h3><a href="/articles/${enc(a.slug)}">${esc(a.title || a.primaryKeyword || a.slug)}</a></h3><p>${esc((a.metaDescription || '').slice(0,180))}</p><a class="read" href="/articles/${enc(a.slug)}">اقرأ الدليل ←</a></article>`;
}

async function englishMarketRows(env, market) {
  const country = MARKETS[market]?.country;
  if (!country) return [];
  return (await englishCanaryRecords(env)).filter((a) => a?.slug && a.indexable !== false && a.country === country && a.languageSource === 'native-intent-v6-canary');
}

function englishArticleCard(a) {
  return `<article class="card"><small>${a.country === 'AE' ? 'UAE' : 'Saudi Arabia'} · ${esc(a.intent || 'guide')}</small><h3><a href="/en/articles/${enc(a.slug)}">${esc(a.title || a.primaryKeyword || a.slug)}</a></h3><p>${esc((a.metaDescription || '').slice(0,180))}</p><a class="read" href="/en/articles/${enc(a.slug)}">Read guide →</a></article>`;
}

function breadcrumbs(market, parts = []) {
  let html = `<div class="crumbs"><a href="/">الرئيسية</a><span>←</span><a href="/${market}/categories">أقسام ${esc(MARKETS[market].name)}</a>`;
  for (const p of parts) html += `<span>←</span>${p.path ? `<a href="${p.path}">${esc(p.label)}</a>` : `<span>${esc(p.label)}</span>`}`;
  return html + '</div>';
}

function schema(origin, path, title, desc, rows) {
  const segments = path.split('/').filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': origin + path + '#page',
        url: origin + path,
        name: title,
        description: desc,
        inLanguage: 'ar',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: rows.length,
          itemListElement: rows.map((a, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: origin + '/articles/' + enc(a.slug),
            name: a.title || a.slug,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: segments.map((segment, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: i === segments.length - 1 ? title : segment,
          item: origin + '/' + segments.slice(0, i + 1).join('/'),
        })),
      },
    ],
  };
}

function pageHead(origin, path, title, desc, rows) {
  const enPath='/en'+path, alternates=`<link rel="alternate" hreflang="ar" href="${esc(origin+path)}"><link rel="alternate" hreflang="en" href="${esc(origin+enPath)}"><link rel="alternate" hreflang="x-default" href="${esc(origin+path)}">`;
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | كوبونات نون</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(origin + path)}">${alternates}<script type="application/ld+json">${safeJson(schema(origin,path,title,desc,rows))}</script><style>${CSS}</style>`;
}

function couponBox(market, key, label) {
  const mk = MARKETS[market];
  const code = codeFor(market + ':' + key);
  return `<aside class="coupon"><div><small>كود من قائمة الموقع للتجربة</small><h2>جرّب <span class="code">${code}</span> مع ${esc(label)}</h2><p class="lead">لا نثبت نسبة خصم أو أهلية غير موثقة. ثبّت المنتج والبائع والسلة، جرّب الكود، ثم اعتبر إجمالي نون النهائي هو المرجع.</p></div><a class="cta" href="${mk.noon}" rel="noopener external sponsored">فتح ${esc(mk.name)}</a></aside>`;
}

function visualSvg(key,label){
 const themes={electronics:'0b1020',mobiles:'111827',laptops:'172554',tablets:'312e81',tvs:'0f172a',computers:'1e293b',gaming:'3b0764',audio:'164e63','home-kitchen':'78350f',appliances:'334155',beauty:'831843','women-fashion':'701a75','men-fashion':'1e3a8a',shoes:'7c2d12',bags:'713f12','baby-kids':'854d0e',sports:'14532d',automotive:'27272a',grocery:'365314',travel:'075985','school-supplies':'1e40af',gifts:'9f1239',pets:'4d7c0f'};
 const bg=themes[key]||'312e81',v=CATEGORY_VISUALS[key]||{icon:'◆'};
 return `<svg class="category-art" viewBox="0 0 320 150" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g-${esc(key)}" x1="0" x2="1"><stop stop-color="#${bg}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="320" height="150" rx="20" fill="url(#g-${esc(key)})"/><circle cx="54" cy="40" r="62" fill="#fff" opacity=".08"/><circle cx="274" cy="130" r="78" fill="#fff" opacity=".06"/><text x="160" y="82" text-anchor="middle" font-size="46" fill="white">${esc(v.icon)}</text><text x="160" y="119" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="white">${esc(label)}</text></svg>`;
}

function categoryGrid(market, current = '') {
  return `<div class="grid4">${Object.entries(CATEGORIES).filter(([k]) => k !== current).map(([k,c]) => {const v=CATEGORY_VISUALS[k]||{icon:'◆',theme:'shopping',alt:c.label};return `<article class="card visual-card" aria-label="${esc(v.alt)}"><div>${visualSvg(k,c.label)}<div class="visual-icon" aria-hidden="true">${v.icon}</div><span class="visual-theme">${esc(v.theme)}</span><h3><a href="/${market}/category/${k}">${esc(c.label)}</a></h3><p>${esc(c.desc)}</p></div><a class="read" href="/${market}/category/${k}">افتح القسم ←</a></article>`}).join('')}</div>`;
}

function brandGrid(market, current = '', category = '') {
  return `<div class="grid4">${Object.entries(BRANDS).filter(([k,b]) => k !== current && (!category || b.categories?.includes(category))).map(([k,b]) => `<article class="card"><h3><a href="/${market}/brand/${k}">${esc(b.label)}</a></h3><p>${Object.values(b.models).map((x) => esc(x.label)).join(' · ')}</p><a class="read" href="/${market}/brand/${k}">صفحة البراند ←</a></article>`).join('')}</div>`;
}

function spider(market, current = '') {
  const keys = ['mobiles','electronics','computers','gaming','home-kitchen','beauty','shoes','bags','sports','automotive'];
  return `<section class="spider"><div class="w"><h2>تحرك داخل شبكة الموقع</h2><div class="chips"><a href="/">الرئيسية</a><a href="/${market}/noon-coupon-code">كود خصم نون ${market==='saudi'?'السعودية':'الإمارات'}</a><a href="/${market}/categories">كل الأقسام</a>${keys.filter((k) => k !== current).map((k) => `<a href="/${market}/category/${k}">${esc(CATEGORIES[k].label)}</a>`).join('')}<a href="/blog">كل المقالات</a></div></div></section>`;
}

function htmlResponse(body, kind, headers = {}) {
  return new Response(body, {headers: {'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=90,s-maxage=300','x-commerce-network':'v2','x-commerce-kind':kind,...headers}});
}

function shell(origin, path, title, desc, rows, hero, main, market, current = '') {
  return `<!doctype html><html lang="ar" dir="rtl"><head>${pageHead(origin,path,title,desc,rows)}</head><body>${hero}<main class="w">${main}</main>${spider(market,current)}</body></html>`;
}

function englishCategoryGrid(market){
 return `<div class="grid4">${Object.keys(CATEGORIES).map(k=>`<article class="card visual-card"><div>${visualSvg(k,EN_CATEGORY_LABELS[k]||k)}<span class="visual-theme">${esc(CATEGORY_VISUALS[k]?.theme||'shopping')}</span><h3><a href="/en/${market}/category/${k}">${esc(EN_CATEGORY_LABELS[k]||k)}</a></h3><p>Explore coupon-focused guides and eligible shopping content for this category.</p></div><a class="read" href="/en/${market}/category/${k}">Explore category →</a></article>`).join('')}</div>`;
}
function englishHead(origin,path,title,desc,market){
 const arPath=path.replace(/^\/en/,'');
 return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Noon Coupons</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(origin+path)}"><link rel="alternate" hreflang="en" href="${esc(origin+path)}"><link rel="alternate" hreflang="ar" href="${esc(origin+arPath)}"><link rel="alternate" hreflang="x-default" href="${esc(origin+arPath)}"><style>${CSS}</style>`;
}
async function englishCategoryPage(market,key,origin,env){
 const mk=MARKETS[market],cat=CATEGORIES[key];if(!mk||!cat)return null;
 const label=EN_CATEGORY_LABELS[key]||key,path=`/en/${market}/category/${key}`;
 const rows=(await englishMarketRows(env,market)).filter(a=>a.categoryKey===key).slice(0,12);
 const title=`Noon ${label} coupons in ${market==='saudi'?'Saudi Arabia':'the UAE'}`;
 const desc=`Coupon-focused ${label} hub for Noon ${market==='saudi'?'Saudi Arabia':'UAE'}, with eligible guides, brands and practical checkout guidance.`;
 const code=codeFor(market+':category:'+key);
 const hero=`<header class="hero"><div class="w"><div class="crumbs"><a href="/en/${market}">Country hub</a> · <a href="/${market}/category/${key}">العربية</a></div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div></header>`;
 const coupon=`<aside class="coupon"><div><small>Coupon-first action</small><h2>Copy code <span class="code">${code}</span></h2><p class="lead">Try the code against an eligible cart. Do not assume a fixed discount until Noon confirms it at checkout.</p></div><button class="cta" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}');this.textContent='Code copied'">Copy code</button></aside>`;
 const brands=Object.entries(BRANDS).filter(([,b])=>b.categories?.includes(key)).map(([bk,b])=>`<article class="card"><h3>${esc(b.label)}</h3><p>Brand navigation within the ${esc(label)} category.</p><a class="read" href="/${market}/brand/${bk}">View Arabic brand hub →</a></article>`).join('');
 const evidence=rows.length>=3;
 const main=`${coupon}<section class="section"><h2>${esc(label)} shopping guidance</h2><div class="check"><div class="box"><strong>Before copying a code</strong><p>Check seller, product eligibility, minimum cart rules and account status.</p></div><div class="box"><strong>At checkout</strong><p>The final Noon total is the source of truth for whether a coupon applies.</p></div></div></section><section class="section"><h2>Relevant brands</h2><div class="grid4">${brands||'<div class="empty">Brand hubs will be added only where they are relevant to this category.</div>'}</div></section><section class="section"><h2>Eligible guides</h2>${rows.length?`<div class="grid">${rows.map(englishArticleCard).join('')}</div>`:'<div class="empty">This English category stays out of search until it has enough supporting content.</div>'}</section>`;
 const robots=evidence?'index,follow,max-image-preview:large':'noindex,follow';
 const head=englishHead(origin,path,title,desc,market).replace('content="index,follow,max-image-preview:large"',`content="${robots}"`);
 return htmlResponse(`<!doctype html><html lang="en" dir="ltr"><head>${head}</head><body>${hero}<main class="w">${main}</main></body></html>`,'category-en',{'x-content-language':'en','x-english-evidence':evidence?'content-backed':'insufficient','x-robots-tag':robots});
}

async function englishCountryPage(market,origin,env){
 const mk=MARKETS[market];if(!mk)return null;
 const path=`/en/${market}`,rows=(await englishMarketRows(env,market)),title=`Noon coupons in ${market==='saudi'?'Saudi Arabia':'the UAE'}`,desc=`Coupon-first shopping hub for Noon ${market==='saudi'?'Saudi Arabia':'UAE'}, with categories, cities and buying guides.`,code=codeFor('country:'+market);
 const cities=(CITIES[market]||[]).map(c=>`<article class="card"><small>${esc(c.ar)}</small><h3>${esc(c.en)}</h3><p>Local navigation for shoppers in ${esc(c.en)} without claiming a city-specific discount unless verified.</p></article>`).join('');
 const hero=`<header class="country-hero"><div class="w"><div class="crumbs"><a href="/en/${market}">English</a> · <a href="/${market}">العربية</a></div><h1>${title}</h1><p>${desc}</p><aside class="coupon"><div><small>Primary action</small><h2>Copy code <span class="code">${code}</span></h2><p class="lead">Check eligibility in your cart; the final Noon checkout is the reference.</p></div><button class="cta" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}');this.textContent='Code copied'">Copy code</button></aside></div></header>`;
 const main=`<section class="section"><h2>Shop by category</h2>${englishCategoryGrid(market)}</section><section class="section"><h2>Major cities</h2><div class="city-grid">${cities}</div></section><section class="section"><h2>Latest eligible guides</h2>${rows.length?`<div class="grid">${rows.map(englishArticleCard).join('')}</div>`:'<div class="empty">Eligible English guides will appear here as they are published.</div>'}</section>`;
 return htmlResponse(`<!doctype html><html lang="en" dir="ltr"><head>${englishHead(origin,path,title,desc,market)}</head><body>${hero}<main class="w">${main}</main></body></html>`,'country-en',{'x-commerce-market':market,'x-content-language':'en'});
}

async function countryPage(market,origin,env){
 const mk=MARKETS[market];if(!mk)return null;
 const rows=marketRows(await latestArticles(env),market).slice(0,12),path=`/${market}`,code=codeFor('country:'+market);
 const title=`كوبونات وعروض ${mk.name}`,desc=`بوابة ${mk.name} للكوبونات والأقسام والمدن والأدلة العربية والإنجليزية المرتبطة بقرار الشراء.`;
 const cities=(CITIES[market]||[]).map(c=>`<article class="card"><small>${esc(c.en)}</small><h3><a href="/${market}/city/${c.key}">${esc(c.ar)}</a></h3><p>محتوى وكوبونات ${esc(mk.name)} المرتبطة بالبحث من ${esc(c.ar)} بدون ادعاء اختلاف خصم غير موثق حسب المدينة.</p></article>`).join('');
 const hero=`<header class="country-hero"><div class="w"><div class="crumbs"><a href="/">الرئيسية</a></div><h1>${title}</h1><p>${desc}</p><aside class="coupon"><div><small>الكوبون هو الإجراء الأساسي</small><h2>انسخ الكود <span class="code">${code}</span></h2><p class="lead">تحقق من أهلية الكود داخل سلتك؛ لا نفترض نسبة خصم ثابتة.</p></div><button class="cta" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}');this.textContent='تم نسخ الكود'">نسخ الكود</button></aside></div></header>`;
 const main=`<section class="section"><h2>تسوق حسب القسم</h2><p class="lead">واجهة بصرية للأقسام بدل قائمة تدوينات تقليدية.</p>${categoryGrid(market)}</section><section class="section"><h2>أهم المدن</h2><div class="city-grid">${cities}</div></section><section class="section"><h2>أحدث الأدلة والكوبونات</h2>${rows.length?`<div class="grid">${rows.map(articleCard).join('')}</div>`:'<div class="empty">تظهر المقالات المؤهلة تلقائيًا.</div>'}</section>`;
 return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market),'country',{'x-commerce-market':market});
}

async function cityPage(market,key,origin,env){
 const mk=MARKETS[market],city=(CITIES[market]||[]).find(c=>c.key===key);if(!mk||!city)return null;
 const rows=marketRows(await latestArticles(env),market).filter(a=>new RegExp(city.ar+'|'+city.en,'i').test(String(a.title||'')+' '+String(a.primaryKeyword||''))).slice(0,12);
 const path=`/${market}/city/${key}`,title=`كوبونات نون ${city.ar}`,desc=`دليل بحث محلي داخل ${mk.name} لزوار ${city.ar}، مع الأقسام والكوبونات والمقالات ذات الصلة. لا ندعي أن صلاحية الكود تختلف حسب المدينة دون دليل.`;
 const hero=`<header class="hero"><div class="w">${breadcrumbs(market,[{label:city.ar}])}<h1>${title}</h1><p>${desc}</p></div></header>`;
 const main=`${couponBox(market,'city:'+key,city.ar)}<section class="section"><h2>الأقسام المتاحة</h2>${categoryGrid(market)}</section><section class="section"><h2>محتوى مرتبط بـ ${city.ar}</h2>${rows.length?`<div class="grid">${rows.map(articleCard).join('')}</div>`:'<div class="empty">لن ننشئ محتوى مدينة مكررًا؛ ستظهر هنا فقط المقالات التي لها ارتباط حقيقي بالمدينة.</div>'}</section>`;
 return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market),'city',{'x-commerce-city':key,'x-city-evidence':rows.length?'content-backed':'insufficient','x-robots-tag':rows.length?'index, follow':'noindex, follow'});
}

async function directoryPage(market, origin, env) {
  const mk = MARKETS[market];
  if (!mk) return null;
  const rows = marketRows(await latestArticles(env), market).slice(0,18);
  const path = `/${market}/categories`;
  const title = `أقسام ${mk.name}`;
  const desc = `دليل منظم لأقسام ${mk.name}: الجوالات والإلكترونيات والكمبيوتر والبيت والجمال والأحذية والحقائب وغيرها، مع ربط مباشر بالمقالات والكوبونات.`;
  const hero = `<header class="hero"><div class="w">${breadcrumbs(market)}<h1>${title}</h1><p>${desc}</p><div class="chips"><a href="/${market}/category/mobiles">الجوالات</a><a href="/${market}/category/electronics">الإلكترونيات</a><a href="/${market}/category/shoes">الأحذية</a><a href="/${market}/category/bags">الحقائب</a></div></div></header>`;
  const main = `<section class="section"><h2>كل الأقسام</h2>${categoryGrid(market)}</section>${couponBox(market,'directory','أي قسم')}<section class="section"><h2>أحدث الأدلة</h2>${rows.length ? `<div class="grid">${rows.map(articleCard).join('')}</div>` : '<div class="empty">تظهر أحدث المقالات هنا تلقائيًا.</div>'}</section>`;
  return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market), 'directory');
}

async function categoryPage(market, key, origin, env) {
  const mk = MARKETS[market], c = CATEGORIES[key];
  if (!mk || !c) return null;
  const all = marketRows(await latestArticles(env), market);
  const rows = all.filter((a) => commerceMeta(a).categoryKey === key).slice(0,30);
  const path = `/${market}/category/${key}`;
  const title = `${c.label} على ${mk.name}`;
  const desc = `${c.desc} الصفحة تربط القسم بالبراندات والموديلات والمقالات ذات الصلة وباقي شبكة الموقع.`;
  const hero = `<header class="hero"><div class="w">${breadcrumbs(market,[{label:c.label}])}<h1>${title}</h1><p>${desc}</p></div></header>`;
  const eligibleBrandCount=Object.values(BRANDS).filter(b=>b.categories?.includes(key)).length;
  const mobileBrands = eligibleBrandCount ? `<section class="section"><h2>براندات ${c.label}</h2><p class="lead">اختر البراند ثم انتقل إلى عائلة المنتج والمقالات والعروض المرتبطة.</p>${brandGrid(market,'',key)}</section>` : '';
  const main = `${couponBox(market,key,c.label)}<section class="section"><h2>خطوات قرار الشراء</h2><div class="check"><div class="box"><strong>1. حدد الاستخدام</strong><br>اختيار المنتج يسبق اختيار الكوبون.</div><div class="box"><strong>2. ثبت النسخة</strong><br>قارن نفس السعة أو المقاس أو الإصدار.</div><div class="box"><strong>3. راجع البائع</strong><br>الضمان والإرجاع والشحن جزء من القرار.</div><div class="box"><strong>4. اختبر الكود</strong><br>قارن الإجمالي النهائي بعد تطبيقه.</div></div></section>${mobileBrands}<section class="section"><h2>مقالات ${c.label}</h2>${rows.length ? `<div class="grid">${rows.map(articleCard).join('')}</div>` : '<div class="empty">المقالات المتخصصة ستظهر تلقائيًا عند اجتياز بوابة الجودة.</div>'}</section><section class="section"><h2>أقسام مرتبطة</h2>${categoryGrid(market,key)}</section>`;
  return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market,key), 'category', {'x-commerce-category':key});
}

async function brandPage(market, key, origin, env) {
  const mk = MARKETS[market], b = BRANDS[key];
  if (!mk || !b) return null;
  const all = marketRows(await latestArticles(env), market);
  const rows = all.filter((a) => commerceMeta(a).brandKey === key).slice(0,24);
  const path = `/${market}/brand/${key}`;
  const title = `${b.label} على ${mk.name}`;
  const desc = `بوابة ${b.label}: عائلات الموديلات، أدلة الاختيار، المقارنات، الكوبون والمقالات المرتبطة داخل ${mk.name}.`;
  const hero = `<header class="hero"><div class="w">${breadcrumbs(market,[{label:'الجوالات',path:`/${market}/category/mobiles`},{label:b.label}])}<h1>${title}</h1><p>${desc}</p></div></header>`;
  const models = Object.entries(b.models).map(([modelKey,m]) => `<article class="card"><small>عائلة موديلات</small><h3><a href="/${market}/model/${key}/${modelKey}">${esc(m.label)}</a></h3><p>أدلة ومقارنات مرتبطة بعائلة ${esc(m.label)} بدون تجميد سعر أو مواصفة متغيرة.</p><a class="read" href="/${market}/model/${key}/${modelKey}">افتح العائلة ←</a></article>`).join('');
  const comps = Object.entries(COMPARISONS).filter(([,c]) => c.a === key || c.b === key).map(([k,c]) => `<article class="card"><h3><a href="/${market}/compare/${k}">${esc(c.title)}</a></h3><a class="read" href="/${market}/compare/${k}">افتح المقارنة ←</a></article>`).join('');
  const main = `${couponBox(market,'brand:'+key,b.label)}<section class="section"><h2>عائلات ${b.label}</h2><div class="grid">${models}</div></section><section class="section"><h2>مقارنات مرتبطة</h2><div class="grid">${comps || '<div class="empty">ستضاف المقارنات المناسبة هنا.</div>'}</div></section><section class="section"><h2>مقالات ${b.label}</h2>${rows.length ? `<div class="grid">${rows.map(articleCard).join('')}</div>` : '<div class="empty">تظهر المقالات تلقائيًا عند تطابق البراند بوضوح.</div>'}</section><section class="section"><h2>براندات أخرى</h2>${brandGrid(market,key)}</section>`;
  return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market,'mobiles'), 'brand', {'x-commerce-brand':key});
}

async function modelPage(market, brandKey, modelKey, origin, env) {
  const mk = MARKETS[market], b = BRANDS[brandKey], model = b?.models?.[modelKey];
  if (!mk || !b || !model) return null;
  const all = marketRows(await latestArticles(env), market);
  const rows = all.filter((a) => { const meta = commerceMeta(a); return meta.brandKey === brandKey && meta.modelKey === modelKey; }).slice(0,24);
  const path = `/${market}/model/${brandKey}/${modelKey}`;
  const title = `${b.label} ${model.label} على ${mk.name}`;
  const desc = `صفحة عائلة ${model.label}: أدلة شراء ومقارنة وبائع وكوبون ومقالات مرتبطة، بدون ادعاء سعر أو مواصفات متغيرة.`;
  const hero = `<header class="hero"><div class="w">${breadcrumbs(market,[{label:'الجوالات',path:`/${market}/category/mobiles`},{label:b.label,path:`/${market}/brand/${brandKey}`},{label:model.label}])}<h1>${title}</h1><p>${desc}</p></div></header>`;
  const siblings = Object.entries(b.models).filter(([k]) => k !== modelKey).map(([k,m]) => `<a href="/${market}/model/${brandKey}/${k}">${esc(m.label)}</a>`).join('');
  const main = `${couponBox(market,'model:'+brandKey+':'+modelKey,`${b.short} ${model.label}`)}<section class="section"><h2>ما الذي تقارنه؟</h2><div class="check"><div class="box">السعة والنسخة الإقليمية وحالة الجهاز.</div><div class="box">البائع والضمان وسياسة الإرجاع والشحن.</div><div class="box">السعر النهائي لنفس السلة بعد تجربة الكود.</div><div class="box">الاحتياج الفعلي: تصوير أو ألعاب أو عمل أو استخدام يومي.</div></div></section><section class="section"><h2>مقالات ${model.label}</h2>${rows.length ? `<div class="grid">${rows.map(articleCard).join('')}</div>` : '<div class="empty">هذه الصفحة جاهزة لاستقبال المقالات المتخصصة تلقائيًا.</div>'}</section><section class="section"><h2>عائلات أخرى من ${b.label}</h2><div class="chips">${siblings}</div></section>`;
  return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market,'mobiles'), 'model', {'x-commerce-brand':brandKey,'x-commerce-model':modelKey});
}

async function comparisonPage(market, key, origin, env) {
  const mk = MARKETS[market], c = COMPARISONS[key];
  if (!mk || !c) return null;
  const A = BRANDS[c.a], B = BRANDS[c.b];
  const all = marketRows(await latestArticles(env), market);
  const rows = all.filter((a) => { const meta = commerceMeta(a); return meta.comparisonKey === key || meta.brandKey === c.a || meta.brandKey === c.b; }).slice(0,18);
  const path = `/${market}/compare/${key}`;
  const title = `${c.title} — ${mk.label}`;
  const desc = `مقارنة قرار شراء بين ${A.label} و${B.label} على ${mk.name} حسب الاستخدام والنسخة والبائع والضمان والإجمالي النهائي.`;
  const hero = `<header class="hero"><div class="w">${breadcrumbs(market,[{label:'الجوالات',path:`/${market}/category/mobiles`},{label:'المقارنات'}])}<h1>${title}</h1><p>${desc}</p><div class="chips"><a href="/${market}/brand/${c.a}">${esc(A.label)}</a><a href="/${market}/brand/${c.b}">${esc(B.label)}</a></div></div></header>`;
  const main = `${couponBox(market,'compare:'+key,'الجوالات')}<section class="section"><h2>إطار المقارنة</h2><table class="table"><tr><th>المعيار</th><th>${esc(A.label)}</th><th>${esc(B.label)}</th></tr><tr><td>الاستخدام</td><td>حدد الأولوية قبل السعر.</td><td>قارن نفس الفئة ونفس الاستخدام.</td></tr><tr><td>النسخة والسعة</td><td>ثبت النسخة والسعة وحالة المنتج.</td><td>تأكد أن العرضين متكافئان.</td></tr><tr><td>البائع والضمان</td><td>راجع الإرجاع والضمان.</td><td>ضع خدمة ما بعد الشراء ضمن القرار.</td></tr><tr><td>الكوبون</td><td>جرّبه بعد تثبيت السلة.</td><td>قارن الإجمالي بعد الشحن.</td></tr></table></section><section class="section"><h2>مقالات مرتبطة</h2>${rows.length ? `<div class="grid">${rows.map(articleCard).join('')}</div>` : '<div class="empty">المقالات المقارنة ستظهر هنا تلقائيًا.</div>'}</section>`;
  return htmlResponse(shell(origin,path,title,desc,rows,hero,main,market,'mobiles'), 'comparison', {'x-commerce-comparison':key});
}

export async function commerceLanding(path, origin, env) {
  let m = path.match(/^\/en\/(saudi|uae)\/category\/([a-z0-9-]+)$/);
  if (m) return englishCategoryPage(m[1],m[2],origin,env);
  m = path.match(/^\/en\/(saudi|uae)$/);
  if (m) return englishCountryPage(m[1],origin,env);
  m = path.match(/^\/(saudi|uae)$/);
  if (m) return countryPage(m[1],origin,env);
  m = path.match(/^\/(saudi|uae)\/city\/([a-z0-9-]+)$/);
  if (m) return cityPage(m[1],m[2],origin,env);
  m = path.match(/^\/(saudi|uae)\/categories$/);
  if (m) return directoryPage(m[1], origin, env);
  m = path.match(/^\/(saudi|uae)\/category\/([a-z0-9-]+)$/);
  if (m) return categoryPage(m[1],m[2],origin,env);
  m = path.match(/^\/(saudi|uae)\/brand\/([a-z0-9-]+)$/);
  if (m) return brandPage(m[1],m[2],origin,env);
  m = path.match(/^\/(saudi|uae)\/model\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (m) return modelPage(m[1],m[2],m[3],origin,env);
  m = path.match(/^\/(saudi|uae)\/compare\/([a-z0-9-]+)$/);
  if (m) return comparisonPage(m[1],m[2],origin,env);
  return null;
}

export function commerceArticlePathHtml(article = {}) {
  const links = articleCommerceLinks(article);
  return `<section id="article-commerce-path" style="padding:30px 0;background:#eef2ff;border-top:1px solid #c7d2fe"><div style="width:min(940px,94%);margin:auto"><p style="font-weight:900;color:#6d28d9">استكمل داخل نفس شبكة الشراء</p><h2>القسم والبراند والمقالات المرتبطة</h2><div class="chips">${links.map((x) => `<a href="${x.path}">${esc(x.label)}</a>`).join('')}<a href="/blog">كل المقالات</a><a href="/">الرئيسية</a></div></div></section>`;
}

export function commerceNavHtml() {
  const keys = ['mobiles','electronics','computers','gaming','home-kitchen','beauty','shoes','bags','sports','automotive'];
  return `<section id="commerce-network-nav" style="padding:30px 0;background:#eef2ff"><div style="width:min(1180px,92%);margin:auto"><h2>تصفح أقسام نون</h2><p>ابدأ من السوق ثم القسم، وبعدها البراند والموديل والمقال المناسب.</p><div class="chips"><a href="/saudi-arabia/noon-coupon-code">كود خصم نون السعودية</a><a href="/uae/noon-coupon-code">كود خصم نون الإمارات</a><a href="/saudi/categories">أقسام السعودية</a><a href="/uae/categories">أقسام الإمارات</a>${keys.map((k) => `<a href="/saudi/category/${k}">${esc(CATEGORIES[k].label)}</a>`).join('')}</div></div></section>`;
}

export function commerceSitemap(origin) {
  const urls = commercePaths().map((path) => `<url><loc>${esc(origin + path)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300,s-maxage=300','x-commerce-network':'v2'}});
}

export function augmentCommerceSitemap(xml, origin) {
  if (!/<\/sitemapindex>/i.test(xml) || xml.includes('/sitemap-commerce.xml')) return xml;
  return xml.replace(/<\/sitemapindex>/i, `<sitemap><loc>${esc(origin)}/sitemap-commerce.xml</loc></sitemap></sitemapindex>`);
}

export {COMMERCE_TAXONOMY_INFO};
