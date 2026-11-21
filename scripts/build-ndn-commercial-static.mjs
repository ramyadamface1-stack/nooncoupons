// Commercial public routes, independent from daily Cloudflare Worker request quota.
// This file does not change any R2 article body, coupon validity or generator state.
import {PUBLIC_CATEGORIES as categories} from '../index.js';
import {couponSvg} from '../svg-engine.js';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const root=resolve('.ndn-static-assets'),origin='https://noondealsnow.com';
const market={
 saudi:{code:'NOV170',lang:'ar-SA',dir:'rtl',name:'السعودية',official:'https://www.noon.com/saudi-ar/',currency:'ر.س'},
 uae:{code:'NOV188',lang:'en-AE',dir:'ltr',name:'الإمارات',official:'https://www.noon.com/uae-en/',currency:'AED'}
};
const seo=[
 {m:'saudi',slug:'first-order',key:'كود خصم نون السعودية للطلب الأول',short:'تعرّف على طريقة اختبار أهلية حساب الطلب الأول دون افتراض خصم ثابت.',
 parts:[['شروط الحساب','الحساب الجديد ليس بالضرورة طلبًا مؤهلًا. اقرأ رسالة الكوبون وشروط الطلب الأول داخل نون السعودية، ولا تنشئ حسابات للتحايل على عروض مخصصة.'],['السلة الأولى','ضع المنتج الذي تحتاجه فقط، وسجّل سعره الأصلي واسم البائع ورسوم الشحن ثم استخدم NOV170. ارتفاع قيمة السلة لمجرد بلوغ حد غير موثق ليس توفيرًا.'],['التحقق من السعر','قارن نفس المنتجات والكمية والعنوان وطريقة الدفع قبل الكود وبعده؛ لا تعتبر اختلاف السلتين دليلًا على عمل الرمز.'],['الطلب والتوصيل','تحقق من عنوان السعودية وسياسة الإرجاع ووقت التوصيل ومجموع الرسوم قبل اعتماد أول عملية شراء.']]},
 {m:'saudi',slug:'mobile-phones',key:'كود خصم نون السعودية للجوالات',short:'مقارنة الهاتف والنسخة والضمان والبائع قبل تجربة NOV170.',
 parts:[['الموديل الدقيق','راجع رقم الموديل والسعة والرام ودعم الشبكات وتفاصيل النسخة الإقليمية؛ اسم السلسلة وحده لا يكفي لمقارنة هاتفين.'],['البائع والضمان','قارن مصدر البيع وحالة الجهاز ونوع الضمان وشروط الإرجاع في صفحة المنتج قبل شراء جوال بسعر منخفض.'],['الملحقات','لا تفترض وجود شاحن أو سماعات أو واقي شاشة في الصندوق. اقرأ المحتويات وأضف تكلفة الضروري منها إلى مقارنة الأسعار.'],['تجربة الرمز','طبّق NOV170 في سلة نون السعودية نفسها بعد تثبيت الموديل والبائع. السعر النهائي بالريال هو المؤشر وليس نسبة غير موثقة.']]},
 {m:'saudi',slug:'home-appliances',key:'كود خصم نون السعودية للأجهزة المنزلية',short:'اختيار الأجهزة حسب الأبعاد والتركيب والصيانة والتكلفة النهائية.',
 parts:[['القياسات والتركيب','قس المساحة والأبواب والتهوية ومداخل المياه والكهرباء عند الحاجة؛ جهاز أرخص لا يصلح إن لم يدخل المكان.'],['السعة واستهلاك الكهرباء','طابق سعة الغسالة أو الثلاجة أو المكنسة مع الاستخدام الفعلي والبيانات الرسمية عن استهلاك الطاقة.'],['التوصيل والصيانة','اقرأ تكلفة الشحن والتركيب، ومركز الضمان وسياسة الإرجاع وأي ملحقات إلزامية.'],['تقييم الكوبون','جرّب NOV170 على السلة النهائية بعد مقارنة الموديل نفسه والتكلفة الإجمالية والخدمة.']]},
 {m:'saudi',slug:'electronics',key:'كود خصم نون السعودية للإلكترونيات',short:'مقارنة الشاشات والراوترات والسماعات والإكسسوارات حسب المواصفات.',
 parts:[['التوافق','افحص منافذ الشاشة والدقة والتردد أو تغطية الراوتر ونطاقاته أو دعم السماعات للأجهزة التي تمتلكها.'],['إصدار المنتج','قارن رقم الموديل وسنة الإصدار والسعة والمحتويات بدل الاعتماد على صورة أو اسم تسويقي متشابه.'],['الباقات','إن كان العرض يشمل ملحقات، احسب قيمتها فقط لو كنت تنوي شراءها بالفعل، ثم أضف رسوم الشحن.'],['الكود عند الدفع','جرّب NOV170 على نفس السلة؛ لا نؤكد أهلية جميع الإلكترونيات قبل موافقة المتجر.']]},
 {m:'saudi',slug:'perfumes-beauty',key:'كود خصم نون السعودية للعطور ومنتجات الجمال',short:'قارن تركيز العطر والحجم ومكونات العناية وسياسة الإرجاع.',
 parts:[['حجم وتركيز العطر','لا تخلط بين Eau de Parfum وEau de Toilette أو أحجام 50 و100 مل، واحسب سعر الملليلتر.'],['مكونات العناية','اقرأ المكونات المعلنة وتعليمات الاستخدام والتوافق الشخصي ولا تعتمد على وعود علاجية غير موثقة.'],['البائع والمنتج','راجع البائع ونوع العبوة والنسخة وسياستها الخاصة بالإرجاع لتقييم القيمة الفعلية.'],['توفير حقيقي','ضع ما تحتاجه في سلة نون السعودية ثم جرّب NOV170 قبل الدفع وراقب الإجمالي.']]},
 {m:'saudi',slug:'baby',key:'كود خصم نون السعودية لمستلزمات الأطفال',short:'مقارنة مقاس الحفاضات وأمان المنتجات والكمية بدل الخصم المعلن.',
 parts:[['العمر والمقاس','اعتمد على إرشادات الشركة عن الوزن والعمر والمقاس، خصوصًا الحفاضات والمقاعد والعربات.'],['الخامات والسلامة','تحقق من طريقة الاستخدام والتنظيف ومتطلبات السلامة بدل الاعتماد على صور المنتج.'],['العبوات','قارن العدد وسعر القطعة وتكلفة التوصيل، ولا تكدس مقاسًا قد يصبح غير مناسب.'],['اختبار NOV170','ضع المنتجات الملائمة أولًا، ثم جرّب الكود في السلة وتأكد من السعر النهائي وشروط الإرجاع.']]},
 {m:'uae',slug:'first-order',key:'Noon UAE first order promo code',short:'Check first-order eligibility and the final UAE checkout total.',
 parts:[['Account eligibility','A newly created account is not proof that a promotion applies. Read Noon UAE checkout terms and avoid changing accounts to bypass any restrictions.'],['An intentional first basket','Select what you actually need, note the initial price and shipping, and avoid adding unnecessary items to reach an unverified threshold.'],['Test NOV188 once','Enter the owner-listed UAE code in the coupon field. Compare the same products and delivery address before and after applying it.'],['Finalize in AED','Check VAT display, delivery, seller and return conditions before treating the basket as a good deal.']]},
 {m:'uae',slug:'electronics',key:'Noon UAE electronics promo code',short:'Match device models, warranties and accessories before testing NOV188.',
 parts:[['Exact product identity','Match the model number, storage, ports, network support, included accessories and regional version of every device.'],['Warranty and seller','Check seller identity, warranty scope and returns. A low price does not make two different conditions equivalent.'],['Bundle comparison','Only count accessories you would otherwise purchase. Add delivery and any disclosed setup costs.'],['Coupon test','Use NOV188 at the official UAE checkout. No category-wide eligibility or percentage is promised.']]},
 {m:'uae',slug:'beauty',key:'Noon UAE perfume and beauty coupon code',short:'Compare formula, volume, concentration, seller and final AED price.',
 parts:[['Product variant','Compare matching fragrance concentrations, editions and bottle sizes; compute a comparable price per ml where possible.'],['Formula information','Review published skincare ingredients and directions without relying on unsupported medical claims.'],['Seller and returns','Confirm seller, packaging and the return policy applicable to the exact product.'],['AED total','Try NOV188 on the same UAE basket after checking size, delivery fees and seller terms.']]},
 {m:'uae',slug:'home-appliances',key:'Noon UAE home appliances coupon code',short:'Factor dimensions, installation costs, energy use and warranty into the final total.',
 parts:[['Dimensions','Measure installation space, ventilation and access routes before comparing appliances.'],['Capacity and utility','Compare capacity, energy information and programmes against real household usage, not only promotional headlines.'],['Service and delivery','Look for installation, shipping, warranty and local support terms that could change the true total cost.'],['NOV188 at checkout','Try the owner-listed code on the UAE cart, and base the purchase on the final AED amount.']]}
];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NAV='<nav aria-label="Quick shopping navigation" style="display:flex!important;flex-wrap:wrap;gap:12px;padding:10px 3vw;background:#fff;border-bottom:1px solid #e1e6ef;font:700 13px Tahoma,Arial"><a href="/saudi/noon-coupon-code">كوبونات السعودية</a><a href="/uae/noon-coupon-code">كوبونات الإمارات</a><a href="/saudi/categories">أقسام السعودية</a><a href="/uae/categories">أقسام الإمارات</a><a href="/brands">البراندات</a><a href="/blog">المدونة</a></nav>';
const css='<style>*{box-sizing:border-box}body{margin:0;color:#172033;background:#f8fafc;font-family:Tahoma,Arial,sans-serif;line-height:1.85}a{color:#1558c0;text-underline-offset:3px}.w{width:min(1120px,94%);margin:auto}.hero{padding:30px 0;background:#fff;border-bottom:1px solid #e5e9f0}.hero h1{font-size:clamp(26px,4vw,42px);line-height:1.45}.muted{color:#526175}.columns{display:grid;grid-template-columns:minmax(0,2fr) minmax(250px,1fr);gap:22px}.box{padding:20px;background:#fff;border:1px solid #dfe5ef;border-radius:16px;margin:17px 0}.box h2{margin:8px 0;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.linkcard{display:block;background:#fff;padding:17px;border:1px solid #e2e7ef;border-radius:14px;text-decoration:none;color:#182438}.linkcard:hover{border-color:#8258d8}.linkcard strong{display:block}.btn{display:inline-block;padding:10px 16px;background:#6028cc;color:#fff;border:0;border-radius:12px;font-weight:bold;text-decoration:none;cursor:pointer}.btn.alt{background:#152033}.code{font-size:26px;letter-spacing:2px;border:2px dashed #b790e3;background:#f4ecff;border-radius:12px;padding:7px 17px;display:inline-block;direction:ltr;font-weight:900}.notice{background:#fff8df;border-right:3px solid #e0b225;padding:13px}.links a{display:block;margin:9px 0}.faq details{padding:12px;border:1px solid #e4e7ed;margin:10px 0;border-radius:10px}footer{background:#111827;color:#fff;padding:25px 0;margin-top:40px}footer a{color:#fff}@media(max-width:800px){.grid,.columns{grid-template-columns:1fr}.box{padding:14px}}</style>';
const dirs={
 saudi:{name:'السعودية',desc:'تصفح كود نون السعودية NOV170 وأدلة الشراء وتقسيمات الجوالات والأجهزة والعطور.',lang:'ar-SA',dir:'rtl'},
 uae:{name:'UAE',desc:'Browse Noon UAE promo code NOV188 and shopping guides by category.',lang:'en-AE',dir:'ltr'}
};
const isSA=m=>m==='saudi';
const code=m=>market[m].code;
const couponAction=m=>{
 const button='<button class="btn" type="button" data-code="'+code(m)+'" data-market="'+(isSA(m)?'SA':'AE')+'">'+(isSA(m)?'نسخ الكود':'Copy code')+'</button>';
 const official='<a class="btn alt" data-shop-click="'+code(m)+'" data-market="'+(isSA(m)?'SA':'AE')+'" href="'+market[m].official+'" rel="noopener sponsored" target="_blank">'+(isSA(m)?'فتح نون السعودية':'Open Noon UAE')+'</a>';
 const notice=isSA(m)?'الكود مدرج للسعودية من مالك الموقع. لا توجد هنا نسبة خصم أو شروط أهلية مؤكدة لكل منتج؛ راجع إجمالي السلة في نون.':
 'NOV188 is owner-listed for the UAE. The final checkout determines eligibility, savings and any restrictions.';
 return '<section class="box" id="coupon"><h2>'+(isSA(m)?'استخدم الكود على السلة':'Try the code on your basket')+'</h2><span class="code">'+code(m)+'</span> '+button+' '+official+'<p class="notice">'+notice+'</p></section>';
};
const staticAnalytics='<script id="ndn-static-ga4">(function(){if(navigator.doNotTrack==="1"||window.doNotTrack==="1")return;var t=document.createElement("script");t.async=true;t.src="https://www.googletagmanager.com/gtag/js?id=G-1551Z7DJ2C";document.head.appendChild(t);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config","G-1551Z7DJ2C")})()</script>';
const extraJS='<script>document.addEventListener("click",async e=>{let out=e.target.closest("a[data-shop-click]");if(out&&typeof gtag==="function"){gtag("event","store_outbound_click",{coupon_code:out.dataset.shopClick,market:out.dataset.market,source:"commercial_static"})}let b=e.target.closest("button[data-code]");if(!b)return;let v=b.dataset.code;try{await navigator.clipboard.writeText(v);let t=b.textContent;b.textContent="تم النسخ / Copied";setTimeout(()=>b.textContent=t,1300);if(typeof gtag==="function")gtag("event","coupon_copy_success",{coupon_code:v,market:b.dataset.market,placement:"commercial_static",source:"confirmed_clipboard_write"})}catch(e){prompt("Copy coupon",v)}})</script>';
const baseUrl=(m)=>'/'+m+'/noon-coupon-code';
const guideUrl=t=>'/'+t.m+'/buying-guide/'+t.slug;
const guideLinks=(m)=>seo.filter(t=>t.m===m).map(t=>'<li><a href="'+guideUrl(t)+'">'+E(t.key)+'</a></li>').join('');
function page(m,path,title,desc,body,{indexable=true,faq=[],kind='WebPage'}={}){
 const canonical=origin+(path==='/saudi/noon-coupon-code'?'/saudi-arabia/noon-coupon-code':path);const locale=dirs[m];
 const structured={'@context':'https://schema.org','@graph':[
  {'@type':'Organization','@id':origin+'/#organization',name:'Noon Deals Now',url:origin},
  {'@type':'WebPage','@id':canonical+'#page',url:canonical,name:title,description:desc,inLanguage:locale.lang},
  ...(kind==='Article'?[{'@type':'Article',headline:title,mainEntityOfPage:canonical,inLanguage:locale.lang,author:{'@type':'Organization',name:'Noon Deals Now'},publisher:{'@id':origin+'/#organization'}}]:[]),
  ...(faq.length?[{'@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}]:[])
 ]};
 const schema='<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,'\\u003c')+'</script>';
 const faqHtml=faq.length?'<section class="box faq"><h2>'+(isSA(m)?'الأسئلة الشائعة':'Frequently asked questions')+'</h2>'+
  faq.map(([q,a])=>'<details><summary>'+E(q)+'</summary><p>'+E(a)+'</p></details>').join('')+'</section>':'';
 const side='<aside><section class="box"><h2>'+(isSA(m)?'روابط مفيدة':'Useful links')+'</h2><div class="links">'+
  '<a href="'+baseUrl(m)+'">'+(isSA(m)?'كود خصم نون السعودية '+code(m):'Noon UAE code '+code(m))+'</a>'+
  '<a href="/'+m+'/categories">'+(isSA(m)?'أقسام السعودية':'UAE categories')+'</a>'+
  '<a href="/blog/'+m+'">'+(isSA(m)?'مدونة السعودية':'UAE blog')+'</a>'+
  '<a href="/'+m+'/shopping-guide">'+(isSA(m)?'دليل الشراء':'Shopping guide')+'</a></div></section></aside>';
 return '<!doctype html><html lang="'+locale.lang+'" dir="'+locale.dir+'"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>'+E(title)+'</title>'+
  '<meta name="description" content="'+E(desc).slice(0,160)+'"><meta name="robots" content="'+(indexable?'index,follow,max-image-preview:large':'noindex,follow')+'">'+
  '<link rel="canonical" href="'+canonical+'"><meta property="og:title" content="'+E(title)+'">'+
  '<meta property="og:url" content="'+canonical+'">'+schema+css+staticAnalytics+'</head><body>'+
  '<header style="background:#fff;padding:12px 3vw"><a href="/" style="font-weight:900">كوبونات نون / Noon Deals Now</a></header>'+NAV+
  '<section class="hero"><div class="w"><p><a href="/">الرئيسية</a> / <a href="/'+m+'">'+locale.name+'</a></p>'+
  '<h1>'+E(title)+'</h1><p class="muted">'+E(desc)+'</p></div></section>'+
  '<div class="w columns"><main>'+couponAction(m)+body+faqHtml+'</main>'+side+'</div>'+
  '<footer><div class="w"><strong>Noon Deals Now</strong><p>Independent shopping guide. Final prices and conditions are determined by Noon checkout.</p>'+
  '<a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/contact">Contact</a></div></footer>'+extraJS+'</body></html>';
}
const save=async(path,html)=>{
 if(!/^\/[a-z0-9/-]+$/.test(path)||path.includes('//'))throw Error('UNSAFE_PUBLIC_PATH_'+path);
 const publicCanonical=path==='/saudi/noon-coupon-code'?origin+'/saudi-arabia/noon-coupon-code':origin+path;
 if(!html.includes('href="'+publicCanonical+'"')||!html.includes('<h1>'))throw Error('BAD_COMMERCIAL_HTML_'+path);
 const dst=resolve(root,path.slice(1)+'.html');
 await mkdir(dirname(dst),{recursive:true});await writeFile(dst,html,'utf8');
};
const archived=JSON.parse(await readFile('.ndn-blog-staging/public-snapshot.json','utf8'));
const published=archived.objects?.['_ops/ai-v2-publication-ledger-v1.json']?.articles||[];
const cached=new Set(archived.cachedArticleSlugs||[]);
const latest=(m,n=3)=>published.filter(x=>x.country===(isSA(m)?'SA':'AE')&&cached.has(x.slug)).slice(0,n);
const recentLinks=m=>latest(m).map(x=>'<li><a href="/articles/'+E(x.slug)+'">'+E(x.slug.replace(/-/g,' '))+'</a></li>').join('');
let generated=0;
for(const m of ['saudi','uae']){
 const isArabic=isSA(m),codeNow=code(m);
 const title=isArabic?'كود خصم نون السعودية NOV170 | كوبونات نوفمبر 2026':'Noon UAE promo code NOV188 | November 2026 coupon guide';
 const desc=isArabic?'كود نون السعودية NOV170 مع طريقة نسخه وتجربته في السلة وروابط أدلة الجوالات والإلكترونيات والأجهزة المنزلية.':
  'Noon UAE code NOV188 with checkout instructions and practical guides for electronics, beauty and home appliances.';
 const body='<section class="box"><h2>'+(isArabic?'كيف تختبر كود نون السعودية؟':'How to test NOV188 in Noon UAE')+'</h2><p>'+
  (isArabic?'حدد عنوان التوصيل في السعودية، واختر منتجات تحتاجها فعلًا، ثم أدخل NOV170 في خانة الكوبون. قارن الإجمالي النهائي بالريال السعودي قبل الكود وبعده مع ثبات السلة والبائع ورسوم الشحن.':
  'Choose the UAE storefront and delivery address, place products you actually need into the cart, then enter NOV188. Compare the final AED amount before and after applying it without changing products, seller or delivery details.')+
  '</p><h2>'+(isArabic?'أدلة شراء مرتبطة بالكود':'Buyer guides related to the code')+'</h2><ul>'+guideLinks(m)+'</ul>'+
  '<h2>'+(isArabic?'مقالات منشورة من نفس السوق':'Real articles from the same market')+'</h2><ul>'+recentLinks(m)+'</ul></section>';
 const faq=isArabic?[['هل NOV170 كود للسعودية؟','نعم، هو كود السوق السعودي المدرج من مالك الموقع، والأهلية تحددها سلة نون.'],['هل هناك نسبة مؤكدة؟','لا نزعم نسبة ثابتة أو مدة سريان دون بيانات موثقة.']]:
 [['Is NOV188 the UAE code?','It is the owner-listed UAE code. Checkout determines eligibility.'],['Is a fixed saving guaranteed?','No. Only the payable total in the official checkout can confirm a saving.']];
 await save(baseUrl(m),page(m,baseUrl(m),title,desc,body,{faq}));generated++;
 const catPath='/'+m+'/categories',catTitle=isArabic?'أقسام نون السعودية | كوبون NOV170 ودليل المنتجات':'Noon UAE shopping categories | NOV188 and buyer guides';
 const cards=categories.map(c=>'<a class="linkcard" href="/'+m+'/category/'+c[0]+'"><strong>'+E(c[1])+'</strong><small>'+E(c[2])+'</small></a>').join('');
 const section='<section class="box"><h2>'+(isArabic?'ابدأ بالبحث عن منتج':'Choose your shopping focus')+'</h2><ul>'+guideLinks(m)+'</ul></section>'+
  '<section><h2>'+(isArabic?'كل أقسام نون السعودية':'Noon UAE categories')+'</h2><div class="grid">'+cards+'</div></section>';
 await save(catPath,page(m,catPath,catTitle,dirs[m].desc,section));generated++;
 const shopPath='/'+m+'/shopping-guide',shopTitle=isArabic?'دليل شراء نون السعودية وتوفير NOV170':'Noon UAE buying guide and NOV188 checklist';
 const shopBody='<section class="box"><h2>'+(isArabic?'خمس خطوات للشراء الذكي':'Five smart shopping steps')+'</h2><ol>'+
  [isArabic?'ابدأ بهدف واضح وميزانية قبل تصفح العروض.':'Start with a purpose and a budget.',
   isArabic?'راجع الموديل والمواصفات والبائع والضمان.':'Match model specifications, seller and warranty.',
   isArabic?'احسب السعر والشحن والتركيب إن وجد.':'Include shipping and disclosed installation.',
   isArabic?'طبّق الكود على نفس السلة ولا تغيّر عناصرها.':'Test the coupon without changing the basket.',
   isArabic?'اتخذ القرار بناءً على الإجمالي النهائي وسياسة الإرجاع.':'Decide using the final payable total and returns.'
  ].map(s=>'<li>'+E(s)+'</li>').join('')+'</ol><h2>'+(isArabic?'أدلة كل فئة':'Category decision guides')+'</h2><ul>'+guideLinks(m)+'</ul></section>';
 await save(shopPath,page(m,shopPath,shopTitle,dirs[m].desc,shopBody));generated++;
 for(const c of categories){
  const p='/'+m+'/category/'+c[0];
  const cTitle=isArabic?'دليل '+c[1]+' على نون السعودية | '+codeNow:'Noon UAE '+c[1]+' | '+codeNow;
  const content='<section class="box"><h2>'+E(c[1])+'</h2><p>'+E(c[2])+'</p><h2>'+(isArabic?'قبل أن تختار':'Before choosing')+'</h2><ol>'+
   [isArabic?'حدد الموديل والقياسات والمواصفات أو الكمية الدقيقة.':'Match exact model, size, quantity and compatibility.',
    isArabic?'قارن البائع والضمان وسياسة الإرجاع.':'Check seller, warranty and product-specific returns.',
    isArabic?'احسب الشحن والرسوم قبل تجربة الكود.':'Include shipping and disclosed extra fees.',
    isArabic?'اختبر '+codeNow+' داخل سلة المتجر واحكم على الإجمالي.':'Test '+codeNow+' in the UAE checkout, then compare the final total.'
   ].map(s=>'<li>'+E(s)+'</li>').join('')+'</ol><h2>'+(isArabic?'أدلة شراء ذات صلة':'Related detailed guides')+'</h2><ul>'+guideLinks(m)+'</ul></section>';
  await save(p,page(m,p,cTitle,dirs[m].desc,content,{indexable:false}));generated++;
 }
}
for(const s of seo){
 const m=s.m,isArabic=isSA(m),p=guideUrl(s),codeNow=code(m);
 const title=s.key+' | '+codeNow+' | '+(isArabic?'نون السعودية نوفمبر 2026':'Noon UAE November 2026');
 const intro=isArabic?'الشراء الذكي يبدأ بمراجعة احتياجك والمواصفات الحقيقية قبل البحث عن الكوبون. '+s.short+' لا نؤكد نسبة خصم أو أهلية منتج دون ظهورها في سلة نون السعودية.':
  s.short+' This guide explains how to assess product value before trying the owner-listed UAE code at checkout. The listing is not a promise of universal eligibility or a fixed discount.';
 const sections=s.parts.map(([h,b])=>'<h2>'+E(h)+'</h2><p>'+E(b)+'</p>').join('');
 const how=isArabic?
  '<h2>كيف تقارن الكود والعرض المباشر؟</h2><p>ثبّت عنوان التوصيل والبائع والكمية والموديل، وسجّل الإجمالي قبل إدخال الكود. بعدها جرّب NOV170 داخل متجر نون السعودية، ولا تعتبر أي رقم من خارج صفحة الدفع دليلاً على التوفير الفعلي. لا تضف منتجًا لا تحتاجه فقط لاستخدام الرمز. راجع أيضًا رسوم الشحن والإرجاع قبل إنهاء العملية.</p><h2>متى تختار عرضًا بديلًا؟</h2><p>لو كان الخصم المباشر يعطي إجماليًا أقل، راجع أن المنتجات والمواصفات والضمان متطابقة، وأن خدمة ما بعد البيع تلبي احتياجك. القرار الأفضل هو أقل تكلفة إجمالية لمنتج مناسب وليس أكبر نسبة مكتوبة في إعلان.</p>':
  '<h2>Coupon versus direct offer: the fair test</h2><p>Keep the seller, delivery address, quantity and exact product model unchanged. Record the total before entering the code and then try NOV188 in the Noon UAE checkout. Do not infer a saving from an external percentage claim. Include delivery and any mandatory service fees. Do not add unnecessary items only to reach an unverified promotion threshold.</p><h2>When to choose an alternative offer</h2><p>If a direct price is lower, compare identical specifications, seller support, return rights and warranty coverage. The most valuable purchase is a suitable product at the best final payable amount, not the largest advertised percentage.</p>';
 const faq=isArabic?[
  ['هل NOV170 مضمون لهذه الفئة؟','الأهلية يحددها المتجر داخل سلة نون السعودية، ولا نعرض ضمانًا على فئة كاملة.'],
  ['هل أحتاج لتغيير البائع؟','تغيير البائع قد يغيّر السعر والضمان والشحن. قارن كل عرض بشكل مستقل.'],
  ['كيف أحسب الوفر الحقيقي؟','قارن الإجمالي قبل وبعد الكود على نفس المنتجات مع رسوم التوصيل.']]:
  [['Is NOV188 guaranteed for this category?','No universal eligibility is claimed. Only the official UAE checkout can confirm it.'],
   ['Can the seller affect the final price?','Yes. Seller, delivery, warranty and returns can change the real cost.'],
   ['How should I calculate actual savings?','Compare the unchanged cart total before and after the code, including delivery.']];
 const imgPath='/assets/coupon-svg/seo-'+m+'-'+s.slug+'/1.svg';
 const svg=couponSvg({title:s.key,country:isArabic?'SA':'AE',coupon:codeNow,brand:'noon',variant:1});
 const imageDest=resolve(root,imgPath.slice(1));await mkdir(dirname(imageDest),{recursive:true});await writeFile(imageDest,svg,'utf8');
 const body='<article class="box"><img src="'+imgPath+'" width="1600" height="1000" alt="'+E(s.key)+' — '+codeNow+'" loading="eager" style="width:100%;height:auto" />'+
  '<h2>'+(isArabic?'ملخص القرار':'Buying decision overview')+'</h2><p>'+E(intro)+'</p>'+sections+how+
  '<h2>'+(isArabic?'أدلة مشابهة للسوق نفسه':'Explore other guides in this market')+'</h2><ul>'+guideLinks(m)+'</ul></article>';
 await save(p,page(m,p,title,s.short,body,{faq,kind:'Article'}));generated++;
}
// These legacy brand URLs were intermittently 429 under Workers Free 1027.
// Keep the same canonical URLs, provide brand-specific buying content, and
// link only to the correct market code and market-specific public articles.
for(const m of ['saudi','uae']){
 for(const brand of ['apple','samsung']){
  const p='/'+m+'/brand/'+brand,country=isSA(m)?'السعودية':'UAE';
  const brandName=brand==='apple'?'Apple':'Samsung';
  const title=isSA(m)?'دليل '+brandName+' على نون السعودية | كود '+code(m):
    brandName+' on Noon UAE | Buying Guide and '+code(m);
  const desc=isSA(m)?'قبل شراء أجهزة '+brandName+' على نون السعودية، قارن الموديل والضمان والبائع والشحن واختبر '+code(m)+' في السلة.':
    'Compare '+brandName+' model, storage, regional version, seller, warranty and delivery on Noon UAE before trying '+code(m)+'.';
  const details=brand==='apple'?[
    ['رقم موديل الجهاز','Check the exact iPhone, iPad, MacBook or accessory identifier and storage size; similar names may refer to different generations.'],
    ['النسخة والتوافق','Verify regional cellular support, SIM format, charger accessories and the service policy shown for the listing.'],
    ['الضمان وملحقات العلبة','Read seller warranty, return terms and whether a charger or peripheral is included, rather than assuming all bundles match.'],
    ['تكلفة الملحقات','Add required protection, keyboard or charger costs only where you actually need those items.']
  ]:[
    ['الموديل وسنة الإصدار','Confirm the exact Galaxy phone, tablet, watch or appliance model and its storage, screen or capacity.'],
    ['النسخة والتوافق','Compare regional bands, software version, power requirements or included accessories according to the product type.'],
    ['الضمان والبائع','Read the actual listing seller, warranty and after-sales support conditions; avoid assuming all marketplace sellers are identical.'],
    ['تكلفة إجمالية','Include shipping, setup and any necessary accessories in the final comparison.']
  ];
  const checks=details.map(([h,b])=>'<section><h2>'+E(h)+'</h2><p>'+E(b)+'</p></section>').join('');
  const content='<article class="box"><p>'+E(desc)+'</p>'+checks+
    '<h2>'+(isSA(m)?'السعر النهائي بعد تجربة الكوبون':'The final total after the coupon')+'</h2><p>'+
    (isSA(m)?'بعد تحديد الجهاز نفسه والبائع ورسوم الشحن في نون السعودية، جرّب '+code(m)+' على سلة ثابتة. لا تقارن عرضين مختلفين وتعتبر الفرق توفيرًا من الكود.':
      'Once the device, seller and delivery fee are fixed in Noon UAE, try '+code(m)+' on that exact basket. Use the AED payable total to decide whether the offer makes sense.')+
    '</p><h2>'+(isSA(m)?'مقالات السوق':'Market articles')+'</h2><ul>'+recentLinks(m)+'</ul>'+
    '<p><a href="/'+m+'/categories">'+(isSA(m)?'استعرض أقسام السعودية':'Explore UAE categories')+'</a></p></article>';
  await save(p,page(m,p,title,desc,content,{kind:'Article'}));generated++;
 }
}
// Legacy English UAE coupon route must be reachable without a Worker invocation,
// but must canonicalize to the single current UAE coupon guide to avoid a
// second nearly identical coupon page competing in search.
{
 const p='/en/uae/noon-coupon-code',target='/uae/noon-coupon-code';
 const html='<!doctype html><html lang="en-AE" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>Noon UAE Promo Code NOV188 | Current UAE Coupon Guide</title><meta name="robots" content="noindex,follow">'+
  '<link rel="canonical" href="'+origin+target+'"><meta http-equiv="refresh" content="0;url='+target+'">'+
  css+staticAnalytics+'</head><body>'+NAV+'<main class="w"><h1>Noon UAE promo code NOV188</h1><p>This URL now points to the main UAE market coupon guide.</p>'+
  '<p><a href="'+target+'">Open the Noon UAE coupon guide</a></p></main></body></html>';
 const dst=resolve(root,p.slice(1)+'.html');
 await mkdir(dirname(dst),{recursive:true});await writeFile(dst,html,'utf8');generated++;
}
const slogan='<section class="section" id="commercial-buying-intent"><div class="shell"><div class="head"><h2>كود خصم نون السعودية NOV170 — أقسام وأدلة التسوق</h2>'+
 '<p>اختر فئتك، قارن السعر النهائي، انسخ الكود من الصفحة الرئيسية ثم راجع قبوله في سلة نون السعودية.</p></div>'+
 '<div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">'+
 '<a class="guide" href="/saudi/noon-coupon-code"><h3>كوبون نون السعودية NOV170</h3><p>الطريقة الصحيحة لاستخدام الكود قبل الدفع.</p></a>'+
 '<a class="guide" href="/saudi/categories"><h3>أقسام نون السعودية</h3><p>الجوالات والإلكترونيات والأجهزة المنزلية والجمال.</p></a>'+
 '<a class="guide" href="/uae/noon-coupon-code"><h3>كوبونات نون الإمارات NOV188</h3><p>كود الإمارات المنفصل وروابط المقالات المرتبطة.</p></a>'+
 '</div><h3>أدلة شراء بنية البحث العالية</h3><div class="chips">'+
 seo.map(s=>'<a style="display:inline-block;padding:8px 11px;margin:5px;background:#fff;border:1px solid #ddd;border-radius:12px;color:#1558c0" href="'+guideUrl(s)+'">'+E(s.key)+'</a>').join('')+'</div></div></section>';
const rootFile=resolve(root,'index.html');
const home=await readFile(rootFile,'utf8');
if(!home.includes('<footer class="footer">')||!home.includes('NOV170'))throw Error('NDN_HOMEPAGE_STATIC_SOURCE_INVALID');
await writeFile(rootFile,home.replace('<footer class="footer">',slogan+'<footer class="footer">'),'utf8');
// A visible quick market menu works even on mobile where the legacy nav is hidden.
const files=(await readdir(root,{recursive:true})).filter(x=>/^(?:blog[\/]|blog\.html$|coupons\.html$|saudi\.html$|uae\.html$|categories\.html$|shopping-world\.html$|index\.html$)/.test(x)&&x.endsWith('.html'));
let updated=0;
for(const name of files){
 const file=resolve(root,name),html=await readFile(file,'utf8');
 if(html.includes('Quick shopping navigation')||html.includes('class="ndn-commercial-shortcuts"'))continue;
 if(!html.includes('</header>'))continue;
 await writeFile(file,html.replace('</header>','</header>'+NAV),'utf8');updated++;
}
// Every static page bypasses Worker HTML injection. Restore the existing
// live GA4 ID to original home, blog, archive and public article HTML exactly
// once; respect Do Not Track and keep admin/API untouched.
const publicHTML=(await readdir(root,{recursive:true})).filter(x=>x.endsWith('.html')&&!x.includes('/admin'));
let analyticsAdded=0;
for(const name of publicHTML){
 const dst=resolve(root,name);
 let html=await readFile(dst,'utf8');
 if(html.includes('id="ndn-static-ga4"')||html.includes('id="rescue-site-analytics"')||
    html.includes('gtag/js?id=G-1551Z7DJ2C'))continue;
 if(!html.includes('</head>'))continue;
 html=html.replace('</head>',staticAnalytics+'</head>');
 await writeFile(dst,html,'utf8');
 analyticsAdded++;
}
const report={generatedPages:generated,categoryPages:categories.length*2,keywordGuides:seo.length,
 homeOptimized:true,blogNavigationUpdated:updated,analyticsRestoredPages:analyticsAdded,primarySaudiCode:'NOV170',uaeCode:'NOV188'};
await writeFile('.ndn-blog-staging/market-seo-report.json',JSON.stringify(report,null,2),'utf8');
console.log('NDN_MARKET_BUYER_INTENT='+JSON.stringify(report));
