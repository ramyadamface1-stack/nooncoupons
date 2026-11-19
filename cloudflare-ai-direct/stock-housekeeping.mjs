// Bound R2 READY inventory by actual state, not the number of objects in
// the folder. A rejected article must never permanently consume the buffer.
// Never delete an uncertain native POST, and never retry a provider request.
const ROOT='_ops/noondealsnow-direct-ai-v1/';
const READY=ROOT+'ready/';
const REVIEW=ROOT+'review/';
const UNCERTAIN=ROOT+'uncertain-publication/';
const SLUG=/^[a-z0-9-]{8,180}$/;
const UNCERTAIN_GRACE_MS=24*60*60*1000;

export async function inspectNativeReadyStock(bucket,{limit=32,maxCleanup=4,now=Date.now()}={}){
 if(!bucket||!Number.isInteger(limit)||limit<1||limit>100||
    !Number.isInteger(maxCleanup)||maxCleanup<0||maxCleanup>8||!Number.isFinite(now))
  throw Error('INVALID_READY_INVENTORY_ARGUMENT');
 const listing=await bucket.list({prefix:READY,limit});
 if(!Array.isArray(listing?.objects))throw Error('READY_INVENTORY_UNAVAILABLE');
 const result={activeCount:0,readyCount:0,unknownCount:0,quarantined:0,
  archivedUncertain:0,
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
   // An ambiguous POST must NEVER be retried. A day later, move the
   // complete payload to a separate durable review namespace so uncertain
   // outcomes cannot consume all 12 new-generation slots indefinitely.
   // This changes only the queue pointer, never article content/checkpoints.
   const slug=record.topic?.slug;
   const attemptedAt=Date.parse(String(record.publishAttemptAt||record.preparedAt||''));
   if(!Number.isFinite(attemptedAt)||attemptedAt>now||now-attemptedAt<UNCERTAIN_GRACE_MS||
      typeof slug!=='string'||!SLUG.test(slug)||
      result.quarantined+result.cleanedVerified+result.archivedUncertain>=maxCleanup){
    result.activeCount++;result.unknownCount++;continue;
   }
   try{
    const archiveKey=UNCERTAIN+slug+'.json';
    const serialized=JSON.stringify({...record,archivedFromReadyKey:item.key,
     manualReviewRequired:true});
    await bucket.put(archiveKey,serialized,{
     onlyIf:{etagDoesNotMatch:'*'},
     httpMetadata:{contentType:'application/json; charset=utf-8'}
    });
    // A previous tick can have copied the exact record but failed to delete
    // its queue pointer. Reconciliation is idempotent only for identical bytes.
    const verified=await bucket.get(archiveKey);
    if(!verified||JSON.stringify(await verified.json())!==serialized){
     result.cleanupErrors++;result.activeCount++;result.unknownCount++;continue;
    }
    await bucket.delete(item.key);
    result.archivedUncertain++;
   }catch{result.cleanupErrors++;result.activeCount++;result.unknownCount++;}
   continue;
  }
  if(state!=='BLOCKED_REVIEW'&&state!=='LIVE_VERIFIED'){
   // Unrecognized state: fail closed, rather than delete user content.
   result.activeCount++;result.unknownCount++;continue;
  }
  if(result.quarantined+result.cleanedVerified+result.archivedUncertain>=maxCleanup)continue;
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

export async function countArchivedUncertainStock(bucket,{limit=100}={}){
 if(!bucket||!Number.isInteger(limit)||limit<1||limit>100)
  throw Error('INVALID_UNCERTAIN_INVENTORY_ARGUMENT');
 const listing=await bucket.list({prefix:UNCERTAIN,limit});
 if(!Array.isArray(listing?.objects))throw Error('UNCERTAIN_INVENTORY_UNAVAILABLE');
 return {count:listing.objects.length,exact:listing.truncated!==true};
}
