// Lazily expand existing, already grounded N11 buyer questions into
// six genuinely distinct ownership decision lenses per market.
// Generates one topic on demand; does not materialize thousands of objects
// during a Free Workers Cron invocation (10 ms CPU budget).
export const DIRECT_TOPIC_SPACE_VERSION='n11-scoped-v1';
export const DIRECT_TOPIC_SCOPES=Object.freeze([
 {id:'h1',en:'everyday use',ar:'الاستخدام اليومي'},
 {id:'h2',en:'setup and storage',ar:'الإعداد والتخزين'},
 {id:'h3',en:'upkeep and replacement',ar:'الصيانة والاستبدال'},
 {id:'h4',en:'simple controls',ar:'سهولة التحكم'},
 {id:'h5',en:'existing accessories',ar:'التوافق مع الملحقات'},
 {id:'h6',en:'seller verification',ar:'التحقق من البائع'}
]);
export function directTopicSpaceLength(topics){
 if(!Array.isArray(topics))throw Error('INVALID_DIRECT_TOPICS');
 return topics.length*(1+DIRECT_TOPIC_SCOPES.length);
}
function trimTitle(text,max){
 const input=String(text||'').trim();
 if(input.length<=max)return input;
 const sliced=input.slice(0,max);
 const boundary=sliced.lastIndexOf(' ');
 return (boundary>=Math.max(16,max-22)?sliced.slice(0,boundary):sliced).trim();
}
export function directTopicAt(topics,index){
 if(!Array.isArray(topics)||!Number.isSafeInteger(index)||index<0||topics.length===0)
  throw Error('INVALID_DIRECT_TOPIC_INDEX');
 const original=topics[index%topics.length];
 const scopeNumber=Math.floor(index/topics.length);
 if(scopeNumber===0)return original;
 const scope=DIRECT_TOPIC_SCOPES[scopeNumber-1];
 if(!scope||!original||!['SA','AE'].includes(original.country))return null;
 const code=original.country==='AE'?'NOV188':'NOV170';
 const lang=original.country==='AE'?'en':'ar';
 const suffix=lang==='en'?' | Noon UAE NOV188':' | نون السعودية NOV170';
 const label=lang==='en'?' ('+scope.en+')':' ('+scope.ar+')';
 const titleHead=String(original.topic||'').split(' | ')[0];
 const maxHead=72-suffix.length-label.length;
 const head=trimTitle(titleHead,maxHead);
 const title=head+label+suffix;
 const slug=String(original.slug||'').replace(/-(nov170|nov188)-2026-n11$/,
  '-'+scope.id+'-$1-2026-n11');
 if(!head||title.length<28||title.length>72||slug===original.slug||slug.length>120)
  return null;
 const brand=String(original.brand||'');
 const focus=String(original.queryModifier||'');
 const sections=lang==='en'?[
  'Why '+scope.en+' matters when assessing '+focus,
  'What '+brand+' model facts to confirm for '+scope.en,
  'Compare realistic alternatives and ownership tradeoffs',
  'Check Noon UAE shipping returns and NOV188 only at checkout',
  'Practical buyer checklist and unresolved model questions'
 ]:[
  'كيف يؤثر '+scope.ar+' على قرار شراء '+String(original.category||''),
  'التحقق من خصائص موديل '+brand+' بدليل واضح',
  'مقارنة البدائل والتوافق وتكاليف الملكية دون افتراضات',
  'مراجعة شحن نون السعودية والإرجاع وشروط NOV170',
  'قائمة مراجعة المشتري والأسئلة قبل إتمام الدفع'
 ];
 return {...original,topic:title,slug,
  queryModifier:focus+' / '+scope.en,
  modelKey:String(original.modelKey||'')+'-'+scope.id,
  comparisonKey:String(original.comparisonKey||'')+'-'+scope.id,
  sections};
}
