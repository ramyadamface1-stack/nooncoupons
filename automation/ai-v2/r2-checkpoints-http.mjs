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
export async function saveCheckpointRest(config,state,options={}){
 const id=state?.articleId;
 const c=configFor(config,id,options),request=options.fetchFn||fetch;
 const body=JSON.stringify({...state,updatedAt:new Date().toISOString()});
 if(Buffer.byteLength(body,'utf8')>MAX_BODY_BYTES)throw Error('R2_HTTP_CHECKPOINT_TOO_LARGE');
 const response=await request(c.url,{method:'PUT',headers:{...c.headers,'content-type':'application/json; charset=utf-8'},body,signal:AbortSignal.timeout(30000)});
 if(!response.ok){
  // Cloudflare 5xx may arrive AFTER an R2 object was committed. Never retry
  // the write blindly: a duplicate PUT may overwrite a newer checkpoint or
  // resurrect a completed provider request. Perform exactly one read-only
  // reconciliation. Only an exact byte-equivalent saved checkpoint succeeds.
  if([500,502,503,504].includes(response.status)){
   let recovered=null;
   try{recovered=await readCheckpointRest(config,id,{...options,missingOk:true})}catch{}
   if(recovered&&sha(JSON.stringify(recovered))===sha(body))return recovered;
   throw Error('R2_HTTP_PUT_'+response.status+'_UNVERIFIED');
  }
  throw Error('R2_HTTP_PUT_'+response.status);
 }
 const persisted=await readCheckpointRest(config,id,{...options,missingOk:false});
 if(sha(JSON.stringify(persisted))!==sha(body))throw Error('R2_HTTP_CHECKPOINT_READBACK_HASH_MISMATCH');
 return persisted;
}
