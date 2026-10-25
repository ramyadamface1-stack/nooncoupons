import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBulkCandidateTopicSeed as pick} from '../bulk-candidate-diversity.js';
const space=33554432;
const opts={topicSpace:space};
test('normal 1/min generation preserves existing monotonic candidate cursor',()=>{
  for(let i=1;i<=100;i++)assert.equal(pick(150000+i,i,opts),150000+i);
});
test('standard Cron with thousands of failed quality candidates explores independent candidate families EVERY try',()=>{
  const seeds=Array.from({length:48},(_,i)=>pick(12780354+i,i+1,{...opts,lowYield:true,burstMode:false}));
  for(let i=0;i<48;i++){
    assert.ok(Number.isInteger(seeds[i])&&seeds[i]>=0&&seeds[i]<space);
    assert.notEqual(seeds[i],12780354+i,'stalled cursor must not revisit adjacent saturated slot');
  }
  assert.equal(new Set(seeds).size,48,'each current-minute candidate explores a distinct topic seed');
  const buckets=new Set(seeds.map(x=>Math.floor(x/1000000)));
  assert.ok(buckets.size>=20,'48 attempts should span many distant topic-space segments');
});
test('existing Saudi low-yield burst behavior remains enabled',()=>{
  assert.notEqual(pick(1000,3,{...opts,lowYield:false,burstMode:true,forceCountry:'SA',previousYieldPct:100}),1000);
  assert.notEqual(pick(1000,3,{...opts,lowYield:false,burstMode:true,forceCountry:'AE',previousYieldPct:0}),1000);
});
test('ordinary UAE burst does not diversify without actual low yield',()=>{
  assert.equal(pick(1000,3,{...opts,burstMode:true,forceCountry:'AE',previousYieldPct:30}),1000);
});
test('input and topic-size bounds fail closed',()=>{
  assert.throws(()=>pick(-1,3,opts),/invalid_bulk_topic_cursor/);
  assert.throws(()=>pick(1,0,opts),/invalid_bulk_candidate_attempt/);
  assert.throws(()=>pick(1,3,{topicSpace:0,lowYield:true}),/invalid_bulk_topic_space/);
});
test('same cursor and attempt always choose the same candidate seed',()=>{
  for(let n=1;n<120;n++){
    let cfg={...opts,lowYield:n%2===0,burstMode:n%2!==0,forceCountry:'SA'};
    assert.equal(pick(3876543+n,n,cfg),pick(3876543+n,n,cfg));
  }
});
