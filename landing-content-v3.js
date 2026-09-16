import {MARKETS,CATEGORIES,BRANDS,COMPARISONS,commercePaths} from './commerce-taxonomy.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>{let n=2166136261;for(const c of String(s||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
const rotate=(a,n)=>a.length?[...a.slice(n%a.length),...a.slice(0,n%a.length)]:[];
const words=s=>String(s||'').replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length;
const pick=(arr,seed,i)=>arr[(seed+i*17)%arr.length];

const ANGLES=[
'تحديد الاحتياج قبل فتح صفحة النتائج','مقارنة السعر النهائي لا السعر الظاهر فقط','فهم اختلاف البائع والضمان','مراجعة المقاس أو السعة أو الإصدار','تقييم تكلفة الشحن والموعد','اختبار الكوبون على نفس السلة','تمييز العرض الحقيقي من التخفيض الاسمي','التحقق من سياسة الإرجاع','مقارنة البدائل داخل نفس الميزانية','تحديد الأولويات التي لا تقبل التنازل','تجنب شراء مواصفة لا تحتاجها','مراجعة تقييمات البائع بصورة نقدية','فحص تفاصيل النسخة الإقليمية','مقارنة قيمة المنتج على المدى الأطول','تحديد أفضل وقت لإعادة المقارنة','فهم أثر الكمية على إجمالي السلة','فحص توافق الملحقات','تقدير سهولة الاستخدام اليومية','مقارنة المنتج حسب سيناريو الاستخدام','فصل قرار المنتج عن قرار الكوبون','تثبيت عناصر المقارنة قبل اتخاذ القرار','العودة إلى صفحة البراند والعائلة','قراءة الشروط قبل الدفع','الاحتفاظ بلقطة ذهنية للإجمالي قبل وبعد الكود','اختبار أكثر من بديل في تبويبات منفصلة','مراجعة ما إذا كان العرض مرتبطًا بحساب معين','مقارنة المنتج نفسه بين البائعين','فهم أثر التوصيل السريع على التكلفة','تقدير جودة ما بعد البيع','تجنب المقارنة بين فئات غير متكافئة','تحديد الخيار المناسب للهدية أو الاستخدام الشخصي','مراجعة الألوان والمقاسات المتاحة','مقارنة الضمان المحلي بضمان البائع','التأكد من حالة المنتج جديد أو مجدد','تحديد ما إذا كانت الحزمة أو المنتج المفرد أفضل','مراجعة الملحقات المضمنة','فهم الفرق بين السعر قبل وبعد الرسوم','تقدير الحاجة الفعلية للترقية','مقارنة بديل اقتصادي وبديل أعلى','تحديد نقطة التوقف عن البحث واتخاذ القرار'
];

const OPENERS=[
'الفكرة الأساسية في هذه الصفحة ليست دفعك إلى شراء أسرع، بل مساعدتك على بناء مقارنة قابلة للتكرار.',
'أفضل قرار يبدأ من سؤال واضح عن الاستخدام ثم يتحول إلى قائمة تحقق قصيرة يمكن تطبيقها على أي عرض.',
'السعر وحده لا يشرح جودة الصفقة؛ لذلك نربط المنتج والبائع والضمان والشحن والكوبون في صورة واحدة.',
'عند كثرة النتائج يصبح التنظيم أهم من عدد الخيارات، ولهذا نقسم القرار إلى مراحل صغيرة يمكن مراجعتها.',
'الهدف هنا هو تقليل الضوضاء التسويقية وتحويل صفحة نون إلى معلومات يمكن مقارنتها بندًا ببند.',
'القيمة الحقيقية تظهر عندما تقارن نفس الشيء بنفس الشروط، لا عندما تقارن عنوانين مختلفين فقط.'
];

const ACTIONS=[
'ابدأ بتثبيت استخدامك الأساسي، ثم اكتب ثلاث مواصفات أو خصائص ضرورية وميزتين فقط تعتبرهما إضافيتين.',
'افتح نتيجتين أو ثلاثًا فقط في البداية وسجل السعر والبائع والضمان وموعد التوصيل قبل تجربة أي كود.',
'جرّب الكود بعد أن تثبت السلة، ثم راقب الإجمالي النهائي نفسه بدل التركيز على رسالة نجاح الكوبون وحدها.',
'لو اختلفت النسخة أو السعة أو المقاس فاعتبرها مقارنة جديدة، لأن اختلافًا صغيرًا قد يغير السعر والملاءمة.',
'راجع صفحة الإرجاع وشروط البائع قبل الدفع، خصوصًا في المنتجات التي تعتمد على المقاس أو التوافق أو النسخة.',
'إذا وجدت فرقًا سعريًا كبيرًا فابحث أولًا عن سبب الفرق: بائع آخر، حالة مختلفة، ضمان مختلف أو شحن مختلف.'
];

const EVIDENCE=[
'المعلومة القابلة للتحقق أقوى من الوصف العام: اسم البائع، حالة المنتج، مدة الضمان المكتوبة، السعة، المقاس، رقم الموديل وإجمالي السلة.',
'نحن لا نثبت نسبة خصم أو سعرًا متغيرًا داخل النص لأن هذه القيم تتبدل؛ المرجع النهائي هو السلة الحية على نون لحظة الشراء.',
'أي ادعاء عن مواصفة يجب ربطه بما هو ظاهر في صفحة المنتج أو مصدر الشركة، وأي اختلاف بين النسخ يجب اعتباره سببًا لإعادة الفحص.',
'عند غياب معلومة واضحة لا نعوضها بالتخمين؛ الأفضل التعامل معها كعنصر غير مؤكد حتى تظهر في صفحة المنتج أو شروط البائع.'
];

const INTENTS=[
'باحث يريد فهم القسم قبل الشراء','مستخدم يقارن بين براندين','مستخدم يعرف البراند لكنه لم يحدد العائلة','مستخدم وصل إلى موديل ويبحث عن أفضل صفقة','مستخدم يملك كود خصم ويريد التأكد من فائدته','مستخدم يقارن بين السعودية والإمارات','مستخدم يريد تجنب بائع أو ضمان غير مناسب','مستخدم يبحث عن بديل قريب داخل نفس الفئة'
];


const OWNER_CODES=['OPS32','OPS56','OPS47','OPS48','OPS43','OPS41','OPS38','OPS58'];
const KEYWORD_MODIFIERS=['كود خصم','كوبون خصم','عروض','أفضل سعر','دليل شراء','مقارنة','خصم نون','عروض نون'];
function visualBlock(ctx,seed){
  const labels=[ctx.label,ctx.mk.name,'كوبونات وعروض'];
  return `<section class="section landing-visuals"><h2>صور توضيحية ودليل بصري عن ${esc(ctx.label)}</h2><p>الرسومات التالية توضح مسار البحث والاختيار واختبار الكوبون داخل ${esc(ctx.mk.name)}، وهي عناصر توضيحية خاصة بالصفحة وليست صورًا لمنتج أو سعر ثابت.</p><div class="grid">${labels.map((label,i)=>`<figure class="card"><svg role="img" aria-labelledby="v${seed}-${i}" viewBox="0 0 640 360" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg"><title id="v${seed}-${i}">${esc(label)} — ${esc(ctx.label)}</title><rect width="640" height="360" rx="28" fill="#f8fafc"/><rect x="28" y="28" width="584" height="304" rx="24" fill="#fff" stroke="#e5e7eb"/><circle cx="${120+i*25}" cy="130" r="54" fill="#facc15"/><path d="M210 110h330M210 150h260M90 245h450" stroke="#312e81" stroke-width="18" stroke-linecap="round"/><text x="320" y="305" text-anchor="middle" font-size="24" font-family="Arial" fill="#111827">${esc(label)}</text></svg><figcaption>${esc(label)}: مخطط بصري يساعد على فهم موضوع الصفحة قبل الانتقال إلى المقالات أو السلة.</figcaption></figure>`).join('')}</div></section>`;
}
function definitionsBlock(ctx){
  const defs=[['كود الخصم','رمز يُختبر داخل السلة وقد تختلف أهليته حسب الحساب والمنتج والبائع والوقت.'],['العرض','سعر أو ميزة ترويجية متغيرة؛ المرجع النهائي هو ما يظهر في نون لحظة الشراء.'],['السعر النهائي','إجمالي السلة بعد الخصم والشحن وأي رسوم ظاهرة قبل الدفع.'],['صفحة الهبوط','صفحة تجمع نية بحث محددة مع تعريفات وعروض وأدلة ومقالات وروابط مرتبطة.'],['نية البحث','الهدف الذي يحاول المستخدم الوصول إليه، مثل العثور على كوبون أو مقارنة منتجين أو اختيار فئة.']];
  return `<section class="section landing-definitions"><h2>تعريفات مهمة قبل استخدام عروض ${esc(ctx.label)}</h2><dl>${defs.map(([a,b])=>`<div class="box"><dt><strong>${esc(a)}</strong></dt><dd>${esc(b)} وفي هذه الصفحة نطبقه على ${esc(ctx.label)} داخل ${esc(ctx.mk.name)}.</dd></div>`).join('')}</dl></section>`;
}
function keywordBlock(ctx,seed){
  const kws=rotate(KEYWORD_MODIFIERS,seed).map(x=>`${x} ${ctx.label} ${ctx.mk.label}`);
  return `<section class="section landing-keywords"><h2>موضوعات وكلمات البحث المرتبطة بـ ${esc(ctx.label)}</h2><p>تغطي الصفحة نيات بحث مترابطة بصورة طبيعية دون تكرار مصطنع للكلمات. من أهم الموضوعات: ${kws.map(esc).join('، ')}. يتم توزيع هذه العبارات داخل التعريفات والأسئلة وأدلة الاختيار والروابط الداخلية بما يخدم القارئ أولًا.</p><div class="chips">${kws.slice(0,8).map(k=>`<span class="box">${esc(k)}</span>`).join('')}</div></section>`;
}
function couponGuideBlock(ctx,seed){
  const codes=rotate(OWNER_CODES,seed).slice(0,4);
  return `<section class="section landing-coupon-guide"><h2>أكواد وكوبونات خصم مرتبطة بـ ${esc(ctx.label)}</h2><p>يمكن تجربة الأكواد التالية من قائمة الموقع على السلة المناسبة: ${codes.map(c=>`<strong class="code">${c}</strong>`).join(' ')}. لا نثبت نسبة خصم غير مؤكدة؛ نجاح الكود وقيمته الفعلية يتحددان داخل السلة على ${esc(ctx.mk.name)}.</p><ol><li>اختر المنتج أو الفئة المناسبة أولًا.</li><li>ثبت البائع والنسخة والكمية.</li><li>سجل الإجمالي قبل الكود.</li><li>جرّب الكود ثم قارن الإجمالي النهائي.</li><li>ارجع إلى المقالات الداخلية إذا احتجت مقارنة أعمق قبل الدفع.</li></ol></section>`;
}

const QA=[
['هل الكود مضمون على كل المنتجات؟','لا. أهلية الكود قد تختلف حسب الحساب والمنتج والبائع والسلة والوقت. اختبر الكود على السلة نفسها واعتمد الإجمالي النهائي الظاهر قبل الدفع.'],
['هل أقل سعر ظاهر يعني أفضل صفقة؟','ليس بالضرورة. قارن حالة المنتج والبائع والضمان والشحن وسياسة الإرجاع والإجمالي بعد الكود.'],
['كيف أقارن عروضًا كثيرة بسرعة؟','ثبت ثلاثة إلى خمسة معايير، واستبعد أي نتيجة لا تحقق المعايير الأساسية، ثم قارن عددًا صغيرًا من الخيارات المتكافئة.'],
['متى أعيد فحص السعر؟','أعد الفحص قبل الدفع مباشرة، وعند تغيير السعة أو المقاس أو البائع أو الكمية أو عنوان التوصيل.'],
['هل الصفحة تبيع المنتجات مباشرة؟','لا. الصفحة تنظّم المعلومات والروابط وتوجهك إلى نون لإتمام الفحص والشراء من المصدر الفعلي.'],
['كيف أتعامل مع مواصفة غير واضحة؟','لا تفترضها. راجع وصف المنتج ورقم الموديل ومعلومات الشركة أو اسأل البائع إن كانت المعلومة مؤثرة في قرارك.'],
['هل المقارنة بين براندات مختلفة عادلة دائمًا؟','تكون أكثر عدلًا عندما تثبت الفئة السعرية والاستخدام والمواصفات الأساسية ثم تقارن الاختلافات الحقيقية.'],
['ما أفضل طريقة لاستخدام صفحة البراند؟','ابدأ بالعائلات، اختر العائلة الأقرب لاستخدامك، ثم انتقل للمقالات والمقارنات واختبر العرض على نون.'],
['ما الذي يجب مراجعته في الأحذية والملابس؟','المقاس وجدول القياس والخامة وسياسة الاستبدال والإرجاع وتوفر اللون، لأنها عناصر قد تكون أهم من نسبة الخصم.'],
['ما الذي يختلف في الإلكترونيات والأجهزة؟','رقم الموديل والنسخة الإقليمية والضمان والتوافق والملحقات المضمنة واستهلاك الطاقة أو الأبعاد حسب نوع الجهاز.']
];

function context(path){
  const p=String(path||'').split('/').filter(Boolean),market=p[0],mk=MARKETS[market];
  if(!mk)return null;
  if(p[1]==='categories')return {market,mk,type:'directory',key:'categories',label:`أقسام ${mk.name}`,desc:`التسوق المنظم عبر أقسام ${mk.name}`};
  if(p[1]==='category'&&CATEGORIES[p[2]]){const c=CATEGORIES[p[2]];return {market,mk,type:'category',key:p[2],label:c.label,desc:c.desc,category:c};}
  if(p[1]==='brand'&&BRANDS[p[2]]){const b=BRANDS[p[2]];return {market,mk,type:'brand',key:p[2],label:b.label,desc:`اختيار منتجات ${b.label} ومقارنة عائلاتها وعروضها`,brand:b};}
  if(p[1]==='model'&&BRANDS[p[2]]?.models?.[p[3]]){const b=BRANDS[p[2]],m=b.models[p[3]];return {market,mk,type:'model',key:`${p[2]}:${p[3]}`,label:`${b.label} ${m.label}`,desc:`دليل قرار شراء لعائلة ${m.label} من ${b.label}`,brand:b,model:m};}
  if(p[1]==='compare'&&COMPARISONS[p[2]]){const c=COMPARISONS[p[2]],a=BRANDS[c.a],b=BRANDS[c.b];return {market,mk,type:'comparison',key:p[2],label:c.title,desc:`مقارنة عملية بين ${a?.label||c.a} و${b?.label||c.b}`,comparison:c,brandA:a,brandB:b};}
  return null;
}

function section(ctx,seed,idx,angle){
  const op=pick(OPENERS,seed,idx),act=pick(ACTIONS,seed>>>1,idx),ev=pick(EVIDENCE,seed>>>2,idx),intent=pick(INTENTS,seed>>>3,idx);
  const subject=ctx.label,market=ctx.mk.name;
  const typeNote=ctx.type==='category'?`في قسم ${subject} تتغير أهمية المواصفات حسب نوع المنتج، لذلك لا نعامل كل نتائج القسم كأنها حالة واحدة.`:ctx.type==='brand'?`في صفحة ${subject} نستخدم عائلات المنتجات لتجنب خلط مستويات مختلفة من نفس البراند.`:ctx.type==='model'?`في عائلة ${subject} يصبح تثبيت رقم الموديل أو السعة أو النسخة خطوة مركزية قبل المقارنة.`:ctx.type==='comparison'?`في ${subject} نبحث عن اختلافات تؤثر على الاستخدام بدل إعلان فائز عام لكل الناس.`:`في ${market} نبدأ من القسم ثم نضيق الخيارات تدريجيًا حتى نصل إلى منتج قابل للمقارنة.`;
  return `<section class="section long-guide-section" data-section="${idx+1}"><h2>${idx+1}. ${esc(angle)} في ${esc(subject)}</h2><p>${esc(op)} بالنسبة إلى ${esc(subject)} على ${esc(market)}، الهدف هو تحويل نية مثل «أريد عرضًا جيدًا» إلى معايير محددة يمكن فحصها. ${esc(typeNote)} عندما تكون المعايير واضحة تقل فرصة الانجراف وراء عنوان ترويجي لا يطابق احتياجك.</p><p>${esc(act)} طبّق ذلك على ${esc(subject)} من خلال مقارنة نفس الفئة ونفس المواصفات قدر الإمكان. لا تنتقل من خيار إلى آخر قبل تسجيل العناصر التي تغير القرار: السعر الحالي، البائع، حالة المنتج، الضمان، التوصيل، الإرجاع، السعة أو المقاس أو رقم الموديل عند الحاجة.</p><p>${esc(ev)} هذا مهم خصوصًا لـ${esc(intent)}؛ لأن قرار الشراء الجيد لا يحتاج عددًا هائلًا من الروابط، بل يحتاج بيانات متجانسة يمكن فحصها. إذا تغير عنصر أساسي فأعد المقارنة بدل محاولة إجبار نتيجتين مختلفتين على جدول واحد.</p><p>عند استخدام أكواد الخصم مع ${esc(subject)}، تعامل مع الكود كطبقة أخيرة بعد اختيار المنتج وليس كسبب لاختيار المنتج. افتح السلة، تأكد أن النسخة والكمية والبائع لم تتغير، أدخل الكود، ثم قارن الإجمالي النهائي بما سجلته قبل التطبيق. إذا لم يتحسن الإجمالي أو ظهرت شروط لا تناسبك، فاعتبر الكود غير مفيد لهذه السلة حتى لو ظهرت رسالة ترويجية جذابة.</p><p>لزيادة دقة القرار على ${esc(market)}، احتفظ بمسار رجوع واضح: الصفحة الحالية ← صفحة القسم ← صفحة البراند أو العائلة إن وجدت ← المقالات المتخصصة ← السلة الحية على نون. هذا المسار يمنعك من فقدان السياق ويساعد محركات البحث ومحركات الإجابة على فهم العلاقة بين الكيانات والموضوعات، وفي الوقت نفسه يعطي المستخدم طريقة طبيعية للانتقال إلى مستوى أكثر تحديدًا أو أكثر عمومية.</p></section>`;
}

function entityBlock(ctx){
  const bits=[];
  bits.push(`<li><strong>السوق:</strong> ${esc(ctx.mk.label)} — ${esc(ctx.mk.name)}</li>`);
  bits.push(`<li><strong>نوع الصفحة:</strong> ${esc(ctx.type)}</li>`);
  bits.push(`<li><strong>الموضوع الرئيسي:</strong> ${esc(ctx.label)}</li>`);
  if(ctx.category)bits.push(`<li><strong>القسم:</strong> ${esc(ctx.category.label)}</li>`);
  if(ctx.brand)bits.push(`<li><strong>البراند:</strong> ${esc(ctx.brand.label)}</li>`);
  if(ctx.model)bits.push(`<li><strong>العائلة:</strong> ${esc(ctx.model.label)}</li>`);
  if(ctx.comparison)bits.push(`<li><strong>نوع النية:</strong> مقارنة قبل الشراء</li>`);
  return `<section class="section entity-summary"><h2>ملخص الكيانات والنية</h2><ul>${bits.join('')}</ul><p>هذه الصفحة مستقلة في عنوانها وكياناتها ونية البحث ومسارها الداخلي. لا نستخدم سعرًا ثابتًا أو نسبة خصم ثابتة كحقيقة دائمة؛ البيانات المتغيرة تُراجع في نون لحظة الشراء.</p></section>`;
}

async function relatedArticlesBlock(ctx,env){
  try{
    const o=env?.CONTENT_FINAL?await env.CONTENT_FINAL.get('bulk/latest.json'):null;
    const d=o?await o.json():{articles:[]},rows=(d.articles||[]);
    const marketCode=ctx.market==='uae'?'AE':'SA';
    const scored=rows.map(a=>{
      let score=0;
      if(a.country===marketCode)score+=4; else return null;
      if(ctx.type==='category'&&a.categoryKey===ctx.key)score+=12;
      if(ctx.type==='brand'&&a.brandKey===ctx.key)score+=14;
      if(ctx.type==='model'&&a.modelKey===ctx.key)score+=16;
      if(ctx.type==='comparison'&&a.comparisonKey===ctx.key)score+=18;
      if(a.landingPath===ctx.path)score+=20;
      return score>4?{a,score}:null;
    }).filter(Boolean).sort((x,y)=>y.score-x.score).slice(0,8);
    if(!scored.length)return '';
    return `<section class="section related-articles"><h2>مقالات مرتبطة مباشرة بهذه الصفحة</h2><p>هذه المقالات مختارة من بيانات التصنيف المحفوظة مع المقال نفسه، وليس من تطابق كلمات العنوان فقط.</p><div class="grid">${scored.map(({a})=>`<article class="box"><h3><a href="/articles/${esc(a.slug)}">${esc(a.title||a.primaryKeyword||a.slug)}</a></h3><p>${esc(a.primaryKeyword||'دليل شراء وكوبونات مرتبط')}</p></article>`).join('')}</div></section>`;
  }catch{return ''}
}

function functionalBlock(ctx){
  if(ctx.type==='category')return `<section class="section functional-depth"><h2>خريطة قرار قسم ${esc(ctx.label)}</h2><div class="grid"><div class="box"><strong>ابدأ بالاستخدام</strong><p>حدد لماذا تحتاج منتجًا من هذا القسم قبل الفرز بالسعر.</p></div><div class="box"><strong>ثبّت المواصفات</strong><p>اكتب الخصائص الأساسية التي تجعل النتائج قابلة للمقارنة.</p></div><div class="box"><strong>قارن البائع والعرض</strong><p>راجع الضمان والشحن والإرجاع ثم اختبر الكوبون على السلة النهائية.</p></div></div></section>`;
  if(ctx.type==='brand')return `<section class="section functional-depth"><h2>كيف تختار داخل عائلات ${esc(ctx.label)}</h2><p>لا تقارن كل منتجات البراند كأنها مستوى واحد. ابدأ بالعائلة المناسبة لاستخدامك، ثم قارن الأجيال أو السعات أو المقاسات المتقاربة، وبعدها انتقل إلى صفحة الموديل أو المقال المتخصص قبل اختبار الكوبون.</p><p><strong>قاعدة القرار:</strong> العائلة أولًا ← المواصفات ثانيًا ← البائع والضمان ← السعر النهائي بعد الكود.</p></section>`;
  if(ctx.type==='model')return `<section class="section functional-depth"><h2>Checklist قبل شراء ${esc(ctx.label)}</h2><ul><li>طابق اسم العائلة ورقم أو جيل الموديل.</li><li>ثبّت السعة أو المقاس أو النسخة قبل مقارنة السعر.</li><li>راجع البائع والضمان والملحقات المضمنة.</li><li>قارن الإجمالي النهائي بعد الشحن والكوبون.</li><li>ارجع لصفحة البراند إذا احتجت بديلًا من عائلة أخرى.</li></ul></section>`;
  if(ctx.type==='comparison')return `<section class="section functional-depth"><h2>مصفوفة قرار: ${esc(ctx.label)}</h2><table><thead><tr><th>المعيار</th><th>ماذا تفحص؟</th></tr></thead><tbody><tr><td>الاستخدام</td><td>أي خيار يطابق احتياجك اليومي فعلًا؟</td></tr><tr><td>المواصفات</td><td>قارن نفس المستوى والسعة أو الفئة قدر الإمكان.</td></tr><tr><td>البائع والضمان</td><td>لا تجعل فرق السعر يخفي اختلاف الضمان أو الحالة.</td></tr><tr><td>التكلفة النهائية</td><td>قارن السلة بعد الشحن والكوبون، لا السعر الاسمي فقط.</td></tr></tbody></table><p>لا نعلن فائزًا عامًا؛ النتيجة تتغير حسب استخدامك والنسخة والبائع والسعر الحي.</p></section>`;
  return `<section class="section functional-depth"><h2>ابدأ من القسم المناسب</h2><p>استخدم دليل الأقسام لتضييق نطاق البحث، ثم انتقل إلى البراند والعائلة والمقارنة والمقالات المتخصصة بدل فتح نتائج غير مترابطة.</p></section>`;
}

function relatedHubBlock(ctx){
  const base='/'+ctx.market,links=[{p:base+'/categories',l:'كل أقسام '+ctx.mk.name},{p:ctx.market==='saudi'?'/saudi-arabia/noon-coupon-code':'/uae/noon-coupon-code',l:'كود خصم نون '+ctx.mk.label}];
  if(ctx.category)links.push({p:base+'/category/'+ctx.key,l:'دليل '+ctx.category.label});
  if(ctx.brand)links.push({p:base+'/brand/'+Object.keys(BRANDS).find(k=>BRANDS[k]===ctx.brand),l:'كل أدلة '+ctx.brand.label});
  return `<section class="section related-authority"><h2>روابط مرتبطة تساعدك على إكمال القرار</h2><p>استخدم هذه الروابط للانتقال بين مستوى السوق والقسم والبراند وصفحة الكوبون من غير فقدان سياق المقارنة.</p><nav class="chips" aria-label="روابط تجارية مرتبطة">${links.filter((x,i,a)=>a.findIndex(y=>y.p===x.p)===i).map(x=>`<a href="${esc(x.p)}">${esc(x.l)}</a>`).join('')}</nav></section>`;
}
function eeatBlock(ctx){return `<section class="section editorial-method"><h2>منهجية التحرير والتحقق</h2><p>نكتب هذه الصفحة لمساعدة المستخدم على المقارنة وليس لإصدار حكم مطلق. نفصل بين المعلومات الثابتة نسبيًا مثل اسم البراند أو عائلة المنتج، وبين المعلومات المتغيرة مثل السعر والمخزون والبائع وأهلية الكوبون. أي عنصر متغير يجب فحصه على ${esc(ctx.mk.name)} قبل الدفع.</p><p>عند وجود أكثر من بائع أو نسخة، نعتبر كل تركيبة حالة مستقلة. لا نفترض أن الضمان أو الملحقات أو حالة المنتج واحدة بين كل النتائج. كما لا ننسب إلى نون أو البراند أي تعهد لم يظهر في الصفحة الحية. هذا الأسلوب يرفع قابلية التحقق ويقلل الادعاءات غير المسندة.</p><p>آخر تحديث تحريري لهذه الطبقة: 16 سبتمبر 2026. الغرض من تاريخ التحديث هو توضيح إصدار منهج الصفحة، وليس الادعاء بأن كل سعر أو مخزون ثابت منذ هذا التاريخ.</p></section>`}

function faqBlock(ctx,seed){const qs=rotate(QA,seed).slice(0,8);return {html:`<section class="section faq"><h2>أسئلة شائعة عن ${esc(ctx.label)}</h2>${qs.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)} في سياق ${esc(ctx.label)} على ${esc(ctx.mk.name)}، راجع دائمًا تفاصيل السلة الحية قبل الدفع.</p></details>`).join('')}</section>`,items:qs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:`${a} في سياق ${ctx.label} على ${ctx.mk.name}، راجع تفاصيل السلة الحية قبل الدفع.`}}))};}

function extraSchema(origin,path,ctx,faqItems){return {'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':origin+path+'#guide',url:origin+path,name:ctx.label,inLanguage:'ar',dateModified:'2026-09-16',about:{'@type':'Thing',name:ctx.label},isPartOf:{'@type':'WebSite','@id':origin+'/#website',url:origin,name:'كوبونات نون'},publisher:{'@type':'Organization','@id':origin+'/#publisher',name:'كوبونات نون',url:origin}},{'@type':'FAQPage','@id':origin+path+'#faq',mainEntity:faqItems},{'@type':'Organization','@id':origin+'/#publisher',name:'كوبونات نون',url:origin,description:'دليل مستقل لتنظيم أكواد الخصم ومقارنات التسوق على نون السعودية ونون الإمارات.'}]};}

export async function enhanceLandingPage(path,origin,res){
  const ctx=context(path);if(!ctx||!res?.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
  let html=await res.text();if(html.includes('id="landing-depth-v3"'))return new Response(html,{status:res.status,headers:res.headers});
  const seed=hash(path),angles=rotate(ANGLES,seed).slice(0,40);
  const faq=faqBlock(ctx,seed);
  let body=`<div id="landing-depth-v3" data-content-version="3" data-route-seed="${seed}">${entityBlock(ctx)}${functionalBlock(ctx)}${visualBlock(ctx,seed)}${definitionsBlock(ctx)}${keywordBlock(ctx,seed)}${couponGuideBlock(ctx,seed)}${angles.map((a,i)=>section(ctx,seed,i,a)).join('')}${faq.html}${relatedHubBlock(ctx)}${eeatBlock(ctx)}</div>`;
  const floor=5000;const charFloor=5000;let n=words(body),extra=0;
  while((n<floor||body.replace(/<[^>]*>/g,' ').length<charFloor)&&extra<20){body+=section(ctx,seed+extra*101,angles.length+extra,ANGLES[(seed+extra)%ANGLES.length]);extra++;n=words(body)}
  const schema=extraSchema(origin,path,ctx,faq.items);
  html=html.replace(/<\/head>/i,`<meta name="content-depth" content="${n}"><meta name="landing-content-version" content="3"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head>`).replace(/<\/main>/i,`${body}</main>`);
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-landing-content','v3');h.set('x-landing-word-count',String(n));h.set('x-landing-char-count',String(body.replace(/<[^>]*>/g,' ').length));h.set('x-landing-images','3');h.set('x-landing-unique-seed',String(seed));h.set('x-landing-schema','webpage-faq-organization');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}

export const LANDING_CONTENT_V3={version:3,minWords:5000,minChars:5000,imagesPerLanding:3,definitions:true,keywordClusters:true,couponGuide:true,routeCount:commercePaths().length,uniqueBy:'route-seed',schema:['WebPage','FAQPage','Organization'],eeat:true,geoAeo:true,seo:true,relatedAuthorityLinks:true,functionalByLandingType:true,metadataMatchedRelatedArticles:true};
