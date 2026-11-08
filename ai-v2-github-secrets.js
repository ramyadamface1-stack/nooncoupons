// Admin-only, stateless GitHub Actions Secret provisioning.
// GitHub never returns original secret VALUES. A dedicated fine-grained PAT
// with repository Secrets: Read and write is required, supplied as an
// environment binding or one-time HTTPS admin form input. Never persist PATs,
// key values, or sealed blobs in Durable Objects, R2, browser storage or logs.
import nacl from 'tweetnacl';
import {blake2b} from '@noble/hashes/blake2b';
import {PROVIDER_SLOTS,LEGACY_SECRET_NAMES} from './automation/ai-v2/key-pool-slots.mjs';
import {parseGeminiKeys} from './automation/ai-v2/gemini-key-pool.mjs';
import {parseGroqKeys} from './automation/ai-v2/groq-key-pool.mjs';

const REPO='ramyadamface1-stack/nooncoupons';
const API='https://api.github.com/repos/'+REPO+'/actions/secrets';
const MAX_IMPORT_BYTES=22000,MAX_KEYS=100;
const textEncoder=new TextEncoder();

function validProvider(provider){return provider==='gemini'||provider==='groq'}
function base64ToBytes(raw){
 if(typeof raw!=='string'||!/^[a-zA-Z0-9+/]+={0,2}$/.test(raw))throw Error('INVALID_GITHUB_PUBLIC_KEY');
 const s=atob(raw);
 return Uint8Array.from(s,c=>c.charCodeAt(0));
}
function bytesToBase64(bytes){
 // Keep ciphertext only in a transient in-memory string, never log it.
 let out='';
 for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(out);
}
export function sealForGithub(plaintext,recipientPublicKey){
 const recipient=base64ToBytes(recipientPublicKey);
 if(recipient.length!==32)throw Error('INVALID_GITHUB_PUBLIC_KEY_LENGTH');
 const privateKey=crypto.getRandomValues(new Uint8Array(32));
 const ephemeral=nacl.box.keyPair.fromSecretKey(privateKey);
 const mixed=new Uint8Array(64);
 mixed.set(ephemeral.publicKey,0);mixed.set(recipient,32);
 const nonce=blake2b(mixed,{dkLen:24});
 const payload=textEncoder.encode(plaintext);
 const encrypted=nacl.box(payload,nonce,recipient,ephemeral.secretKey);
 const wrapped=new Uint8Array(32+encrypted.length);
 wrapped.set(ephemeral.publicKey);wrapped.set(encrypted,32);
 privateKey.fill(0);ephemeral.secretKey.fill(0);payload.fill(0);
 return bytesToBase64(wrapped);
}
export function validateImport(provider,input){
 if(!validProvider(provider))throw Error('INVALID_PROVIDER');
 if(typeof input!=='string'||input.length>MAX_IMPORT_BYTES)throw Error('INVALID_IMPORT_SIZE');
 const value=input.trim();
 if(!value)throw Error('EMPTY_IMPORT');
 let entries;
 if(value.startsWith('[')){
   try{entries=JSON.parse(value)}catch{throw Error('INVALID_IMPORT_JSON')}
   if(!Array.isArray(entries))throw Error('INVALID_IMPORT_JSON');
 }else entries=value.split(/[\s,;]+/);
 if(entries.length>MAX_KEYS)throw Error('IMPORT_TOO_LARGE');
 const check=provider==='gemini'?parseGeminiKeys:parseGroqKeys;
 for(const key of entries){
   if(typeof key!=='string'||check(key).length!==1)throw Error('INVALID_'+provider.toUpperCase()+'_KEY_FORMAT');
 }
 const unique=[...new Set(entries.map(s=>s.trim().replace(/^['"]|['"]$/g,'')))];
 if(!unique.length||unique.length>MAX_KEYS)throw Error('INVALID_IMPORT_COUNT');
 return {keys:unique,duplicates:entries.length-unique.length};
}
const ghHeaders=token=>({
  Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','User-Agent':'NoonDealsNow-Admin-Key-Manager'
});
async function readGithubJson(url,token,request){
 const response=await request(url,{method:'GET',headers:ghHeaders(token),signal:AbortSignal.timeout(12000)});
 if(response.status===401||response.status===403)throw Error('GITHUB_SECRET_PERMISSION_DENIED');
 if(!response.ok)throw Error('GITHUB_SECRET_READ_HTTP_'+response.status);
 const body=await response.json();
 if(!body||typeof body!=='object')throw Error('GITHUB_SECRET_INVALID_RESPONSE');
 return body;
}
export async function listGithubKeySecrets(token,fetchFn=fetch){
 if(typeof token!=='string'||token.trim().length<20)throw Error('GITHUB_SECRETS_TOKEN_REQUIRED');
 const data=await readGithubJson(API+'?per_page=100',token.trim(),fetchFn);
 if(!Array.isArray(data.secrets))throw Error('GITHUB_SECRETS_NOT_LISTED');
 const byName=new Map(data.secrets.filter(x=>x&&typeof x.name==='string').map(x=>[x.name,x]));
 const groups={};
 for(const provider of ['gemini','groq']){
   const names=[...LEGACY_SECRET_NAMES[provider],...PROVIDER_SLOTS[provider]];
   groups[provider]=names.map(name=>({
     name,configured:byName.has(name),scope:'github-actions-secret',
     category:LEGACY_SECRET_NAMES[provider].includes(name)?'existing':'bulk-slot',
     updatedAt:byName.get(name)?.updated_at||null,
     valueReadable:false,keyCount:null,health:'not-measured'
   }));
 }
 return {ok:true,source:'github-repository-secrets-metadata',queriedAt:new Date().toISOString(),
   totalNamedSecrets:data.total_count??data.secrets.length,groups,
   note:'GitHub never exposes existing secret values or per-secret key counts.'};
}
export async function importGithubKeySecret({provider,input,token,fetchFn=fetch}){
 if(!validProvider(provider))throw Error('INVALID_PROVIDER');
 const {keys,duplicates}=validateImport(provider,input);
 if(typeof token!=='string'||token.trim().length<20)throw Error('GITHUB_SECRETS_TOKEN_REQUIRED');
 const auth=token.trim();
 const metadata=await listGithubKeySecrets(auth,fetchFn);
 const slot=metadata.groups[provider].find(s=>s.category==='bulk-slot'&&!s.configured);
 if(!slot)throw Error('GITHUB_POOL_SLOTS_FULL');
 const publicKey=await readGithubJson(API+'/public-key',auth,fetchFn);
 if(typeof publicKey.key!=='string'||typeof publicKey.key_id!=='string')throw Error('GITHUB_PUBLIC_KEY_MISSING');
 const sealed=sealForGithub(keys.join('\n'),publicKey.key);
 const response=await fetchFn(API+'/'+slot.name,{method:'PUT',headers:{...ghHeaders(auth),'content-type':'application/json'},
   body:JSON.stringify({encrypted_value:sealed,key_id:publicKey.key_id}),signal:AbortSignal.timeout(18000)});
 if(response.status===401||response.status===403)throw Error('GITHUB_SECRET_PERMISSION_DENIED');
 if(![201,204].includes(response.status))throw Error('GITHUB_SECRET_SAVE_HTTP_'+response.status);
 return {ok:true,provider,secretName:slot.name,addedCount:keys.length,
   duplicatesWithinImport:duplicates,githubSaved:true,usableFromNextRun:true,
   existingSecretsPreserved:true,keysExposed:false,verifiedQuota:false,
   message:'GitHub Actions Secret was saved; provider and quota health are not yet verified.'};
}
