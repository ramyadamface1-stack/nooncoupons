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
// A confirmed HTTP 5xx is temporary availability, not a quota exhaustion.
// Start at 45s, back off per model+key for repeated failures, and respect
// explicit provider Retry-After. No retry of an uncertain/network outcome.
export function temporaryCooldown(retryAfter='',previous=null,atMs=Date.now()){
 const last=Date.parse(previous?.lastTemporaryAt||'');
 const recent=Number.isFinite(last)&&last<=atMs&&atMs-last<=15*60000;
 const streak=recent?Math.min(4,Math.max(0,Math.trunc(Number(previous?.temporaryFailStreak)||0))+1):1;
 const base=Math.min(300,45*2**(streak-1));
 const hint=String(retryAfter||'').trim();
 let hinted=/^\d+$/.test(hint)?Number(hint):NaN;
 if(!Number.isFinite(hinted)&&hint){const parsed=Date.parse(hint);if(Number.isFinite(parsed))hinted=Math.ceil((parsed-atMs)/1000)}
 return {seconds:Math.max(45,Math.min(600,Math.max(base,Number.isFinite(hinted)?hinted:0))),streak};
}
export function providerModelKeyCircuitId(provider,model,keyRef,sha){
 if(typeof model!=='string'||!model.trim()||!/^[a-f0-9]{12}$/.test(keyRef))throw Error('INVALID_MODEL_KEY_CIRCUIT');
 return providerCircuitId(provider,sha,sha('model-key|'+model+'|'+keyRef).slice(0,12));
}
export function providerCircuitActive(state,atMs=Date.now()){
 return ['PAUSED_QUOTA','PAUSED_PROVIDER'].includes(state?.state)&&Number.isFinite(Date.parse(state?.resumeAt))&&Date.parse(state.resumeAt)>atMs;
}

// A network timeout after sending a provider POST may already have consumed
// a free request. Quarantine that ARTICLE permanently and pause only the
// exact model/key for 10 minutes, without blaming every key or claiming 429.
// Other approved free keys remain selectable on a later scheduled job.
export const AMBIGUOUS_PROVIDER_MODEL_KEY_COOLDOWN_SECONDS=600;
export function unknownRequestModelKeyCooldown({circuitId,provider,model,keyRef,prior=null,atMs=Date.now()}={}){
 if(!/^[a-f0-9]{24}$/.test(String(circuitId||''))||
    !['gemini','groq'].includes(provider)||
    typeof model!=='string'||!model.trim()||
    !/^[a-f0-9]{12}$/.test(String(keyRef||''))||
    !Number.isFinite(atMs)||atMs<0)
  throw Error('INVALID_AMBIGUOUS_PROVIDER_CIRCUIT');
 const version=Number(prior?.version||0);
 return {articleId:circuitId,state:'PAUSED_PROVIDER',provider,model,keyRef,
   errorCategory:'NETWORK_OR_TIMEOUT_AFTER_REQUEST_SENT',
   createdAt:new Date(atMs).toISOString(),
   resumeAt:new Date(atMs+AMBIGUOUS_PROVIDER_MODEL_KEY_COOLDOWN_SECONDS*1000).toISOString(),
   version:Number.isInteger(version)&&version>=0?version+1:1};
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

// Prefer the other already-approved free provider after a definitive quota
// rejection instead of wasting the entire five-call budget on one provider.
// No request is repeated with the rejected credential; circuit checks remain.
export function providerFailoverOrder(priority,lastQuotaRejected=null){
 const names=Array.isArray(priority)?priority.filter(p=>p==='gemini'||p==='groq'):[];
 const approved=[...new Set(names)];
 if(!approved.includes(lastQuotaRejected))return approved;
 return [...approved.filter(p=>p!==lastQuotaRejected),lastQuotaRejected];
}
