// Private Cloudflare Worker key storage. No raw credentials in logs, DO state,
// checkpoints or public status; bulk imports are individually AES-GCM encrypted.
const ROOT='_ops/noondealsnow-direct-ai-v1/keys/';
const enc=new TextEncoder(),dec=new TextDecoder();
const inputKeys=(provider,input)=>{
 const rows=Array.isArray(input)?input:String(input||'').trim().startsWith('[')?
  JSON.parse(String(input)):String(input||'').split(/[\s,;]+/);
 if(!Array.isArray(rows)||rows.length>100)throw Error('INVALID_KEY_BATCH');
 const re=provider==='gemini'?/^(?:AQ\.|AIza)[A-Za-z0-9._-]{9,}$/:provider==='groq'?/^gsk_[A-Za-z0-9_-]{16,}$/:null;
 if(!re)throw Error('INVALID_PROVIDER');
 const keys=[...new Set(rows.map(k=>String(k||'').trim()).filter(k=>re.test(k)))];
 if(!keys.length||keys.length!==rows.filter(x=>String(x||'').trim()).length&&rows.length===1)throw Error('INVALID_KEY_FORMAT');
 return keys;
};
function base64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
function fromBase64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function master(env){
 if(!env.NDN_KEYS_MASTER)throw Error('DIRECT_KEY_ENCRYPTION_NOT_CONFIGURED');
 const raw=fromBase64(env.NDN_KEYS_MASTER);
 if(raw.length!==32)throw Error('INVALID_MASTER_KEY_LENGTH');
 return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function seal(env,provider,keys){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('noondealsnow|'+provider)},await master(env),enc.encode(JSON.stringify(keys)));
 return {version:1,provider,iv:base64(iv),ciphertext:base64(new Uint8Array(ciphertext)),count:keys.length,createdAt:new Date().toISOString()};
}
async function unseal(env,record){
 const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(record.iv),
   additionalData:enc.encode('noondealsnow|'+record.provider)},await master(env),fromBase64(record.ciphertext));
 return inputKeys(record.provider,JSON.parse(dec.decode(bytes)));
}
const validProvider=p=>p==='gemini'||p==='groq';
export async function importDirectKeys(env,{provider,keys}={}){
 if(!validProvider(provider))throw Error('INVALID_PROVIDER');
 if(String(keys||'').length>22000)throw Error('INVALID_IMPORT_SIZE');
 const parsed=inputKeys(provider,keys);
 const record=await seal(env,provider,parsed);
 const key=ROOT+provider+'/'+Date.now()+'-'+crypto.randomUUID()+'.json';
 const result=await env.CONTENT_FINAL.put(key,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:'*'},
  httpMetadata:{contentType:'application/json; charset=utf-8'}});
 if(!result)throw Error('KEY_IMPORT_NOT_CONFIRMED');
 // No plaintext is stored, no existing key batches are overwritten.
 return {ok:true,provider,addedCount:parsed.length,duplicatesWithinImport:0,
   secretName:'Cloudflare R2 (encrypted batch)',encrypted:true,source:'cloudflare-r2',
   githubSaved:false,existingSecretsPreserved:true};
}
const legacyKeys=(env,p)=>{try{return inputKeys(p,JSON.parse(String(p==='gemini'?env.GEMINI_KEYS_JSON:env.GROQ_KEYS_JSON)||'[]'))}catch{return []}};
export async function listDirectKeys(env,{includePlain=false}={}){
 const groups={},keys={gemini:[...legacyKeys(env,'gemini')],groq:[...legacyKeys(env,'groq')]};
 for(const provider of ['gemini','groq']){
  const listed=await env.CONTENT_FINAL.list({prefix:ROOT+provider+'/',limit:150});
  const entries=[{name:'Cloudflare Worker Secrets',configured:keys[provider].length>0,
    scope:'cloudflare-worker-secret',category:'existing',keyCount:keys[provider].length,valueReadable:false}];
  for(const object of listed.objects){
   const data=await env.CONTENT_FINAL.get(object.key);
   if(!data)continue;
   let row;
   try{row=await data.json()}catch{continue}
   if(row.provider!==provider||!Number.isInteger(row.count))continue;
   let stored=[];
   try{stored=await unseal(env,row);if(includePlain)keys[provider].push(...stored)}catch{continue}
   entries.push({name:object.key.split('/').at(-1).slice(0,20),configured:true,
    category:'bulk-slot',scope:'encrypted-cloudflare-r2',keyCount:row.count,
    valueReadable:false,updatedAt:row.createdAt});
  }
  groups[provider]=entries;
 }
 if(!includePlain)return {ok:true,source:'cloudflare-worker-secrets-and-encrypted-r2',
  groups,queriedAt:new Date().toISOString(),totalNamedSecrets:groups.gemini.length+groups.groq.length,
  note:'Credentials never leave Cloudflare on read; bulk imports are AES-256-GCM encrypted.'};
 for(const provider of ['gemini','groq'])keys[provider]=[...new Set(keys[provider])];
 return keys;
}
export const DIRECT_KEYS_R2_PREFIX=ROOT;
