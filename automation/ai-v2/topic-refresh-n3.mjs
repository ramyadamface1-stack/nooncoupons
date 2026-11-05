// Wave N3: curated, differentiated buyer-intent concerns for already validated
// product families. Append-only. Never alters existing checkpoint identities,
// titles, URLs or native 95+ quality gate; no automatic coupon claims.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const scenarios=Object.freeze({
  "tablet":"handwriting latency,تأخر الكتابة بالقلم;split screen study,تقسيم الشاشة للدراسة;offline textbook reading,قراءة الكتب دون اتصال",
  "laptop":"BIOS upgrade options,خيارات تحديث النظام;USB power delivery,دعم الشحن عبر USB;repairable storage,إمكانية تغيير التخزين",
  "phone":"display repair costs,تكلفة إصلاح الشاشة;network band coverage,توافق ترددات الشبكة;secure unlock choices,خيارات فتح الهاتف",
  "gaming-laptop":"VR headset readiness,جاهزية نظارات الواقع;thermal paste service,صيانة المعجون الحراري;quiet study profiles,الهدوء وقت الدراسة",
  "monitor":"pixel defect policy,سياسة عيوب البكسل;USB C video support,دعم فيديو USB C;portrait rotation,التدوير العمودي للشاشة",
  "printer":"scanner document feeder,ملقم مستندات الماسح;home network sharing,المشاركة على الشبكة;photo paper support,دعم ورق الصور",
  "ssd":"filesystem portability,توافق أنظمة الملفات;heat during transfers,الحرارة أثناء النقل;backup verification,التحقق من النسخ",
  "router":"VPN connection options,خيارات اتصال VPN;router placement height,ارتفاع موضع الراوتر;fiber modem pairing,التوصيل بمودم الألياف",
  "mesh":"backhaul speed choices,اختيار سرعة الربط;apartment interference,التداخل داخل الشقق;multi floor placement,التوزيع بين الطوابق",
  "earbuds":"latency for gaming,التأخير أثناء اللعب;Bluetooth codec support,دعم ترميزات البلوتوث;case pocket comfort,راحة حمل العلبة",
  "headphones":"headband adjustment,ضبط عصابة الرأس;wired audio quality,جودة الصوت السلكي;long flight comfort,الراحة في الرحلات",
  "soundbar":"eARC device support,دعم توصيل eARC;speech accessibility,وضوح الحوار للمستخدم;wall mounting clearance,مساحة التثبيت بالحائط",
  "smartwatch":"offline music storage,تخزين الموسيقى دون اتصال;charging dock options,خيارات قاعدة الشحن;swim tracking limits,حدود تتبع السباحة",
  "fitness-band":"step count accuracy,دقة حساب الخطوات;brightness outdoors,وضوح الشاشة بالخارج;charging cable fit,توافق كابل الشحن",
  "powerbank":"battery health indicator,مؤشر سلامة البطارية;laptop charging watts,قدرة شحن اللابتوب;recharge time planning,تخطيط مدة إعادة الشحن",
  "gan-charger":"desktop cable length,طول الكابل للمكتب;power sharing ports,تقاسم القدرة بالمنافذ;folding plug strength,متانة القابس القابل للطي",
  "usb-dock":"Ethernet port stability,ثبات منفذ الشبكة;SD card read speed,سرعة قراءة بطاقة الذاكرة;display refresh limits,حدود تحديث الشاشة",
  "webcam":"camera field of view,زاوية تصوير الكاميرا;background light handling,توازن ضوء الخلفية;tripod mount threads,توافق حامل الكاميرا",
  "keyboard":"keycap replacement,استبدال أغطية الأزرار;multi device pairing,التوصيل بأجهزة متعددة;spill resistance care,العناية بعد السوائل",
  "gaming-mouse":"polling rate options,اختيار معدل الاستجابة;mouse pad surfaces,ملاءمة سطح الماوس;travel wireless receiver,حفظ مستقبل الاتصال",
  "air-fryer":"frozen food settings,إعدادات الطعام المجمد;preheat consistency,ثبات التسخين المسبق;smoke reduction,تقليل الدخان",
  "blender":"hot liquid safety,سلامة السوائل الساخنة;noise in apartments,الضوضاء داخل الشقة;dishwasher safe parts,الأجزاء المناسبة للغسالة",
  "coffee-machine":"espresso pressure control,التحكم بضغط القهوة;bean grinder pairing,توافق مطحنة البن;drip tray capacity,سعة صينية التنقيط",
  "vacuum":"under furniture height,الوصول تحت الأثاث;dustbin emptying,سهولة تفريغ الحاوية;floor brush tangles,تشابك فرشاة الأرضية",
  "air-purifier":"airflow placement,موضع تدفق الهواء;energy use overnight,استهلاك الكهرباء ليلا;filter grade comparisons,مقارنة فئات الفلاتر",
  "humidifier":"auto shutoff reliability,ثبات الفصل التلقائي;humidistat accuracy,دقة حساس الرطوبة;refilling tank access,سهولة تعبئة الخزان",
  "microwave":"turntable dimensions,أبعاد الطبق الدوار;steam cooking accessories,ملحقات الطبخ بالبخار;ventilation clearance,مساحة تهوية الجهاز",
  "washer":"door hinge clearance,مساحة فتح باب الغسالة;quick wash use,اختيار الغسيل السريع;water pressure needs,متطلبات ضغط المياه",
  "fridge":"compressor sound levels,مستوى صوت الضاغط;vegetable humidity drawer,درج رطوبة الخضار;ice maker upkeep,صيانة موزع الثلج",
  "dishwasher":"cutlery basket layout,ترتيب سلة الملاعق;drying plastic containers,تجفيف العبوات البلاستيكية;hard water settings,إعدادات المياه العسرة",
  "hair-dryer":"cool shot effectiveness,فاعلية الهواء البارد;cord swivel comfort,راحة دوران السلك;filter cleaning access,سهولة تنظيف الفلتر",
  "shaver":"travel lock design,تصميم قفل السفر;foil versus rotary,مقارنة الرؤوس الدوارة;charging station needs,احتياج قاعدة الشحن",
  "toothbrush":"brush pressure feedback,تنبيهات ضغط الفرشاة;charging stand hygiene,نظافة قاعدة الشحن;shared handle options,استخدام المقبض بين أفراد",
  "sunscreen":"face versus body texture,ملمس الوجه والجسم;white cast appearance,مظهر الأثر الأبيض;daily commute use,الاستخدام في التنقل",
  "moisturizer":"oily skin finish,الملمس للبشرة الدهنية;pump bottle durability,متانة عبوة المضخة;travel container size,حجم العبوة للسفر",
  "running-shoe":"toe box room,مساحة الأصابع بالحذاء;long distance support,الدعم للمسافات الطويلة;shoe sole wear,مراقبة تآكل النعل",
  "walking-shoe":"slip resistant tread,ثبات النعل ضد الانزلاق;city pavement comfort,راحة السير بالمدينة;easy on design,سهولة ارتداء الحذاء",
  "suitcase":"handle extension height,ارتفاع مقبض الحقيبة;fragile item packing,تغليف الأدوات الحساسة;wheel repair options,خيارات إصلاح العجلات",
  "stroller":"rain cover fit,توافق غطاء المطر;seat recline angles,زوايا إمالة المقعد;washing fabric covers,غسل أغطية القماش",
  "car-seat":"side impact features,خصائص الحماية الجانبية;removable washable cover,الغطاء القابل للغسل;ISOFIX compatibility,توافق نظام التثبيت",
  "smart-camera":"motion zone setup,ضبط مناطق الحركة;two way audio clarity,وضوح الصوت ثنائي الاتجاه;power backup planning,التشغيل ببطارية احتياطية",
  "smart-plug":"maximum motor loads,حدود أحمال المحركات;smart home pairing,الربط بالمنزل الذكي;physical power button,زر التشغيل اليدوي",
  "projector":"focus edge sharpness,وضوح أطراف الصورة;fan noise in bedroom,صوت المروحة في الغرفة;streaming input choice,اختيار مدخل البث",
  "controller":"button replacement ease,سهولة تغيير الأزرار;wired input lag,تأخير الاتصال السلكي;tablet gaming support,التوافق مع ألعاب التابلت",
  "speaker":"party volume distortion,تشوه الصوت المرتفع;charging port seals,إحكام منفذ الشحن;voice assistant support,دعم المساعد الصوتي",
  "baby-bottle":"nipple flow stages,درجات تدفق الحلمة;wide neck cleaning,تنظيف الفوهة الواسعة;dishwasher wash limits,حدود غسل الزجاجة",
  "food-processor":"pulse control accuracy,دقة التحكم المتقطع;spare bowl availability,توافر الوعاء البديل;safe lid interlock,قفل أمان الغطاء",
  "pressure-cooker":"pot coating choices,اختيارات طلاء القدر;recipe timer accuracy,دقة مؤقت الطبخ;capacity for family,السعة المناسبة للأسرة",
  "cookware":"nonstick utensil care,حماية السطح من الأدوات;glass lid replacement,تغيير الغطاء الزجاجي;even heat distribution,توزيع الحرارة بالتساوي",
  "kettle":"pour spout control,التحكم أثناء السكب;cool touch handle,عزل حرارة المقبض;filter scale removal,تنظيف فلتر الأملاح",
  "television":"motion sports handling,سلاسة مشاهد الرياضة;upscaling older video,تحسين جودة الفيديو القديم;remote voice input,البحث الصوتي بالريموت",
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,room)=>{let text=String(value).trim();while(text.length>room&&text.includes(' '))text=text.slice(0,text.lastIndexOf(' '));return text.length<=room?text:''};
const suffix={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const thirdEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const angles=scenarios[family];
 if(!angles)throw Error('MISSING_CURATED_N3_FAMILY_'+family);
 const products=brands.split(';').map(x=>x.split(','));
 return products.flatMap(([enBrand,arBrand])=>angles.split(';').flatMap((value,angle)=>{
  const [enFocus,arFocus]=value.split(',');
  return ['SA','AE'].flatMap(country=>{
   const english=country==='AE',brand=english?enBrand:arBrand,category=english?enCategory:arCategory;
   const focus=english?enFocus:arFocus,front=brand+' '+category+': ',tail=suffix[country];
   const fit=shorten(focus,72-front.length-tail.length);
   if(!fit)return [];
   const title=front+fit+tail;
   if(title.length<28||title.length>72)return [];
   const coupon=english?'NOV188':'NOV170';
   const id=slug(enBrand)+'-'+family+'-'+slug(enFocus);
   return [{country,language:english?'en-AE':'ar-SA',brand,category,topic:title,coupon,
    slug:(english?'uae':'saudi')+'-buyer-'+id+'-'+coupon.toLowerCase()+'-2026-n3',
    queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n3-'+slug(enFocus),
    comparisonKey:'editorial-n3-'+family+'-'+angle,
    sections:english?[
     category+': assessing '+fit+' for everyday buyer use',
     'Check '+enBrand+' specification variations against the '+enFocus+' requirement',
     'Check Noon UAE listing seller, return conditions, delivery and '+coupon+' eligibility',
     'Compare practical alternatives, accessories and the limits of '+fit,
     'Decision checklist, actual checkout totals and common questions'
    ]:[
     category+' حسب '+fit+' والتوافق قبل الشراء',
     'مقارنة موديلات '+arBrand+' ومواصفاتها واعتبارات الاستخدام الحقيقي',
     'التحقق من بائع نون السعودية والضمان والإرجاع والشحن وأهلية '+coupon,
     'مقارنة البدائل والملحقات وحدود '+fit+' دون وعود غير موثقة',
     'قائمة قرار الشراء والتكلفة النهائية والأسئلة الشائعة'
    ]}];
  });
 }));
}));
export const thirdEditorialWaveVersion='distinct-shopping-criteria-n3-2026-11';
