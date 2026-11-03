import {readAiV2PublicationLedger} from './ai-v2-publication-ledger.js';

// Pages in this sitemap have physically passed the native R2 publication
// gate and are recorded by the publication ledger. No listing or HEAD scan.
export const AI_V2_SITEMAP_SHARD_SIZE=2000;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const xmlHead='<?xml version="1.0" encoding="UTF-8"?>';
const opts={'content-type':'application/xml; charset=utf-8',
 'cache-control':'public,max-age=60,s-maxage=300,stale-while-revalidate=600',
 'x-robots-tag':'all','x-sitemap-source':'native-ai-v2-publication-ledger-v1'};
const xml=body=>new Response(body,{headers:opts});
export async function nativeAiV2SitemapResponse(path,env,origin='https://noondealsnow.com'){
 const leaf=String(path||'').match(/^\/sitemap-ai-v2-([1-9]\d{0,3})\.xml$/);
 if(path!=='/sitemap-ai-v2.xml'&&!leaf)return null;
 const read=await readAiV2PublicationLedger(env);
 if(!read.ok)return new Response('AI V2 publication index temporarily unavailable',{status:503,
  headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow'}});
 const rows=read.ledger.articles.filter(a=>a?.slug&&['SA','AE'].includes(a.country));
 const shards=Math.ceil(rows.length/AI_V2_SITEMAP_SHARD_SIZE);
 if(path==='/sitemap-ai-v2.xml'){
  if(!shards)return xml(xmlHead+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  const links=Array.from({length:shards},(_,i)=>{
   const part=rows[(i+1)*AI_V2_SITEMAP_SHARD_SIZE-1]||rows.at(-1);
   return '<sitemap><loc>'+safe(origin+'/sitemap-ai-v2-'+(i+1)+'.xml')+'</loc>'+
    (part?.publishedAt?'<lastmod>'+safe(part.publishedAt)+'</lastmod>':'')+'</sitemap>';
  }).join('');
  return xml(xmlHead+'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+links+'</sitemapindex>');
 }
 const n=Number(leaf[1]);if(n>shards)return new Response('Sitemap shard not found',{status:404,headers:{'cache-control':'public,max-age=300'}});
 const items=rows.slice((n-1)*AI_V2_SITEMAP_SHARD_SIZE,n*AI_V2_SITEMAP_SHARD_SIZE);
 const links=items.map(a=>'<url><loc>'+safe(origin+'/articles/'+encodeURIComponent(a.slug))+'</loc>'+
  (a.publishedAt?'<lastmod>'+safe(a.publishedAt)+'</lastmod>':'')+'</url>').join('');
 return xml(xmlHead+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+links+'</urlset>');
}
