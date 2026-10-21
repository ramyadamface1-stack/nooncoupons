import test from 'node:test';
import assert from 'node:assert/strict';
import { enableExistingDestinationR2, existingDestinationR2Binding } from '../r2-remote-existing-bucket.js';
const f=()=>({
  NOON_RESCUE_R2_ACCESS_KEY_ID:'fake',
  NOON_RESCUE_R2_SECRET_ACCESS_KEY:'fake',
  REMOTE_EXISTING_R2_ENABLED:'true'
});
test('no fallback by default; native R2 binding always wins',()=>{
  const native={get:()=>null};
  assert.equal(enableExistingDestinationR2({...f(),REMOTE_EXISTING_R2_ENABLED:'false'}).CONTENT_FINAL,undefined);
  assert.equal(enableExistingDestinationR2({...f(),CONTENT_FINAL:native}).CONTENT_FINAL,native);
  assert.equal(typeof enableExistingDestinationR2(f()).CONTENT_FINAL.put,'function');
});
test('refuses delete and unknown/private key access',async()=>{
  const r=existingDestinationR2Binding(f());
  await assert.rejects(r.delete('articles/slug.html'),/delete_disabled/);
  await assert.rejects(r.get('admin/credentials.json'),/allowlisted/);
  await assert.rejects(r.put('articles/../../malicious.html','test'),/allowlisted/);
  await assert.rejects(r.list({prefix:'private/'}),/allowlisted/);
});
test('signed PUT/GET/HEAD/LIST use identical existing bucket and preserve MIME, metadata and text',async()=>{
  const original=globalThis.fetch,calls=[],objects=new Map();
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),method:options.method,headers:Object.fromEntries(options.headers.entries())});
    const u=new URL(url),key=decodeURI(u.pathname).slice('/nooncoupons-content-v2/'.length);
    const auth=options.headers.get('authorization');
    assert.match(auth,/AWS4-HMAC-SHA256/);
    assert.match(url,/e4c35f8a50a7b2e4cfb9d6c534962603\.r2\.cloudflarestorage\.com/);
    if(u.searchParams.has('list-type'))return new Response('<?xml version="1.0"?><ListBucketResult><Contents><Key>articles%2Fsafe-test.html</Key><Size>9</Size><ETag>"abc"</ETag></Contents><IsTruncated>false</IsTruncated></ListBucketResult>',{status:200});
    if(options.method==='PUT'){
      const body=new Uint8Array(options.body),hdr=new Headers(options.headers);
      objects.set(key,{body,hdr});
      return new Response(null,{status:200,headers:{etag:'"abc"'}});
    }
    if(!objects.has(key))return new Response(null,{status:404});
    const obj=objects.get(key);
    const hs=new Headers({'Content-Type':obj.hdr.get('content-type')||'text/plain','Content-Length':String(obj.body.length),'Last-Modified':'Tue, 20 Oct 2026 06:00:00 GMT'});
    hs.set('x-amz-meta-status',obj.hdr.get('x-amz-meta-status')||'');
    if(options.headers.get('range'))hs.set('Content-Range','bytes 0-0/'+obj.body.length);
    return new Response(options.headers.get('range')?obj.body.slice(0,1):obj.body,{status:options.headers.get('range')?206:200,headers:hs});
  };
  try{
    const r=existingDestinationR2Binding(f());
    await r.put('articles/safe-test.html','<h1>OK</h1>',{httpMetadata:{contentType:'text/html'},customMetadata:{status:'published'}});
    const row=await r.get('articles/safe-test.html');
    assert.match(await row.text(),/OK/);
    assert.equal(row.customMetadata.status,'published');
    assert.equal(row.httpMetadata.contentType,'text/html');
    const head=await r.head('articles/safe-test.html');
    assert.equal(head.size,11);
    const list=await r.list({prefix:'articles/',limit:15});
    assert.equal(list.objects[0].key,'articles/safe-test.html');
    assert.equal(list.truncated,false);
    assert.deepEqual(calls.map(x=>x.method),['PUT','GET','GET','GET']);
  }finally{globalThis.fetch=original}
});
test('prevents oversized single-part writes and unimplemented conditional overwrites',async()=>{
  const r=existingDestinationR2Binding(f());
  await assert.rejects(r.put('articles/a.html','abc',{onlyIf:{unsupportedCondition:true}}),/unsupported_conditional_option/);
  await assert.rejects(r.put('articles/a.html','abc',{onlyIf:{uploadedAfter:new Date('invalid')}}),/invalid_date_condition/);
  await assert.rejects(r.put('articles/b.html',new Uint8Array(8*1024*1024+1)),/size_limit/);
});
test('does not expose any web route for remote storage',async()=>{
  const x=enableExistingDestinationR2(f());
  assert.equal(x.CONTENT_FINAL.get instanceof Function,true);
  assert.equal('fetch' in x.CONTENT_FINAL,false);
});

test('atomic create-once with If-None-Match:* succeeds once, subsequent 412 returns null without overwriting',async()=>{
  const original=globalThis.fetch, seen=new Map(),calls=[];
  globalThis.fetch=async(url,options)=>{
    const hdr=options.headers,conditional=hdr.get('if-none-match');
    const key=String(url).split('/').at(-1),value=Buffer.from(options.body).toString();
    calls.push({conditional,signed:hdr.get('authorization')||'',body:value});
    assert.equal(conditional,'*');
    assert.match(hdr.get('authorization'),/SignedHeaders=[^,]*if-none-match/);
    if(seen.has(key))return new Response('<Error><Code>PreconditionFailed</Code></Error>',{status:412,headers:{'content-type':'application/xml'}});
    seen.set(key,value);
    return new Response(null,{status:200,headers:{etag:'"afterfirst"'}});
  };
  try{
    const r=existingDestinationR2Binding(f());
    const first=await r.put('maintenance/conditional-test.html','alpha',{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'text/html'}});
    const second=await r.put('maintenance/conditional-test.html','beta',{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'text/html'}});
    assert.equal(first.etag,'afterfirst');
    assert.equal(second,null);
    assert.equal(seen.get('conditional-test.html'),'alpha');
    assert.equal(calls.length,2);
  }finally{globalThis.fetch=original}
});
test('If-Match and date conditions are signed in the same atomic PUT as the content',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options)=>{
    const hdr=options.headers;
    calls.push(Object.fromEntries(hdr.entries()));
    return new Response(null,{status:200,headers:{etag:'"fresh"'}});
  };
  try{
    const r=existingDestinationR2Binding(f());
    const result=await r.put('articles/signed-conditional.html','safe',{
      onlyIf:{etagMatches:'abc123',uploadedBefore:new Date('2026-10-21T00:00:00Z')}
    });
    assert.equal(result.etag,'fresh');
    assert.equal(calls[0]['if-match'],'"abc123"');
    assert.equal(calls[0]['if-unmodified-since'],'Wed, 21 Oct 2026 00:00:00 GMT');
    assert.match(calls[0].authorization,/SignedHeaders=[^,]*if-match/);
    assert.match(calls[0].authorization,/SignedHeaders=[^,]*if-unmodified-since/);
    await r.put('articles/signed-conditional.html','safe',{
      onlyIf:new Headers({'If-None-Match':'*','If-Modified-Since':'Wed, 21 Oct 2026 00:00:00 GMT'})
    });
    assert.equal(calls[1]['if-none-match'],'*');
    assert.equal(calls[1]['if-modified-since'],'Wed, 21 Oct 2026 00:00:00 GMT');
    await assert.rejects(
      r.put('articles/signed-conditional.html','safe',{onlyIf:new Headers({'x-private':'unsafe'})}),
      /unsupported_conditional_header/
    );
  }finally{globalThis.fetch=original}
});
