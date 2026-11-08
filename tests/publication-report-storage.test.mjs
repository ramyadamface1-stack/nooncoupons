import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPublicationArchiveJson} from '../publication-report-storage.js';

const credentials={
  NOON_RESCUE_R2_ACCESS_KEY_ID:'test-public-r2-key',
  NOON_RESCUE_R2_SECRET_ACCESS_KEY:'test-public-r2-secret'
};

async function stubFetch(handler,callback){
  const old=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(url,opts)=>{
    calls++;
    assert.match(String(url),/nooncoupons-content-v2/);
    assert.match(String(opts?.headers?.authorization||''),/AWS4-HMAC-SHA256/);
    return handler(calls);
  };
  try{return await callback(()=>calls)}finally{globalThis.fetch=old}
}

test('publication report prefers existing native R2 when available',async()=>{
  let keyRead='';
  const env={CONTENT_FINAL:{get:async key=>{
    keyRead=key;
    return {json:async()=>({days:[{day:'2026-11-08',count:2}]})};
  }}};
  await stubFetch(()=>{throw Error('unexpected external fetch')},async calls=>{
    const value=await readPublicationArchiveJson(env,'bulk/days.json');
    assert.equal(keyRead,'bulk/days.json');
    assert.equal(value.days.length,1);
    assert.equal(calls(),0);
  });
});

test('publication report uses read-only signed rescue when native binding is absent',async()=>{
  await stubFetch(()=>new Response(JSON.stringify({articles:[{slug:'example'}]}),{status:200}),async calls=>{
    const value=await readPublicationArchiveJson(credentials,'bulk/day/2026-11-08/0.json');
    assert.equal(value.articles[0].slug,'example');
    assert.equal(calls(),1);
  });
});

test('missing archive source returns null, never fake zero published count',async()=>{
  await stubFetch(()=>new Response('missing',{status:404}),async calls=>{
    assert.equal(await readPublicationArchiveJson(credentials,'bulk/days.json'),null);
    assert.equal(calls(),1);
  });
});

test('denied remote R2 read is not silently counted as no publications',async()=>{
  await stubFetch(()=>new Response('denied',{status:403}),async calls=>{
    await assert.rejects(()=>readPublicationArchiveJson(credentials,'bulk/days.json'),/rescue_http_403/);
    assert.equal(calls(),1);
  });
});

test('only read-only bulk JSON keys are supported',async()=>{
  await assert.rejects(()=>readPublicationArchiveJson(credentials,'articles/test.html'),/key_not_allowed/);
});

test('report endpoint consumes rescued archive and returns 503 on source failure',()=>{
  const src=readFileSync(new URL('../discovery-entry.js',import.meta.url),'utf8');
  assert.match(src,/readPublicationArchiveJson\(env,'bulk\/days\.json'\)/);
  assert.match(src,/archive_index_unavailable/);
  assert.match(src,/archive_shard_missing/);
  assert.match(src,/report\.ok\?200:.*?503/);
});
