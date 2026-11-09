// N7 append-only high-intent buying briefs for exhausted N6 stock.
// All topics are questions to VERIFY at the official listing; they do not
// assert product specifications, stock, delivery guarantees or coupon discounts.
import {establishedEditorialFamilies} from './topic-expansion.mjs';

const concerns=Object.freeze({
 'tablet':'stylus palm rejection for notes,رفض لمس راحة اليد عند الكتابة;USB C display output compatibility,توافق إخراج الشاشة عبر USB C;microSD offline course files,ملفات الدروس دون إنترنت عبر microSD;replacement stylus tip availability,توافر سن القلم البديل',
 'laptop':'HDMI 4K refresh rate support,دعم تردد 4K عبر HDMI;built in webcam privacy shutter,وجود غطاء خصوصية الكاميرا;travel battery watt hours label,قراءة ملصق سعة البطارية للسفر;keyboard layout language markings,توافق حروف لوحة المفاتيح',
 'phone':'travel eSIM activation options,خيارات تفعيل شريحة eSIM للسفر;NFC payment regional compatibility,توافق الدفع عبر NFC بالبلد;USB OTG external storage support,دعم وحدة تخزين خارجية عبر OTG;emergency contact shortcut setup,إعداد اختصار الاتصال بالطوارئ',
 'gaming-laptop':'USB C display alternate mode support,توافق الشاشة عبر منفذ USB C;headset wireless latency comparison,مقارنة تأخر سماعة الألعاب اللاسلكية;game streaming Ethernet adapter fit,توافق محول الإنترنت للألعاب;replaceable RAM slot documentation,توثيق منافذ ترقية الذاكرة',
 'monitor':'text scaling clarity at 125 percent,وضوح الخط مع تكبير العرض;HDR preset tuning for bright rooms,ضبط HDR للغرف المضيئة;stand height eye level alignment,ضبط ارتفاع الحامل للعين;picture in picture work setup,إعداد نافذتين في الشاشة للعمل',
 'printer':'WiFi Direct guest printing support,دعم طباعة الزائر عبر WiFi Direct;ink bottle shelf life labeling,قراءة صلاحية عبوة الحبر;two sided scan feeder access,سهولة استخدام ماسح الأوراق المزدوج;manual feed thick card guidance,إرشادات إدخال الورق السميك',
 'ssd':'Mac Windows shared filesystem choice,اختيار نظام ملفات بين ماك وويندوز;thermal throttling during large backups,تأثر الأداء بحرارة النسخ الطويل;enclosure NVMe protocol compatibility,توافق صندوق تخزين NVMe;drive health software availability,توافر برنامج فحص صحة القرص',
 'router':'mesh Ethernet backhaul planning,توصيل شبكة Mesh سلكيا;WPA3 compatibility with older devices,توافق WPA3 مع الأجهزة القديمة;apartment channel interference analysis,فحص ازدحام قنوات الواي فاي;parental network bedtime schedules,جدولة استخدام شبكة الأطفال',
 'earbuds':'single ear listening mode support,دعم الاستماع بسماعة واحدة;transparency mode comfort outdoors,راحة وضع الشفافية بالخارج;ear tip replacement sizing,مقاسات رؤوس السماعة البديلة;voice calls in noisy traffic comparison,مقارنة المكالمات وسط الضوضاء',
 'headphones':'multipoint laptop phone call switching,التبديل بين مكالمات الهاتف والكمبيوتر;boom microphone attachment options,خيارات توصيل ميكروفون منفصل;folding hinge serviceability check,إمكانية صيانة مفصلة الطي;wired listening with depleted battery,الاستماع السلكي عند نفاد البطارية',
 'powerbank':'carry on airline watt hour rules,التحقق من حدود سعة بطارية الطائرة;low current earbud charging mode,وضع شحن سماعات صغيرة التيار;charging temperature safety labeling,ملصق حدود حرارة الشحن;USB PD cable rating verification,التحقق من تصنيف كابل الشحن',
 'air-fryer':'basket liner airflow spacing,مرور الهواء مع ورق بطانة السلة;dishwasher safe coating care,العناية بطبقة السلة عند الغسيل;frozen food batch size guidance,اختيار حجم دفعة الطعام المجمد;removable tray handle safety,أمان مقبض الصينية القابلة للفك',
 'blender':'blade seal gasket replacement fit,توافق جوان محكم الشفرة;noise damping on kitchen counter,تقليل الاهتزاز فوق سطح المطبخ;jar temperature care limitations,حدود حرارة العناية بالإبريق;ice crushing blade rating check,التحقق من ملاءمة الشفرة للثلج',
 'coffee-machine':'milk frother cleaning after use,تنظيف فوهة الحليب بعد الاستخدام;reusable capsule size compatibility,توافق مقاس كبسولة قابلة لإعادة الاستخدام;water tank removal space clearance,مساحة خلع خزان الماء;cup height under coffee spout,ارتفاع الكوب تحت مخرج القهوة',
 'vacuum':'high pile rug brush suitability,ملاءمة الفرشاة للسجاد الوَبَري;corner nozzle for tile grout,فوهة تنظيف زوايا البلاط;dust bin emptying allergy comfort,تفريغ حاوية الغبار بصورة مريحة;wall mount installation clearance,مسافة تركيب الحامل على الحائط',
 'washer':'spin vibration flooring compatibility,توافق الاهتزاز مع أرضية الغرفة;detergent drawer removal for cleaning,خلع درج المنظف للتنظيف;small baby laundry load handling,التعامل مع حمولة ملابس الأطفال;inlet hose connection dimensions,مقاسات توصيل خرطوم المياه',
 'fridge':'transport wait before powering on,وقت الانتظار بعد نقل الثلاجة;door open alarm setting options,خيارات تنبيه الباب المفتوح;freezer drawer removal clearance,مساحة إخراج درج الفريزر;adjustable shelf heavy pot support,تحمل الرف القابل للتعديل',
 'dishwasher':'powder tablet detergent suitability,ملاءمة المنظف البودرة أو الأقراص;tall cutting board rack fit,ملاءمة لوح التقطيع الطويل;stainless cutlery spot prevention,تقليل آثار الماء على أدوات المائدة;filter rinse interval user access,الوصول لفلتر الغسالة وتنظيفه',
 'sunscreen':'water resistant minutes label meaning,معنى مدة مقاومة الماء على العبوة;eye area comfort ingredient check,مراجعة المكونات حول منطقة العين;unscented daily wear options,خيارات يومية دون عطر;SPF storage in high heat travel,تخزين الواقي أثناء السفر والحرارة',
 'walking-shoe':'wet pavement outsole grip checks,فحص تماسك النعل مع الأرض المبللة;heel slip lacing solutions,طرق ربط تقلل انزلاق الكعب;removable insole thickness comparison,مقارنة سمك النعل الداخلي;shoe toe box width fitting,قياس اتساع مقدمة الحذاء',
 'suitcase':'carry on sizer including wheels,قياس حقيبة المقصورة مع العجلات;lock replacement after key loss,خيارات استبدال القفل بعد الفقد;expandable case baggage fee tradeoff,أثر التوسعة على رسوم الأمتعة;handle extension height ergonomics,ارتفاع مقبض السحب وراحة الاستخدام',
 'stroller':'one hand folding latch check,فحص قفل الطي بيد واحدة;canopy sun protection label,قراءة ملصق حماية مظلة الشمس;front wheel lock on uneven paths,قفل العجلة الأمامية في الطرق غير المستوية;under seat storage basket access,سهولة الوصول لسلة التخزين',
 'car-seat':'vehicle seat belt locking method,كيفية تثبيت حزام المقعد بالسيارة;rear headrest seat alignment,توافق مسند الرأس الخلفي;airplane approval label verification,التحقق من ملصق اعتماد الطائرة;removable infant insert limits,حدود استخدام بطانة مقعد الرضيع',
 'television':'HDMI CEC remote control setup,إعداد التحكم المشترك عبر HDMI;closed captions accessibility options,خيارات الترجمة النصية في التلفاز;flush wall mount cable clearance,مساحة الكابلات مع حامل الحائط;game console input latency setting,إعداد تقليل تأخير الألعاب'
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,limit)=>{
 if(limit<8)return '';
 let x=String(value).trim();
 while(x.length>limit&&x.includes(' '))x=x.slice(0,x.lastIndexOf(' '));
 return x.length<=limit?x:'';
};
export const seventhEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
 const candidates=concerns[family];
 if(!candidates)return [];
 return brands.split(';').map(x=>x.split(',')).flatMap(([enBrand,arBrand])=>
  candidates.split(';').flatMap((item,i)=>{
   const [enFocus,arFocus]=item.split(',');
   if(!enFocus||!arFocus)return [];
   return ['SA','AE'].flatMap(country=>{
    const english=country==='AE';
    const code=english?'NOV188':'NOV170';
    const brand=english?enBrand:arBrand,category=english?enCategory:arCategory;
    const focus=english?enFocus:arFocus;
    const head=brand+' '+category+': ';
    const tail=english?' | Noon UAE NOV188':' | نون السعودية NOV170';
    const fit=shorten(focus,72-head.length-tail.length);
    if(!fit)return [];
    const topic=head+fit+tail;
    if(topic.length<28||topic.length>72)return [];
    const token=slug(enBrand)+'-'+family+'-'+slug(enFocus);
    return [{
      country,language:english?'en-AE':'ar-SA',brand,category,topic,coupon:code,
      slug:(english?'uae':'saudi')+'-buyer-'+token+'-'+code.toLowerCase()+'-2026-n7',
      queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n7-'+slug(enFocus),
      comparisonKey:'editorial-n7-'+family+'-'+i,
      sections:english?[
        'Which buyer question makes '+fit+' worth checking on this listing',
        'Find the exact '+enBrand+' model documentation and seller supplied details',
        'Compare compatibility, maintenance, accessories and ongoing ownership costs',
        'Check Noon UAE return and warranty terms plus NOV188 eligibility in the actual cart',
        'Decision checklist, evidence gaps and what to ask the official seller before payment'
      ]:[
        'متى تصبح مسألة '+fit+' مؤثرة في اختيار المنتج',
        'توثيق موديل '+arBrand+' المحدد والبحث عن معلومات البائع الأصلية',
        'مقارنة التوافق والصيانة والملحقات والتكاليف دون وعود غير موثقة',
        'مراجعة شروط بائع نون السعودية والإرجاع والضمان وقبول NOV170 بالسلة',
        'قائمة قرار الشراء والأسئلة التي تحتاج إلى دليل من البائع'
      ]
    }];
   });
  }));
}));
export const seventhEditorialWaveVersion='distinct-product-compatibility-checks-n7-2026-11';
