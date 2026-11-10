// N9 append-only reserve: distinct pre-purchase questions, not factual product promises.
// No price, stock, discount, warranty or eligibility guarantees. Native quality gates remain authoritative.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const concerns=Object.freeze({
  "tablet": "child account screen time documentation,توثيق وقت الشاشة لحساب الطفل;charging dock travel packing fit,توافق قاعدة الشحن عند السفر;external microphone class recording,توافق ميكروفون المحاضرات;downloaded textbook reading controls,إعداد قراءة الكتب المحملة",
  "laptop": "repairable battery service options,خيارات صيانة البطارية;external monitor screen rotation,تدوير شاشة خارجية للقراءة;conference microphone mute indicator,وضوح مؤشر كتم الميكروفون;multiport adapter charging conflicts,تعارض الشحن مع موزع المنافذ",
  "phone": "backup transfer over local cable,نقل النسخ الاحتياطية بكابل مباشر;screen protector fingerprint sensor fit,توافق الواقي مع بصمة الشاشة;dual SIM mobile data selection,اختيار بيانات الهاتف بين الشريحتين;accessible large text display controls,إعدادات الخط الكبير لسهولة القراءة",
  "gaming-laptop": "controller Bluetooth pairing support,توافق توصيل يد التحكم ببلوتوث;external display high refresh cable,كابل الشاشة الخارجية السريعة;dust filter cleaning accessibility,سهولة تنظيف فلتر الغبار;game library storage expansion plan,خطة توسيع مساحة الألعاب",
  "monitor": "portrait orientation stand adjustment,ضبط الشاشة للوضع الرأسي;screen uniformity return inspection,فحص تجانس الإضاءة قبل الشراء;built in speakers meeting clarity,وضوح مكبرات الشاشة للاجتماعات;USB hub keyboard wake behavior,استيقاظ لوحة المفاتيح عبر موزع الشاشة",
  "printer": "envelope feeder support verification,توافق تغذية الأظرف;third party ink policy review,مراجعة سياسة الحبر البديل;first page wake delay comparison,زمن الاستيقاظ للطباعة الأولى;scanner to phone app access,استخدام تطبيق مسح المستندات للهاتف",
  "ssd": "encrypted folder recovery key storage,حفظ مفتاح استعادة المجلد المشفر;sustained video editing write performance,أداء كتابة الفيديو الطويل;tablet USB adapter compatibility,توافق محول التخزين مع التابلت;travel shock protection case fit,توافق حقيبة الحماية أثناء التنقل",
  "router": "guest network isolation controls,عزل شبكة الضيوف;router firmware support lifecycle,مدة دعم تحديثات الراوتر;smart home device pairing mode,توصيل الأجهزة المنزلية الذكية;remote management account security,حماية حساب إدارة الراوتر عن بعد",
  "earbuds": "earbud location finding app setup,إعداد العثور على السماعة;case hinge wear replacement options,خيارات صيانة مفصلة العلبة;wind noise call microphone behavior,تأثر الميكروفون بهواء الطريق;ear tip comfort extended commute,راحة رأس السماعة أثناء التنقل الطويل",
  "headphones": "wired microphone support on laptop,دعم الميكروفون السلكي بالكمبيوتر;replacement charging port servicing,خيارات إصلاح منفذ الشحن;ear warmth during summer commute,حرارة الأذن أثناء التنقل صيفا;gaming chat voice monitoring feature,خاصية سماع صوتك أثناء اللعب",
  "powerbank": "solar charging claims label evidence,مراجعة ادعاءات الشحن الشمسي;automatic shutoff idle detection,إيقاف التشغيل عند عدم الاستخدام;travel capacity label legibility,وضوح ملصق السعة عند السفر;shared phone tablet charging plan,توزيع الشحن بين الهاتف والتابلت",
  "air-fryer": "ceramic basket coating label evidence,توثيق طبقة السلة الخزفية;cord length counter socket access,طول السلك ومدى الوصول للمقبس;small serving crisping tray options,خيارات صينية تحمير الحصة الصغيرة;spare basket handle availability,توافر مقبض سلة بديل",
  "blender": "dishwasher blade assembly safety,تعليمات غسل مجموعة الشفرة;baby food smooth puree consistency,نعومة هرس طعام الأطفال;storage cable wrap mechanism,طريقة لف سلك التخزين;small ingredient minimum fill requirement,الحد الأدنى للمكونات في الإبريق",
  "coffee-machine": "prebrew water warming duration,مدة تسخين الماء قبل التحضير;removable milk tube storage hygiene,نظافة تخزين أنبوب الحليب;drink size customization interface,سهولة ضبط حجم المشروب;power outage setting retention,حفظ الإعدادات بعد انقطاع الكهرباء",
  "vacuum": "stair cleaning hose extension reach,مدى الخرطوم لتنظيف الدرج;filter wash drying time guidance,إرشادات تجفيف الفلتر بعد الغسيل;replacement battery pack identifiers,معرفة رقم البطارية البديلة;low furniture cleaning head height,ارتفاع الرأس تحت الأثاث المنخفض",
  "washer": "wool garment care cycle label,ملاءمة دورة الصوف حسب التعليمات;water supply pressure rating,تصنيف ضغط المياه المطلوب;washer door opening clearance,المساحة المطلوبة لفتح باب الغسالة;low foam detergent dosage notes,تعليمات جرعة المنظف قليل الرغوة",
  "fridge": "vegetable drawer replacement parts,توافر درج خضار بديل;door seal cleaning groove access,سهولة تنظيف جوان الباب;power outage cooling care advice,إرشادات التعامل عند انقطاع الكهرباء;adjustable feet floor leveling,ضبط الأرجل لتسوية الثلاجة",
  "dishwasher": "glassware gentle program evidence,توثيق برنامج الأكواب الحساسة;removable upper rack height adjustment,ضبط ارتفاع الرف العلوي;leak protection hose documentation,توثيق حماية الخرطوم من التسرب;cycle end sound mute option,إمكانية كتم صوت انتهاء الدورة",
  "sunscreen": "under beard application texture,ملمس الواقي مع شعر الوجه;travel size bottle refill labeling,ملصق عبوة السفر وإعادة التعبئة;skin tone white cast review,مقارنة الأثر الأبيض على البشرة;reapplication over face powder,طريقة إعادة الاستخدام فوق البودرة",
  "walking-shoe": "walking route arch fatigue support,ملاءمة دعامة القدم للمشي الطويل;upper fabric breathability evidence,توثيق تهوية قماش الحذاء;reflective trim night walking review,مراجعة عناصر العكس أثناء المشي ليلا;sock thickness sizing allowance,تأثير سمك الجوارب على المقاس",
  "suitcase": "train overhead rack size planning,توافق الحقيبة مع رف القطار;telescopic handle wobble inspection,فحص اهتزاز المقبض القابل للسحب;wet clothing separator pocket,فصل الملابس المبللة بجيب مستقل;zipper pull replacement availability,توافر سحاب ومقبض بديل",
  "stroller": "public transport folding weight,وزن العربة عند طيها للنقل العام;sun canopy ventilation panel check,فحص تهوية مظلة الشمس;child tray accessory compatibility,توافق صينية الطفل الإضافية;wheel cleaning after beach use,تنظيف العجلات بعد الرمال",
  "car-seat": "winter coat harness fit guidance,إرشادات تثبيت الحزام مع الملابس الشتوية;car seat expiry date location,مكان تاريخ انتهاء استخدام المقعد;replacement buckle care instructions,تعليمات العناية بقفل الحزام;vehicle center position installation,توافق تركيب المقعد بالمنتصف",
  "television": "automatic brightness room light sensor,ضبط مستشعر ضوء الغرفة;screen reader menu navigation,التنقل الصوتي في قوائم التلفاز;home network casting compatibility,توافق عرض الهاتف عبر الشبكة;remote control battery door access,سهولة فتح غطاء بطارية الريموت",
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,limit)=>{
 if(limit<8)return '';
 let x=String(value).trim();
 while(x.length>limit&&x.includes(' '))x=x.slice(0,x.lastIndexOf(' '));
 return x.length<=limit?x:'';
};
export const ninthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const candidates=concerns[family];
 if(!candidates)return [];
 return brands.split(';').map(x=>x.split(',')).flatMap(([enBrand,arBrand])=>
  candidates.split(';').flatMap((item,i)=>{
   const [enFocus,arFocus]=item.split(',');
   if(!enFocus||!arFocus)return [];
   return ['SA','AE'].flatMap(country=>{
    const english=country==='AE';
    const code=english?'NOV188':'NOV170';
    const brand=english?enBrand:arBrand,category=english?enCategory:arCategory;
    const focus=english?enFocus:arFocus;
    const head=brand+' '+category+': ';
    const tail=english?' | Noon UAE NOV188':' | نون السعودية NOV170';
    const fit=shorten(focus,72-head.length-tail.length);
    if(!fit)return [];
    const topic=head+fit+tail;
    if(topic.length<28||topic.length>72)return [];
    const token=slug(enBrand)+'-'+family+'-'+slug(enFocus);
    return [{
      country,language:english?'en-AE':'ar-SA',brand,category,topic,coupon:code,
      slug:(english?'uae':'saudi')+'-buyer-'+token+'-'+code.toLowerCase()+'-2026-n9',
      queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n9-'+slug(enFocus),
      comparisonKey:'editorial-n9-'+family+'-'+i,
      sections:english?[
        'Which buyer question makes '+fit+' worth checking on this listing',
        'Find the exact '+enBrand+' model documentation and seller supplied details',
        'Compare compatibility, maintenance, accessories and ongoing ownership costs',
        'Check Noon UAE return and warranty terms plus NOV188 eligibility in the actual cart',
        'Decision checklist, evidence gaps and what to ask the official seller before payment'
      ]:[
        'متى تصبح مسألة '+fit+' مؤثرة في اختيار المنتج',
        'توثيق موديل '+arBrand+' المحدد والبحث عن معلومات البائع الأصلية',
        'مقارنة التوافق والصيانة والملحقات والتكاليف دون وعود غير موثقة',
        'مراجعة شروط بائع نون السعودية والإرجاع والضمان وقبول NOV170 بالسلة',
        'قائمة قرار الشراء والأسئلة التي تحتاج إلى دليل من البائع'
      ]
    }];
   });
  }));
}));
export const ninthEditorialWaveVersion='verified-purchase-service-questions-n9-2026-11';
