// Zero-storage isolate memo for expensive public content stats.
// Concurrent requests coalesce; no persistent writes, timers or background jobs.
export function createSafeStatsMemo({ttlMs=90000,maxStaleMs=300000}={}){
  let snapshot=null,storedAt=0,inFlight=null;
  return async function memoize(loader,{fresh=false}={}){
    const age=Date.now()-storedAt;
    if(!fresh&&snapshot&&age>=0&&age<ttlMs)
      return {...snapshot,statsCache:{hit:true,ageSeconds:Math.floor(age/1000),stale:false}};
    if(inFlight&&!fresh)return inFlight;
    const task=(async()=>{
      try{
        const value=await loader();
        if(!value?.ok)throw Error('content_stats_unavailable');
        snapshot=value;storedAt=Date.now();
        return {...value,statsCache:{hit:false,ageSeconds:0,stale:false}};
      }catch(error){
        const staleAge=Date.now()-storedAt;
        if(snapshot&&staleAge<maxStaleMs)
          return {...snapshot,statsCache:{hit:true,ageSeconds:Math.floor(staleAge/1000),stale:true,error:'temporary_live_refresh_failure'}};
        throw error;
      }
    })();
    inFlight=task;
    try{return await task}finally{if(inFlight===task)inFlight=null}
  };
}
