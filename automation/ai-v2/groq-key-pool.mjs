// Read only the configured free Groq credentials from GitHub Actions Secrets.
// Do not print, persist or embed raw API keys in checkpoints or article metadata.
export function parseGroqKeys(value){
 const raw=String(value||'').trim();
 if(!raw)return [];
 let entries;
 if(raw.startsWith('[')){
   try{entries=JSON.parse(raw)}catch{return []}
   if(!Array.isArray(entries))return [];
 }else entries=raw.split(/[\s,;]+/);
 const keys=[],seen=new Set();
 for(const entry of entries){
   if(typeof entry!=='string')continue;
   const key=entry.trim().replace(/^['"]|['"]$/g,'');
   if(!/^gsk_[A-Za-z0-9_-]{16,}$/.test(key)||seen.has(key))continue;
   seen.add(key);keys.push(key);
 }
 return keys;
}
// The single, bulk and extra secrets are all additive; do not silently drop a legacy pool.
function candidates(env={}){
 const recent=parseGroqKeys(env.GROQ_API_KEYS),legacy=parseGroqKeys(env.GROQ_API_KEY);
 const extra=parseGroqKeys(env.GROQ_API_KEYS_EXTRA);
 const out=[],seen=new Set();
 for(const [keys,source] of [[recent,recent.length?'GROQ_API_KEYS':'GROQ_API_KEY'],[legacy,'GROQ_API_KEY'],[extra,'GROQ_API_KEYS_EXTRA']]){
   for(const key of keys)if(!seen.has(key)){seen.add(key);out.push({key,source})}
 }
 return {recent,legacy,extra,out};
}
export function groqKeyInventory(env={}){
 const {recent,legacy,extra,out}=candidates(env);
 return {hasGroq:out.length>0,newCount:recent.length,legacyCount:legacy.length,extraCount:extra.length,
   eligibleCount:out.length,selectedSource:out[0]?.source||null};
}
export function selectGroqKey(env={},slot=0){
 const pool=candidates(env).out;
 if(!pool.length)return null;
 const keySlot=Math.abs(Math.trunc(Number(slot)||0))%pool.length;
 return {...pool[keySlot],keySlot};
}
