import {scrypt} from 'node:crypto';
import {Buffer} from 'node:buffer';
const ADMIN_EMAIL='ramyshahin02@gmail.com';
const SCRYPT_SALT_HEX='ee9b4532585ebeae835aa4f12009038e';
const SCRYPT_EXPECTED_HEX='1c4cee171eca31e14008dbed3cfd4b692f808464d719b6f16474a54a9b7e7cac';
const SCRYPT_N=16384, SCRYPT_R=8, SCRYPT_P=1, SCRYPT_MAX_MEM=64*1024*1024;
const SESSION_TTL=60*60*24*7;
const enc=new TextEncoder();
const json=(x,s=200,extra={})=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const hexToBytes=h=>new Uint8Array((h.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
const toHex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(s){return toHex(await crypto.subtle.digest('SHA-256',enc.encode(String(s||''))))}
function passwordHash(password){
 return new Promise((resolve,reject)=>{
  scrypt(String(password||''),Buffer.from(SCRYPT_SALT_HEX,'hex'),32,{N:SCRYPT_N,r:SCRYPT_R,p:SCRYPT_P,maxmem:SCRYPT_MAX_MEM},
   (error,derived)=>error?reject(error):resolve(derived.toString('hex')));
 });
}
function constantTimeHexEqual(a,b){const x=hexToBytes(a),y=hexToBytes(b);if(x.length!==y.length)return false;let mismatch=0;for(let i=0;i<x.length;i++)mismatch|=x[i]^y[i];return mismatch===0}
function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return toHex(a)}
async function gctl(env,path,init){const id=env.GENERATOR_CONTROL.idFromName('primary');return env.GENERATOR_CONTROL.get(id).fetch('https://generator.internal'+path,init)}
export async function secureLogin(req,env){let b={};try{b=await req.json()}catch{}if(String(b.email||'').trim().toLowerCase()!==ADMIN_EMAIL)return json({ok:false,error:'invalid_credentials'},401);let candidate;try{candidate=await passwordHash(b.password)}catch(e){return json({ok:false,error:'password_verification_unavailable',diagnostic:String(e?.name||'UnknownError').slice(0,55)},503)}if(!constantTimeHexEqual(candidate,SCRYPT_EXPECTED_HEX))return json({ok:false,error:'invalid_credentials'},401);const raw=randomToken(),hash=await sha256(raw),expires=new Date(Date.now()+SESSION_TTL*1000).toISOString();const r=await gctl(env,'/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hash,email:ADMIN_EMAIL,expires})});if(!r.ok)return json({ok:false,error:'session_store_failed'},500);return json({ok:true},200,{'set-cookie':`nc_admin=${encodeURIComponent(raw)}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Strict`})}
