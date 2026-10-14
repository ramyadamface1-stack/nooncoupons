// Public health-only R2 existence cache. NEVER use for publishing or duplicate gates.
// Bounds repeated HeadObject checks from health probes across requests in one Worker isolate.
export const HEALTH_HEAD_TTL_MS=300_000;
const MAX_KEYS=512;
const recent=new Map();
export async function healthR2ObjectExists(env,key){
  const now=Date.now(),previous=recent.get(key);
  if(previous&&previous.until>now)return previous.promise;
  const promise=Promise.resolve().then(()=>env.CONTENT_FINAL?.head(key)).then(object=>Boolean(object));
  recent.delete(key);
  recent.set(key,{until:now+HEALTH_HEAD_TTL_MS,promise});
  while(recent.size>MAX_KEYS){recent.delete(recent.keys().next().value)}
  try{return await promise}catch(e){
    if(recent.get(key)?.promise===promise)recent.delete(key);
    throw e;
  }
}
