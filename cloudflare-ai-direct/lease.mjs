// Atomic R2 lease for the Cloudflare-only content engine.
// A stale owner must NEVER delete an active new lease. Conditional R2 puts
// are evaluated atomically against committed ETags; no unconditional deletes.
const ROOT='_ops/noondealsnow-direct-ai-v1/lease/';
const jsonMetadata={httpMetadata:{contentType:'application/json; charset=utf-8'}};

export async function withDirectLease(env,name,run,{clock=Date.now,ttlMs=8*60000}={}){
 if(!env?.CONTENT_FINAL||typeof run!=='function'||!['publisher','generate-SA','generate-AE'].includes(name))
  throw Error('INVALID_LEASE_ARGUMENT');
 const bucket=env.CONTENT_FINAL,key=ROOT+name+'.json',id=crypto.randomUUID(),now=clock();
 const existing=await bucket.get(key);
 let condition;
 if(existing){
  let prior=null;
  try{prior=await existing.json()}catch{return {ok:false,reason:'LEASE_STATE_UNREADABLE'}}
  if(!prior||typeof prior.id!=='string'||!Number.isFinite(prior.until))
   return {ok:false,reason:'LEASE_STATE_INVALID'};
  if(prior.until>now)return {ok:false,reason:'LEASE_ACTIVE'};
  condition={etagMatches:existing.etag};
 }else{
  condition={etagDoesNotMatch:'*'};
 }
 const held=await bucket.put(key,JSON.stringify({id,until:now+ttlMs}),
  {...jsonMetadata,onlyIf:condition});
 if(!held)return {ok:false,reason:'LEASE_RACE'};
 try{return await run()}finally{
  try{
   const latest=await bucket.get(key);
   if(latest){
    const saved=await latest.json();
    if(saved?.id===id){
     // Compare-and-swap a released marker; never delete a lease which may
     // have been re-acquired by another Cron invocation after our GET.
     await bucket.put(key,JSON.stringify({id,until:0,releasedAt:new Date(clock()).toISOString()}),
      {...jsonMetadata,onlyIf:{etagMatches:latest.etag}});
    }
   }
  }catch{
   // Fail closed: let the eight-minute TTL expire. Never risk deleting a
   // successor's lease when a read/write or network result is ambiguous.
  }
 }
}
