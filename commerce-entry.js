import app from './public-entry.js';
import {commerceLanding,commerceArticlePathHtml,commerceNavHtml,commerceSitemap,augmentCommerceSitemap,COMMERCE_TAXONOMY_INFO} from './commerce-pages.js';
export {ControlPlane,GeneratorControl} from './public-entry.js';

const enc=s=>encodeURI(String(s||''));
async function r2json(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}
function hardened(res){const h=new Headers(res.headers);h.set('x-content-type-options','nosniff');h.set('referrer-policy','strict-origin-when-cross-origin');h.set('x-frame-options','SAMEORIGIN');h.set('permissions-policy','camera=(), microphone=(), geolocation=()');h.set('strict-transport-security','max-age=31536000');return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h})}
async function appendArticleCommerce(req,env,res){if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;const u=new URL(req.url),slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');if(!slug)return res;const latest=await r2json(env,'bulk/latest.json',{articles:[]});let rec=(latest.articles||[]).find(a=>a?.slug===slug)||null;if(!rec){try{const o=await env.CONTENT_FINAL?.head('articles/'+slug+'.html'),md=o?.customMetadata||{};rec={slug,country:md.c||'SA',title:md.t?decodeURIComponent(md.t):slug,primaryKeyword:md.kw?decodeURIComponent(md.kw):'',category:md.cat?decodeURIComponent(md.cat):''}}catch{rec={slug,country:'SA',title:slug}}}let html=await res.text();if(!html.includes('id="article-commerce-path"'))html=html.replace(/<\/body>/i,commerceArticlePathHtml(rec||{slug})+'</body>');const h=new Headers(res.headers);h.delete('content-length');h.set('x-commerce-article-path','v2');return new Response(html,{status:res.status,statusText:res.statusText,headers:h})}
async function appendHomeCommerce(req,res){if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;const path=new URL(req.url).pathname.replace(/\/+$/,'')||'/';if(!['/','/blog'].includes(path))return res;let html=await res.text();if(!html.includes('id="commerce-network-nav"'))html=html.replace(/<\/body>/i,commerceNavHtml()+'</body>');const h=new Headers(res.headers);h.delete('content-length');h.set('x-commerce-nav','v2');return new Response(html,{status:res.status,statusText:res.statusText,headers:h})}
async function augmentSitemapResponse(req,env,res){if(!res.ok||new URL(req.url).pathname!=='/sitemap.xml')return res;const type=(res.headers.get('content-type')||'').toLowerCase();if(!type.includes('xml'))return res;const origin=env.SITE_ORIGIN||new URL(req.url).origin,text=augmentCommerceSitemap(await res.text(),origin),h=new Headers(res.headers);h.delete('content-length');h.set('x-commerce-sitemap','v2');return new Response(text,{status:res.status,statusText:res.statusText,headers:h})}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'')||'/',origin=env.SITE_ORIGIN||u.origin;
    if(req.method==='GET'&&path==='/sitemap-commerce.xml')return hardened(commerceSitemap(origin));
    if(req.method==='GET'&&path==='/api/commerce-health')return new Response(JSON.stringify({ok:true,version:COMMERCE_TAXONOMY_INFO.version,...COMMERCE_TAXONOMY_INFO,sitemap:'/sitemap-commerce.xml',time:new Date().toISOString()},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    if(req.method==='GET'){
      const landing=await commerceLanding(path,origin,env);
      if(landing)return hardened(landing);
    }
    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&path.startsWith('/articles/'))res=await appendArticleCommerce(req,env,res);
    res=await appendHomeCommerce(req,res);
    res=await augmentSitemapResponse(req,env,res);
    return hardened(res);
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const COMMERCE_ENTRY_INFO={version:2,entry:'commerce-entry',wraps:'public-entry',routes:COMMERCE_TAXONOMY_INFO.routes,articleBacklinks:true,homeNavigation:true,separateShoesAndBags:true,modelFamilyPages:true};
