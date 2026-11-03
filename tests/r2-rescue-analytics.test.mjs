import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');

test('read-only R2 rescue HTML includes production security headers',()=>{
  for(const header of ['content-security-policy','strict-transport-security','x-frame-options','referrer-policy','x-content-type-options']){
    assert.ok(source.includes("'"+header+"'"),'Missing rescue header: '+header);
  }
  assert.match(source,/max-age=31536000; includeSubDomains/);
});

test('rescue pages expose same GA4 measurement and the live code-copy event script',()=>{
  assert.match(source,/'x-ga4-measurement':'G-1551Z7DJ2C'/);
  assert.match(source,/id="rescue-site-analytics"/);
  assert.match(source,/rescueCopyScript/);
  assert.match(source,/rescue-mobile-offer/);
});
