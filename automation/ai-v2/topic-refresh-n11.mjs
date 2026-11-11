// N11 append-only: grounded product-specific buying questions for both markets.
// Do not change historical N1-N10 identities. Native quality and novelty gates still apply.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const angles=Object.freeze({
 'tablet':'multiple user profile switching setup,إعداد تبديل حسابات المستخدمين;PDF handwriting export file formats,صيغ تصدير الملاحظات المكتوبة;front camera placement for landscape calls,موضع الكاميرا للمكالمات الأفقية',
 'laptop':'BIOS battery charging limit options,إعداد حد شحن البطارية;service manual spare screws access,توفر تعليمات فك الهيكل للصيانة;dual external monitor resolution support,دعم دقة شاشتين خارجيتين',
 'phone':'camera shutter lag for moving subjects,تأخر التقاط الصور أثناء الحركة;family parental control restrictions,إعداد الرقابة العائلية على الهاتف;ultrasonic fingerprint screen protector fit,توافق حماية الشاشة مع البصمة',
 'gaming-laptop':'MUX graphics switch reboot requirement,متطلبات إعادة التشغيل لتبديل الرسوميات;per key keyboard lighting control,التحكم بإضاءة أزرار لوحة المفاتيح;charging brick weight for commuting,وزن شاحن الألعاب أثناء التنقل',
 'monitor':'portrait orientation stand rotation range,مدى دوران الحامل للوضع الرأسي;picture by picture source selection,تبديل المصادر بوضع تقسيم الشاشة;included cable bandwidth evidence,توثيق قدرة الكابل المرفق',
 'printer':'manual feed envelope thickness support,دعم سماكة أظرف التغذية اليدوية;scan to email account requirements,متطلبات البريد لمسح المستندات;replacement printhead servicing options,خيارات خدمة رأس الطباعة',
 'ssd':'hardware encryption activation instructions,تعليمات تنشيط تشفير القرص;smart diagnostic app operating systems,توافق تطبيق فحص حالة القرص;file system formatting cross platform,تهيئة القرص لأكثر من نظام',
 'router':'guest WiFi client isolation options,عزل أجهزة شبكة الضيوف;parental schedule per device setup,إعداد وقت الاتصال لكل جهاز;modem bridge mode compatibility,توافق وضع الجسر مع المودم',
 'mesh':'ethernet backhaul port assignment,توزيع منافذ الربط السلكي;separate guest SSID on satellites,شبكة ضيوف منفصلة على الوحدات;node roaming thresholds documentation,توثيق انتقال الأجهزة بين الوحدات',
 'earbuds':'volume balance hearing accessibility settings,ضبط توازن الصوت لسهولة السمع;one earbud replacement pairing steps,خطوات ربط سماعة بديلة;touch controls accidental tap lock,منع اللمس غير المقصود',
 'headphones':'wired listening when battery empty,الاستماع بالكابل بعد نفاد البطارية;folding joint replacement parts,قطع صيانة مفصل الطي;microphone sidetone adjustment controls,التحكم بسماع صوتك أثناء المكالمة',
 'soundbar':'HDMI CEC volume remote compatibility,توافق التحكم بصوت الريموت;subwoofer apartment night mode settings,ضبط الصوت الليلي للشقة;TV dialog enhancement independent level,مستوى تعزيز وضوح الحوار',
 'smartwatch':'offline maps storage and navigation,خرائط الملاحة دون اتصال;watch strap spring bar dimension,مقاس مسمار تبديل السوار;health export privacy permission settings,أذونات تصدير البيانات الصحية',
 'fitness-band':'workout data export format support,دعم تصدير بيانات التمارين;small wrist band minimum fit,ملاءمة السوار للمعصم الصغير;automatic activity recognition controls,إعدادات اكتشاف النشاط تلقائيا',
 'powerbank':'pass through charging safety documentation,توثيق أمان الشحن أثناء تغذية الأجهزة;power display remaining percent accuracy,دقة عرض نسبة الشحن المتبقية;included cable wattage label evidence,توثيق قدرة الكابل المرفق',
 'gan-charger':'foldable plug socket clearance,ملاءمة القابس القابل للطي;low power headphones charging compatibility,توافق شحن سماعات قليلة الاستهلاك;simultaneous port priority allocation,أولوية توزيع المنافذ مع تعدد الأجهزة',
 'usb-dock':'external monitor refresh rate limits,حد تحديث الشاشة الخارجية;wired ethernet sleep wake behavior,استعادة الشبكة بعد السكون;removable cable length desk setup,طول الكابل المناسب لترتيب المكتب',
 'webcam':'manual focus macro document sharing,التركيز اليدوي لعرض المستندات;mount compatibility curved monitor,توافق الحامل مع الشاشة المنحنية;privacy LED on and off evidence,توثيق ضوء تشغيل الكاميرا',
 'keyboard':'hot swap switch socket compatibility,توافق قواعد تبديل المفاتيح;Arabic keycap physical layout matching,مطابقة مفاتيح العربية مع التخطيط;wireless sleep wake reconnection delay,سرعة إعادة الاتصال بعد السكون',
 'gaming-mouse':'left handed grip button placement,أماكن الأزرار لليد اليسرى;mouse feet replacement part dimensions,مقاسات قطع انزلاق الماوس;onboard profile without desktop software,إعدادات محفوظة بدون برنامج',
 'air-fryer':'maximum layer thickness crisp result,سماكة الطعام للحصول على قرمشة;temperature probe accessory support,توافق مسبار حرارة الطعام;replacement basket part code availability,توفر رقم السلة البديلة',
 'blender':'jar measurement markings accuracy,وضوح ودقة تدريج الوعاء;countertop suction feet stability,ثبات قواعد الشفط على الرخامة;detachable blade cleaning access,سهولة فك السكاكين للتنظيف',
 'coffee-machine':'milk frother steam wand clearance,المساحة اللازمة لرغوة الحليب;shot volume programmable memory,حفظ كمية القهوة المفضلة;descaling warning cycle documentation,دليل دورات إزالة الترسبات',
 'vacuum':'under sofa head clearance height,ارتفاع رأس المكنسة أسفل الأثاث;replaceable battery authorized parts,توفر بطارية بديلة معتمدة;dust container one hand emptying,إفراغ حاوية الغبار بيد واحدة',
 'air-purifier':'room sensor placement away from windows,مكان حساس الهواء بعيد عن النوافذ;replacement carbon filter separate purchase,شراء فلتر الكربون منفصلا;night mode display brightness control,التحكم بسطوع الشاشة ليلا',
 'humidifier':'water tank opening hand cleaning access,سهولة تنظيف فتحة خزان الماء;humidistat calibration display accuracy,دقة عرض وقياس الرطوبة;mineral residue maintenance instructions,تعليمات تنظيف ترسبات الأملاح',
 'microwave':'turntable plate replacement diameter,مقاس طبق الدوران البديل;child safety lock button sequence,خطوات تفعيل قفل الأطفال;interior cavity coating cleaning guidance,طريقة تنظيف طلاء الحجرة',
 'washer':'manual emergency door release location,مكان فتح الباب عند الطوارئ;detergent drawer liquid insert fit,توافق درج المسحوق السائل;small load balance sensor behavior,توازن حمولة الغسيل الصغيرة',
 'fridge':'refrigerator drawer humidity adjustment,ضبط رطوبة درج الخضروات;door gasket replacement dimensions,مقاسات جلدة الباب البديلة;electricity restart temperature recovery,استعادة الحرارة بعد عودة الكهرباء',
 'dishwasher':'half load zone selection control,اختيار نصف حمولة الغسيل;water hardness setting instructions,إعداد عسر المياه;floor projection cycle remaining indication,مؤشر الوقت المتبقي على الأرض',
 'hair-dryer':'diffuser attachment nozzle dimension,توافق قطر وصلة موزع الهواء;cool shot button continuous hold,طريقة تشغيل زر الهواء البارد;storage cable swivel strain relief,حماية كابل المجفف عند التخزين',
 'shaver':'replacement foil head model numbering,رقم رأس الحلاقة البديل;wet shaving gel cleaning instructions,تعليمات التنظيف بعد جل الحلاقة;travel lock accidental activation control,قفل السفر لمنع التشغيل',
 'toothbrush':'replacement brush head color identification,تمييز رؤوس الفرش البديلة;pressure sensor vibration feedback,تنبيه الضغط أثناء التنظيف;travel case airflow drying options,تهوية علبة الفرشاة أثناء السفر',
 'sunscreen':'pump dispenser one dose measurement,كمية ضغطة العبوة الواحدة;face makeup layering finish compatibility,توافق الواقي مع طبقات المكياج;expiry date after opening label,مدة الاستخدام بعد فتح العبوة',
 'moisturizer':'ingredient fragrance free label evidence,توثيق خلو المكونات من العطر;jar versus pump hygiene handling,طريقة الاستخدام الصحي للعبوة;skin patch test guidance for new formula,إرشادات اختبار المنتج على مساحة صغيرة',
 'running-shoe':'toe box width size variation,اختلاف اتساع مقدمة الحذاء;heel drop specification per model,مقدار فرق ارتفاع الكعب;running sock thickness sizing impact,تأثير سماكة الجورب على المقاس',
 'walking-shoe':'removable footbed orthotic fit,توافق النعل الطبي البديل;shoe upper breathability summer use,تهوية الجزء العلوي في الصيف;wide foot side seam pressure,ضغط الخياطة على القدم العريضة',
 'suitcase':'wheel housing replacement screw access,سهولة فك غطاء عجلات الحقيبة;expansion zipper cabin size implications,تأثير توسيع الحقيبة على أبعاد الطائرة;interior compression straps adjustment,قابلية ضبط أحزمة تثبيت الملابس',
 'stroller':'basket loading weight label verification,التحقق من وزن سلة التخزين;wheel brake pedal sandal comfort,سهولة تشغيل الفرامل بالحذاء;fabric cover removable wash instructions,تعليمات فك وغسل الغطاء',
 'car-seat':'vehicle seat belt routing diagram,رسم مسار حزام السيارة;headrest adjustment growth range,مدى تعديل مسند الرأس مع النمو;removable cushion washing limitations,حدود غسل الوسائد الداخلية',
 'smart-camera':'local SD card overwrite settings,إعداد الكتابة على بطاقة الذاكرة;night vision glass reflection placement,موضع الكاميرا لتجنب انعكاس الزجاج;alert zones privacy masking options,إخفاء مناطق التصوير للخصوصية',
 'smart-plug':'manual power restore state behavior,حالة المقبس بعد رجوع الكهرباء;button override without internet access,التحكم اليدوي دون اتصال;energy measurement low watt precision,دقة القياس مع الاستهلاك المنخفض',
 'projector':'throw distance room ceiling constraints,مسافة العرض حسب ارتفاع السقف;automatic focus corner sharpness,وضوح زوايا الصورة بعد التركيز;fan exhaust clearance in cabinet,مساحة تهوية المروحة داخل الرف',
 'controller':'analog stick deadzone software options,ضبط منطقة استجابة عصا التحكم;charging dock contact alignment,محاذاة نقاط شحن وحدة اللعب;trigger vibration supported games evidence,توثيق الألعاب التي تدعم اهتزاز الأزرار',
 'speaker':'speaker stereo pairing supported models,توافق موديلات توصيل ستيريو;microphone speakerphone pickup distance,مسافة التقاط صوت المكالمة;auxiliary input headphone latency,تأخر الصوت عبر المنفذ السلكي',
 'baby-bottle':'bottle nipple size age marking evidence,توثيق مقاس حلمة الرضاعة;sterilizer rack bottle neck compatibility,توافق عنق الزجاجة مع المعقم;replacement sealing ring cleaning instructions,إرشادات تنظيف حلقة الإغلاق',
 'food-processor':'disc blade storage accessory box,تخزين ملحقات التقطيع بأمان;dough mixing bowl capacity limit,الحمولة المناسبة لعجن العجين;feed tube vegetable width clearance,مقاس فتحة إدخال الخضروات',
 'pressure-cooker':'steam release handle distance safety,أمان المسافة من مقبض البخار;replacement silicone ring service schedule,موعد استبدال حلقة السيليكون;induction hob base marking evidence,توثيق التوافق مع سطح الحث',
 'cookware':'induction compatible base disk diameter,قطر قاعدة الإناء للموقد الحثي;handle oven temperature rating label,الحد الحراري لمقبض الإناء;stacking pan protector accessory fit,توافق فواصل حماية الأواني',
 'kettle':'minimum fill line single cup heating,الحد الأدنى لغلي كوب واحد;lid opening splash guard safety,أمان فتح الغطاء مع الماء الساخن;removable lime scale filter mesh size,مقاس شبكة فلتر الترسبات',
 'television':'auto brightness ambient sensor disable,إيقاف حساس السطوع التلقائي;smart TV parental PIN profile controls,إعداد كلمة مرور رقابة الأطفال;mounting stud distance and load limits,مسافة تثبيت الحامل وقدرة تحمله'
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(v,max)=>{if(max<8)return '';let s=String(v).trim();while(s.length>max&&s.includes(' '))s=s.slice(0,s.lastIndexOf(' '));return s.length<=max?s:''};
export const eleventhEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const raw=angles[family];if(!raw)return [];
 return brands.split(';').flatMap(row=>{
  const [enBrand,arBrand]=row.split(',');
  return raw.split(';').flatMap((pair,i)=>{
   const [enFocus,arFocus]=pair.split(',');if(!enFocus||!arFocus)return [];
   return ['SA','AE'].flatMap(country=>{
    const en=country==='AE',code=en?'NOV188':'NOV170',brand=en?enBrand:arBrand;
    const category=en?enCategory:arCategory,focus=en?enFocus:arFocus;
    const lead=brand+' '+category+': ',tail=en?' | Noon UAE NOV188':' | نون السعودية NOV170';
    const fit=shorten(focus,72-lead.length-tail.length);
    if(!fit)return [];
    const title=lead+fit+tail;
    if(title.length<28||title.length>72)return [];
    const token=slug(enBrand)+'-'+family+'-'+slug(enFocus);
    const articleSlug=(en?'uae':'saudi')+'-buyer-'+token+'-'+code.toLowerCase()+'-2026-n11';
    if(articleSlug.length>120)return [];
    return [{country,language:en?'en-AE':'ar-SA',brand,category,topic:title,coupon:code,slug:articleSlug,
      queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n11-'+slug(enFocus),
      comparisonKey:'editorial-n11-'+family+'-'+i,
      sections:en?[
       'When '+fit+' changes a real purchase decision and what evidence to ask for',
       'Identify the exact '+enBrand+' model specification without guessing features',
       'Compare seller documentation, compatibility and routine maintenance implications',
       'Check Noon UAE shipping, returns and NOV188 on the final cart',
       'Buyer verification checklist and unanswered questions before payment'
      ]:[
       'متى تؤثر '+fit+' على قرار الشراء وكيف تجمع دليلا واضحا',
       'التحقق من موديل '+arBrand+' ومعلومات البائع دون افتراض مواصفات غير مثبتة',
       'مقارنة التوافق والصيانة والتكاليف وفق دليل المنتج الفعلي',
       'مراجعة الشحن والإرجاع وشروط NOV170 داخل سلة نون السعودية',
       'قائمة مراجعة عملية والأسئلة اللازمة قبل إتمام الطلب'
      ]}];
   });
  });
 });
}));
export const eleventhEditorialWaveVersion='product-specific-prepurchase-verification-n11-2026-11';
