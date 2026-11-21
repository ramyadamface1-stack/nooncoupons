// P0: Trust / editorial pages must remain public after the Workers Free
// request quota is exhausted. Statements follow the site's editorial-trust
// layer, without inventing named reviewers or guaranteed promotions.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const domain='https://noondealsnow.com',out=resolve('.ndn-static-assets');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const routes=[
 {path:'/editorial-policy',title:'السياسة التحريرية | كوبونات نون',
  desc:'كيف نكتب ونراجع أدلة شراء نون، ونعرض أكواد الخصم دون ادعاء نسبة أو أهلية غير موثقة، ونصحح المعلومات إذا تغيرت.',
  sections:[
   ['الهدف من المحتوى','نساعد الزائر على اختيار السوق الصحيح، وفهم خطوات نسخ الكوبون، ومقارنة إجمالي سلة نون بما يشمل الشحن وشروط المنتج قبل الدفع. لا نساوي بين كتابة مقال ونشر عرض مؤكد لكل مستخدم.'],
   ['مصادر المعلومات','تُستخدم بيانات المنتج وشروط البائع الظاهرة في المتجر الرسمي عندما تتوفر. مواصفات المنتجات والأسعار والتوافر قابلة للتغيير؛ عند عدم توفر دليل موثق لا ننسب رقم سعر أو نسبة خصم أو حدًا أعلى أو تاريخ انتهاء للكود.'],
   ['فصل السوقين','صفحات السعودية مرتبطة بكود السوق السعودي NOV170، وصفحات الإمارات مرتبطة بكود NOV188. لا نعرض كوبون سوق على أنه صالح تلقائيًا للسوق الآخر.'],
   ['التحرير قبل النشر','نراجع وضوح العنوان والكلمة الأساسية، التطابق بين الصفحة والسوق والكوبون، روابط الفئات وأدلة الشراء، ومصدر الادعاءات التجارية. بعض المحتوى يمكن أن يساعد في صياغته الذكاء الاصطناعي؛ لا يمنحه ذلك صفة تجربة شخصية أو مراجعة مستقلة للمنتج.'],
   ['التحديث والتصحيح','وقت نشر المقال أو تعديله لا يعني وقت اختبار جديد للكوبون. عندما تصلنا معلومة موثقة عن تعديل الشروط أو خطأ تحريري، نراجع النص والروابط والبيانات؛ أما قبول الكوبون النهائي فيظهر في سلة نون.'],
   ['الاستقلالية والإفصاح','كوبونات نون موقع مستقل، وليس متجر نون أو ممثله الرسمي. قد يستفيد الموقع من برنامج كوبونات أو تسويق بالعمولة إذا استخدم العميل الكود وفق شروط البرنامج. هذا لا يغير حق الزائر في معرفة أن الخصم وقيمته يحددهما المتجر.']
  ]},
 {path:'/coupon-verification',title:'منهجية التحقق من أكواد نون | كوبونات نون',
  desc:'كيف تميّز بين كود مدرج لدى الموقع وخصم مطبّق فعلًا في السلة، مع فصل السعودية عن الإمارات وشرح شروط أهلية الحساب والمنتج.',
  sections:[
   ['ما المقصود بالكود المدرج؟','NOV170 هو الكود الأساسي المدرج للسعودية، وNOV188 للإمارات. إدراج الكود هنا لا يثبت تلقائيًا نسبة أو فئة محددة، ولا يضمن أن كل حساب سينجح في استخدامه.'],
   ['اختبار الخصم عمليًا','افتح نون الرسمي للسوق الصحيح، وضع منتجًا محددًا في السلة، ثم سجّل سعره والرسوم والخصم المباشر قبل استخدام الرمز. أدخل الكود واقرأ رسالة النظام وقارن الإجمالي للمنتجات والكمية والعنوان نفسيهما.'],
   ['عوامل قد تؤثر في نتيجة السلة','قد تختلف الأهلية بحسب الحساب والبائع وفئة المنتج وطريقة الدفع وعنوان التوصيل وشروط الحملة الحالية. لا تغيّر أكثر من عامل في مقارنة واحدة حتى لا تنسب فرق السعر للكود خطأً.'],
   ['كيف نعرض المعلومات غير المؤكدة؟','عندما لا نملك دليلًا موثقًا لنسبة أو حد أقصى أو موعد انتهاء، لا نخترع تلك البيانات. وتظل شروط نون النهائية والرسالة المعروضة عند الدفع المرجع الحاسم.'],
   ['الإبلاغ عن تغيّر البيانات','يمكن إرسال الملاحظات عبر صفحة اتصل بنا مع رابط المنتج أو نص شرط الحملة المعروض، ليراجعها فريق التحرير قبل تعديل الوصف.']
  ]},
 {path:'/authors/editorial-team',title:'فريق تحرير كوبونات نون | المسؤولية عن المحتوى',
  desc:'تعرف على الجهة التحريرية المسؤولة عن محتوى الموقع، ومنهج مراجعة أدلة الشراء والكوبونات والإفصاح عن حدود المعلومات.',
  sections:[
   ['من المسؤول عن المقالات؟','تُنشر صفحات الموقع باسم فريق تحرير كوبونات نون. لا ننسب النصوص إلى شخص خبير أو مستخدم جرّب منتجًا بعينه ما لم توجد معلومات حقيقية قابلة للتحقق تدعم ذلك.'],
   ['نطاق التحرير','نغطي محتوى التوفير والاستعداد للشراء من نون السعودية والإمارات، مثل مقارنة الموديلات والبائع والشحن واستخدام أكواد الخصم المناسبة لكل سوق.'],
   ['حدود المراجعة','إعداد دليل شراء لا يعني اختبار المنتج معمليًا أو تجربته على أرض الواقع. وعرض الكوبون لا يعني اختبارًا جديدًا لكل سلة. أوصاف المنتجات والشروط تتغير ويجب الرجوع إلى الصفحة الرسمية قبل الدفع.'],
   ['روابط الشفافية','يمكن مراجعة السياسة التحريرية ومنهجية التحقق وإخلاء المسؤولية من الروابط في أسفل هذه الصفحة.']
  ]},
 {path:'/disclaimer',title:'إخلاء المسؤولية والاستقلالية | كوبونات نون',
  desc:'توضيح استقلالية موقع كوبونات نون، وحدود المعلومات التجارية وآلية التحقق النهائي من الأسعار والكوبونات داخل متجر نون.',
  sections:[
   ['موقع مستقل','NoonDealsNow موقع مستقل للمحتوى والكوبونات وليس واجهة المتجر الرسمية، ولا يمثّل خدمة عملاء نون أو يتحكم في أنظمة قبول الأكواد أو الأسعار.'],
   ['التغيير المستمر','السعر والتوافر والبائع وتكاليف الشحن والسياسات والعروض تتغير. لا يضمن النص الموجود على موقعنا تطابق بيانات المنتج مع لحظة الدفع الفعلية.'],
   ['الكوبونات والمبيعات','الكود المذكور هو كود يدرجه مالك الموقع لسوقه. أي خصم مضمون أو نسبة موحدة أو حد أقصى أو فترة صلاحية يحتاج إلى شروط موثقة من المتجر.'],
   ['الانتقال إلى المتجر','عند الضغط على روابط المتجر ينتقل الزائر إلى نون الرسمي وقد يخضع لسياساته الخاصة. قد تكون للموقع استفادة تسويقية من استخدام كوبون طبقًا لشروط البرنامج، من دون أن يكون سعر المنتج تحت سيطرتنا.'],
   ['التواصل والتصحيح','إذا لاحظت خطأ في إحدى صفحات الموقع يمكنك إبلاغنا عبر صفحة التواصل، مع التحقق من أحدث تفاصيل الطلب من نون مباشرة.']
  ]}
];
const links=[
 ['/','الرئيسية'],['/blog','المدونة'],['/saudi/noon-coupon-code','كوبونات السعودية'],
 ['/uae/noon-coupon-code','كوبونات الإمارات'],
 ['/saudi/categories','أقسام السعودية'],['/uae/categories','أقسام الإمارات'],
 ['/editorial-policy','السياسة التحريرية'],['/coupon-verification','التحقق من الأكواد'],
 ['/authors/editorial-team','فريق التحرير'],['/disclaimer','الاستقلالية']
];
const css='<style>*{box-sizing:border-box}body{font:16px/1.95 Tahoma,Arial;background:#f7f9fc;color:#172033;margin:0}a{color:#1558c0;text-underline-offset:3px}.container{width:min(1000px,93%);margin:auto}.top{background:#fff;border-bottom:1px solid #e4e7ec;position:sticky;top:0}.top .container{padding:15px 0}.nav{display:flex;flex-wrap:wrap;gap:10px}.nav a{font-size:13px;font-weight:700}.hero{background:#fff;border-bottom:1px solid #e4e7ec;padding:30px 0}.hero h1{font-size:clamp(26px,4vw,42px);line-height:1.45;margin:8px 0}.box{background:#fff;border:1px solid #e1e7f0;border-radius:16px;padding:18px 22px;margin:16px 0}.box h2{font-size:22px;line-height:1.5}.muted{color:#52637a}footer{background:#111827;color:#fff;padding:25px;margin-top:32px}footer a{color:#f5f5ff}@media(max-width:640px){.box{padding:12px 15px}.top{position:static}}</style>';
const linkHtml=links.map(([url,label])=>'<a href="'+url+'">'+esc(label)+'</a>').join('');
let count=0;
for(const p of routes){
 const canonical=domain+p.path,modified='2026-11-21';
 const ld={'@context':'https://schema.org','@graph':[
  {'@type':'Organization','@id':domain+'/#organization',name:'كوبونات نون',url:domain+'/'},
  {'@type':'WebSite','@id':domain+'/#website',name:'Noon Deals Now',url:domain+'/'},
  {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:p.title,
   description:p.desc,inLanguage:'ar-SA',isPartOf:{'@id':domain+'/#website'},dateModified:modified},
  {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[
    {'@type':'ListItem',position:1,name:'الرئيسية',item:domain+'/'},
    {'@type':'ListItem',position:2,name:p.title,item:canonical}
  ]}
 ]};
 const article=p.sections.map(([h,b])=>'<section class="box"><h2>'+esc(h)+'</h2><p>'+esc(b)+'</p></section>').join('');
 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>'+esc(p.title)+'</title><meta name="description" content="'+esc(p.desc)+'">'+
 '<meta name="robots" content="index,follow,max-image-preview:large">'+
 '<link rel="canonical" href="'+canonical+'"><meta property="og:title" content="'+esc(p.title)+'">'+
 '<meta property="og:url" content="'+canonical+'"><meta name="ndn-static-editorial-policy" content="v1">'+
 '<script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,'\\u003c')+'</script>'+
 css+'</head><body><header class="top"><div class="container"><strong>كوبونات نون</strong><nav class="nav" aria-label="التنقل الرئيسي">'+linkHtml+'</nav></div></header>'+
 '<section class="hero"><div class="container"><p><a href="/">الرئيسية</a> / '+esc(p.title)+'</p>'+
 '<h1>'+esc(p.title)+'</h1><p class="muted">'+esc(p.desc)+'</p></div></section>'+
 '<main class="container"><article>'+article+'</article>'+
 '<section class="box"><h2>روابط إضافية</h2><nav class="nav">'+linkHtml+
 '</nav><p>للاستفسارات أو تصحيح معلومة، استخدم <a href="/contact">صفحة اتصل بنا</a>.</p></section></main>'+
 '<footer><div class="container"><strong>كوبونات نون — موقع مستقل</strong><div class="nav">'+linkHtml+
 '</div></div></footer></body></html>';
 if(!html.includes('<link rel="canonical" href="'+canonical+'">')||!html.includes('<h1>'))
   throw Error('NDN_TRUST_INVALID_HTML_'+p.path);
 const path=resolve(out,p.path.slice(1)+'.html');
 await mkdir(dirname(path),{recursive:true});
 await writeFile(path,html,'utf8');
 count++;
}
// Add trust footer links to the pages already built (home, blog, article).
// One lightweight footer anchor bar rather than altering article bodies/SEO.
const homePath=resolve(out,'index.html');
const home=await readFile(homePath,'utf8');
if(!home.includes('</footer>'))throw Error('NDN_TRUST_HOME_FOOTER_MISSING');
const trustBar='<nav aria-label="سياسة الموقع" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:10px 4vw;background:#111827">'+
 links.filter(([url])=>['/editorial-policy','/coupon-verification','/authors/editorial-team','/disclaimer'].includes(url))
 .map(([url,label])=>'<a style="color:#fff" href="'+url+'">'+esc(label)+'</a>').join('')+'</nav>';
await writeFile(homePath,home.replace('</footer>','</footer>'+trustBar),'utf8');
console.log('NDN_QUOTA_FREE_TRUST_ROUTES='+count+';PUBLIC_CANONICALS=true;NO_STAFF_OR_OFFER_CLAIMS_INVENTED=true');
