import test from 'node:test';
import assert from 'node:assert/strict';
import {decideTick} from '../ai-scheduler-v2/worker.mjs';
import config from '../automation/ai-v2/config.json' with {type:'json'};
const start=Date.parse('2026-11-01T12:00:00.000Z');
test('default disables dispatch',()=>{assert.equal(decideTick(config,start,start).reason,'SCHEDULER_DISABLED')});
test('exactly twelve five-minute slots in an hour',()=>{
const c={...config,enabled:true};let count=0;
for(let i=0;i<60;i++){const t=start+i*60000;if(decideTick(c,t,t+1000).due)count++}
assert.equal(count,12);
assert.equal(decideTick(c,start+60000,start+60000).reason,'INTERVAL_NOT_ELAPSED');
});
test('clock-skew and unsupported intervals are rejected',()=>{
const c={...config,enabled:true};
assert.equal(decideTick(c,start,start+181000).reason,'CLOCK_SKEW');
assert.equal(decideTick({...c,intervalMinutes:7},start,start).reason,'INVALID_INTERVAL');
});
