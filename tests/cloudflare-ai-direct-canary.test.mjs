undefined
test('direct scoped N11 content no longer auto-publishes generic seller guarantee titles',async()=>{
 const {DIRECT_TOPIC_SCOPES,directTopicAt,directTopicSpaceLength}=await import('../cloudflare-ai-direct/topic-space.mjs');
 const original={country:'AE',language:'en-AE',brand:'TP-Link',category:'Smart cameras',topic:'TP-Link Smart cameras: night vision glass reflection | Noon UAE NOV188',coupon:'NOV188',slug:'uae-buyer-tp-link-smart-camera-night-vision-glass-reflection-placement-nov188-2026-n11',queryModifier:'night vision glass reflection placement',sections:['a','b','c','d','e']};
 const index=directTopicSpaceLength([original])-1;
 const scoped=directTopicAt([original],index);
 assert.equal(DIRECT_TOPIC_SCOPES.at(-1).en,'warranty and returns');
 assert.equal(DIRECT_TOPIC_SCOPES.at(-1).ar,'الضمان والإرجاع');
 assert.ok(scoped.topic.includes('warranty and returns'));
 assert.ok(!scoped.topic.includes('seller verification'));
 assert.ok(scoped.slug.includes('-h6-nov188-2026-n11'));
 assert.deepEqual(directTopicAt([original],0),original,'original and published topic identity remains unchanged');
});
