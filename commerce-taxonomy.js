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
  apple:{label:'Apple iPhone',short:'آيفون',aliases:['apple','iphone','ايفون','آيفون'],models:{iphone:{label:'iPhone'},'iphone-pro':{label:'iPhone Pro'},'iphone-plus-pro-max':{label:'iPhone Plus / Pro Max'}}},
  samsung:{label:'Samsung Galaxy',short:'سامسونج',aliases:['samsung','galaxy','سامسونج','جالاكسي'],models:{'galaxy-s':{label:'Galaxy S'},'galaxy-a':{label:'Galaxy A'},'galaxy-z':{label:'Galaxy Z'}}},
  xiaomi:{label:'Xiaomi',short:'شاومي',aliases:['xiaomi','redmi','poco','شاومي','ريدمي','بوكو'],models:{xiaomi:{label:'Xiaomi'},'redmi-note':{label:'Redmi Note'},poco:{label:'POCO'}}},
  oppo:{label:'OPPO',short:'أوبو',aliases:['oppo','اوبو','أوبو'],models:{reno:{label:'Reno'},find:{label:'Find'},'a-series':{label:'A Series'}}},
  honor:{label:'HONOR',short:'هونر',aliases:['honor','هونر'],models:{magic:{label:'Magic'},'x-series':{label:'X Series'},'number-series':{label:'Number Series'}}},
  huawei:{label:'Huawei',short:'هواوي',aliases:['huawei','هواوي'],models:{mate:{label:'Mate'},pura:{label:'Pura'},nova:{label:'nova'}}},
  motorola:{label:'Motorola',short:'موتورولا',aliases:['motorola','moto','موتورولا'],models:{edge:{label:'Edge'},'moto-g':{label:'Moto G'},razr:{label:'Razr'}}},
  vivo:{label:'vivo',short:'فيفو',aliases:['vivo','فيفو'],models:{'x-series':{label:'X Series'},'v-series':{label:'V Series'},'y-series':{label:'Y Series'}}}
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
export function commerceMeta(a={}){const market=marketKey(a.country),categoryKey=categoryKeyForArticle(a),brandKey=categoryKey==='mobiles'?brandKeyForArticle(a):null,modelKey=brandKey?modelKeyForArticle(a,brandKey):null,comparisonKey=categoryKey==='mobiles'?comparisonKeyForArticle(a):null;return {market,categoryKey,brandKey,modelKey,comparisonKey}}
export function articleCommerceLinks(a={}){const m=commerceMeta(a),out=[{path:`/${m.market}/categories`,label:`أقسام ${MARKETS[m.market].name}`},{path:`/${m.market}/category/${m.categoryKey}`,label:CATEGORIES[m.categoryKey].label}];if(m.brandKey)out.push({path:`/${m.market}/brand/${m.brandKey}`,label:BRANDS[m.brandKey].label});if(m.brandKey&&m.modelKey)out.push({path:`/${m.market}/model/${m.brandKey}/${m.modelKey}`,label:BRANDS[m.brandKey].models[m.modelKey].label});if(m.comparisonKey)out.push({path:`/${m.market}/compare/${m.comparisonKey}`,label:'المقارنة المرتبطة'});return out}
export function commercePaths(){const out=[];for(const m of Object.keys(MARKETS)){out.push(`/${m}/categories`);for(const k of Object.keys(CATEGORIES))out.push(`/${m}/category/${k}`);for(const [bKey,b] of Object.entries(BRANDS)){out.push(`/${m}/brand/${bKey}`);for(const modelKey of Object.keys(b.models))out.push(`/${m}/model/${bKey}/${modelKey}`)}for(const k of Object.keys(COMPARISONS))out.push(`/${m}/compare/${k}`)}return out}
export const COMMERCE_TAXONOMY_INFO={version:2,categories:Object.keys(CATEGORIES).length,brands:Object.keys(BRANDS).length,models:Object.values(BRANDS).reduce((n,b)=>n+Object.keys(b.models).length,0),comparisons:Object.keys(COMPARISONS).length,routes:commercePaths().length,architecture:'market-category-brand-model-comparison-article'};
