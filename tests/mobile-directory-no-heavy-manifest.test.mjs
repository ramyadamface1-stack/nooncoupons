import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commerceLanding} from '../commerce-pages-v2.js';

for(const market of ['saudi','uae']){
 test(market+' categories is indexable and R2-free, with live country blog link',async()=>{
   const env={CONTENT_FINAL:{get:async()=>{throw Error('directory must never scan articles')}}};
   const response=await commerceLanding('/'+market+'/categories','https://noondealsnow.com',env);
   assert.equal(response.status,200);
   assert.match(response.headers.get('content-type'),'text/html');
   const html=await response.text();
   assert.match(html,new RegExp('/blog/'+market));
   assert.match(html,/<h1>/);
   assert.match(html,/viewport/);
   assert.doesNotMatch(html,/Worker exceeded resource limits/);
 });
}
