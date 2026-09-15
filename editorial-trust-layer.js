const LINKS=[
  ['/editorial-policy','السياسة التحريرية'],
  ['/coupon-verification','منهجية التحقق من الأكواد'],
  ['/authors/editorial-team','فريق التحرير'],
  ['/disclaimer','إخلاء المسؤولية والاستقلالية']
];

export function injectEditorialTrust(article){
  if(!article?.html)return article;
  const links=LINKS.map(([href,label])=>`<a href="${href}">${label}</a>`).join(' · ');
  const section=`<section class="editorial-accountability"><h2>المسؤولية التحريرية وشفافية المعلومة</h2><p>يُنشر هذا الدليل باسم فريق تحرير كوبونات نون وفق سياسة تفصل بين الكود المتاح للتجربة وبين أي ادعاء تجاري يحتاج مصدرًا موثقًا. لا نختلق اسم خبير أو تجربة شخصية، ولا نعد بنسبة خصم أو أهلية ثابتة عندما لا تتوفر شروط رسمية كافية.</p><p>راجع ${links}. وإذا تعارضت أي معلومة مع شروط Noon الحالية أو نتيجة السلة، فشروط المتجر ونتيجة الدفع هما المرجع النهائي.</p></section>`;
  article.html=String(article.html).replace(/<section class="methodology accountability">/i,section+'<section class="methodology accountability">');
  article.editorialTrust={publisher:'كوبونات نون',editorialTeam:'/authors/editorial-team',editorialPolicy:'/editorial-policy',verificationPolicy:'/coupon-verification',independentSite:true};
  return article;
}

export const EDITORIAL_TRUST_INFO={version:1,links:LINKS.map(x=>x[0]),noInventedPersonAuthors:true,independentSite:true};
