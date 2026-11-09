import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {rescueCopyScript} from '../rescue-article-conversion.js';

function boot({clipboardWorks=true}={}){
  const clicks=[],events=[],beacons=[];
  const article={getAttribute:name=>name==='data-market'?'SA':null};
  const doc={
    addEventListener:(name,handler)=>{if(name==='click')clicks.push(handler)},
    querySelector:name=>name==='.rescue-article[data-market]'?article:null,
    dispatchEvent(){},
    documentElement:{lang:'ar'},
    body:{appendChild(){}},
    execCommand:()=>false,
    createElement:()=>({style:{},setAttribute(){},select(){},remove(){},value:''})
  };
  const navigator={
    doNotTrack:'',
    clipboard:{async writeText(){if(!clipboardWorks)throw Error('clipboard denied')}},
    sendBeacon(url){beacons.push(url);return true}
  };
  const window={doNotTrack:'',gtag:(...args)=>events.push(args)};
  const source=rescueCopyScript.replace(/^<script\b[^>]*>/,'').replace(/<\/script>\s*$/,'');
  runInNewContext(source,{document:doc,navigator,window,URL,location:{pathname:'/articles/probe',href:'https://noondealsnow.com/articles/probe'},CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail}}});
  assert.equal(clicks.length,2,'rescue script must register outbound and copy handlers');
  return {clicks,events,beacons,article};
}
function couponCopyEvent(){
  const root={getAttribute:name=>name==='data-market'?'SA':null};
  const button={dataset:{placement:'top'},textContent:'نسخ الكود',closest:selector=>selector==='[data-market]'?root:null};
  return {target:{closest:selector=>selector.startsWith('button[')?button:null},preventDefault(){},stopImmediatePropagation(){}};
}
test('confirmed copy emits a single coupon_copy_success and no purchase',async()=>{
  const h=boot();
  await h.clicks[1](couponCopyEvent());
  assert.equal(h.events.filter(e=>e[1]==='coupon_copy_success').length,1);
  assert.equal(h.events.find(e=>e[1]==='coupon_copy_success')[2].coupon_code,'NOV170');
  assert.equal(h.events.filter(e=>e[1]==='coupon_copy').length,1);
  assert.ok(h.events.every(e=>e[1]!=='purchase'));
});
test('denied clipboard and failed fallback must not count as a copy',async()=>{
  const h=boot({clipboardWorks:false});
  await h.clicks[1](couponCopyEvent());
  assert.equal(h.events.filter(e=>e[1]==='coupon_copy_success'||e[1]==='coupon_copy').length,0);
});
test('generic Noon outbound does not invent a coupon source',()=>{
  const h=boot();
  const anchor={href:'https://www.noon.com/saudi-ar/',closest:()=>null,getAttribute:()=>null};
  h.clicks[0]({target:{closest:selector=>selector==='a[href]'?anchor:null}});
  const outbound=h.events.find(e=>e[1]==='noon_outbound');
  assert.ok(outbound,'Noon click should be counted');
  assert.equal(outbound[2].coupon_code,'','no coupon inference on generic link');
});
test('explicit coupon offer outbound retains only its actual displayed code',()=>{
  const h=boot();
  const offer={
    getAttribute:name=>name==='data-market'?'SA':null,
    querySelector:selector=>selector==='button[data-rescue-copy]'?{getAttribute:()=> 'NOV170'}:null
  };
  const anchor={href:'https://www.noon.com/saudi-ar/',closest:selector=>selector==='.rescue-offer'?offer:null,getAttribute:()=>null};
  h.clicks[0]({target:{closest:selector=>selector==='a[href]'?anchor:null}});
  assert.equal(h.events.find(e=>e[1]==='noon_outbound')[2].coupon_code,'NOV170');
});
