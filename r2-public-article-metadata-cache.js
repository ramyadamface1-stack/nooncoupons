// Public-page article-metadata R2 HEAD memoization. No duplicate/publish/write path may use this.
// Shared ESM module means commerce + network decorators coalesce the same HEAD per isolate.
export const ARTICLE_METADATA_HEAD_TTL_MS=300_000;
const MAX_KEYS=4096;
const cache=new Map();

export async function readPublicArticleMetadata(env,slug){
  if(!env?.CONTENT_FINAL||typeof slug!=='string'||!slug)return null;
  const key='articles/'+slug+'.html',now=Date.now();
  const previous=cache.get(key);
  if(previous&&previous.until>now)return previous.promise;
  if(previous)cache.delete(key);
  const promise=Promise.resolve().then(()=>env.CONTENT_FINAL.head(key)).then(object=>object||null);
  cache.set(key,{promise,until:now+ARTICLE_METADATA_HEAD_TTL_MS});
  while(cache.size>MAX_KEYS)cache.delete(cache.keys().next().value);
  try{return await promise}catch(error){
    if(cache.get(key)?.promise===promise)cache.delete(key);
    throw error;
  }
}
