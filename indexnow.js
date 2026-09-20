const enabled=env=>String(env?.INDEXNOW_ENABLED||'false').toLowerCase()==='true'&&Boolean(env?.INDEXNOW_KEY)&&Boolean(env?.SITE_ORIGIN);
const STATE_KEY='_ops/indexnow-queue-v1.json';
const MAX_QUEUE=5000,MAX_SUBMIT=1000,MIN_SUBMIT=50,MIN_INTERVAL_MS=5*60*1000,BACKOFF_429_MS=15*60*1000;
const nowIso=()=>new Date().toISOString();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clampBatch=n=>Math.max(MIN_SUBMIT,Math.min(MAX_SUBMIT,Number(n)||MAX_SUBMIT));

async function readState(env){
  if(!env?.CONTENT_FINAL)return {pending:[],lastAttemptAt:null,lastSuccessAt:null,nextAllowedAt:null,batchSize:MAX_SUBMIT};
  try{const o=await env.CONTENT_FINAL.get(STATE_KEY);return o?await o.json():{pending:[],batchSize:MAX_SUBMIT}}catch{return {pending:[],batchSize:MAX_SUBMIT}}
}
async function saveState(env,state){
  if(!env?.CONTENT_FINAL)return;
  let last;
  for(let i=0;i<3;i++){try{return await env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(state),{httpMetadata:{contentType:'application/json; charset=utf-8'}})}catch(e){last=e;if(i<2)await sleep(60*(i+1))}}
  throw last;
}
function recordUrls(origin,records=[]){
  return [...new Set(records.filter(r=>r?.slug&&r?.indexable!==false).map(r=>{
    const explicit=String(r.urlPath||'').trim();
    const path=explicit.startsWith('/')?explicit:'/articles/'+encodeURI(r.slug);
    try{return new URL(path,origin.origin).toString()}catch{return null}
  }).filter(Boolean))];
}
function retryAfterMs(response,now){
  const raw=String(response?.headers?.get?.('retry-after')||'').trim();
  if(!raw)return 0;
  if(/^\d+$/.test(raw))return Number(raw)*1000;
  const at=Date.parse(raw);
  return Number.isFinite(at)?Math.max(0,at-now):0;
}

export async function submitIndexNow(env,records=[]){
  const isEnabled=enabled(env);
  if(!isEnabled||!records.length)return {enabled:isEnabled,submitted:0,queued:0,deferred:false,status:null,error:null};
  let origin;
  try{origin=new URL(env.SITE_ORIGIN)}catch{return {enabled:true,submitted:0,queued:0,deferred:false,status:null,error:'invalid_site_origin'}}
  const incoming=recordUrls(origin,records);
  if(!incoming.length)return {enabled:true,submitted:0,queued:0,deferred:false,status:null,error:null};

  let state=await readState(env);
  const pending=[...new Set([...(Array.isArray(state.pending)?state.pending:[]),...incoming])].slice(-MAX_QUEUE);
  const now=Date.now(),lastAttempt=Date.parse(state.lastAttemptAt||''),nextAllowed=Date.parse(state.nextAllowedAt||'');
  const intervalBlocked=Number.isFinite(lastAttempt)&&now-lastAttempt<MIN_INTERVAL_MS;
  const backoffBlocked=Number.isFinite(nextAllowed)&&nextAllowed>now;
  const batchSize=clampBatch(state.batchSize);
  if(intervalBlocked||backoffBlocked){
    state={...state,pending,batchSize,queuedAt:nowIso()};
    try{await saveState(env,state)}catch{}
    return {enabled:true,submitted:0,queued:pending.length,deferred:true,status:202,error:null,batchSize,nextAllowedAt:backoffBlocked?state.nextAllowedAt:new Date(lastAttempt+MIN_INTERVAL_MS).toISOString()};
  }

  const urlList=pending.slice(0,batchSize);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
  let status=null,error=null,submitted=0,nextPending=pending,lastSuccessAt=state.lastSuccessAt||null,nextAllowedAt=null,nextBatchSize=batchSize;
  try{
    const response=await fetch('https://api.indexnow.org/indexnow',{
      method:'POST',
      headers:{'content-type':'application/json; charset=utf-8'},
      body:JSON.stringify({host:origin.hostname,key:String(env.INDEXNOW_KEY),keyLocation:origin.origin+'/'+String(env.INDEXNOW_KEY)+'.txt',urlList}),
      signal:controller.signal
    });
    status=response.status;
    if(response.ok){
      submitted=urlList.length;
      nextPending=pending.slice(urlList.length);
      lastSuccessAt=nowIso();
      nextAllowedAt=new Date(now+MIN_INTERVAL_MS).toISOString();
      nextBatchSize=Math.min(MAX_SUBMIT,Math.max(MIN_SUBMIT,batchSize*2));
    }else{
      error='indexnow_http_'+response.status;
      if(response.status===429){
        nextBatchSize=Math.max(MIN_SUBMIT,Math.floor(Math.max(MIN_SUBMIT,urlList.length)/2));
        const wait=Math.max(BACKOFF_429_MS,retryAfterMs(response,now));
        nextAllowedAt=new Date(now+wait).toISOString();
      }else{
        nextAllowedAt=new Date(now+MIN_INTERVAL_MS).toISOString();
      }
    }
  }catch(e){
    error=e?.name==='AbortError'?'indexnow_timeout':'indexnow_submit_failed';
    nextAllowedAt=new Date(now+MIN_INTERVAL_MS).toISOString();
  }finally{clearTimeout(timer)}

  const nextState={
    version:2,
    pending:nextPending.slice(-MAX_QUEUE),
    batchSize:nextBatchSize,
    lastAttemptAt:nowIso(),
    lastSuccessAt,
    lastStatus:status,
    lastError:error,
    nextAllowedAt,
    submittedTotal:Number(state.submittedTotal||0)+submitted,
    updatedAt:nowIso()
  };
  try{await saveState(env,nextState)}catch{}
  return {enabled:true,submitted,queued:nextState.pending.length,deferred:false,status,error,batchSize:nextBatchSize,nextAllowedAt};
}

export const INDEXNOW_INFO={version:4,urlPathAware:true,endpoint:'https://api.indexnow.org/indexnow',queuedInR2:true,stateKey:STATE_KEY,maxQueue:MAX_QUEUE,maxSubmit:MAX_SUBMIT,minSubmit:MIN_SUBMIT,minIntervalMinutes:5,backoff429Minutes:15,adaptive429Batch:true,honorsRetryAfter:true,nonBlockingForPublication:true};
