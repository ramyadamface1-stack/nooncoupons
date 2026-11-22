import test from 'node:test';
import assert from 'node:assert/strict';
import {directTopicAt,directTopicSpaceLength,DIRECT_TOPIC_SCOPES,DIRECT_TOPIC_SPACE_VERSION} from '../cloudflare-ai-direct/topic-space.mjs';

const uae={
 country:'AE',language:'en-AE',brand:'Tommee Tippee',category:'Baby bottles',
 topic:'Tommee Tippee Baby bottles: replacement sealing ring | Noon UAE NOV188',
 queryModifier:'replacement sealing ring cleaning instructions',
 coupon:'NOV188',modelKey:'baby-bottle-n11-sealing',
 comparisonKey:'editorial-n11-baby-bottle-1',
 slug:'uae-buyer-tommee-tippee-baby-bottle-replacement-sealing-ring-cleaning-instructions-nov188-2026-n11',
 sections:['Model','Fit','Seller','Cost','Decision']
};
const sa={
 ...uae,country:'SA',language:'ar-SA',brand:'براون',category:'خلاطات',
 topic:'براون خلاطات: تنظيف قطع وعاء الخلاط | نون السعودية NOV170',
 queryModifier:'تنظيف قطع وعاء الخلاط بعد الاستخدام',
 coupon:'NOV170',
 slug:'saudi-buyer-braun-blender-cleaning-jar-parts-nov170-2026-n11'
};
test('N11 scoped articles keep product-specific buyer intent instead of generic scope-only titles',()=>{
 assert.equal(DIRECT_TOPIC_SPACE_VERSION,'n11-scoped-v1','never reset a persisted publication cursor');
 for(const original of [uae,sa]){
  assert.equal(directTopicSpaceLength([original]),7);
  assert.equal(directTopicAt([original],0),original,'unchanged original article identity');
  const scopeTitles=[];
  for(let i=1;i<=DIRECT_TOPIC_SCOPES.length;i++){
   const scoped=directTopicAt([original],i);
   assert.ok(scoped,'scoped topic '+i+' must not disappear');
   assert.ok(scoped.topic.length<=72&&scoped.topic.length>=28,scoped.topic);
   assert.ok(scoped.topic.includes(original.brand),scoped.topic);
   assert.ok(scoped.topic.includes(original.country==='AE'?'Noon UAE NOV188':'نون السعودية NOV170'),scoped.topic);
   assert.ok(scoped.topic.includes(original.country==='AE'?'replacement':'تنظيف'),scoped.topic);
   if(original.country==='AE')assert.match(scoped.topic,/replacement sealing/,'retain whole product-specific words');
   assert.ok(!scoped.topic.includes('(existing accessories)'),scoped.topic);
   assert.match(scoped.slug,new RegExp('-'+DIRECT_TOPIC_SCOPES[i-1].id+'-nov'+(original.country==='AE'?'188':'170')+'-2026-n11$'));
   assert.ok(scoped.slug!==original.slug);
   assert.equal(scoped.coupon,original.coupon);
   assert.deepEqual(scoped.sections.length,5);
   scopeTitles.push(scoped.topic);
  }
  assert.equal(new Set(scopeTitles).size,scopeTitles.length,'one H1 per scoped buyer decision');
 }
});
test('distinct real-world product questions stay distinct within a single brand and scope',()=>{
 const alternative={...uae,queryModifier:'bottle nipple size age marking evidence',
  topic:'Tommee Tippee Baby bottles: nipple size age | Noon UAE NOV188',
  slug:'uae-buyer-tommee-tippee-baby-bottle-nipple-size-age-marking-evidence-nov188-2026-n11'};
 for(let i=1;i<=DIRECT_TOPIC_SCOPES.length;i++){
  const first=directTopicAt([uae],i),second=directTopicAt([alternative],i);
  assert.ok(first&&second);
  assert.notEqual(first.topic,second.topic,'specific product questions should not share one H1');
 }
});
