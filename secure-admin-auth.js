const ADMIN_EMAIL='ramyshahin02@gmail.com';
const PBKDF2_SALT_HEX='14c01dc6e55b767582fc059e0fc23973';
const PBKDF2_EXPECTED_HEX='5447b7f0cddcfebe078c1ccb64bec8912c4e28c3455e76f14060abcc9e081179';
const PBKDF2_ITERATIONS=310000;
const SESSION_TTL=60*60*24*7;
const enc=new TextEncoder();
const json=(x,s=200,extra={})=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const hexToBytes=h=>new Uint8Array((h.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
const toHex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(s){return toHex(await crypto.subtle.digest('SHA-256',enc.encode(String(s||''))))}
async function passwordHash(password){const key=await crypto.subtle.importKey('raw',enc.encode(String(password||'')),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:hexToBytes(PBKDF2_SALT_HEX),iterations:PBKDF2_ITERATIONS},key,256);return toHex(bits)}
function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return toHex(a)}
async function gctl(env,path,init){const id=env.GENERATOR_CONTROL.idFromName('primary');return env.GENERATOR_CONTROL.get(id).fetch('https://generator.internal'+path,init)}
export async function secureLogin(req,env){let b={};try{b=await req.json()}catch{}if(String(b.email||'').trim().toLowerCase()!==ADMIN_EMAIL||await passwordHash(b.password)!==PBKDF2_EXPECTED_HEX)return json({ok:false,error:'invalid_credentials'},401);const raw=randomToken(),hash=await sha256(raw),expires=new Date(Date.now()+SESSION_TTL*1000).toISOString();const r=await gctl(env,'/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hash,email:ADMIN_EMAIL,expires})});if(!r.ok)return json({ok:false,error:'session_store_failed'},500);return json({ok:true},200,{'set-cookie':`nc_admin=${encodeURIComponent(raw)}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Strict`})}
