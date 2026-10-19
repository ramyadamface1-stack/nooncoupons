import {BRANDS,CATEGORIES} from './commerce-taxonomy.js';
const origin='https://noondealsnow.com';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function serializeSchema(node){return JSON.stringify(node).replace(/</g,'\u003c')}
export function brandDirectoryResponse(req){
  const u=new URL(req.url);
  if(req.method!=='GET'||u.pathname.replace(/\/+$/,'')!=='/brands')return null;
  const rows=Object.entries(BRANDS).filter(([slug,brand])=>/^[a-z0-9-]+$/.test(slug)&&brand?.label);
  const entries=rows.map(([slug,brand],i)=>{
    const category=CATEGORIES[brand.categories?.[0]]?.label||'منتجات نون';
    return '<article class="card"><h2>'+esc(brand.label)+' <small>'+esc(brand.short||'')+'</small></h2><p>'+esc(category)+'</p><p><a href="/saudi/brand/'+slug+'">نون السعودية</a> · <a href="/uae/brand/'+slug+'">نون الإمارات</a></p></article>';
  }).join('');
  const title='دليل براندات وماركات نون في السعودية والإمارات';
  const canonical=origin+'/brands',description='اكتشف صفحات البراندات والأقسام على نون السعودية ونون الإمارات. قارن البائع والتوصيل وأهلية كوبون الخصم داخل السلة قبل الدفع.';
  const structured={'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':origin+'/#organization',name:'Noon Deals Now',url:origin+'/'},
    {'@type':'CollectionPage','@id':canonical+'#webpage',name:title,url:canonical,description,inLanguage:'ar'},
    {'@type':'ItemList',name:'براندات نون السعودية والإمارات',itemListElement:rows.flatMap(([slug,brand],i)=>['saudi','uae'].map((market,n)=>({'@type':'ListItem',position:i*2+n+1,name:brand.label+' — '+(market==='saudi'?'السعودية':'الإمارات'),url:origin+'/'+market+'/brand/'+slug})))}]};
  const style='<style>body{margin:0;color:#17202e;background:#f8fafc;font:16px/1.8 Tahoma,Arial,sans-serif}header,footer{background:#111827;color:white;padding:20px 5%}header a{color:white;margin-inline-end:15px}main{max-width:1180px;margin:24px auto;padding:20px}h1{line-height:1.45}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.card{background:white;border-radius:15px;padding:20px;border:1px solid #e4e8ef}.card h2{margin:0;font-size:21px}.card small{font-size:15px;color:#525c6b}.card a{color:#123b84}a:focus-visible{outline:3px solid #e9b400}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}}</style>';
  const social='<meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+canonical+'"><meta property="og:image" content="'+origin+'/assets/featured/brands.svg"><meta name="twitter:card" content="summary_large_image">';
  const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | Noon Deals Now</title><meta name="robots" content="index,follow,max-image-preview:large"><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'">'+social+style+'<script type="application/ld+json">'+serializeSchema(structured)+'</script></head><body><header><nav><a href="/">الرئيسية</a><a href="/saudi">السعودية</a><a href="/uae">الإمارات</a><a href="/categories">الأقسام</a><a href="/blog">المدونة</a></nav></header><main><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p><p>هذه صفحات إرشادية مستقلة وليست صفحات رسمية للمتاجر أو ضمانًا لقبول أي كود. تحقق من الشروط والسعر النهائي داخل نون.</p><section class="grid" aria-label="قائمة البراندات">'+entries+'</section></main><footer>موقع مستقل غير تابع لشركة نون.</footer></body></html>';
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=300,s-maxage=900,stale-while-revalidate=3600','x-brand-directory':'v1'}});
}
export async function enrichHomepageSchema(req,res){
  if(req.method!=='GET'||new URL(req.url).pathname!=='/'||!res?.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
  const text=await res.text();
  if(text.includes('id="home-organization-jsonld-v1"'))return new Response(text,{status:res.status,headers:res.headers});
  const data={'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':origin+'/#organization',name:'Noon Deals Now',url:origin+'/',description:'Independent coupon and shopping-guide site serving Saudi Arabia and the UAE.'},
    {'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'Noon Deals Now',inLanguage:['ar','en'],publisher:{'@id':origin+'/#organization'}},
    {'@type':'WebPage','@id':origin+'/#webpage',url:origin+'/',name:'كوبونات نون السعودية والإمارات',isPartOf:{'@id':origin+'/#website'},inLanguage:'ar'}]};
  const tag='<script id="home-organization-jsonld-v1" type="application/ld+json">'+serializeSchema(data)+'</script>';
  const html=text.replace(/<\/head>/i,tag+'</head>');
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-home-schema','organization-website-v1');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}
