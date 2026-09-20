const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=(s,re)=>(String(s||'').match(re)||[]).length;

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
    .replace(/(?:خصم|توفير)\s*(?:حتى\s*)?\d{1,3}\s*[%٪]/gi,'خصم متغير حسب أهلية السلة')
    .replace(/(?:مضمون|مؤكد)\s*(?:الخصم|الكود|القسيمة)/gi,'الكود متاح للتجربة');
  if(out!==beforePromo)added.push('unsupported-promo-sanitized');

  if(!/<article\b/i.test(out)&&!/<html\b/i.test(out)){
    out=`<article lang="ar-${country}" dir="rtl" data-runtime-legacy-quality="v1">${out}</article>`;
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

  if(!/(?:methodology|accountability|منهجية التحقق|طريقة التحقق)/i.test(out)){
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

  const currentImgs=count(out,/<img\b/gi);
  const needed=Math.max(0,3-currentImgs); // Hero image is added by the page renderer, so 3 body images => 4 live images.
  if(needed){
    const visuals=imageBlock({slug,coupon:safeCoupon,country,keyword:safeKeyword},2,needed);
    out=/<\/article>/i.test(out)?out.replace(/<\/article>/i,visuals+'</article>'):out+visuals;
    added.push('media');
  }

  return {html:out,changed:added.length>0,added};
}

export const RUNTIME_ARTICLE_QUALITY_INFO={version:1,mode:'fill-missing-only',guarantees:['article-wrapper','direct-answer','two-atomic-answers','methodology','sources','faq-4','three-body-images-plus-hero','currency-localization','unsupported-promo-sanitizer'],destructive:false};
