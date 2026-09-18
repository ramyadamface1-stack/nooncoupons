import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const ALLOWED=new Set([
  'NOV170','NOV188','NOV174','NOV157','NOV177',
  'NOV186','NOV163','NOV153','NOV195','NOV161'
]);
const TOKEN_RE=/\b(?:OPS\d+|NOV\d+)\b/gi;
const SKIP_DIRS=new Set(['.git','node_modules']);
const findings=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(SKIP_DIRS.has(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(!entry.isFile())continue;

    let text;
    try{text=fs.readFileSync(full,'utf8');}
    catch{continue;}

    const bad=new Set();
    for(const raw of text.match(TOKEN_RE)||[]){
      const token=raw.toUpperCase();
      if(token.startsWith('OPS') || (token.startsWith('NOV') && !ALLOWED.has(token))) bad.add(token);
    }
    if(bad.size)findings.push({file:path.relative(ROOT,full).replaceAll('\\','/'),tokens:[...bad].sort()});
  }
}

walk(ROOT);

if(findings.length){
  console.error('COUPON_CODE_GATE=FAIL');
  for(const row of findings)console.error(`${row.file}: ${row.tokens.join(',')}`);
  process.exit(1);
}

console.log('COUPON_CODE_GATE=PASS');
console.log('ALLOWED_COUPONS='+[...ALLOWED].join(','));
