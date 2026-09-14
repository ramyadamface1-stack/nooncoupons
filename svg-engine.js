const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const countryLabel=c=>c==='SA'?'Saudi Arabia':'UAE';
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

export function couponSvg({coupon='NOON10',country='SA',variant=1,brand='noon'}){
  const i=Math.max(1,Math.min(5,Number(variant)||1));
  const t=THEMES[i-1];
  const countryName=countryLabel(country);
  const cc=countryAccent(country);
  const code=esc(coupon);
  const brandText=esc(brand);
  const label=esc(countryName);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc">
<title id="title">${brandText} coupon ${code} — ${label}</title><desc id="desc">10% OFF coupon design for ${brandText} ${label}, code ${code}</desc>
<rect width="1200" height="760" rx="36" fill="${t.bg}"/>
${decor(i,t)}
<rect x="32" y="32" width="1136" height="696" rx="32" fill="${t.panel}" stroke="${t.ink}" stroke-opacity=".10"/>
<g font-family="Arial, Helvetica, sans-serif">
  <g transform="translate(72 68)"><rect width="220" height="58" rx="18" fill="${t.bg}" stroke="${t.ink}" stroke-opacity=".25" stroke-dasharray="7 7"/><circle cx="31" cy="29" r="14" fill="${cc}"/><text x="56" y="38" font-size="24" font-weight="700" fill="${t.ink}">${label}</text></g>
  <text x="1115" y="110" text-anchor="end" font-size="48" font-weight="900" fill="${t.ink}">${brandText}</text><circle cx="982" cy="91" r="29" fill="${t.accent}"/><path d="M970 77a20 20 0 1 0 27 29" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/>
  <text x="600" y="250" text-anchor="middle" font-size="132" font-weight="900" fill="${t.ink}">10%</text>
  <g transform="translate(760 168) rotate(-4)"><rect width="150" height="72" rx="16" fill="${t.accent}"/><text x="75" y="51" text-anchor="middle" font-size="42" font-weight="900" fill="#111">OFF</text></g>
  <text x="600" y="310" text-anchor="middle" font-size="30" font-weight="700" fill="${t.ink}">${brandText.charAt(0).toUpperCase()+brandText.slice(1)} + Coupon</text>
  <g transform="translate(245 342)"><rect width="710" height="220" rx="26" fill="${t.bg}" stroke="${t.ink}" stroke-width="5" stroke-dasharray="16 12"/><rect x="38" y="36" width="634" height="102" rx="18" fill="${t.accent}"/><text x="355" y="108" text-anchor="middle" font-size="72" font-weight="900" letter-spacing="3" fill="#111">${code}</text><text x="355" y="180" text-anchor="middle" font-size="24" font-weight="800" fill="${t.ink}">SAVE 10% • NEW &amp; EXISTING USERS</text></g>
  <g transform="translate(353 602)"><rect width="230" height="72" rx="20" fill="${t.ink}"/><text x="126" y="47" text-anchor="middle" font-size="26" font-weight="800" fill="${t.panel}">Copy it</text><rect x="31" y="23" width="22" height="25" rx="3" fill="none" stroke="${t.panel}" stroke-width="3"/><rect x="40" y="15" width="22" height="25" rx="3" fill="none" stroke="${t.panel}" stroke-width="3"/></g>
  <g transform="translate(616 602)"><rect width="230" height="72" rx="20" fill="${t.accent}"/><text x="126" y="47" text-anchor="middle" font-size="26" font-weight="900" fill="#111">Try it</text><path d="M38 44V24h20M38 24l24 24M50 24h18v18" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text x="92" y="690" font-size="18" font-weight="700" fill="${t.muted}">COUPON CARD 0${i}</text>
</g></svg>`;
}

export function svgAlt({coupon,country,variant}){
  return `Noon ${countryLabel(country)} coupon ${coupon} — 10% OFF promotional design ${variant}`;
}

export function noonUrl(){return 'https://www.noon.com/';}
