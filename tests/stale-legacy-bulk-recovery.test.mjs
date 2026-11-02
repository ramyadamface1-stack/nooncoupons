import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyBulkCircuit} from '../bulk-generator.js';
const at=Date.parse('2026-11-02T11:14:22Z');
test('a stagnant legacy engine does not reserve the global publication slot 29 minutes out of 30',()=>{
 const s={bulkLastSuccessAt:'2026-10-18T23:56:27Z',bulkNoPassStreak:7902};
 assert.equal(legacyBulkCircuit(s,at).defer,true);
 const m=Math.floor(at/60000);
 const recovery=(m+30-m%30)*60000;
 assert.equal(legacyBulkCircuit(s,recovery).defer,false);
 assert.equal(legacyBulkCircuit(s,recovery).stale,true);
});
test('new and healthy generators never enter the stale circuit',()=>{
 assert.equal(legacyBulkCircuit({},at).defer,false);
 assert.equal(legacyBulkCircuit({bulkLastSuccessAt:new Date(at-60000).toISOString(),bulkNoPassStreak:7902},at).defer,false);
 assert.equal(legacyBulkCircuit({bulkLastSuccessAt:'2026-10-18T23:56:27Z',bulkNoPassStreak:2},at).defer,false);
});
