// Append-only N12: original, category-specific buying questions for the
// Cloudflare-native engine after the N11 candidate space was used up.
// Never mutate N1-N11 topics/IDs. Descriptive research questions only; no
// invented product specifications, prices, official promotions or eligibility.
import {establishedEditorialFamilies} from './topic-expansion.mjs';
export const N12_TOPIC_CATALOG_VERSION='n12-original-buyer-questions-v1';
const questions=Object.freeze({
 'tablet':[['stylus tip replacement compatibility','توافق رؤوس القلم البديلة'],['USB C external monitor display output','خروج الصورة لشاشة خارجية عبر USB C']],
 'laptop':[['replaceable RAM versus soldered memory','الرام القابلة للتغيير مقابل المدمجة'],['USB C charging wattage required','قدرة شحن اللابتوب عبر USB C']],
 'phone':[['eSIM and physical SIM regional variant support','دعم الشرائح الإلكترونية والعادية حسب النسخة'],['software update coverage by exact model','مدة تحديثات النظام لرقم الموديل']],
 'gaming-laptop':[['M2 expansion slot and heat shield access','فتحة توسعة SSD وغطاء التبريد'],['power adapter rating under gaming load','قدرة محول الكهرباء أثناء الألعاب']],
 'monitor':[['VESA mount hole spacing and stand clearance','مقاس تثبيت VESA والمساحة خلف الشاشة'],['USB C charging power and video together','الشحن والصورة معا عبر USB C']],
 'printer':[['automatic document feeder duplex scanning','المسح التلقائي للوجهين عبر مغذي الورق'],['starter cartridge yield versus replacement cost','سعة الحبر الأولي مقابل تكلفة الاستبدال']],
 'ssd':[['thermal throttling during long file copies','هبوط السرعة بسبب الحرارة مع الملفات الكبيرة'],['USB enclosure compatibility and encryption','توافق علبة القرص الخارجية والتشفير']],
 'router':[['IPv6 provider compatibility and setup menus','توافق IPv6 مع مزود الخدمة وخياراته'],['WPA3 and older device fallback support','دعم WPA3 مع الأجهزة القديمة']],
 'mesh':[['wired backhaul mixing across node models','توصيل الوحدات المختلفة عبر كابل شبكة'],['whole home roaming while video calling','انتقال الاتصال بين الوحدات أثناء المكالمات']],
 'earbuds':[['ear tip replacement size and seal fit','مقاسات القطع المطاطية البديلة وعزل الصوت'],['microphone wind noise handling on calls','التعامل مع ضجيج الرياح أثناء المكالمات']],
 'headphones':[['replaceable earpad availability by model','توافر وسائد الأذن البديلة للموديل'],['wired microphone support over analog cable','عمل الميكروفون مع الكابل السلكي']],
 'soundbar':[['ARC versus eARC connection compatibility','توافق توصيل ARC وeARC مع التلفزيون'],['wall mounting bracket and clearance','متطلبات حامل الحائط ومسافة التهوية']],
 'smartwatch':[['offline navigation without a phone','الملاحة دون اتصال بالهاتف'],['replacement strap lug width by model','عرض تثبيت السوار البديل حسب الموديل']],
 'fitness-band':[['export fitness data into other apps','تصدير بيانات الرياضة لتطبيقات أخرى'],['battery drain during continuous tracking','استهلاك البطارية مع التتبع المستمر']],
 'powerbank':[['airline watt hour capacity labeling','توثيق واط ساعة للسفر بالطائرة'],['USB C input output simultaneous behavior','الشحن والدخل والخرج المتزامن عبر USB C']],
 'gan-charger':[['PPS voltage support for fast charging','دعم نطاق الجهد PPS للشحن السريع'],['power distribution when all ports are used','توزيع القدرة عند تشغيل كل المنافذ']],
 'usb-dock':[['DisplayLink driver dependence versus native video','الحاجة إلى تعريف DisplayLink مقابل الصورة المباشرة'],['PD pass through power loss under load','فقد قدرة الشحن أثناء مرور الكهرباء']],
 'webcam':[['USB bandwidth at high resolution frame rate','سرعة USB المطلوبة للدقة ومعدل الإطارات'],['physical shutter and recording indicator','الغطاء الفعلي ومؤشر تشغيل الكاميرا']],
 'keyboard':[['Bluetooth multipoint switching workflow','التبديل بين عدة أجهزة عبر بلوتوث'],['key switch socket compatibility by layout','توافق مقابس المفاتيح مع التخطيط']],
 'gaming-mouse':[['polling rate impact on battery life','تأثير معدل الاستجابة على البطارية'],['replacement skates shape and size','مقاسات قواعد الانزلاق البديلة']],
 'air-fryer':[['usable basket surface versus stated litres','مساحة السلة الفعلية مقارنة بالسعة المعلنة'],['dishwasher safe removable tray verification','إمكانية غسل الصينية القابلة للفك في الغسالة']],
 'blender':[['replacement rubber gasket identification','تحديد حلقة الإغلاق المطاطية البديلة'],['ice crushing instructions and duty cycle','تعليمات طحن الثلج وفترة تشغيل المحرك']],
 'coffee-machine':[['milk system cleaning after each use','تنظيف نظام الحليب بعد كل استخدام'],['water filter cartridge part identification','تحديد رقم فلتر المياه البديل']],
 'vacuum':[['hard floor scratching risks by brush type','خطر خدش الأرضيات حسب نوع الفرشاة'],['replacement filter washing versus buying','غسل الفلتر أو استبداله حسب التعليمات']],
 'air-purifier':[['CADR room sizing and ceiling height','حساب مساحة الغرفة ومعدل الهواء النقي'],['replacement HEPA filter model compatibility','توافق فلتر HEPA البديل مع رقم الموديل']],
 'humidifier':[['distilled water guidance and mineral buildup','نوع المياه وتراكم الأملاح في الخزان'],['automatic shutoff and humidity sensor placement','الإيقاف التلقائي وموضع حساس الرطوبة']],
 'microwave':[['usable plate diameter versus cavity width','قطر الطبق المناسب مقارنة بعرض الحجرة'],['ventilation clearance for cabinet fitting','مسافات التهوية عند التركيب داخل خزانة']],
 'washer':[['stacking kit compatibility with dryer model','توافق عدة تثبيت المجفف فوق الغسالة'],['machine levelling and vibration feet','تسوية أرجل الغسالة لمنع الاهتزاز']],
 'fridge':[['door hinge reversal installation details','إمكانية عكس اتجاه فتح باب الثلاجة'],['installation clearance for heat ventilation','المسافة اللازمة للتهوية عند وضع الثلاجة']],
 'dishwasher':[['panel integrated versus freestanding fit','ملاءمة الغسالة المدمجة مقابل المنفصلة'],['detergent tablet compartment clearance','مساحة حجرة قرص المنظف وطريقة وضعه']],
 'hair-dryer':[['diffuser nozzle attachment diameter fit','توافق قطر موزع الهواء مع الفوهة'],['heat protection temperature control evidence','توثيق التحكم في درجة الحرارة لحماية الشعر']],
 'shaver':[['foil head replacement model and interval','رقم رأس الحلاقة البديل وموعد تغييره'],['wet cleaning waterproof rating instructions','تعليمات غسل الجهاز حسب تصنيف مقاومة الماء']],
 'toothbrush':[['brush head cross model compatibility','توافق رؤوس الفرشاة بين الموديلات'],['pressure warning types and sensitivity','أنواع تنبيه الضغط وحساسية المستشعر']],
 'sunscreen':[['water resistance label duration evidence','مدة مقاومة الماء المعلنة على العبوة'],['opening date and storage heat guidance','تاريخ فتح الواقي وطريقة حفظه من الحرارة']],
 'moisturizer':[['ingredient list changes across regional packs','اختلاف قائمة المكونات بين العبوات الإقليمية'],['pump versus jar hygiene for daily use','نظافة عبوة المضخة مقابل البرطمان']],
 'running-shoe':[['midsole cushioning firmness for long runs','صلابة توسيد النعل للركض الطويل'],['toe box width and sizing by manufacturer','اتساع مقدمة الحذاء ومقاس الشركة']],
 'walking-shoe':[['orthotic insole depth after removal','مساحة النعل الطبي بعد إزالة النعل الأصلي'],['outsole wet surface grip evidence','تقييم تماسك النعل على الأرض المبللة']],
 'suitcase':[['wheel replacement availability and mount fit','توافر عجلات بديلة وتوافق التثبيت'],['expanded suitcase cabin baggage dimensions','أبعاد الحقيبة بعد توسيعها للطائرة']],
 'stroller':[['one hand fold while carrying essentials','إمكانية طي العربة بيد واحدة أثناء الحمل'],['newborn recline angle documentation','توثيق وضع الاستلقاء للرضيع']],
 'car-seat':[['ISOFIX vehicle anchor compatibility checks','توافق تثبيت ISOFIX مع السيارة'],['rear facing weight and height limits','حدود الطول والوزن للوضع الخلفي']],
 'smart-camera':[['local storage overwrite and retention rules','إعداد الكتابة فوق التسجيلات ومدة حفظها'],['privacy mask zones on shared accounts','مناطق إخفاء التصوير للحسابات المشتركة']],
 'smart-plug':[['power restoration state after an outage','حالة المقبس عند عودة الكهرباء'],['motor appliance load rating safety','حدود الأحمال للأجهزة ذات المحركات']],
 'projector':[['projection offset and ceiling mount geometry','إزاحة الصورة ومتطلبات حامل السقف'],['room light versus ANSI brightness claims','إضاءة الغرفة مقابل معيار سطوع ANSI']],
 'controller':[['stick drift deadzone adjustment options','ضبط المنطقة الميتة لانحراف عصا التحكم'],['console and PC connection mode switching','التبديل بين وضع الكونسول والكمبيوتر']],
 'speaker':[['multi speaker pairing compatibility limits','حدود توافق ربط أكثر من سماعة'],['USB charging while playing audio','تشغيل الصوت أثناء الشحن عبر USB']],
 'baby-bottle':[['steriliser basket height bottle fit','توافق طول الرضاعة مع سلة المعقم'],['nipple flow rate labeling by age','علامات سرعة تدفق الحلمة حسب العمر']],
 'food-processor':[['blade disc dishwasher safe labeling','توافق شفرات التقطيع مع غسالة الصحون'],['kneading bowl maximum dough quantity','الكمية القصوى للعجين في وعاء المحضر']],
 'pressure-cooker':[['safety valve cleaning access instructions','تعليمات الوصول لصمام الأمان وتنظيفه'],['replacement sealing ring size and part code','مقاس حلقة الإغلاق البديلة ورقمها']],
 'cookware':[['induction base material compatibility test','التحقق من مادة قاعدة الإناء للطبخ الحثي'],['oven safe handle heat limit labeling','حد تحمل مقبض الإناء للفرن']],
 'kettle':[['minimum water level for one cup','حد الماء الأدنى لغلي كوب واحد'],['limescale filter removal and spare availability','فك فلتر الترسبات وتوافر بديل']],
 'television':[['HDMI 2.1 port capability per input','قدرات منافذ HDMI 2.1 لكل مدخل'],['wall bracket VESA and cable access','مقاس حامل التلفزيون والوصول للكابلات']]
});
const slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shorten=(text,max)=>{
 if(max<8)return '';
 let value=String(text).trim();
 while(value.length>max&&value.includes(' '))value=value.slice(0,value.lastIndexOf(' '));
 return value.length<=max?value:'';
};
const end={SA:' | نون السعودية NOV170',AE:' | Noon UAE NOV188'};
export const twelfthEditorialTopicWave=Object.freeze(establishedEditorialFamilies.flatMap(
 ([family,categoryEN,categoryAR,rawBrands])=>{
 const questionsForFamily=questions[family];
 if(!Array.isArray(questionsForFamily)||questionsForFamily.length!==2)throw Error('N12_MISSING_OR_INVALID_QUESTIONS_'+family);
 return rawBrands.split(';').flatMap(rawBrand=>{
  const [brandEN,brandAR]=rawBrand.split(',');
  return questionsForFamily.flatMap(([focusEN,focusAR],i)=>['SA','AE'].flatMap(country=>{
   const en=country==='AE',code=en?'NOV188':'NOV170';
   const brand=en?brandEN:brandAR,category=en?categoryEN:categoryAR,focus=en?focusEN:focusAR;
   const tail=end[country],lead=brand+' '+category+': ',specific=shorten(focus,72-lead.length-tail.length);
   if(!specific||specific.length<9)return [];
   const name=(en?'uae':'saudi')+'-buyer-'+slug(brandEN)+'-'+family+'-q'+(i+1)+'-'+
    slug(focusEN).slice(0,36).replace(/-$/,'')+'-'+code.toLowerCase()+'-2026-n12';
   if(name.length>120||name.length<16||name.includes('--'))return [];
   return [{
    country,language:en?'en-AE':'ar-SA',brand,category,
    topic:lead+specific+tail,coupon:code,slug:name,
    queryModifier:focusEN,brandKey:slug(brandEN),modelKey:family+'-n12-q'+(i+1),
    comparisonKey:'editorial-n12-'+family+'-q'+(i+1),
    sections:en?[
     'Buyer question: '+specific+' and which exact model evidence to check',
     'Compatibility boundaries for '+brandEN+' '+categoryEN+' without guessing specs',
     'Compare seller documentation and realistic purchase tradeoffs',
     'Verify Noon UAE listing details, warranty, returns and NOV188 at checkout',
     'Practical decision checklist and what remains unverified'
    ]:[
     'قرار الشراء: '+specific+' وطريقة جمع أدلة الموديل',
     'مقارنة خصائص '+brandAR+' '+categoryAR+' دون افتراض مواصفات',
     'أسئلة للبائع عن التوافق والتكلفة والضمان',
     'التحقق من عرض نون السعودية والإرجاع وشروط NOV170 في السلة',
     'قائمة أسئلة عملية قبل اعتماد الشراء دون وعود غير موثقة'
    ]
   }];
  }));
 });
}));
export const N12_EXPECTED_FAMILY_COUNT=Object.keys(questions).length;
