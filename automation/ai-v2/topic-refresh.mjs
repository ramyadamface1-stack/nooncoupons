// Append-only, human-curated buyer-intent wave to prevent exhausted queue windows.
// Every new subject has product-specific decision criteria. The native 95+ audit
// and immutable R2 checkpoint checks are NOT relaxed or bypassed.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const scenarios=Object.freeze({
  "tablet": "parental controls,رقابة الوالدين;keyboard case fit,توافق لوحة المفاتيح;learning app support,توافق تطبيقات الدراسة",
  "laptop": "video call quality,جودة الاجتماعات;travel weight,الوزن أثناء السفر;service and spare parts,الصيانة وقطع الغيار",
  "phone": "SIM and eSIM options,خيارات شرائح الاتصال;software support,دعم تحديثات النظام;water protection limits,حدود مقاومة الماء",
  "gaming-laptop": "GPU power modes,أوضاع طاقة الرسوميات;fan cleaning access,تنظيف المراوح;external display support,الشاشات الخارجية",
  "monitor": "colour work accuracy,دقة الألوان للعمل;VESA arm support,توافق حامل الشاشة;refresh rate choices,اختيار معدل التحديث",
  "printer": "double sided printing,الطباعة على وجهين;toner cartridge yields,عمر خرطوشة الحبر;phone printing apps,تطبيقات طباعة الهاتف",
  "ssd": "backup encryption,تشفير النسخ الاحتياطي;shock protection,مقاومة الصدمات;USB host support,توافق منافذ الكمبيوتر",
  "router": "guest network setup,إعداد شبكة الضيوف;firmware update options,خيارات تحديث النظام;parent access controls,ضبط استخدام الأطفال",
  "mesh": "thick wall coverage,التغطية خلف الجدران;roaming between nodes,التنقل بين الوحدات;Ethernet device ports,منافذ الشبكة السلكية",
  "earbuds": "ear tip replacements,تبديل أطراف السماعة;water resistance use,الاستخدام مع الرطوبة;single ear operation,تشغيل سماعة واحدة",
  "headphones": "microphone quality,جودة الميكروفون;ear pad replacements,تبديل وسائد الأذن;device multipoint pairing,الاتصال بعدة أجهزة",
  "soundbar": "night listening modes,وضع الاستماع الليلي;subwoofer placement,موضع مضخم الجهير;TV remote compatibility,توافق ريموت التلفزيون",
  "smartwatch": "wrist size and straps,المقاس وأحزمة الساعة;offline GPS tracking,تتبع الموقع دون اتصال;health sensor limits,حدود مستشعرات الصحة",
  "fitness-band": "waterproof ratings,تصنيفات مقاومة الماء;phone notification setup,تنبيهات الهاتف;replacement strap sizes,مقاسات الأحزمة البديلة",
  "powerbank": "airline carry rules,قواعد حمل الطائرة;USB cable output,خرج كابل الشحن;charging many devices,شحن أجهزة متعددة",
  "gan-charger": "heat during charging,الحرارة أثناء الشحن;socket travel adapters,محولات مقابس السفر;PPS charging support,دعم معيار الشحن",
  "usb-dock": "Mac Windows support,توافق أنظمة التشغيل;multiple screen limits,حدود الشاشات المتعددة;USB device power,قدرة منافذ USB",
  "webcam": "mounting on monitors,التثبيت على الشاشة;video autofocus,ضبط التركيز التلقائي;software privacy controls,إعدادات خصوصية البرامج",
  "keyboard": "Arabic layout choices,اختيار لوحة عربية;battery replacement,تبديل البطارية;quiet office switches,هدوء الأزرار بالمكتب",
  "gaming-mouse": "left hand grip,القبضة لليد اليسرى;software remapping,تخصيص الأزرار بالبرنامج;charging versus cells,الشحن أم البطاريات",
  "air-fryer": "food portion size,حجم الوجبات;basket material care,العناية بخامة السلة;dual zone cooking,الطهي في منطقتين",
  "blender": "crushing ice safely,طحن الثلج بأمان;small batch blending,خلط كميات صغيرة;replacement jar options,خيارات الأكواب البديلة",
  "coffee-machine": "water hardness setup,ضبط عسر المياه;first cup warmup,التسخين قبل التحضير;descaling procedures,خطوات إزالة الترسبات",
  "vacuum": "pet hair handling,تنظيف شعر الحيوانات;cordless battery swap,تبديل بطارية اللاسلكي;stair cleaning reach,تنظيف السلالم",
  "air-purifier": "particle sensor accuracy,دقة مستشعر الجسيمات;filter stock availability,توافر الفلاتر البديلة;allergy bedroom setup,إعداد غرفة النوم",
  "humidifier": "white dust prevention,منع الغبار الأبيض;night operation noise,الضوضاء في الليل;clean water requirements,متطلبات نظافة المياه",
  "microwave": "container size fit,مقاس الأوعية المناسبة;child lock setup,تفعيل قفل الأطفال;defrost control,التحكم في إذابة التجميد",
  "washer": "spin vibration levels,الاهتزاز أثناء العصر;fabric cycle choices,اختيار برامج الأقمشة;drain placement,موضع صرف المياه",
  "fridge": "door opening direction,اتجاه فتح الباب;freezer drawer access,سهولة درج الفريزر;family storage zones,تقسيم تخزين الأسرة",
  "dishwasher": "tablet detergent support,ملاءمة أقراص التنظيف;plate size clearance,استيعاب الأطباق الكبيرة;filter cleaning access,الوصول لتنظيف الفلتر",
  "hair-dryer": "curly hair diffuser,موزع الهواء للشعر المجعد;heat damage settings,إعدادات تقليل الحرارة;folding travel handle,مقبض قابل للطي",
  "shaver": "sensitive skin heads,رؤوس البشرة الحساسة;blade replacement cost,تكلفة الرؤوس البديلة;waterproof cleaning,التنظيف تحت الماء",
  "toothbrush": "brushing timer options,مؤقت تنظيف الأسنان;replacement head cost,تكلفة الرؤوس البديلة;travel case choices,اختيار علبة السفر",
  "sunscreen": "reapplication over makeup,التجديد فوق المكياج;fragrance sensitive skin,البشرة الحساسة للعطور;water resistant duration,مدة مقاومة الماء",
  "moisturizer": "layering with serums,الاستخدام مع السيروم;packaging hygiene,نظافة العبوة;winter dryness choices,اختيارات جفاف الشتاء",
  "running-shoe": "arch support feel,راحة دعم القدم;rainy pavement grip,الثبات على الأرض المبللة;heel width sizing,مقاس عرض الكعب",
  "walking-shoe": "standing all day,الوقوف طوال اليوم;removable insoles,النعل الداخلي القابل للفك;hot weather breathability,التهوية في الحر",
  "suitcase": "carry on weight,وزن حقيبة المقصورة;lock inspection options,خيارات قفل الحقيبة;expandable packing,التوسعة عند التعبئة",
  "stroller": "bus and car access,الانتقال بالسيارة;sun canopy coverage,تغطية مظلة الشمس;wheel replacement,تبديل العجلات",
  "car-seat": "rear facing limits,حدود المقعد الخلفي;vehicle belt routing,مسار حزام السيارة;child height adjustment,ضبط ارتفاع الطفل",
  "smart-camera": "local video recording,تسجيل الفيديو المحلي;cloud privacy settings,خصوصية التخزين السحابي;WiFi outage behavior,التشغيل عند قطع الشبكة",
  "smart-plug": "energy monitoring accuracy,دقة قياس الاستهلاك;power cut recovery,العودة بعد قطع الكهرباء;schedule daylight saving,الجدولة مع تغير الوقت",
  "projector": "ambient light viewing,المشاهدة مع الإضاءة;screen keystone setup,ضبط استقامة الصورة;portable carry weight,الوزن للتنقل",
  "controller": "stick drift repair,صيانة انحراف العصا;PC connectivity modes,طرق توصيل الكمبيوتر;child hand grip,القبضة للأيدي الصغيرة",
  "speaker": "stereo pairing support,الاقتران بنظام ستيريو;USB playback options,تشغيل ملفات USB;sand and dust use,الاستخدام مع الغبار",
  "baby-bottle": "anti colic valve care,العناية بصمام المغص;sterilizer compatibility,توافق جهاز التعقيم;feeding volume marks,علامات قياس الرضعة",
  "food-processor": "dough mixing capability,قدرة خلط العجين;replacement blade care,العناية بالشفرات;small kitchen storage,التخزين بالمطابخ الصغيرة",
  "pressure-cooker": "steam safety valves,صمامات أمان البخار;slow cooking options,خيارات الطبخ البطيء;replacement sealing rings,حلقات الإغلاق البديلة",
  "cookware": "induction hob suitability,ملاءمة الموقد الحثي;oven temperature rating,حدود حرارة الفرن;stacking storage,التخزين بالتكديس",
  "kettle": "water level visibility,وضوح مستوى الماء;automatic shutoff,الفصل التلقائي;hard water cleaning,تنظيف آثار الأملاح",
  "television": "HDR format support,توافق صيغ HDR;viewing angle limits,حدود زاوية المشاهدة;wall mount clearance,مساحة التثبيت بالحائط",
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,room)=>{let s=String(value).trim();while(s.length>room&&s.includes(' '))s=s.slice(0,s.lastIndexOf(' '));return s.length<=room?s:''};
const suffix={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const newEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const extra=scenarios[family];
 if(!extra)throw Error('MISSING_CURATED_PRODUCT_SCENARIOS_'+family);
 const products=brands.split(';').map(x=>x.split(','));
 const angles=extra.split(';').map(x=>x.split(','));
 return products.flatMap(([enBrand,arBrand])=>angles.flatMap(([enFocus,arFocus],index)=>['SA','AE'].flatMap(country=>{
  const english=country==='AE',brand=english?enBrand:arBrand,category=english?enCategory:arCategory;
  const focus=english?enFocus:arFocus,front=brand+' '+category+': ',tail=suffix[country];
  const fit=shorten(focus,72-front.length-tail.length);
  if(!fit)return [];
  const title=front+fit+tail;
  if(title.length<28||title.length>72)return [];
  const coupon=english?'NOV188':'NOV170';
  const id=slug(enBrand)+'-'+family+'-'+slug(enFocus);
  const topic={country,language:english?'en-AE':'ar-SA',brand,category,topic:title,coupon,
   slug:(english?'uae':'saudi')+'-buyer-'+id+'-'+coupon.toLowerCase()+'-2026-n2',
   queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n2-'+slug(enFocus),comparisonKey:'editorial-n2-'+family+'-'+index,
   sections:english?[
    category+': matching '+fit+' with buyer needs and setup constraints',
    'Compare '+enBrand+' listing specifications and alternatives for '+enFocus,
    'Verify Noon UAE seller, warranty, delivery, return terms and '+coupon+' eligibility',
    'Practical checks for '+fit+' including accessories and compatibility',
    'Final decision table, avoidable pitfalls and clear questions before checkout'
   ]:[
    category+' حسب '+fit+' قبل قرار الشراء',
    'مقارنة مواصفات موديلات '+arBrand+' والبائع والملحقات المتعلقة بالاستخدام',
    'فحص الضمان والشحن والإرجاع وأهلية الكود '+coupon+' على نون السعودية',
    'خطوات تقييم '+fit+' والقيود العملية للمشتري',
    'جدول المفاضلة والتكلفة النهائية والأسئلة المهمة قبل الدفع'
   ]};
  return [topic];
 })));
}));
export const newEditorialWaveVersion='human-curated-checkout-scenarios-n2';
