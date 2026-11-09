import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleSystem1KeywordIndex,system1ScoreTopic,INTENT_WEIGHTS,buildFromProject} from '../automation/ai-v2/system1-keyword-index.mjs';
const base={country:'SA',language:'ar-SA',slug:'saudi-samsung-warranty-in-depth-2026',brand:'Samsung',category:'جوالات',topic:'مقارنة جوال سامسونج قبل شراء من نون السعودية'};
test('SYSTEM1 keyword weights total 100 and never invent search volume or content gap',()=>{
 assert.equal(Object.values(INTENT_WEIGHTS).reduce((a,b)=>a+b,0),100);
 const result=system1ScoreTopic(base);
 assert.equal(result.scoreOutOf,100);
 assert.equal(result.breakdown.siteRelevance,20);
 assert.equal(result.breakdown.verifiedDemand,null);
 assert.equal(result.breakdown.contentGap,null);
 assert.equal(result.measured,false);
});
test('keyword inventory deduplicates market and slug without silently changing coupons',()=>{
 const a=assembleSystem1KeywordIndex([base,base,{...base,country:'AE',language:'en-AE'},{
    country:'AE',slug:'uae-ninja-airfryer-checklist-2026',topic:'Ninja air fryer seller warranty and capacity comparison',
    brand:'Ninja',category:'Air fryer',language:'en-AE'
  }],{limitPerCountry:5,now:'2026-11-09T00:00:00Z'});
 assert.equal(a.total,3);
 assert.equal(a.items.length,3);
 assert.equal(a.canDirectlyApproveOrIgnore,false);
 assert.ok(a.items.every(x=>x.priorityStatus==='partial_no_demand_or_gap_evidence'));
 assert.ok(a.items.every(x=>x.status==='ALREADY_IN_RUNNER_QUEUE'));
 assert.ok(a.items.every(x=>x.discovered_at===null));
 assert.ok(a.items.every(x=>x.target_article_id===null));
});
test('real source topic bank yields a bounded unique sample from both markets',()=>{
 const data=buildFromProject();
 assert.equal(data.version,1);
 assert.ok(data.total>=100);
 assert.ok(data.items.length<=240);
 assert.ok(data.items.some(x=>x.country==='SA'));
 assert.ok(data.items.some(x=>x.country==='AE'));
 assert.equal(new Set(data.items.map(x=>x.country+':'+x.slug)).size,data.items.length);
 assert.equal(data.demandMeasured,false);
});
