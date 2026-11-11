// One-time deployment migration of existing user-provided GitHub secrets to
// Cloudflare Worker secrets. No provider API calls and no raw key logging.
// stdout MUST be piped directly into "wrangler secret put"; never echo it.
import {parseGeminiKeys} from '../automation/ai-v2/gemini-key-pool.mjs';
import {parseGroqKeys} from '../automation/ai-v2/groq-key-pool.mjs';
const provider=process.argv[2];
if(!['gemini','groq'].includes(provider))throw Error('VALID_PROVIDER_REQUIRED');
const parse=provider==='gemini'?parseGeminiKeys:parseGroqKeys;
const env=process.env,prefix=provider==='gemini'?'NDN_GEMINI_POOL_':'NDN_GROQ_POOL_';
const names=provider==='gemini'?['GEMINI_API_KEYS','GEMINI_API_KEYS_EXTRA','GEMINI_API_KEY']:
 ['GROQ_API_KEYS','GROQ_API_KEYS_EXTRA','GROQ_API_KEY'];
const values=[...names.map(name=>env[name]),...Array.from({length:12},(_,i)=>env[prefix+String(i+1).padStart(2,'0')])];
const keys=[...new Set(values.flatMap(raw=>parse(raw)))];
if(!keys.length)throw Error('NO_EXISTING_'+provider.toUpperCase()+'_KEYS_IN_DEPLOY_SECRETS');
// Bounded split: never silently omit credentials or exceed per-secret limits.
const maxBytes=4200,chunks=[];let next=[];
for(const key of keys){
 const test=[...next,key];
 if(Buffer.byteLength(JSON.stringify(test))>maxBytes){
  if(!next.length)throw Error('SINGLE_KEY_EXCEEDS_CLOUDFLARE_SECRET_LIMIT');
  chunks.push(next);next=[key];
 }else next=test;
}
if(next.length)chunks.push(next);
if(chunks.length>8)throw Error('MORE_THAN_EIGHT_CLOUDFLARE_SECRET_SHARDS_REQUIRED');
const selector=String(process.argv[3]||'1');
if(selector==='count'){
 process.stdout.write(String(chunks.length));
}else{
 const index=Number(selector);
 if(!Number.isInteger(index)||index<1||index>chunks.length)throw Error('INVALID_SECRET_PART');
 process.stdout.write(JSON.stringify(chunks[index-1]));
 process.stderr.write('CLOUDFLARE_'+provider.toUpperCase()+'_KEYS_PART='+index+'/'+chunks.length+';COUNT='+chunks[index-1].length+'\n');
}
