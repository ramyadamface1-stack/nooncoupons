const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const countryLabel=c=>c==='SA'?'Saudi Arabia':'UAE';
const countryLabelAr=c=>c==='SA'?'السعودية':'الإمارات';
const countryAccent=c=>c==='SA'?'#087A3E':'#D71920';

const THEMES=[
  {bg:'#FFFDF0',panel:'#FFFFFF',accent:'#FEEE00',ink:'#111111',muted:'#5F6368',soft:'#FFF7B8',shape:'circles'},
  {bg:'#111111',panel:'#1C1C1C',accent:'#FEEE00',ink:'#FFFFFF',muted:'#D4D4D4',soft:'#2A2A2A',shape:'grid'},
  {bg:'#F6FAFF',panel:'#FFFFFF',accent:'#FEEE00',ink:'#111827',muted:'#667085',soft:'#DFF2FF',shape:'waves'},
  {bg:'#FFF6F1',panel:'#FFFFFF',accent:'#FEEE00',ink:'#171717',muted:'#6B7280',soft:'#FFE0D2',shape:'blocks'},
  {bg:'#F8F8F5',panel:'#FFFFFF',accent:'#FEEE00',ink:'#0B0B0B',muted:'#616161',soft:'#E8F5E9',shape:'stripes'}
];

function decor(i,t){
  if(i===1)return `<g opacity=".18"><circle cx="86" cy="120" r="58" fill="${t.accent}"/><circle cx="1110" cy="650" r="120" fill="${t.accent}"/><circle cx="1040" cy="110" r="36" fill="${t.ink}"/></g>`;
  if(i===2)return `<g opacity=".12" stroke="${t.accent}" stroke-width="2">${Array.from({length:12},(_,n)=>`<path d="M${40+n*100} 40v680"/>`).join('')}${Array.from({length:8},(_,n)=>`<path d="M40 ${40+n*90}h1120"/>`).join('')}</g>`;
  if(i===3)return `<g opacity=".24" fill="none" stroke="${t.soft}" stroke-width="28"><path d="M-40 560 C220 420 330 760 610 560 S1030 390 1260 560"/><path d="M-20 150 C240 10 410 350 680 150 S1010 -10 1240 170"/></g>`;
  if(i===4)return `<g opacity=".5"><rect x="35" y="470" width="210" height="210" rx="36" fill="${t.soft}"/><rect x="1020" y="70" width="130" height="130" rx="26" fill="${t.accent}"/><rect x="925" y="580" width="225" height="90" rx="24" fill="${t.soft}"/></g>`;
  return `<g opacity=".17" stroke="${t.ink}" stroke-width="12">${Array.from({length:8},(_,n)=>`<path d="M${-70+n*190} 760L${260+n*190} 0"/>`).join('')}</g>`;
}

export function couponSvg({coupon='OPS32',country='SA',variant=1,brand='noon',title=''}) {
  const i=Math.max(1,Math.min(5,Number(variant)||1));
  const t=THEMES[i-1];
  const countryName=countryLabel(country);
  const countryAr=countryLabelAr(country);
  const cc=countryAccent(country);
  const code=esc(coupon);
  const brandText=esc(brand);
  const topicLines=wrapTitle(title||'دليل كوبونات نون',34).slice(0,2).map(esc);
  const titleSvg=topicLines.map((line,idx)=>`<text x="1090" y="${286+idx*70}" text-anchor="end" direction="rtl" unicode-bidi="plaintext" font-size="${idx===0?52:46}" font-weight="900" fill="${t.ink}">${line}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc">
<title id="title">${esc(title||brandText+' coupon guide')} — ${code}</title>
<desc id="desc">دليل عن نون ${esc(countryAr)} مع كود ${code}. تحقق من الأهلية والنتيجة داخل السلة.</desc>
<rect width="1200" height="760" rx="34" fill="${t.bg}"/>
${decor(i,t)}
<rect x="34" y="34" width="1132" height="692" rx="30" fill="${t.panel}" stroke="${t.ink}" stroke-opacity=".09"/>
<g font-family="Arial, Tahoma, Helvetica, sans-serif">
  <g transform="translate(70 66)">
    <rect width="215" height="54" rx="17" fill="${t.bg}" stroke="${t.ink}" stroke-opacity=".18"/>
    <circle cx="29" cy="27" r="13" fill="${cc}"/>
    <text x="54" y="36" font-size="22" font-weight="800" fill="${t.ink}">${esc(countryName)}</text>
  </g>
  <text x="1090" y="105" text-anchor="end" font-size="38" font-weight="900" fill="${t.ink}">${brandText}</text>
  <rect x="1010" y="72" width="48" height="48" rx="14" fill="${t.accent}"/>
  <text x="1034" y="106" text-anchor="middle" font-size="24" font-weight="900" fill="#111">%</text>

  <text x="1090" y="214" text-anchor="end" direction="rtl" font-size="20" font-weight="800" fill="${t.muted}">دليل شراء وكوبونات نون</text>
  ${titleSvg}

  <g transform="translate(70 244)">
    <rect width="330" height="255" rx="24" fill="${t.bg}" stroke="${t.ink}" stroke-opacity=".12"/>
    <text x="165" y="58" text-anchor="middle" direction="rtl" font-size="18" font-weight="800" fill="${t.muted}">كود للتجربة</text>
    <rect x="38" y="82" width="254" height="92" rx="17" fill="${t.accent}"/>
    <text x="165" y="143" text-anchor="middle" font-size="52" font-weight="900" letter-spacing="3" fill="#111">${code}</text>
    <text x="165" y="207" text-anchor="middle" direction="rtl" font-size="16" font-weight="800" fill="${t.ink}">تحقق من النتيجة داخل السلة</text>
  </g>

  <line x1="70" y1="560" x2="1090" y2="560" stroke="${t.ink}" stroke-opacity=".12"/>
  <text x="1090" y="620" text-anchor="end" direction="rtl" font-size="19" font-weight="800" fill="${t.ink}">كوبونات نون · محتوى مستقل</text>
  <text x="1090" y="657" text-anchor="end" direction="rtl" font-size="16" fill="${t.muted}">السوق: ${esc(countryAr)} · الأهلية والخصم يحددهما متجر نون وقت الطلب</text>
  <g transform="translate(70 595)">
    <rect width="230" height="62" rx="18" fill="${t.ink}"/>
    <text x="115" y="40" text-anchor="middle" direction="rtl" font-size="20" font-weight="900" fill="${t.panel}">انسخ الكود</text>
  </g>
</g>
</svg>`;
}

function wrapTitle(title,max=48){
  const words=String(title||'').trim().split(/\s+/);const lines=[];let line='';
  for(const w of words){const next=(line+' '+w).trim();if(next.length>max&&line){lines.push(line);line=w}else line=next}
  if(line)lines.push(line);return lines.slice(0,3);
}

export function featuredSvg({title='دليل كوبونات نون',coupon='OPS32',country='SA',brand='noon'}){
  const label=esc(countryLabel(country));const cc=countryAccent(country);const code=esc(coupon);const brandText=esc(brand);const lines=wrapTitle(title,43).map(esc);
  const text=lines.map((l,i)=>`<text x="80" y="${330+i*74}" font-size="56" font-weight="900" fill="#111827">${l}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="ft fd">
<title id="ft">${esc(title)}</title><desc id="fd">Featured Noon ${label} article image with promo code ${code}. Saving and eligibility should be checked at checkout.</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFDE7"/><stop offset="1" stop-color="#FFF"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-opacity=".12"/></filter></defs>
<rect width="1600" height="900" fill="url(#bg)"/><circle cx="1430" cy="130" r="250" fill="#FEEE00" opacity=".35"/><circle cx="1460" cy="780" r="300" fill="#111" opacity=".045"/><path d="M0 760 C260 640 390 880 690 730 S1160 600 1600 720V900H0Z" fill="#FEEE00" opacity=".24"/>
<g font-family="Arial, Helvetica, sans-serif"><g transform="translate(78 68)"><rect width="290" height="72" rx="22" fill="#fff" stroke="#111" stroke-opacity=".22" stroke-dasharray="9 7"/><circle cx="38" cy="36" r="18" fill="${cc}"/><text x="72" y="46" font-size="30" font-weight="800" fill="#111">${label}</text></g>
<text x="1510" y="120" text-anchor="end" font-size="62" font-weight="900" fill="#111">${brandText}</text><circle cx="1325" cy="94" r="38" fill="#FEEE00"/><path d="M1307 77a27 27 0 1 0 36 39" fill="none" stroke="#111" stroke-width="10" stroke-linecap="round"/>
<text x="80" y="245" font-size="27" font-weight="800" fill="#6B7280" letter-spacing="2">SHOPPING &amp; COUPON GUIDE</text>${text}
<g transform="translate(1040 230)" filter="url(#shadow)"><rect width="440" height="500" rx="42" fill="#fff"/><text x="220" y="120" text-anchor="middle" font-size="76" font-weight="900" fill="#111">NOON</text><g transform="translate(268 55) rotate(-5)"><rect width="130" height="68" rx="16" fill="#FEEE00"/><text x="65" y="47" text-anchor="middle" font-size="31" font-weight="900" fill="#111">GUIDE</text></g><text x="220" y="175" text-anchor="middle" font-size="27" font-weight="800" fill="#111">Noon coupon</text><rect x="42" y="215" width="356" height="172" rx="26" fill="#FFFBE0" stroke="#111" stroke-width="4" stroke-dasharray="14 10"/><rect x="73" y="247" width="294" height="78" rx="15" fill="#FEEE00"/><text x="220" y="302" text-anchor="middle" font-size="52" font-weight="900" fill="#111">${code}</text><text x="220" y="357" text-anchor="middle" font-size="15" font-weight="800" fill="#111">VERIFY AT CHECKOUT</text><rect x="75" y="418" width="135" height="54" rx="16" fill="#111"/><text x="142" y="453" text-anchor="middle" font-size="21" font-weight="800" fill="#fff">Copy code</text><rect x="230" y="418" width="135" height="54" rx="16" fill="#FEEE00"/><text x="297" y="453" text-anchor="middle" font-size="19" font-weight="900" fill="#111">Try at Noon</text></g>
<text x="80" y="800" font-size="25" font-weight="700" fill="#475467">Smart shopping • clear coupon testing • verify before payment</text></g></svg>`;
}

export function svgAlt({coupon,country,variant}){
  return `Noon ${countryLabel(country)} promo code ${coupon} — coupon card ${variant}`;
}

export function noonUrl(){return 'https://www.noon.com/';}
