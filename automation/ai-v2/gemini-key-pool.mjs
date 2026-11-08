import {additionalKeyEntries} from './key-pool-slots.mjs';
// Safe Gemini auth-key inventory. No network calls and no secret output.
export function parseGeminiKeys(input){
  const raw=String(input||'').trim();
  if(!raw)return [];
  let items=[];
  if(raw.startsWith('[')){
    try{const json=JSON.parse(raw);items=Array.isArray(json)?json:[]}catch{return []}
  }else items=raw.split(/[\s,;]+/);
  const result=[],seen=new Set();
  for(const item of items){
    if(typeof item!=='string')continue;
    const key=item.trim().replace(/^['"]|['"]$/g,'');
    if(!/^(?:AQ[.]|AIza)/.test(key)||key.length<12||seen.has(key))continue;
    seen.add(key);result.push(key);
  }
  return result;
}
// Every distinct configured Gemini key participates. New/bulk keys take priority; legacy and extra keys remain additive fallbacks (never logged).
function candidates(env={}){
  const newer=parseGeminiKeys(env.GEMINI_API_KEYS),old=parseGeminiKeys(env.GEMINI_API_KEY);
  const extra=parseGeminiKeys(env.GEMINI_API_KEYS_EXTRA);
  const auth=newer.filter(k=>k.startsWith('AQ.'));
  const baseSource=newer.length&&auth.length===newer.length?'GEMINI_API_KEYS_AUTH':newer.length?'GEMINI_API_KEYS':'GEMINI_API_KEY';
  const out=[],seen=new Set();
  for(const [keys,source] of [[newer,baseSource],[old,'GEMINI_API_KEY'],[extra,'GEMINI_API_KEYS_EXTRA']]){
    for(const key of keys)if(!seen.has(key)){seen.add(key);out.push({key,source})}
  }
  const dynamic=additionalKeyEntries(env,'gemini',parseGeminiKeys);
  for(const entry of dynamic)if(!seen.has(entry.key)){seen.add(entry.key);out.push(entry)}
  return {newer,old,extra,auth,dynamic,out};
}
export function selectGeminiKey(env={},slot=0){
  const pool=candidates(env).out;
  if(!pool.length)return null;
  const keySlot=Math.abs(Math.trunc(Number(slot)||0))%pool.length;
  return {...pool[keySlot],keySlot};
}
export function geminiKeyInventory(env={}){
  const {newer,old,extra,auth,dynamic,out}=candidates(env);
  return {hasGemini:out.length>0,newCount:newer.length,newAuthCount:auth.length,oldCount:old.length,
    extraCount:extra.length,dynamicCount:dynamic.length,selectedSource:out[0]?.source||null,eligibleCount:out.length};
}
