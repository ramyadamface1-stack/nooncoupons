import fs from 'node:fs';

const target='bulk-content-engine.js';
const source=fs.readFileSync('english-v6-migrate.mjs','utf8');
const marker='const replacement=`';
const start=source.indexOf(marker);
const end=source.indexOf('`;\n\nconst re=',start+marker.length);
if(start<0||end<0)throw new Error('EN_V6_LITERAL_BLOCK_NOT_FOUND');
let replacement=source.slice(start+marker.length,end).replace(/\\`/g,'`');
let s=fs.readFileSync(target,'utf8');
const re=/ const sections=\[[\s\S]*?\n \];\n const table=/;
if(!re.test(s))throw new Error('EN_V6_SECTIONS_BLOCK_NOT_FOUND');
s=s.replace(re,replacement);
s=s.replace("blueprint:'english-'+(t.intent||'commercial')+'-v5'","blueprint:'english-'+(t.intent||'commercial')+'-v6'");
s=s.replace('englishArticleBuilder:5','englishArticleBuilder:6');
if(!s.includes("english-'+(t.intent||'commercial')+'-v6"))throw new Error('EN_V6_BLUEPRINT_NOT_APPLIED');
if(!s.includes('englishArticleBuilder:6'))throw new Error('EN_V6_INFO_NOT_APPLIED');
fs.writeFileSync(target,s);
console.log('ENGLISH_V6_MIGRATION=APPLIED');
