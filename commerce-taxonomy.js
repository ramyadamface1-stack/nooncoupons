const norm=s=>String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim();

export const MARKETS={
  saudi:{country:'SA',label:'السعودية',name:'نون السعودية',noon:'https://www.noon.com/saudi-ar/'},
  uae:{country:'AE',label:'الإمارات',name:'نون الإمارات',noon:'https://www.noon.com/uae-ar/'}
};

export const CITIES={
  saudi:[
    {key:'riyadh',ar:'الرياض',en:'Riyadh'},{key:'jeddah',ar:'جدة',en:'Jeddah'},{key:'makkah',ar:'مكة',en:'Makkah'},
    {key:'madinah',ar:'المدينة المنورة',en:'Madinah'},{key:'dammam',ar:'الدمام',en:'Dammam'},{key:'khobar',ar:'الخبر',en:'Khobar'}
  ],
  uae:[
    {key:'dubai',ar:'دبي',en:'Dubai'},{key:'abu-dhabi',ar:'أبوظبي',en:'Abu Dhabi'},{key:'sharjah',ar:'الشارقة',en:'Sharjah'},
    {key:'ajman',ar:'عجمان',en:'Ajman'},{key:'ras-al-khaimah',ar:'رأس الخيمة',en:'Ras Al Khaimah'},{key:'fujairah',ar:'الفجيرة',en:'Fujairah'}
  ]
};

export const CATEGORY_VISUALS={
  electronics:{icon:'📷',theme:'smart-tech',alt:'إلكترونيات وكوبونات نون'},
  mobiles:{icon:'📱',theme:'mobile-tech',alt:'جوالات وكوبونات نون'},
  laptops:{icon:'💻',theme:'computing',alt:'لابتوبات وكوبونات نون'},
  tablets:{icon:'▣',theme:'tablet-tech',alt:'تابلت وكوبونات نون'},
  tvs:{icon:'📺',theme:'home-screen',alt:'تلفزيونات وكوبونات نون'},
  computers:{icon:'⌨',theme:'computing',alt:'كمبيوتر وملحقات وكوبونات نون'},
  gaming:{icon:'🎮',theme:'gaming',alt:'ألعاب إلكترونية وكوبونات نون'},
  audio:{icon:'🎧',theme:'audio',alt:'سماعات وصوتيات وكوبونات نون'},
  'home-kitchen':{icon:'⌂',theme:'home',alt:'البيت والمطبخ وكوبونات نون'},
  appliances:{icon:'◫',theme:'appliances',alt:'أجهزة منزلية وكوبونات نون'},
  beauty:{icon:'✦',theme:'beauty',alt:'الجمال والعناية وكوبونات نون'},
  'women-fashion':{icon:'♢',theme:'fashion',alt:'أزياء نسائية وكوبونات نون'},
  'men-fashion':{icon:'♢',theme:'fashion',alt:'أزياء رجالية وكوبونات نون'},
  shoes:{icon:'◒',theme:'fashion',alt:'أحذية وكوبونات نون'},
  bags:{icon:'▱',theme:'travel',alt:'حقائب وكوبونات نون'},
  'baby-kids':{icon:'★',theme:'kids',alt:'البيبي والأطفال وكوبونات نون'},
  sports:{icon:'●',theme:'sports',alt:'رياضة ولياقة وكوبونات نون'},
  automotive:{icon:'◆',theme:'automotive',alt:'سيارات وكوبونات نون'},
  grocery:{icon:'◉',theme:'grocery',alt:'بقالة وكوبونات نون'},
  travel:{icon:'✈',theme:'travel',alt:'سفر وكوبونات نون'},
  'school-supplies':{icon:'✎',theme:'school',alt:'مستلزمات المدرسة وكوبونات نون'},
  gifts:{icon:'◇',theme:'gifts',alt:'هدايا وكوبونات نون'},
  pets:{icon:'♡',theme:'pets',alt:'مستلزمات الحيوانات الأليفة وكوبونات نون'}
};

export const CATEGORIES={
  electronics:{label:'الإلكترونيات',desc:'كاميرات وشاشات كمبيوتر وراوترات وتخزين وأجهزة ذكية مع مراجعة التوافق والنسخة والبائع والضمان.',terms:['الكاميرات','الشاشات','الراوترات','التخزين الخارجي','الساعات الذكية','الأجهزة القابلة للارتداء']},
  mobiles:{label:'الجوالات',desc:'هواتف حسب البراند والعائلة والسعة والنسخة والبائع والضمان والسعر النهائي.',terms:['الجوالات'],brands:true},
  laptops:{label:'اللابتوبات',desc:'لابتوبات حسب المعالج والذاكرة والتخزين والشاشة والبطارية والوزن والضمان وسيناريو الاستخدام.',terms:['اللابتوبات']},
  tablets:{label:'التابلت',desc:'أجهزة تابلت حسب حجم الشاشة والتخزين والاتصال ودعم القلم أو لوحة المفاتيح والبطارية والتحديثات.',terms:['التابلت']},
  tvs:{label:'التلفزيونات',desc:'تلفزيونات حسب المقاس ونوع اللوحة والدقة وHDR ومعدل التحديث والمنافذ والنظام الذكي والضمان.',terms:['التلفزيونات']},
  computers:{label:'الكمبيوتر وملحقاته',desc:'كمبيوتر وملحقات وطابعات ومكتب منزلي حسب التوافق والذاكرة والتخزين والمنافذ والاستخدام.',terms:['إكسسوارات الكمبيوتر','المكتب المنزلي','الطابعات']},
  gaming:{label:'الألعاب الإلكترونية',desc:'أجهزة وإكسسوارات الألعاب مع مراجعة التوافق والنسخة والسعة والملحقات والضمان.',terms:['أجهزة الألعاب','إكسسوارات الألعاب']},
  audio:{label:'السماعات والصوتيات',desc:'سماعات وأجهزة صوتية حسب الاتصال والبطارية والراحة والعزل والميكروفون والتوافق.',terms:['السماعات','الأجهزة الصوتية']},
  'home-kitchen':{label:'البيت والمطبخ',desc:'أدوات البيت والمطبخ حسب السعة والخامة والأبعاد والطاقة وسهولة الاستخدام والتنظيف.',terms:['المطبخ','منتجات القهوة','أدوات الطبخ','الأثاث','الديكور','أدوات التنظيف','المفروشات','الإضاءة','تنظيم المنزل']},
  appliances:{label:'الأجهزة المنزلية',desc:'أجهزة منزلية حسب السعة والأبعاد ومتطلبات التركيب واستهلاك الطاقة والضمان وخدمة ما بعد البيع.',terms:['الأجهزة المنزلية']},
  beauty:{label:'الجمال والعناية',desc:'العطور والجمال والعناية مع مراجعة الحجم والمكونات المعلنة والدرجة والبائع وطريقة الاستخدام.',terms:['العطور','مستحضرات التجميل','العناية بالبشرة','العناية بالشعر','العناية الشخصية']},
  'women-fashion':{label:'أزياء النساء',desc:'أزياء النساء مع مراجعة جدول المقاس والقصة والخامة وتعليمات العناية وسياسة الإرجاع.',terms:['الأزياء النسائية']},
  'men-fashion':{label:'أزياء الرجال',desc:'أزياء الرجال مع مراجعة جدول المقاس والقصة والخامة وتعليمات العناية وسياسة الإرجاع.',terms:['الأزياء الرجالية']},
  shoes:{label:'الأحذية',desc:'أحذية حسب المقاس وجدول القياس والخامة ونوع الاستخدام والملاءمة وسياسة الاستبدال والإرجاع.',terms:['الأحذية']},
  bags:{label:'الحقائب',desc:'حقائب يومية وعمل وسفر حسب الأبعاد والخامة والسعة والوزن والتقسيم الداخلي والاستخدام.',terms:['الحقائب']},
  'baby-kids':{label:'البيبي والأطفال',desc:'البيبي والأطفال حسب العمر والمقاس أو الوزن وطريقة الاستخدام وتعليمات السلامة والتنظيف.',terms:['مستلزمات المواليد','ألعاب الأطفال','الألعاب التعليمية']},
  sports:{label:'الرياضة واللياقة',desc:'الرياضة واللياقة حسب النشاط والمقاس والوزن والخامة وحدود الاستخدام وسهولة التخزين.',terms:['الرياضة واللياقة','معدات التخييم','الدراجات']},
  automotive:{label:'السيارات',desc:'إكسسوارات السيارات مع مراجعة التوافق مع الموديل والسنة والأبعاد وطريقة التركيب والطاقة عند الحاجة.',terms:['إكسسوارات السيارات']},
  grocery:{label:'البقالة',desc:'البقالة مع مراجعة حجم العبوة وسعر الوحدة والكمية والمكونات المعلنة وشروط التخزين.',terms:['البقالة']},
  travel:{label:'السفر',desc:'مستلزمات السفر حسب الأبعاد والوزن والسعة وجودة الحركة والتوافق مع قيود شركة الطيران.',terms:['شنط السفر']},
  'school-supplies':{label:'مستلزمات المدرسة',desc:'مستلزمات المدرسة حسب المرحلة والعمر والكمية والمقاس والخامات والمتانة وقائمة الاحتياجات الفعلية.',terms:['مستلزمات المدرسة']},
  gifts:{label:'الهدايا',desc:'الهدايا حسب المناسبة والمستلم والميزانية وموعد التوصيل والمقاس أو اللون وسياسة الإرجاع.',terms:['الهدايا']},
  pets:{label:'مستلزمات الحيوانات الأليفة',desc:'مستلزمات الحيوانات الأليفة حسب النوع والعمر والحجم والخامة أو المكونات والكمية وسهولة التنظيف دون ادعاءات طبية.',terms:['مستلزمات الحيوانات الأليفة']}
};

export const BRANDS={
  apple:{label:'Apple',short:'آبل',categories:['mobiles','tablets','laptops','audio'],aliases:['apple','iphone','ipad','macbook','airpods','ايفون','آيفون','ايباد','ماك بوك'],models:{iphone:{label:'iPhone'},'iphone-pro':{label:'iPhone Pro'},'iphone-plus-pro-max':{label:'iPhone Plus / Pro Max'},ipad:{label:'iPad'},macbook:{label:'MacBook'},airpods:{label:'AirPods'}}},
  samsung:{label:'Samsung',short:'سامسونج',categories:['mobiles','tablets','tvs','appliances'],aliases:['samsung','galaxy','سامسونج','جالاكسي'],models:{'galaxy-s':{label:'Galaxy S'},'galaxy-a':{label:'Galaxy A'},'galaxy-z':{label:'Galaxy Z'},'galaxy-tab':{label:'Galaxy Tab'}}},
  xiaomi:{label:'Xiaomi',short:'شاومي',categories:['mobiles','tablets','electronics','appliances'],aliases:['xiaomi','redmi','poco','شاومي','ريدمي','بوكو'],models:{xiaomi:{label:'Xiaomi'},'redmi-note':{label:'Redmi Note'},poco:{label:'POCO'}}},
  oppo:{label:'OPPO',short:'أوبو',categories:['mobiles'],aliases:['oppo','اوبو','أوبو'],models:{reno:{label:'Reno'},find:{label:'Find'},'a-series':{label:'A Series'}}},
  honor:{label:'HONOR',short:'هونر',categories:['mobiles','tablets'],aliases:['honor','هونر'],models:{magic:{label:'Magic'},'x-series':{label:'X Series'},'number-series':{label:'Number Series'}}},
  huawei:{label:'Huawei',short:'هواوي',categories:['mobiles','tablets','laptops','audio'],aliases:['huawei','هواوي'],models:{mate:{label:'Mate'},pura:{label:'Pura'},nova:{label:'nova'},matebook:{label:'MateBook'}}},
  motorola:{label:'Motorola',short:'موتورولا',categories:['mobiles'],aliases:['motorola','moto','موتورولا'],models:{edge:{label:'Edge'},'moto-g':{label:'Moto G'},razr:{label:'Razr'}}},
  vivo:{label:'vivo',short:'فيفو',categories:['mobiles'],aliases:['vivo','فيفو'],models:{'x-series':{label:'X Series'},'v-series':{label:'V Series'},'y-series':{label:'Y Series'}}},
  sony:{label:'Sony',short:'سوني',categories:['tvs','gaming','audio'],aliases:['sony','playstation','bravia','سوني','بلايستيشن'],models:{playstation:{label:'PlayStation'},bravia:{label:'BRAVIA'},headphones:{label:'Headphones'}}},
  lg:{label:'LG',short:'إل جي',categories:['tvs','appliances'],aliases:['lg','ال جي','إل جي'],models:{oled:{label:'OLED TV'},'home-appliances':{label:'Home Appliances'}}},
  hp:{label:'HP',short:'HP',categories:['laptops','computers'],aliases:['hp','hewlett packard','اتش بي'],models:{pavilion:{label:'Pavilion'},victus:{label:'Victus'},printers:{label:'Printers'}}},
  lenovo:{label:'Lenovo',short:'لينوفو',categories:['laptops','computers','gaming'],aliases:['lenovo','لينوفو'],models:{ideapad:{label:'IdeaPad'},thinkpad:{label:'ThinkPad'},legion:{label:'Legion'}}},
  asus:{label:'ASUS',short:'أسوس',categories:['laptops','gaming','computers'],aliases:['asus','rog','اسوس','أسوس'],models:{vivobook:{label:'VivoBook'},zenbook:{label:'Zenbook'},rog:{label:'ROG'}}},
  acer:{label:'Acer',short:'إيسر',categories:['laptops','gaming'],aliases:['acer','ايسر','إيسر'],models:{aspire:{label:'Aspire'},nitro:{label:'Nitro'},predator:{label:'Predator'}}},
  dell:{label:'Dell',short:'ديل',categories:['laptops','computers'],aliases:['dell','ديل'],models:{inspiron:{label:'Inspiron'},latitude:{label:'Latitude'},alienware:{label:'Alienware'}}},
  logitech:{label:'Logitech',short:'لوجيتك',categories:['computers','gaming'],aliases:['logitech','لوجيتك'],models:{'mx-series':{label:'MX Series'},'g-series':{label:'G Series'}}},
  jbl:{label:'JBL',short:'JBL',categories:['audio','electronics'],aliases:['jbl','جي بي ال'],models:{flip:{label:'Flip'},charge:{label:'Charge'},tune:{label:'Tune'}}},
  dyson:{label:'Dyson',short:'دايسون',categories:['appliances','beauty','home-kitchen'],aliases:['dyson','دايسون'],models:{vacuum:{label:'Vacuum'},airwrap:{label:'Airwrap'},air:{label:'Air Treatment'}}},
  philips:{label:'Philips',short:'فيليبس',categories:['appliances','beauty','home-kitchen'],aliases:['philips','فيليبس'],models:{'air-fryer':{label:'Air Fryer'},grooming:{label:'Grooming'},coffee:{label:'Coffee'}}},
  braun:{label:'Braun',short:'براون',categories:['beauty','appliances'],aliases:['braun','براون'],models:{grooming:{label:'Grooming'},silkepil:{label:'Silk-épil'}}},
  nike:{label:'Nike',short:'نايكي',categories:['shoes','sports','men-fashion','women-fashion'],aliases:['nike','نايكي'],models:{running:{label:'Running'},lifestyle:{label:'Lifestyle'},training:{label:'Training'}}},
  adidas:{label:'adidas',short:'أديداس',categories:['shoes','sports','men-fashion','women-fashion'],aliases:['adidas','أديداس','اديداس'],models:{running:{label:'Running'},originals:{label:'Originals'},football:{label:'Football'}}},
  puma:{label:'PUMA',short:'بوما',categories:['shoes','sports','men-fashion','women-fashion'],aliases:['puma','بوما'],models:{running:{label:'Running'},lifestyle:{label:'Lifestyle'}}},
  skechers:{label:'Skechers',short:'سكيتشرز',categories:['shoes','sports'],aliases:['skechers','سكيتشرز'],models:{walking:{label:'Walking'},running:{label:'Running'}}},
  americanTourister:{label:'American Tourister',short:'أمريكان توريستر',categories:['bags','travel'],aliases:['american tourister','امريكان توريستر','أمريكان توريستر'],models:{luggage:{label:'Luggage'},backpacks:{label:'Backpacks'}}},
  samsonite:{label:'Samsonite',short:'سامسونايت',categories:['bags','travel'],aliases:['samsonite','سامسونايت'],models:{luggage:{label:'Luggage'},business:{label:'Business Bags'}}},
  pampers:{label:'Pampers',short:'بامبرز',categories:['baby-kids'],aliases:['pampers','بامبرز'],models:{diapers:{label:'Diapers'},pants:{label:'Pants'}}},
  lego:{label:'LEGO',short:'ليجو',categories:['baby-kids'],aliases:['lego','ليجو'],models:{classic:{label:'Classic'},technic:{label:'Technic'}}},
  nivea:{label:'NIVEA',short:'نيفيا',categories:['beauty'],aliases:['nivea','نيفيا'],models:{skincare:{label:'Skin Care'},body:{label:'Body Care'}}},
  loreal:{label:"L'Oréal",short:'لوريال',categories:['beauty'],aliases:["l'oreal",'loreal','لوريال'],models:{hair:{label:'Hair Care'},makeup:{label:'Makeup'},skincare:{label:'Skin Care'}}}
};

export const COMPARISONS={
  'iphone-vs-galaxy':{title:'آيفون أم Samsung Galaxy؟',a:'apple',b:'samsung'},
  'samsung-vs-xiaomi':{title:'Samsung أم Xiaomi؟',a:'samsung',b:'xiaomi'},
  'oppo-vs-honor':{title:'OPPO أم HONOR؟',a:'oppo',b:'honor'},
  'xiaomi-vs-honor':{title:'Xiaomi أم HONOR؟',a:'xiaomi',b:'honor'},
  'galaxy-s-vs-a':{title:'Galaxy S أم Galaxy A؟',a:'samsung',b:'samsung'}
};

const TERM_TO_CATEGORY={};
for(const [key,c] of Object.entries(CATEGORIES))for(const t of c.terms)TERM_TO_CATEGORY[norm(t)]=key;

export function marketKey(country){return country==='AE'?'uae':'saudi'}
export function categoryKeyForArticle(a={}){if(a.categoryKey&&CATEGORIES[a.categoryKey])return a.categoryKey;return TERM_TO_CATEGORY[norm(a.category)]||'electronics'}
export function brandKeyForArticle(a={}){if(a.brandKey&&BRANDS[a.brandKey])return a.brandKey;const text=norm([a.title,a.primaryKeyword,a.metaDescription,a.category].filter(Boolean).join(' '));for(const [k,b] of Object.entries(BRANDS))if(b.aliases.some(x=>text.includes(norm(x))))return k;return null}
export function modelKeyForArticle(a={},brandKey=brandKeyForArticle(a)){if(a.modelKey&&BRANDS[brandKey]?.models?.[a.modelKey])return a.modelKey;if(!brandKey)return null;const text=norm([a.title,a.primaryKeyword,a.metaDescription].filter(Boolean).join(' '));for(const [k,m] of Object.entries(BRANDS[brandKey].models))if(text.includes(norm(m.label)))return k;return null}
export function comparisonKeyForArticle(a={}){if(a.comparisonKey&&COMPARISONS[a.comparisonKey])return a.comparisonKey;const text=norm([a.title,a.primaryKeyword,a.metaDescription].filter(Boolean).join(' '));for(const [k,c] of Object.entries(COMPARISONS)){const A=BRANDS[c.a],B=BRANDS[c.b];if(A.aliases.some(x=>text.includes(norm(x)))&&B.aliases.some(x=>text.includes(norm(x))))return k}return null}
export function commerceMeta(a={}){const market=marketKey(a.country),categoryKey=categoryKeyForArticle(a),detectedBrand=brandKeyForArticle(a),brandKey=detectedBrand&&BRANDS[detectedBrand]?.categories?.includes(categoryKey)?detectedBrand:null,modelKey=brandKey?modelKeyForArticle(a,brandKey):null,comparisonKey=categoryKey==='mobiles'?comparisonKeyForArticle(a):null;return {market,categoryKey,brandKey,modelKey,comparisonKey}}
export function articleCommerceLinks(a={}){const m=commerceMeta(a),out=[{path:`/${m.market}/categories`,label:`أقسام ${MARKETS[m.market].name}`},{path:`/${m.market}/category/${m.categoryKey}`,label:CATEGORIES[m.categoryKey].label}];if(m.brandKey)out.push({path:`/${m.market}/brand/${m.brandKey}`,label:BRANDS[m.brandKey].label});if(m.brandKey&&m.modelKey)out.push({path:`/${m.market}/model/${m.brandKey}/${m.modelKey}`,label:BRANDS[m.brandKey].models[m.modelKey].label});if(m.comparisonKey)out.push({path:`/${m.market}/compare/${m.comparisonKey}`,label:'المقارنة المرتبطة'});return out}
export function commercePaths(){const out=[];for(const m of Object.keys(MARKETS)){out.push(`/${m}`,`/${m}/categories`);for(const city of CITIES[m]||[])out.push(`/${m}/city/${city.key}`);for(const k of Object.keys(CATEGORIES))out.push(`/${m}/category/${k}`);for(const [bKey,b] of Object.entries(BRANDS)){out.push(`/${m}/brand/${bKey}`);for(const modelKey of Object.keys(b.models))out.push(`/${m}/model/${bKey}/${modelKey}`)}for(const k of Object.keys(COMPARISONS))out.push(`/${m}/compare/${k}`)}return out}
export const COMMERCE_TAXONOMY_INFO={version:4,categories:Object.keys(CATEGORIES).length,brands:Object.keys(BRANDS).length,models:Object.values(BRANDS).reduce((n,b)=>n+Object.keys(b.models).length,0),comparisons:Object.keys(COMPARISONS).length,cities:Object.values(CITIES).reduce((n,a)=>n+a.length,0),visualCategories:Object.keys(CATEGORY_VISUALS).length,routes:commercePaths().length,architecture:'market-city-category-brand-model-comparison-article'};
