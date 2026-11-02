import test from 'node:test';
import assert from 'node:assert/strict';
import topics from '../automation/ai-v2/topics.json' with {type:'json'};
import {buildSaudiAiV2Article} from '../automation/ai-v2/native-arabic-article.mjs';
import {validateAiV2NativePayload} from '../ai-v2-native-publish-bridge.js';
import {couponCodeCandidates} from '../quality-audit.js';
import {qualityPreflight} from '../automation/ai-v2/guardrails.mjs';
import config from '../automation/ai-v2/config.json' with {type:'json'};
const sa=topics.find(t=>t.country==='SA');
const text='قارن المواصفات مع شروط الضمان والبائع والشحن قبل الشراء. تأكد من الموديل والملحقات وتكلفة التوصيل والإرجاع داخل السعودية. ';
const sections=Array.from({length:5},(_,i)=>({html:'<h2>كيف تراجع المواصفات قبل الشراء '+(i+1)+'</h2>'+Array.from({length:6},()=>'<p>'+text.repeat(5)+'</p>').join('')}));
test('Saudi article renderer has market-lock, 4 images, 5 nav links, verified source and JSON-LD',()=>{
 const n=buildSaudiAiV2Article(sa,sections);
 assert.equal(n.article.country,'SA');
 assert.equal(validateAiV2NativePayload({...n,checkpoint:{state:'PREPARED_FOR_NATIVE_AUDIT',articleId:'a'.repeat(24)}}).ok,true);
 assert.ok((n.article.html.match(/<img\b/g)||[]).length>=4);
 assert.ok((n.article.html.match(/<details>/g)||[]).length>=4);
 assert.ok((n.article.html.match(/<script type="application\/ld\+json">/g)||[]).length===2);
 assert.equal(n.article.html.includes('NOV188'),false);
 assert.ok(n.article.html.includes('data-copy-code="NOV170"'));
 assert.ok(n.article.html.includes('https://www.noon.com/saudi-ar/'));
});
test('Arabic draft preflight never assumes native audit success or promises fixed savings',()=>{
 const n=buildSaudiAiV2Article(sa,sections);
 const preliminary=qualityPreflight({html:n.article.html,topic:sa},config);
 assert.equal(preliminary.fullNativeQualityAuditRequired,true);
 assert.equal(typeof preliminary.pass,'boolean');
 assert.equal(/خصم مضمون لكل حساب/.test(n.article.html),false);
});
test('wrong code, invalid country and executable fragment fail closed',()=>{
 assert.throws(()=>buildSaudiAiV2Article({...sa,coupon:'NOV188'},sections),/WRONG_SAUDI_MARKET/);
 const bad=sections.map(x=>({...x}));bad[0].html+='<script>alert(1)</script>';
 assert.throws(()=>buildSaudiAiV2Article(sa,bad),/UNSAFE_AI_SECTION/);
});

test('Saudi product guide removes literal code from title without changing approved code, URL or CTA',()=>{
 const sample=topics.find(t=>t.country==='SA'&&t.topic.includes('NOV170'));
 assert.ok(sample,'Saudi buying topic with embedded coupon must exist');
 const output=buildSaudiAiV2Article(sample,sections);
 assert.equal(output.article.slug,sample.slug);
 assert.equal(output.article.title.includes('NOV170'),false);
 assert.ok(output.article.title.length>=28&&output.article.title.length<=72);
 assert.ok(output.article.html.includes('data-copy-code="NOV170"'));
 assert.ok(output.article.html.includes('https://www.noon.com/saudi-ar/'));
 assert.equal(output.article.html.includes('NOV188'),false);
});

test('short Saudi drafts receive useful verification guidance without bypassing native word or security checks',()=>{
 const short=sections.map((s,i)=>({
   html:'<h2>خطوة التحقق '+(i+1)+'</h2><p>'+text.repeat(3)+'</p>'
 }));
 const article=buildSaudiAiV2Article(sa,short).article;
 assert.ok(article.html.includes('buyer-fit-depth'));
 assert.ok(article.html.includes('لا تعتبر الخصم محققًا'));
 assert.ok(article.html.includes('data-copy-code="NOV170"'));
 const quality=qualityPreflight({html:article.html,topic:sa},config);
 assert.equal(quality.fullNativeQualityAuditRequired,true);
 assert.equal(quality.pass,quality.violations.length===0);
});

test('Saudi coupon P0 gate ignores HDR10 product standard but still rejects wrong coupon token',()=>{
 assert.deepEqual(couponCodeCandidates('نون السعودية NOV170 يدعم HDR10 و IP67 و DDR5'),['NOV170']);
 assert.deepEqual(couponCodeCandidates('NOV170 NOV188 HDR10'),['NOV170','NOV188']);
 assert.deepEqual(couponCodeCandidates('NOV170 HDR10 NOV170'),['NOV170']);
});
