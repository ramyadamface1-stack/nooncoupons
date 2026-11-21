// Freeze four canonical discovery sitemaps to zero-Worker Static Assets using
// their original exported production renderers. Source R2 snapshots are local
// and read-only; keeps /sitemap-live-recent.xml dynamic for fresh publications.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {prioritySitemap,hubSitemap,englishRecentSitemap,imageSitemap} from '../discovery-entry.js';

const base=resolve(process.cwd(),'.ndn-static-assets');
const origin='https://noondealsnow.com';
const data=JSON.parse(await readFile(resolve(process.cwd(),'.ndn-discovery-temp/manifest.json'),'utf8'));
const env={CONTENT_FINAL:{get:async key=>{
 const value=data[key];
 return value==null?null:{json:async()=>value,text:async()=>JSON.stringify(value)};
}}};
const sources=[
 ['sitemap-priority.xml',prioritySitemap],
 ['sitemap-en-articles.xml',englishRecentSitemap],
 ['sitemap-hubs.xml',hubSitemap],
 ['sitemap-images.xml',imageSitemap]
];
let total=0;
for(const [name,renderer] of sources){
 const res=await renderer(env,origin);
 if(!res||res.status!==200||(res.headers.get('content-type')||'').indexOf('xml')<0)
   throw Error('DISCOVERY_STATIC_PRODUCTION_RENDERER_NOT_XML_200_'+name);
 const xml=await res.text();
 if(!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')||
    !xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')||
    !xml.endsWith('</urlset>'))
   throw Error('DISCOVERY_STATIC_INVALID_CANONICAL_XML_'+name);
 if(xml.includes('<!DOCTYPE')||xml.includes('<script'))throw Error('DISCOVERY_STATIC_XML_UNEXPECTED_MARKUP_'+name);
 const bytes=Buffer.byteLength(xml,'utf8');
 if(bytes>18_000_000)throw Error('DISCOVERY_STATIC_XML_EXCEEDS_FREE_ASSET_LIMIT_'+name);
 const locs=[...xml.matchAll(/<loc>([^<>]+)<\/loc>/g)].map(x=>x[1]);
 if(!locs.length)throw Error('DISCOVERY_STATIC_EMPTY_URL_SET_'+name);
 if(locs.some(x=>!x.startsWith(origin+'/')))throw Error('DISCOVERY_STATIC_CROSS_DOMAIN_'+name);
 await writeFile(join(base,name),xml,'utf8');
 total+=locs.length;
 console.log('NDN_STATIC_DISCOVERY_XML_BUILT='+name+';URLS='+locs.length+';BYTES='+bytes);
}
console.log('NDN_STATIC_DISCOVERY_FILES=4;TOTAL_URL_ENTRIES='+total+
 ';DYNAMIC_LIVE_RECENT_SITEMAP_UNCHANGED=true;R2_WRITES=ZERO;ARTICLE_GENERATION=ZERO');
