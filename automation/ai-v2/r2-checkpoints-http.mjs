// Native Cloudflare R2 REST transport: same private bucket, prefix and token
// as Wrangler CLI, without spawning a new CLI process for each checkpoint.
// Never log credentials, draft bodies or unpublished article content.
import {createHash} from 'node:crypto';
import {objectPath} from './r2-checkpoints.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const MAX_BODY_BYTES=250000;

function configFor(config,id,options={}){
 const token=options.token||process.env.CLOUDFLARE_API_TOKEN;
 const account=options.accountId||process.env.CLOUDFLARE_ACCOUNT_ID;
 if(!/^[a-f0-9]{32}$/i.test(String(account||'')))throw Error('R2_HTTP_ACCOUNT_INVALID');
 if(typeof token!=='string'||token.length<8)throw Error('R2_HTTP_TOKEN_MISSING');
 const relative=objectPath(config,id);
 const split=relative.indexOf('/');
 const bucket=relative.slice(0,split),key=relative.slice(split+1);
 if(!/^nooncoupons-content-v2$/.test(bucket))throw Error('R2_HTTP_WRONG_BUCKET');
 const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/r2/buckets/'+bucket+'/objects/'+key;
 return {url,headers:{authorization:'Bearer '+token}};
}
export async function readCheckpointRest(config,id,options={}){
 const c=configFor(config,id,options),request=options.fetchFn||fetch;
 const response=await request(c.url,{method:'GET',headers:{...c.headers,'cache-control':'no-store'},signal:AbortSignal.timeout(30000)});
 if(response.status===404&&options.missingOk!==false)return null;
 if(!response.ok)throw Error('R2_HTTP_GET_'+response.status);
 const raw=await response.text();
 if(!raw||Buffer.byteLength(raw,'utf8')>MAX_BODY_BYTES)throw Error('R2_HTTP_GET_INVALID_SIZE');
 let state;
 try{state=JSON.parse(raw)}catch{throw Error('R2_HTTP_GET_INVALID_JSON')}
 if(!state||typeof state!=='object'||Array.isArray(state)||state.articleId!==id)throw Error('R2_HTTP_CHECKPOINT_ID_MISMATCH');
 return state;
}
// R2 write timeouts are ambiguous: Cloudflare may have committed the object
// before the transport aborted. Only an exact GET readback can confirm this.
// Never retry PUT or treat an unavailable GET as evidence of a missing write.
async function confirmedCheckpointReadback(config,id,body,options){
 try{
  const persisted=await readCheckpointRest(config,id,{...options,missingOk:true});
  return persisted&&sha(JSON.stringify(persisted))===sha(body)?persisted:null;
 }catch{return null}
}
export async function saveCheckpointRest(config,state,options={}){
 const id=state?.articleId;
 const c=configFor(config,id,options),request=options.fetchFn||fetch;
 const body=JSON.stringify({...state,updatedAt:new Date().toISOString()});
 if(Buffer.byteLength(body,'utf8')>MAX_BODY_BYTES)throw Error('R2_HTTP_CHECKPOINT_TOO_LARGE');
 let response;
 try{
  response=await request(c.url,{method:'PUT',headers:{...c.headers,'content-type':'application/json; charset=utf-8'},body,signal:AbortSignal.timeout(30000)});
 }catch{
  const recovered=await confirmedCheckpointReadback(config,id,body,options);
  if(recovered)return recovered;
  throw Error('R2_HTTP_PUT_TRANSPORT_OUTCOME_UNVERIFIED');
 }
 if(!response.ok){
  // A 5xx has the same unknown-write semantics as a network timeout.
  // Reconcile via a single exact GET only; NEVER repeat the write.
  if([500,502,503,504].includes(response.status)){
   const recovered=await confirmedCheckpointReadback(config,id,body,options);
   if(recovered)return recovered;
   throw Error('R2_HTTP_PUT_'+response.status+'_UNVERIFIED');
  }
  throw Error('R2_HTTP_PUT_'+response.status);
 }
 let persisted;
 try{
  persisted=await readCheckpointRest(config,id,{...options,missingOk:false});
 }catch{
  // A successful PUT followed by a timed-out readback still needs proof.
  // One additional GET is safe and does not resend checkpoint data.
  const recovered=await confirmedCheckpointReadback(config,id,body,options);
  if(recovered)return recovered;
  throw Error('R2_HTTP_CHECKPOINT_READBACK_UNVERIFIED');
 }
 if(sha(JSON.stringify(persisted))!==sha(body))throw Error('R2_HTTP_CHECKPOINT_READBACK_HASH_MISMATCH');
 return persisted;
}
