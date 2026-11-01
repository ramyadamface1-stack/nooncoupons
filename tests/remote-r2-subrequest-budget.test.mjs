import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteR2SubrequestBudget} from '../r2-remote-existing-bucket.js';

test('remote cross-account R2 budget reserves twenty external subrequests on Free Workers',()=>{
 const budget=createRemoteR2SubrequestBudget();
 assert.deepEqual(budget.snapshot(),{used:0,limit:30,remaining:30});
 for(let i=0;i<30;i++)assert.equal(budget.take(),i+1);
 assert.deepEqual(budget.snapshot(),{used:30,limit:30,remaining:0});
 assert.throws(()=>budget.take(),/remote_r2_subrequest_budget_deferred/);
 assert.equal(budget.snapshot().used,30);
});
test('invalid limits fail closed and all snapshots are immutable copies',()=>{
 assert.throws(()=>createRemoteR2SubrequestBudget(50),/invalid_remote_r2_budget/);
 assert.throws(()=>createRemoteR2SubrequestBudget(0),/invalid_remote_r2_budget/);
 const budget=createRemoteR2SubrequestBudget(2),first=budget.snapshot();
 first.remaining=99;
 assert.equal(budget.snapshot().remaining,2);
 budget.take();assert.equal(budget.snapshot().remaining,1);
 budget.take();assert.throws(()=>budget.take(),/budget_deferred/);
});
