// Pure operating limits for the Cloudflare-native publisher. The stock
// buffer stops free-key spending when R2 already has enough ready articles.
export const DIRECT_READY_TARGET=12;
export function planGenerationMarkets(readyCount,minute){
 if(!Number.isSafeInteger(readyCount)||readyCount<0||!Number.isSafeInteger(minute)||minute<0)
  throw Error('INVALID_DIRECT_PRODUCTION_PLAN');
 if(readyCount>=DIRECT_READY_TARGET)return [];
 // Fill a small buffer quickly, then aim for one new article per minute.
 // A low stock buffer allows two independently leased markets to recover.
 return readyCount<4?['SA','AE']:[minute%2===0?'SA':'AE'];
}
export function planQuotaCooldown(provider,priorFailures=0,atMs=Date.now()){
 if(!['gemini','groq'].includes(provider)||!Number.isSafeInteger(priorFailures)||
  priorFailures<0||!Number.isFinite(atMs)||atMs<0)throw Error('INVALID_PROVIDER_COOLDOWN');
 const failures=Math.min(6,priorFailures+1);
 const base=provider==='gemini'?15*60000:3*60000;
 const delayMs=Math.min(4*3600000,base*2**(failures-1));
 return {failures,until:new Date(atMs+delayMs).toISOString(),cooldownMs:delayMs};
}
