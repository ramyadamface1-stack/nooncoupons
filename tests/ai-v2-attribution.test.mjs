import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSectionAttribution,normalizeAttribution} from '../automation/ai-v2/attribution.mjs';
import {aiV2PublicationWindows} from '../ai-v2-publication-ledger.js';
const part=(provider,keyRef)=>({provider,keyRef,html:'<p>verified</p>'});
const g='aaaaaaaaaaaa',q='bbbbbbbbbbbb';
test('primary key is largest contributor; opaque IDs never include tokens',()=>{
 const x=summarizeSectionAttribution([part('gemini',g),part('groq',q),part('gemini',g),part('groq',q),part('gemini',g)]);
 assert.equal(x.provider,'gemini');assert.equal(x.keyRef,g);assert.equal(x.mixed,true);
 assert.deepEqual(x.contributors,[{provider:'gemini',keyRef:g,sections:3},{provider:'groq',keyRef:q,sections:2}]);
 assert.equal(summarizeSectionAttribution([part('groq',q)]),null);
 assert.equal(normalizeAttribution({...x,keyRef:'api-key-value'}),null);
 assert.equal(normalizeAttribution({...x,contributors:[{provider:'groq',keyRef:q,sections:5}]}),null);
});
test('24h counts per provider and key sum to the same live publications, not AI calls',()=>{
 const at=Date.parse('2026-11-02T20:00:00Z');
 const ledger={ok:true,ledger:{articles:[
  {slug:'sa-example',country:'SA',publishedAt:'2026-11-02T19:00:00Z',provider:'gemini',keyRef:g},
  {slug:'ae-example',country:'AE',publishedAt:'2026-11-02T19:05:00Z',provider:'groq',keyRef:q},
  {slug:'old-provenance',country:'AE',publishedAt:'2026-11-02T19:07:00Z',provider:'ai-v2-native'},
  {slug:'stale',country:'SA',publishedAt:'2026-10-31T19:00:00Z',provider:'groq',keyRef:q}
 ]}};
 const w=aiV2PublicationWindows(ledger,at).windows['24h'];
 assert.equal(w.total,3);
 assert.deepEqual(w.byProvider,{gemini:1,groq:1,unknown:1});
 assert.deepEqual(w.byKey,{['gemini:'+g]:1,['groq:'+q]:1,unknown:1});
});
