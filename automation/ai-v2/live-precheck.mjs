// GET-only article existence preflight. Transient Cloudflare 5xx/edge
// failures never authorize a new draft or a publication POST. Retry only this
// idempotent read, with bounded pauses; a definitive 404 is the sole permit.
const isTransientReadStatus=status=>status>=500&&status<600;
export async function probeLiveArticleBeforeDraft(url,{
  fetchFn=fetch,
  pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  attempts=3,
  timeoutMs=15000
}={}){
  if(typeof url!=='string'||!/^https:\/\/[^/]+\/articles\/[^/?#]+$/.test(url))
    throw Error('INVALID_LIVE_ARTICLE_PRECHECK_URL');
  if(!Number.isInteger(attempts)||attempts<1||attempts>3)
    throw Error('INVALID_LIVE_ARTICLE_PRECHECK_ATTEMPTS');
  let status=null;
  for(let i=0;i<attempts;i++){
    try{
      const response=await fetchFn(url,{method:'GET',
        signal:AbortSignal.timeout(timeoutMs)});
      status=Number(response?.status);
      if(status===404||status===200)
        return {status,attempts:i+1};
      // 429 is a real edge limit, not an invitation to hammer the route.
      if(!isTransientReadStatus(status))
        return {status:Number.isInteger(status)?status:null,attempts:i+1};
    }catch{
      status=null; // A failed GET proves neither existence nor absence.
    }
    if(i+1<attempts)await pause(500*(i+1));
  }
  return {status,attempts};
}
