// Complete the /brands -> country/brand link graph with safe, quota-free
// Cloudflare static HTML. Preserve original slugs and avoid fabricated prices,
// discount percentages, stock, ratings or product tests.
import {BRANDS,CATEGORIES} from '../commerce-taxonomy.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const root=resolve('.ndn-static-assets'),origin='https://noondealsnow.com';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const items=Object.entries(BRANDS).filter(([slug,brand])=>/^[a-z0-9-]+$/.test(slug)&&brand?.label);
const market={
 saudi:{code:'NOV170',country:'SA',name:'السعودية',language:'ar-SA',dir:'rtl',store:'https://www.noon.com/saudi-ar/'},
 uae:{code:'NOV188',country:'AE',name:'UAE',language:'en-AE',dir:'ltr',store:'https://www.noon.com/uae-en/'}
};
const ar=m=>m==='saudi';
const checklists={
 mobiles:{ar:[['الموديل والنسخة','راجع رقم الموديل والإصدار الإقليمي وطرق الاتصال والذاكرة والسعة قبل مقارنة عرضين من نفس العائلة.'],['البائع والضمان','تحقق من البائع ونوع الضمان وحالة الجهاز وسياسة الإرجاع ومحتويات العلبة.']],
 en:[['Model and regional version','Match the exact model, regional edition, connectivity, storage and memory before comparing two listings.'],['Seller and warranty','Check the marketplace seller, warranty terms, condition, return policy and included accessories.']]},
 laptops:{ar:[['احتياجات الاستخدام','قارن المعالج والذاكرة والتخزين والبطارية والوزن والشاشة وفق طبيعة شغلك أو دراستك.'],['المنافذ ونظام التشغيل','تحقق من خيارات الاتصال والمنافذ ولوحة المفاتيح والضمان ومحتويات العبوة.']],
 en:[['Workload and configuration','Compare processor, memory, storage, weight, battery and display against your actual workload.'],['Keyboard and connectivity','Check the operating system, keyboard region, ports, warranty and box contents.']]},
 beauty:{ar:[['الحجم والمكونات','قارن نفس التركيز والحجم والدرجة والمكونات المعلنة، لا الصور المتشابهة فقط.'],['التخزين والاسترجاع','راجع تعليمات الاستخدام وسياسة إرجاع المنتج والبائع وحالة العبوة.']],
 en:[['Variant and ingredients','Match size, formulation, shade, concentration and declared ingredients before comparing prices.'],['Seller and returns','Review the seller, packaging, use directions and product-specific return conditions.']]},
 appliances:{ar:[['أبعاد الجهاز','قارن الأبعاد وسعة الجهاز ومتطلبات التركيب والطاقة مع مساحة المنزل.'],['الخدمة بعد البيع','راجع رسوم التوصيل والتركيب والضمان وخدمة الصيانة المحلية.']],
 en:[['Measurements and installation','Compare exact dimensions, capacity, power requirements and installation constraints.'],['Delivery and support','Consider shipping, fitting, warranty, service access and returns.']]},
 fashion:{ar:[['المقاس والخامة','طابق جدول المقاسات والخامة وتعليمات العناية قبل إتمام الطلب.'],['اللون وسياسة الإرجاع','اقرأ وصف اللون والملاءمة والتوصيل وسياسة الاستبدال المناسبة للمنتج.']],
 en:[['Sizing and materials','Match the size chart, materials, intended use and care instructions.'],['Fit and returns','Read the item colour and fit description, delivery window and exchange conditions.']]},
 'baby-kids':{ar:[['العمر والمقاس','اعتمد على العمر أو الوزن وتعليمات الشركة المصنعة بدل توقع الملاءمة من الصورة.'],['المحتويات والسلامة','راجع متطلبات السلامة والتنظيف وعدد القطع وسياسة الإرجاع.']],
 en:[['Age and fit','Use the manufacturer’s age, weight and size guidance rather than photographs.'],['Care and safety','Review safety instructions, cleaning, pack size and applicable returns.']]},
 electronics:{ar:[['التوافق مع أجهزتك','افحص المنافذ والإصدار والاتصال والملحقات قبل طلب منتج إلكتروني.'],['الضمان والتوصيل','راجع اسم البائع والضمان ورسوم التوصيل قبل تقييم السعر النهائي.']],
 en:[['Compatibility','Verify model number, ports, connectivity, regional support and accessories.'],['Warranty and delivery','Compare seller support and final delivery charges in the UAE checkout.']]}
};
function choice(tag){
 const set=new Set(tag);
 if(set.has('mobiles')||set.has('tablets'))return 'mobiles';
 if(set.has('laptops')||set.has('computers'))return 'laptops';
 if(set.has('beauty'))return 'beauty';
 if(set.has('baby-kids'))return 'baby-kids';
 if(set.has('appliances')||set.has('home-kitchen'))return 'appliances';
 if(['fashion','women-fashion','men-fashion','shoes','bags','sports'].some(x=>set.has(x)))return 'fashion';
 return 'electronics';
}
function deepLinks(m,brand){
 const types=new Set(brand.categories||[]);
 const ids=ar(m)?[
 ['mobiles','mobile-phones'],['tablets','mobile-phones'],['laptops','electronics'],
 ['appliances','home-appliances'],['beauty','perfumes-beauty'],['baby-kids','baby'],
 ['electronics','electronics'],['home-kitchen','home-appliances'],['audio','electronics']]:
 [['mobiles','electronics'],['tablets','electronics'],['laptops','electronics'],
 ['appliances','home-appliances'],['beauty','beauty'],['baby-kids','first-order'],
 ['electronics','electronics'],['home-kitchen','home-appliances'],['audio','electronics']];
 const out=[];
 for(const [category,guide] of ids){
  if(types.has(category)&&!out.includes(guide))out.push(guide);
 }
 if(!out.length){
   // Avoid directing fashion and travel shoppers to unrelated electronics guides.
   const categoryDest={
     shoes:'shoes',sports:'sports',bags:'bags',travel:'travel',
     'men-fashion':'fashion-men','women-fashion':'fashion-women',
     fashion:'fashion-women','baby-kids':'baby',grocery:'grocery',
     automotive:'automotive',gifts:'gifts','home-kitchen':'kitchen',
     'school-supplies':'stationery',gaming:'gaming',
     pets:'pet-supplies',audio:'audio',tvs:'tv',tablets:'tablets',
     computers:'office',beauty:'beauty',appliances:'home-appliances'
   };
   for(const category of brand.categories||[]){
     const dest=categoryDest[category];
     if(dest&&!out.includes('category:'+dest))out.push('category:'+dest);
   }
 }
 if(!out.length)out.push('category:deals');
 return out.slice(0,3).map(x=>x.startsWith('category:')
  ?'/'+m+'/category/'+x.slice(9)
  :'/'+m+'/buying-guide/'+x);
}
function brandHtml(m,slug,b){
 const loc=market[m],code=loc.code,path='/'+m+'/brand/'+slug,canonical=origin+path;
 const cats=(b.categories||[]).filter(x=>CATEGORIES[x]);
 const primary=choice(cats),checks=checklists[primary][ar(m)?'ar':'en'];
 const lines=Object.entries(b.models||{}).filter(([key,x])=>/^[a-z0-9-]+$/.test(key)&&x?.label).slice(0,12);
 const categoryDesc=cats.map(x=>CATEGORIES[x]?.desc).filter(Boolean);
 const alias=(b.aliases||[]).slice(0,8).map(escape);
 const title=ar(m)?'دليل '+b.label+' على نون السعودية | مقارنة المنتجات وكود '+code:
   b.label+' on Noon UAE | Buying guide and promo code '+code;
 const description=ar(m)?
   'قارن منتجات '+b.label+' على نون السعودية حسب الموديل والبائع والضمان والسعر النهائي؛ جرّب كود '+code+' في السلة وتصفح الفئات المرتبطة.':
   'Compare '+b.label+' models on Noon UAE by specification, seller, warranty and final AED total before testing '+code+' at checkout.';
 const paragraphs=ar(m)?[
   'إذا كنت تبحث عن '+b.label+' على نون السعودية، ابدأ بالاحتياج الفعلي، وليس بنسبة الخصم المكتوبة في إعلان. تأكد من أن المنتج والإصدار والبائع وكل الملحقات المعروضة تطابق ما تحتاجه، ثم استخدم NOV170 كخطوة أخيرة لفحص إجمالي السلة.',
   'تتغير المنتجات والعروض والأسعار حسب الوقت والبائع وعنوان التوصيل. لا نقدم سعرًا ثابتًا أو ضمانًا بأن الكود مقبول لكل موديل من '+b.label+'. استخدم صفحة المنتج وسلة نون الرسمية للتحقق قبل الدفع.',
   'للمقارنة العادلة، افتح عرضين لهما نفس اسم الموديل والخصائص الأساسية، وراجع الضمان وسياسة الإرجاع ثم رسوم الشحن أو التركيب. احتفظ بملخص كل عرض بدلاً من الحكم على التخفيض المعلن وحده.']:
  [
   'When researching '+b.label+' on Noon UAE, begin with your intended use and an exact product specification. A promotion is useful only if the model, seller, warranty and included accessories match your needs. NOV188 is the site owner-listed UAE coupon; test it in the official cart rather than assuming universal eligibility.',
   'Offers, product availability, checkout conditions and prices can change by seller, time and delivery address. This guide does not claim a fixed discount rate, a verified live selling price or hands-on experience with a '+b.label+' item.',
   'For an apples-to-apples comparison, keep the model and configuration consistent. Look at the seller, return rights, shipping and any setup costs. The best offer is the suitable item at the lowest final payable amount, not the largest advertised percentage.'
  ];
 const modelNames=lines.map(([id,v])=>v.label);
 const categoryList=cats.map(c=>CATEGORIES[c].label);
 const intro='<section class="panel"><h2>'+(ar(m)?'كيف تختار '+escape(b.label)+' من نون السعودية؟':'How to buy '+escape(b.label)+' on Noon UAE')+'</h2>'+
 paragraphs.map(x=>'<p>'+escape(x)+'</p>').join('')+'</section>';
 const list=categoryList.length?'<section class="panel"><h2>'+(ar(m)?'الفئات المرتبطة بالبراند':'Relevant product categories')+'</h2>'+
  '<p>'+escape(categoryDesc.slice(0,2).join(' '))+'</p><ul>'+categoryList.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>'+
  '<p><a href="/'+m+'/categories">'+(ar(m)?'عرض كل أقسام السعودية':'Explore UAE shopping categories')+'</a></p></section>':'';
 const models='<section class="panel"><h2>'+(ar(m)?'عائلات المنتجات للبحث والمقارنة':'Product families to compare')+'</h2>'+
 (modelNames.length?'<ul>'+modelNames.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>':
  '<p>'+(ar(m)?'راجع رقم الموديل المعلن في صفحة المنتج. لا نستنتج توافر موديل محدد من اسم البراند.':
   'Use the exact SKU and item details shown by the store; no specific model availability is claimed.')+'</p>')+
 '<p>'+(ar(m)?'ذكر عائلة منتجات لا يعني أن جميع موديلاتها متوفرة حاليًا. ابحث عن النسخة الدقيقة في نون.':
 'Family names are search guidance, not an assertion that every model is currently in stock.')+'</p></section>';
 const check='<section class="panel"><h2>'+(ar(m)?'قائمة فحص قبل الشراء':'Purchase checklist')+'</h2>'+
 checks.map(([h,s])=>'<h3>'+escape(h)+'</h3><p>'+escape(s)+'</p>').join('')+
 '<h3>'+(ar(m)?'الرسوم والسعر النهائي':'Delivery and final basket amount')+'</h3><p>'+
 (ar(m)?'احسب سعر المنتج مع رسوم التوصيل أو التركيب وأي ملحق ضروري. ثبّت نفس السلة وأدخل '+code+' عند الدفع لتعرف الوفر الحقيقي.':
 'Include delivery, installation where required and any essential accessory in the AED total. Enter '+code+' on an unchanged cart and compare the payable amount.')+
 '</p></section>';
 const guides=deepLinks(m,b),links='<section class="panel"><h2>'+(ar(m)?'أدلة شراء أخرى لهذا السوق':'Related UAE buying guides')+'</h2><ul>'+
 guides.map(x=>'<li><a href="'+x+'">'+escape(ar(m)?'دليل شراء نون السعودية — '+x.split('/').at(-1).replace(/-/g,' '):'Noon UAE buying guide — '+x.split('/').at(-1).replace(/-/g,' '))+'</a></li>').join('')+
 '</ul><p><a href="/brands">'+(ar(m)?'دليل كل البراندات':'Browse all brands')+'</a></p></section>';
 const faqs=ar(m)?[
  ['هل كود NOV170 متاح لكل منتجات '+b.label+'؟','لا يمكن تأكيد أهلية كل منتج أو حساب. الرسالة والإجمالي النهائي في سلة نون السعودية هما المرجع.'],
  ['كيف أقارن موديلين من '+b.label+'؟','استخدم رقم الموديل والمواصفات والضمان والبائع وتكاليف الشحن قبل المقارنة.'],
  ['هل الأسعار المذكورة هنا محدثة؟','لا نعرض أسعارًا آنية غير موثقة؛ راجع السعر الحالي للمنتج في متجر نون الرسمي.']]:
  [['Does NOV188 apply to every '+b.label+' item?','Eligibility depends on the checkout, seller, basket and campaign terms. No universal rate is claimed.'],
  ['How do I compare '+b.label+' listings?','Match the exact model and variant, seller, warranty and delivery charges first.'],
  ['Are prices or models guaranteed available?','No live inventory or price is asserted by this guide; consult the official UAE storefront.']];
 const faq='<section class="panel faq"><h2>'+(ar(m)?'الأسئلة الشائعة':'Frequently asked questions')+'</h2>'+
 faqs.map(([q,a])=>'<details><summary>'+escape(q)+'</summary><p>'+escape(a)+'</p></details>').join('')+'</section>';
 const coupon='<section class="coupon" aria-label="coupon"><h2>'+(ar(m)?'نسخ كود نون السعودية':'Copy Noon UAE coupon')+'</h2>'+
 '<strong class="code">'+code+'</strong> <button type="button" data-code="'+code+'" data-market="'+loc.country+'">'+(ar(m)?'نسخ الكود':'Copy code')+'</button> '+
 '<a class="shop" href="'+loc.store+'" rel="noopener noreferrer sponsored" target="_blank" data-shop-click="'+code+'" data-market="'+loc.country+'">'+
 (ar(m)?'افتح نون السعودية':'Open Noon UAE')+'</a><p>'+
 (ar(m)?'الكود مدرج لدى صاحب الموقع. نتيجة تطبيقه تعتمد على شروط الطلب والسلة لدى نون ولا نضمن نسبة أو سقف خصم.':
 'The code is owner-listed. Only the official checkout confirms item eligibility, any savings and the final total.')+'</p></section>';
 const data={'@context':'https://schema.org','@graph':[
 {'@type':'WebPage','@id':canonical+'#webpage',name:title,description,url:canonical,inLanguage:loc.language,isPartOf:{'@id':origin+'/#website'}},
 {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},
 {'@type':'ListItem',position:2,name:'Brands',item:origin+'/brands'},
 {'@type':'ListItem',position:3,name:b.label+' '+loc.name,item:canonical}]},
 {'@type':'FAQPage',mainEntity:faqs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
 ]};
 const nav='<nav class="nav"><a href="/">Home</a><a href="/brands">'+(ar(m)?'البراندات':'Brands')+'</a>'+
 '<a href="/saudi/noon-coupon-code">'+(ar(m)?'كوبونات السعودية':'Saudi coupons')+'</a>'+
 '<a href="/uae/noon-coupon-code">'+(ar(m)?'كوبونات الإمارات':'UAE coupons')+'</a>'+
 '<a href="/'+m+'/categories">'+(ar(m)?'أقسام نون':'Categories')+'</a><a href="/blog/'+m+'">'+(ar(m)?'مقالات السوق':'Market articles')+'</a></nav>';
 const css='<style>*{box-sizing:border-box}body{font:16px/1.85 Tahoma,Arial,sans-serif;margin:0;color:#142235;background:#f7f9fd}a{color:#1856af;text-underline-offset:3px}.shell{max-width:1100px;margin:auto;padding:0 4%}.header{background:#fff;padding:16px 0;border-bottom:1px solid #d9dfea}.nav{display:flex;flex-wrap:wrap;gap:15px}.nav a{font-weight:700;font-size:14px}.hero{background:#fff;padding:28px 0;border-bottom:1px solid #dfe5ee}.hero h1{font-size:clamp(25px,4vw,43px);line-height:1.45}.hero p{max-width:900px;color:#52627c}.panel,.coupon{background:#fff;border:1px solid #dee5f0;border-radius:15px;padding:22px;margin:18px 0}.panel h2,.coupon h2{line-height:1.5;font-size:23px}.panel h3{font-size:18px}.coupon{border-color:#b69edb;background:#fbf8ff}.code{display:inline-block;background:#fff4d0;border:2px dashed #9c6ede;padding:8px 16px;border-radius:10px;letter-spacing:2px;direction:ltr;font-size:24px}button,.shop{display:inline-block;background:#6423c4;color:#fff;border:0;border-radius:10px;padding:10px 14px;text-decoration:none;font-weight:800;font-size:15px;cursor:pointer;margin:5px}.shop{background:#1b273c}.faq details{background:#f8faff;padding:12px;border-radius:9px;margin:10px 0}.faq summary{font-weight:800;cursor:pointer}footer{background:#152034;color:#fff;padding:25px 0;margin-top:30px}footer a{color:#fff}@media(max-width:650px){.panel,.coupon{padding:14px}.nav{gap:10px}}</style>';
 const js='<script>document.addEventListener("click",async e=>{const link=e.target.closest("a[data-shop-click]");if(link&&typeof gtag==="function")gtag("event","store_outbound_click",{coupon_code:link.dataset.shopClick,market:link.dataset.market,source:"brand_static"});const b=e.target.closest("button[data-code]");if(!b)return;const code=b.dataset.code;try{await navigator.clipboard.writeText(code);const old=b.textContent;b.textContent="Copied / تم النسخ";setTimeout(()=>b.textContent=old,1500);if(typeof gtag==="function")gtag("event","coupon_copy_success",{coupon_code:code,market:b.dataset.market,source:"brand_static"})}catch{prompt("Copy coupon",code)}})</script>';
 const html='<!doctype html><html lang="'+loc.language+'" dir="'+loc.dir+'"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title>'+
  '<meta name="description" content="'+escape(description)+'"><meta name="robots" content="index,follow,max-image-preview:large">'+
  '<link rel="canonical" href="'+canonical+'"><meta property="og:title" content="'+escape(title)+'">'+
  '<meta property="og:description" content="'+escape(description)+'"><meta property="og:url" content="'+canonical+'">'+
  '<meta name="ndn-static-brand-catalog" content="v1">'+
  '<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>'+css+'</head><body>'+
  '<header class="header"><div class="shell">'+nav+'</div></header><section class="hero"><div class="shell">'+
  '<p><a href="/">Home</a> / <a href="/brands">Brands</a> / '+escape(b.label)+'</p>'+
  '<h1>'+escape(title)+'</h1><p>'+escape(description)+'</p></div></section>'+
  '<main class="shell">'+intro+list+models+check+guides+faq+coupon+'</main>'+
  '<footer><div class="shell"><strong>Noon Deals Now — Independent shopping guides</strong><p><a href="/editorial-policy">Editorial policy</a> · <a href="/coupon-verification">Coupon methodology</a> · <a href="/brands">All brands</a></p></div></footer>'+js+'</body></html>';
 return html;
}
const home=await readFile(resolve(root,'index.html'),'utf8');
const analytics=(home.match(/<script id="ndn-static-ga4">[\s\S]*?<\/script>/)||[])[0];
if(!analytics||!analytics.includes('G-1551Z7DJ2C'))throw Error('NDN_BRANDS_STATIC_GA4_SOURCE_MISSING');
let built=0;
for(const [slug,b] of items){
 for(const m of ['saudi','uae']){
  const path='/'+m+'/brand/'+slug;
  let html=brandHtml(m,slug,b);
  const canonical=origin+path;
  if(!html.includes('<link rel="canonical" href="'+canonical+'">')||!html.includes('data-code="'+market[m].code+'"'))
   throw Error('NDN_BRAND_MARKET_CANONICAL_OR_COUPON_'+path);
  html=html.replace('</head>',analytics+'</head>');
  const dst=resolve(root,path.slice(1)+'.html');
  await mkdir(dirname(dst),{recursive:true});await writeFile(dst,html,'utf8');
  built++;
 }
}
if(items.length!==30||built!==60)throw Error('NDN_BRAND_ROUTE_PARITY_'+built);
const report={brands:items.length,marketRoutes:built,countries:['SA','AE'],
 canonicalParity:true,originalSlugsPreserved:true,couponByMarket:{SA:'NOV170',AE:'NOV188'},r2Writes:0};
await writeFile('.ndn-blog-staging/brand-route-coverage.json',JSON.stringify(report,null,2),'utf8');
console.log('NDN_STATIC_ALL_BRAND_HUBS='+JSON.stringify(report));
