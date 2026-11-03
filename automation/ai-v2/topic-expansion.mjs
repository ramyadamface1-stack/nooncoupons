// Stable, manually selected commercial product families with differentiated buyer questions.
// This is ONLY a topic queue, never generated articles or a bypass of the 95+ native audit.
// Each topic is checked against the public URL and private R2 checkpoint before use.
const rows=[
 [
  "tablet",
  "Tablets",
  "تابلت",
  "Samsung,سامسونج;Lenovo,لينوفو;Apple,أبل",
  "school notes,المذاكرة والتدوين;pen and screen,الشاشة والقلم;travel battery,البطارية والتنقل"
 ],
 [
  "laptop",
  "Laptops",
  "لابتوبات",
  "Dell,ديل;Lenovo,لينوفو;HP,إتش بي",
  "study battery,البطارية للدراسة;ports and docks,المنافذ والملحقات;memory upgrades,الذاكرة والترقية"
 ],
 [
  "phone",
  "Smartphones",
  "هواتف ذكية",
  "Samsung,سامسونج;Xiaomi,شاومي;Honor,هونر",
  "camera storage,الكاميرا والتخزين;screen brightness,سطوع الشاشة;charging and heat,الشحن والحرارة"
 ],
 [
  "gaming-laptop",
  "Gaming laptops",
  "لابتوبات ألعاب",
  "ASUS,أسوس;Acer,أيسر;MSI,إم إس آي",
  "cooling and noise,التبريد والضوضاء;screen response,استجابة الشاشة;ports and upgrades,المنافذ والترقية"
 ],
 [
  "monitor",
  "Monitors",
  "شاشات كمبيوتر",
  "LG,إل جي;Dell,ديل;Samsung,سامسونج",
  "home office size,حجم مكتب العمل;eye comfort,راحة العين;connections and stand,المنافذ والحامل"
 ],
 [
  "printer",
  "Office printers",
  "طابعات مكتبية",
  "HP,إتش بي;Canon,كانون;Brother,براذر",
  "ink running costs,تكلفة الحبر;wireless setup,الإعداد اللاسلكي;paper handling,مقاسات الورق"
 ],
 [
  "ssd",
  "Portable SSDs",
  "أقراص SSD",
  "Samsung,سامسونج;SanDisk,سانديسك;WD,ويسترن ديجيتال",
  "backup capacity,سعة النسخ الاحتياطي;cable compatibility,توافق الكابل;transfer speeds,سرعة نقل الملفات"
 ],
 [
  "router",
  "WiFi routers",
  "راوتر واي فاي",
  "TP-Link,تي بي لينك;ASUS,أسوس;Netgear,نتجير",
  "coverage and walls,التغطية والجدران;device capacity,عدد الأجهزة;security settings,إعدادات الأمان"
 ],
 [
  "mesh",
  "Mesh WiFi",
  "شبكات واي فاي",
  "TP-Link,تي بي لينك;ASUS,أسوس;Mercusys,ميركوسيس",
  "multiroom coverage,تغطية الغرف;node placement,أماكن الوحدات;backhaul wiring,التوصيل السلكي"
 ],
 [
  "earbuds",
  "Wireless earbuds",
  "سماعات لاسلكية",
  "Sony,سوني;JBL,جي بي إل;Anker,أنكر",
  "call microphones,ميكروفون المكالمات;fit and comfort,الثبات والراحة;charging case,علبة الشحن"
 ],
 [
  "headphones",
  "Headphones",
  "سماعات رأس",
  "Bose,بوز;Sony,سوني;JBL,جي بي إل",
  "noise cancellation,عزل الضوضاء;longwear comfort,الراحة الطويلة;cable and wireless,السلكي واللاسلكي"
 ],
 [
  "soundbar",
  "Soundbars",
  "مكبرات تلفزيون",
  "Sony,سوني;Samsung,سامسونج;LG,إل جي",
  "dialogue clarity,وضوح الحوار;HDMI ARC setup,توصيل HDMI;room placement,التوزيع بالغرفة"
 ],
 [
  "smartwatch",
  "Smart watches",
  "ساعات ذكية",
  "Garmin,جارمن;Huawei,هواوي;Samsung,سامسونج",
  "phone compatibility,توافق الهاتف;activity tracking,تتبع النشاط;battery and charging,البطارية والشحن"
 ],
 [
  "fitness-band",
  "Fitness bands",
  "أساور رياضية",
  "Xiaomi,شاومي;Huawei,هواوي;Fitbit,فيتبت",
  "sleep tracking,تتبع النوم;screen readability,وضوح الشاشة;strap fit,مقاس السوار"
 ],
 [
  "powerbank",
  "Power banks",
  "شواحن متنقلة",
  "Anker,أنكر;UGREEN,يوجرين;Baseus,بيسوس",
  "flight capacity,السعة للسفر;fast charging,الشحن السريع;ports and cables,المنافذ والكابلات"
 ],
 [
  "gan-charger",
  "GaN chargers",
  "شواحن سريعة",
  "Anker,أنكر;Belkin,بيلكن;UGREEN,يوجرين",
  "multiport power,قدرة المنافذ;device compatibility,توافق الأجهزة;travel plug fit,القابس والسفر"
 ],
 [
  "usb-dock",
  "USB C docks",
  "موزعات USB",
  "UGREEN,يوجرين;Belkin,بيلكن;Anker,أنكر",
  "monitor outputs,مخارج الشاشات;laptop charging,شحن اللابتوب;cable bandwidth,سرعة الكابلات"
 ],
 [
  "webcam",
  "Webcams",
  "كاميرات ويب",
  "Logitech,لوجيتك;Razer,ريزر;Anker,أنكر",
  "lowlight picture,الصورة بالإضاءة;privacy shutter,غطاء الخصوصية;meeting microphones,ميكروفون الاجتماعات"
 ],
 [
  "keyboard",
  "Keyboards",
  "لوحات مفاتيح",
  "Logitech,لوجيتك;Razer,ريزر;Corsair,كورسير",
  "switch comfort,راحة الأزرار;wireless latency,تأخير الاتصال;desk layout,توزيع الأزرار"
 ],
 [
  "gaming-mouse",
  "Gaming mice",
  "ماوس ألعاب",
  "Logitech,لوجيتك;Razer,ريزر;HyperX,هايبر إكس",
  "sensor accuracy,دقة المستشعر;grip and size,المقاس والقبضة;button mapping,تخصيص الأزرار"
 ],
 [
  "air-fryer",
  "Air fryers",
  "قلايات هوائية",
  "Ninja,نينجا;Philips,فيليبس;Tefal,تيفال",
  "basket capacity,سعة السلة;countertop space,مساحة المطبخ;cleaning and coating,التنظيف والطلاء"
 ],
 [
  "blender",
  "Blenders",
  "خلاطات مطبخ",
  "Braun,براون;Kenwood,كينوود;Moulinex,مولينكس",
  "jar capacity,سعة الإبريق;blade cleaning,تنظيف الشفرات;motor and controls,المحرك والتحكم"
 ],
 [
  "coffee-machine",
  "Coffee machines",
  "ماكينات قهوة",
  "Nespresso,نسبريسو;DeLonghi,ديلونجي;Philips,فيليبس",
  "capsule compatibility,توافق الكبسولات;milk cleaning,تنظيف الحليب;cup size setup,إعداد حجم الكوب"
 ],
 [
  "vacuum",
  "Vacuum cleaners",
  "مكانس كهربائية",
  "Dyson,دايسون;Bissell,بيسيل;Karcher,كارشر",
  "hard floors,الأرضيات الصلبة;filter upkeep,صيانة الفلتر;storage space,مساحة التخزين"
 ],
 [
  "air-purifier",
  "Air purifiers",
  "منقيات هواء",
  "Philips,فيليبس;Xiaomi,شاومي;Levoit,ليفويت",
  "room coverage,مساحة الغرفة;filter replacement,تغيير الفلتر;bedroom noise,الهدوء للنوم"
 ],
 [
  "humidifier",
  "Humidifiers",
  "مرطبات هواء",
  "Levoit,ليفويت;Xiaomi,شاومي;Beurer,بيورير",
  "tank cleaning,تنظيف الخزان;room size,مساحة الغرفة;humidity controls,التحكم بالرطوبة"
 ],
 [
  "microwave",
  "Microwaves",
  "أفران ميكروويف",
  "Samsung,سامسونج;Panasonic,باناسونيك;LG,إل جي",
  "oven dimensions,أبعاد الجهاز;power and presets,القدرة والبرامج;cleaning and vents,التنظيف والتهوية"
 ],
 [
  "washer",
  "Washing machines",
  "غسالات ملابس",
  "LG,إل جي;Samsung,سامسونج;Bosch,بوش",
  "load size,سعة الحمولة;installation clearance,مساحة التركيب;cycle selection,اختيار البرامج"
 ],
 [
  "fridge",
  "Refrigerators",
  "ثلاجات منزلية",
  "Samsung,سامسونج;LG,إل جي;Hisense,هايسنس",
  "door clearance,فتح الأبواب;storage layout,توزيع الرفوف;power efficiency,استهلاك الكهرباء"
 ],
 [
  "dishwasher",
  "Dishwashers",
  "غسالات أطباق",
  "Bosch,بوش;Beko,بيكو;LG,إل جي",
  "rack capacity,سعة الرفوف;water connection,توصيل المياه;quiet cycles,برامج هادئة"
 ],
 [
  "hair-dryer",
  "Hair dryers",
  "مجففات شعر",
  "Dyson,دايسون;Philips,فيليبس;Remington,ريمنجتون",
  "heat settings,درجات الحرارة;attachments and fit,الملحقات والتوافق;travel weight,الوزن للسفر"
 ],
 [
  "shaver",
  "Electric shavers",
  "ماكينات حلاقة",
  "Braun,براون;Philips,فيليبس;Panasonic,باناسونيك",
  "wet dry use,استخدام جاف ومبلل;cleaning heads,تنظيف الرؤوس;battery runtime,مدة البطارية"
 ],
 [
  "toothbrush",
  "Electric toothbrushes",
  "فرش أسنان كهربائية",
  "Oral-B,أورال بي;Philips,فيليبس;Xiaomi,شاومي",
  "replacement heads,الرؤوس البديلة;pressure sensing,مستشعر الضغط;travel charging,الشحن بالسفر"
 ],
 [
  "sunscreen",
  "Sunscreens",
  "واقيات شمس",
  "La Roche-Posay,لاروش بوزيه;Neutrogena,نيوتروجينا;Eucerin,يوسيرين",
  "skin type fit,ملاءمة البشرة;texture and layering,الملمس والطبقات;reapplication ease,سهولة التجديد"
 ],
 [
  "moisturizer",
  "Moisturizers",
  "مرطبات بشرة",
  "CeraVe,سيرافي;Cetaphil,سيتافيل;Neutrogena,نيوتروجينا",
  "skin sensitivity,حساسية البشرة;day night use,استخدام يومي وليلي;texture and size,الملمس والحجم"
 ],
 [
  "running-shoe",
  "Running shoes",
  "أحذية جري",
  "Adidas,أديداس;Nike,نايكي;ASICS,أسيكس",
  "foot fit,مقاس القدم;surface choice,نوع الأرضية;sole cushioning,توسيد النعل"
 ],
 [
  "walking-shoe",
  "Walking shoes",
  "أحذية مشي",
  "Skechers,سكيتشرز;New Balance,نيو بالانس;Puma,بوما",
  "daily comfort,الراحة اليومية;wide sizes,المقاسات العريضة;outsole grip,ثبات النعل"
 ],
 [
  "suitcase",
  "Travel suitcases",
  "حقائب سفر",
  "Samsonite,سامسونايت;Delsey,ديلسي;American Tourister,أمريكان توريستر",
  "cabin dimensions,مقاسات المقصورة;wheel movement,حركة العجلات;packing layout,تقسيم الأمتعة"
 ],
 [
  "stroller",
  "Baby strollers",
  "عربات أطفال",
  "Chicco,شيكو;Graco,جراكو;Joie,جوي",
  "folding space,سهولة الطي;child comfort,راحة الطفل;wheel handling,حركة العجلات"
 ],
 [
  "car-seat",
  "Child car seats",
  "مقاعد أطفال",
  "Joie,جوي;Graco,جراكو;Chicco,شيكو",
  "vehicle fit,توافق السيارة;harness adjustment,ضبط الأحزمة;seat installation,تثبيت المقعد"
 ],
 [
  "smart-camera",
  "Smart cameras",
  "كاميرات منزلية",
  "TP-Link,تي بي لينك;EZVIZ,إيزفيز;Xiaomi,شاومي",
  "privacy controls,إعدادات الخصوصية;night viewing,التصوير الليلي;storage options,خيارات التخزين"
 ],
 [
  "smart-plug",
  "Smart plugs",
  "مقابس ذكية",
  "TP-Link,تي بي لينك;Sonoff,سونوف;Meross,ميروس",
  "app compatibility,توافق التطبيق;device load,قدرة التحميل;timers and safety,المؤقتات والأمان"
 ],
 [
  "projector",
  "Projectors",
  "أجهزة عرض",
  "BenQ,بينكيو;Epson,إبسون;Anker,أنكر",
  "throw distance,مسافة العرض;screen brightness,سطوع الصورة;ports and audio,المنافذ والصوت"
 ],
 [
  "controller",
  "Game controllers",
  "أذرع ألعاب",
  "Sony,سوني;Microsoft,مايكروسوفت;8BitDo,إيت بيت دو",
  "console support,توافق الجهاز;grip and sticks,القبضة والعصي;battery and pairing,البطارية والاقتران"
 ],
 [
  "speaker",
  "Portable speakers",
  "سماعات محمولة",
  "JBL,جي بي إل;Sony,سوني;Anker,أنكر",
  "outdoor battery,البطارية بالخارج;water protection,مقاومة الماء;pairing and inputs,الاقتران والمداخل"
 ],
 [
  "baby-bottle",
  "Baby bottles",
  "رضاعات أطفال",
  "Philips Avent,فيليبس أفنت;Tommee Tippee,تومي تيبي;Dr Brown,دكتور براون",
  "cleaning parts,تنظيف الأجزاء;size and nipple,الحجم والحلمة;travel handling,الاستعمال بالسفر"
 ],
 [
  "food-processor",
  "Food processors",
  "محضرات طعام",
  "Kenwood,كينوود;Moulinex,مولينكس;Bosch,بوش",
  "bowl capacity,سعة الوعاء;attachments fit,توافق الملحقات;storage and cleaning,التخزين والتنظيف"
 ],
 [
  "pressure-cooker",
  "Pressure cookers",
  "قدور ضغط",
  "Tefal,تيفال;Instant Pot,إنستانت بوت;Ninja,نينجا",
  "pot capacity,سعة القدر;steam release,إخراج البخار;cleaning and lid,الغطاء والتنظيف"
 ],
 [
  "cookware",
  "Cookware sets",
  "أواني طهي",
  "Tefal,تيفال;Neoflam,نيوفلام;Tramontina,ترامونتينا",
  "hob compatibility,توافق الموقد;handle comfort,راحة المقبض;coating care,العناية بالطلاء"
 ],
 [
  "kettle",
  "Electric kettles",
  "غلايات مياه",
  "Philips,فيليبس;Braun,براون;Kenwood,كينوود",
  "capacity and speed,السعة والسرعة;temperature control,التحكم بالحرارة;safe cleaning,التنظيف الآمن"
 ],
 [
  "television",
  "Smart TVs",
  "تلفزيونات ذكية",
  "Samsung,سامسونج;LG,إل جي;TCL,تي سي إل",
  "viewing distance,مسافة المشاهدة;gaming ports,منافذ الألعاب;apps and controls,التطبيقات والتحكم"
 ]
];
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,room)=>{let str=String(value).trim();while(str.length>room&&str.includes(' '))str=str.slice(0,str.lastIndexOf(' '));return str.length<=room?str:''};
const suffix={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const expandedEditorialTopics=Object.freeze(rows.flatMap(([family,enCategory,arCategory,brands,angles])=>{
 const products=brands.split(';').map(v=>v.split(',')),questions=angles.split(';').map(v=>v.split(','));
 return products.flatMap(([enBrand,arBrand])=>questions.flatMap(([enFocus,arFocus],angle)=>['SA','AE'].flatMap(country=>{
  const en=country==='AE',brand=en?enBrand:arBrand,category=en?enCategory:arCategory;
  const focus=en?enFocus:arFocus,front=brand+' '+category+': ',tail=suffix[country];
  const fit=shorten(focus,72-front.length-tail.length);
  if(!fit)return [];
  const title=front+fit+tail;
  if(title.length<28||title.length>72)return [];
  const code=en?'NOV188':'NOV170';
  const topic={country,language:en?'en-AE':'ar-SA',brand,category,topic:title,coupon:code,
    slug:(en?'uae':'saudi')+'-buyer-'+slug(enBrand)+'-'+family+'-'+slug(enFocus)+'-'+code.toLowerCase()+'-2026',
    queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-'+slug(enFocus),comparisonKey:'editorial-'+family+'-'+angle,
    sections:en?[
     category+': matching '+fit+' to the intended use',
     'Compare '+enBrand+' model versions, actual listing details and warranty terms',
     'Check Noon UAE seller identity, delivery, returns and '+code+' cart eligibility',
     'Verify '+fit+' requirements, technical limitations and accessories',
     'Final comparison of '+category+' alternatives with costs and practical FAQ'
    ]:[
     category+' حسب '+fit+' قبل الشراء',
     'مطابقة موديلات '+arBrand+' ومواصفاتها والبائع وشروط الضمان',
     'فحص الشحن والإرجاع وأهلية كوبون '+code+' في نون السعودية',
     'تقييم '+fit+' مع الملحقات والتوافق واحتياج الاستخدام',
     'قائمة قرار مقارنة '+category+' والأسئلة المتكررة قبل الدفع'
    ]};
  return [topic];
 })));
}));
