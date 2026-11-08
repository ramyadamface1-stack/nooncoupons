// Per-market sanitized AI V2 runtime telemetry. No raw keys, provider API
// requests, article drafts, or GitHub tokens ever enter this JSON. The R2 key
// is PRIVATE and read by authenticated /api/admin/ai-v2-monitor only.
import {createHash} from 'node:crypto';
import config from './config.json' with {type:'json'};
import {parseGeminiKeys} from './gemini-key-pool.mjs';
import {parseGroqKeys} from './groq-key-pool.mjs';
import {secretNames} from './key-pool-slots.mjs';
import {providerCircuitId,providerCircuitActive} from './provider-circuit.mjs';
import {readCheckpointRest} from './r2-checkpoints-http.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const MAX_PER_PROVIDER=60;

function inventory(env,provider){
 const parse=provider==='gemini'?parseGeminiKeys:parseGroqKeys,seen=new Set(),out=[];
 for(const source of secretNames(provider)){
   for(const key of parse(env[source])){
     if(seen.has(key))continue;
     seen.add(key);out.push({key,provider,source,ref:sha(key).slice(0,12)});
   }
 }
 return out;
}
async function keyStatus(row,read){
 let state=null;
 const id=providerCircuitId(row.provider,sha,row.provider==='groq'&&row.source==='GROQ_API_KEY'?null:row.ref);
 try{state=await read(id)}catch{return {status:'unverified',error:'checkpoint_unavailable'}}
 if(state&&providerCircuitActive(state)){
   if(state.state==='PAUSED_QUOTA')return {status:'quota-wait',resumeAt:state.resumeAt||null};
   return {status:'provider-wait',resumeAt:state.resumeAt||null};
 }
 return {status:'eligible-unverified',resumeAt:null};
}
async function scanProvider(env,provider,read){
 const rows=inventory(env,provider),all=rows.length,inspected=rows.slice(0,MAX_PER_PROVIDER);
 let globalPaused=false,globalUntil=null,globalReason=null;
 try{const global=await read(providerCircuitId(provider,sha));
   if(providerCircuitActive(global)){globalPaused=true;globalUntil=global.resumeAt||null;globalReason=global.state||null}
 }catch{}
 const safe=[];
 for(let i=0;i<inspected.length;i+=8){
   const batch=await Promise.all(inspected.slice(i,i+8).map(async row=>{
     const item=globalPaused?{status:globalReason==='PAUSED_QUOTA'?'quota-wait':'provider-wait',resumeAt:globalUntil}:await keyStatus(row,read);
     return {id:row.ref,source:row.source,status:item.status,resumeAt:item.resumeAt||null};
   }));
   safe.push(...batch);
 }
 const counts={eligibleUnverified:safe.filter(x=>x.status==='eligible-unverified').length,
   quotaWait:safe.filter(x=>x.status==='quota-wait').length,
   providerWait:safe.filter(x=>x.status==='provider-wait').length,
   unverified:safe.filter(x=>x.status==='unverified').length,
   notInspected:Math.max(0,all-safe.length)};
 return {total:all,inspected:safe.length,counts,globalPaused,entries:safe,verifiedLiveKeyCount:null};
}
export async function buildSafeMonitor(env,{market,lastReport=null,lastSelected=null,reader=null}={}){
 if(!['SA','AE'].includes(market))throw Error('INVALID_MONITOR_MARKET');
 const read=reader||((id)=>readCheckpointRest(config,id,{missingOk:true}));
 const providers={};
 for(const provider of ['gemini','groq'])providers[provider]=await scanProvider(env,provider,read);
 const selected=lastSelected?{
   provider:lastSelected.provider||null,id:lastSelected.keyRef||null,
   source:lastSelected.source||null,model:lastSelected.model||null,at:lastSelected.at||null
 }:null;
 return {version:1,site:'noondealsnow',market,generatedAt:new Date().toISOString(),
   lastOutcome:lastReport?{status:lastReport.status||'UNKNOWN',reason:String(lastReport.reason||'').slice(0,90),
     lastUrl:String(lastReport.url||'').slice(0,320),published:lastReport.status==='LIVE_VERIFIED'}:null,
   selected,providers,
   semantics:'eligible-unverified means no observed active quota circuit, NOT that provider is live-verified',
   keyMaterialIncluded:false};
}
export async function writeSafeMonitor(payload,env=process.env,request=fetch){
 const token=String(env.CLOUDFLARE_API_TOKEN||'').trim();
 const account=String(env.CLOUDFLARE_ACCOUNT_ID||'').trim();
 if(!token||!/^[0-9a-f]{32}$/i.test(account))return {ok:false,reason:'R2_TELEMETRY_CREDENTIALS_MISSING'};
 const key='_ops/ai-v2-runtime-'+payload.market+'.json';
 const url='https://api.cloudflare.com/client/v4/accounts/'+account+
   '/r2/buckets/nooncoupons-content-v2/objects/'+key;
 const res=await request(url,{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 if(!res.ok)return {ok:false,reason:'R2_TELEMETRY_WRITE_HTTP_'+res.status};
 return {ok:true};
}
