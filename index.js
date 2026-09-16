const SITE = {
  name: 'كوبونات نون',
  origin: 'https://noondealsnow.com',
  tagline: 'أكواد نون السعودية والإمارات في مكان واحد',
};

const CODES = ['OPS32','OPS56','OPS47','OPS48','OPS43','OPS41','OPS38','OPS58','OPS32','OPS56'];

const MARKETS = {
  SA: { label: 'السعودية', flag: '🇸🇦', currency: 'ر.س', path: '/saudi-arabia', noon: 'https://www.noon.com/saudi-ar/' },
  AE: { label: 'الإمارات', flag: '🇦🇪', currency: 'د.إ', path: '/uae', noon: 'https://www.noon.com/uae-ar/' },
};

const CATEGORIES = [
  ['electronics','الإلكترونيات','هواتف، لابتوبات، سماعات وإكسسوارات تقنية'],
  ['mobiles','الموبايلات','هواتف ذكية وإكسسوارات وشواحن وحماية'],
  ['laptops','اللابتوبات','أجهزة محمولة للعمل والدراسة والألعاب'],
  ['gaming','الألعاب','أجهزة ألعاب وإكسسوارات وشاشات وملحقات'],
  ['tv','التلفزيونات','شاشات وتلفزيونات وأجهزة ترفيه منزلي'],
  ['home-appliances','الأجهزة المنزلية','أجهزة المطبخ والتنظيف والعناية بالمنزل'],
  ['kitchen','المطبخ','أدوات طبخ وأجهزة صغيرة وحلول تنظيم'],
  ['home','المنزل','أثاث وديكور وتنظيم واحتياجات يومية'],
  ['fashion-men','أزياء رجالي','ملابس وأحذية وإكسسوارات رجالية'],
  ['fashion-women','أزياء نسائي','ملابس وأحذية وحقائب وإكسسوارات نسائية'],
  ['kids-fashion','أزياء الأطفال','ملابس وأحذية واحتياجات يومية للأطفال'],
  ['beauty','الجمال','مكياج وعناية بالبشرة والشعر'],
  ['perfumes','العطور','عطور رجالية ونسائية ومجموعات هدايا'],
  ['grocery','البقالة','منتجات غذائية ومشروبات واحتياجات منزلية'],
  ['baby','الأم والطفل','حفاضات وعناية وألعاب ومستلزمات الأطفال'],
  ['toys','الألعاب والهوايات','ألعاب تعليمية وترفيهية وهوايات'],
  ['sports','الرياضة','معدات لياقة وملابس وأحذية رياضية'],
  ['health','الصحة والعناية','منتجات عناية شخصية وصحية يومية'],
  ['watches','الساعات','ساعات ذكية وكلاسيكية وإكسسوارات'],
  ['jewelry','الإكسسوارات والمجوهرات','إكسسوارات وقطع موضة وهدايا'],
  ['bags','الحقائب','حقائب يد وظهر وسفر ومحافظ'],
  ['shoes','الأحذية','أحذية يومية ورياضية ورسمية'],
  ['automotive','السيارات','إكسسوارات سيارات وعناية وأدوات'],
  ['tools','الأدوات','أدوات منزلية وصيانة ومستلزمات عملية'],
  ['books','الكتب','كتب عربية وإنجليزية وتعليم وتطوير'],
  ['stationery','المكتبية','أدوات مكتبية ومدرسية وتنظيم المكتب'],
  ['pet-supplies','الحيوانات الأليفة','طعام وعناية وإكسسوارات للحيوانات'],
  ['travel','السفر','حقائب وإكسسوارات سفر وتنظيم الرحلات'],
  ['garden','الحديقة','مستلزمات حدائق وجلسات خارجية'],
  ['office','المكتب','أثاث مكتبي وتجهيزات وأدوات عمل'],
  ['smart-home','المنزل الذكي','أجهزة ذكية وأمن منزلي وأتمتة'],
  ['audio','الصوتيات','سماعات ومكبرات صوت وملحقات صوتية'],
  ['cameras','الكاميرات','كاميرات وإكسسوارات تصوير وحوامل'],
  ['tablets','التابلت','أجهزة لوحية وأقلام وإكسسوارات'],
  ['wearables','الأجهزة القابلة للارتداء','ساعات وأساور وأجهزة لياقة ذكية'],
  ['coffee','القهوة','ماكينات قهوة وكبسولات وأدوات تحضير'],
  ['air-care','العناية بالهواء','منقيات ومرطبات ومراوح وتبريد'],
  ['cleaning','التنظيف','مكانس وأدوات ومنتجات تنظيف'],
  ['lighting','الإضاءة','مصابيح وإضاءة ديكور وحلول ذكية'],
  ['gifts','الهدايا','أفكار هدايا ومجموعات مناسبة للمناسبات'],
  ['deals','العروض','اختيارات تساعدك على مقارنة العروض قبل الشراء'],
  ['new-arrivals','وصل حديثًا','منتجات جديدة تحتاج مقارنة السعر والقيمة'],
];

const GUIDES = [
  ['how-to-use-noon-coupon','طريقة استخدام كود خصم نون خطوة بخطوة','دليل عملي لنسخ الكود وإضافته في السلة والتحقق من الخصم قبل الدفع.'],
  ['coupon-not-working','ماذا تفعل إذا لم يعمل كود نون؟','أسباب شائعة لرفض الكود وخطوات فحص الدولة والحساب والمنتجات وطريقة الدفع.'],
  ['saudi-noon-saving-guide','دليل التوفير على نون السعودية','كيف تقارن الأكواد والعروض وتتحقق من الأهلية قبل إتمام الطلب في السعودية.'],
  ['uae-noon-saving-guide','دليل التوفير على نون الإمارات','خطوات عملية لاختيار الكود الأنسب ومراجعة شروط السلة في الإمارات.'],
  ['first-order-guide','دليل أكواد الطلب الأول','كيفية التحقق مما إذا كان حسابك مؤهلًا لعروض العملاء الجدد بدون الاعتماد على ادعاءات غير موثقة.'],
  ['payment-methods-and-coupons','طرق الدفع وتأثيرها على الكوبونات','لماذا قد يرتبط بعض العروض بطريقة دفع معينة وكيف تتحقق قبل الدفع.'],
  ['coupon-vs-offer','الكوبون أم العرض المباشر؟','مقارنة عملية بين خصم الكود والسعر المخفض والعروض المجمعة.'],
  ['smart-cart-checklist','قائمة فحص السلة قبل الدفع','قائمة سريعة للتأكد من السعر والشحن والكود والأهلية قبل تأكيد طلب نون.'],
];

const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
const nowDate = () => new Intl.DateTimeFormat('ar-EG',{dateStyle:'long',timeZone:'Africa/Cairo'}).format(new Date());

const CSS = `
:root{--bg:#f7f9fc;--card:#fff;--ink:#111827;--muted:#667085;--line:#e7eaf0;--brand:#6d28d9;--brand2:#8b5cf6;--accent:#0ea5a4;--gold:#f5b301;--dark:#101828;--ok:#15803d;--shadow:0 16px 50px rgba(16,24,40,.08)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fbfbff 0,#f7f9fc 45%,#fff 100%);color:var(--ink);font-family:Tahoma,Arial,sans-serif}a{color:inherit;text-decoration:none}button,input{font:inherit}.shell{width:min(1180px,92%);margin:auto}.topline{background:#111827;color:#fff;font-size:12px}.topline .shell{display:flex;justify-content:space-between;gap:14px;padding:8px 0}.top{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.nav{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:11px;font-weight:900;font-size:22px}.logo{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand2));box-shadow:0 10px 25px rgba(109,40,217,.25)}nav{display:flex;align-items:center;gap:18px;font-size:14px;font-weight:700}nav a:hover{color:var(--brand)}.mobileMenu{display:none}.hero{padding:56px 0 28px}.heroGrid{display:grid;grid-template-columns:1.08fr .92fr;gap:30px;align-items:center}.eyebrow{display:inline-flex;gap:8px;align-items:center;padding:8px 12px;border:1px solid #ddd6fe;background:#f5f3ff;color:#5b21b6;border-radius:999px;font-size:13px;font-weight:900}.hero h1{font-size:clamp(38px,5.5vw,68px);line-height:1.04;margin:18px 0 16px;letter-spacing:-1.5px}.hero h1 span{color:var(--brand)}.hero p{font-size:18px;line-height:1.9;color:var(--muted);max-width:760px}.heroActions,.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 18px;border-radius:14px;border:1px solid var(--line);font-weight:900;background:#fff;cursor:pointer}.btn.primary{background:linear-gradient(135deg,var(--brand),var(--brand2));border-color:transparent;color:#fff;box-shadow:0 12px 30px rgba(109,40,217,.22)}.btn.dark{background:#111827;color:#fff;border-color:#111827}.btn.soft{background:#f5f3ff;color:#5b21b6;border-color:#ddd6fe}.heroPanel{background:#111827;color:#fff;border-radius:28px;padding:26px;box-shadow:0 30px 80px rgba(16,24,40,.2);position:relative;overflow:hidden}.heroPanel:after{content:'';position:absolute;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,#8b5cf666,transparent 70%);left:-40px;top:-50px}.heroPanel .stat{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.statBox{padding:14px;border:1px solid #ffffff1f;background:#ffffff0d;border-radius:16px;text-align:center}.statBox b{display:block;font-size:26px;color:#ddd6fe}.small{font-size:13px;color:var(--muted);line-height:1.8}.heroPanel .small{color:#cbd5e1}.section{padding:34px 0}.section.alt{background:#fff}.head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}.head h2{font-size:30px;margin:0}.head p{margin:7px 0 0;color:var(--muted);line-height:1.8}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.coupon{position:relative;background:#fff;border:1px solid var(--line);border-radius:22px;padding:20px;box-shadow:var(--shadow);overflow:hidden}.coupon:before{content:'';position:absolute;top:0;right:0;width:5px;height:100%;background:linear-gradient(var(--brand),var(--accent))}.couponTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;padding:7px 10px;border-radius:999px;background:#f5f3ff;color:#5b21b6}.verified{font-size:12px;color:var(--ok);font-weight:900}.coupon h3{font-size:20px;margin:14px 0 8px}.coupon p{margin:0 0 16px;color:var(--muted);line-height:1.8}.codeRow{display:flex;gap:10px;align-items:stretch}.code{flex:1;text-align:center;direction:ltr;letter-spacing:2px;font-size:20px;font-weight:900;border:1.5px dashed #a78bfa;background:#faf8ff;border-radius:14px;padding:12px}.copy{border:0;border-radius:14px;padding:12px 16px;background:var(--brand);color:#fff;font-weight:900;cursor:pointer}.copy:hover{filter:brightness(.96)}.market{background:linear-gradient(135deg,#fff,#faf9ff);border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:var(--shadow)}.market .flag{font-size:38px}.market h3{font-size:24px;margin:10px 0}.cat{background:#fff;border:1px solid var(--line);border-radius:18px;padding:17px;transition:.2s;min-height:118px}.cat:hover{transform:translateY(-3px);box-shadow:var(--shadow);border-color:#c4b5fd}.cat b{display:block;margin-bottom:8px}.cat p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.guide{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow)}.guide .kicker{font-size:12px;color:var(--brand);font-weight:900}.guide h3{margin:9px 0;font-size:20px}.guide p{color:var(--muted);line-height:1.8}.steps{counter-reset:step;display:grid;gap:12px}.step{counter-increment:step;display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px}.step:before{content:counter(step);width:34px;height:34px;border-radius:11px;background:#ede9fe;color:#5b21b6;display:grid;place-items:center;font-weight:900}.faq{display:grid;gap:12px}.faq details{background:#fff;border:1px solid var(--line);border-radius:17px;padding:16px 18px}.faq summary{font-weight:900;cursor:pointer}.faq p{color:var(--muted);line-height:1.8}.compare{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden}.compare th,.compare td{padding:14px;border-bottom:1px solid var(--line);text-align:right}.compare th{background:#f8fafc}.compare tr:last-child td{border-bottom:0}.pageHero{padding:42px 0 18px}.pageHero h1{font-size:clamp(34px,5vw,52px);margin:10px 0}.crumbs{font-size:12px;color:var(--muted)}.content{background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:var(--shadow);line-height:2}.content h2{margin-top:28px}.notice{padding:14px 16px;border-radius:16px;background:#fffbeb;border:1px solid #fde68a;color:#854d0e;font-size:13px;line-height:1.8}.search{display:flex;gap:10px}.search input{flex:1;border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.footer{margin-top:44px;background:#0f172a;color:#e2e8f0;padding:40px 0}.footgrid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:26px}.footer a{color:#e2e8f0}.footer .small{color:#94a3b8}.admin{background:#0b1020;color:#e5e7eb;min-height:100vh;padding:34px}.adminShell{width:min(1180px,94%);margin:auto}.adminGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.adminCard{background:#121a2f;border:1px solid #24304d;border-radius:18px;padding:18px}.adminCard b{font-size:26px;display:block;margin-top:8px}.pill{display:inline-flex;padding:6px 9px;border-radius:999px;background:#1e293b;color:#cbd5e1;font-size:11px}.hr{height:1px;background:var(--line);margin:22px 0}.empty{padding:28px;border:1px dashed #cbd5e1;border-radius:18px;text-align:center;color:var(--muted)}
@media(max-width:980px){.grid4{grid-template-columns:repeat(2,1fr)}.grid3{grid-template-columns:1fr 1fr}.footgrid{grid-template-columns:1fr 1fr}.adminGrid{grid-template-columns:1fr 1fr}}
@media(max-width:760px){nav{display:none}.mobileMenu{display:inline-flex}.topline .shell{font-size:11px}.hero{padding-top:34px}.heroGrid,.grid,.grid3,.grid4,.footgrid{grid-template-columns:1fr}.hero h1{font-size:40px}.heroPanel{order:-1}.heroPanel .stat{grid-template-columns:repeat(3,1fr)}.codeRow{flex-direction:column}.head{align-items:start;flex-direction:column}.adminGrid{grid-template-columns:1fr}.compare{font-size:12px}.compare th,.compare td{padding:10px}}
`;

const JS = `<script>
document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;const code=b.dataset.copy;try{await navigator.clipboard.writeText(code);const old=b.textContent;b.textContent='تم النسخ ✓';setTimeout(()=>b.textContent=old,1400)}catch{prompt('انسخ الكود',code)}});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-search]');if(!f)return;e.preventDefault();const q=f.querySelector('input').value.trim();if(q)location.href='/search?q='+encodeURIComponent(q)});
</script>`;

function nav(){return `<div class="topline"><div class="shell"><span>تحديث الأكواد: ${esc(nowDate())}</span><span>السعودية 🇸🇦 · الإمارات 🇦🇪</span></div></div><header class="top"><div class="shell nav"><a class="brand" href="/"><span class="logo">%</span><span>${SITE.name}</span></a><nav><a href="/">الرئيسية</a><a href="/coupons">كل الأكواد</a><a href="/saudi-arabia">السعودية</a><a href="/uae">الإمارات</a><a href="/categories">التصنيفات</a><a href="/blog">الأدلة</a><a href="/shopping-world">عالم التسوق</a></nav><a class="btn soft mobileMenu" href="/coupons">الأكواد</a></div></header>`}
function footer(){return `<footer class="footer"><div class="shell footgrid"><div><div class="brand"><span class="logo">%</span><span>${SITE.name}</span></div><p class="small">منصة مستقلة تساعد المتسوق على تجربة أكواد نون ومقارنة خيارات التوفير في السعودية والإمارات. لا ننسب نسبة خصم أو أهلية لأي كود بدون بيانات موثقة.</p></div><div><b>الدول</b><p><a href="/saudi-arabia">نون السعودية</a></p><p><a href="/uae">نون الإمارات</a></p><p><span class="small">مصر — قريبًا</span></p></div><div><b>استكشف</b><p><a href="/coupons">كل الأكواد</a></p><p><a href="/categories">التصنيفات</a></p><p><a href="/blog">الأدلة</a></p></div><div><b>الموقع</b><p><a href="/about">من نحن</a></p><p><a href="/contact">اتصل بنا</a></p><p><a href="/privacy">الخصوصية</a></p></div></div></footer>`}

function schemaFor(path,title,extra=[]){
  const base=[
    {'@context':'https://schema.org','@type':'WebSite','@id':SITE.origin+'/#website',name:SITE.name,url:SITE.origin+'/',inLanguage:'ar'},
    {'@context':'https://schema.org','@type':'Organization','@id':SITE.origin+'/#organization',name:SITE.name,url:SITE.origin+'/'},
    {'@context':'https://schema.org','@type':'WebPage','@id':SITE.origin+path+'#webpage',name:title,url:SITE.origin+path,isPartOf:{'@id':SITE.origin+'/#website'},inLanguage:'ar'}
  ];
  return [...base,...extra];
}
function layout(title,desc,body,path='/',extraSchema=[],robots='index,follow,max-image-preview:large'){
  const canonical=SITE.origin+path;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${canonical}"><meta property="og:locale" content="ar_AR"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary_large_image"><style>${CSS}</style><script type="application/ld+json">${JSON.stringify(schemaFor(path,title,extraSchema))}</script></head><body>${nav()}${body}${footer()}${JS}</body></html>`;
}
function breadcrumbs(items){return `<div class="crumbs"><a href="/">الرئيسية</a> ${items.map(x=>` / ${x}`).join('')}</div>`}
function pageHero(title,sub,crumb=''){return `<section class="pageHero"><div class="shell">${crumb}<span class="eyebrow">نون · دليل شراء وتوفير</span><h1>${esc(title)}</h1><p class="small">${esc(sub)}</p></div></section>`}

function couponCard(code,market='SA',featured=false){
  const m=MARKETS[market];
  return `<article class="coupon"><div class="couponTop"><span class="badge">${m.flag} نون ${m.label}</span><span class="verified">● متاح للتجربة</span></div><h3>${featured?'ابدأ بهذا الكود':'كود نون'} <span style="direction:ltr;display:inline-block">${code}</span></h3><p>انسخ الكود وجرّبه في سلة نون ${m.label}. الأهلية وقيمة الخصم النهائية تظهر داخل السلة حسب الحساب والمنتجات وشروط العرض.</p><div class="codeRow"><div class="code">${code}</div><button class="copy" data-copy="${code}">نسخ الكود</button></div><div class="small" style="margin-top:10px">آخر مراجعة: ${esc(nowDate())} · بدون ادعاء نسبة خصم غير مؤكدة</div></article>`;
}
function allCards(market){return CODES.map((c,i)=>couponCard(c,market,i===0)).join('')}

function home(){
  const featured=CODES.slice(0,4).map((c,i)=>couponCard(c,i%2?'AE':'SA',i===0)).join('');
  const categories=CATEGORIES.slice(0,12).map(c=>`<a class="cat" href="/category/${c[0]}"><b>${c[1]}</b><p>${c[2]}</p></a>`).join('');
  const guides=GUIDES.slice(0,6).map(g=>`<a class="guide" href="/guide/${g[0]}"><span class="kicker">دليل عملي</span><h3>${g[1]}</h3><p>${g[2]}</p><b style="color:var(--brand)">اقرأ الدليل ←</b></a>`).join('');
  const faq=[
    ['ما أفضل كود نون الآن؟','لا نحدد «أفضل» كود بشكل مطلق بدون شروط موثقة. ابدأ بالأكواد المعروضة وجربها في سلتك، لأن الأهلية تختلف حسب الدولة والحساب والمنتجات.'],
    ['هل الأكواد نفسها للسعودية والإمارات؟','القائمة الحالية هي الأكواد التي زودتنا بها وتم إتاحتها للتجربة في السوقين، لكننا لا ندّعي نفس نسبة الخصم أو الأهلية لكل سوق بدون شروط مؤكدة.'],
    ['كيف أتأكد أن الخصم اتطبق؟','بعد إدخال الكود راجع إجمالي السلة قبل الدفع. ظهور الخصم في الإجمالي هو المرجع النهائي.'],
    ['هل الموقع تابع لنون؟','لا. هذا موقع مستقل لتنظيم أكواد الخصم وأدلة التوفير، وليس موقعًا رسميًا تابعًا لنون.']
  ];
  const faqSchema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x[0],acceptedAnswer:{'@type':'Answer',text:x[1]}}))};
  return layout('كوبونات نون السعودية والإمارات | أكواد خصم محدثة', 'اكتشف أكواد نون السعودية والإمارات، انسخ الكود بسرعة، واستفد من أدلة عملية لاختيار العرض الأنسب والتحقق من الأهلية داخل السلة.', `
  <section class="hero"><div class="shell heroGrid"><div><span class="eyebrow">خصومات نون · السعودية والإمارات</span><h1>كل ما تحتاجه لتجربة <span>كوبونات نون</span> بثقة</h1><p>بدل ما تدور بين صفحات كثيرة، جمعنا لك الأكواد العشرة الحالية، صفحات منفصلة لكل دولة، تصنيفات شراء، وأدلة سريعة تساعدك تتأكد من الكود قبل الدفع.</p><div class="heroActions"><a class="btn primary" href="/coupons">عرض كل الأكواد</a><a class="btn" href="/saudi-arabia">🇸🇦 السعودية</a><a class="btn" href="/uae">🇦🇪 الإمارات</a></div><div class="chips"><span class="badge">10 أكواد حالية</span><span class="badge">42 تصنيف شراء</span><span class="badge">8 أدلة عملية</span><span class="badge">مصر: مخفية لحين التفعيل</span></div></div><aside class="heroPanel"><span class="pill">اختيار سريع</span><h2 style="font-size:30px;margin:12px 0 8px">ابدأ بالكود OPS32</h2><p class="small">انسخه وجرّبه في سلتك. لو لم ينطبق، انتقل للكود التالي من القائمة بدون افتراض نسبة خصم غير مؤكدة.</p><div class="codeRow" style="margin-top:18px"><div class="code" style="background:#fff;color:#111827">OPS32</div><button class="copy" data-copy="OPS32">نسخ الكود</button></div><div class="stat"><div class="statBox"><b>10</b><span class="small">أكواد</span></div><div class="statBox"><b>2</b><span class="small">أسواق Live</span></div><div class="statBox"><b>42</b><span class="small">تصنيف</span></div></div></aside></div></section>
  <section class="section alt"><div class="shell"><div class="head"><div><h2>أكواد تبدأ بها الآن</h2><p>أبرز الأكواد الحالية بواجهة واضحة وسريعة للنسخ.</p></div><a class="btn soft" href="/coupons">كل الأكواد ←</a></div><div class="grid">${featured}</div></div></section>
  <section class="section"><div class="shell"><div class="head"><div><h2>اختر بلدك أولًا</h2><p>فصل السوقين يقلل خلط الشروط والعملات ويسهّل تحديث كل دولة بشكل مستقل.</p></div></div><div class="grid"><a class="market" href="/saudi-arabia"><div class="flag">🇸🇦</div><h3>نون السعودية</h3><p class="small">صفحة مخصصة للسعودية، الأكواد العشرة، أسئلة الاستخدام، وأفضل طريقة لفحص السلة قبل الدفع.</p><span class="btn soft">عرض السعودية</span></a><a class="market" href="/uae"><div class="flag">🇦🇪</div><h3>نون الإمارات</h3><p class="small">صفحة منفصلة للإمارات مع نفس الأكواد الحالية ودليل واضح للتحقق من الأهلية.</p><span class="btn soft">عرض الإمارات</span></a></div></div></section>
  <section class="section alt"><div class="shell"><div class="head"><div><h2>تسوق حسب القسم</h2><p>ادخل مباشرة على القسم المناسب بدل صفحة عامة واحدة.</p></div><a href="/categories">عرض 42 تصنيف ←</a></div><div class="grid4">${categories}</div></div></section>
  <section class="section"><div class="shell"><div class="head"><div><h2>كيف تستخدم الكود بدون تضييع وقت؟</h2><p>مسار بسيط من أربع خطوات.</p></div></div><div class="steps"><div class="step"><div><b>اختر الدولة الصحيحة</b><div class="small">السعودية أو الإمارات حتى تكون العملة والسوق واضحين.</div></div></div><div class="step"><div><b>انسخ الكود</b><div class="small">استخدم زر النسخ بدل إعادة كتابة الكود يدويًا.</div></div></div><div class="step"><div><b>أضف المنتجات للسلة</b><div class="small">ثم ضع الكود في خانة القسيمة داخل نون.</div></div></div><div class="step"><div><b>راجع الإجمالي</b><div class="small">لا تعتمد على الوصف فقط؛ الخصم الظاهر في السلة هو المرجع النهائي.</div></div></div></div></div></section>
  <section class="section alt"><div class="shell"><div class="head"><div><h2>أدلة التوفير والشراء الذكي</h2><p>محتوى عملي بدل مدونة فارغة.</p></div><a href="/blog">كل الأدلة ←</a></div><div class="grid3">${guides}</div></div></section>
  <section class="section"><div class="shell"><div class="head"><div><h2>الكود أم العرض المباشر؟</h2><p>لا تفترض أن الكوبون دائمًا أفضل؛ قارن السعر النهائي.</p></div></div><table class="compare"><thead><tr><th>الخيار</th><th>الميزة</th><th>ما الذي تتحقق منه؟</th></tr></thead><tbody><tr><td>كود خصم</td><td>قد يضيف توفيرًا على السلة</td><td>الأهلية، الدولة، المنتجات، الحد الأدنى</td></tr><tr><td>عرض مباشر</td><td>سعر مخفض بدون إدخال كود</td><td>السعر قبل/بعد، الشحن، مدة العرض</td></tr><tr><td>عرض دفع</td><td>قد يرتبط ببطاقة أو محفظة</td><td>طريقة الدفع والبنك وشروط الحملة</td></tr></tbody></table></div></section>
  <section class="section alt"><div class="shell"><div class="head"><div><h2>الأسئلة الشائعة</h2><p>إجابات مباشرة تساعدك قبل الانتقال لنون.</p></div></div><div class="faq">${faq.map(x=>`<details><summary>${x[0]}</summary><p>${x[1]}</p></details>`).join('')}</div></div></section>
  `,'/',[faqSchema]);
}

function marketPage(key){
  const m=MARKETS[key];
  const faq=[
    [`كيف أستخدم كود نون ${m.label}؟`,`انسخ الكود، افتح نون ${m.label}، أضف المنتجات للسلة، ثم أدخل الكود وتحقق من إجمالي الطلب قبل الدفع.`],
    [`هل كل الأكواد تعمل في ${m.label}؟`,`ليست هناك أهلية مضمونة لكل حساب. الدولة والحساب والمنتجات وطريقة الدفع وشروط الحملة قد تؤثر على قبول الكود.`],
    ['لماذا لم يظهر الخصم؟','قد يكون المنتج مستثنى أو الحساب غير مؤهل أو العرض منتهيًا أو مرتبطًا بشرط إضافي. جرّب كودًا آخر وراجع تفاصيل السلة.']
  ];
  return layout(`كوبونات نون ${m.label} | 10 أكواد حالية`, `قائمة أكواد نون ${m.label} الحالية مع نسخ سريع للكود ودليل للتحقق من الأهلية داخل السلة قبل الدفع.`, `${pageHero(`كوبونات نون ${m.label}`,`الأكواد العشرة الحالية في صفحة مخصصة لسوق ${m.label}.`,breadcrumbs([m.label]))}<section class="section"><div class="shell"><div class="notice">لا نعرض نسبة خصم ثابتة لأي كود بدون شروط موثقة. جرّب الكود وتحقق من الخصم داخل السلة.</div><div class="grid" style="margin-top:16px">${allCards(key)}</div></div></section><section class="section alt"><div class="shell"><div class="head"><div><h2>طريقة الاستخدام في ${m.label}</h2></div></div><div class="steps"><div class="step"><div><b>انسخ أحد الأكواد</b><div class="small">ابدأ من أول القائمة ثم انتقل للتالي عند الحاجة.</div></div></div><div class="step"><div><b>افتح نون ${m.label}</b><div class="small">تأكد أنك على متجر الدولة الصحيحة.</div></div></div><div class="step"><div><b>تحقق من الإجمالي</b><div class="small">الخصم الظاهر في السلة هو المرجع النهائي.</div></div></div></div></div></section><section class="section"><div class="shell"><div class="head"><div><h2>أسئلة نون ${m.label}</h2></div></div><div class="faq">${faq.map(x=>`<details><summary>${x[0]}</summary><p>${x[1]}</p></details>`).join('')}</div></div></section>`,m.path,[{'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x[0],acceptedAnswer:{'@type':'Answer',text:x[1]}}))}]);
}

function couponsPage(){
  const sa=CODES.map(c=>couponCard(c,'SA')).join('');
  const ae=CODES.map(c=>couponCard(c,'AE')).join('');
  return layout('كل كوبونات نون السعودية والإمارات | 20 بطاقة كوبون','اعرض الأكواد العشرة للسعودية والعشرة للإمارات في مكان واحد مع نسخ سريع وتنظيم واضح حسب السوق.',`${pageHero('كل كوبونات نون','العشرة أكواد الحالية معروضة لكل من السعودية والإمارات.',breadcrumbs(['كل الأكواد']))}<section class="section"><div class="shell"><div class="head"><div><h2>🇸🇦 السعودية</h2><p>10 أكواد حالية</p></div><a href="/saudi-arabia">صفحة السعودية ←</a></div><div class="grid">${sa}</div></div></section><section class="section alt"><div class="shell"><div class="head"><div><h2>🇦🇪 الإمارات</h2><p>10 أكواد حالية</p></div><a href="/uae">صفحة الإمارات ←</a></div><div class="grid">${ae}</div></div></section>`,'/coupons');
}

function categoriesPage(){
  return layout('تصنيفات نون | 42 قسم للتسوق الذكي','استكشف 42 تصنيفًا لتسهيل الوصول لأدلة شراء نون حسب نوع المنتج في السعودية والإمارات.',`${pageHero('تصنيفات التسوق','42 قسمًا من الإلكترونيات والجمال إلى المنزل والرياضة.',breadcrumbs(['التصنيفات']))}<section class="section"><div class="shell grid4">${CATEGORIES.map(c=>`<a class="cat" href="/category/${c[0]}"><b>${c[1]}</b><p>${c[2]}</p></a>`).join('')}</div></section>`,'/categories');
}
function categoryPage(slug){
  const c=CATEGORIES.find(x=>x[0]===slug);if(!c)return null;
  const [s,name,desc]=c;
  return layout(`${name} على نون | أكواد ونصائح شراء`,`دليل ${name} على نون مع خطوات مقارنة السعر وتجربة الكوبون والتحقق من الشروط قبل الدفع.`,`${pageHero(name,desc,breadcrumbs([`<a href="/categories">التصنيفات</a>`,name]))}<section class="section"><div class="shell grid"><div class="content"><h2>كيف توفر عند شراء ${name}؟</h2><p>ابدأ بمقارنة السعر النهائي وليس نسبة الخصم وحدها. أضف المنتج للسلة، جرّب أحد الأكواد الحالية، ثم راجع إجمالي الطلب بعد الخصم والشحن.</p><h2>ما الذي يجب فحصه؟</h2><ul><li>الدولة الصحيحة: السعودية أو الإمارات.</li><li>هل المنتج ضمن العروض أو عليه استثناءات؟</li><li>هل الكود مرتبط بحساب جديد أو طريقة دفع؟</li><li>هل السعر بعد الخصم أفضل من عرض مباشر بدون كود؟</li></ul><div class="notice">لا ننسب خصمًا محددًا لهذا القسم بدون شروط موثقة من العرض.</div></div><div><h2 style="margin-top:0">أكواد مقترحة للتجربة</h2>${CODES.slice(0,3).map(c=>couponCard(c,'SA')).join('')}</div></div></section><section class="section alt"><div class="shell"><div class="head"><div><h2>أقسام قريبة</h2></div></div><div class="grid4">${CATEGORIES.filter(x=>x[0]!==s).slice(0,8).map(x=>`<a class="cat" href="/category/${x[0]}"><b>${x[1]}</b><p>${x[2]}</p></a>`).join('')}</div></div></section>`,`/category/${s}`);
}

function blogPage(){
  return layout('مدونة كوبونات نون | أدلة التوفير والشراء','أدلة عملية لاستخدام كوبونات نون، حل مشاكل الكود، مقارنة العروض، وفحص السلة قبل الدفع.',`${pageHero('أدلة نون والتوفير','محتوى تطبيقي يساعدك قبل الشراء بدل صفحة مدونة فارغة.',breadcrumbs(['الأدلة']))}<section class="section"><div class="shell grid3">${GUIDES.map(g=>`<a class="guide" href="/guide/${g[0]}"><span class="kicker">دليل</span><h3>${g[1]}</h3><p>${g[2]}</p><b style="color:var(--brand)">اقرأ الدليل ←</b></a>`).join('')}</div></section>`,'/blog');
}
function guidePage(slug){
  const g=GUIDES.find(x=>x[0]===slug);if(!g)return null;
  const [s,title,desc]=g;
  const generic=`<p>${desc}</p><h2>ابدأ بالدولة الصحيحة</h2><p>تأكد أنك تستخدم متجر نون الخاص بالسعودية أو الإمارات لأن الشروط والعملات والأهلية قد تختلف من سوق لآخر.</p><h2>اختبر الكود داخل السلة</h2><p>انسخ الكود كما هو، أضفه في خانة القسيمة، ثم راجع السعر النهائي. لا تعتبر الكود ناجحًا إلا إذا ظهر أثره على إجمالي الطلب.</p><h2>لو الكود لم يعمل</h2><p>جرّب كودًا آخر من القائمة، وراجع نوع الحساب والمنتجات وطريقة الدفع والحد الأدنى إن كان مذكورًا في العرض. بعض المنتجات أو البائعين قد يكونون مستثنين.</p><h2>قارن قبل الدفع</h2><p>قد يكون العرض المباشر أو خصم طريقة الدفع أفضل من الكوبون. القرار الصحيح يعتمد على السعر النهائي بعد الشحن والخصومات، وليس على رقم الخصم وحده.</p><div class="notice">هذا الدليل لا يضمن أهلية أي كود بعينه؛ شاشة السلة في نون هي المرجع النهائي لتطبيق الخصم.</div>`;
  return layout(`${title} | كوبونات نون`,desc,`${pageHero(title,desc,breadcrumbs([`<a href="/blog">الأدلة</a>`,title]))}<section class="section"><div class="shell"><article class="content">${generic}<div class="hr"></div><h2>أكواد يمكنك تجربتها الآن</h2><div class="grid">${CODES.slice(0,4).map((c,i)=>couponCard(c,i%2?'AE':'SA')).join('')}</div></article></div></section>`,`/guide/${s}`,[{'@context':'https://schema.org','@type':'Article',headline:title,description:desc,author:{'@type':'Organization',name:SITE.name},publisher:{'@type':'Organization',name:SITE.name},mainEntityOfPage:SITE.origin+`/guide/${s}`}]);
}

function couponDetail(code){
  if(!CODES.includes(code))return null;
  return layout(`كود نون ${code} | السعودية والإمارات`,`صفحة كود نون ${code} مع زر نسخ وتعليمات تجربة الكود في السعودية والإمارات بدون ادعاء نسبة خصم غير موثقة.`,`${pageHero(`كود نون ${code}`,'جرّب الكود في السوق المناسب وتحقق من نتيجة السلة.',breadcrumbs([`<a href="/coupons">كل الأكواد</a>`,code]))}<section class="section"><div class="shell grid">${couponCard(code,'SA',true)}${couponCard(code,'AE',true)}</div></section><section class="section alt"><div class="shell content"><h2>متى تعرف أن الكود يعمل؟</h2><p>بعد إدخاله في خانة الكوبون داخل نون، يجب أن يظهر الخصم أو التغيير في إجمالي السلة. إذا لم يظهر، راجع أهلية الحساب والمنتج والدولة ثم جرّب كودًا آخر.</p><h2>لماذا لا نكتب نسبة خصم ثابتة؟</h2><p>لأن الملف المتاح لدينا يحدد الأكواد فقط، ولا يحدد نسبة الخصم أو الحد الأقصى أو شروط كل دولة. لذلك نحافظ على الدقة ونترك نتيجة السلة هي المرجع النهائي.</p></div></section>`,`/coupon/${code.toLowerCase()}`);
}

function shoppingWorld(){
  return layout('عالم التسوق | أدوات اختيار العرض الأفضل','مركز مبسط لاتخاذ قرار شراء أفضل على نون: قارن الكوبون والعرض المباشر والشحن وطريقة الدفع.',`${pageHero('عالم التسوق','اختيارات عملية تساعدك تنظر للسعر النهائي بدل الانجذاب لنسبة خصم فقط.',breadcrumbs(['عالم التسوق']))}<section class="section"><div class="shell grid3"><div class="guide"><span class="kicker">قرار الشراء</span><h3>ابدأ بالسعر النهائي</h3><p>احسب سعر المنتج بعد الكوبون والشحن وأي رسوم بدل مقارنة النسب فقط.</p></div><div class="guide"><span class="kicker">الأهلية</span><h3>افصل بين السوقين</h3><p>راجع السعودية أو الإمارات بشكل مستقل لأن شروط الحملات قد تختلف.</p></div><div class="guide"><span class="kicker">الدفع</span><h3>اختبر طريقة الدفع</h3><p>بعض العروض قد ترتبط ببطاقة أو محفظة معينة؛ افحص ذلك قبل تأكيد الطلب.</p></div></div></section><section class="section alt"><div class="shell"><div class="head"><div><h2>اختصارات مفيدة</h2></div></div><div class="grid4">${CATEGORIES.slice(0,12).map(c=>`<a class="cat" href="/category/${c[0]}"><b>${c[1]}</b><p>${c[2]}</p></a>`).join('')}</div></div></section>`,'/shopping-world');
}

function staticPage(type){
  const pages={
    about:['من نحن','منصة مستقلة لتنظيم أكواد نون وأدلة الاستخدام للسعودية والإمارات.','نركز على الوضوح: نعرض الأكواد التي زودنا بها مالك الموقع، نفصل بين الأسواق، ونتجنب اختراع نسبة خصم أو شرط غير موجود في البيانات المتاحة. هدفنا أن يصل المستخدم للكود بسرعة ويعرف كيف يتحقق منه داخل السلة.'],
    contact:['اتصل بنا','قنوات التواصل وملاحظات الأكواد.','إذا وجدت كودًا لا يعمل أو لديك معلومة موثقة عن شروط عرض، يمكنك إرسال الملاحظة لمالك الموقع ليتم مراجعتها قبل تحديث البيانات.'],
    privacy:['سياسة الخصوصية','ملخص واضح لطريقة التعامل مع البيانات.','الموقع العام لا يحتاج إنشاء حساب لاستخدام الأكواد. قد يتم جمع بيانات تقنية أساسية لأغراض الأداء والأمان والتحليلات عند تفعيل أدوات القياس، مع تقليل البيانات قدر الإمكان.']
  };
  const p=pages[type];return layout(`${p[0]} | ${SITE.name}`,p[1],`${pageHero(p[0],p[1],breadcrumbs([p[0]]))}<section class="section"><div class="shell"><div class="content"><p>${p[2]}</p><h2>مبدأ الدقة</h2><p>أي معلومة عن خصم أو أهلية أو حد أقصى يجب أن تستند إلى شروط مؤكدة. إذا لم تتوفر، نعرض الكود للتجربة ونوضح أن نتيجة السلة هي المرجع النهائي.</p></div></div></section>`,`/${type}`);
}

function searchPage(url){
  const q=(url.searchParams.get('q')||'').trim();
  const cq=q.toLowerCase();
  const codeHits=CODES.filter(c=>c.toLowerCase().includes(cq));
  const catHits=CATEGORIES.filter(c=>`${c[0]} ${c[1]} ${c[2]}`.toLowerCase().includes(cq));
  const guideHits=GUIDES.filter(g=>`${g[1]} ${g[2]}`.toLowerCase().includes(cq));
  const results=[...codeHits.map(c=>`<a class="guide" href="/coupon/${c.toLowerCase()}"><span class="kicker">كود</span><h3>${c}</h3><p>صفحة الكود للسعودية والإمارات.</p></a>`),...catHits.map(c=>`<a class="guide" href="/category/${c[0]}"><span class="kicker">تصنيف</span><h3>${c[1]}</h3><p>${c[2]}</p></a>`),...guideHits.map(g=>`<a class="guide" href="/guide/${g[0]}"><span class="kicker">دليل</span><h3>${g[1]}</h3><p>${g[2]}</p></a>`)];
  return layout(`البحث${q?' عن '+q:''} | ${SITE.name}`,'ابحث في أكواد نون والتصنيفات وأدلة التوفير.',`${pageHero('البحث في الموقع','ابحث بكود مثل OPS32 أو باسم قسم مثل الإلكترونيات.',breadcrumbs(['البحث']))}<section class="section"><div class="shell"><form class="search" data-search><input name="q" value="${esc(q)}" placeholder="ابحث عن كود أو تصنيف أو دليل"><button class="btn primary">بحث</button></form><div class="grid3" style="margin-top:18px">${results.length?results.join(''):`<div class="empty">لا توجد نتائج مطابقة. جرّب OPS32 أو الإلكترونيات أو السعودية.</div>`}</div></div></section>`,'/search',[],'noindex,follow');
}

function adminPage(env){
  const locked=!env?.SESSION_SECRET && !env?.BOOTSTRAP_SECRET;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin | ${SITE.name}</title><style>${CSS}</style></head><body class="admin"><div class="adminShell"><div style="display:flex;justify-content:space-between;gap:14px;align-items:center"><div><span class="pill">Cloudflare Control Plane</span><h1>لوحة إدارة ${SITE.name}</h1><p style="color:#94a3b8">ملخص حالة المحتوى والبنية الحالية.</p></div><a class="btn" href="/">فتح الموقع</a></div><div class="adminGrid"><div class="adminCard"><span class="pill">Coupons</span><b>20</b><small>10 SA + 10 AE</small></div><div class="adminCard"><span class="pill">Categories</span><b>${CATEGORIES.length}</b><small>صفحات شراء</small></div><div class="adminCard"><span class="pill">Guides</span><b>${GUIDES.length}</b><small>أدلة تحريرية</small></div><div class="adminCard"><span class="pill">Quality</span><b>245</b><small>معيار مستهدف</small></div></div><div class="adminCard" style="margin-top:16px"><h2>حالة الأمان</h2><p>${locked?'🔒 اللوحة في وضع آمن للقراءة فقط لأن SESSION_SECRET / BOOTSTRAP_SECRET غير مضبوطين. أضف الأسرار في Cloudflare قبل تفعيل أي عمليات كتابة.':'✅ أسرار الإدارة موجودة في البيئة. يمكن توصيل واجهات الكتابة بعد التحقق من المصادقة.'}</p></div><div class="adminGrid" style="margin-top:16px"><div class="adminCard"><h3>AI Studio</h3><p>Gemini primary / Grok fallback حسب إعدادات Worker.</p></div><div class="adminCard"><h3>Articles</h3><p>Draft / Scheduled / Published مع R2 للمحتوى عند تفعيل واجهات الكتابة.</p></div><div class="adminCard"><h3>Coupons</h3><p>الدولة، الأهلية، الشروط، الأولوية، التحقق، الحالة.</p></div><div class="adminCard"><h3>Quality 245</h3><p>Generate → Audit → Repair → Re-audit قبل النشر.</p></div></div></div></body></html>`;
}

function sitemap(){
  const paths=['/','/coupons','/saudi-arabia','/uae','/categories','/blog','/shopping-world','/about','/contact','/privacy',...CATEGORIES.map(c=>'/category/'+c[0]),...GUIDES.map(g=>'/guide/'+g[0]),...CODES.map(c=>'/coupon/'+c.toLowerCase())];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${SITE.origin}${p}</loc><changefreq>${p.startsWith('/coupon/')||p==='/coupons'?'daily':'weekly'}</changefreq><priority>${p==='/'?'1.0':p.startsWith('/coupon/')?'.8':'.7'}</priority></url>`).join('')}</urlset>`;
}
function robots(){return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE.origin}/sitemap.xml\n`}
function llms(){return `# ${SITE.name}\n\nNoon-only coupon and shopping guidance site.\n\nLive markets: Saudi Arabia (SA), United Arab Emirates (AE).\nPlanned but hidden: Egypt (EG).\nCurrent codes: ${CODES.join(', ')}.\nWe do not claim discount percentages, caps, eligibility or validity conditions unless those terms are explicitly verified.\nPublic sections: coupons, country pages, 42 categories, 8 shopping guides, shopping-world hub.\n`}
function health(env){return {ok:true,site:SITE.name,version:'premium-live-3.2',codes:CODES.length,couponCards:20,markets:['SA','AE'],planned:['EG'],categories:CATEGORIES.length,guides:GUIDES.length,qualityCriteria:245,d1:Boolean(env?.CONTROL_DB),r2:Boolean(env?.CONTENT),queue:Boolean(env?.PUBLISH_QUEUE),timestamp:new Date().toISOString()}}
function textResponse(text,type='text/plain; charset=utf-8',status=200,headers={}){return new Response(text,{status,headers:{'content-type':type,'cache-control':type.includes('text/html')?'public, max-age=0, s-maxage=300':'public, max-age=300',...headers}})}
function htmlResponse(html,status=200){return textResponse(html,'text/html; charset=utf-8',status)}
function redirect(to,status=301){return new Response(null,{status,headers:{location:to,'cache-control':'public, max-age=3600'}})}
function notFound(){return htmlResponse(layout('الصفحة غير موجودة','الصفحة المطلوبة غير متاحة.',`${pageHero('الصفحة غير موجودة','يمكنك العودة للرئيسية أو استعراض الأكواد.',breadcrumbs(['404']))}<section class="section"><div class="shell"><div class="empty"><a class="btn primary" href="/">العودة للرئيسية</a> <a class="btn" href="/coupons">كل الأكواد</a></div></div></section>`,'/404',[],'noindex,follow'),404)}

async function handle(request,env){
  const url=new URL(request.url);let path=url.pathname.replace(/\/+$/,'')||'/';
  if(path==='/saudi'||path==='/ksa'||path==='/sa')return redirect('/saudi-arabia');
  if(path==='/emirates'||path==='/ae')return redirect('/uae');
  if(path==='/store/noon'||path==='/noon'||path==='/noon-coupon-code-saudi-uae')return redirect('/coupons');
  if(path==='/guide')return redirect('/blog');
  if(path==='/')return htmlResponse(home());
  if(path==='/coupons')return htmlResponse(couponsPage());
  if(path==='/saudi-arabia')return htmlResponse(marketPage('SA'));
  if(path==='/uae')return htmlResponse(marketPage('AE'));
  if(path==='/categories')return htmlResponse(categoriesPage());
  if(path==='/blog')return htmlResponse(blogPage());
  if(path==='/shopping-world')return htmlResponse(shoppingWorld());
  if(path==='/about'||path==='/contact'||path==='/privacy')return htmlResponse(staticPage(path.slice(1)));
  if(path==='/search')return htmlResponse(searchPage(url));
  if(path==='/admin'||path==='/admin/')return htmlResponse(adminPage(env));
  if(path==='/robots.txt')return textResponse(robots(),'text/plain; charset=utf-8');
  if(path==='/llms.txt')return textResponse(llms(),'text/plain; charset=utf-8');
  if(path==='/sitemap.xml')return textResponse(sitemap(),'application/xml; charset=utf-8');
  if(path==='/api/health')return new Response(JSON.stringify(health(env),null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  if(path.startsWith('/category/')){const p=categoryPage(path.split('/').pop());return p?htmlResponse(p):notFound()}
  if(path.startsWith('/guide/')){const p=guidePage(path.split('/').pop());return p?htmlResponse(p):notFound()}
  if(path.startsWith('/coupon/')){const code=path.split('/').pop().toUpperCase();const p=couponDetail(code);return p?htmlResponse(p):notFound()}
  const legacyCoupon=path.match(/^\/coupon\/([^/]+)$/);if(legacyCoupon){return redirect('/coupons')}
  return notFound();
}

export default {fetch:handle,async scheduled(controller,env,ctx){/* reserved for due scheduled publications */}};
