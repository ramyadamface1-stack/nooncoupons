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
 {m:'saudi',slug:'existing-customers',key:'كود خصم نون السعودية للعملاء الحاليين',short:'كيف تختبر NOV170 على حساب استخدمته سابقًا، وتفهم سبب رفض الكود من غير افتراض نسبة توفير ثابتة أو أهلية مؤكدة.',
 parts:[
 ['هل يمكن للعميل الحالي استخدام كود NOV170؟','NOV170 هو كود نون السعودية المدرج في هذا الموقع، وليس عرضًا نؤكد قبوله لكل حساب. لو سبق أن اشتريت من نون، افتح حسابك الحالي ومتجر السعودية، وحدد عنوان التوصيل وسلة فعلية. اكتب الكود كما هو في خانة الكوبون، ثم اقرأ الرد الظاهر من نون: قد تقبل السلة الرمز، أو يظهر شرط لا ينطبق على الحساب أو المنتج أو طريقة الدفع. لا يمكن استنتاج أهلية العملاء الحاليين من كون الرمز منشورًا في موقع كوبونات.'],
 ['طريقة تحقق عادلة دون تغيير الحساب','جهز سلة تحتوي على المنتجات التي تنوي شراءها بالفعل؛ سجّل أرقام الموديلات والكمية والبائع والتوصيل. راجع الإجمالي قبل تطبيق NOV170، ثم طبقه على نفس السلة. لا تسجل حسابات جديدة للتحايل على عروض الطلب الأول ولا تضف منتجات لا تحتاجها. إذا ظهرت رسالة رفض، احتفظ بالنص المعروض وراجع تفاصيل الحملة في نون، ولا تعتبر سعر منتج آخر أو عرض بائع مختلف دليلًا على نسبة الخصم.'],
 ['لماذا قد لا يظهر خصم مع الحساب القديم؟','يمكن أن تختلف العروض حسب الفئة والمنتج والبائع والحد الأدنى والموقع والحساب وطريقة الدفع ومدة الحملة؛ هذه عوامل يجب التحقق منها في شروط المتجر، وليست شروطًا نؤكد انطباقها على NOV170 تحديدًا. أحيانًا يلتبس الرصيد المسترد لاحقًا مع الخصم الفوري. تحقق هل انخفض إجمالي الدفع الآن أم ظهرت مكافأة أو رصيد منفصل بشروط محددة. إذا لم يتغير الإجمالي فلا نسمي ذلك توفيرًا محققًا.'],
 ['ماذا تفعل إذا رفضت السلة الكود؟','أولًا تأكد أنك على نون السعودية وأنك كتبت NOV170 دون مسافات. ثانيًا راجع أن المنتج والبائع وعنوان التوصيل متطابقون مع شروط العرض الظاهرة أمامك. ثالثًا اقرأ رسالة الرفض بدقة، وتحقق من العروض التلقائية أو البنكية التي قد تتعارض مع القسيمة. لا تفترض أن مسح الكاش أو تغيير الحساب يحل المشكلة. يمكنك فتح دليل «الكوبون لا يعمل» ومراجعة خدمة عملاء نون من الموقع الرسمي إذا احتجت تفسيرًا محددًا.'],
 ['كيف تختار أفضل إجمالي حتى لو الكود غير مؤهل؟','ثبت المنتج نفسه والمقاس والضمان والبائع ورسوم الشحن، ثم قارن الإجمالي الذي ستدفعه فعليًا بخيار آخر أو عرض مباشر. احسب التوصيل والتركيب والملحقات الضرورية، وسياسة الإرجاع، وأي رصيد مسترد منفصل. اختيار العرض الأقل تكلفة في السلة الثابتة أدق من الاعتماد على عبارة «خصم حتى» أو نسبة غير موثقة.'],
 ],
 faq:[
 ['هل NOV170 صالح لكل عملاء نون الحاليين؟','الكود مدرج للسعودية من مالك الموقع، لكن لا نؤكد قبول كل حساب أو سلة. رسالة نون والإجمالي النهائي هما الفيصل.'],
 ['هل أحتاج حسابًا جديدًا للحصول على NOV170؟','لا نوصي بإنشاء حساب آخر لتجاوز شروط العروض. استخدم حسابك الحالي واقرأ شروط القسيمة في المتجر.'],
 ['هل الكاش باك يعني أن السعر انخفض الآن؟','ليس بالضرورة. افصل بين خصم فوري يظهر في إجمالي السلة ورصيد أو مكافأة قد يخضعان لشروط وموعد صرف.']
 ]
 },
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
 {m:'uae',slug:'existing-customers',key:'Noon UAE promo code for existing customers',short:'A practical NOV188 checkout test for returning UAE shoppers without unsupported eligibility claims.',
 parts:[
 ['Can an existing Noon UAE customer use NOV188?','NOV188 is the UAE coupon listed by this website. A code being listed does not establish that it is accepted for every returning account. If you have ordered from Noon before, stay in your existing account, open the official UAE storefront and set your delivery address. Add the products you genuinely intend to buy, then enter NOV188 in the coupon field. The checkout response determines whether your basket is eligible. Never mistake a first-order promotion, a bank-only deal, or a wallet reward for a blanket returning-customer discount.'],
 ['How to compare the same basket before and after a code','Record the exact product model, quantity, selected seller and delivery address. Review the AED payable total before applying NOV188; then test the code without changing the basket. If Noon confirms a reduction, compare the actual final total including relevant shipping or service charges. Do not claim an advertised discount percentage is verified simply because a banner appears on a third-party site. Adding unwanted items to satisfy an unconfirmed minimum spend can make the order more expensive.'],
 ['Why may a returning customer see an ineligible message?','Eligibility might depend on campaign terms, account history, included categories, selected seller, region, minimum basket value, payment method or timing. Those are possible variables to check, not asserted restrictions for NOV188. Read the exact response from Noon and the promotion terms relevant to your cart. Do not treat creating a replacement account as a solution to restrictions on first-order offers, and avoid trusting coupon listings that promise universal acceptance without evidence.'],
 ['What if you already have a cashback or bank offer?','Distinguish an immediate price reduction from cashback or a delayed wallet credit. A coupon can change the current AED total, while a separate reward may be issued later subject to terms. Check whether offers can be combined in the official checkout before estimating savings; do not simply add advertised percentages. When comparing options, keep the product configuration, seller and delivery charges consistent so you can identify the lowest genuine payable total.'],
 ['Where should you go after a rejected NOV188 attempt?','Double-check that you are on the UAE storefront, copied the characters correctly and selected the intended delivery address. Read the rejection text; then review seller, product and payment-method conditions on Noon. If it remains unclear, consult the official store help pages or support. Our general coupon troubleshooting guide explains the checks to make without promising that the code will work for a specific returning account.'],
 ],
 faq:[
 ['Is NOV188 guaranteed for existing Noon UAE customers?','No universal approval is claimed. NOV188 is the owner-listed UAE code; eligibility and actual savings are determined by official checkout.'],
 ['Can I use a bank offer and NOV188 together?','Combination depends on the terms shown by Noon and the bank. Compare the final payable amount rather than assuming both offers stack.'],
 ['Does cashback mean my AED total fell immediately?','Not always. Check whether the offer is an instant reduction or a later credit, including any applicable conditions.']
 ]
 },
 {m:'uae',slug:'electronics',key:'Noon UAE electronics promo code',short:'Match device models, warranties and accessories before testing NOV188.',
 parts:[['Exact product identity','Match the model number, storage, ports, network support, included accessories and regional version of every device.'],['Warranty and seller','Check seller identity, warranty scope and returns. A low price does not make two different conditions equivalent.'],['Bundle comparison','Only count accessories you would otherwise purchase. Add delivery and any disclosed setup costs.'],['Coupon test','Use NOV188 at the official UAE checkout. No category-wide eligibility or percentage is promised.']]},
 {m:'uae',slug:'beauty',key:'Noon UAE perfume and beauty coupon code',short:'Compare formula, volume, concentration, seller and final AED price.',
 parts:[['Product variant','Compare matching fragrance concentrations, editions and bottle sizes; compute a comparable price per ml where possible.'],['Formula information','Review published skincare ingredients and directions without relying on unsupported medical claims.'],['Seller and returns','Confirm seller, packaging and the return policy applicable to the exact product.'],['AED total','Try NOV188 on the same UAE basket after checking size, delivery fees and seller terms.']]},
 {m:'uae',slug:'home-appliances',key:'Noon UAE home appliances coupon code',short:'Factor dimensions, installation costs, energy use and warranty into the final total.',
 parts:[['Dimensions','Measure installation space, ventilation and access routes before comparing appliances.'],['Capacity and utility','Compare capacity, energy information and programmes against real household usage, not only promotional headlines.'],['Service and delivery','Look for installation, shipping, warranty and local support terms that could change the true total cost.'],['NOV188 at checkout','Try the owner-listed code on the UAE cart, and base the purchase on the final AED amount.']]}
];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NAV='<nav aria-label="Quick shopping navigation" style="display:flex!important;flex-wrap:wrap;gap:12px;padding:10px 3vw;background:#fff;border-bottom:1px solid #e1e6ef;font:700 13px Tahoma,Arial"><a href="/saudi/noon-coupon-code">كوبونات السعودية</a><a href="/uae/noon-coupon-code">كوبونات الإمارات</a><a href="/saudi/categories">أقسام السعودية</a><a href="/uae/categories">أقسام الإمارات</a><a href="/brands">البراندات</a><a href="/blog">المدونة</a><a href="/golden-keywords">الكلمات الذهبية</a></nav>';
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
 // Canonical coupon hubs show the same answers inline as editorial sections.
 // Their FAQ schema reuses that visible text; do not print the Q&A twice.
 const faqHtml=faq.length&&!body.includes('data-ndn-aeo="market-answer-first-v1"')?'<section class="box faq"><h2>'+(isSA(m)?'الأسئلة الشائعة':'Frequently asked questions')+'</h2>'+
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
// The one canonical coupon hub per country directly answers commercial search
// queries instead of proliferating near-identical "best code today" pages.
// Display every FAQ answer verbatim in HTML before putting it into JSON-LD.
// This does NOT claim to have tested coupon acceptance for a given customer.
const couponHubQuestions={
 saudi:[
  ['ما كود خصم نون السعودية الموجود هنا؟',
   'كود نون السعودية المدرج على Noon Deals Now هو NOV170. افتح سلة نون السعودية الرسمية، وثبّت المنتج والبائع والكمية وعنوان الشحن، ثم أدخل الكود. قيمة الخصم وأهلية المنتجات والحساب يحددهما المتجر عند الدفع.'],
  ['هل يمكن للعميل الحالي استخدام NOV170؟',
   'يمكن للعميل الحالي تجربة NOV170 على حسابه المعتاد دون تغيير بياناته. لا نؤكد أن العرض متاح لكل حساب أو طلب؛ اقرأ رسالة نون داخل السلة. راجع دليل العملاء الحاليين إذا كانت هناك رسالة رفض أو التباس في الشروط.'],
  ['هل NOV170 مخصص لأول طلب فقط؟',
   'لا نفترض أن الكود مخصص لكل الطلبات الأولى أو أنه مقبول تلقائيًا للحساب الجديد. افتح دليل الطلب الأول وتحقق من شروط الحملة والمنتج وطريقة الدفع المعروضة في نون السعودية قبل الشراء.'],
  ['لماذا قد لا يظهر خصم عند إدخال الكود؟',
   'قد تختلف أهلية العروض حسب الحساب والبائع والفئة والحد الأدنى وطريقة الدفع ووقت الحملة؛ هذه عوامل للفحص وليست شروطًا مؤكدة لكود NOV170. اقرأ رسالة الرفض، وتحقق من السوق الصحيح، ثم قارن الإجمالي على نفس السلة.'],
  ['هل الكاش باك يساوي الخصم الفوري في نون؟',
   'لا. الخصم الفوري يظهر في قيمة الدفع الحالية عند قبوله، أما الرصيد أو المكافأة المستردة فقد تخضع لشروط وموعد اعتماد مختلفين. لا تجمع نسب العروض افتراضيًا؛ قارن المبلغ النهائي الذي ستدفعه الآن.']
 ],
 uae:[
  ['What is the Noon UAE promo code shown here?',
   'Noon Deals Now lists NOV188 as its UAE coupon. Open the official Noon UAE basket, keep the exact product, seller, quantity and address unchanged, and enter NOV188. The store checkout decides eligibility and the amount, if any, saved.'],
  ['Can existing Noon UAE customers try NOV188?',
   'Returning customers can test NOV188 in their existing account, but this page does not promise that every returning account or cart qualifies. Read the checkout message and refer to our dedicated existing-customer guide for a controlled comparison.'],
  ['Does NOV188 automatically apply to first orders?',
   'A new account or first purchase does not by itself confirm promotion eligibility. Review the official UAE checkout conditions, seller, product and selected payment method before expecting a first-order saving.'],
  ['Why does a Noon UAE coupon fail at checkout?',
   'Check the UAE storefront and copied code first. Campaign terms may depend on account, product, seller, basket value, payment method or date; these are possibilities to verify rather than claimed restrictions for NOV188. Use the checkout message to understand the result.'],
  ['Is Noon UAE cashback the same as instant savings?',
   'No. An instant coupon reduction changes the current AED payable total if accepted. Cashback or wallet credits can be separate benefits with their own timing and terms. Do not add percentages from unrelated promotions when comparing two baskets.']
 ]
};
const couponHubAnswers=(m)=>{
 const ar=isSA(m),answers=couponHubQuestions[m];
 const paths=[
  [guideUrl({m,slug:'existing-customers'}),ar?'كود نون للعملاء الحاليين':'Existing-customer coupon guide'],
  [guideUrl({m,slug:'first-order'}),ar?'دليل الطلب الأول':'First-order eligibility guide'],
  ['/guide/coupon-not-working',ar?'أسباب رفض الكوبون':'Why a coupon may fail'],
  ['/guide/noon-refund-credit',ar?'الفرق بين الرصيد المسترد والخصم':'Cashback and wallet-credit basics'],
  ['/coupon-verification',ar?'منهجية التحقق من أكواد نون':'How coupon information is reviewed']
 ];
 const intro=ar?
 'الإجابة السريعة: كود نون السعودية المدرج هنا هو NOV170. اختر منتجاتك من نون السعودية الرسمي وجرّب الرمز في سلة ثابتة؛ لا توجد نسبة خصم أو أهلية مضمونة لكل عميل أو منتج.':
 'Quick answer: the UAE coupon listed here is NOV188. Test it on the official Noon UAE checkout using an unchanged basket; no fixed savings rate or universal customer eligibility is promised.';
 return '<section class="box" id="coupon-quick-answers" data-ndn-aeo="market-answer-first-v1">'+
 '<h2>'+(ar?'الإجابة المباشرة عن كود خصم نون السعودية':'Noon UAE promo code: direct answers')+'</h2>'+
 '<p><strong>'+E(intro)+'</strong></p>'+
 answers.map(([q,a])=>'<section><h3>'+E(q)+'</h3><p>'+E(a)+'</p></section>').join('')+
 '<h3>'+(ar?'روابط تكمّل الإجابة قبل الدفع':'Specific guides before checkout')+'</h3><ul>'+
 paths.map(([href,label])=>'<li><a href="'+href+'">'+E(label)+'</a></li>').join('')+'</ul>'+
 '<p><a href="'+(ar?'https://www.noon.com/saudi-ar/':'https://www.noon.com/uae-en/')+
 '" rel="noopener sponsored" target="_blank">'+(ar?'راجع سلة نون السعودية الرسمية':'Check the official Noon UAE checkout')+
 '</a> · <a href="/editorial-policy">'+(ar?'السياسة التحريرية':'Editorial policy')+'</a></p></section>';
};
let generated=0;
for(const m of ['saudi','uae']){
 const isArabic=isSA(m),codeNow=code(m);
 const title=isArabic?'كود خصم نون السعودية NOV170 | كوبونات نوفمبر 2026':'Noon UAE promo code NOV188 | November 2026 coupon guide';
 const desc=isArabic?'كود نون السعودية NOV170 مع طريقة نسخه وتجربته في السلة وروابط أدلة الجوالات والإلكترونيات والأجهزة المنزلية.':
  'Noon UAE code NOV188 with checkout instructions and practical guides for electronics, beauty and home appliances.';
 const body='<section class="box"><h2>'+(isArabic?'كيف تختبر كود نون السعودية؟':'How to test NOV188 in Noon UAE')+'</h2><p>'+
  (isArabic?'حدد عنوان التوصيل في السعودية، واختر منتجات تحتاجها فعلًا، ثم أدخل NOV170 في خانة الكوبون. قارن الإجمالي النهائي بالريال السعودي قبل الكود وبعده مع ثبات السلة والبائع ورسوم الشحن.':
  'Choose the UAE storefront and delivery address, place products you actually need into the cart, then enter NOV188. Compare the final AED amount before and after applying it without changing products, seller or delivery details.')+
  '</p>'+couponHubAnswers(m)+'<h2>'+(isArabic?'أدلة شراء مرتبطة بالكود':'Buyer guides related to the code')+'</h2><ul>'+guideLinks(m)+'</ul>'+
  '<h2>'+(isArabic?'مقالات منشورة من نفس السوق':'Real articles from the same market')+'</h2><ul>'+recentLinks(m)+'</ul></section>';
 const faq=couponHubQuestions[m];
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
 const faq=s.faq||(isArabic?[
  ['هل NOV170 مضمون لهذه الفئة؟','الأهلية يحددها المتجر داخل سلة نون السعودية، ولا نعرض ضمانًا على فئة كاملة.'],
  ['هل أحتاج لتغيير البائع؟','تغيير البائع قد يغيّر السعر والضمان والشحن. قارن كل عرض بشكل مستقل.'],
  ['كيف أحسب الوفر الحقيقي؟','قارن الإجمالي قبل وبعد الكود على نفس المنتجات مع رسوم التوصيل.']]:
  [['Is NOV188 guaranteed for this category?','No universal eligibility is claimed. Only the official UAE checkout can confirm it.'],
   ['Can the seller affect the final price?','Yes. Seller, delivery, warranty and returns can change the real cost.'],
   ['How should I calculate actual savings?','Compare the unchanged cart total before and after the code, including delivery.']]);
 const imgPath='/assets/coupon-svg/seo-'+m+'-'+s.slug+'/1.svg';
 const svg=couponSvg({title:s.key,country:isArabic?'SA':'AE',coupon:codeNow,brand:'noon',variant:1});
 const imageDest=resolve(root,imgPath.slice(1));await mkdir(dirname(imageDest),{recursive:true});await writeFile(imageDest,svg,'utf8');
 const body='<article class="box"><img src="'+imgPath+'" width="1600" height="1000" alt="'+E(s.key)+' — '+codeNow+'" loading="eager" style="width:100%;height:auto" />'+
  '<h2>'+(isArabic?'ملخص القرار':'Buying decision overview')+'</h2><p>'+E(intro)+'</p>'+sections+how+
  (s.slug==='existing-customers'?'<p><a href="/guide/coupon-not-working">'+(isArabic?'حل مشكلة رفض الكوبون':'What to check when a coupon is rejected')+'</a> · <a href="'+guideUrl({m,slug:'first-order'})+'">'+(isArabic?'شروط الطلب الأول':'First-order eligibility')+'</a> · <a href="/coupon-verification">'+(isArabic?'منهجية التحقق من العروض':'How coupon conditions are reviewed')+'</a></p>':'')+
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



// Two additional distinct, query-specific guides fill gaps observed in GSC
// (Samsung S26 Ultra) and on official Noon UAE listings (Mini LED TV).
// They contain practical comparisons, no copied product descriptions or
// fabricated prices, ratings, volume, organic difficulty or coupon savings.
const specialistBuyerGuides=[
 {m:'saudi',slug:'samsung-s26-ultra',
 title:'سامسونج S26 Ultra على نون السعودية: النسخة والضمان قبل الخصم | NOV170',
 desc:'دليل شراء Samsung Galaxy S26 Ultra على نون السعودية: نسخة الشرق الأوسط، الضمان، التخزين وملحقات العلبة، قبل تجربة NOV170.',
 topic:'سامسونج S26 Ultra نسخة الشرق الأوسط على نون السعودية',
 sections:[
 ['ما الذي تتأكد منه قبل مقارنة سعر S26 Ultra؟',
 'عندما تبحث عن Samsung Galaxy S26 Ultra على نون السعودية، ابدأ برقم الموديل الكامل ونسخة المنطقة بدل الاعتماد على اسم S26 Ultra فقط. اعرف إن كان العرض لنفس الإصدار وسعة التخزين ولون الجهاز والحالة المذكورة في وصف البائع. السعر الأرخص لا يعني أن العرضين متطابقان. وجود شارة «نسخة الشرق الأوسط» أو «دولي» في بعض العناوين يستلزم قراءة مواصفات السلعة الفعلية قبل أي مقارنة.'],
 ['نسخة الشرق الأوسط والشبكات وeSIM',
 'تأكد من دعم شبكات الجوال التي تستخدمها، وخيارات الشريحة الفعلية أو الإلكترونية المذكورة في صفحة المنتج، وتوافق ميزات الاتصال مع شبكة بلدك. لا تفترض أن نسخة دولة أخرى مطابقة لنسخة السعودية أو أن كل هاتف يحمل الاسم التجاري نفسه يوفر كل ميزة. اقرأ ما يقدمه البائع عن رقم الموديل والشريحة والاتصال قبل الاعتماد على صور الإعلان.'],
 ['سعة 256 و512 جيجابايت: قارن حسب الاستخدام لا الاسم',
 'احسب احتياجك للصور والفيديوهات والتطبيقات والملفات الكبيرة قبل اختيار السعة. ثم قارن سعتين فقط عندما تكون بقية مواصفات النسخة وحالة الجهاز والضمان والبائع متطابقة. لا تفترض توافر سعة بعينها ولا فرق سعر ثابت؛ تتغير الخيارات والعروض حسب اللحظة. انتبه أن لون الهاتف أو الباقة المرفقة قد يغيّر السعر المعروض.'],
 ['من يقدم الضمان وما سياسة الإرجاع؟',
 'راجع اسم البائع الظاهر في نون السعودية، والجهة المسؤولة عن الضمان، ومدة تغطيته وشروطه، وسياسة إرجاع الإلكترونيات لهذا العرض تحديدًا. لا تُسوِّ بين «ضمان البائع» و«الضمان المحلي» دون تفاصيل مكتوبة. احتفظ بوصف السلعة وفاتورة الطلب؛ وفي حالة وجود مشكلة راجع مسار الدعم داخل حساب المتجر وشروط البائع.'],
 ['هل الشاحن وواقي الشاشة موجودان في العلبة؟',
 'لا تُضف قيمة الشاحن أو السماعات أو غلاف الحماية إلى حساب التوفير إلا إذا كانت ضمن محتويات العرض فعلًا. اقرأ «محتويات العلبة» في صفحة المنتج ولا تعتمد على صورة تسويقية عامة. إذا كنت تحتاج ملحقًا متوافقًا، قارن سعره وحده مع تكلفة العرض؛ فقد يكون الهاتف أقل سعرًا لكنه يتطلب ملحقات منفصلة.'],
 ['كيف تقارن العرض المباشر مع كود NOV170؟',
 'بعد اختيار النسخة الصحيحة والبائع والتخزين واللون وعنوان التوصيل، احتفظ بنفس السلة والكمية ورسوم الشحن. سجّل الإجمالي ثم جرّب NOV170 في نون السعودية. الأهلية والخصم النهائي يحددهما المتجر عند الدفع، ولا نعطي هنا نسبة مضمونة أو وعدًا بأن الكود يشمل الموديل. لو ظهر عرض مباشر أفضل على سلة مطابقة فاختر الإجمالي الأنسب.'],
 ['تحقق من المصدر الرسمي قبل الشراء',
 'استخدم صفحة الهواتف الذكية في نون السعودية لتبحث عن نفس رقم الموديل والتفاصيل الحالية، ثم انتقل إلى صفحة الكوبون السعودية في موقعنا إذا احتجت رمز NOV170. الدليل هنا لتحديد الأسئلة المهمة، وليس تقييم استخدام شخصي أو اختبار فعلي لبطارية الهاتف أو الكاميرا.']
 ],
 faq:[
  ['هل NOV170 يعطي خصمًا على Samsung S26 Ultra؟','نعرض NOV170 بوصفه كود السعودية المعتمد في الموقع، لكن قبول الموديل وقيمة التوفير يتحددان داخل سلة نون.'],
  ['هل نسخة الشرق الأوسط مثل النسخة العالمية؟','لا تفترض التطابق؛ ارجع إلى رقم الموديل ومواصفات الاتصال والضمان المذكورة في صفحة كل منتج.'],
  ['كيف أقارن عروض 256 و512 جيجابايت؟','اختر احتياجك للتخزين، ثم قارِن نفس الإصدار والضمان والبائع ورسوم التوصيل قبل الاختبار.']
 ],
 source:'https://www.noon.com/saudi-ar/electronics-and-mobiles/mobiles-and-accessories/mobiles-20905/smartphones/'
 },
 {m:'uae',slug:'mini-led-tv',
 title:'Noon UAE Mini LED TV Buying Guide: 55 vs 65 Inch, Warranty and NOV188',
 desc:'Compare 55-inch and 65-inch Mini LED TVs on Noon UAE: room fit, 4K refresh rate, UAE model warranty and installation cost before trying NOV188.',
 topic:'Noon UAE Mini LED TV size and installation buying guide',
 sections:[
 ['Start with the room, not the size printed in a flash deal',
 'A 55-inch and 65-inch television serve different spaces. Measure available wall width, cabinet depth, seating distance and the path by which the delivery team can bring the TV into your home. A larger diagonal is not automatically a better purchase. Compare the viewing conditions and the content you actually watch rather than an advertised percentage saving.'],
 ['Mini LED, QD-Mini LED, 4K and refresh rate are separate decisions',
 'Mini LED usually describes the screen backlighting technology; it is not a promise of identical panel quality across brands. Check the exact model number, claimed resolution, native refresh support and the inputs you need for a game console or streaming box. Some listings combine promotional terms in a title; verify detailed specifications before comparing two TVs as equivalent.'],
 ['What does 55 versus 65 inches change?',
 'The larger diagonal may offer a more immersive image from a suitable sofa position, but it requires more physical space and may affect mounting requirements. Check the stand width if using furniture and the wall-mount pattern when choosing a bracket. Do not assume installation or a bracket is included because an image shows the TV on a wall.'],
 ['Compare speakers, HDMI connections and gaming compatibility',
 'If you own a soundbar, game console or AV receiver, confirm HDMI port capabilities, eARC support if needed, supported video formats and physical cable access. Promotional graphics often focus on brightness and picture quality while omitting connection details. A TV that requires an additional adapter, mount or soundbar may cost more than the displayed checkout price.'],
 ['UAE model version, warranty, seller and returns',
 'Compare the actual model suffix or regional version, the legal seller, included accessories and local warranty service terms. Read the return policy applicable to TVs and the condition of the box on delivery. If you want wall mounting, ask who performs the installation and whether that service is priced separately. Delivery location and floor access may also affect the total.'],
 ['How to compare a UAE sale with NOV188',
 'Choose two offers that meet the same specifications. Keep seller, model version, delivery address, quantity and installation options consistent. Record the AED total before trying NOV188 at the official Noon UAE checkout. The site lists NOV188 for the UAE, but does not guarantee that a TV qualifies or that any fixed discount will apply. The final payable amount controls your decision.'],
 ['Where to verify currently offered TVs',
 'Use the official Noon UAE electronics category to review models and offer details as they appear at shopping time. This buying guide avoids claiming a fixed price or a permanent stock position; both change. Follow the UAE coupon link for the correct market rather than applying the Saudi NOV170 code by mistake.']
 ],
 faq:[
  ['Does NOV188 apply to all Mini LED TVs?','Eligibility varies by the store checkout conditions. Try it on the exact UAE basket and compare its payable AED total.'],
  ['Is a 65-inch Mini LED TV always better?','No. Room fit, viewing distance, panel features, warranty and installation needs can make a 55-inch model the more suitable choice.'],
  ['Are TV wall-mount brackets included on Noon UAE?','Do not assume they are included. Check the specific listing, package contents and any installation service separately.']
 ],
 source:'https://www.noon.com/uae-en/electronics/'
 }
];
for(const t of specialistBuyerGuides){
 const m=t.m,ar=isSA(m),path=guideUrl(t),coupon=code(m);
 const image='/assets/coupon-svg/seo-'+m+'-'+t.slug+'/1.svg';
 const svg=couponSvg({title:t.topic,country:ar?'SA':'AE',coupon,brand:'noon',variant:1});
 const imgPath=resolve(root,image.slice(1));
 await mkdir(dirname(imgPath),{recursive:true});await writeFile(imgPath,svg,'utf8');
 const content='<article class="box"><img src="'+E(image)+'" alt="'+E(t.topic)+' — '+coupon+
  '" width="1600" height="1000" loading="eager" style="width:100%;height:auto">'+
 '<p><strong>'+(ar?'دليل قرار شراء متخصص':'A decision-specific buying guide')+'</strong> — '+E(t.desc)+'</p>'+
 t.sections.map(([h,v])=>'<section><h2>'+E(h)+'</h2><p>'+E(v)+'</p></section>').join('')+
 '<p><a rel="noopener sponsored" target="_blank" href="'+E(t.source)+'">'+
 (ar?'تحقق من التفاصيل المحدثة على نون السعودية الرسمي':'Verify current models at the official Noon UAE store')+'</a></p>'+
 '<p><a href="/'+m+'/golden-keywords">'+(ar?'شاهد فرص الشراء والكلمات الأخرى للسعودية':'Other UAE buyer search guides')+'</a> · '+
 '<a href="/'+m+'/categories">'+(ar?'كل الأقسام':'Categories')+'</a></p></article>';
 await save(path,page(m,path,t.title,t.desc,content,{kind:'Article',faq:t.faq}));
 generated++;
}

// Evidence-gated keyword hub, not a generated brand-name permutation index.
// GSC: sc-domain:noondealsnow.com, 2026-10-23 through 2026-11-19, 128
// whole-site impressions and 1 click. The following selected query rows are
// first-party impressions, NOT Google monthly search volume or organic KD.
// Semrush/HYPD volume and difficulty providers unavailable on 2026-11-22.
// Keep unmeasured editorial ideas explicitly unverified, never fabricate KD.
const keywordEvidence={
 period:'2026-10-23/2026-11-19',
 source:'Google Search Console, web search, 28 settled days',
 volumeMeasured:false,organicDifficultyMeasured:false,
 observed:{
  'كود خصم نون السعودية':{impressions:1,position:70},
  'عروض نون للجوالات':{impressions:1,position:26},
  'الجمعة الصفراء نون':{impressions:1,position:1},
  'نون استرجاع الرصيد':{impressions:2,position:60},
  'noon s26 ultra':{impressions:2,position:19}
 }
};
// Each entry represents a distinct intent and a UNIQUE, implemented article
// target. Do not auto-permute 30 brand names into 60 near-identical cards.
const prioritizedKeywords={
 saudi:[
  {q:'عروض نون للجوالات: كيف تقارن النسخة والضمان؟',gsc:'عروض نون للجوالات',
   href:'/saudi/buying-guide/mobile-phones',intent:'مقارنة قبل شراء جوال',
   detail:'مقارنة رقم الموديل ونسخة الشرق الأوسط والبائع والضمان قبل فحص السعر النهائي في السعودية.'},
  {q:'سامسونج S26 Ultra على نون: فرق النسخ وسعة التخزين',gsc:'noon s26 ultra',
   href:'/saudi/buying-guide/samsung-s26-ultra',intent:'شراء موديل محدد',
   detail:'متى تختلف النسخة الإقليمية، وماذا تفحص في الضمان ومحتويات العلبة قبل تجربة الكود؟'},
  {q:'كيفية معرفة رصيد نون المسترجع من الكوبون',gsc:'نون استرجاع الرصيد',
   href:'/guide/noon-refund-credit',intent:'فهم الرصيد بعد الطلب',
   detail:'مكان الرصيد المعلق ووقت اعتماده والفرق بين رصيد الحساب والتخفيض المباشر.'},
  {q:'الجمعة الصفراء نون: كوبون أم عرض مباشر؟',gsc:'الجمعة الصفراء نون',
   href:'/guide/noon-yellow-friday',intent:'مقارنة عروض موسمية',
   detail:'طريقة مقارنة عرض الجمعة الصفراء والكوبون على نفس السلة دون الخلط بينهما.'},
  {q:'كود خصم نون السعودية NOV170 وطريقة استخدامه',gsc:'كود خصم نون السعودية',
   href:'/saudi-arabia/noon-coupon-code',intent:'الاستعداد للدفع',
   detail:'صفحة الكوبون السعودية الأساسية: نسخ الرمز واختيار السوق وفحص إجمالي سلة نون.'},
  {q:'كود نون السعودية للعملاء الحاليين: كيف أعرف أهلية حسابي؟',href:'/saudi/buying-guide/existing-customers',
   intent:'استخدام الرمز على حساب قديم',detail:'خطوات تجربة NOV170 على نفس السلة، وقراءة سبب الرفض والفرق بين الخصم الفوري والكاش باك دون ادعاء ضمان الأهلية.'},
  {q:'كود نون للطلب الأول: شروط حساب جديد',href:'/saudi/buying-guide/first-order',
   intent:'تأهيل أول عملية شراء',detail:'الفرق بين الحساب الجديد والطلب المؤهل وكيف تقارن رسوم التوصيل عند أول طلب.'},
  {q:'اختيار غسالة أو ثلاجة نون: الشحن والتركيب',href:'/saudi/buying-guide/home-appliances',
   intent:'شراء جهاز منزلي',detail:'أبعاد مكان التركيب والسعة ورسوم الخدمة والضمان؛ لا يعتمد القرار على نسبة الخصم فقط.'},
  {q:'كود نون للعطور: تركيز العطر وسعر الملليلتر',href:'/saudi/buying-guide/perfumes-beauty',
   intent:'مقارنة العبوات',detail:'قارن التركيز والحجم والبائع وسياسة الإرجاع بدل مقارنة عبوتين مختلفتين.'},
  {q:'نون مستلزمات الأطفال: مقاس الحفاضات وسعر القطعة',href:'/saudi/buying-guide/baby',
   intent:'شراء مستلزمات متكررة',detail:'الكمية والمقاس والسلامة وسعر القطعة، ثم فحص أثر كود السعودية في السلة.'}
 ],
 uae:[
  {q:'Noon UAE code for existing customers: eligibility and checkout',
   href:'/uae/buying-guide/existing-customers',intent:'Returning customer checkout',
   detail:'Check whether NOV188 applies to your current account, compare identical carts and distinguish cashback from instant savings.'},
  {q:'Noon UAE first order promo code: eligibility checklist',
   href:'/uae/buying-guide/first-order',intent:'First purchase checkout',
   detail:'How to confirm first-order conditions, seller and the final AED total without assuming guaranteed savings.'},
  {q:'Noon UAE Mini LED TV: 55 vs 65 inch buying checklist',
   href:'/uae/buying-guide/mini-led-tv',intent:'Compare a specific TV purchase',
   detail:'Room distance, 4K/refresh support, model generation, UAE warranty, wall mounting and final cart cost.'},
  {q:'Noon UAE electronics: regional warranty and model match',
   href:'/uae/buying-guide/electronics',intent:'Electronics purchase decision',
   detail:'Verify exact device identity, accessories, local warranty and delivery before trying NOV188.'},
  {q:'Noon UAE beauty offers: perfume size and formula',
   href:'/uae/buying-guide/beauty',intent:'Compare fragrances or skincare',
   detail:'Compare concentration, ml, formula, seller and returns instead of ranking by advertised percentage.'},
  {q:'Noon UAE washing machines: installation and delivery costs',
   href:'/uae/buying-guide/home-appliances',intent:'Appliance purchase decision',
   detail:'Check dimensions, installation service, energy rating and local support in the payable AED total.'},
  {q:'Noon UAE JBL speakers: AUX support and headphone latency',
   href:'/articles/uae-buyer-jbl-speaker-auxiliary-input-headphone-latency-h5-nov188-2026-n11',
   intent:'Check speaker compatibility',
   detail:'A published product-specific guide to input ports, headphone latency and accessories.'}
 ]
};
const keywordTile=(t,m,source)=>{
 const ar=isSA(m),observed=t.gsc&&keywordEvidence.observed[t.gsc];
 return '<article class="linkcard" style="height:100%;display:flex;flex-direction:column;gap:8px">'+
 '<small style="font-weight:700;color:#475569">'+E(t.intent)+'</small>'+
 '<h3 style="margin:0;font-size:18px;line-height:1.55"><a href="'+E(t.href)+'">'+E(t.q)+'</a></h3>'+
 '<p style="margin:0;flex:1;color:#475569">'+E(t.detail)+'</p>'+
 '<small style="color:#475569">'+
 (observed?(ar?'رُصدت صيغة البحث في Search Console':'Observed in Search Console'):
    (ar?'فرصة تحريرية مرشحة للقياس':'Editorial candidate — search demand unmeasured'))+
 '</small><a href="'+E(t.href)+'" style="font-weight:800">'+
 (ar?'افتح الدليل المختص':'Read the specific guide')+'</a></article>';
};
const keywordHtml=(m)=>prioritizedKeywords[m].map(t=>keywordTile(t,m)).join('');
const evidenceText='هذه عبارات مرتبطة بنية شراء واضحة. ظهرت بعض صيغها في Google Search Console، بينما بقية الموضوعات مرشحة للتحقق. لا تتوفر حاليًا بيانات دقيقة لحجم البحث الشهري أو درجة صعوبة SEO في السعودية والإمارات؛ لذلك لا نصف أي كلمة بأنها الأعلى بحثًا أو الأقل منافسة دون قياس مستقل.';
const keywordContent=(m)=>{
 const ar=isSA(m);
 return '<section class="box"><h2>'+(ar?'كيف اختيرت الكلمات؟':'How were these search intents chosen?')+'</h2><p>'+
 (ar?evidenceText:'Each topic covers a different purchase decision, rather than changing a brand name in one repeated coupon template. Monthly search volume and organic keyword difficulty have not yet been measured. These are editorial hypotheses, not guaranteed high-volume low-competition rankings.')+
 '</p><p><a href="/golden-keywords">'+(ar?'شوف خريطة السوقين':'Explore the full keyword roadmap')+'</a> · '+
 '<a href="/blog/'+m+'">'+(ar?'أحدث مقالات السعودية':'Latest UAE articles')+'</a></p></section>'+
 '<section><h2>'+(ar?'كلمات شراء ودليل مستقل لكل نية':'Distinct buyer-intent guides')+'</h2>'+
 '<div class="grid">'+keywordHtml(m)+'</div></section>'+
 '<section class="box"><h2>'+(ar?'الخطوة الأخيرة قبل الشراء':'Before you place an order')+'</h2><p>'+
 (ar?'اختر المنتج وفق احتياجك، وثبّت الموديل والبائع والكمية والشحن، ثم جرّب NOV170 في سلة نون السعودية. نسبة الخصم ليست مؤكدة سلفًا.':
 'Keep model, seller, quantity, delivery and return terms consistent; then try NOV188 at the official Noon UAE checkout. No universal saving is promised.')+
 '</p></section>';
};
for(const m of ['saudi','uae']){
 const path='/'+m+'/golden-keywords',ar=isSA(m);
 const title=ar?'فرص كلمات نون السعودية: الجوالات والكوبونات والطلب الأول | NOV170':
  'Noon UAE Buyer Search Guides: First Order, TVs, Electronics | NOV188';
 const desc=ar?'دليل مخصص لعبارات شراء نون السعودية: عروض الجوالات، رصيد نون، الجمعة الصفراء، سامسونج S26 Ultra والطلب الأول؛ محتوى مستقل لكل سؤال.':
  'Explore distinct Noon UAE buying topics: first-order eligibility, Mini LED TVs, electronics warranties, beauty and appliances. Real guide links, NOV188.';
 let html=page(m,path,title,desc,keywordContent(m));
 const rows=prioritizedKeywords[m];
 const ld={'@context':'https://schema.org','@type':'ItemList',name:title,
  numberOfItems:rows.length,itemListElement:rows.map((t,i)=>({'@type':'ListItem',position:i+1,
   name:t.q,url:origin+t.href}))};
 html=html.replace('</head>','<script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,'\\u003c')+'</script></head>');
 await save(path,html);generated++;
}
{
 const path='/golden-keywords',title='الكلمات المفتاحية الذهبية: فرص بحث لنون السعودية والإمارات | أدلة شراء مخصصة';
 const desc='اختيارات مبنية على نية البحث وبيانات Search Console المتاحة، بدون تكرار أسماء البراندات أو اختلاق حجم البحث. السعودية NOV170 والإمارات NOV188.';
 const section=(m)=>{
 const ar=isSA(m);
 return '<section class="box" id="'+m+'"><h2>'+(ar?'السعودية — فرص بحث مرتبطة بـNOV170':'UAE — purchase intents with NOV188')+'</h2>'+
 '<p>'+(ar?'موضوعات منفصلة عن الجوالات والطلب الأول والرصيد والتسوق الموسمي، مع الربط المباشر بالدليل المتخصص.':
   'Specific questions about eligible first orders, TV selection, warranties, skincare and appliances.')+'</p>'+
 '<p><a href="/'+m+'/golden-keywords">'+(ar?'جميع فرص السعودية':'All UAE buying topics')+'</a> · '+
 '<a href="/blog/'+m+'">'+(ar?'مقالات السعودية':'UAE articles')+'</a></p>'+
 '<div class="grid" dir="'+(ar?'rtl':'ltr')+'">'+keywordHtml(m)+'</div></section>';
 };
 const main='<section class="box"><h2>مش كل كلمة فيها «نون» فرصة ذهبية</h2><p>'+E(evidenceText)+'</p>'+
 '<p>بدل 60 عنوانًا متشابهًا، اخترنا موضوعات مختلفة ووصلنا كل موضوع بدليله المتخصص. يمكنك الانتقال للدولة المناسبة دون اختلاط الكوبونات.</p>'+
 '<p><a href="#saudi">فرص السعودية</a> · <a href="#uae">UAE opportunities</a> · <a href="/editorial-policy">السياسة التحريرية</a></p>'+
 '<p><strong>مصدر الرصد:</strong> '+E(keywordEvidence.source)+'. مصدر قياس صعوبة الكلمات وحجم البحث: غير متاح بعد.</p></section>'+
 section('saudi')+section('uae')+
 '<section class="box"><h2>الأسئلة الشائعة</h2><p><strong>هل هذه أعلى الكلمات بحثًا وأقلها منافسة؟</strong> لا يمكن تأكيد ذلك دون أرقام حجم البحث وصعوبة SEO للسوق السعودي والإماراتي؛ المعروض الآن فرص أولية واضحة النية.</p>'+
 '<p><strong>هل الصفحات مكررة؟</strong> لا نعيد نفس قالب البراند؛ كل رابط يتناول قرارًا مختلفًا عند الشراء أو مشكلة خاصة بالكوبون.</p></section>';
 let html=page('saudi',path,title,desc,main);
 const ld={'@context':'https://schema.org','@type':'CollectionPage',name:title,url:origin+path,
  description:desc,inLanguage:'ar-SA',
  hasPart:['saudi','uae'].map(m=>({'@type':'CollectionPage',url:origin+'/'+m+'/golden-keywords'}))};
 html=html.replace('</head>','<meta name="ndn-public-golden-keywords" content="evidence-gated-v2"><script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,'\\u003c')+'</script></head>');
 await save(path,html);generated++;
}
await writeFile('.ndn-blog-staging/golden-keyword-evidence-report.json',
 JSON.stringify({version:2,source:keywordEvidence.source,range:keywordEvidence.period,
 monthlySearchVolumeMeasured:false,organicKeywordDifficultyMeasured:false,
 sa:prioritizedKeywords.saudi.map(t=>({query:t.q,observedKeyword:t.gsc||null,target:t.href,
  gscEvidence:t.gsc?keywordEvidence.observed[t.gsc]:null})),
 ae:prioritizedKeywords.uae.map(t=>({query:t.q,observedKeyword:null,target:t.href,
  gscEvidence:null}))},null,2),'utf8');
console.log('NDN_GOLDEN_PUBLIC_PAGES=3;SA_INTENTS='+prioritizedKeywords.saudi.length+
 ';AE_INTENTS='+prioritizedKeywords.uae.length+
 ';REPEATED_BRAND_TITLES=0;SEARCH_VOLUME_FABRICATED=FALSE;ORGANIC_KD_FABRICATED=FALSE');

const slogan='<section class="section" id="commercial-buying-intent"><div class="shell"><div class="head"><h2>كود خصم نون السعودية NOV170 — أقسام وأدلة التسوق</h2>'+
 '<p>اختر فئتك، قارن السعر النهائي، انسخ الكود من الصفحة الرئيسية ثم راجع قبوله في سلة نون السعودية.</p></div>'+
 '<div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">'+
 '<a class="guide" href="/saudi/noon-coupon-code"><h3>كوبون نون السعودية NOV170</h3><p>الطريقة الصحيحة لاستخدام الكود قبل الدفع.</p></a>'+
 '<a class="guide" href="/saudi/categories"><h3>أقسام نون السعودية</h3><p>الجوالات والإلكترونيات والأجهزة المنزلية والجمال.</p></a>'+
 '<a class="guide" href="/uae/noon-coupon-code"><h3>كوبونات نون الإمارات NOV188</h3><p>كود الإمارات المنفصل وروابط المقالات المرتبطة.</p></a>'+
 '</div><p><strong>أسئلة الكوبونات قبل الشراء:</strong> '+
 '<a href="/saudi/buying-guide/existing-customers">كود نون السعودية للعملاء الحاليين</a> · '+
 '<a href="/saudi/buying-guide/first-order">الطلب الأول في السعودية</a> · '+
 '<a href="/uae/buying-guide/existing-customers" lang="en">Noon UAE for existing customers</a> · '+
 '<a href="/uae/buying-guide/first-order" lang="en">Noon UAE first order</a> · '+
 '<a href="/guide/coupon-not-working">لماذا قد يرفض نون الكود؟</a></p>'+
 '<p><a href="/golden-keywords" style="color:#1558c0;font-weight:900">صفحة الكلمات المفتاحية الذهبية للسعودية والإمارات</a></p><h3>أدلة شراء بنية البحث العالية</h3><div class="chips">'+
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
 if(name==='blog.html'||name.startsWith('blog/')||html.includes('data-blog-premium="v1"')||html.includes('Quick shopping navigation')||html.includes('class="ndn-commercial-shortcuts"'))continue;
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
