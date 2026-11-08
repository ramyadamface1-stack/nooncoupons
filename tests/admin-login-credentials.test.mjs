import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scrypt} from 'node:crypto';
import {secureLogin} from '../secure-admin-auth.js';
import {renderAdmin} from '../admin-page.js';

const origin='https://noondealsnow.com';
const email='ramyshahin02@gmail.com';
const makeRequest=(value)=>new Request(origin+'/api/admin/login',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(value)
});
function fakeEnv(status=200){
  const calls=[];
  return {
    calls,
    env:{GENERATOR_CONTROL:{
      idFromName:()=> 'primary',
      get:()=>({fetch:async(url,init={})=>{
        calls.push({path:new URL(url).pathname,method:init.method||'GET',payload:init.body&&JSON.parse(init.body)});
        return Response.json(status===200?{ok:true}:{error:'unavailable'},{status});
      }})
    }}
  };
}

test('requested admin account is the only login email; wrong password never creates session',async()=>{
  const result=fakeEnv();
  const wrong=await secureLogin(makeRequest({email,password:'wrong-test-password'}),result.env);
  assert.equal(wrong.status,401);
  assert.equal((await wrong.json()).error,'invalid_credentials');
  assert.equal(wrong.headers.get('set-cookie'),null);
  assert.equal(result.calls.length,0);
  const other=await secureLogin(makeRequest({email:'nobody@example.com',password:'wrong-test-password'}),result.env);
  assert.equal(other.status,401);
  assert.equal(result.calls.length,0);
});

test('login response creates secure session with independently derived synthetic test password',async()=>{
  // Inject an unrelated test-only verifier in a transient module; production
  // password is NOT placed in GitHub source, test logs or test fixtures.
  const source=readFileSync(new URL('../secure-admin-auth.js',import.meta.url),'utf8');
  const fixture='unit-test-password-never-used-in-production';
  const salt='00112233445566778899aabbccddeeff';
  const hash=await new Promise((resolve,reject)=>scrypt(fixture,Buffer.from(salt,'hex'),32,
    {N:16384,r:8,p:1,maxmem:64*1024*1024},
    (err,derived)=>err?reject(err):resolve(derived.toString('hex'))));
  const modified=source.replace(/(SCRYPT_SALT_HEX=')[0-9a-f]+(')/,"$1"+salt+"$2")
    .replace(/(SCRYPT_EXPECTED_HEX=')[0-9a-f]+(')/,"$1"+hash+"$2");
  assert.notEqual(modified,source);
  const module=await import('data:text/javascript,'+encodeURIComponent(modified));
  const okEnv=fakeEnv();
  const response=await module.secureLogin(makeRequest({email:email.toUpperCase(),password:fixture}),okEnv.env);
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
  assert.match(response.headers.get('set-cookie'),/^nc_admin=[a-f0-9]{64};/);
  assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal(okEnv.calls.length,1);
  assert.equal(okEnv.calls[0].path,'/session');
  assert.equal(okEnv.calls[0].payload.email,email);
  assert.match(okEnv.calls[0].payload.hash,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(okEnv.calls).includes(fixture));
  const failEnv=fakeEnv(503);
  const fail=await module.secureLogin(makeRequest({email,password:fixture}),failEnv.env);
  assert.equal(fail.status,500);
  assert.equal(fail.headers.get('set-cookie'),null);
});

test('admin login UI has correct email, hides password and preserves AI generation anchor',async()=>{
 const result=await renderAdmin(new Request(origin+'/admin'),fakeEnv().env);
 assert.equal(result.status,200);
 const page=await result.text();
 assert.match(page,/id="loginEmail" type="email" autocomplete="username" value="ramyshahin02@gmail.com"/);
 assert.match(page,/id="loginPassword" type="password" autocomplete="current-password"/);
 assert.match(page,/location\.hash\|\|'#aiV2Panel'/);
 assert.doesNotMatch(page,/value="Adam20/);
 assert.match(result.headers.get('cache-control'),/no-store/);
 assert.match(result.headers.get('x-robots-tag'),/noindex/);
});
