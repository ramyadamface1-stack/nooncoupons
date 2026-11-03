import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mergeNativeBlogRows,enrichNativeBlogCards} from '../auto-platform.js';

test('AI V2 published articles lead blog and country filters without duplicate slugs',()=>{
 const ledger={ok:true,ledger:{articles:[
  {slug:'native-sa-post-000001',country:'SA',publishedAt:'2026-11-03T21:00:00Z'},
  {slug:'native-ae-post-000001',country:'AE',publishedAt:'2026-11-03T21:01:00Z'}
 ]}};
 const bulk=[{slug:'old-bulk-post-000001',country:'SA',status:'published',createdAt:'2026-10-20T12:00:00Z'}];
 const all=mergeNativeBlogRows(ledger,[],bulk);
 assert.equal(all.length,3);
 assert.equal(all[0].slug,'native-ae-post-000001');
 assert.deepEqual(mergeNativeBlogRows(ledger,[],bulk,'SA').map(a=>a.slug),['native-sa-post-000001','old-bulk-post-000001']);
 assert.deepEqual(mergeNativeBlogRows(ledger,[],bulk,'AE').map(a=>a.slug),['native-ae-post-000001']);
});
test('published card metadata provides actual title, description and market coupon',async()=>{
 const rows=[{slug:'native-sa-post-000001',country:'SA',aiV2Native:true}];
 const storage={head:async()=>({customMetadata:{t:encodeURIComponent('أحدث دليل شراء نون السعودية'),m:encodeURIComponent('محتوى مفيد للمشتري'),cp:'NOV170'}})};
 const result=await enrichNativeBlogCards(rows,storage);
 assert.equal(result[0].title,'أحدث دليل شراء نون السعودية');
 assert.equal(result[0].coupon,'NOV170');
 assert.equal(result[0].metaDescription,'محتوى مفيد للمشتري');
});
test('missing R2 metadata is nonfatal, does not fabricate publication',async()=>{
 const row={slug:'native-sa-post-000001',country:'SA',aiV2Native:true};
 const result=await enrichNativeBlogCards([row],{head:async()=>{throw Error('transient R2')}});
 assert.match(result[0].title,/native sa post/);
});
