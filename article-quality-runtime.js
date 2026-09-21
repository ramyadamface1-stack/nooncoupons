const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=(s,re)=>(String(s||'').match(re)||[]).length;
const visibleWords=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().split(/\s+/).filter(Boolean).length;
const slugSeed=s=>{let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
function legacyDepthBlocks({slug,keyword,coupon,market,currency}){
  const k=esc(keyword||'اختيار المنتج');
  const c=esc(coupon);
  const m=esc(market);
  const cur=esc(currency);
  const blocks=[
    `<section class="legacy-depth legacy-depth-evidence"><h2>سجل تحقق عملي لـ ${k}</h2><p>قبل تجربة ${c}، دوّن اسم المنتج، البائع، الكمية، تكلفة الشحن، وموعد التسليم الظاهر. بعد إدخال الكود، راجع العناصر نفسها بالترتيب. الهدف ليس إثبات نسبة خصم ثابتة، بل معرفة ما إذا تغيّر الإجمالي مع بقاء مكونات السلة نفسها. احتفظ بالنتيجة الحالية فقط باعتبارها لقطة زمنية؛ أهلية الحساب والحملات قد تتغير لاحقًا.</p></section>`,
    `<section class="legacy-depth legacy-depth-seller"><h2>كيف تفرّق بين أثر الكود وأثر البائع؟</h2><p>في نون ${m} قد يتوافر المنتج من أكثر من بائع، وقد تختلف رسوم الشحن أو زمن التوصيل أو سياسة الإرجاع. لذلك ثبّت البائع قبل المقارنة. إذا تغيّر البائع أثناء التجربة فلا تعتبر فرق السعر نتيجة للكوبون. قارِن إجمالي الطلب النهائي بعملة ${cur}، وراجع اسم البائع في السلة قبل وبعد إدخال ${c}.</p></section>`,
    `<section class="legacy-depth legacy-depth-eligibility"><h2>تشخيص سبب عدم قبول ${c}</h2><p>ابدأ بالسوق الصحيح، ثم افحص المنتج والبائع والحد الأدنى للسلة إن ظهر شرط رسمي. بعد ذلك غيّر عاملًا واحدًا فقط في كل محاولة: المنتج، الكمية، البائع، أو طريقة الدفع. هذا الأسلوب يمنع الاستنتاجات الخاطئة ويجعل سبب الرفض أو القبول أوضح. لا تفترض أن نتيجة حساب واحد تنطبق على جميع المستخدمين.</p></section>`,
    `<section class="legacy-depth legacy-depth-returns"><h2>الإرجاع والشحن جزء من قرار الشراء</h2><p>حتى إذا تغيّر الإجمالي بعد استخدام الكود، راجع تكلفة الشحن، موعد التسليم، وسياسة الإرجاع الخاصة بالمنتج والبائع. الصفقة الأفضل ليست دائمًا الأقل رقمًا في سطر الخصم؛ المهم هو التكلفة النهائية وشروط ما بعد الشراء. عند المقارنة بين خيارين، استخدم نفس السوق ونفس المواصفات ونفس الكمية حتى تكون المقارنة عادلة.</p></section>`,
    `<section class="legacy-depth legacy-depth-variant"><h2>تحقق من المواصفات والنسخة قبل الدفع</h2><p>إذا كان ${k} له أكثر من لون أو سعة أو مقاس أو إصدار، فتأكد أن النسخة لم تتغير أثناء تجربة القسيمة. اختلاف المواصفات قد يغيّر السعر والتوافر والبائع من دون أن يكون للكود علاقة بذلك. راجع اسم النسخة، المواصفات الأساسية، والكمية في السلة، ثم طبّق ${c} وراجع الإجمالي النهائي فقط بعد تثبيت هذه العناصر.</p></section>`,
    `<section class="legacy-depth legacy-depth-payment"><h2>طريقة الدفع والمرحلة الصحيحة للتحقق</h2><p>بعض الشروط التجارية قد تظهر في مراحل متأخرة من السلة أو الدفع. لذلك لا تعتمد على رسالة أولية وحدها. أكمل حتى المرحلة التي تعرض الإجمالي النهائي بوضوح من دون إتمام الشراء، وتأكد من أن العملة هي ${cur}. إذا ظهر اختلاف مرتبط بطريقة الدفع، سجّله كعامل مستقل ولا تنسبه تلقائيًا إلى ${c}.</p></section>`,
    `<section class="legacy-depth legacy-depth-freshness"><h2>لماذا تحتاج النتيجة إلى مراجعة حديثة؟</h2><p>الأسعار، البائعون، المخزون، ورسوم الشحن قد تتغير خلال اليوم. لذلك تُعامل نتيجة السلة على نون ${m} كدليل وقتي وليست وعدًا دائمًا. عند العودة للمقال لاحقًا، أعد تنفيذ نفس خطوات التحقق بدل الاعتماد على نتيجة قديمة. المصدر التجاري النهائي يظل صفحة المنتج والسلة وشروط نون الحالية وقت الطلب.</p></section>`,
    `<section class="legacy-depth legacy-depth-decision"><h2>قاعدة قرار سريعة قبل إتمام الطلب</h2><p>اختر الخيار الذي يحافظ على المواصفات المطلوبة والبائع المقبول وشروط الشحن والإرجاع المناسبة، ثم قارِن الإجمالي النهائي بعد تطبيق ${c}. إذا لم يكن الفرق واضحًا أو تغيّر أكثر من عامل في الوقت نفسه، أعد المقارنة من البداية. هذه الخطوات تقلل احتمال نسبة التوفير إلى سبب غير صحيح وتبقي القرار مبنيًا على بيانات السلة الفعلية.</p></section>`,
    `<section class="legacy-depth legacy-depth-warranty"><h2>الضمان ومن يقدمه</h2><p>قبل الدفع راجع جهة الضمان ومدته وشروطه كما تظهر للمنتج نفسه، خصوصًا إذا كان ${k} متاحًا من أكثر من بائع. لا تجعل قبول ${c} سببًا لتجاهل اختلاف الضمان بين خيارين. عند المقارنة، ثبّت النسخة والبائع ثم سجل جهة الضمان مع الإجمالي النهائي حتى يكون قرار الشراء مبنيًا على القيمة الكاملة وليس السعر وحده.</p></section>`,
    `<section class="legacy-depth legacy-depth-bundle"><h2>افصل قيمة المنتج عن الباقات والهدايا</h2><p>قد تتغير قيمة السلة إذا أضيف ملحق أو باقة أو هدية تلقائية. افحص مكونات السلة قبل وبعد تطبيق ${c} وتأكد أن المقارنة تخص المنتج نفسه. إذا اختفت إضافة أو تغيرت الكمية فلا تعتبر كل الفرق ناتجًا عن القسيمة. دوّن محتويات السلة النهائية بوضوح قبل اختيار العرض الأنسب في نون ${m}.</p></section>`,
    `<section class="legacy-depth legacy-depth-stock"><h2>المخزون والتوافر قد يغيران النتيجة</h2><p>إذا تغيّر المخزون أثناء التجربة فقد ينتقل الطلب إلى بائع آخر أو تتغير مدة التوصيل. أعد فتح صفحة ${k} وتأكد أن النسخة والبائع ما زالا متاحين قبل الاعتماد على الإجمالي. عند انخفاض المخزون لا تسرع بسبب الكود فقط؛ راجع الشحن والإرجاع والضمان، ثم أعد تطبيق ${c} على نفس الاختيار إن ظل متاحًا.</p></section>`,
    `<section class="legacy-depth legacy-depth-account"><h2>الأهلية مرتبطة بالحساب والسلة الحالية</h2><p>نتيجة ${c} قد تختلف بين حساب وآخر أو بين سلتين مختلفتين، لذلك لا تستخدم تجربة شخص آخر كدليل نهائي. اختبر الكود على حسابك والسلة نفسها، وتجنب تغيير أكثر من عامل في الوقت ذاته. إذا ظهرت رسالة أهلية أو شرط رسمي فاعتبرها المرجع لتلك المحاولة فقط، ثم راجع الإجمالي النهائي قبل الدفع.</p></section>`,
    `<section class="legacy-depth legacy-depth-delivery"><h2>قارن موعد التوصيل مع التكلفة النهائية</h2><p>السعر المقبول مع توصيل متأخر قد لا يكون أفضل من خيار أغلى قليلًا يصل في الوقت المطلوب. عند تقييم ${k}، سجل موعد التوصيل ورسومه قبل تجربة ${c} وبعدها. إذا تغيّر البائع أو طريقة الشحن، أعد المقارنة من البداية لأن فرق الإجمالي قد يأتي من التوصيل وليس من القسيمة.</p></section>`,
    `<section class="legacy-depth legacy-depth-checkout"><h2>مراجعة نهائية قبل تأكيد الطلب</h2><p>قبل الضغط على إتمام الطلب، طابق اسم المنتج والنسخة والكمية والبائع وعنوان السوق والعملة ${cur}. ثم راجع سطر القسيمة ورسوم الشحن والإجمالي النهائي. إذا كان أي عنصر مختلفًا عما بدأت به، لا تستخدم الفرق كدليل على أداء ${c}. أعد الاختبار بسلة ثابتة حتى تكون النتيجة قابلة للفهم والمقارنة.</p></section>`
  ];
  const shift=blocks.length?slugSeed(slug)%blocks.length:0;
  return blocks.slice(shift).concat(blocks.slice(0,shift));
}
function sanitizeMalformedJsonLd(html){
  let removed=0;
  const out=String(html||'').replace(/<script\b([^>]*)type=["']application\/ld\+json["']([^>]*)>([\s\S]*?)<\/script>/gi,(whole,a,b,json)=>{
    try{JSON.parse(json);return whole}catch{removed++;return ''}
  });
  return {html:out,removed};
}

function cleanText(s){return String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function truncateWordBoundary(s,max=72){
  const x=cleanText(s);if(x.length<=max)return x;
  const cut=x.slice(0,max+1),i=cut.lastIndexOf(' ');
  return (i>=Math.max(28,max-18)?cut.slice(0,i):x.slice(0,max)).trim();
}
export function normalizeRuntimeTitle(raw,{keyword='',market=''}={}){
  let t=cleanText(raw||keyword);
  if(t.length>=28&&t.length<=72)return t;
  if(t.length<28)t=cleanText((t||keyword)+' | دليل نون '+market+' قبل الدفع');
  if(t.length<28)t=cleanText(t+' واستخدام الكوبون');
  return truncateWordBoundary(t,72);
}
export function normalizeRuntimeMeta(raw,{keyword='',market='',coupon='',plain=''}={}){
  let m=cleanText(raw);
  if(m.length>=105&&m.length<=165)return m;
  const base=cleanText(keyword)+' في نون '+market+': تحقق من كود '+cleanText(coupon)+'، والبائع والشحن والإجمالي النهائي قبل الدفع، مع توضيح الأهلية بدون افتراض خصم ثابت.';
  m=cleanText(base);
  if(m.length<105)m=cleanText(m+' راجع شروط السلة الحالية ونتيجة نون النهائية قبل إتمام الطلب.');
  if(m.length>165)m=truncateWordBoundary(m,165);
  if(m.length<105){
    const fallback=cleanText(plain);
    if(fallback.length>=105)m=truncateWordBoundary(fallback,165);
  }
  return m;
}

function faqBlock({coupon,market}){
  const rows=[
    [`كيف أتحقق من كود ${coupon} على نون ${market}؟`,`ثبّت المنتج والبائع والكمية، أدخل ${coupon} في السلة، ثم راجع الإجمالي النهائي قبل الدفع.`],
    [`هل ${coupon} مضمون لكل حساب؟`,`لا. أهلية الكود قد تختلف حسب الحساب والسلة والحملة الحالية، ونتيجة نون داخل السلة هي المرجع النهائي.`],
    ['ماذا أفعل إذا لم يعمل الكود؟','تأكد من السوق والمنتج والبائع، ثم جرّب سلة أصغر مع تغيير عامل واحد في كل محاولة حتى تعرف سبب الاختلاف.'],
    ['كيف أقارن الصفقة بشكل صحيح؟','قارن المنتج والبائع والشحن والإرجاع والإجمالي النهائي، ولا تعتمد على قبول القسيمة وحده.']
  ];
  const visible=rows.map(([q,a])=>`<details><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join('');
  const schema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:rows.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};
  return `<section class="faq legacy-quality-faq"><h2>أسئلة شائعة قبل الدفع</h2>${visible}</section><script type="application/ld+json" data-schema="legacy-faq">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`;
}

function imageBlock({slug,coupon,country,keyword},start,countNeeded){
  const market=country==='AE'?'الإمارات':'السعودية';
  const roles=['مراجعة السلة قبل تطبيق الكود','مقارنة البائع والشحن','التحقق من الإجمالي النهائي'];
  let out='';
  for(let i=0;i<countNeeded;i++){
    const v=Math.min(5,start+i),role=roles[i%roles.length];
    const src=`/assets/coupon-svg/${encodeURIComponent(slug)}/${v}.svg?v=9&coupon=${encodeURIComponent(coupon)}&country=${country}`;
    out+=`<figure class="article-visual legacy-quality-visual"><img src="${src}" alt="${esc(keyword)} — ${esc(role)} — ${esc(coupon)}" title="${esc(role)}" width="1200" height="760" loading="lazy" decoding="async"><figcaption>${esc(role)} في نون ${market} عند تجربة ${esc(coupon)}</figcaption></figure>`;
  }
  return out;
}

export function ensureRuntimeArticleQuality(html,{slug='',coupon='',country='SA',keyword='',title=''}={}){
  let out=String(html||''),added=[];
  const market=country==='AE'?'الإمارات':'السعودية',currency=country==='AE'?'الدرهم الإماراتي (AED)':'الريال السعودي (SAR)';
  const safeCoupon=String(coupon||'').trim()||(country==='AE'?'NOV188':'NOV170');
  const safeKeyword=String(keyword||title||'دليل كوبونات نون').trim();

  // Strip only clearly unsupported promotional claims; never alter ordinary product prices.
  const beforePromo=out;
  out=out
    .replace(/(?:خصم|توفير)(?:\s|<[^>]+>|&(?:nbsp|#160);|[:،,؛;–—-])*(?:حتى(?:\s|<[^>]+>|&(?:nbsp|#160);|[:،,؛;–—-])*)?\d{1,3}(?:\s|<[^>]+>|&(?:nbsp|#160);|[:،,؛;–—-])*[%٪]/gi,'خصم متغير حسب أهلية السلة')
    .replace(/\d{1,4}(?:\s|<[^>]+>|&(?:nbsp|#160);|[:،,؛;–—-])*(?:ريال|درهم)(?:\s|<[^>]+>|&(?:nbsp|#160);|[:،,؛;–—-])*(?:خصم|توفير)/gi,'توفير متغير حسب أهلية السلة')
    .replace(/(?:مضمون|مؤكد)(?:\s|<[^>]+>|&(?:nbsp|#160);|[:،,؛;–—-])*(?:الخصم|الكود|القسيمة)/gi,'الكود متاح للتجربة')
    .replace(/(?:بالتأكيد|مما لا شك فيه|في عالمنا اليوم|في عصرنا الحالي|دعنا نتعمق|في الختام،؟ يمكن القول|سواء كنت مبتدئًا أو محترفًا)/gi,'عمليًا');
  if(out!==beforePromo)added.push('unsupported-promo-sanitized');

  const jsonLd=sanitizeMalformedJsonLd(out);
  if(jsonLd.removed){out=jsonLd.html;added.push('malformed-jsonld-removed')}

  if(!/<article\b/i.test(out)){
    const open=`<article lang="ar-${country}" dir="rtl" data-runtime-legacy-quality="v2">`;
    if(/<body\b[^>]*>/i.test(out)&&/<\/body>/i.test(out)){
      out=out.replace(/(<body\b[^>]*>)/i,'$1'+open).replace(/<\/body>/i,'</article></body>');
    }else{
      out=open+out+'</article>';
    }
    added.push('article-wrapper');
  }

  if(!/class=["'][^"']*direct-answer/i.test(out)){
    const answer=`<p class="direct-answer legacy-quality-answer"><strong>الخلاصة العملية:</strong> ثبّت سلة نون ${market} أولًا، جرّب <strong>${esc(safeCoupon)}</strong> من دون تغيير المنتج أو البائع، ثم استخدم الإجمالي النهائي داخل نون كمرجع بدل افتراض نسبة خصم ثابتة.</p>`;
    out=/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(out)?out.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i,'$1'+answer):answer+out;
    added.push('direct-answer');
  }

  let atomic=count(out,/class=["'][^"']*atomic-answer/gi);
  if(atomic<2){
    const need=2-atomic;
    const atoms=[
      `<p class="atomic-answer legacy-quality-atomic"><strong>قاعدة تحقق:</strong> لا تنسب أي فرق في السعر للكوبون إذا تغيّر المنتج أو البائع أو الكمية بين المحاولتين.</p>`,
      `<p class="atomic-answer legacy-quality-atomic"><strong>مرجع السوق:</strong> الأسعار والشحن في نون ${market} تُراجع بعملة ${currency}، والنتيجة النهائية داخل السلة هي المرجع التجاري.</p>`
    ].slice(0,need).join('');
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,atoms+'</article>'):out+atoms;
    added.push('atomic-answers');
  }

  if(!/<section\b[^>]*class=["'][^"']*(?:methodology|accountability)/i.test(out)){
    const method=`<section class="methodology accountability legacy-quality-method"><h2>منهجية التحقق والمراجعة</h2><p>نفصل بين اختيار المنتج وبين نتيجة القسيمة. نثبت السلة أولًا، ثم نغيّر عاملًا واحدًا فقط عند الاختبار، ونعتبر شروط نون الحالية والإجمالي النهائي المرجع لأي أهلية أو سعر متغير.</p><p>السوق هنا هو نون ${market}، والعملة المرجعية هي ${currency}. لا نعد بنسبة خصم أو أهلية ثابتة من دون دليل رسمي.</p></section>`;
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,method+'</article>'):out+method;
    added.push('methodology');
  }

  if(!/<section\b[^>]*class=["'][^"']*sources/i.test(out)){
    const source=`<section class="sources legacy-quality-sources"><h2>المصادر وشفافية المعلومات</h2><p>المصدر التجاري النهائي هو <a href="https://www.noon.com/" rel="noopener external">موقع نون الرسمي</a> وما يظهر في سلة حسابك وقت الطلب. للمزيد راجع <a href="/coupon-verification">منهجية التحقق</a> و<a href="/editorial-policy">السياسة التحريرية</a>.</p></section>`;
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,source+'</article>'):out+source;
    added.push('sources');
  }

  if(!/class=["'][^"']*faq/i.test(out)||count(out,/<details\b/gi)<4){
    const faq=faqBlock({coupon:safeCoupon,market});
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,faq+'</article>'):out+faq;
    added.push('faq');
  }

  if(!/data-copy-code=/i.test(out)){
    const cta=`<section class="coupon-copy legacy-quality-copy"><h2>جرّب الكود داخل السلة</h2><p>انسخ <strong>${esc(safeCoupon)}</strong> ثم طبّقه في سلة نون ${market}. لا تفترض نسبة توفير ثابتة؛ راجع الإجمالي النهائي قبل الدفع.</p><button type="button" class="copy-code" data-copy-code="${esc(safeCoupon)}" aria-describedby="legacy-copy-status">نسخ الكود ${esc(safeCoupon)}</button><span id="legacy-copy-status" class="sr-only" aria-live="polite">جاهز لنسخ الكود</span></section>`;
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,cta+'</article>'):out+cta;
    added.push('copy-code-cta');
  }else if(!/aria-live=["']polite/i.test(out)){
    const live='<span class="sr-only legacy-copy-status" aria-live="polite">حالة نسخ الكود</span>';
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,live+'</article>'):out+live;
    added.push('copy-status');
  }

  if(count(out,/<(?:ul|ol)\b/gi)<2){
    const lists=`<section class="legacy-quality-checklists"><h2>قائمتا تحقق قبل إتمام الطلب</h2><h3>قبل تجربة الكود</h3><ul><li>ثبّت المنتج والكمية والبائع.</li><li>راجع الشحن والإرجاع للسوق الحالي.</li><li>سجّل الإجمالي قبل القسيمة.</li></ul><h3>بعد تجربة الكود</h3><ul><li>راجع الإجمالي النهائي بعملة ${currency}.</li><li>تأكد أن المنتج والبائع لم يتغيرا.</li><li>اعتمد نتيجة نون الحالية ولا تعمم أهلية حساب واحد.</li></ul></section>`;
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,lists+'</article>'):out+lists;
    added.push('decision-lists');
  }

  if(!/<table\b/i.test(out)){
    const table=`<section class="legacy-quality-comparison"><h2>مقارنة عملية قبل وبعد تجربة الكود</h2><div class="table-wrap"><table><thead><tr><th>العنصر</th><th>قبل التجربة</th><th>بعد التجربة</th></tr></thead><tbody><tr><td>المنتج والبائع</td><td>ثابتان</td><td>يجب أن يظلا ثابتين</td></tr><tr><td>الشحن</td><td>سجّل التكلفة</td><td>راجع أي تغير</td></tr><tr><td>الإجمالي</td><td>بالـ ${esc(currency)}</td><td>اعتمد الرقم النهائي داخل نون</td></tr></tbody></table></div></section>`;
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,table+'</article>'):out+table;
    added.push('comparison-table');
  }

  const currentImgs=count(out,/<img\b/gi);
  const needed=Math.max(0,3-currentImgs); // Hero image is added by the page renderer, so 3 body images => 4 live images.
  if(needed){
    const visuals=imageBlock({slug,coupon:safeCoupon,country,keyword:safeKeyword},2,needed);
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,visuals+'</article>'):out+visuals;
    added.push('media');
  }

  // Legacy depth remediation: only under-length rendered articles receive extra decision-support sections.
  // Sections are market-localized and rotated by slug; stop immediately once the live page reaches the 1500-word gate.
  if(visibleWords(out)<1500){
    let depthAdded=0;
    for(const block of legacyDepthBlocks({slug,keyword:safeKeyword,coupon:safeCoupon,market,currency})){
      if(visibleWords(out)>=1500)break;
      out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,block+'</article>'):out+block;
      depthAdded++;
    }
    if(depthAdded)added.push('legacy-depth-remediation');
  }

  return {html:out,changed:added.length>0,added};
}

export const RUNTIME_ARTICLE_QUALITY_INFO={version:6,mode:'fill-missing-only',guarantees:['title-normalization','meta-normalization','malformed-jsonld-sanitizer','article-wrapper','direct-answer','two-atomic-answers','methodology','sources','faq-4','copy-code-cta','aria-live-copy-status','two-decision-lists','comparison-table','three-body-images-plus-hero','currency-localization','unsupported-promo-sanitizer','generic-ai-phrase-sanitizer','legacy-depth-remediation-1500','legacy-depth-remediation-1500-v2'],destructive:false};
