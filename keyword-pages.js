const UPDATED='2026-09-15';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');

const TARGETS={
  '/':{
    title:'كود خصم نون 2026 | أكواد خصم نون السعودية والإمارات',
    description:'كود خصم نون وأكواد خصم نون للسعودية والإمارات مع طريقة تحقق واضحة قبل الدفع، وصفحات مستقلة لكل سوق بدون ادعاءات خصم غير موثقة.',
    h1:'كود خصم نون: أكواد نون للسعودية والإمارات',intent:'core-noon-coupon'
  },
  '/coupons':{
    title:'كوبونات نون وأكواد نون الحالية | السعودية والإمارات',
    description:'كوبونات نون وأكواد نون الحالية مرتبة للسعودية والإمارات. انسخ الكود وجرّبه داخل السلة وتحقق من النتيجة قبل الدفع.',
    h1:'كوبونات نون وأكواد الخصم الحالية',intent:'noon-coupons'
  },
  '/saudi-arabia':{
    title:'كود خصم نون السعودية 2026 | أكواد وكوبونات نون',
    description:'كود خصم نون السعودية وأكواد نون للسوق السعودي مع طريقة استخدام الكوبون والتحقق من الأهلية داخل السلة قبل الدفع.',
    h1:'كود خصم نون السعودية وأكواد نون',intent:'noon-saudi'
  },
  '/uae':{
    title:'كود خصم نون الإمارات 2026 | أكواد وكوبونات نون',
    description:'كود خصم نون الإمارات وكوبونات نون للسوق الإماراتي مع خطوات التحقق من الكود داخل السلة بدون نسب خصم غير موثقة.',
    h1:'كود خصم نون الإمارات وكوبونات نون',intent:'noon-uae'
  },
  '/coupon/best-noon-coupon-today':{
    title:'أفضل كود خصم نون اليوم | كيف تختار الكود الأنسب؟',
    description:'تبحث عن أفضل كود خصم نون اليوم؟ قارن الأكواد الحالية حسب الدولة والسلة، وراجع الإجمالي النهائي بدل الاعتماد على ادعاء غير موثق.',
    h1:'أفضل كود خصم نون اليوم: كيف تختار؟',intent:'best-noon-coupon-today'
  },
  '/guide/how-to-use-noon-coupon':{
    title:'كيفية استخدام كود خصم نون | خطوات تطبيق الكوبون',
    description:'كيفية استخدام كود خصم نون خطوة بخطوة: اختيار السوق، نسخ الكود، تطبيقه في السلة، وفحص السعر النهائي ورسائل الأهلية.',
    h1:'كيفية استخدام كود خصم نون خطوة بخطوة',intent:'how-to-use-noon-coupon'
  },
  '/category/electronics':{
    title:'كود خصم نون إلكترونيات | أكواد ونصائح الشراء',
    description:'كود خصم نون للإلكترونيات مع نصائح مقارنة السعر والبائع والضمان والشحن، وتجربة الكود داخل السلة قبل إتمام الشراء.',
    h1:'كود خصم نون إلكترونيات ونصائح الشراء',intent:'noon-electronics'
  }
};

function replaceFirst(html,re,value){return re.test(html)?html.replace(re,value):html}

export function applyKeywordMap(path,html,origin){
  const t=TARGETS[path];
  if(!t||!html)return html;
  let out=html;
  out=replaceFirst(out,/<title>[\s\S]*?<\/title>/i,`<title>${esc(t.title)}</title>`);
  out=replaceFirst(out,/<meta\s+name=["']description["'][^>]*>/i,`<meta name="description" content="${esc(t.description)}">`);
  out=replaceFirst(out,/<h1([^>]*)>[\s\S]*?<\/h1>/i,`<h1$1>${esc(t.h1)}</h1>`);
  const marker=`<meta name="keyword-intent" content="${esc(t.intent)}"><meta name="keyword-map-updated" content="${UPDATED}">`;
  if(!out.includes('keyword-map-updated'))out=out.replace(/<\/head>/i,marker+'</head>');
  if(path==='/'&&!out.includes('id="search-intent-hubs"')){
    const links=`<section id="search-intent-hubs" aria-label="أدلة البحث الشائعة" style="padding:34px 0;background:#fff"><div style="width:min(1180px,92%);margin:auto"><h2 style="margin:0 0 8px;font-size:28px">أدلة نون الأكثر بحثًا</h2><p style="color:#667085;line-height:1.8">صفحة واحدة لكل نية بحث حقيقية حتى لا تتكرر الصفحات أو تتنافس مع بعضها.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px"><a href="/saudi" style="padding:16px;border:1px solid #e5e7eb;border-radius:16px">كود خصم نون السعودية</a><a href="/uae" style="padding:16px;border:1px solid #e5e7eb;border-radius:16px">كود خصم نون الإمارات</a><a href="/coupon/noon-discount-50" style="padding:16px;border:1px solid #e5e7eb;border-radius:16px">كود خصم نون 50: التحقق من الادعاء</a><a href="/guide/noon-yellow-friday" style="padding:16px;border:1px solid #e5e7eb;border-radius:16px">الجمعة الصفراء نون</a><a href="/guide/how-to-use-noon-coupon" style="padding:16px;border:1px solid #e5e7eb;border-radius:16px">كيفية استخدام كود خصم نون</a><a href="/category/electronics" style="padding:16px;border:1px solid #e5e7eb;border-radius:16px">كود خصم نون إلكترونيات</a></div></div></section>`;
    out=out.replace(/<\/body>/i,links+'</body>');
  }
  return out;
}

const LANDINGS={
  '/coupon/noon-discount-50':{
    title:'كود خصم نون 50 | هل يوجد خصم 50؟ وكيف تتحقق',
    h1:'كود خصم نون 50: ماذا يعني البحث وكيف تتحقق؟',
    description:'دليل دقيق لعبارة كود خصم نون 50: هل المقصود 50 ريال أم 50% أم حد أقصى؟ نوضح طريقة التحقق بدون ادعاء عرض غير موثق.',
    intro:'عبارة «كود خصم نون 50» من أكثر صيغ البحث شيوعًا، لكنها لا تحدد وحدها هل المقصود خصم 50 ريال، أو نسبة 50%، أو حدًا أقصى للقيمة. لذلك لا ننسب أي معنى من هذه المعاني لكود حالي بدون شروط موثقة من العرض نفسه.',
    sections:[
      ['لماذا كلمة 50 وحدها غير كافية؟','قد تشير الأرقام في صفحات الكوبونات إلى قيمة ثابتة، نسبة مئوية، حد أقصى للخصم، أو مجرد صيغة بحث شائعة. الاعتماد على الرقم وحده قد يعطي انطباعًا خاطئًا، لذلك المرجع العملي هو ما يظهر في سلة نون عند تجربة الكود على الحساب والدولة والمنتجات الفعلية.'],
      ['كيف تختبر أي كود بطريقة صحيحة؟','اختر سوق السعودية أو الإمارات الصحيح، أضف المنتجات التي تريدها، انسخ الكود كما هو، ثم أدخله في خانة القسيمة. بعد ذلك راجع إجمالي السلة ورسالة الأهلية. إذا لم يظهر تغيير أو ظهرت رسالة استثناء فلا نفترض أن العرض يعمل على كل المنتجات أو الحسابات.'],
      ['ماذا عن كود نون 20 أو 70؟','نفس القاعدة تنطبق على عبارات مثل كود نون 20 وكود خصم نون 70. هذه استعلامات بحث وليست دليلًا على وجود نسبة أو مبلغ محدد حاليًا. نجمعها في صفحة تفسير واحدة بدل إنشاء صفحات متشابهة لكل رقم حتى نقلل الـCannibalization ونحافظ على وضوح الموقع.'],
      ['ما الصفحة المناسبة بعد ذلك؟','ابدأ بصفحة كل الأكواد إذا كان هدفك التجربة، أو انتقل إلى صفحة السعودية أو الإمارات حسب سوقك. وإذا كنت تريد فهم منهجية التحقق فاقرأ صفحة التحقق قبل الاعتماد على أي وصف تسويقي.']
    ],
    faq:[['هل يوجد كود نون يضمن خصم 50؟','لا نعرض ضمانًا لخصم 50 أو 50% بدون شروط موثقة. النتيجة النهائية داخل السلة هي المرجع العملي.'],['هل يمكن أن يعني 50 ريال بدل 50%؟','نعم، ولذلك لا نفسر الرقم وحده كقيمة أو نسبة محددة بدون مصدر واضح.'],['هل تختلف النتيجة بين السعودية والإمارات؟','نعم، قد تختلف الأهلية والشروط حسب السوق والحساب والمنتجات.']]
  },
  '/guide/noon-yellow-friday':{
    title:'الجمعة الصفراء نون | أكواد الخصم وطريقة التحقق',
    h1:'الجمعة الصفراء نون: كيف تتابع الأكواد والعروض بأمان؟',
    description:'دليل الجمعة الصفراء نون: كيف تفرق بين التخفيض المباشر والكوبون، وتتحقق من السعر النهائي والأهلية بدون ادعاء عرض موسمي غير موثق.',
    intro:'الجمعة الصفراء استعلام موسمي يرتفع الاهتمام به قرب مواسم التخفيضات. وجود البحث لا يعني أن حملة بعينها نشطة الآن، لذلك نستخدم هذه الصفحة كدليل دائم يساعدك على التحقق عندما تظهر عروض موسمية فعلية على نون.',
    sections:[
      ['ابدأ بالسعر النهائي لا بنسبة لافتة','قارن السعر قبل التخفيض، السعر المعروض، وأي نتيجة بعد إضافة الكوبون. أحيانًا يكون التخفيض المباشر أفضل من الكود، وأحيانًا لا يجتمعان. الحكم الصحيح يكون على إجمالي الطلب بعد تطبيق كل الشروط الظاهرة.'],
      ['افصل بين السعودية والإمارات','العروض الموسمية قد تختلف بين السوقين في المنتجات والعملات والأهلية، لذلك افتح صفحة السوق الصحيح ولا تنقل وصف عرض من دولة إلى أخرى.'],
      ['تحقق من البائع والمنتج','في الإلكترونيات والأزياء والجمال قد تختلف الشروط حسب البائع أو المنتج أو الحد الأدنى للسلة. راجع التفاصيل قبل الدفع ولا تعتمد على عنوان مختصر وحده.'],
      ['استخدم الأكواد الحالية كاختبار وليس كضمان','يمكنك تجربة الأكواد الحالية المتاحة في الموقع، لكننا لا ننسب لها خصمًا موسميًا محددًا ما لم تتوفر شروط موثقة. إذا تغير السعر داخل السلة فاعتمد على النتيجة الفعلية وشروط نون وقت الشراء.']
    ],
    faq:[['هل الجمعة الصفراء نشطة الآن؟','هذه الصفحة لا تدعي أن حملة محددة نشطة الآن. تحقق من متجر نون والعروض الظاهرة وقت الزيارة.'],['هل أحتاج كودًا مع العرض الموسمي؟','يعتمد ذلك على شروط العرض؛ بعض التخفيضات مباشرة وبعضها قد يقبل كوبونًا، والنتيجة تظهر داخل السلة.'],['هل عروض السعودية والإمارات متطابقة؟','لا نفترض ذلك؛ لكل سوق شروطه ومنتجاته وعملته.']]
  }
};

function schemaFor(origin,path,p){
  return {'@context':'https://schema.org','@graph':[
    {'@type':'WebPage','@id':origin+path+'#webpage',url:origin+path,name:p.title,description:p.description,inLanguage:'ar',dateModified:UPDATED,isPartOf:{'@id':origin+'/#website'}},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:origin+'/'},{'@type':'ListItem',position:2,name:'أدلة نون',item:origin+'/blog'},{'@type':'ListItem',position:3,name:p.h1,item:origin+path}]},
    {'@type':'FAQPage',mainEntity:p.faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
  ]};
}

export const GOLDEN_KEYWORD_ROUTES=Object.freeze([
  ...Object.keys(TARGETS).filter(path=>path!=='/'),
  ...Object.keys(LANDINGS)
]);

export function goldenKeywordsHub(origin){
  const rows=GOLDEN_KEYWORD_ROUTES.map((path,index)=>{
    const p=TARGETS[path]||LANDINGS[path]||{};
    const label=p.h1||p.title||path;
    const desc=p.description||'صفحة بحث مخصصة لنية شراء أو بحث واضحة داخل نون.';
    return `<article class="kw"><span>#${index+1}</span><h2><a href="${esc(path)}">${esc(label)}</a></h2><p>${esc(desc)}</p></article>`;
  }).join('');
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage','@id':origin+'/golden-keywords#page',url:origin+'/golden-keywords',name:'الكلمات والصفحات الذهبية لنون',description:'بوابة مركزية لصفحات نوايا البحث والكلمات الذهبية الخاصة بنون السعودية والإمارات.',inLanguage:'ar',mainEntity:{'@id':origin+'/golden-keywords#list'}},
    {'@type':'ItemList','@id':origin+'/golden-keywords#list',numberOfItems:GOLDEN_KEYWORD_ROUTES.length,itemListElement:GOLDEN_KEYWORD_ROUTES.map((path,i)=>({'@type':'ListItem',position:i+1,url:origin+path,name:(TARGETS[path]||LANDINGS[path]||{}).h1||(TARGETS[path]||LANDINGS[path]||{}).title||path}))},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:origin+'/'},{'@type':'ListItem',position:2,name:'الكلمات الذهبية',item:origin+'/golden-keywords'}]}
  ]};
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>الكلمات الذهبية لنون | صفحات البحث ذات النية الشرائية</title><meta name="description" content="صفحة تجمع أدلة وكلمات نون ذات نية البحث والشراء للسعودية والإمارات مع روابط مباشرة للصفحات المتخصصة."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(origin+'/golden-keywords')}"><script type="application/ld+json">${safeJson(graph)}</script><style>body{margin:0;background:#f7f8fc;color:#111827;font-family:Tahoma,Arial,sans-serif}.wrap{width:min(1100px,92%);margin:auto}.hero{padding:54px 0;background:#111827;color:#fff}.hero p{color:#cbd5e1;line-height:1.9}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;padding:30px 0}.kw{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:18px}.kw span{font-size:12px;color:#6d28d9;font-weight:900}.kw a{color:#111827;text-decoration:none}.kw p{color:#64748b;line-height:1.8}.links{display:flex;gap:10px;flex-wrap:wrap;padding-bottom:34px}.links a{padding:10px 13px;border:1px solid #dbe3ec;border-radius:10px;text-decoration:none;color:#334155;background:#fff}</style></head><body><header class="hero"><div class="wrap"><p>Search Intent Hub</p><h1>الكلمات والصفحات الذهبية لنون</h1><p>كل رابط هنا يستهدف نية بحث مختلفة بدل إنشاء صفحات متشابهة تتنافس مع بعضها. لا نعرض نسبة خصم أو أهلية غير موثقة لمجرد زيادة النقرات.</p></div></header><main class="wrap"><section class="grid">${rows}</section><div class="links"><a href="/coupons">كل الأكواد</a><a href="/saudi">نون السعودية</a><a href="/uae">نون الإمارات</a><a href="/research">المنهجية والبيانات</a></div></main></body></html>`;
}

export function keywordLanding(path,origin){
  const p=LANDINGS[path];
  if(!p)return null;
  const sections=p.sections.map(([h,b])=>`<section><h2>${esc(h)}</h2><p>${esc(b)}</p></section>`).join('');
  const faq=p.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const graph=schemaFor(origin,path,p);
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(origin+path)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${esc(origin+path)}"><meta name="keyword-map-updated" content="${UPDATED}"><script type="application/ld+json">${safeJson(graph)}</script><style>body{margin:0;background:#f7f8fc;color:#111827;font-family:Tahoma,Arial,sans-serif}.wrap{width:min(900px,92%);margin:auto}.top{padding:18px 0;border-bottom:1px solid #e5e7eb;background:#fff}.top a{margin-left:16px;color:#5b21b6;text-decoration:none;font-weight:800}.hero{padding:52px 0 24px}.hero h1{font-size:clamp(34px,6vw,54px);line-height:1.2;margin:12px 0}.eyebrow{display:inline-block;background:#fff3a6;padding:7px 11px;border-radius:999px;font-weight:900;font-size:12px}.lead{font-size:18px;line-height:2;color:#475467}.card{background:#fff;border:1px solid #e5e7eb;border-radius:22px;padding:26px;box-shadow:0 14px 38px rgba(15,23,42,.06);margin:18px 0}.card h2{margin-top:30px}.card p{line-height:2;color:#344054}.links{display:flex;gap:10px;flex-wrap:wrap;margin:26px 0}.links a{padding:10px 13px;border-radius:12px;background:#111827;color:#fff;text-decoration:none;font-weight:800}.faq details{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;margin:10px 0}.faq summary{font-weight:900;cursor:pointer}.trust{padding:18px;background:#fffbeb;border:1px solid #fde68a;border-radius:16px;line-height:1.9}</style></head><body><nav class="top"><div class="wrap"><a href="/">الرئيسية</a><a href="/coupons">الأكواد</a><a href="/saudi">السعودية</a><a href="/uae">الإمارات</a><a href="/coupon-verification">منهجية التحقق</a></div></nav><main class="wrap"><header class="hero"><span class="eyebrow">دليل مبني على نية بحث مستقلة</span><h1>${esc(p.h1)}</h1><p class="lead">${esc(p.intro)}</p></header><article class="card">${sections}<div class="trust"><strong>قاعدة التحرير:</strong> لا نحول عبارة البحث إلى ادعاء تجاري. أي نسبة أو مبلغ أو أهلية تحتاج شروطًا موثقة؛ وإلا نوجّه المستخدم للتحقق داخل السلة.</div><div class="links"><a href="/coupons">كل أكواد نون</a><a href="/coupon/best-noon-coupon-today">أفضل كود اليوم</a><a href="/guide/how-to-use-noon-coupon">طريقة استخدام الكود</a><a href="/editorial-policy">السياسة التحريرية</a></div><section class="faq"><h2>أسئلة شائعة</h2>${faq}</section></article></main></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=0,s-maxage=300','x-keyword-intent':'data-driven-v1'}});
}

export function augmentKeywordSitemap(path,xml,origin){
  if(path!=='/sitemap-pages.xml'||!xml||!xml.includes('</urlset>'))return xml;
  const paths=['/golden-keywords',...Object.keys(LANDINGS)];
  const add=paths.filter(p=>!xml.includes(origin+p)).map(p=>`<url><loc>${origin}${p}</loc><lastmod>${UPDATED}</lastmod></url>`).join('');
  return xml.replace('</urlset>',add+'</urlset>');
}

export const KEYWORD_MAP_VERSION='2026-09-18-v2-golden-hub';
