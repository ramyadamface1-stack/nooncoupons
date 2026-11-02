// NoonDealsNow: read-only test of every configured Gemini and Groq key.
// No generation calls, secrets in logs, or publishing-state changes.
import {readFileSync,appendFileSync} from 'node:fs';
import {parseGeminiKeys} from './gemini-key-pool.mjs';
import {parseGroqKeys} from './groq-key-pool.mjs';

const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url),'utf8'));
const sources=[
  ['gemini','GEMINI_API_KEY',parseGeminiKeys],
  ['gemini','GEMINI_API_KEYS',parseGeminiKeys],
  ['gemini','GEMINI_API_KEYS_EXTRA',parseGeminiKeys],
  ['groq','GROQ_API_KEY',parseGroqKeys],
  ['groq','GROQ_API_KEYS',parseGroqKeys],
  ['groq','GROQ_API_KEYS_EXTRA',parseGroqKeys]
];
const inventory=[];
const seen={gemini:new Set(),groq:new Set()};
const counts={gemini:0,groq:0,missing:0,duplicate:0};
for(const [provider,source,parse] of sources){
  const raw=process.env[source]||'';
  const keys=parse(raw);
  if(!keys.length){
    counts.missing++;
    inventory.push({provider,source,index:0,key:null,status:raw?'NO_RECOGNIZED_KEYS':'NOT_CONFIGURED'});
    continue;
  }
  for(let n=0;n<keys.length;n++){
    const key=keys[n];
    if(seen[provider].has(key)){
      counts.duplicate++;
      inventory.push({provider,source,index:n+1,key:null,status:'DUPLICATE_SKIPPED'});
    }else{
      seen[provider].add(key);
      counts[provider]++;
      inventory.push({provider,source,index:n+1,key,status:'PENDING'});
    }
  }
}
const requestedGemini=String(config.models?.gemini||'').replace(/^models\//,'');
const requestedGroq=String(config.models?.groq||'');
async function query(url,headers){
  try{
    const res=await fetch(url,{method:'GET',headers,signal:AbortSignal.timeout(12000)});
    if(!res.ok)return {http:res.status};
    const body=await res.json().catch(()=>null);
    return {http:res.status,body};
  }catch(err){
    return {http:0,error:err?.name==='TimeoutError'?'TIMEOUT':'NETWORK_ERROR'};
  }
}
const codeStatus=(http,error)=>{
  if(error)return error;
  if(http===400||http===401||http===403)return 'AUTH_REJECTED_OR_RESTRICTED';
  if(http===429)return 'PROVIDER_RATE_LIMITED';
  if(http>=500)return 'PROVIDER_ERROR';
  return 'CHECK_FAILED';
};
async function test(item){
  if(!item.key)return {provider:item.provider,source:item.source,index:item.index,status:item.status};
  const {provider,source,index,key}=item;
  if(provider==='gemini'){
    const list=await query('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{'x-goog-api-key':key});
    if(list.http!==200)return {provider,source,index,status:codeStatus(list.http,list.error),http:list.http};
    const models=Array.isArray(list.body?.models)?list.body.models:[];
    const exists=models.some(m=>m.name==='models/'+requestedGemini);
    return {provider,source,index,status:!requestedGemini?'AUTH_OK_MODEL_NOT_CONFIGURED':exists?'AUTH_OK_MODEL_LISTED':'AUTH_OK_MODEL_NOT_LISTED',http:200};
  }
  const list=await query('https://api.groq.com/openai/v1/models',{'authorization':'Bearer '+key});
  if(list.http!==200)return {provider,source,index,status:codeStatus(list.http,list.error),http:list.http};
  const models=Array.isArray(list.body?.data)?list.body.data:[];
  const exists=models.some(m=>m.id===requestedGroq);
  return {provider,source,index,status:exists?'AUTH_OK_MODEL_LISTED':'AUTH_OK_MODEL_NOT_LISTED',http:200};
}
const pending=inventory.filter(i=>i.key);
if(pending.length>300){
  console.log('KEY_TEST_LIMIT exceeded=300 count='+pending.length);
  process.exitCode=2;
}else{
  const results=[];
  // Sequential reads avoid bursts against free tier shared rate limits.
  for(const item of inventory){
    const result=await test(item);
    results.push(result);
    console.log('KEY_TEST '+JSON.stringify(result));
  }
  const summary={totalUnique:pending.length,gemini:counts.gemini,groq:counts.groq,
    duplicates:counts.duplicate,missingSecrets:counts.missing,statusCounts:{}};
  for(const r of results)summary.statusCounts[r.status]=(summary.statusCounts[r.status]||0)+1;
  console.log('KEY_TEST_SUMMARY '+JSON.stringify(summary));
  if(process.env.GITHUB_STEP_SUMMARY){
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### NoonDealsNow - read-only API key inventory and model access\n'+
      'No secret values are printed. No generation, publishing, or paid content calls are made.\n\n'+
      '| Provider | GitHub secret | Index | Result | HTTP |\n|---|---|---:|---|---:|\n'+
      results.map(r=>'| '+r.provider+' | '+r.source+' | '+(r.index||'-')+' | '+r.status+' | '+(r.http||'-')+' |').join('\n')+
      '\n\n**Unique keys:** '+summary.totalUnique+' (Gemini '+counts.gemini+', Groq '+counts.groq+').\n'+
      '**Note:** AUTH_OK_MODEL_LISTED verifies API authentication and model listing, not remaining generation quota or article publication.\n');
  }
}
