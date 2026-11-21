import test from 'node:test';
import assert from 'node:assert/strict';
import {coherentArticleDates,verifiedBulkArticleDates} from '../auto-platform.js';

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

test('generic storage sync or migration timestamps never masquerade as an editorial article update',()=>{
  const published='2026-09-19T00:00:00.000Z';
  const sync='2026-11-20T21:35:00.000Z';
  const metadata={at:published,updatedAt:sync,modifiedAt:sync};
  const reviewed='2026-11-18T16:20:00.000Z';
  const clock='2026-11-21T02:00:00.000Z';
  const uploaded=new Date(sync);
  assert.deepEqual(verifiedBulkArticleDates(metadata,uploaded,clock),{published,modified:published});
  assert.deepEqual(verifiedBulkArticleDates({...metadata,editorialUpdatedAt:reviewed},uploaded,clock),
    {published,modified:reviewed});
  assert.deepEqual(verifiedBulkArticleDates({...metadata,substantiveUpdatedAt:reviewed},uploaded,clock),
    {published,modified:reviewed});
  assert.equal(verifiedBulkArticleDates({...metadata,editorialUpdatedAt:'2026-12-02T00:00:00Z'},uploaded,clock).modified,published);
  assert.equal(verifiedBulkArticleDates({...metadata,editorialUpdatedAt:'2026-08-15T00:00:00Z'},uploaded,clock).modified,published);
});
test('published date fallback stays historical, and a future revision is not announced early',()=>{
  const uploaded=new Date('2026-10-17T14:32:00Z'),clock='2026-11-21T00:00:00Z';
  assert.equal(verifiedBulkArticleDates({updatedAt:'2026-11-19T00:00:00Z'},uploaded,clock).published,uploaded.toISOString());
  assert.equal(coherentArticleDates('2026-10-17T14:32:00Z','2026-12-01T08:00:00Z',uploaded,clock).modified,uploaded.toISOString());
});
