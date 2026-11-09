// N8: distinct shopper questions to verify before payment; not product claims or articles.
// No price, delivery, stock, valid-discount guarantees or edits to existing content.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const concerns=Object.freeze({
  "tablet": "detachable keyboard magnetic fit,توافق تثبيت لوحة المفاتيح المغناطيسية;pen hover drawing setup,إعداد القلم قبل ملامسة الشاشة;separate family account sign in,فصل حسابات أفراد الأسرة;handwriting screen film friction,احتكاك واقي الشاشة أثناء الكتابة",
  "laptop": "dock connected screen flicker,وميض الشاشة مع موزع المنافذ;fan noise for study spaces,ضوضاء المروحة أثناء الدراسة;replacement keyboard key service,توافر أزرار لوحة مفاتيح بديلة;closed lid external screen sleep,السكون أثناء إغلاق الغطاء",
  "phone": "offline map storage planning,مساحة خرائط الملاحة دون إنترنت;display dimming on video call,تعتيم الشاشة أثناء المكالمة;cross brand backup restore,استعادة نسخ احتياطية بين الهواتف;separate messaging account support,دعم حسابين في تطبيق المراسلة",
  "gaming-laptop": "quiet mode meeting use,وضع الهدوء في الاجتماعات;capture card input support,توافق بطاقة التقاط الفيديو;charger cable bend protection,حماية سلك شاحن الألعاب;frame cap battery setting,ضبط حد الإطارات لتوفير الطاقة",
  "monitor": "single cable charging wattage,قدرة الشحن بكابل واحد;antiglare coating cleaning,تنظيف طبقة منع الانعكاس;VESA screw depth safety,عمق مسامير حامل الشاشة;documents color preset review,وضع ألوان مراجعة المستندات",
  "printer": "offline driver download,تنزيل تعريف طابعة دون إنترنت;replacement paper feed rollers,بكرات إدخال الورق البديلة;borderless photo page support,دعم طباعة الصور دون حواف;small batch cost per page,تكلفة الطباعة للدفعات الصغيرة",
  "ssd": "phone direct backup power needs,متطلبات الطاقة للنسخ من الهاتف;read only data recovery mode,وضع استعادة البيانات للقراءة;backup checksum verification,تأكيد سلامة النسخ بالبصمة;short cable connector stress,حماية الوصلة من الشد",
  "router": "fiber modem WAN port fit,توافق منفذ WAN مع مودم الألياف;wall mounting antenna space,المسافة المناسبة لهوائيات الحائط;local DNS filtering settings,إعدادات تصفية DNS المنزلية;Ethernet cable class choice,اختيار فئة كابل إيثرنت",
  "earbuds": "Bluetooth audio codec matching,توافق ترميز بلوتوث بين الأجهزة;call voice feedback adjustment,ضبط سماع صوتك في المكالمة;water resistance rating evidence,دليل تصنيف مقاومة الماء;companion app sound presets,إعدادات الصوت في التطبيق",
  "headphones": "ear cushion replacement size,مقاس وسادة الأذن البديلة;sound leakage shared office,تسرب الصوت في المكتب المشترك;airplane audio adapter choice,اختيار وصلة صوت للطائرة;headband fit for glasses,ملاءمة العصابة مع النظارة",
  "powerbank": "included cable output rating,تصنيف الكابل المرفق;remaining charge indicator accuracy,دقة مؤشر الشحن المتبقي;pass through charging capability,دعم شحن البطارية أثناء الاستخدام;shared output port watt limits,حدود توزيع القدرة بين المخارج",
  "air-fryer": "preheat display accessibility,وضوح مؤشر التسخين المسبق;maximum cooking timer duration,أقصى مدة لمؤقت الطهي;kitchen counter vent clearance,مسافة التهوية فوق سطح المطبخ;grease trap cleaning access,سهولة تنظيف مصيدة الدهون",
  "blender": "lid gasket leak inspection,فحص تسرب غطاء الخلاط;pulse chop consistency controls,التحكم بتقطيع الطعام بالنبض;motor base cupboard footprint,مساحة تخزين قاعدة المحرك;jar material odor removal,إزالة الروائح من الإبريق",
  "coffee-machine": "ground coffee holder compatibility,توافق حاوية البن المطحون;automatic descaling alert options,خيارات تنبيه إزالة التكلس;brewing temperature settings,اختيار حرارة تحضير القهوة;drip tray removal clearance,مساحة إخراج صينية التنقيط",
  "vacuum": "pet hair brush replacements,بدائل فرشاة شعر الحيوانات;charging dock position choices,خيارات وضع قاعدة الشحن;filter grade label validation,توثيق درجة الفلتر على الملصق;door threshold wheel height,ارتفاع عجلات عبور عتبات الأبواب",
  "washer": "delayed start control options,خيارات تأجيل موعد التشغيل;cold laundry cycle availability,توافر دورة الغسيل الباردة;child lock access inspection,فحص زر قفل الأطفال;drain hose length measurement,قياس طول خرطوم التصريف",
  "fridge": "acoustic decibel label review,مراجعة تصنيف الضوضاء بالديسيبل;reversible door hinge check,فحص إمكانية عكس مفصلة الباب;power voltage nameplate check,التحقق من جهد الكهرباء بالملصق;crisper humidity slider design,تصميم ضبط رطوبة درج الخضار",
  "dishwasher": "half load program presence,وجود برنامج نصف حمولة;child lock interface controls,إعدادات قفل الأطفال;clearance for tall drinking cups,مساحة الأكواب الطويلة;rinse aid refill indicator,مؤشر تعبئة مساعد الشطف",
  "sunscreen": "mineral filter label comparison,مقارنة مرشحات الوقاية المعدنية;under makeup product pilling,تكتل الواقي تحت المكياج;patch testing for sensitive skin,تجربة الواقي على مساحة صغيرة;expiry code interpretation,تفسير رمز تاريخ الصلاحية",
  "walking-shoe": "removable arch support insole,إمكانية نزع دعامة قوس القدم;heel height drop comparison,مقارنة ارتفاع كعب الحذاء;wide foot sizing chart,دليل مقاسات القدم العريضة;replacement shoelace length,اختيار طول الرباط البديل",
  "suitcase": "empty cabin luggage weight,وزن حقيبة السفر دون محتويات;replaceable spinner wheel parts,قطع غيار عجلات الحقيبة;rolling sound across tile floors,صوت دوران العجلات على البلاط;internal zip pockets storage,استخدام الجيوب الداخلية بسحاب",
  "stroller": "folded size in car boot,المقاس بعد الطي في صندوق السيارة;seat recline angle labeling,زاوية إمالة المقعد في الدليل;rain cover attachment matching,توافق غطاء المطر وطريقة تثبيته;foot brake pedal accessibility,سهولة استخدام دواسة الفرامل",
  "car-seat": "ISOFIX vehicle model compatibility,توافق ISOFIX مع موديل السيارة;forward facing manual restrictions,قيود التوجيه للأمام في الدليل;side impact test certification,شهادات اختبار التصادم الجانبي;washable seat cover removal,طريقة إزالة غطاء المقعد للغسل",
  "television": "regional app store availability,توافر متجر التطبيقات بالمنطقة;Bluetooth audio delay settings,إعدادات تأخر صوت بلوتوث;text reading viewing distance,مسافة مشاهدة النصوص على الشاشة;voice remote language support,دعم لغة الأوامر الصوتية",
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,limit)=>{
 if(limit<8)return '';
 let x=String(value).trim();
 while(x.length>limit&&x.includes(' '))x=x.slice(0,x.lastIndexOf(' '));
 return x.length<=limit?x:'';
};
export const eighthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
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
      slug:(english?'uae':'saudi')+'-buyer-'+token+'-'+code.toLowerCase()+'-2026-n8',
      queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n8-'+slug(enFocus),
      comparisonKey:'editorial-n8-'+family+'-'+i,
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
export const seventhEditorialWaveVersion='fresh-buyer-service-questions-n8-2026-11';
