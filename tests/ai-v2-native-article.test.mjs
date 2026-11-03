import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEnglishAiV2Article,trimAiSectionHtml} from '../automation/ai-v2/native-article.mjs';
import {validateAiV2NativePayload} from '../ai-v2-native-publish-bridge.js';
const topic={country:'AE',language:'en-AE',coupon:'NOV188',slug:'uae-ninja-airfryer-capacity-warranty-checklist-2026',brand:'Ninja',category:'Air fryers',topic:'Practical Ninja air fryer capacity, warranty and delivery comparison before ordering on Noon UAE'};
const sections=Array.from({length:5},(_,i)=>({html:'<h2>Step '+(i+1)+'</h2>'+Array.from({length:4},()=>'<p>Compare the Ninja air fryer capacity, seller, warranty and the final checkout price before selecting your product on Noon UAE.</p>').join('')}));
test('English native article has valid schema, canonical market, coupon, FAQ and no inline scripting',()=>{
 const result=buildEnglishAiV2Article(topic,sections);
 assert.equal(result.article.country,'AE');
 assert.match(result.article.html,/data-copy-code="NOV188"/);
 assert.match(result.article.html,/https:\/\/www\.noon\.com\/uae-en\//);
 assert.match(result.article.html,/<article lang="en" dir="ltr"/);
 assert.equal((result.article.html.match(/<details>/g)||[]).length,4);
 assert.equal(result.article.faq.length,4);
 const candidate={...result,checkpoint:{state:'PREPARED_FOR_NATIVE_AUDIT',articleId:'a'.repeat(24)}};
 assert.equal(validateAiV2NativePayload(candidate).ok,true);
});
test('rejects unsafe AI HTML and all wrong-market constructions',()=>{
 assert.throws(()=>buildEnglishAiV2Article({...topic,coupon:'NOV170'},sections),/WRONG_ENGLISH_MARKET/);
 assert.throws(()=>buildEnglishAiV2Article(topic,[...sections.slice(0,4),{html:'<p onload="alert(1)">oops</p>'}]),/UNSAFE_AI_SECTION/);
});

test('overlong checkpoint sections trim without another provider call or broken paragraphs',()=>{
 const text='Compare capacity, warranty, seller and checkout carefully before any purchase. ';
 const html='<h2>Purchase guidance</h2>'+Array.from({length:24},()=>'<p>'+text.repeat(5)+'</p>').join('');
 const cut=trimAiSectionHtml(html,285);
 const words=cut.replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
 assert.ok(words<=295&&words>=180);
 assert.equal((cut.match(/<p>/g)||[]).length,(cut.match(/<\/p>/g)||[]).length);
 const article=buildEnglishAiV2Article(topic,Array.from({length:5},()=>({html}))).article;
 const total=article.html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
 assert.ok(total>=1500&&total<=1800,'native draft word count: '+total);
});

test('short but useful AI sections receive substantive buying checks without another provider call',()=>{
 const sections=Array.from({length:5},(_,i)=>({html:'<h2>Buying step '+i+'</h2>'+Array.from({length:4},()=>'<p>'+('Check the specific model, seller and shipping policy before checkout. '.repeat(5))+'</p>').join('')}));
 const article=buildEnglishAiV2Article(topic,sections).article;
 const wc=article.html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
 assert.ok(wc>=1500&&wc<=1900,'word count '+wc);
 assert.ok(article.html.includes('Independent Ninja Air fryers decision checklist'));
});

test('English short saved sections get real topic-specific checks with the existing hard word gate',()=>{
 const brief=Array.from({length:5},(_,i)=>({html:'<h2>Comparison '+i+'</h2><p>'+('Verify the exact model and seller, then compare shipping and final checkout terms. '.repeat(14))+'</p>'}));
 const article=buildEnglishAiV2Article({...topic,topic:'Ninja blender: jar size and cleanup | Noon UAE NOV188'},brief).article;
 const wc=article.html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
 assert.ok(wc>=1500&&wc<=1900,'word count '+wc);
 assert.match(article.html,/Start from this specific question/);
});
