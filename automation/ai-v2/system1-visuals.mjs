// SYSTEM1 V3 canary-only five design renderer. This does NOT change the
// existing production article renderer or claim that all articles have 5 assets.
// Output SVGs are real 1600x1000 standalone files with English visible text.
import {createHash} from 'node:crypto';
const WIDTH=1600,HEIGHT=1000;
const kinds=['featured-hero','product-commerce','modern-geometric','lifestyle-context','minimal-explainer'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const english=s=>/^[A-Za-z0-9 .&_-]{1,60}$/.test(String(s||''))?String(s).trim():'Noon Shopping Guide';
const safeSlug=s=>/^[a-z0-9-]{16,120}$/.test(String(s||''));
export function validateVisualInput(input){
 if(!input||!safeSlug(input.slug)||!['SA','AE'].includes(input.country)||
    (input.country==='SA'&&input.coupon!=='NOV170')||
    (input.country==='AE'&&input.coupon!=='NOV188'))
   throw Error('INVALID_SYSTEM1_VISUAL_INPUT');
 return {slug:input.slug,country:input.country,
  coupon:input.coupon,brand:english(input.brand)};
}
function svgShell({title,description,background,contents}){
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+WIDTH+'" height="'+HEIGHT+'" viewBox="0 0 1600 1000" role="img" aria-label="'+esc(description)+'">'+
   '<title>'+esc(title)+'</title><desc>'+esc(description)+'</desc>'+
   '<rect width="1600" height="1000" fill="'+background+'"/>'+
   '<g font-family="Arial, Helvetica, sans-serif">'+contents+'</g></svg>';
}
const t=(x,y,value,size=46,color='#142338',weight=800,anchor='middle')=>'<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-size="'+size+'" fill="'+color+'" font-weight="'+weight+'">'+esc(value)+'</text>';
const round=(x,y,w,h,r,color,stroke='none')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+color+'" stroke="'+stroke+'"/>';
const group=(x,y,html)=>'<g transform="translate('+x+' '+y+')">'+html+'</g>';
function codeCard(code,variant){
 const bg=variant==='dark'?'#FEEE00':'#0f243b',fg=variant==='dark'?'#101827':'#FEEE00';
 return round(-305,-99,610,193,32,bg)+t(0,-29,'COUPON CODE',27,fg)+t(0,48,code,76,fg,900);
}
function hero({brand,country,code}){
 const scene='<circle cx="1260" cy="170" r="240" fill="#FEEE00" opacity=".22"/>'+
 '<circle cx="260" cy="860" r="350" fill="#E7F2FA" opacity=".83"/>'+
 round(66,64,1468,868,64,'#fff',' #e7edf2')+
 t(790,155,'NOON SHOPPING GUIDE',39,'#16243b',900)+
 t(790,235,brand,84,'#1b2531',900)+
 t(790,301,country,36,'#33597a')+
 group(800,516,codeCard(code,'light'))+
 t(800,754,'Compare the offer at checkout',39,'#34445b')+
 t(800,840,'Check seller, delivery and eligibility',25,'#6b7e90');
 return svgShell({title:brand+' guide and '+code,description:'Featured guide for Noon '+country+' featuring '+code,background:'#f9fbfd',contents:scene});
}
function product({brand,country,code}){
 const phone=group(220,200,round(0,0,330,560,45,'#192e43')+
  round(25,28,280,500,30,'#e8f2fd')+round(88,58,150,17,9,'#263c55')+
  round(60,126,210,245,28,'#b4d4e9')+'<circle cx="165" cy="250" r="70" fill="#e4f2ff"/>'+
  t(165,438,'COMPARE',31,'#1e3950')+round(85,471,160,23,10,'#86a5bb'));
 const box=group(575,260,round(0,0,245,400,15,'#f6e8c5','#d8c4a2')+
  round(0,0,245,100,10,'#f4d882')+t(123,68,'CHECKOUT',27,'#2a302f')+
  round(60,158,125,126,15,'#f8f8ed')+t(123,235,'NOON',28,'#243342'));
 const right=round(960,130,540,740,44,'#fff')+
  t(1230,250,'PRODUCT GUIDE',42,'#12273f')+t(1230,331,brand,57,'#253445')+
  t(1230,400,country,30,'#5a6a7e')+
  group(1230,582,'<g transform="scale(.77)">'+codeCard(code,'dark')+'</g>')+
  t(1230,785,'Check price and warranty',27,'#3e5363');
 return svgShell({title:brand+' product shopping guide',description:'Product commerce shopping illustration '+code+' '+country,background:'#eff4f9',contents:phone+box+right});
}
function geometric({brand,country,code}){
 const grid=Array.from({length:12},(_,i)=>'<path d="M'+(i*150)+' 0V1000" stroke="#293f59" opacity=".16"/>').join('')+
  Array.from({length:7},(_,i)=>'<path d="M0 '+(i*155)+'H1600" stroke="#293f59" opacity=".12"/>').join('');
 const shapes='<circle cx="1460" cy="110" r="380" fill="#FEEE00"/>'+
 '<path d="M0 1000L700 300L1100 1000Z" fill="#1b344b"/>'+
 '<path d="M1100 0L1600 310L1160 720Z" fill="#fae753"/>'+
 round(180,150,1200,715,42,'#ffffff','#d8dfe8')+
 t(800,260,'DESIGN + SHOP SMART',49,'#172e45')+
 t(800,347,brand,73,'#132943')+
 group(800,565,codeCard(code,'light'))+
 t(800,774,country+' · Official store at checkout',30,'#526b79');
 return svgShell({title:'Geometric Noon '+brand+' coupon card',description:'Modern geometric coupon artwork '+code,background:'#e4eaf2',contents:grid+shapes});
}
function lifestyle({brand,country,code}){
 const sky='<circle cx="1340" cy="210" r="260" fill="#FEEE00" opacity=".55"/>'+
 '<path d="M0 730 Q600 550 1600 750V1000H0Z" fill="#e5f2eb"/>';
 const bag=group(190,215,'<path d="M80 150H530L470 680H140Z" fill="#e5cc9a" stroke="#947e5f" stroke-width="8"/>'+
 '<path d="M205 170V70Q305 -45 405 70V170" fill="none" stroke="#887556" stroke-width="22"/>'+
 '<circle cx="305" cy="360" r="94" fill="#f0dfb7"/>'+t(305,383,'NOON',45,'#3b4a43'));
 const scene=round(740,120,770,770,45,'#fff','#e9e2d5')+
 t(1125,260,'SHOP WITH CONTEXT',40,'#2d4051')+
 t(1125,344,brand,67,'#253849')+
 t(1125,413,country,31,'#586d7f')+
 group(1125,610,'<g transform="scale(.9)">'+codeCard(code,'dark')+'</g>')+
 t(1125,827,'Review the checkout total',27,'#425e69');
 return svgShell({title:'Lifestyle shopping context for '+brand,description:'Lifestyle-style shopping scene with '+code,background:'#fff9f0',contents:sky+bag+scene});
}
function minimal({brand,country,code}){
 const shapes=round(70,70,1460,860,30,'#fff','#111')+
 '<path d="M90 390H1510" stroke="#111" stroke-width="5"/>'+
 '<path d="M90 786H1510" stroke="#111" stroke-width="4"/>'+
 t(800,193,'NOON · SHOPPING CHECKLIST',30,'#475569')+
 t(800,308,brand.toUpperCase(),74,'#101827')+
 group(800,585,codeCard(code,'dark'))+
 t(800,855,country+' · Confirm final eligibility',27,'#506073');
 return svgShell({title:'Minimal '+brand+' coupon explainer',description:'Minimal monochrome code explainer '+code,background:'#fbfbfb',contents:shapes});
}
export function createSystem1VisualSet(input){
 const d=validateVisualInput(input),country=d.country==='SA'?'SAUDI ARABIA':'UNITED ARAB EMIRATES';
 const params={brand:d.brand,country,code:d.coupon};
 const engines=[hero,product,geometric,lifestyle,minimal];
 return kinds.map((kind,i)=>{
   const svg=engines[i](params);
   return {kind,filename:kind+'.svg',width:WIDTH,height:HEIGHT,
     mediaType:'image/svg+xml',alt:'Noon '+country+' '+d.brand+' '+d.coupon+' '+kind.replace(/-/g,' '),
     sha256:createHash('sha256').update(svg).digest('hex'),svg};
 });
}
export function inspectSystem1VisualSet(files){
 if(!Array.isArray(files)||files.length!==5)return {ok:false,reason:'VISUAL_COUNT_NOT_FIVE'};
 const names=new Set(),hashes=new Set();
 for(const f of files){
  if(!kinds.includes(f?.kind)||names.has(f.kind)||hashes.has(f?.sha256))return {ok:false,reason:'DUPLICATE_VISUAL'};
  names.add(f.kind);hashes.add(f.sha256);
  if(f.width!==1600||f.height!==1000||!f.svg.includes('width="1600" height="1000"')||
     !f.svg.startsWith('<svg ')||!f.svg.endsWith('</svg>')||
     /[\u0600-\u06ff]/.test(f.svg)||/\b\d+% OFF\b/i.test(f.svg)||
     !/NOV170|NOV188/.test(f.svg))return {ok:false,reason:'VISUAL_CONTRACT_INVALID'};
  if(createHash('sha256').update(f.svg).digest('hex')!==f.sha256)
    return {ok:false,reason:'VISUAL_HASH_MISMATCH'};
 }
 return {ok:true,assetCount:5,dimensions:[1600,1000],uniqueHashes:5,
   visualHumanReviewed:false,scope:'single_canary_only'};
}
export const SYSTEM1_VISUAL_KINDS=kinds;
