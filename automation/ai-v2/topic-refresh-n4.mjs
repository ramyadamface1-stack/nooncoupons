// Wave N4: curated, differentiated buyer-intent concerns for already validated
// product families. Append-only. Never alters existing checkpoint identities,
// titles, URLs or native 95+ quality gate; no automatic coupon claims.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const scenarios=Object.freeze({
  "tablet":"lecture recording workflow,تسجيل المحاضرات;stylus nib replacements,استبدال سن القلم;family profile switching,التبديل بين حسابات الأسرة;USB file transfers,نقل الملفات عبر USB;second screen compatibility,التوافق مع شاشة ثانية",
  "laptop":"dual display support,دعم شاشتين خارجيتين;battery cycle health,حالة دورات البطارية;sleep mode drain,استهلاك وضع السكون;keyboard repair access,سهولة إصلاح لوحة المفاتيح;Linux driver compatibility,توافق تعريفات لينكس",
  "phone":"camera shutter response,سرعة استجابة الكاميرا;international roaming setup,تجهيز التجوال الدولي;USB data transfer,نقل البيانات بالسلك;screen viewing angles,زوايا رؤية الشاشة;service center coverage,تغطية مراكز الصيانة",
  "gaming-laptop":"power brick travel size,حجم الشاحن في السفر;GPU frame pacing,ثبات الإطارات في الألعاب;Ethernet gaming stability,ثبات اللعب عبر الشبكة;GPU memory planning,اختيار ذاكرة الرسوميات;fan control software,برنامج التحكم بالمراوح",
  "monitor":"text scaling clarity,وضوح الخطوط مع التكبير;KVM switching support,التبديل بين جهازين;HDR office lighting,توازن HDR مع ضوء المكتب;editing color profiles,ملفات الألوان للتحرير;desk cable management,تنظيم كابلات المكتب",
  "printer":"envelope feeding support,دعم طباعة الأظرف;print head cleaning,تنظيف رأس الطباعة;scanning small receipts,مسح الإيصالات الصغيرة;ink tank refill care,العناية بتعبئة الحبر;wireless guest printing,الطباعة اللاسلكية للضيوف",
  "ssd":"USB enclosure fit,توافق علبة التخزين الخارجية;drive health monitoring,مراقبة حالة القرص;scheduled backup setup,إعداد النسخ الاحتياطي الدوري;large video transfer speed,سرعة نقل الفيديوهات الكبيرة;formatted capacity difference,الفرق في السعة بعد التهيئة",
  "router":"guest network separation,عزل شبكة الضيوف;WiFi schedules for kids,جداول الإنترنت للأطفال;IPv6 provider support,دعم IPv6 من المزود;security update schedule,جدولة تحديثات الأمان;remote login protection,حماية الدخول عن بعد",
  "mesh":"Ethernet node connection,توصيل الوحدات بالسلك;video call roaming,التنقل أثناء مكالمات الفيديو;guest network sharing,مشاركة شبكة الضيوف;thick wall coverage,التغطية عبر الجدران السميكة;app network diagnostics,تشخيص الشبكة بالتطبيق",
  "earbuds":"multipoint device switching,التبديل بين جهازين;wind noise microphones,الميكروفون في الهواء;single earbud use,استخدام سماعة واحدة;charge contact cleaning,تنظيف نقاط الشحن;ear tip seal fit,ملاءمة أطراف الأذن",
  "headphones":"video call latency,التأخير في مكالمات الفيديو;ear pad replacement,تغيير وسائد الأذن;boom microphone options,خيارات الميكروفون;safe volume settings,إعدادات مستوى الصوت;folding hinge durability,متانة مفصل الطي",
  "soundbar":"dialog lip sync,مزامنة حركة الشفاه;subwoofer night volume,صوت الجهير ليلا;TV remote setup,إعداد ريموت التلفزيون;surround mode differences,مقارنة أوضاع الصوت المحيطي;night listening controls,ضبط الاستماع الليلي",
  "smartwatch":"offline GPS routes,مسارات GPS دون اتصال;wrist call microphone,ميكروفون المكالمات;strap replacement ease,سهولة تغيير السوار;notification privacy,خصوصية الإشعارات;battery drain tracking,مراقبة استهلاك البطارية",
  "fitness-band":"strap skin comfort,راحة السوار على الجلد;automatic activity detection,التعرف التلقائي على النشاط;sleep report readability,وضوح تقارير النوم;water screen lock,قفل الشاشة في الماء;charging indicator clarity,وضوح مؤشر الشحن",
  "powerbank":"airline carry on limits,حدود حمل البطارية بالطائرة;cable charging losses,فاقد الطاقة في الكابل;USB port sharing,توزيع الشحن على المنافذ;usable capacity checks,فحص السعة القابلة للاستخدام;small device low current,شحن الأجهزة الصغيرة",
  "gan-charger":"travel outlet adapters,محولات القابس أثناء السفر;cable power ratings,قدرة الكابلات الكهربائية;heat with full ports,الحرارة مع المنافذ الممتلئة;low power device charging,شحن الأجهزة منخفضة القدرة;socket fit and weight,ثبات الشاحن في المقبس",
  "usb-dock":"driver installation steps,خطوات تثبيت التعريفات;USB device sharing,مشاركة أجهزة USB;external SSD bottlenecks,اختناق سرعة التخزين الخارجي;power supply needs,متطلبات مصدر الطاقة;monitor cable pairing,اختيار كابل الشاشة",
  "webcam":"low light image noise,تشويش الصورة بالإضاءة الضعيفة;privacy shutter fit,ملاءمة غالق الخصوصية;monitor mount stability,ثبات حامل الشاشة;manual exposure control,التحكم اليدوي بالتعريض;USB hub connection,التوصيل عبر موزع USB",
  "keyboard":"silent key travel,هدوء حركة المفاتيح;typing wrist posture,وضع الرسغ أثناء الكتابة;Arabic key labels,الحروف العربية على الأزرار;battery sleep behavior,السكون للحفاظ على البطارية;shortcut key remapping,إعادة تعيين اختصارات الأزرار",
  "gaming-mouse":"sensor lift off distance,مسافة توقف حساس الماوس;wireless signal stability,ثبات الاتصال اللاسلكي;replaceable mouse feet,استبدال قواعد الماوس;left hand grip fit,الراحة لليد اليسرى;side button assignments,تخصيص الأزرار الجانبية",
  "air-fryer":"batch cooking spacing,المسافات بين قطع الطعام;odor after cooking,الروائح بعد الطهي;heating element cleaning,تنظيف عنصر التسخين;oil mist prevention,تقليل رذاذ الزيت;basket size per meal,سعة السلة لكل وجبة",
  "blender":"repeated ice crushing,تكرار طحن الثلج;blade seal replacement,استبدال مانع تسرب الشفرة;pulse timing precision,دقة توقيت الخلط المتقطع;pour spout accuracy,الدقة عند سكب العصير;small batch blending,خلط الكميات الصغيرة",
  "coffee-machine":"milk frother hygiene,تنظيف رغوة الحليب;water hardness setting,إعداد عسر الماء;brew temperature control,التحكم بحرارة التحضير;cup height clearance,مساحة الأكواب الطويلة;descaling reminders,تنبيهات إزالة التكلس",
  "vacuum":"thick carpet handling,التعامل مع السجاد السميك;stair carry comfort,سهولة حمل المكنسة للسلم;filter replacement costs,تكلفة تغيير الفلاتر;charger wall mounting,تثبيت قاعدة الشحن;dust emptying hygiene,نظافة تفريغ الغبار",
  "air-purifier":"room air change rate,معدل تغيير هواء الغرفة;particle sensor response,استجابة حساس الجسيمات;sleep mode display light,إضاءة الشاشة أثناء النوم;ozone free operation,التشغيل بدون أوزون;filter size availability,توافر أحجام الفلاتر",
  "humidifier":"target humidity settings,إعداد نسبة الرطوبة;water leak prevention,منع تسريب الماء;floor placement safety,اختيار موضع الجهاز;overnight shutoff,الإيقاف خلال الليل;mineral residue cleaning,تنظيف ترسبات المعادن",
  "microwave":"defrost texture quality,جودة إذابة الطعام المجمد;clock visibility at night,وضوح الساعة ليلا;child lock controls,التحكم بقفل الأطفال;small kitchen clearance,مساحة المطبخ الصغيرة;food cover cleaning,تنظيف غطاء الطعام",
  "washer":"tile floor vibration,الاهتزاز على البلاط;extra rinse performance,فعالية الشطف الإضافي;detergent drawer access,الوصول لدرج المنظف;unbalanced load warning,تنبيه الحمولة غير المتوازنة;smart alerts privacy,خصوصية تنبيهات التطبيق",
  "fridge":"door opening radius,مساحة فتح الأبواب;power outage protection,حفظ البرودة عند انقطاع الكهرباء;freezer drawer reach,سهولة الوصول لأدراج الفريزر;door seal maintenance,صيانة حشوة الباب;adjustable shelf height,تعديل ارتفاع الأرفف",
  "dishwasher":"quiet cycle use,برنامج الغسيل الهادئ;counter clearance fit,التوافق مع مساحة المطبخ;detergent pod placement,موضع كبسولات المنظف;salt tank refilling,تعبئة خزان الملح;eco program duration,مدة البرنامج الاقتصادي",
  "hair-dryer":"curly diffuser fit,توافق موزع الهواء للتجعيد;heat sensor behavior,استجابة حساس الحرارة;travel voltage options,خيارات الجهد عند السفر;weight for long use,وزن الجهاز مع الاستخدام الطويل;precision styling nozzle,فوهة التصفيف الدقيقة",
  "shaver":"sensitive skin settings,إعدادات البشرة الحساسة;wet use cleaning,التنظيف بعد الحلاقة بالماء;replacement blade timing,توقيت تغيير الشفرات;neck contour comfort,راحة الحلاقة حول الرقبة;battery reserve indicator,مؤشر شحن البطارية",
  "toothbrush":"travel cap hygiene,نظافة غطاء السفر;quadrant timer prompts,تنبيه توقيت مناطق الفم;brush head reminders,تنبيه استبدال الرأس;gentle gum settings,إعدادات اللثة الحساسة;wet grip handling,القبضة أثناء البلل",
  "sunscreen":"makeup layering comfort,الراحة تحت المكياج;eye area sensitivity,الملاءمة حول العين;outdoor reapplication,إعادة الاستخدام بالخارج;water exposure labeling,ملصق مقاومة الماء;pump packaging leaks,تسرب عبوة المضخة",
  "moisturizer":"fragrance sensitivity,الحساسية من الروائح;under sunscreen layering,التوافق تحت واقي الشمس;daytime lightweight finish,الملمس الخفيف نهارا;humid weather feel,الملمس في الطقس الرطب;tub or pump hygiene,نظافة العبوة والغطاء",
  "running-shoe":"heel lockdown fit,ثبات كعب القدم;rainy road grip,الثبات على الطريق المبلل;arch support options,خيارات دعم القوس;race day sock fit,توافق جوارب السباق;outsole debris wear,تآكل النعل مع الحصى",
  "walking-shoe":"wide toe sizing,المقاسات للأقدام العريضة;airport walking comfort,الراحة بالمطارات;hot pavement airflow,التهوية أثناء الحر;flat arch support,دعم قوس القدم المنخفض;wet tile traction,الثبات على البلاط المبلل",
  "suitcase":"overhead cabin fit,التوافق مع خزانة الطائرة;expander zipper strength,متانة سحاب التوسيع;combination lock reset,إعادة ضبط قفل الأرقام;shell crack resistance,مقاومة تشققات الهيكل;name tag privacy,خصوصية بطاقة الاسم",
  "stroller":"bus folding speed,سرعة الطي في الحافلة;car trunk fit,الملاءمة في صندوق السيارة;summer canopy shade,ظل المظلة صيفا;wheel lock access,سهولة الوصول لقفل العجلات;one hand steering,التحكم بيد واحدة",
  "car-seat":"rear belt routing,مسار حزام الأمان الخلفي;headrest height range,مدى ضبط مسند الرأس;summer ventilation,التهوية في الرحلات الصيفية;recline angle display,وضوح مؤشر زاوية الميل;infant insert sizing,حجم الوسادة الداخلية",
  "smart-camera":"cloud video privacy,خصوصية التخزين السحابي;pet motion filtering,تمييز حركة الحيوانات;local card overwrite,إعادة تسجيل بطاقة الذاكرة;night IR reflections,انعكاسات الأشعة الليلية;offline WiFi behavior,التصرف عند انقطاع الشبكة",
  "smart-plug":"scheduled switch reliability,ثبات إيقاف التشغيل المجدول;energy meter precision,دقة قياس استهلاك الكهرباء;heater load limits,حدود أحمال السخان;offline manual control,التحكم اليدوي دون اتصال;smart assistant pairing,الربط بالمساعد الذكي",
  "projector":"daytime curtain planning,الستائر للعرض نهارا;keystone edge softness,نعومة أطراف الصورة;throw ratio matching,توافق مسافة الإسقاط;HDMI sound routing,توصيل الصوت عبر HDMI;ceiling cable routing,توصيل الكابلات بالسقف",
  "controller":"trigger travel accuracy,دقة حركة أزرار التحكم;replaceable thumbsticks,استبدال عصا التحكم;PC mapping options,خيارات تخصيص الكمبيوتر;split screen pairing,التوصيل للعب على شاشة مشتركة;vibration intensity,مستوى قوة الاهتزاز",
  "speaker":"outdoor dust protection,الحماية من الغبار بالخارج;podcast speech clarity,وضوح صوت البودكاست;multi speaker pairing,ربط سماعتين;USB file playback,تشغيل ملفات USB;low battery alerts,تنبيهات انخفاض البطارية",
  "baby-bottle":"sterilizer compatibility,توافق جهاز التعقيم;travel leak resistance,مقاومة التسرب أثناء السفر;formula level markings,وضوح علامات الحليب;parent hand grip,سهولة الإمساك للوالدين;air vent reassembly,إعادة تركيب صمام التهوية",
  "food-processor":"dough kneading workload,قدرة عجن العجين;blade storage safety,سلامة تخزين الشفرات;grating disc sizes,أحجام أقراص البشر;small bowl blending,الخلط في الوعاء الصغير;motor overload reset,إعادة ضبط حمل المحرك",
  "pressure-cooker":"pressure release noise,صوت خروج الضغط;replacement gasket fit,توافق حلقة الإحكام;counter heat clearance,مساحة الحرارة على السطح;bean cooking settings,إعدادات طبخ البقوليات;steam basket volume,سعة سلة البخار",
  "cookware":"induction base flatness,استواء القاعدة للحث;oven safe handles,المقابض الآمنة داخل الفرن;saucepan pouring edge,سهولة سكب الصلصة;steel color marks,علامات تغير لون الستانلس;stackable pan storage,تخزين المقالي فوق بعضها",
  "kettle":"minimum water fill,الحد الأدنى لملء الماء;scale filter visibility,وضوح فلتر الأملاح;shutoff delay,تأخر الفصل التلقائي;base cord storage,تخزين سلك القاعدة;lid opening grip,سهولة فتح الغطاء",
  "television":"HDMI socket access,سهولة الوصول لمنافذ HDMI;subtitle font readability,وضوح خط الترجمة;tracking privacy controls,ضوابط الخصوصية الذكية;sunny room reflections,انعكاسات غرفة مضيئة;remote charging options,خيارات شحن الريموت",
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,room)=>{let text=String(value).trim();while(text.length>room&&text.includes(' '))text=text.slice(0,text.lastIndexOf(' '));return text.length<=room?text:''};
const suffix={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const fourthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const angles=scenarios[family];
 if(!angles)throw Error('MISSING_CURATED_N4_FAMILY_'+family);
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
    slug:(english?'uae':'saudi')+'-buyer-'+id+'-'+coupon.toLowerCase()+'-2026-n4',
    queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n4-'+slug(enFocus),
    comparisonKey:'editorial-n4-'+family+'-'+angle,
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
export const fourthEditorialWaveVersion='distinct-shopping-criteria-n4-2026-11';
