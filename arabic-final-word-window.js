// Final-stage Arabic article word-length balancing.
// Source and commerce overlays remain intact. Only optional generated
// decision-angle sections may be removed; every original 95+ quality gate
// and semantic/duplicate gate still audits the FINAL markup.
function countVisibleWords(html){
  const text=String(html||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
  return text?text.split(/\s+/).length:0;
}
const OPTIONAL_ANGLE=/<section class="decision-angle" data-diversity-frame="\d+">[\s\S]*?<\/section>/g;
export function fitArabicFinalWordWindow(article,{minWords=1500,targetMax=1860}={}){
  if(!article?.html)return article;
  let html=String(article.html),before=countVisibleWords(html),removed=0;
  const floor=Math.max(1500,Number(minWords)||1500);
  // Prefer leaving at least one meaningful, unique scenario section.
  for(let pass=0;pass<5&&countVisibleWords(html)>targetMax;pass++){
    const matches=[...html.matchAll(OPTIONAL_ANGLE)];
    if(matches.length<=1)break;
    const last=matches.at(-1);
    const next=html.slice(0,last.index)+html.slice(last.index+last[0].length);
    if(countVisibleWords(next)<floor)break;
    html=next;removed++;
  }
  return {...article,html,finalWordWindow:{wordsBefore:before,wordsAfter:countVisibleWords(html),optionalAnglesRemoved:removed,qualityGateUnchanged:true}};
}
