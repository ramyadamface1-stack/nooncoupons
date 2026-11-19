#!/usr/bin/env node
// A read-only content-decay priority report from two Google Search Console
// "Pages" exports. Does not change R2, slugs, publication dates or articles.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function parseGscCsv(raw){
  const source=String(raw||'').replace(/^\uFEFF/,''),rows=[];
  let row=[],value='',quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='"'){
      if(quoted&&source[i+1]==='"'){value+='"';i++}else quoted=!quoted;
    }else if(char===','&&!quoted){row.push(value);value=''}
    else if((char==='\r'||char==='\n')&&!quoted){
      if(char==='\r'&&source[i+1]==='\n')i++;
      row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';
    }else value+=char;
  }
  if(value||row.length){row.push(value);rows.push(row)}
  if(!rows.length)return [];
  const headers=rows.shift().map(x=>x.trim().toLowerCase());
  const col=(...names)=>headers.findIndex(x=>names.includes(x));
  const pageIndex=col('top pages','page','pages','url','landing page');
  const clicksIndex=col('clicks','click');
  const impressionsIndex=col('impressions','impression');
  const positionIndex=col('position','average position');
  if(pageIndex<0||clicksIndex<0)throw Error('GSC_CSV_EXPECTS_PAGE_AND_CLICKS_COLUMNS');
  return rows.map(cells=>({
    page:String(cells[pageIndex]||'').trim(),
    clicks:Number(String(cells[clicksIndex]||0).replaceAll(',',''))||0,
    impressions:impressionsIndex<0?null:Number(cells[impressionsIndex])||0,
    position:positionIndex<0?null:Number(cells[positionIndex])||0
  }));
}

function articleUrl(raw){
  try{
    const url=new URL(String(raw||''));
    if(!['noondealsnow.com','www.noondealsnow.com'].includes(url.hostname.toLowerCase())||
      !/^\/(?:en\/)?articles\/[^/]+\/?$/.test(url.pathname))return null;
    return 'https://noondealsnow.com'+url.pathname.replace(/\/$/,'');
  }catch{return null}
}

export function rankDecayingArticles(before,after,{minBaselineClicks=5,limit=100}={}){
  const byPage=rows=>{
    const result=new Map();
    for(const row of rows){
      const url=articleUrl(row.page);if(!url)continue;
      const earlier=result.get(url);
      // GSC exports sometimes repeat URL variants: retain a single canonical
      // page row, never double count by summing query-string variations.
      if(!earlier||row.clicks>earlier.clicks)result.set(url,row);
    }
    return result;
  };
  const old=byPage(before),recent=byPage(after),ranked=[];
  for(const [url,base] of old){
    const current=recent.get(url)||{clicks:0,impressions:0,position:null};
    const loss=base.clicks-current.clicks;
    if(base.clicks<minBaselineClicks||loss<=0)continue;
    const declinePercent=+(loss/base.clicks*100).toFixed(1);
    ranked.push({url,baselineClicks:base.clicks,recentClicks:current.clicks,
      clicksLost:loss,declinePercent,severity:declinePercent>50?'severe':declinePercent>=20?'moderate':'mild',
      baselinePosition:base.position,recentPosition:current.position,
      action:'Review query intent and add substantial, verified content before marking any new editorial date.'});
  }
  return ranked.sort((a,b)=>b.clicksLost-a.clicksLost||b.baselineClicks-a.baselineClicks).slice(0,limit);
}

function argsToMap(argv){
  return Object.fromEntries(argv.filter(x=>x.startsWith('--')&&x.includes('=')).map(s=>{
    const at=s.indexOf('=');return [s.slice(2,at),s.slice(at+1)];
  }));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=argsToMap(process.argv.slice(2));
  if(!args.before||!args.after){
    process.stderr.write('Usage: node scripts/gsc-decay-refresh-plan.mjs --before=previous-pages.csv --after=recent-pages.csv [--out=priority.json]\n');
    process.exitCode=2;
  }else{
    const baseline=parseGscCsv(readFileSync(args.before,'utf8'));
    const current=parseGscCsv(readFileSync(args.after,'utf8'));
    const pages=rankDecayingArticles(baseline,current,{limit:Math.max(1,Math.min(500,Number(args.limit)||100))});
    const report={version:1,site:'noondealsnow.com',createdAt:new Date().toISOString(),
      note:'Ranked by real lost clicks; dateModified is NOT set by this report. Verify significant edits per page.',pages};
    const output=JSON.stringify(report,null,2)+'\n';
    if(args.out){writeFileSync(args.out,output);process.stdout.write('Wrote '+pages.length+' candidates to '+args.out+'\n')}
    else process.stdout.write(output);
  }
}
