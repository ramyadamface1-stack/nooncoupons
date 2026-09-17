import {CATEGORIES,BRANDS,categoryKeyForArticle} from './commerce-taxonomy.js';

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const pick=(xs,n,salt=0)=>xs?.length?xs[Math.abs((Number(n)||0)+salt)%xs.length]:null;
const uniq=xs=>[...new Set((xs||[]).filter(Boolean))];

// Current high-interest product families observed on Noon in September 2026.
// These are topic seeds only; article copy must still avoid inventing prices, stock or discount claims.
const SEPTEMBER_2026_SEEDS={
  mobiles:['iPhone 17','iPhone 17 Pro','iPhone 17 Pro Max','iPhone 17 Air','iPhone 16','Samsung Galaxy S25 Ultra','Samsung Galaxy S24 Ultra','Samsung Galaxy Flip 6','Samsung Galaxy Fold 6','Huawei Phone','Nothing Phone'],
  laptops:['MacBook Air','MacBook Pro','Acer Laptops','ASUS Laptops','Dell Laptops','HP Laptops','Huawei Laptops','Lenovo Laptops','MSI Laptops','Razer Laptops','Samsung Laptops','Gaming Laptop'],
  audio:['AirPods 4','AirPods Pro','Bose Speakers','Harman Kardon Speaker','JBL Speakers','Marshall Speaker','Sony Speaker'],
  gaming:['PS5','PlayStation','Xbox','Nintendo Switch','Nintendo Switch Games','Gaming Laptop'],
  appliances:['LG Fridge','Samsung Fridge','Whirlpool Fridge','Ninja Air Fryer','Nutricook Air Fryer','Philips Air Fryer'],
  beauty:['Body Mist','Sunscreen','Vitamin C Serum','Beauty of Joseon','Chanel Perfume','Dior Perfume','Rasasi Perfume','Versace Perfume','Lattafa Perfume','Cosmetics'],
  bags:['Aldo Bags','Handbags','Travel Luggage'],
  sports:['Fitbit Fitness Trackers','Bike For Kids'],
  'baby-kids':['Barbie','Lego','Squishmallows','Bike For Kids'],
  computers:['Mac Studio','Apple iMac','Desktop'],
  tablets:['Tablet'],
  tvs:['Samsung TV','LG TV','Sony TV']
};

const PRODUCT_ANGLES=[
  'السعر النهائي بعد الكوبون','هل الكوبون يعمل','أفضل وقت لتجربة الكود','مقارنة البائعين','الشحن والتوصيل','سياسة الإرجاع','الضمان','اختيار السعة','اختيار المقاس','اختيار اللون','مقارنة المواصفات','للطلب الأول','للحساب الحالي','قبل الدفع','وقت عروض سبتمبر','ميزانية محددة','مقارنة البدائل','القيمة مقابل السعر','فحص أهلية السلة','شراء أكثر من قطعة','الشراء من التطبيق','الشراء من المتصفح','مراجعة الملحقات','التوافق مع الاستخدام','مراجعة النسخة والموديل'
];

function eligibleBrands(categoryKey){
  return Object.entries(BRANDS).filter(([,b])=>b.categories?.includes(categoryKey));
}
function modelRows(categoryKey){
  const rows=[];
  for(const [brandKey,brand] of eligibleBrands(categoryKey)){
    for(const [modelKey,model] of Object.entries(brand.models||{}))rows.push({brandKey,brand:brand.label,modelKey,model:model.label});
  }
  return rows;
}

export function expandNoonTopic(topic={},cursor=0){
  const n=Math.abs(Number(cursor)||0);
  const categoryKey=topic.categoryKey||categoryKeyForArticle({category:topic.category,categoryKey:topic.categoryKey});
  const category=CATEGORIES[categoryKey]||{};
  const subcategories=uniq(category.terms||[]);
  const brands=eligibleBrands(categoryKey);
  const models=modelRows(categoryKey);
  const seasonal=SEPTEMBER_2026_SEEDS[categoryKey]||[];
  const level=n%6;
  let catalogLevel='category',catalogTarget=category.label||topic.category||'',brandKey=null,modelKey=null;

  if(level===1&&subcategories.length){
    catalogLevel='subcategory';catalogTarget=pick(subcategories,n,3);
  }else if(level===2&&brands.length){
    const [bk,b]=pick(brands,n,7);catalogLevel='brand';brandKey=bk;catalogTarget=`${b.label} ${pick(subcategories,n,11)||category.label||''}`.trim();
  }else if(level===3&&models.length){
    const m=pick(models,n,13);catalogLevel='model';brandKey=m.brandKey;modelKey=m.modelKey;catalogTarget=`${m.brand} ${m.model}`.trim();
  }else if(level===4&&seasonal.length){
    catalogLevel='seasonal-product';catalogTarget=pick(seasonal,n,17);
  }else if(level===5){
    const m=pick(models,n,19),base=m?`${m.brand} ${m.model}`:(pick(seasonal,n,23)||pick(subcategories,n,29)||category.label||topic.category||'');
    if(m){brandKey=m.brandKey;modelKey=m.modelKey}
    catalogLevel='product-intent';catalogTarget=`${base} ${pick(PRODUCT_ANGLES,n,31)}`.trim();
  }

  const seasonalCadence=n%4===0;
  const seasonalTerm=seasonalCadence?'سبتمبر 2026':'';
  return {
    ...topic,
    categoryKey,
    originalCategory:topic.category,
    category:clean(catalogTarget||topic.category),
    catalogLevel,
    catalogTarget:clean(catalogTarget),
    catalogBrandKey:brandKey,
    catalogModelKey:modelKey,
    seasonalTerm,
    topicExpansionVersion:'noon-hierarchy-v1'
  };
}

export const NOON_TOPIC_EXPANSION_INFO={
  version:'noon-hierarchy-v1',
  levels:['category','subcategory','brand','model','seasonal-product','product-intent'],
  seasonalMonth:'سبتمبر 2026',
  seasonalCadence:'1-in-4',
  productAngles:PRODUCT_ANGLES.length,
  seededCategories:Object.keys(SEPTEMBER_2026_SEEDS).length
};
