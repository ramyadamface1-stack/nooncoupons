import test from 'node:test';
import assert from 'node:assert/strict';
import {RULE_EXPRESSION,RULE_LABEL,PRIMARY_ALLOWED_AGENTS,SVG_ONLY_AUTOMATED_AGENTS} from '../scripts/ndn-secondary-svg-automated-crawler-guard.mjs';

test('secondary crawler SVG rule is narrow, GET-only, with explicit primary bots exclusions',()=>{
  assert.match(RULE_LABEL,/NDN quota guard/);
  assert.ok(RULE_EXPRESSION.startsWith('(http.request.method eq "GET"'));
  assert.match(RULE_EXPRESSION,/starts_with\(http\.request\.uri\.path, "\/assets\/coupon-svg\/"\)/);
  for(const agent of SVG_ONLY_AUTOMATED_AGENTS)
    assert.ok(RULE_EXPRESSION.includes('http.user_agent contains "'+agent+'"'),agent+' only dynamic SVG');
  for(const agent of PRIMARY_ALLOWED_AGENTS)
    assert.ok(RULE_EXPRESSION.includes('not http.user_agent contains "'+agent+'"'),agent+' always allowed');
  assert.ok(!RULE_EXPRESSION.includes('http.request.uri.path, "/articles/"'));
  assert.ok(!RULE_EXPRESSION.includes('http.request.uri.path, "/api/"'));
  assert.ok(!RULE_EXPRESSION.includes('ip.src'));
  assert.ok(!RULE_EXPRESSION.includes('cf.bot_management'));
});
