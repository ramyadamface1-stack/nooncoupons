// Bound R2 READY inventory by actual state, not the number of objects in
// the folder. A rejected article must never permanently consume the buffer.
// Never delete an uncertain native POST, and never retry a provider request.
const ROOT='_ops/noondealsnow-direct-ai-v1/';
const READY=ROOT+'ready/';
const REVIEW=ROOT+'review/';
const SLUG=/^[a-z0-9-]{8,180}$/;

export async function inspectNativeReadyStock(bucket,{limit=32,maxCleanup=4}={}){
 if(!bucket||!Number.isInteger(limit)||limit<1||limit>100||
    !Number.isInteger(maxCleanup)||maxCleanup<0||maxCleanup>8)
  throw Error('INVALID_READY_INVENTORY_ARGUMENT');
 const listing=await bucket.list({prefix:READY,limit});
 if(!Array.isArray(listing?.objects))throw Error('READY_INVENTORY_UNAVAILABLE');
 const result={activeCount:0,readyCount:0,unknownCount:0,quarantined:0,
  cleanedVerified:0,cleanupErrors:0,truncated:listing.truncated===true,
  scanned:listing.objects.length};
 for(const item of listing.objects){
  let record;
  try{
   const object=await bucket.get(item.key);
   record=object?await object.json():null;
  }catch{
   result.activeCount++;result.unknownCount++;continue;
  }
  if(!record||typeof record!=='object'){
   result.activeCount++;result.unknownCount++;continue;
  }
  const state=record.state;
  if(state==='READY'){
   result.activeCount++;result.readyCount++;continue;
  }
  if(state==='UNKNOWN_PUBLICATION_OUTCOME'){
   // Preserve ambiguous POSTs for read-only reconciliation. Never re-post.
   result.activeCount++;result.unknownCount++;continue;
  }
  if(state!=='BLOCKED_REVIEW'&&state!=='LIVE_VERIFIED'){
   // Unrecognized state: fail closed, rather than delete user content.
   result.activeCount++;result.unknownCount++;continue;
  }
  if(result.quarantined+result.cleanedVerified>=maxCleanup)continue;
  const slug=record.topic?.slug;
  if(typeof slug!=='string'||!SLUG.test(slug)){
   result.cleanupErrors++;continue;
  }
  try{
   if(state==='BLOCKED_REVIEW'){
    const archiveKey=REVIEW+slug+'.json';
    const prior=await bucket.get(archiveKey);
    if(prior){
     const archived=await prior.json();
     if(archived?.state!=='BLOCKED_REVIEW'||archived?.topic?.slug!==slug){
      result.cleanupErrors++;continue;
     }
    }else{
     const saved=await bucket.put(archiveKey,JSON.stringify(record),{
      onlyIf:{etagDoesNotMatch:'*'},
      httpMetadata:{contentType:'application/json; charset=utf-8'}
     });
     if(!saved){result.cleanupErrors++;continue;}
    }
    await bucket.delete(item.key);
    result.quarantined++;
   }else{
    // A verified duplicate can be removed only if its durable checkpoint
    // exists: no deleting the last copy of publication evidence.
    const checkpoint=await bucket.head(ROOT+'checkpoint/'+slug+'.json');
    if(!checkpoint){result.cleanupErrors++;continue;}
    await bucket.delete(item.key);
    result.cleanedVerified++;
   }
  }catch{result.cleanupErrors++;}
 }
 return result;
}
