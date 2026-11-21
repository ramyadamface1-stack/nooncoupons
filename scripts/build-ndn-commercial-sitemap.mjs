// Public, quota-independent discovery of actual commercial + editorial HTML.
// Only include file-backed canonical pages with INDEX status. Do not invent
// dates or include thin noindex category pages. No R2 writes or Worker calls.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin='https://noondealsnow.com',root=resolve('.ndn-static-assets');
const slugRoutes={
 saudi:['first-order','mobile-phones','home-appliances','electronics','perfumes-beauty','baby'],
 uae:['first-order','electronics','beauty','home-appliances']
};
const routes=[
 '/editorial-policy','/coupon-verification','/authors/editorial-team','/disclaimer',
 ...['saudi','uae'].flatMap(m=>[
  '/'+m+'/categories','/'+m+'/noon-coupon-code','/'+m+'/shopping-guide',
  '/'+m+'/brand/apple','/'+m+'/brand/samsung',
  ...slugRoutes[m].map(slug=>'/'+m+'/buying-guide/'+slug)
 ])
];
if(new Set(routes).size!==routes.length)throw Error('COMMERCIAL_SITEMAP_DUPLICATE_ROUTES');
const xmlEscape=t=>String(t).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[x]));
for(const path of routes){
 const html=await readFile(resolve(root,path.slice(1)+'.html'),'utf8');
 if(!html.includes('<link rel="canonical" href="'+origin+path+'">')||
    !html.includes('<meta name="robots" content="index,follow,max-image-preview:large">')||
    !html.includes('<h1>')||
    !html.includes('G-1551Z7DJ2C'))
   throw Error('COMMERCIAL_SITEMAP_INVALID_CANONICAL_META_OR_ANALYTICS_'+path);
}
const xml='<?xml version="1.0" encoding="UTF-8"?>'+
 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
 routes.map(path=>'<url><loc>'+xmlEscape(origin+path)+'</loc></url>').join('')+'</urlset>';
await writeFile(resolve(root,'sitemap-commercial.xml'),xml,'utf8');
if(xml.length>25000)throw Error('COMMERCIAL_SITEMAP_TOO_LARGE');
const robotsPath=resolve(root,'robots.txt');
let robots=await readFile(robotsPath,'utf8');
const line='Sitemap: '+origin+'/sitemap-commercial.xml';
if(!robots.includes(line))robots=robots.trimEnd()+'\n'+line+'\n';
if(!robots.includes('Sitemap: '+origin+'/sitemap.xml'))throw Error('COMMERCIAL_SITEMAP_ROOT_ROBOTS_MISSING');
await writeFile(robotsPath,robots,'utf8');
const rootSitemap=resolve(root,'sitemap.xml');
let rootXML=await readFile(rootSitemap,'utf8');
const entry='<sitemap><loc>'+origin+'/sitemap-commercial.xml</loc></sitemap>';
if(!rootXML.includes(entry)){
 if(!rootXML.includes('</sitemapindex>'))throw Error('COMMERCIAL_SITEMAP_ROOT_INDEX_MALFORMED');
 rootXML=rootXML.replace('</sitemapindex>',entry+'</sitemapindex>');
 await writeFile(rootSitemap,rootXML,'utf8');
}
const llmsPath=resolve(root,'llms.txt');
let llms=await readFile(llmsPath,'utf8');
if(!llms.includes('## Country-specific coupon buying guides')){
 llms+='\n## Country-specific coupon buying guides\n'+
 '- '+origin+'/saudi/noon-coupon-code (Saudi Arabia: NOV170)\n'+
 '- '+origin+'/uae/noon-coupon-code (United Arab Emirates: NOV188)\n'+
 '- '+origin+'/saudi/categories\n'+
 '- '+origin+'/uae/categories\n'+
 '- '+origin+'/editorial-policy\n'+
 '- '+origin+'/coupon-verification\n';
 await writeFile(llmsPath,llms,'utf8');
}
console.log('NDN_STATIC_COMMERCIAL_SITEMAP_URLS='+routes.length+
 ';CANONICAL_MATCH=ALL;ROBOTS_AND_ROOT_DISCOVERY=YES;R2_WRITES=ZERO');
