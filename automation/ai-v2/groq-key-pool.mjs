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
export function groqKeyInventory(env={}){
 const recent=parseGroqKeys(env.GROQ_API_KEYS);
 const legacy=parseGroqKeys(env.GROQ_API_KEY);
 const keys=recent.length?recent:legacy;
 return {hasGroq:keys.length>0,newCount:recent.length,legacyCount:legacy.length,
   eligibleCount:keys.length,selectedSource:recent.length?'GROQ_API_KEYS':legacy.length?'GROQ_API_KEY':null};
}
export function selectGroqKey(env={},slot=0){
 const pool=groqKeyInventory(env);
 if(!pool.hasGroq)return null;
 const keys=pool.selectedSource==='GROQ_API_KEYS'?parseGroqKeys(env.GROQ_API_KEYS):parseGroqKeys(env.GROQ_API_KEY);
 const keySlot=Math.abs(Math.trunc(Number(slot)||0))%keys.length;
 return {key:keys[keySlot],keySlot,source:pool.selectedSource};
}
