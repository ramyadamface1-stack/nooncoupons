const norm=s=>String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim();

export const MARKETS={
  saudi:{country:'SA',label:'السعودية',name:'نون السعودية',noon:'https://www.noon.com/saudi-ar/'},
  uae:{country:'AE',label:'الإمارات',name:'نون الإمارات',noon:'https://www.noon.com/uae-ar/'}
};

export const CATEGORIES={
  electronics:{label:'الإلكترونيات',desc:'شاشات وتابلت وكاميرات وراوترات وأجهزة ذكية مع مراجعة النسخة والبائع والضمان.',terms:['التلفزيونات','الكاميرات','الشاشات','الراوترات','التخزين الخارجي','التابلت','الساعات الذكية','الأجهزة القابلة للارتداء']},
  mobiles:{label:'الجوالات',desc:'هواتف حسب البراند والعائلة والسعة والنسخة والبائع والضمان والسعر النهائي.',terms:['الجوالات'],brands:true},
  computers:{label:'اللابتوبات والكمبيوتر',desc:'لابتوبات وملحقات وطابعات حسب المعالج والذاكرة والتخزين والتوافق.',terms:['اللابتوبات','إكسسوارات الكمبيوتر','المكتب المنزلي','الطابعات']},
  gaming:{label:'الألعاب الإلكترونية',desc:'أجهزة وإكسسوارات الألعاب مع مراجعة التوافق والنسخة والضمان.',terms:['أجهزة الألعاب','إكسسوارات الألعاب']},
  audio:{label:'السماعات والصوتيات',desc:'سماعات وأجهزة صوتية حسب الاتصال والبطارية والراحة والتوافق.',terms:['السماعات','الأجهزة الصوتية']},
  'home-kitchen':{label:'البيت والمطبخ',desc:'أدوات البيت والمطبخ حسب السعة والخامة والأبعاد وسهولة الاستخدام.',terms:['المطبخ','منتجات القهوة','أدوات الطبخ','الأثاث','الديكور','أدوات التنظيف','المفروشات','الإضاءة','تنظيم المنزل']},
  appliances:{label:'الأجهزة المنزلية',desc:'أجهزة منزلية حسب السعة والأبعاد والتوافق والضمان.',terms:['الأجهزة المنزلية']},
  beauty:{label:'الجمال والعناية',desc:'العطور والجمال والعناية مع مراجعة الحجم والمكونات المعلنة والبائع.',terms:['العطور','مستحضرات التجميل','العناية بالبشرة','العناية بالشعر','العناية الشخصية']},
  'women-fashion':{label:'أزياء النساء',desc:'أزياء النساء مع مراجعة المقاس والخامة وسياسة الإرجاع.',terms:['الأزياء النسائية']},
  'men-fashion':{label:'أزياء الرجال',desc:'أزياء الرجال مع مراجعة المقاس والخامة وسياسة الإرجاع.',terms:['الأزياء الرجالية']},
  shoes:{label:'الأحذية',desc:'أحذية حسب المقاس والخامة والاستخدام وسياسة الاستبدال والإرجاع.',terms:['الأحذية']},
  bags:{label:'الحقائب',desc:'حقائب يومية وعمل وسفر حسب المقاس والخامة والسعة والاستخدام.',terms:['الحقائب']},
  'baby-kids':{label:'البيبي والأطفال',desc:'البيبي والأطفال حسب العمر والمقاس وطريقة الاستخدام.',terms:['مستلزمات المواليد','ألعاب الأطفال','الألعاب التعليمية']},
  sports:{label:'الرياضة واللياقة',desc:'الرياضة واللياقة حسب المقاس والوزن والخامة والاستخدام.',terms:['الرياضة واللياقة','معدات التخييم','الدراجات']},
  automotive:{label:'السيارات',desc:'إكسسوارات السيارات مع مراجعة التوافق وطريقة التركيب.',terms:['إكسسوارات السيارات']},
  grocery:{label:'البقالة',desc:'البقالة مع مراجعة حجم العبوة وسعر الوحدة والتخزين.',terms:['البقالة']},
  travel:{label:'السفر',desc:'مستلزمات السفر حسب الأبعاد والوزن والسعة وسهولة الحركة.',terms:['شنط السفر']}
};

export const BRANDS={
  apple:{label:'Apple',short:'آبل',categories:['mobiles','electronics','computers','audio'],aliases:['apple','iphone','ipad','macbook','airpods','ايفون','آيفون','ايباد','ماك بوك'],models:{iphone:{label:'iPhone'},'iphone-pro':{label:'iPhone Pro'},'iphone-plus-pro-max':{label:'iPhone Plus / Pro Max'},ipad:{label:'iPad'},macbook:{label:'MacBook'},airpods:{label:'AirPods'}}},
  samsung:{label:'Samsung',short:'سامسونج',categories:['mobiles','electronics','appliances'],aliases:['samsung','galaxy','سامسونج','جالاكسي'],models:{'galaxy-s':{label:'Galaxy S'},'galaxy-a':{label:'Galaxy A'},'galaxy-z':{label:'Galaxy Z'},'galaxy-tab':{label:'Galaxy Tab'}}},
  xiaomi:{label:'Xiaomi',short:'شاومي',categories:['mobiles','electronics','appliances'],aliases:['xiaomi','redmi','poco','شاومي','ريدمي','بوكو'],models:{xiaomi:{label:'Xiaomi'},'redmi-note':{label:'Redmi Note'},poco:{label:'POCO'}}},
  oppo:{label:'OPPO',short:'أوبو',categories:['mobiles'],aliases:['oppo','اوبو','أوبو'],models:{reno:{label:'Reno'},find:{label:'Find'},'a-series':{label:'A Series'}}},
  honor:{label:'HONOR',short:'هونر',categories:['mobiles','electronics'],aliases:['honor','هونر'],models:{magic:{label:'Magic'},'x-series':{label:'X Series'},'number-series':{label:'Number Series'}}},
  huawei:{label:'Huawei',short:'هواوي',categories:['mobiles','electronics','computers','audio'],aliases:['huawei','هواوي'],models:{mate:{label:'Mate'},pura:{label:'Pura'},nova:{label:'nova'},matebook:{label:'MateBook'}}},
  motorola:{label:'Motorola',short:'موتورولا',categories:['mobiles'],aliases:['motorola','moto','موتورولا'],models:{edge:{label:'Edge'},'moto-g':{label:'Moto G'},razr:{label:'Razr'}}},
  vivo:{label:'vivo',short:'فيفو',categories:['mobiles'],aliases:['vivo','فيفو'],models:{'x-series':{label:'X Series'},'v-series':{label:'V Series'},'y-series':{label:'Y Series'}}},
  sony:{label:'Sony',short:'سوني',categories:['electronics','gaming','audio'],aliases:['sony','playstation','سوني','بلايستيشن'],models:{playstation:{label:'PlayStation'},bravia:{label:'BRAVIA'},headphones:{label:'Headphones'}}},
  lg:{label:'LG',short:'إل جي',categories:['electronics','appliances'],aliases:['lg','ال جي','إل جي'],models:{oled:{label:'OLED TV'},'home-appliances':{label:'Home Appliances'}}},
  hp:{label:'HP',short:'HP',categories:['computers','electronics'],aliases:['hp','hewlett packard','اتش بي'],models:{pavilion:{label:'Pavilion'},victus:{label:'Victus'},printers:{label:'Printers'}}},
  lenovo:{label:'Lenovo',short:'لينوفو',categories:['computers','electronics','gaming'],aliases:['lenovo','لينوفو'],models:{ideapad:{label:'IdeaPad'},thinkpad:{label:'ThinkPad'},legion:{label:'Legion'}}},
  asus:{label:'ASUS',short:'أسوس',categories:['computers','gaming','electronics'],aliases:['asus','rog','اسوس','أسوس'],models:{vivobook:{label:'VivoBook'},zenbook:{label:'Zenbook'},rog:{label:'ROG'}}},
  acer:{label:'Acer',short:'إيسر',categories:['computers','gaming'],aliases:['acer','ايسر','إيسر'],models:{aspire:{label:'Aspire'},nitro:{label:'Nitro'},predator:{label:'Predator'}}},
  dell:{label:'Dell',short:'ديل',categories:['computers'],aliases:['dell','ديل'],models:{inspiron:{label:'Inspiron'},latitude:{label:'Latitude'},alienware:{label:'Alienware'}}},
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
export function commercePaths(){const out=[];for(const m of Object.keys(MARKETS)){out.push(`/${m}/categories`);for(const k of Object.keys(CATEGORIES))out.push(`/${m}/category/${k}`);for(const [bKey,b] of Object.entries(BRANDS)){out.push(`/${m}/brand/${bKey}`);for(const modelKey of Object.keys(b.models))out.push(`/${m}/model/${bKey}/${modelKey}`)}for(const k of Object.keys(COMPARISONS))out.push(`/${m}/compare/${k}`)}return out}
export const COMMERCE_TAXONOMY_INFO={version:2,categories:Object.keys(CATEGORIES).length,brands:Object.keys(BRANDS).length,models:Object.values(BRANDS).reduce((n,b)=>n+Object.keys(b.models).length,0),comparisons:Object.keys(COMPARISONS).length,routes:commercePaths().length,architecture:'market-category-brand-model-comparison-article'};
