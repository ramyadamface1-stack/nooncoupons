const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const countryLabel=c=>c==='SA'?'Saudi Arabia':'UAE';
const countryAccent=c=>c==='SA'?'#087A3E':'#D71920';
// Promotional artwork is English-only for both markets. The article's original
// Arabic title remains in HTML (and image alt text) for language accessibility.
// Never print an Arabic title, or a meaningless slug, on an English SVG.
export function englishArtworkTitle(value){
  const raw=String(value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  if(!raw)return 'Noon coupon and shopping guide';
  if(/[\u0600-\u06ff]/.test(raw)){
    const labels=[
      [/آيفون|ايفون|أيفون|iphone/i,'iPhone shopping guide'],
      [/سامسونج|samsung/i,'Samsung shopping guide'],
      [/هواتف|جوال|موبايل|هاتف|محمول/i,'Mobile phone shopping guide'],
      [/لابتوب|لاب توب|كمبيوتر|حاسوب/i,'Laptop and computer guide'],
      [/سماعات|ايربودز|إيربودز/i,'Audio shopping guide'],
      [/عطور|عطر|برفان|perfume/i,'Fragrance shopping guide'],
      [/أزياء|احذية|أحذية|حذاء|ملابس|موضة/i,'Fashion shopping guide'],
      [/مطبخ|منزل|أجهزة منزلية/i,'Home shopping guide'],
      [/بقالة|سوبر ماركت|غذائية/i,'Grocery shopping guide']
    ];
    return labels.find(([re])=>re.test(raw))?.[1]||'Noon coupon and shopping guide';
  }
  const text=raw.replace(/[^\x20-\x7e]/g,'').replace(/\s+/g,' ').trim();
  return text.length>76?text.slice(0,76).replace(/\s+\S*$/,'').trim():text||'Noon coupon and shopping guide';
}

const THEMES=[
  {bg:'#FFFDF0',panel:'#FFFFFF',accent:'#FEEE00',ink:'#111111',muted:'#5F6368',soft:'#FFF7B8',shape:'circles'},
  {bg:'#111111',panel:'#1C1C1C',accent:'#FEEE00',ink:'#FFFFFF',muted:'#D4D4D4',soft:'#2A2A2A',shape:'grid'},
  {bg:'#F6FAFF',panel:'#FFFFFF',accent:'#FEEE00',ink:'#111827',muted:'#667085',soft:'#DFF2FF',shape:'waves'},
  {bg:'#FFF6F1',panel:'#FFFFFF',accent:'#FEEE00',ink:'#171717',muted:'#6B7280',soft:'#FFE0D2',shape:'blocks'},
  {bg:'#F8F8F5',panel:'#FFFFFF',accent:'#FEEE00',ink:'#0B0B0B',muted:'#616161',soft:'#E8F5E9',shape:'stripes'}
];

function titleSeed(s){let n=0;for(const ch of String(s||''))n=(n*31+ch.charCodeAt(0))>>>0;return n}
function decor(i,t){
  if(i===1)return `<g opacity=".18"><circle cx="86" cy="120" r="58" fill="${t.accent}"/><circle cx="1110" cy="650" r="120" fill="${t.accent}"/><circle cx="1040" cy="110" r="36" fill="${t.ink}"/></g>`;
  if(i===2)return `<g opacity=".12" stroke="${t.accent}" stroke-width="2">${Array.from({length:12},(_,n)=>`<path d="M${40+n*100} 40v680"/>`).join('')}${Array.from({length:8},(_,n)=>`<path d="M40 ${40+n*90}h1120"/>`).join('')}</g>`;
  if(i===3)return `<g opacity=".24" fill="none" stroke="${t.soft}" stroke-width="28"><path d="M-40 560 C220 420 330 760 610 560 S1030 390 1260 560"/><path d="M-20 150 C240 10 410 350 680 150 S1010 -10 1240 170"/></g>`;
  if(i===4)return `<g opacity=".5"><rect x="35" y="470" width="210" height="210" rx="36" fill="${t.soft}"/><rect x="1020" y="70" width="130" height="130" rx="26" fill="${t.accent}"/><rect x="925" y="580" width="225" height="90" rx="24" fill="${t.soft}"/></g>`;
  return `<g opacity=".17" stroke="${t.ink}" stroke-width="12">${Array.from({length:8},(_,n)=>`<path d="M${-70+n*190} 760L${260+n*190} 0"/>`).join('')}</g>`;
}

// v12: coupon-first 1600x1000 artwork. Deterministic and portable SVG;
// all old featured SVGs are regenerated from the verified R2 listing at deploy.
// The Saudi rendition carries the owner's requested Arabic headline, while
// the UAE en-AE variant remains English. Neither promises a discount amount.
export function couponSvg({coupon='NOV170',country='SA',variant=1,brand='noon',title=''}) {
 const v=Math.max(1,Math.min(5,Number(variant)||1));
 const sa=country!=='AE',countryName=sa?'Saudi Arabia':'UAE',marketName=sa?'السعودية':'UAE';
 const code=esc(coupon),topic=englishArtworkTitle(title);
 const headline=sa?'كوبون خصم نون':'NOON DISCOUNT COUPON';
 const tones=[
  {dark:'#101c2d',shade:'#1d3550',soft:'#f5f7fc'},
  {dark:'#111827',shade:'#273449',soft:'#fffcef'},
  {dark:'#123344',shade:'#22576b',soft:'#f1fbff'},
  {dark:'#2a233d',shade:'#453764',soft:'#f9f5ff'},
  {dark:'#192b2a',shade:'#285450',soft:'#f3faf4'}
 ][v-1];
 const lines=wrapTitle(topic,25).slice(0,2);
 const topicMarkup=lines.map((line,i)=>'<text x="1240" y="'+(554+i*54)+'" text-anchor="middle" font-size="'+(i===0?39:34)+'" font-weight="850" fill="#162339">'+esc(line)+'</text>').join('');
 const headlineSize=sa?96:69;
 const accent=sa?'#14834b':'#cc2835';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet" overflow="hidden" role="img" aria-labelledby="premiumTitle premiumDesc" data-noon-cover="coupon-first-v12">'+
  '<title id="premiumTitle">'+esc(topic)+' — '+code+' | Noon '+countryName+' Coupon</title>'+
  '<desc id="premiumDesc">'+esc(countryName)+' Noon shopping coupon artwork. Use '+code+' and confirm eligibility at the store checkout.</desc>'+
  '<defs><linearGradient id="coverBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+tones.dark+'"/><stop offset="1" stop-color="'+tones.shade+'"/></linearGradient>'+
  '<filter id="coverShadow"><feDropShadow dx="0" dy="14" stdDeviation="21" flood-opacity=".17"/></filter>'+
  '<pattern id="fineDots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="#fff" opacity=".14"/></pattern></defs>'+
  '<rect width="1600" height="1000" fill="'+tones.soft+'"/>'+
  '<path d="M0 0H1600V150H0Z" fill="#feee00"/>'+
  '<path d="M0 895H1600V1000H0Z" fill="'+tones.dark+'"/>'+
  '<g font-family="Tahoma, Arial, sans-serif">'+
  // Brand and country are clear even in 320px mobile thumbnail.
  '<g transform="translate(78 36)"><rect width="68" height="68" rx="19" fill="'+tones.dark+'"/>'+
  '<text x="34" y="50" text-anchor="middle" font-size="45" font-weight="950" fill="#feee00">N</text></g>'+
  '<text x="166" y="91" font-size="46" font-weight="950" fill="'+tones.dark+'">noon</text>'+
  '<text x="518" y="89" font-size="25" font-weight="800" fill="'+tones.dark+'">DEALS NOW</text>'+
  '<rect x="1255" y="38" width="270" height="70" rx="35" fill="'+tones.dark+'"/>'+
  '<circle cx="1300" cy="73" r="13" fill="'+accent+'"/>'+
  '<text x="1395" y="85" font-size="27" text-anchor="middle" font-weight="850" fill="#fff">'+countryName+'</text>'+
  // The coupon is a legible yellow ticket, not a tiny secondary caption.
  '<rect x="65" y="193" width="995" height="660" rx="45" fill="url(#coverBg)" filter="url(#coverShadow)"/>'+
  '<rect x="82" y="210" width="960" height="625" rx="35" fill="url(#fineDots)"/>'+
  '<text x="562" y="271" text-anchor="middle" font-size="28" font-weight="850" letter-spacing="3" fill="#feee00">NOON DEALS NOW</text>'+
  '<text x="562" y="411" text-anchor="middle" font-size="'+headlineSize+'" font-weight="950" fill="#ffffff"'+
  (sa?' direction="rtl" unicode-bidi="plaintext"':'')+'>'+headline+'</text>'+
  '<text x="563" y="465" text-anchor="middle" font-size="26" font-weight="700" fill="#d9e2ec">'+
  (sa?'NOON DISCOUNT COUPON':'Noon UAE Shopping & Coupon Guide')+'</text>'+
  '<rect x="177" y="512" width="771" height="220" rx="33" fill="#feee00"/>'+
  '<rect x="188" y="522" width="749" height="200" rx="27" fill="none" stroke="'+tones.dark+'" stroke-width="4" stroke-dasharray="14 13"/>'+
  '<circle cx="177" cy="622" r="26" fill="'+tones.dark+'"/><circle cx="948" cy="622" r="26" fill="'+tones.dark+'"/>'+
  '<text x="562" y="663" text-anchor="middle" font-size="136" font-weight="950" letter-spacing="4" fill="'+tones.dark+'">'+code+'</text>'+
  '<text x="562" y="787" text-anchor="middle" font-size="22" font-weight="800" fill="#e8f1fb">CHECK THE FINAL CART TOTAL AT NOON</text>'+
  // Editorial topic distinguishes articles without burying the coupon.
  '<rect x="1095" y="203" width="430" height="640" rx="38" fill="#fff" stroke="#dfe5ee" stroke-width="3"/>'+
  '<rect x="1131" y="244" width="358" height="77" rx="18" fill="#feee00"/>'+
  '<text x="1310" y="294" text-anchor="middle" font-size="28" font-weight="950" fill="'+tones.dark+'">NOON COUPON</text>'+
  '<text x="1310" y="402" text-anchor="middle" font-size="30" font-weight="850" fill="#344054">'+esc(marketName)+'</text>'+
  '<path d="M1140 446H1480" stroke="#e2e8f0" stroke-width="3"/>'+
  topicMarkup+
  '<rect x="1171" y="690" width="277" height="88" rx="20" fill="'+tones.dark+'"/>'+
  '<text x="1310" y="746" text-anchor="middle" font-size="29" font-weight="950" fill="#fff">NOON '+countryName+'</text>'+
  '<text x="85" y="956" font-size="25" font-weight="800" fill="#fff">NoonDealsNow.com</text>'+
  '<text x="1518" y="956" text-anchor="end" font-size="21" fill="#d4dbe6">Independent coupon guide • Terms at checkout</text>'+
  '</g></svg>';
}

function wrapTitle(title,max=48){
  const words=String(title||'').trim().split(/\s+/);const lines=[];let line='';
  for(const w of words){const next=(line+' '+w).trim();if(next.length>max&&line){lines.push(line);line=w}else line=next}
  if(line)lines.push(line);return lines.slice(0,3);
}

export function featuredSvg({title='Noon coupon guide',coupon='NOV170',country='SA',brand='noon'}){
 return couponSvg({title,coupon,country,brand,variant:2});
}

export function svgAlt({coupon,country,variant}){
  return `Noon ${countryLabel(country)} promo code ${coupon} — coupon card ${variant}`;
}

export function noonUrl(){return 'https://www.noon.com/';}

export const SVG_LAYOUT_INFO={version:12,couponCanvas:[1600,1000],featuredCanvas:[1600,1000],safeAreaPx:70,preserveAspectRatio:'xMidYMid meet',titleAnchoring:'middle'};
