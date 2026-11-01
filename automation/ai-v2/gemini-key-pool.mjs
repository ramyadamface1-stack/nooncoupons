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
export function selectGeminiKey(env={},slot=0){
  const newer=parseGeminiKeys(env.GEMINI_API_KEYS);
  const old=parseGeminiKeys(env.GEMINI_API_KEY);
  const auth=newer.filter(k=>k.startsWith('AQ.'));
  const keys=auth.length?auth:newer.length?newer:old;
  if(!keys.length)return null;
  const keySlot=Math.abs(Math.trunc(Number(slot)||0))%keys.length;
  return {key:keys[keySlot],keySlot,source:auth.length?'GEMINI_API_KEYS_AUTH':newer.length?'GEMINI_API_KEYS':'GEMINI_API_KEY'};
}
export function geminiKeyInventory(env={}){
  const newer=parseGeminiKeys(env.GEMINI_API_KEYS),old=parseGeminiKeys(env.GEMINI_API_KEY);
  const auth=newer.filter(k=>k.startsWith('AQ.'));
  const keys=auth.length?auth:newer.length?newer:old;
  return {hasGemini:keys.length>0,newCount:newer.length,newAuthCount:auth.length,oldCount:old.length,selectedSource:keys.length?(auth.length?'GEMINI_API_KEYS_AUTH':newer.length?'GEMINI_API_KEYS':'GEMINI_API_KEY'):null,eligibleCount:keys.length};
}
