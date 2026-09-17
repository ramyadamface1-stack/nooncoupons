import app from './commerce-entry.js';
export {ControlPlane,GeneratorControl} from './commerce-entry.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');
const SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#111827"/><path d="M15 18h34v8H15zm0 12h25v8H15zm0 12h18v8H15z" fill="#facc15"/></svg>`;

function walk(node,origin,state){
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const v of node)walk(v,origin,state);return}
  const type=node['@type'];
  const types=Array.isArray(type)?type:[type];
  if(types.includes('Organization')){
    state.organizations++;
    if(!node.logo){node.logo={'@type':'ImageObject',url:origin+'/favicon.svg',contentUrl:origin+'/favicon.svg',width:64,height:64};state.fixed++}
    if(!node.url)node.url=origin+'/';
  }
  if(Array.isArray(node['@graph']))for(const v of node['@graph'])walk(v,origin,state);
}

function repairJsonLd(html,origin){
  const state={organizations:0,fixed:0};
  const out=String(html).replace(/<script\b([^>]*?)type=["']application\/ld\+json["']([^>]*)>([\s\S]*?)<\/script>/gi,(whole,a,b,raw)=>{
    try{const data=JSON.parse(raw.trim());walk(data,origin,state);return `<script${a}type="application/ld+json"${b}>${safeJson(data)}</script>`}catch{return whole}
  });
  return {html:out,state};
}

function brandHead(html,origin){
  let out=String(html);
  const tags=[];
  if(!/<link\b[^>]*rel=["'][^"']*icon/i.test(out))tags.push(`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`);
  if(!/<meta\b[^>]*name=["']theme-color["']/i.test(out))tags.push(`<meta name="theme-color" content="#111827">`);
  if(!/<meta\b[^>]*property=["']og:site_name["']/i.test(out))tags.push(`<meta property="og:site_name" content="Noon Deals Now">`);
  if(tags.length)out=/<\/head>/i.test(out)?out.replace(/<\/head>/i,tags.join('')+'</head>'):tags.join('')+out;
  return out;
}

function favicon(){return new Response(SVG,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public, max-age=604800, immutable','x-content-type-options':'nosniff'}})}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(req.method==='GET'&&u.pathname==='/favicon.svg')return favicon();
    let res=await app.fetch(req,env,ctx);
    if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
    const origin=env.SITE_ORIGIN||u.origin;
    const source=await res.text();
    const repaired=repairJsonLd(source,origin);
    const html=brandHead(repaired.html,origin);
    const h=new Headers(res.headers);h.delete('content-length');
    h.set('x-brand-layer','v1');
    h.set('x-organization-schema-count',String(repaired.state.organizations));
    h.set('x-organization-logo-fixed',String(repaired.state.fixed));
    return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const BRAND_RUNTIME_INFO={version:1,favicon:true,organizationLogoRepair:true,logoPath:'/favicon.svg'};
