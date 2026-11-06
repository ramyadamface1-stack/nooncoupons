import test from 'node:test';
import assert from 'node:assert/strict';
import {batchArticlePrompt,parseArticleBatch} from '../automation/ai-v2/article-batch.mjs';
const topic={country:'AE',brand:'Anker',category:'USB hubs',coupon:'NOV188',
 topic:'Noon UAE Anker hub ports comparison',sections:['USB ports','Monitor output','Power','Warranty','Cart eligibility']};
const section=i=>'<h2>'+topic.sections[i]+'</h2>'+Array.from({length:3},()=>'<p>'+('Verify model compatibility, seller terms and final checkout conditions before purchasing this exact product. '.repeat(7))+'</p>').join('');
test('single AI response can supply all five valid independently checkable sections',()=>{
 const prompt=batchArticlePrompt(topic);
 assert.ok(prompt.includes('EXACTLY FIVE'));
 const p=parseArticleBatch(Array.from({length:5},(_,i)=>section(i)).join('\n'));
 assert.equal(p.ok,true);assert.equal(p.sections.length,5);assert.equal(p.reason,'BATCH_COMPLETE');
});
test('truncated completion preserves only valid fully received sections, never fabricates the remainder',()=>{
 const p=parseArticleBatch(Array.from({length:3},(_,i)=>section(i)).join('\n'));
 assert.equal(p.ok,true);assert.equal(p.sections.length,3);assert.equal(p.reason,'BATCH_PARTIAL');
});
test('a truncated final batch section reuses the complete paid prefix',()=>{
 const p=parseArticleBatch(section(0)+section(1)+'<h2>Power</h2><p>truncated tail</p>');
 assert.equal(p.ok,true);
 assert.equal(p.reason,'BATCH_PARTIAL');
 assert.equal(p.sections.length,2);
 assert.ok(p.sections[0].includes('USB ports'));
 assert.ok(p.sections[1].includes('Monitor output'));
});
test('unsafe, thin, prefaced and too-many-section responses are blocked',()=>{
 assert.equal(parseArticleBatch('<h2>Too short</h2><p>No</p>').ok,false);
 assert.equal(parseArticleBatch(section(0)+'<script>bad()</script>').ok,false);
 assert.equal(parseArticleBatch('unwanted intro '+section(0)).ok,false);
 assert.equal(parseArticleBatch(Array.from({length:6},(_,i)=>section(i%5)).join('\n')).ok,false);
 assert.throws(()=>batchArticlePrompt({...topic,sections:[]}),/INVALID_BATCH_TOPIC/);
});

test('batch prompt expressly forbids unverifiable fixed discount and guarantee claims',()=>{
 const prompt=batchArticlePrompt(topic);
 assert.match(prompt,/Do NOT write any numerical percentage savings/);
 assert.match(prompt,/guaranteed coupon/);
 assert.match(prompt,/real checkout totals/);
 assert.match(prompt,/The ONLY coupon code allowed/);
 assert.match(prompt,/DIFFERENT concrete buyer decision/);
 assert.match(prompt,/without inventing the values/);
 assert.ok(prompt.includes(topic.coupon));
});
