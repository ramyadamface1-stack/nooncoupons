import fs from 'node:fs';
const p='auto-platform.js';
let s=fs.readFileSync(p,'utf8');
const old="for(const d of days.days||[])for(let i=0;i<Number(d.shards||0);i++)items.push({loc:`${origin}/sitemap-articles-${d.day}-${i}.xml`,lastmod:d.updatedAt||`${d.day}T23:59:59.000Z`});";
const next="for(const d of days.days||[])for(let i=Number(d.shards||0)-1;i>=0;i--)items.push({loc:`${origin}/sitemap-articles-${d.day}-${i}.xml`,lastmod:d.updatedAt||`${d.day}T23:59:59.000Z`});";
if(s.includes(next)){console.log('ALREADY_REVERSED');process.exit(0)}
if(!s.includes(old))throw new Error('target sitemap shard loop not found');
s=s.replace(old,next);
fs.writeFileSync(p,s);
console.log('REVERSED_SITEMAP_SHARDS');
