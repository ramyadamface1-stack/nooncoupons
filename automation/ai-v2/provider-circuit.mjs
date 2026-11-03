// Daily free-tier safety guard: one definitive provider 429 pauses further
// provider requests across all topics. Never retry a possibly billed response.
export function quotaCooldownSeconds(value,atMs=Date.now()){
 const raw=String(value||'').trim();
 let seconds=/^\d+$/.test(raw)?Number(raw):NaN;
 if(!Number.isFinite(seconds)&&raw){const t=Date.parse(raw);if(Number.isFinite(t))seconds=(t-atMs)/1000}
 return Math.max(900,Math.min(86400,Number.isFinite(seconds)?Math.ceil(seconds):3600));
}
export function providerCircuitId(provider,sha,keyRef=null){
 if(!['groq','gemini'].includes(provider))throw Error('unsupported_provider');
 if(keyRef!==null&&!/^[a-f0-9]{12}$/.test(keyRef))throw Error('invalid_key_ref');
 // Retain the single-key legacy Groq circuit when no keyRef is supplied.
 // New pools use isolated circuits to avoid globally blocking a distinct key.
 const suffix=keyRef?'|'+keyRef:'';
 return sha('noondealsnow|ai-v2|provider-quota|'+provider+suffix).slice(0,24);
}
export function providerCircuitActive(state,atMs=Date.now()){
 return ['PAUSED_QUOTA','PAUSED_PROVIDER'].includes(state?.state)&&Number.isFinite(Date.parse(state?.resumeAt))&&Date.parse(state.resumeAt)>atMs;
}

// Cache only provider/model/key cooldown reads within ONE serialized GitHub run.
// This removes repeated private R2 GETs for five section requests. A successful
// cooldown write replaces the cached record immediately; failed writes never
// poison the cache. A new invocation starts with a fresh snapshot.
export function createProviderCircuitSnapshot(readPersisted,writePersisted){
 const cache=new Map();
 return {
  async read(id){
   if(cache.has(id))return cache.get(id);
   const value=await readPersisted(id);
   cache.set(id,value);
   return value;
  },
  async write(value){
   if(!value||typeof value.articleId!=='string')throw Error('CIRCUIT_ID_REQUIRED');
   const saved=await writePersisted(value);
   cache.set(value.articleId,saved);
   return saved;
  }
 };
}
