// N6: distinct buyer questions selected to replenish exhausted N1-N5 inventory.
// These are only editorial briefs, not written articles or unverified product facts.
// Native free-provider quota controls, uniqueness checks and score >=95 remain.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const questions=Object.freeze({
  'tablet':'offline lecture indexing,فهرسة المحاضرات دون إنترنت;parental app boundaries,ضبط صلاحيات تطبيقات الأطفال;keyboard case connector fit,توافق غطاء لوحة المفاتيح',
  'laptop':'external microphone privacy,خصوصية الميكروفون الخارجي;dock passthrough power budget,قدرة الشحن عبر الموزع;replacement charger certification,التحقق من اعتماد الشاحن البديل',
  'phone':'dual SIM mobile data switching,تبديل بيانات شريحتي الاتصال;family photo transfer ownership,نقل الصور بين حسابات الأسرة;camera lens protector fit,توافق واقي عدسة الكاميرا',
  'gaming-laptop':'external adaptive sync display,توافق التزامن مع الشاشة الخارجية;fan grille service access,سهولة الوصول لفتحات المراوح;controller Bluetooth pairing limits,حدود ربط أذرع اللعب',
  'monitor':'two computer video input switching,التبديل بين مدخلي جهازين;vertical mount desk clearance,مساحة الحامل العمودي بالمكتب;USB hub peripheral power,قدرة منافذ USB المدمجة',
  'printer':'double sided paper jam access,فك انحشار الطباعة المزدوجة;envelope tray size matching,توافق درج طباعة المظاريف;refill ink warranty documentation,توثيق ضمان الحبر البديل',
  'ssd':'encrypted shared drive access,الوصول للقرص المشفر بين الأجهزة;USB bridge chipset suitability,ملاءمة شريحة محول USB;long term photo archive planning,تخطيط أرشفة الصور طويل الأمد',
  'router':'guest WiFi QR code onboarding,توصيل الضيوف عبر رمز QR;smart camera local access,وصول الكاميرات على الشبكة المحلية;home office network separation,فصل شبكة العمل عن المنزل',
  'earbuds':'video meeting microphone monitoring,مراقبة صوت الميكروفون بالمكالمات;replacement charging case supply,توافر علبة شحن بديلة;hearing accessibility volume limit,ضبط مستوى الصوت المريح',
  'headphones':'Bluetooth airplane adapter choices,اختيار محول طائرة بلوتوث;glasses friendly ear cushion depth,عمق الوسائد مع النظارات;replaceable cable socket matching,توافق منفذ الكابل البديل',
  'powerbank':'multiport power budget sharing,توزيع قدرة الشحن بين المنافذ;portable solar panel input limits,حدود الشحن بلوح شمسي;long storage charge care,العناية بالشحن أثناء التخزين',
  'air-fryer':'replacement basket availability,توافر سلة طهي بديلة;low smoke cooking maintenance,صيانة تقلل دخان الطهي;countertop heat spacing,مسافة الأمان حول الجهاز',
  'blender':'hot liquid lid venting,تنفيس غطاء السوائل الساخنة;replacement glass jar availability,توافر إبريق زجاج بديل;small quantity blade reach,وصول الشفرة للكميات الصغيرة',
  'coffee-machine':'used grounds disposal workflow,تفريغ بقايا القهوة وتنظيفها;descaling filter compatibility,توافق فلتر إزالة التكلس;shared household drink presets,حفظ إعدادات مشروبات الأسرة',
  'vacuum':'pet hair brush service parts,قطع صيانة فرشاة شعر الحيوانات;removable battery replacement,تغيير البطارية القابلة للفك;under furniture tool reach,وصول الملحقات أسفل الأثاث',
  'washer':'front door swing installation,مساحة فتح باب الغسالة;steam cycle garment label checks,فحص ملصق الملابس قبل البخار;drain filter cleaning access,سهولة الوصول لفلتر التصريف',
  'fridge':'removable drawer sanitation,تنظيف الأدراج القابلة للفك;appliance door hinge reversibility,إمكانية عكس مفصلة الباب;food thermometer shelf placement,موضع ميزان الحرارة بالثلاجة',
  'dishwasher':'hard water glass spot prevention,تقليل بقع الكؤوس من الماء العسر;wine glass upper rack fit,توافق رف الكؤوس الطويلة;under counter ventilation space,تهوية المساحة أسفل السطح',
  'sunscreen':'reapplication over tinted makeup,تجديد الواقي فوق المكياج;travel size label verification,التحقق من معلومات العبوة الصغيرة;body face formula differences,فروق تركيبة الوجه والجسم',
  'walking-shoe':'work dress code outsole fit,ملاءمة النعل لزي العمل;orthotic insert volume allowance,مساحة النعل الطبي داخل الحذاء;morning evening foot swelling,تغير قياس القدم خلال اليوم',
  'suitcase':'wheel bearing service options,خيارات صيانة محمل العجلات;side laptop access pocket,جيب الوصول السريع للابتوب;packing cube zipper compatibility,توافق حقائب تنظيم الأمتعة',
  'stroller':'infant carrier adapter verification,التحقق من محول مقعد الرضيع;elevator doorway width clearance,عرض العربة مع باب المصعد;fabric canopy washing label,ملصق تنظيف المظلة القماشية',
  'car-seat':'ISOFIX anchor access check,التحقق من نقاط تثبيت ISOFIX;removable seat cover care,العناية بغطاء المقعد القابل للفك;growth height limit labeling,قراءة حدود طول الطفل المسموح',
  'television':'room glare seating position,موضع الجلوس مع انعكاس الضوء;VESA wall mount screw fit,مطابقة براغي حامل VESA;set top box remote compatibility,توافق ريموت جهاز الاستقبال'
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,limit)=>{let x=String(value).trim();while(x.length>limit&&x.includes(' '))x=x.slice(0,x.lastIndexOf(' '));return x.length<=limit?x:''};
const suffix={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const sixthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const cases=questions[family];if(!cases)return [];
 return brands.split(';').map(x=>x.split(',')).flatMap(([enBrand,arBrand])=>
  cases.split(';').flatMap((pair,i)=>{
   const [enFocus,arFocus]=pair.split(',');
   return ['SA','AE'].flatMap(country=>{
    const english=country==='AE',brand=english?enBrand:arBrand,category=english?enCategory:arCategory;
    const focus=english?enFocus:arFocus,head=brand+' '+category+': ',tail=suffix[country];
    const fit=shorten(focus,72-head.length-tail.length);
    if(!fit)return [];
    const title=head+fit+tail;
    if(title.length<28||title.length>72)return [];
    const code=english?'NOV188':'NOV170',id=slug(enBrand)+'-'+family+'-'+slug(enFocus);
    return [{country,language:english?'en-AE':'ar-SA',brand,category,topic:title,coupon:code,
     slug:(english?'uae':'saudi')+'-buyer-'+id+'-'+code.toLowerCase()+'-2026-n6',
     queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n6-'+slug(enFocus),
     comparisonKey:'editorial-n6-'+family+'-'+i,
     sections:english?[
      'Why '+fit+' changes the '+category+' buying decision',
      'Compare '+enBrand+' versions and look for model specific documentation',
      'Check practical compatibility, missing features and ownership costs',
      'Verify Noon UAE seller terms, returns, warranty and '+code+' basket eligibility',
      'Final purchasing checklist and unanswered questions before checkout'
     ]:[
      'كيف يؤثر '+fit+' على قرار شراء '+category,
      'مقارنة إصدارات '+arBrand+' والبحث عن مستندات المواصفات',
      'فحص التوافق والملحقات والتكاليف المحتملة دون وعود غير موثقة',
      'التأكد من بائع نون السعودية والضمان والإرجاع وشروط '+code+' في السلة',
      'قائمة التحقق قبل الدفع والأسئلة التي تحتاج إجابة من البائع'
     ]}];
   });
  }));
}));
export const sixthEditorialWaveVersion='distinct-buyer-checks-n6-2026-11';
