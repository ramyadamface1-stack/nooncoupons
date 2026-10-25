import test from 'node:test';
import assert from 'node:assert/strict';
import {seedReconcileDue} from '../cron-seed-cadence.js';
test('seed state is reconciled once per hour, not 60 times, while due posts run every minute',()=>{
  const start=Date.parse('2026-10-25T00:00:00Z');
  const minutes=Array.from({length:180},(_,n)=>start+n*60000);
  const seeded=minutes.filter(seedReconcileDue);
  assert.equal(seeded.length,3);
  assert.equal(seeded[0],start);
  assert.equal(seeded[1],start+3600000);
});
test('invalid timestamps fail closed',()=>{
  assert.equal(seedReconcileDue(undefined),false);
  assert.equal(seedReconcileDue(NaN),false);
  assert.equal(seedReconcileDue(-1),false);
});
