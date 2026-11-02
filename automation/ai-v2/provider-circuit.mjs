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
 if(provider==='gemini'&&keyRef!==null&&!/^[a-f0-9]{12}$/.test(keyRef))throw Error('invalid_key_ref');
 // Preserve Groq's existing global cooldown; isolate Gemini quotas by key.
 const suffix=provider==='gemini'&&keyRef?'|'+keyRef:'';
 return sha('noondealsnow|ai-v2|provider-quota|'+provider+suffix).slice(0,24);
}
export function providerCircuitActive(state,atMs=Date.now()){
 return state?.state==='PAUSED_QUOTA'&&Number.isFinite(Date.parse(state?.resumeAt))&&Date.parse(state.resumeAt)>atMs;
}
