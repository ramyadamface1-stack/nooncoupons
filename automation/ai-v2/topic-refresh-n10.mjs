// N10 append-only reserve: distinct pre-purchase questions, not factual product promises.
// No price, stock, discount, warranty or eligibility guarantees. Native quality gates remain authoritative.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
const concerns=Object.freeze({
  "tablet": "stylus palm rejection handwriting notes,توافق القلم مع تجاهل لمس راحة اليد;keyboard case hinge angle for study,زوايا مفصلة لوحة المفاتيح للدراسة;school WiFi portal login compatibility,توافق تسجيل شبكة المدرسة;low light reading eye comfort settings,إعدادات راحة العين للقراءة ليلا",
  "laptop": "USB C display power delivery rating,قدرة منفذ الشاشة على شحن اللابتوب;SSD replacement panel access,سهولة الوصول لقرص التخزين;webcam privacy shutter confirmation,التحقق من غطاء خصوصية الكاميرا;keyboard layout region language fit,توافق توزيع لوحة المفاتيح مع اللغة",
  "phone": "eSIM transfer and recovery instructions,إرشادات نقل الشريحة الإلكترونية واستعادتها;NFC wallet regional compatibility,توافق الدفع اللاسلكي مع الدولة;walking video stabilization model evidence,توثيق تثبيت الفيديو أثناء المشي;USB C video output specification,التحقق من خروج الصورة عبر منفذ الهاتف",
  "gaming-laptop": "GPU power rating adapter requirements,توافق قدرة كرت الشاشة مع الشاحن;second SSD slot warranty access,إمكانية تركيب قرص إضافي دون فقد الضمان;external capture card USB bandwidth,توافق كارت التقاط الفيديو مع المنافذ;fan control software update support,دعم تحديث برنامج التحكم بالمراوح",
  "monitor": "VESA wall mount hole spacing,مسافات فتحات حامل الشاشة الجداري;USB C docking laptop charging rating,قدرة شحن اللابتوب عبر وصلة الشاشة;screen anti glare coating comparison,مقارنة طبقة تقليل الانعكاس;factory pixel defect return terms,شروط إرجاع الشاشة بسبب البكسلات",
  "printer": "automatic duplex scanning feeder evidence,توثيق ماسح الوجهين التلقائي;ink cartridge shelf storage dates,تعليمات تخزين خراطيش الحبر;wired network port compatibility,توافق منفذ الشبكة السلكي;edge to edge photo print capability,دعم طباعة الصور بلا هوامش",
  "ssd": "external enclosure thermal throttle evidence,توثيق ارتفاع حرارة علبة التخزين;drive endurance warranty TBW terms,شروط تحمل الكتابة ضمن الضمان;portable cable connector strain relief,حماية كابل القرص أثناء الحركة;secure erase vendor utility support,دعم برنامج المسح الآمن من الشركة",
  "router": "IPv6 internet provider setup compatibility,توافق إعداد اتصال الإنترنت السادس;WPA3 older smart devices coexistence,توافق حماية الشبكة مع الأجهزة القديمة;mesh wireless backhaul placement,اختيار أماكن وحدات الشبكة المتداخلة;USB shared storage permission controls,إعداد صلاحيات مشاركة التخزين",
  "earbuds": "multipoint call priority profile setup,ضبط أولوية المكالمات بين الأجهزة;single earbud microphone clarity test,وضوح الميكروفون بسماعة واحدة;charging case standby battery drain,استهلاك بطارية العلبة أثناء التخزين;sweat exposure warranty wording,مراجعة الضمان بعد التعرض للعرق",
  "headphones": "noise cancellation bus engine hum,تقييم العزل مع ضوضاء المواصلات;glasses frame pressure comfort fit,راحة ارتداء السماعة مع النظارة;headset button controls with gloves,سهولة التحكم عند ارتداء القفازات;wireless microphone codec on computer,توافق جودة الميكروفون مع الكمبيوتر",
  "powerbank": "airline watt hour label requirements,توثيق سعة الواط ساعة على العبوة;low current smartwatch charging mode,وضع شحن الساعة منخفض الاستهلاك;two port fast charging power split,توزيع القدرة بين منفذي الشحن;USB cable automatic wake behavior,بدء الشحن تلقائيا عند توصيل الكابل",
  "air-fryer": "basket seal food odor cleaning access,سهولة تنظيف روائح الطعام من السلة;preheat indicator recipe timing,توقيت التسخين قبل الطهي;silicone accessory basket airflow fit,توافق ملحق السيليكون مع تدفق الهواء;nonstick tray dishwasher instructions,تعليمات غسل الصينية غير اللاصقة",
  "blender": "hot soup temperature safety rating,حد حرارة الحساء الآمن بالخلاط;ice crush duty cycle documentation,تعليمات تشغيل تكسير الثلج;replacement lid gasket part number,معرفة رقم جلدة غطاء الخلاط;noise level small kitchen comparison,مقارنة الضوضاء في المطابخ الصغيرة",
  "coffee-machine": "drip tray full sensor availability,التحقق من حساس امتلاء الصينية;grinder retained coffee cleaning,تنظيف بقايا البن داخل المطحنة;decaf coffee dose adjustment options,إمكانية ضبط جرعة البن منزوع الكافيين;water filter replacement part fit,توافق رقم فلتر المياه البديل",
  "vacuum": "pet hair brush anti tangle proof,توثيق منع التفاف شعر الحيوانات;thick rug pile suction guidance,ملاءمة الشفط للسجاد السميك;wall edge cleaning head reach,وصول رأس المكنسة لحواف الحائط;wet floor mode maintenance rules,تعليمات صيانة وضع الأرضيات المبللة",
  "washer": "duvet bedding drum load guidelines,تعليمات تحميل الألحفة في الحلة;spin noise limits apartment use,مستوى صوت العصر في الشقة;steam cycle fabric label evidence,مطابقة دورة البخار مع بطاقة الملابس;drain pump filter service access,سهولة الوصول لفلتر مضخة الصرف",
  "fridge": "tall bottle shelf height adjustment,تعديل ارتفاع الرف للزجاجات الطويلة;door hinge reversal service instructions,تعليمات تغيير اتجاه فتح الباب;freezer fast freeze drawer capacity,سعة درج التجميد السريع;temperature alert after power outage,تنبيه الحرارة بعد انقطاع الكهرباء",
  "dishwasher": "rinse aid indicator refill timing,توقيت تعبئة مساعد الشطف;cutlery basket removable layout,مرونة توزيع سلة أدوات المائدة;large pot upper rack clearance,المساحة المتاحة للأواني الكبيرة;removable food filter cleaning routine,طريقة تنظيف فلتر بقايا الطعام",
  "sunscreen": "water resistance label duration proof,توثيق مدة مقاومة الماء المكتوبة;tinted formula clothing transfer review,أثر الواقي الملون على الملابس;fragrance allergen ingredients reading,قراءة مكونات العطور المسببة للحساسية;outdoor commute reapplication planning,جدولة إعادة وضع الواقي أثناء المشاوير",
  "walking-shoe": "rainy pavement grip outsole pattern,نقشة النعل للتماسك على الأرض المبللة;replacement insole dimensions fit,توافق مقاس الفرش الداخلي البديل;long walk heel cup stability,ثبات الكعب أثناء المشي الطويل;lace pressure top foot comfort,راحة ضغط الأربطة أعلى القدم",
  "suitcase": "cobblestone four wheel mobility,حركة العجلات فوق الأرض غير المستوية;airline handle total dimension limits,حساب أبعاد الحقيبة شاملة المقبض;combination lock reset instructions,طريقة إعادة ضبط قفل الأرقام;wheel repair kit parts availability,توفر قطع صيانة عجلات الحقيبة",
  "stroller": "newborn recline safety instructions,تعليمات إمالة المقعد للمولود;one hand fold luggage handling,سهولة الطي بيد واحدة;car seat adapter model compatibility,توافق محول مقعد السيارة مع العربة;rain cover airflow visibility,تهوية غطاء المطر ووضوح الرؤية",
  "car-seat": "side impact standard label evidence,توثيق معيار حماية الصدمات الجانبية;rear facing weight height limits,حدود الوزن والطول للوضع الخلفي;ISOFIX latch indicator confirmation,التحقق من مؤشر تثبيت القاعدة;seat recline installation angle guidance,زاوية إمالة المقعد عند التركيب",
  "television": "HDMI 2 1 input port label review,مراجعة ملصق منافذ HDMI الحديثة;sports motion processing artifacts evidence,ملاحظة تشوه حركة المباريات;game mode latency specification proof,توثيق تأخر الصورة في وضع الألعاب;Bluetooth headphone audio sync options,إعداد تزامن الصوت مع السماعة"
});
const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(value,limit)=>{
 if(limit<8)return '';
 let x=String(value).trim();
 while(x.length>limit&&x.includes(' '))x=x.slice(0,x.lastIndexOf(' '));
 return x.length<=limit?x:'';
};
export const tenthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(([family,enCategory,arCategory,brands])=>{
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
      slug:(english?'uae':'saudi')+'-buyer-'+token+'-'+code.toLowerCase()+'-2026-n10',
      queryModifier:enFocus,brandKey:slug(enBrand),modelKey:family+'-n10-'+slug(enFocus),
      comparisonKey:'editorial-n10-'+family+'-'+i,
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
export const tenthEditorialWaveVersion='verified-purchase-service-questions-n10-2026-11';
