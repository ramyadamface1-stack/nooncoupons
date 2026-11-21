// Build THREE safe public canonical resources as Cloudflare Workers Static Assets.
// Unlike Workers Cache, static assets are served without invoking Workers code,
// and remain accessible after an unrelated Worker request quota is exhausted.
// Do NOT mirror R2: article HTML and admin/API routes remain fully dynamic.
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { robots,llms } from '../final-platform.js';
import { coreSitemap } from '../discovery-entry.js';

const origin='https://noondealsnow.com';
const out=resolve(process.cwd(),'.ndn-static-assets');
const allowed=new Set(['robots.txt','sitemap-core.xml','llms.txt']);
const seoSitemaps=['sitemap.xml','sitemap-core.xml','sitemap-priority.xml',
 'sitemap-en-articles.xml','sitemap-hubs.xml','sitemap-images.xml','sitemap-ai-v2.xml'];
function assert(x,msg){if(!x)throw Error('STATIC_SEO_ASSET_'+msg)}
const original=robots(origin);
let robotsSource=original.trimEnd()+'\n';
for(const file of seoSitemaps){
 const line='Sitemap: '+origin+'/'+file;
 if(!robotsSource.includes(line))robotsSource+=line+'\n';
}
const content={
 'robots.txt':robotsSource,
 'sitemap-core.xml':await coreSitemap(origin).text(),
 'llms.txt':llms(origin)
};
assert(Object.keys(content).length===3,'UNEXPECTED_FILE_SET');
assert(content['robots.txt'].includes('User-agent: OAI-SearchBot'),'OAI_SEARCHBOT_MISSING');
assert(content['robots.txt'].includes('User-agent: GPTBot'),'GPTBOT_MISSING');
assert(content['robots.txt'].includes('Disallow: /assets/coupon-svg/'),'GPTBOT_IMAGE_QUOTA_DIRECTIVE_MISSING');
assert(content['robots.txt'].includes('Disallow: /admin'),'PRIVATE_ROBOTS_POLICY_MISSING');
assert(content['robots.txt'].includes('Disallow: /api/'),'PRIVATE_API_POLICY_MISSING');
assert(content['sitemap-core.xml'].includes('<urlset'),'SITEMAP_NOT_XML');
assert(content['sitemap-core.xml'].includes(origin+'/coupon/nov170'),'SA_CUPON_URL_MISSING');
assert(content['sitemap-core.xml'].includes(origin+'/coupon/nov188'),'AE_COUPON_URL_MISSING');
assert(content['llms.txt'].includes('NOV170')&&content['llms.txt'].includes('NOV188'),'AI_REFERENCE_COUPONS_MISSING');
assert(!content['llms.txt'].includes('<script'),'AI_REFERENCE_UNEXPECTED_SCRIPT');
await mkdir(out,{recursive:true});
for(const [file,body] of Object.entries(content)){
 assert(allowed.has(file),'UNRECOGNIZED_ASSET');
 assert(typeof body==='string'&&body.length>100&&body.length<80000,'EMPTY_OR_OVERSIZE_'+file);
 await writeFile(resolve(out,file),body,'utf8');
 assert(await readFile(resolve(out,file),'utf8')===body,'WRITTEN_ASSET_DIFFERS_'+file);
 console.log('NDN_STATIC_SEO_BUILT='+file+';BYTES='+Buffer.byteLength(body,'utf8'));
}
console.log('NDN_STATIC_SEO_ASSETS_ONLY=robots.txt,sitemap-core.xml,llms.txt;NO_HTML_OR_API_OVERLAYS=true');
