// Share one bounded public R2 manifest read across all rendering layers of this Worker.
// Never use this on generator/write/consistency-critical paths.
const FRESH_MS=120_000;
let snapshot=null;
let inFlight=null;
export async function readRecentPublicManifest(env){
  if(snapshot&&Date.now()-snapshot.at<FRESH_MS)return snapshot.value;
  if(inFlight)return inFlight;
  inFlight=(async()=>{
    try{
      if(!env?.CONTENT_FINAL)return snapshot?.value||{articles:[]};
      const object=await env.CONTENT_FINAL.get('bulk/latest.json');
      const value=object?await object.json():{articles:[]};
      snapshot={at:Date.now(),value};
      return value;
    }catch{
      return snapshot?.value||{articles:[]};
    }finally{
      inFlight=null;
    }
  })();
  return inFlight;
}
export const PUBLIC_MANIFEST_CACHE_TTL_MS=FRESH_MS;
