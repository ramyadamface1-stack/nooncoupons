const scripts=html=>[...String(html||'').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].trim()).filter(Boolean);

function nodes(x,out=[]){
  if(!x||typeof x!=='object')return out;
  if(Array.isArray(x)){for(const v of x)nodes(v,out);return out}
  out.push(x);
  if(Array.isArray(x['@graph']))for(const v of x['@graph'])nodes(v,out);
  return out;
}

export function validateStructuredData(article){
  const blocks=scripts(article?.html),parsed=[],errors=[];
  if(!blocks.length)errors.push('missing_jsonld');
  for(let i=0;i<blocks.length;i++){
    try{parsed.push(JSON.parse(blocks[i]))}catch(e){errors.push(`invalid_jsonld_${i+1}`)}
  }
  const all=parsed.flatMap(x=>nodes(x,[]));
  const faq=all.find(x=>x?.['@type']==='FAQPage');
  if(!faq)errors.push('missing_faq_schema');
  else{
    const main=Array.isArray(faq.mainEntity)?faq.mainEntity:[];
    if(main.length<4)errors.push('faq_schema_too_small');
    for(const q of main){
      if(q?.['@type']!=='Question'||!String(q?.name||'').trim())errors.push('invalid_faq_question');
      const ans=q?.acceptedAnswer;if(ans?.['@type']!=='Answer'||!String(ans?.text||'').trim())errors.push('invalid_faq_answer');
    }
  }
  const duplicateIds=(()=>{const ids=all.map(x=>x?.['@id']).filter(Boolean),set=new Set();for(const id of ids){if(set.has(id))return true;set.add(id)}return false})();
  if(duplicateIds)errors.push('duplicate_schema_id');
  return {pass:errors.length===0,errors:[...new Set(errors)],blocks:blocks.length,nodes:all.length,faqQuestions:Array.isArray(faq?.mainEntity)?faq.mainEntity.length:0};
}

export const SCHEMA_GATE_INFO={version:1,requiresValidJsonLd:true,requiresFaqPage:true,minFaqQuestions:4};
