import test from 'node:test';
import assert from 'node:assert/strict';
import {coherentArticleDates} from '../auto-platform.js';

test('article metadata never claims a modification before its original publication',()=>{
  const dates=coherentArticleDates('2026-09-19T00:00:00Z','2026-09-18T00:00:00Z','2026-09-18T00:00:00Z');
  assert.deepEqual(dates,{published:'2026-09-19T00:00:00.000Z',modified:'2026-09-19T00:00:00.000Z'});
});

test('real later updates remain historical rather than being silently moved to today',()=>{
  const dates=coherentArticleDates('2026-09-19T00:00:00Z','2026-10-21T13:30:00Z','2026-09-19T00:00:00Z');
  assert.equal(dates.published,'2026-09-19T00:00:00.000Z');
  assert.equal(dates.modified,'2026-10-21T13:30:00.000Z');
});

test('invalid imported date fields safely use the R2 upload time as publication metadata',()=>{
  const dates=coherentArticleDates('not a date','','2026-10-17T14:32:00Z');
  assert.deepEqual(dates,{published:'2026-10-17T14:32:00.000Z',modified:'2026-10-17T14:32:00.000Z'});
});

test('moving an old article to a new R2 bucket never fabricates an editorial update',()=>{
  const dates=coherentArticleDates('2026-09-19T00:00:00Z',null,'2026-11-18T21:00:00Z');
  assert.deepEqual(dates,{published:'2026-09-19T00:00:00.000Z',modified:'2026-09-19T00:00:00.000Z'});
});
