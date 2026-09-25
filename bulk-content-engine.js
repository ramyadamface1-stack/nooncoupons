export * from './bulk-content-engine-base.js';

import {
  buildBulkTopic as buildBulkTopicBase,
  buildUsefulArticle as buildUsefulArticleBase,
  buildEnglishNativeCandidate as buildEnglishNativeCandidateBase,
  buildEnglishUsefulArticle as buildEnglishUsefulArticleBase
} from './bulk-content-engine-base.js';

const englishSlugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plainWords=html=>String(html||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().split(/\s+/).filter(Boolean).length;
const arabicSlugify=s=>String(s||'').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-').slice(0,120);

const ARABIC_QUERY_MODIFIERS=[
  'فحص الشحن','مراجعة البائع','سياسة الإرجاع','مراجعة الضمان','تثبيت السلة','السعر الكامل','قرار الشراء','مراجعة الدفع',
  'فحص المواصفات','مقارنة البدائل','قيمة الشراء','الكمية المناسبة','ملاءمة الاستخدام','تكلفة التوصيل','أهلية المنتج','تجربة الكود',
  'وقت الشراء','البديل الأنسب','مراجعة الحساب','شروط الطلب','اختيار المنتج','مقارنة السلة','تفاصيل البائع','خطة الشراء',
  'مراجعة الكمية','فحص الملاءمة','تكلفة ما بعد الشراء','قرار الاستبدال','مراجعة التوصيل','ترتيب الأولويات','تقييم المخاطرة','حسم الاختيار',
  'سقف الميزانية','مراجعة السعر','خطوة الدفع','خيار احتياطي','فحص الوصف','مراجعة العنوان','مقارنة التكلفة','اختبار الأهلية',
  'تقييم القيمة','مراجعة الاستلام','اختيار المقاس','فحص التوافق','مراجعة الملحقات','تقييم الاستخدام','مقارنة الشروط','تدقيق السلة',
  'مقارنة موعد التسليم','تحقق من الإصدار','مطابقة الحاجة','مراجعة فرق البائع','حساب سعر الوحدة','تأكيد بلد الشحن','مراجعة رسوم إضافية','فحص حالة المنتج',
  'مراجعة النسخة','مقارنة الضمان','مراجعة اللون والمقاس','حساب الإجمالي','تقييم ما بعد البيع','تدقيق طريقة الدفع','تثبيت البائع','فحص الكمية',
  'مراجعة وقت التوصيل','مقارنة رسوم الشحن','فحص خيارات الإرجاع','تأكيد الاستخدام','تقييم فرق السعر','مراجعة شروط الكود','اختبار عنصر واحد','مطابقة السوق',
  'فحص أهلية الحساب','مراجعة مكونات السلة','مقارنة المنتج البديل','تأكيد وصف المنتج','مراجعة تكلفة الوحدة','فحص التوافق الإقليمي','مراجعة ملاءمة المساحة','مقارنة خيارات الدفع',
  'اختبار سلة صغيرة','تدقيق السعر النهائي','مراجعة فرق الإصدار','مقارنة حالة المنتج','فحص قياسات المنتج','تقييم تكلفة الخطأ','مراجعة قرار الكمية','تأكيد بيانات البائع',
  'مقارنة وقت الشراء','مراجعة القيمة النهائية','تثبيت عنوان الشحن','فحص اختلاف المنتج','مراجعة سياسة الاستبدال','مقارنة تكلفة الطلب','تقييم شروط التسليم','تأكيد المتطلبات الأساسية'
];

const DIVERSITY_FRAMES=[
  {title:'اختبار المتغير الواحد',lead:t=>`ثبّت سلة ${t.category} أولًا، ثم تعامل مع ${t.factor} كمتغير واحد يمكن قياس أثره بدل تغيير أكثر من شيء في المحاولة نفسها.`,steps:t=>[`دوّن حالة ${t.factor} قبل تطبيق الكود`,`جرّب ${t.code} من دون تغيير البائع أو الكمية`,`إذا تغير الإجمالي فسجّل الفرق ثم أعد الاختبار`,`إذا لم يتغير شيء انتقل لمتغير واحد جديد فقط`],close:t=>`بهذا الأسلوب تعرف هل القرار متعلق بالسلة أم بملاءمة المنتج لـ${t.useCase}.`},
  {title:'خريطة مخاطر الطلب',lead:t=>`قبل الحسم رتّب مخاطر شراء ${t.category} إلى مخاطر منتج، بائع، شحن وإرجاع؛ ثم عالج الأعلى أثرًا قبل التفكير في القسيمة.`,steps:t=>[`راجع ${t.checks?.[0]||t.factor} باعتباره شرطًا أساسيًا`,`حدّد ما الذي قد يجعل الإرجاع صعبًا`,`قارن موعد ورسوم التوصيل بين البدائل`,`لا تجعل قبول ${t.code} يعوض مخاطرة واضحة`],close:t=>`الاختيار الجيد يقلل تكلفة الخطأ المحتملة، وليس السعر الظاهر فقط.`},
  {title:'دفتر الميزانية الكامل',lead:t=>`اكتب سقفًا واضحًا لشراء ${t.category} يشمل السعر والشحن وأي فرق بين البائعين، ثم قارن الإجمالي النهائي داخل هذا السقف.`,steps:t=>[`ابدأ بالسعر الأساسي لا بالسعر المتخيل بعد الخصم`,`أضف تكلفة التوصيل الظاهرة`,`اختبر ${t.code} على السلة نفسها`,`اترك هامشًا لتغير السعر قبل الدفع`],close:t=>`إذا بقي الخيار مناسبًا لـ${t.useCase} داخل السقف بعد المراجعة، يصبح القرار أكثر ثباتًا.`},
  {title:'بطاقة ملاءمة الاستخدام',lead:t=>`قيّم ${t.category} من زاوية الاستخدام الفعلي «${t.useCase}» بدل مطاردة مواصفات لا تحتاجها أو عرض لا يخدم الهدف الأساسي.`,steps:t=>[`اكتب ثلاثة احتياجات لا يمكن التنازل عنها`,`ضع ${t.factor} ضمن الأولويات المناسبة`,`استبعد أي خيار يفشل شرطًا أساسيًا`,`بعدها فقط قارن السلة والكود والبائع`],close:t=>`هذه البطاقة تمنع الشراء الزائد وتحافظ على ارتباط السعر بالفائدة الفعلية.`},
  {title:'مقارنة بديلين فقط',lead:t=>`اختر بديلين من ${t.category} متقاربين في الغرض، وقارن بينهما على نفس المعايير بدل فتح قائمة كبيرة يصعب حسمها.`,steps:t=>[`قارن ${t.factors?.[0]||t.factor} في البديلين`,`قارن ${t.factor} كعامل ترجيح`,`ثبّت الكمية ثم راجع البائع والشحن`,`جرّب ${t.code} لكل سلة بالشروط نفسها`],close:t=>`عند التعادل ارجع لسياسة الإرجاع والوضوح في وصف المنتج بدل إضافة بدائل جديدة.`},
  {title:'خط زمني للسلة',lead:t=>`قسّم تجربة شراء ${t.category} إلى نقاط زمنية: قبل الإضافة، بعد الإضافة، بعد إدخال الكود، وقبل الدفع النهائي.`,steps:t=>[`سجّل السعر قبل إضافة المنتج`,`راجع الرسوم فور تكوين السلة`,`طبّق ${t.code} وسجّل النتيجة كما تظهر`,`أعد التحقق قبل تنفيذ الدفع مباشرة`],close:t=>`الخط الزمني يوضح متى حدث أي تغير ويمنع نسب فرق السعر للكود بلا دليل.`},
  {title:'تدقيق البائع',lead:t=>`عندما تتقارب منتجات ${t.category}، افصل تقييم البائع عن تقييم المنتج لأن اختلاف البائع قد يغير التوصيل والإرجاع والقيمة النهائية.`,steps:t=>[`طابق وصف المنتج مع احتياج ${t.useCase}`,`راجع معلومات البائع المتاحة في صفحة المنتج`,`قارن شروط التسليم والإرجاع`,`اختبر ${t.code} بعد تثبيت البائع المختار`],close:t=>`لا تنتقل لبائع آخر لمجرد قبول القسيمة إذا أصبحت شروط ما بعد الشراء أضعف.`},
  {title:'خطة الإرجاع قبل الشراء',lead:t=>`تعامل مع الإرجاع كجزء من قرار ${t.category} قبل الدفع، خصوصًا عندما يكون ${t.factor} قابلًا للاختلاف بين الخيارات.`,steps:t=>[`راجع وصف حالة المنتج بدقة`,`احتفظ بما يظهر من شروط الإرجاع`,`تأكد من المقاس أو التوافق حيث يلزم`,`قارن تكلفة الخطأ مع أي توفير محتمل`],close:t=>`وضوح مسار الإرجاع يرفع قيمة الصفقة حتى لو لم يكن السعر هو الأقل.`},
  {title:'بطاقة الضمان',lead:t=>`افصل بين كلمة «ضمان» العامة وبين التفاصيل المعلنة فعليًا لمنتج ${t.category}؛ القرار يعتمد على الجهة والنطاق وما يظهر في الصفحة.`,steps:t=>[`راجع بيانات الضمان المعلنة`,`طابقها مع نوع استخدام ${t.useCase}`,`قارن البائعين إذا اختلفت التفاصيل`,`لا تفترض تغطية غير مكتوبة بسبب وجود ${t.code}`],close:t=>`أي معلومة غير واضحة تبقى سؤالًا مفتوحًا لا حقيقة نبني عليها قرار الشراء.`},
  {title:'مراجعة الشحن والتسليم',lead:t=>`قد يغير الشحن قيمة شراء ${t.category} حتى لو بدا السعر الأساسي مناسبًا، لذلك افحص التكلفة والموعد والعنوان قبل الحسم.`,steps:t=>[`ثبّت عنوان التسليم الصحيح لسوق ${t.market}`,`راجع الرسوم والموعد الظاهرين`,`قارن أثر البائع على التوصيل`,`اختبر القسيمة بعد استقرار السلة`],close:t=>`المعيار النهائي هو التكلفة والملاءمة عند التسليم، لا السعر المعروض منفردًا.`},
  {title:'تدقيق المواصفات الأساسية',lead:t=>`حوّل مواصفات ${t.category} إلى قائمة قصيرة من خصائص تخدم ${t.useCase} مباشرة، وتجاهل التفاصيل التي لا تغير قرارك.`,steps:t=>[`ابدأ بـ${t.factors?.[0]||t.factor}`,`راجع ${t.factor} كمعيار ثانٍ`,`طابق ${t.checks?.[1]||'وصف المنتج'} مع الصفحة`,`استبعد الخيار غير الملائم قبل تجربة القسيمة`],close:t=>`تقليل عدد المعايير يجعل المقارنة أسرع ويمنع العرض من قيادة القرار بدل الاحتياج.`},
  {title:'مراجعة طريقة الدفع',lead:t=>`قبل دفع طلب ${t.category}، ثبّت المنتج والبائع أولًا ثم راجع طريقة الدفع باعتبارها خطوة منفصلة لا سببًا لتغيير كل السلة.`,steps:t=>[`احتفظ بنفس العناصر والكمية`,`راجع أي رسالة أهلية تظهر في السلة`,`طبّق ${t.code} مرة واحدة بوضوح`,`إذا غيرت طريقة الدفع فأعد تسجيل الإجمالي`],close:t=>`فصل الخطوات يجعل نتيجة التجربة قابلة للمقارنة ويقلل التخمين.`},
  {title:'مصفوفة القيمة مقابل السعر',lead:t=>`لا تقارن سعر ${t.category} وحده؛ اربط التكلفة بمدى تحقيق ${t.useCase} وبوضوح البائع والإرجاع والشحن.`,steps:t=>[`امنح الملاءمة وزنًا أعلى من الإضافات الثانوية`,`قيّم ${t.factor} حسب أهميته لك`,`قارن التكلفة النهائية لا السعر الأولي`,`استخدم ${t.code} كعامل مساعد لا كعامل وحيد`],close:t=>`الخيار الأعلى قيمة هو الذي يحقق الاحتياج بأقل تنازل مهم ضمن ميزانيتك.`},
  {title:'سيناريو الخيار الاحتياطي',lead:t=>`جهّز بديلًا واحدًا لشراء ${t.category} قبل الدفع حتى لا تضطر لقبول خيار أضعف إذا تغير السعر أو رفضت السلة الكود.`,steps:t=>[`حدد البديل قبل بدء تجربة القسيمة`,`طابقه مع ${t.useCase}`,`قارن ${t.factor} بين الخيارين`,`ارجع للبديل إذا ساءت شروط الصفقة الأساسية`],close:t=>`وجود بديل جاهز يقلل ضغط الوقت ويجعل قرارك أقل اعتمادًا على نتيجة كوبون واحدة.`},
  {title:'مراجعة الكمية وسعر الوحدة',lead:t=>`إذا كانت السلة تحتوي أكثر من قطعة من ${t.category}، افصل قرار الكمية عن تأثير القسيمة حتى لا تشتري أكثر مما تحتاج.`,steps:t=>[`حدد الكمية المطلوبة فعليًا`,`قارن سعر الوحدة قبل وبعد أي تغير`,`راجع أثر الشحن على الكمية`,`استخدم ${t.code} بعد تثبيت العدد`],close:t=>`التوفير الحقيقي لا يتحقق إذا زادت الكمية بلا حاجة لمجرد الوصول إلى سلة أكبر.`},
  {title:'تقرير الحسم النهائي',lead:t=>`قبل إنهاء شراء ${t.category}، لخص القرار في أربعة أسطر: الاحتياج، المنتج، تكلفة السلة، وأهم مخاطرة متبقية.`,steps:t=>[`الاحتياج: ${t.useCase}`,`العامل المرجح: ${t.factor}`,`الكود الذي ستجربه: ${t.code}`,`المرجع النهائي: إجمالي نون الظاهر قبل الدفع`],close:t=>`إذا لم تستطع تلخيص سبب الاختيار بوضوح، ارجع للمقارنة بدل إكمال الطلب تحت ضغط العرض.`},
  {title:'تدقيق الإصدار وحالة المنتج',lead:t=>`قبل مقارنة سعر ${t.category}، تأكد أن الخيارات المعروضة تمثل نفس الإصدار والحالة والملحقات حتى لا تقارن عرضين غير متكافئين.`,steps:t=>[`راجع اسم الإصدار كما يظهر في الصفحة`,`قارن حالة المنتج والملحقات المعلنة`,`ثبّت البائع قبل اختبار ${t.code}`,`أعد حساب الإجمالي إذا تغيّر أي عنصر`],close:t=>`المقارنة الصحيحة تبدأ بمنتجات متكافئة، ثم يأتي السعر والكود بعد ذلك.`},
  {title:'حساب تكلفة الطلب بالكامل',lead:t=>`قيّم شراء ${t.category} على أساس إجمالي الطلب الظاهر، وليس سعر المنتج وحده، مع فصل الشحن وأي فروق واضحة بين البائعين.`,steps:t=>[`سجّل سعر المنتج قبل القسيمة`,`أضف رسوم الشحن الظاهرة`,`طبّق ${t.code} على السلة الثابتة`,`قارن الإجمالي النهائي بالبديل المناسب`],close:t=>`الرقم الذي يهم عند الحسم هو ما تدفعه فعليًا لنفس السلة المناسبة لاحتياجك.`},
  {title:'اختبار سلة مصغرة',lead:t=>`إذا كانت سلة ${t.category} معقدة، اختبر عنصرًا واحدًا أولًا حتى تعرف هل المشكلة من الأهلية أو من عنصر آخر داخل السلة.`,steps:t=>[`ابدأ بمنتج واحد واضح المواصفات`,`تأكد من السوق والحساب`,`جرّب ${t.code} مرة واحدة`,`أضف بقية العناصر تدريجيًا مع مراقبة الإجمالي`],close:t=>`السلة المصغرة تجعل سبب الرفض أو تغير السعر أسهل في التحديد من إعادة المحاولة على سلة كبيرة.`},
  {title:'مراجعة السوق وعنوان التسليم',lead:t=>`قبل الحكم على أهلية ${t.code} مع ${t.category}، طابق سوق نون مع عنوان التسليم وإعداد الدولة لأن النتيجة يجب أن تُقرأ داخل السوق نفسه.`,steps:t=>[`أكد سوق نون ${t.market}`,`راجع عنوان التسليم المختار`,`تأكد من بقاء نفس البائع والمنتج`,`بعدها راجع نتيجة السلة دون نقل تجربة من سوق آخر`],close:t=>`فصل الأسواق يمنع تفسير نتيجة في دولة على أنها تنطبق تلقائيًا على دولة أخرى.`},
  {title:'تدقيق الملحقات والتوافق',lead:t=>`في ${t.category} قد يغيّر التوافق أو ما يأتي داخل العبوة قيمة الصفقة، لذلك راجع هذه التفاصيل قبل إعطاء السعر وزنًا أكبر من اللازم.`,steps:t=>[`راجع ${t.checks?.[0]||t.factor}`,`تحقق من الملحقات المذكورة في الوصف`,`قارن التوافق مع استخدام ${t.useCase}`,`استبعد الخيار غير الملائم قبل تجربة القسيمة`],close:t=>`خصم على منتج غير متوافق لا يحول الصفقة إلى اختيار مناسب.`},
  {title:'مراجعة الاستلام قبل الحسم',lead:t=>`اربط قرار شراء ${t.category} بما تحتاج مراجعته عند الاستلام حتى تكون تكلفة الخطأ جزءًا من المقارنة قبل الدفع.`,steps:t=>[`حدد ما يجب مطابقته مع الوصف`,`راجع المقاس أو الحالة حيث ينطبق`,`احتفظ ببيانات الطلب والبائع`,`اعرف مسار الإرجاع المعلن قبل الحسم`],close:t=>`التخطيط للاستلام يقلل احتمال اكتشاف اختلاف مهم بعد أن يصبح تغييره أكثر كلفة.`},
  {title:'فلتر الاحتياج الأساسي',lead:t=>`قبل مقارنة أي عروض على ${t.category}، ضع ثلاثة شروط مرتبطة مباشرة بـ${t.useCase} واجعل فشل أحدها سببًا للاستبعاد حتى لو بدا السعر جذابًا.`,steps:t=>[`حدد الشرط الأساسي الأول`,`استخدم ${t.factor} كعامل ترجيح`,`استبعد الخيارات التي لا تحقق الحد الأدنى`,`قارن الكود والسعر فقط بين الخيارات المتبقية`],close:t=>`هذا الفلتر يحافظ على جودة القرار ويمنع الخصم من دفعك إلى منتج لا يخدم الاستخدام الحقيقي.`},
  {title:'سجل تجربة القسيمة',lead:t=>`عامل تجربة ${t.code} مع ${t.category} كاختبار صغير: دوّن السلة والوقت والإجمالي قبل وبعد، من غير افتراض سبب لأي فرق لم يظهر بوضوح.`,steps:t=>[`ثبّت المنتج والكمية والبائع`,`سجّل الإجمالي قبل الكود`,`طبّق الكود وسجّل النتيجة`,`إذا غيرت متغيرًا فأعد التجربة من البداية`],close:t=>`السجل البسيط يجعل النتيجة قابلة للمقارنة ويمنع الخلط بين أثر القسيمة وتغيرات السلة.`}
];

function stableIndex(cursor,size,salt=0){
  const n=Math.max(0,Number(cursor)||0),mixed=(Math.imul((n+salt)>>>0,2654435761)>>>0);return mixed%size;
}
function queryModifierFor(cursor){return ARABIC_QUERY_MODIFIERS[stableIndex(cursor,ARABIC_QUERY_MODIFIERS.length,17)]}
function diversitySection(topic,cursor,offset=0){
  const frame=DIVERSITY_FRAMES[stableIndex(cursor,DIVERSITY_FRAMES.length,101+offset*37)],t=topic||{},steps=frame.steps(t).map(x=>`<li>${esc(x)}</li>`).join('');
  return `<section class="decision-angle" data-diversity-frame="${stableIndex(cursor,DIVERSITY_FRAMES.length,101+offset*37)}"><h2>${esc(frame.title)}: ${esc(t.queryModifier||'قرار الشراء')}</h2><p>${esc(frame.lead(t))}</p><ol>${steps}</ol><p class="atomic-answer"><strong>الخلاصة:</strong> ${esc(frame.close(t))}</p></section>`;
}

export function buildBulkTopic(cursor=0,options={}){
  const topic=buildBulkTopicBase(cursor,options),queryModifier=queryModifierFor(cursor);
  const kw=(String(topic.kw||'')+' '+queryModifier).replace(/\s+/g,' ').trim();
  const slug=arabicSlugify(kw);
  return {...topic,kw,slug,queryModifier,diversitySeed:Math.max(0,Number(cursor)||0),diversityVersion:4,topicExpansionVersion:'query-modifier-v4'};
}

export function buildUsefulArticle(topic,cursor=0){
  const article=buildUsefulArticleBase(topic,cursor);
  if(!article)return article;
  const baseWords=plainWords(article.html),sections=[];
  if(baseWords<1780)sections.push(diversitySection(topic,cursor,0));
  if(baseWords<1660)sections.push(diversitySection(topic,cursor,1));
  if(!sections.length)return article;
  const marker='<section class="methodology accountability">',insert=sections.join('');
  const html=String(article.html||'').includes(marker)?String(article.html).replace(marker,`${insert}${marker}`):String(article.html).replace('</article>',`${insert}</article>`);
  return {...article,html,diversityVersion:4,topicExpansionVersion:'query-modifier-v4',diversityKey:`${stableIndex(cursor,ARABIC_QUERY_MODIFIERS.length,17)}-${stableIndex(cursor,DIVERSITY_FRAMES.length,101)}-${stableIndex(cursor,DIVERSITY_FRAMES.length,138)}`};
}

const UAE_ENGLISH_QUERY_MODIFIERS=['today','2026','Dubai','Abu Dhabi','Sharjah','online','UAE online','buy online UAE','best deals','best offers','deals today','offers today','sale today','coupon today','coupon 2026','promo code 2026','discount code 2026','price UAE','best price UAE','price comparison','shopping guide','checkout guide','deal guide','voucher guide','discount guide','seller guide','shipping guide','delivery guide','cart guide','offers guide','Dubai deals','Abu Dhabi deals','Sharjah deals','Dubai shopping','Abu Dhabi shopping','Sharjah shopping'];
const UAE_GOLDEN_COMMERCIAL_MODIFIERS=['coupon today','coupon 2026','promo code 2026','discount code 2026','first order coupon','new customer coupon','app coupon','voucher code UAE','online coupon UAE','first purchase coupon','new user coupon','app promo code','free delivery','best deals','best offers','deals today','offers today','sale today','price UAE','best price UAE','electronics deals UAE','mobile deals UAE','laptop deals UAE','beauty offers UAE','perfume deals UAE','gaming deals UAE','Dubai deals','Abu Dhabi deals','Sharjah deals','buy online UAE'];
const UAE_QUERY_CATEGORY={
  mobile:'mobile phones',computing:'laptops',audio:'headphones',screen:'TVs',fashion:'fashion',beauty:'beauty',
  appliance:'home appliances',kitchen:'home and kitchen',home:'home',fitness:'sports and fitness'
};
const UAE_COMMERCIAL_HEADS={
  coupon:['Noon UAE coupon code','Noon discount code UAE','Noon promo code UAE','Noon voucher code UAE','Noon coupon Dubai','Noon discount code Dubai'],
  timing:['Noon coupon code today UAE','Noon UAE coupon today','Noon promo code UAE today','Noon discount code UAE today'],
  value:['Noon UAE deals','Noon deals UAE','Noon UAE discounts','Noon sale UAE'],
  smartbuy:['Noon UAE offers','Noon offers UAE','Noon UAE deals','Noon shopping offers UAE'],
  cart:['Noon promo code UAE','Noon coupon code UAE','Noon discount code UAE'],
  finalprice:['Noon UAE deals','Noon discount code UAE','Noon UAE offers'],
  eligibility:['Noon first order coupon UAE','Noon coupon UAE new customer','Noon coupon UAE existing customer','Noon coupon eligibility UAE']
};
const UAE_POPULAR_SEARCHES={
  mobile:['iPhone 17 Pro Max','iPhone 17 Pro','iPhone 17','Samsung Galaxy S26 Ultra','Samsung Galaxy S26','Samsung Galaxy S25 Ultra','Google Pixel 10 Pro','Nothing Phone','Xiaomi phone','OnePlus phone','Honor phone'],
  computing:['MacBook Air M5','MacBook Neo','MacBook Pro','AI laptop','gaming laptop','2-in-1 laptop','business laptop','Lenovo laptop','ASUS laptop','HP laptop','Dell laptop','iPad','PS5','PS5 Slim','PS5 Pro','DualSense controller','EA Sports FC 26','Nintendo Switch 2','Nintendo Switch 2 Mario Kart bundle','Nintendo Switch'],
  audio:['AirPods Pro 3','AirPods 4','AirPods Pro','AirPods','Samsung Galaxy Buds4 Pro','JBL speaker','Sony headphones','Bose headphones','wireless earbuds'],
  screen:['Samsung TV','LG TV','OLED TV','QLED TV','gaming monitor','4K TV'],
  fashion:['handbags','sneakers','running shoes','Birkenstock','sunglasses','watches'],
  beauty:['sunscreen','fragrance','eau de parfum','hair growth serum','face moisturizer','Korean skincare','setting spray','perfume','Dyson Airwrap','Vitamin C serum','skincare','makeup','hair dryer'],
  appliance:['Samsung fridge','LG fridge','washing machine','vacuum cleaner','Dyson vacuum','home appliances'],
  kitchen:['Ninja air fryer','Philips air fryer','air fryer','coffee machine','blender','microwave'],
  home:['furniture','mattress','home storage','home deals','bedding'],
  fitness:['smartwatch','fitness tracker','treadmill','dumbbells','yoga mat'],
  grocery:['coffee','snacks','protein powder','grocery deals'],
  kids:['LEGO','kids toys','school supplies','kids fashion'],
  baby:['baby stroller','diapers','baby monitor','baby essentials'],
  travel:['travel luggage','cabin bag','travel backpack','suitcase'],
  office:['printer','keyboard','mouse','office chair','school supplies']
};
const UAE_INTENT_SUFFIX={coupon:'coupon code',timing:'coupon today',value:'deals',smartbuy:'offers',cart:'promo code',finalprice:'price',eligibility:'coupon eligibility'};
const UAE_GEO_SEARCH_MARKETS=['Dubai','Abu Dhabi','Sharjah'];
function uaeEnglishPriorityKeyword(candidate){
  if(candidate?.country!=='AE')return null;
  const profile=String(candidate.profileKey||'general'),category=UAE_QUERY_CATEGORY[profile]||String(candidate.nativeCategory||'').trim();
  const seed=Math.abs(Number(candidate.topicIndex||0)),heads=UAE_COMMERCIAL_HEADS[candidate.intent]||UAE_COMMERCIAL_HEADS.coupon,demand=UAE_POPULAR_SEARCHES[profile]||[];
  const useDemand=demand.length>0&&seed%10!==0,head=useDemand?demand[seed%demand.length]:heads[seed%heads.length],goldenModifier=seed%20!==19,modifier=(goldenModifier?UAE_GOLDEN_COMMERCIAL_MODIFIERS:UAE_ENGLISH_QUERY_MODIFIERS)[Math.floor(seed/Math.max(1,heads.length))%(goldenModifier?UAE_GOLDEN_COMMERCIAL_MODIFIERS.length:UAE_ENGLISH_QUERY_MODIFIERS.length)],intentSuffix=UAE_INTENT_SUFFIX[candidate.intent]||'shopping guide',geo=seed%10<7?'UAE':UAE_GEO_SEARCH_MARKETS[seed%UAE_GEO_SEARCH_MARKETS.length];
  const keyword=(useDemand?`${head} Noon ${geo} ${intentSuffix}`:`${head} ${category} ${modifier}`).replace(/\s+/g,' ').trim();
  const searchClass=String(head).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const golden=goldenModifier||/coupon|promo|discount|deal|offer|price|today|2026|dubai|sharjah|abu dhabi/i.test(`${keyword} ${modifier}`);return {keyword,tier:golden?'uae-golden-commercial-v2':useDemand?'uae-high-demand-product-v2':'uae-commercial-priority-v3',cluster:`uae-${candidate.intent||'commercial'}-${profile}`,searchClass,headTerm:head,demandSource:useDemand?'noon-uae-popular-searches-2026':'commercial-head',golden,goldenModifier};
}

function normalizeEnglishCandidate(candidate){
  if(!candidate)return candidate;
  const nativeCategory=String(candidate.nativeCategory||'').trim();
  const nativeMarket=String(candidate.nativeMarket||'').trim();
  const priority=uaeEnglishPriorityKeyword(candidate);
  if(priority){
    const nativeVariant='UAE commercial search guide',nativeKeyword=priority.keyword;
    return {...candidate,nativeVariant,nativeKeyword,nativeSlug:englishSlugify(nativeKeyword),nativeAngle:`${nativeVariant} for ${nativeCategory} shoppers in UAE`,keywordTier:priority.tier,keywordCluster:priority.cluster,keywordSearchClass:priority.searchClass,keywordHeadTerm:priority.headTerm};
  }
  if(candidate.intent==='timing'){
    const nativeVariant='coupon timing guide';
    const nativeKeyword=`Noon ${nativeMarket} ${nativeCategory} coupon timing guide`.replace(/\s+/g,' ').trim();
    return {...candidate,nativeVariant,nativeKeyword,nativeSlug:englishSlugify(nativeKeyword),nativeAngle:`coupon timing guidance for ${nativeCategory} shoppers in ${nativeMarket}`};
  }
  const oldKeyword=String(candidate.nativeKeyword||'');
  const oldVariant=String(candidate.nativeVariant||'');
  if(!/\bcart test\b/i.test(oldKeyword)&&!/\bcart test\b/i.test(oldVariant))return candidate;
  const nativeVariant='checkout checklist';
  const nativeKeyword=oldKeyword.replace(/\bcart test\b/gi,nativeVariant).replace(/\s+/g,' ').trim();
  return {...candidate,nativeVariant,nativeKeyword,nativeSlug:englishSlugify(nativeKeyword),nativeAngle:`${nativeVariant} for ${nativeCategory} shoppers in ${nativeMarket}`};
}

function wordSafeMeta(text,max=155){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(clean.length<=max)return clean;
  const hard=clean.slice(0,Math.max(1,max-1));
  const cut=hard.lastIndexOf(' ');
  const body=(cut>=Math.floor(max*0.68)?hard.slice(0,cut):hard).replace(/[\s,;:\-–—.]+$/g,'');
  return `${body}.`;
}

function englishMeta(kw,code){
  const metaLead=/\bguide$/i.test(kw)?kw:`${kw} guide`;
  const long=`Practical ${metaLead}. Copy ${code}, verify cart eligibility, seller and shipping, then confirm the final checkout total.`;
  const short=`Practical ${metaLead}. Copy ${code}, verify eligibility and confirm the final checkout total.`;
  return wordSafeMeta(long.length<=155?long:short,155);
}

function cleanEnglishHtml(html){
  return String(html||'')
    .replace(/\bcart\s+test\b/gi,'checkout checklist')
    .replace(/\bguide\s+guide\b/gi,'guide');
}

const UAE_ENGLISH_CITIES=['Dubai','Abu Dhabi','Sharjah','Ajman','Al Ain'];
const UAE_ENGLISH_PURCHASE_MODES=['single-item checkout','mixed basket','mobile-app checkout','desktop checkout','gift purchase','replacement purchase','family purchase','sale-event comparison'];
const UAE_ENGLISH_DECISION_FRAMES=[
  ['Price-control check','Freeze the exact model, seller and quantity before comparing totals. Record the listed price, delivery line and payable amount, then change only one cart variable. This separates a coupon effect from a seller, stock or shipping change.','If the payable total moves, repeat the comparison with the original item state. Treat checkout as the final commercial reference and do not turn a temporary cart result into a permanent discount claim.'],
  ['Variant-and-seller check','Confirm storage, size, colour, pack or model details before testing the code. Two similar listings can have different sellers, fulfilment paths or included accessories, so the comparison should use one exact listing.','Keep seller and variant fixed while testing the coupon. If you intentionally change seller, label that as a new comparison rather than continuing the first one.'],
  ['Delivery-cost check','Write down the delivery promise and shipping line before applying the code. A lower item price can still produce a higher final total when delivery changes, so compare the complete payable amount rather than the product line alone.','Recheck delivery after every meaningful cart edit. For an urgent purchase, timing may matter more than a small price difference; for a flexible purchase, compare the same product again under current checkout conditions.'],
  ['Budget-boundary check','Set a maximum payable total before comparing alternatives. Keep the product requirements fixed, then use the coupon as one input inside that budget instead of choosing a weaker product only because a code appears to work.','If the preferred item stays above budget, compare a clearly defined alternative with the same essential requirements and record what changed in specification as well as price.'],
  ['Return-and-warranty check','Before treating the lowest total as the best option, review the seller, return context and warranty information shown for the exact listing. These details can change the practical value of two offers that look similar in search results.','Use the coupon test only after the product and seller meet your requirements. A successful code should not override a poor seller fit, unsuitable warranty context or an item that does not match the intended use.'],
  ['Timing-and-stock check','When stock or campaign conditions change, capture the current item state and checkout total instead of relying on an older screenshot or remembered price. Re-run the same controlled comparison only when the purchase decision is still open.','If availability changes, treat the new listing as a new decision. Do not attribute the whole price movement to the coupon when stock, seller or campaign conditions also changed.']
];
function englishUaeDiversitySections(candidate,cursor){
  if(candidate?.country!=='AE')return '';
  const seed=Math.abs(Number(cursor||candidate?.topicIndex||0));
  const kw=String(candidate?.nativeKeyword||candidate?.primaryKeyword||'Noon UAE deal');
  const cat=String(candidate?.nativeCategory||candidate?.profileKey||'product');
  const intent=String(candidate?.intent||'shopping');
  const city=UAE_ENGLISH_CITIES[seed%UAE_ENGLISH_CITIES.length];
  const mode=UAE_ENGLISH_PURCHASE_MODES[Math.floor(seed/5)%UAE_ENGLISH_PURCHASE_MODES.length];
  const a=UAE_ENGLISH_DECISION_FRAMES[seed%UAE_ENGLISH_DECISION_FRAMES.length];
  const b=UAE_ENGLISH_DECISION_FRAMES[(seed+3)%UAE_ENGLISH_DECISION_FRAMES.length];
  const first=`<section class="uae-decision-frame" data-frame="${seed%UAE_ENGLISH_DECISION_FRAMES.length}"><h2>${esc(a[0])} for ${esc(cat)} in ${esc(city)}</h2><p>For the query <strong>${esc(kw)}</strong>, use a ${esc(mode)} as the controlled shopping scenario. ${esc(a[1])}</p><p>${esc(a[2])} This keeps the guide tied to the exact UAE purchase question instead of repeating a generic coupon explanation.</p></section>`;
  const second=`<section class="uae-decision-frame" data-frame="${(seed+3)%UAE_ENGLISH_DECISION_FRAMES.length}"><h2>${esc(b[0])}: ${esc(intent)} decision</h2><p>Apply this second check specifically to ${esc(cat)} while remaining in the UAE storefront. ${esc(b[1])}</p><p>${esc(b[2])} For ${esc(city)} shoppers, the useful output is a documented final-cart comparison for this exact item state, not a universal promise about price, eligibility or savings.</p></section>`;
  return first+second;
}

export function buildEnglishNativeCandidate(topic){
  return normalizeEnglishCandidate(buildEnglishNativeCandidateBase(topic));
}

export function buildEnglishUsefulArticle(candidate,cursor=0){
  const normalized=normalizeEnglishCandidate(candidate);
  const article=buildEnglishUsefulArticleBase(normalized,cursor);
  if(!article)return article;
  const kw=String(article.primaryKeyword||normalized?.nativeKeyword||'').replace(/\bcart test\b/gi,'checkout checklist').replace(/\s+/g,' ').trim();
  const title=String(article.title||kw).replace(/\bcart test\b/gi,'checkout checklist').replace(/\s+/g,' ').trim();
  const slug=String(article.slug||'').replace(/cart-test\b/gi,'checkout-checklist');
  const diversity=englishUaeDiversitySections(normalized,cursor);
  const enriched=diversity?String(article.html||'').replace('</article>',diversity+'</article>'):String(article.html||'');
  const html=cleanEnglishHtml(enriched);
  return {...article,slug,title,primaryKeyword:kw,metaDescription:englishMeta(kw,normalized?.code||article.coupon||''),html,englishSemanticDiversityV2:Boolean(diversity)};
}