import {couponSvg,featuredSvg,SVG_LAYOUT_INFO} from './svg-engine.js';

const fail=(msg)=>{throw new Error(msg)};
const title='كود نون لشراء عدة منتجات دايسون والأجهزة المنزلية في السعودية مع مقارنة الأبعاد والسعر النهائي قبل الدفع';
const codes=['NOV170','NOV188'];
for(let v=1;v<=5;v++){
  for(const country of ['SA','AE']){
    const svg=couponSvg({coupon:country==='AE'?codes[1]:codes[0],country,variant:v,brand:'noon',title});
    if(!svg.includes('viewBox="0 0 1200 760"'))fail('coupon viewBox '+v);
    if(!svg.includes('preserveAspectRatio="xMidYMid meet"'))fail('coupon preserveAspectRatio '+v);
    if(/text-anchor="start"[^>]*direction="rtl"|direction="rtl"[^>]*text-anchor="start"/i.test(svg))fail('unsafe rtl start anchor '+v);
    if(/<text x="110"[^>]*direction="rtl"/i.test(svg))fail('unsafe left rtl title '+v);
    if(!/overflow="hidden"/i.test(svg))fail('coupon overflow guard '+v);
  }
}
const featured=featuredSvg({title,coupon:'NOV170',country:'SA',brand:'noon'});
if(!featured.includes('viewBox="0 0 1600 900"'))fail('featured viewBox');
if(!featured.includes('preserveAspectRatio="xMidYMid meet"'))fail('featured preserveAspectRatio');
if(!featured.includes('x="515"'))fail('featured safe title center');
if(/text-anchor="start"[^>]*direction="rtl"|direction="rtl"[^>]*text-anchor="start"/i.test(featured))fail('featured unsafe rtl anchor');
if(Number(SVG_LAYOUT_INFO?.version)!==9)fail('layout version');
if(SVG_LAYOUT_INFO?.rtlTitleAnchoring!=='middle')fail('rtl title anchoring');
console.log(JSON.stringify({ok:true,variants:5,countries:2,layout:SVG_LAYOUT_INFO}));
