import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {existingDestinationR2Binding} from '../r2-remote-existing-bucket.js';

const EMPTY='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const mac=(key,value)=>createHmac('sha256',key).update(value).digest();
const hashed=value=>createHash('sha256').update(value).digest('hex');
const expectedAwsSignature=(url,headers,method,secret)=>{
  const u=new URL(url),stamp=headers.get('x-amz-date'),day=stamp.slice(0,8);
  const auth=headers.get('authorization'),names=auth.match(/SignedHeaders=([^,]+)/)?.[1];
  assert.ok(names);
  const payloadHash=headers.get('x-amz-content-sha256');
  const canonicalHeaders=names.split(';').map(name=>name+':'+(name==='host'?u.host:headers.get(name))+'\n').join('');
  const canonicalRequest=[method,u.pathname,u.search.slice(1),canonicalHeaders,names,payloadHash].join('\n');
  const scope=day+'/auto/s3/aws4_request';
  const stringToSign=['AWS4-HMAC-SHA256',stamp,scope,hashed(canonicalRequest)].join('\n');
  let signingKey=mac('AWS4'+secret,day);
  for(const step of ['auto','s3','aws4_request'])signingKey=mac(signingKey,step);
  return mac(signingKey,stringToSign).toString('hex');
};
test('public R2 GET signatures retain AWS SigV4 correctness across hits and secret rotation',async()=>{
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push({url:String(url),headers:options.headers,method:options.method});
    return new Response('<h1>Published and unchanged</h1>',{status:200,headers:{'content-type':'text/html'}});
  };
  try{
    const firstEnv={NOON_RESCUE_R2_ACCESS_KEY_ID:'public-test-id',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'first-secret-test-only',REMOTE_EXISTING_R2_ENABLED:'true'};
    const binding=existingDestinationR2Binding(firstEnv);
    for(let i=0;i<3;i++)assert.match(await (await binding.get('articles/same-article.html')).text(),/Published/);
    const rotated={...firstEnv,NOON_RESCUE_R2_SECRET_ACCESS_KEY:'rotated-secret-test-only'};
    assert.match(await (await existingDestinationR2Binding(rotated).get('articles/same-article.html')).text(),/Published/);
    assert.equal(requests.length,4);
    for(let i=0;i<requests.length;i++){
      const {url,headers,method}=requests[i];
      assert.equal(method,'GET');
      assert.equal(headers.get('x-amz-content-sha256'),EMPTY);
      const actual=headers.get('authorization').match(/Signature=([a-f0-9]{64})$/)?.[1];
      assert.ok(actual,'Signing header must be present');
      const secret=i<3?firstEnv.NOON_RESCUE_R2_SECRET_ACCESS_KEY:rotated.NOON_RESCUE_R2_SECRET_ACCESS_KEY;
      assert.equal(actual,expectedAwsSignature(url,headers,method,secret));
    }
    assert.notEqual(requests[2].headers.get('authorization'),requests[3].headers.get('authorization'),'Rotated credential must not reuse cached signature');
  }finally{globalThis.fetch=originalFetch}
});
test('the signing cache stays bounded and never short circuits credential checks or changes R2 write guard',()=>{
  const source=readFileSync(new URL('../r2-remote-existing-bucket.js',import.meta.url),'utf8');
  assert.match(source,/let signingKeyCache=null/);
  assert.match(source,/signingKeyCache\.secret===secret/);
  assert.match(source,/signingKeyCache\?\.day===day/);
  assert.match(source,/const hash=body===null\?EMPTY_SHA256:await sha\(raw\)/);
  assert.match(source,/async delete\(\)\{throw Error\('remote_r2_delete_disabled_to_preserve_articles'\)\}/);
  assert.doesNotMatch(source,/console\.log\([^\n]*(?:signingKey|secret)/);
});
