
import test from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import {blake2b} from '@noble/hashes/blake2b';
import {sealForGithub,validateImport,listGithubKeySecrets,importGithubKeySecret} from '../ai-v2-github-secrets.js';
import {geminiKeyInventory,selectGeminiKey} from '../automation/ai-v2/gemini-key-pool.mjs';
import {groqKeyInventory} from '../automation/ai-v2/groq-key-pool.mjs';

const g1='AIza'+'A'.repeat(33),g2='AIza'+'B'.repeat(33),g3='AIza'+'C'.repeat(33);
const q1='gsk_'+'X'.repeat(34),q2='gsk_'+'Y'.repeat(34);
const api='https://api.github.com/repos/ramyadamface1-stack/nooncoupons/actions/secrets';
test('sealed box is compatible with GitHub libsodium sealed-box primitive',()=>{
 const recipient=nacl.box.keyPair(),b64=btoa(String.fromCharCode(...recipient.publicKey));
 const plaintext='Sensitive test credential placeholder';
 const decoded=Uint8Array.from(atob(sealForGithub(plaintext,b64)),x=>x.charCodeAt(0));
 const ephemeral=decoded.slice(0,32),concat=new Uint8Array(64);
 concat.set(ephemeral);concat.set(recipient.publicKey,32);
 const nonce=blake2b(concat,{dkLen:24});
 const opened=nacl.box.open(decoded.slice(32),nonce,ephemeral,recipient.secretKey);
 assert.ok(opened,'secret must decrypt using GitHub sealed-box algorithm');
 assert.equal(new TextDecoder().decode(opened),plaintext);
 assert.ok(!new TextDecoder().decode(decoded).includes(plaintext));
});
test('rejects invalid/mixed keys, oversized imports, and dedupes safely',()=>{
 assert.deepEqual(validateImport('gemini',g1+'\n'+g1+'\n'+g2),{keys:[g1,g2],duplicates:1});
 assert.deepEqual(validateImport('groq',JSON.stringify([q1,q2])),{keys:[q1,q2],duplicates:0});
 assert.throws(()=>validateImport('gemini',g1+'\n'+q1),/INVALID_GEMINI_KEY_FORMAT/);
 assert.throws(()=>validateImport('groq',q1+'\n'+g1),/INVALID_GROQ_KEY_FORMAT/);
 assert.throws(()=>validateImport('groq','not-a-key'),/INVALID_GROQ_KEY_FORMAT/);
 assert.throws(()=>validateImport('gemini',''),/EMPTY_IMPORT/);
});
test('all source slots are additive and duplicated keys are not counted twice',()=>{
 const gemini=geminiKeyInventory({GEMINI_API_KEY:g1,GEMINI_API_KEYS:g2,GEMINI_API_KEYS_EXTRA:g2,
   NDN_GEMINI_POOL_01:g3+'\n'+g1});
 assert.equal(gemini.eligibleCount,3);
 assert.equal(gemini.dynamicCount,2);
 assert.equal(selectGeminiKey({GEMINI_API_KEYS:g2,NDN_GEMINI_POOL_01:g3},1).source,'NDN_GEMINI_POOL_01');
 const groq=groqKeyInventory({GROQ_API_KEY:q1,GROQ_API_KEYS:q2,NDN_GROQ_POOL_01:q1+'\n'+q2});
 assert.equal(groq.eligibleCount,2);
 assert.equal(groq.dynamicCount,2);
});
test('GitHub list returns only secret names, never values',async()=>{
 const fetchFn=async(url)=>{assert.equal(url,api+'?per_page=100&page=1');return Response.json({total_count:2,secrets:[
   {name:'GEMINI_API_KEY',updated_at:'2026-11-08T00:00:00Z'},
   {name:'NDN_GROQ_POOL_01',updated_at:'2026-11-08T00:00:00Z'}
 ]})};
 const result=await listGithubKeySecrets('github_pat_1234567890123456789',fetchFn);
 assert.equal(result.groups.gemini[0].configured,true);
 assert.equal(result.groups.groq.find(x=>x.name==='NDN_GROQ_POOL_01').configured,true);
 assert.ok(result.groups.gemini.every(x=>x.valueReadable===false&&x.keyCount===null));
 assert.equal(JSON.stringify(result).includes('github_pat_'),false);
});
test('bulk upload uses next available *new* secret, with sealed ciphertext only',async()=>{
 const recipient=nacl.box.keyPair(),calls=[];
 const fetchFn=async(url,options={})=>{
   calls.push({url,method:options.method||'GET',body:options.body||null});
   if(url===api+'?per_page=100&page=1')return Response.json({total_count:2,secrets:[
     {name:'GEMINI_API_KEY'},{name:'NDN_GEMINI_POOL_01'}
   ]});
   if(url===api+'/public-key')return Response.json({key_id:'key_id_test',key:btoa(String.fromCharCode(...recipient.publicKey))});
   if(url===api+'/NDN_GEMINI_POOL_02')return new Response(null,{status:201});
   throw Error('unexpected fetch '+url);
 };
 const result=await importGithubKeySecret({provider:'gemini',input:g1+'\n'+g2+'\n'+g1,
   token:'github_pat_1234567890123456789',fetchFn});
 assert.equal(result.secretName,'NDN_GEMINI_POOL_02');
 assert.equal(result.addedCount,2);
 assert.equal(result.duplicatesWithinImport,1);
 assert.equal(result.existingSecretsPreserved,true);
 assert.ok(!JSON.stringify(result).includes(g1));
 const put=JSON.parse(calls[2].body);
 assert.ok(!calls[2].body.includes(g1));
 const decoded=Uint8Array.from(atob(put.encrypted_value),x=>x.charCodeAt(0));
 const e=decoded.slice(0,32),concat=new Uint8Array(64);
 concat.set(e);concat.set(recipient.publicKey,32);
 const nonce=blake2b(concat,{dkLen:24});
 const opened=nacl.box.open(decoded.slice(32),nonce,e,recipient.secretKey);
 assert.equal(new TextDecoder().decode(opened),g1+'\n'+g2);
});
test('refuses to overwrite when all provider slots are occupied',async()=>{
 const names=Array.from({length:12},(_,i)=>({name:'NDN_GROQ_POOL_'+String(i+1).padStart(2,'0')}));
 const fetchFn=async()=>Response.json({total_count:names.length,secrets:names});
 await assert.rejects(importGithubKeySecret({provider:'groq',input:q1,
    token:'github_pat_1234567890123456789',fetchFn}),/GITHUB_POOL_SLOTS_FULL/);
});

test('GitHub secret pagination preserves occupied slots that appear on page two',async()=>{
 const secrets=Array.from({length:99},(_,i)=>({name:'OTHER_SECRET_'+i}));
 secrets.push({name:'GEMINI_API_KEY'});
 const second=[{name:'NDN_GEMINI_POOL_01'},{name:'NDN_GEMINI_POOL_02'}];
 const recipient=nacl.box.keyPair();
 const calls=[];
 const fetchFn=async url=>{
   calls.push(url);
   if(url===api+'?per_page=100&page=1')return Response.json({total_count:102,secrets});
   if(url===api+'?per_page=100&page=2')return Response.json({total_count:102,secrets:second});
   if(url===api+'/public-key')return Response.json({key_id:'test',key:btoa(String.fromCharCode(...recipient.publicKey))});
   if(url===api+'/NDN_GEMINI_POOL_03')return new Response(null,{status:201});
   throw Error('unexpected '+url);
 };
 const result=await importGithubKeySecret({provider:'gemini',input:g3,token:'github_pat_1234567890123456789',fetchFn});
 assert.equal(result.secretName,'NDN_GEMINI_POOL_03');
 assert.equal(calls.filter(x=>x.includes('?per_page')).length,2);
});
test('GitHub truncated secret pages reject import without writing or replacing keys',async()=>{
 const fetchFn=async url=>{
   if(url===api+'?per_page=100&page=1')return Response.json({total_count:101,secrets:[{name:'NDN_GROQ_POOL_01'}]});
   throw Error('unexpected write/read '+url);
 };
 await assert.rejects(importGithubKeySecret({
   provider:'groq',input:q2,token:'github_pat_1234567890123456789',fetchFn
 }),/GITHUB_SECRET_PAGINATION_INCOMPLETE/);
});
