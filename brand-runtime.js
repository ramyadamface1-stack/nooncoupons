import app from './network-entry.js';
import {APPROVED_COUPON_CODES,replaceUnapprovedCouponTokens} from './approved-coupons.js';
export {ControlPlane,GeneratorControl} from './network-entry.js';

const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');
const SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#111827"/><path d="M15 18h34v8H15zm0 12h25v8H15zm0 12h18v8H15z" fill="#facc15"/></svg>`;
const APPROVED=new Set(APPROVED_COUPON_CODES.map(x=>String(x).toUpperCase()));

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

function marketForBlock(block){return /(?:الإمارات|🇦🇪|country=AE\b|data-market=["']AE["'])/i.test(block)?'AE':/(?:السعودية|🇸🇦|country=SA\b|data-market=["']SA["'])/i.test(block)?'SA':'GEN'}
function sanitizeLegacyCouponTokens(html){
  const state={blocks:0,tokens:0};
  const out=String(html).replace(/<article\b[^>]*>[\s\S]*?<\/article>/gi,block=>{
    const market=marketForBlock(block);if(market==='GEN')return block;
    const before=(block.match(/\b(?:OPS\d+|NOV\d+)\b/gi)||[]).filter(x=>!APPROVED.has(x.toUpperCase())).length;
    if(!before)return block;
    state.blocks++;state.tokens+=before;
    return replaceUnapprovedCouponTokens(block,market==='AE'?'NOV188':'NOV170');
  });
  return {html:out,state};
}
function sanitizeVisibleCouponTokens(html){
  let tokens=0;
  const selectedAttrs=/\b(content|alt|title|value|data-copy|data-code|data-copy-code|data-coupon-view|data-shop-click)=(["'])([\s\S]*?)\2/gi;
  const parts=String(html).split(/(<[^>]+>)/g);
  const out=parts.map(part=>{
    if(part.startsWith('<')){
      return part.replace(selectedAttrs,(m,name,q,value)=>{
        const before=(String(value).match(/\b(?:OPS\d+|NOV\d+)\b/gi)||[]).filter(x=>!APPROVED.has(x.toUpperCase())).length;
        if(!before)return m;
        tokens+=before;
        return `${name}=${q}${replaceUnapprovedCouponTokens(value,'NOV170')}${q}`;
      });
    }
    const before=(part.match(/\b(?:OPS\d+|NOV\d+)\b/gi)||[]).filter(x=>!APPROVED.has(x.toUpperCase())).length;
    if(!before)return part;
    tokens+=before;
    return replaceUnapprovedCouponTokens(part,'NOV170');
  }).join('');
  return {html:out,tokens};
}
function normalizeCouponUi(html){
  const state={duplicatesRemoved:0,countLabelsFixed:0};
  const seen=new Set();
  let out=String(html).replace(/<article\b[^>]*class=(["'])[^"']*\bcoupon\b[^"']*\1[^>]*>[\s\S]*?<\/article>/gi,block=>{
    const code=(block.match(/data-(?:copy|code)=["']([A-Z0-9_-]{3,20})["']/i)?.[1]||block.match(/\b((?:OPS|NOV)\d+)\b/i)?.[1]||'').toUpperCase();
    if(!APPROVED.has(code))return block;
    const market=marketForBlock(block);
    const key=market+':'+code;
    if(seen.has(key)){state.duplicatesRemoved++;return ''}
    seen.add(key);return block;
  });
  const replacements=[
    [/الثمانية للسعودية والثمانية للإمارات/g,'العشرة للسعودية والإمارات'],
    [/الأكواد الثمانية/g,'الأكواد العشرة'],
    [/الثمانية أكواد/g,'العشرة أكواد'],
    [/8 أكواد حالية/g,'10 أكواد حالية'],
    [/8 أكواد/g,'10 أكواد'],
    [/16 بطاقة كوبون/g,'20 بطاقة كوبون'],
    [/16 بطاقة/g,'20 بطاقة']
  ];
  for(const [re,to] of replacements){out=out.replace(re,m=>{state.countLabelsFixed++;return to})}
  out=out.replace(/<b>8<\/b><span class="small">أكواد<\/span>/g,()=>{state.countLabelsFixed++;return '<b>10</b><span class="small">أكواد</span>'});
  return {html:out,state};
}

function brandHead(html){
  let out=String(html);
  const tags=[];
  if(!/<link\b[^>]*rel=["'][^"']*icon/i.test(out))tags.push('<link rel="icon" type="image/svg+xml" href="/favicon.svg">');
  if(!/<meta\b[^>]*name=["']theme-color["']/i.test(out))tags.push('<meta name="theme-color" content="#111827">');
  if(!/<meta\b[^>]*property=["']og:site_name["']/i.test(out))tags.push('<meta property="og:site_name" content="Noon Deals Now">');
  if(tags.length)out=/<\/head>/i.test(out)?out.replace(/<\/head>/i,tags.join('')+'</head>'):tags.join('')+out;
  return out;
}

function favicon(){return new Response(SVG,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public, max-age=604800, immutable','x-content-type-options':'nosniff'}})}
function legacyCanonicalRedirect(u){const path=u.pathname.replace(/\/+$/,'')||'/';if(path==='/saudi/noon-coupon-code')return '/saudi-arabia/noon-coupon-code';const m=path.match(/^\/(?:saudi-arabia|saudi|uae)\/article\/(.+)$/);if(m)return '/articles/'+m[1];return null}
function indexNowKeyFile(env,path){const key=String(env.INDEXNOW_KEY||'').trim();if(!key||path!=='/'+key+'.txt')return null;return new Response(key+'\n',{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=86400, immutable','x-content-type-options':'nosniff','x-indexnow-key-file':'v1'}})}
async function ensureRobotsSitemap(res,origin){
  if(!res.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/plain'))return res;
  let body=await res.text();
  const sitemap=`Sitemap: ${origin}/sitemap.xml`;
  if(!/^\s*Sitemap:\s*https?:\/\//im.test(body))body=body.replace(/\s*$/,'')+'\n'+sitemap+'\n';
  else if(!body.includes(origin+'/sitemap.xml'))body=body.replace(/\s*$/,'')+'\n'+sitemap+'\n';
  const privateRules=['Disallow: /admin','Disallow: /api/'];
  if(!/User-agent:\s*\*/i.test(body))body='User-agent: *\n'+body;
  for(const rule of privateRules)if(!body.includes(rule))body=body.replace(/\s*$/,'')+'\n'+rule+'\n';
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-robots-sitemap','guaranteed-v1');h.set('x-robots-private-routes','blocked-v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}
function privateNoindex(res,path){
  const isAdmin=path==='/admin'||path.startsWith('/admin/'),isApi=path.startsWith('/api/');
  if(!isAdmin&&!isApi)return res;
  const h=new Headers(res.headers);h.set('x-robots-tag','noindex, nofollow, noarchive');h.set('x-private-indexing','blocked-v1');
  if(isAdmin)h.set('cache-control','private, no-store');
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
}
function crawlSafe(res,path){
  const crawl=path==='/robots.txt'||path.startsWith('/sitemap')||path==='/feed.xml'||path==='/rss.xml';
  if(!crawl)return res;
  const h=new Headers(res.headers);
  h.set('cache-control','public, max-age=300, s-maxage=900, stale-while-revalidate=86400');
  h.set('x-robots-tag','all');
  h.set('x-crawl-safe','v2');
  h.delete('set-cookie');
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(req.method==='GET'&&u.pathname==='/favicon.svg')return favicon();
    if(req.method==='GET'){const legacy=legacyCanonicalRedirect(u);if(legacy)return new Response(null,{status:301,headers:{location:(env.SITE_ORIGIN||u.origin)+legacy,'cache-control':'public, max-age=86400','x-legacy-canonical-redirect':'v1'}});}
    if(req.method==='GET'){const keyFile=indexNowKeyFile(env,u.pathname);if(keyFile)return keyFile;}
    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&u.pathname==='/robots.txt')res=await ensureRobotsSitemap(res,env.SITE_ORIGIN||u.origin);
    res=crawlSafe(res,u.pathname);
    res=privateNoindex(res,u.pathname);
    if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
    const origin=env.SITE_ORIGIN||u.origin;
    const source=await res.text();
    const repaired=repairJsonLd(source,origin);
    const sanitized=sanitizeLegacyCouponTokens(repaired.html);
    const normalized=normalizeCouponUi(sanitized.html);
    const visibleSanitized=sanitizeVisibleCouponTokens(normalized.html);
    const html=brandHead(visibleSanitized.html);
    const h=new Headers(res.headers);h.delete('content-length');
    h.set('x-brand-layer','v1');
    h.set('x-organization-schema-count',String(repaired.state.organizations));
    h.set('x-organization-logo-fixed',String(repaired.state.fixed));
    h.set('x-coupon-ui-deduped',String(normalized.state.duplicatesRemoved));
    h.set('x-coupon-count-labels-fixed',String(normalized.state.countLabelsFixed));
    h.set('x-legacy-coupon-blocks-fixed',String(sanitized.state.blocks));
    h.set('x-legacy-coupon-tokens-fixed',String(sanitized.state.tokens));h.set('x-visible-coupon-tokens-fixed',String(visibleSanitized.tokens));h.set('x-coupon-whitelist-version','nov-owner-v1');
    return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const BRAND_RUNTIME_INFO={version:12,legacyCanonicalRedirects:true,indexNowKeyFile:true,privateNoindex:true,visibleCouponSanitizer:true,favicon:true,organizationLogoRepair:true,couponUiDedupe:true,legacyCouponSanitizer:true,crawlSafe:true,robotsSitemapGuaranteed:true,approvedCouponCount:APPROVED_COUPON_CODES.length,logoPath:'/favicon.svg',wraps:'network-entry'};
