import fs from 'node:fs';

const path = 'auto-platform.js';
let source = fs.readFileSync(path, 'utf8');
const startMarker = 'async function sitemapIndex(env,origin){';
const endMarker = '\n\nasync function articleSitemap(';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('sitemapIndex block not found');

const replacement = `async function sitemapIndex(env,origin){
  const days=await r2json(env,'bulk/days.json',{days:[]});
  const items=[];
  for(const d of days.days||[])for(let i=0;i<Number(d.shards||0);i++)items.push({loc:\`${'${origin}'}/sitemap-articles-${'${d.day}'}-${'${i}'}.xml\`,lastmod:d.updatedAt||\`${'${d.day}'}T23:59:59.000Z\`});
  for(const n of STATIC_SITEMAPS)items.push({loc:\`${'${origin}'}/sitemap-${'${n}'}.xml\`,lastmod:null});
  return \`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${'${items.map(x=>`<sitemap><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:\'\'}</sitemap>`).join(\'\')}'}</sitemapindex>\`;
}`;

if (source.slice(start, end).includes('items.push({loc:')) {
  console.log('SITEMAP_DISCOVERY_ALREADY_PATCHED');
  process.exit(0);
}
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log('SITEMAP_DISCOVERY_PATCHED');
