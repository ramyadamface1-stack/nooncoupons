// N5: append-only small buyer intent reserve for exhausted prior editorial waves.
// No model call happens when this module is loaded. All five-section articles
// still require R2 checkpoint uniqueness, public URL preflight and native 95+ QA.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const concerns=Object.freeze({
  'tablet':'offline annotation workflow,التدوين دون إنترنت;shared study file storage,تخزين ملفات الدراسة المشتركة',
  'laptop':'USB C charging wattage,قدرة الشحن عبر USB;camera privacy cover,غطاء خصوصية الكاميرا',
  'phone':'work profile privacy,خصوصية حساب العمل;accessible text sizing,تكبير النص لسهولة القراءة',
  'gaming-laptop':'VR headset connectivity,توصيل نظارة الواقع الافتراضي;game recording storage,تخزين تسجيلات الألعاب',
  'monitor':'portrait screen ergonomics,وضع الشاشة الرأسي;flicker at low brightness,وميض الشاشة مع الإضاءة الضعيفة',
  'printer':'secure PIN printing,الطباعة برمز سري;document feeder choices,اختيار مغذي المستندات',
  'ssd':'heat on long transfers,الحرارة أثناء النقل الطويل;cross system file access,صلاحيات الملفات بين الأنظمة',
  'router':'smart home 2.4 GHz fit,توافق أجهزة المنزل الذكي;busy hour video calls,مكالمات الفيديو وقت الضغط',
  'earbuds':'equalizer app usability,سهولة ضبط الصوت بالتطبيق;replacement case options,خيارات استبدال علبة الشحن',
  'headphones':'comfort while wearing glasses,الراحة أثناء ارتداء النظارة;wired use on flights,الاستخدام السلكي بالطائرة',
  'powerbank':'laptop charging suitability,ملاءمة شحن اللابتوب;charging while recharging,الشحن أثناء إعادة الشحن',
  'air-fryer':'frozen meal cooking,طهي الوجبات المجمدة;small portion results,نتائج الكميات الصغيرة',
  'blender':'nut butter consistency,قوام زبدة المكسرات;dishwasher jar compatibility,توافق الإبريق مع الغسالة',
  'coffee-machine':'milk frother disassembly,فك أجزاء رغوة الحليب;cabinet height clearance,المسافة أسفل خزائن المطبخ',
  'vacuum':'car seat crevice cleaning,تنظيف شقوق مقاعد السيارة;low sofa access,الوصول أسفل الأريكة',
  'washer':'bulky bedding cycles,برامج غسل المفروشات;delayed cycle start,تأخير بدء دورة الغسيل',
  'fridge':'produce drawer humidity,رطوبة درج الخضراوات;noise near bedrooms,ضوضاء الثلاجة قرب غرفة النوم',
  'dishwasher':'baby bottle wash settings,إعدادات غسل رضاعات الأطفال;water softness controls,إعداد عسر المياه',
  'sunscreen':'sensitive eye area use,الاستخدام قرب منطقة العين;reapplication reminders,تذكير تجديد واقي الشمس',
  'walking-shoe':'work dress compatibility,التوافق مع زي العمل;orthotic insole fit,توافق النعل الطبي',
  'suitcase':'replacement wheel access,إمكانية تغيير العجلات;packing weight balance,توزيع وزن الأمتعة',
  'stroller':'elevator turning room,مساحة الدوران في المصعد;rain cover airflow,التهوية مع غطاء المطر',
  'car-seat':'seat belt routing check,فحص مسار حزام المقعد;air travel seat approval,التحقق من اعتماد المقعد للطائرة',
  'television':'voice dialogue boost,تعزيز وضوح الحوار;screen cleaning safely,تنظيف الشاشة بأمان'
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,limit)=>{let x=String(value).trim();while(x.length>limit&&x.includes(' '))x=x.slice(0,x.lastIndexOf(' '));return x.length<=limit?x:''};
const suffix={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const fifthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const cases=concerns[family];if(!cases)return [];
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
     slug:(english?'uae':'saudi')+'-buyer-'+id+'-'+code.toLowerCase()+'-2026-n5',
     queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n5-'+slug(enFocus),
     comparisonKey:'editorial-n5-'+family+'-'+i,
     sections:english?[
      category+': decide whether '+fit+' fits the actual buyer situation',
      'Compare '+enBrand+' models on the specific '+enFocus+' limitation',
      'Verify Noon UAE seller, warranty, returns and '+code+' cart eligibility',
      'Check alternatives, compatibility and practical ownership trade-offs',
      'Decision checklist, final checkout total and questions for the seller'
     ]:[
      category+' وفحص '+fit+' بحسب احتياج المشتري',
      'مقارنة موديلات '+arBrand+' وحدود المواصفات المرتبطة بالاستخدام',
      'مراجعة بائع نون السعودية والضمان والإرجاع وأهلية '+code+' في السلة',
      'التحقق من البدائل والتوافق ومخاطر '+fit+' دون وعود غير موثقة',
      'قائمة القرار والتكلفة النهائية والأسئلة قبل الشراء'
     ]}];
   });
  }));
}));
export const fifthEditorialWaveVersion='reviewed-distinct-ownership-questions-n5-2026-11';
