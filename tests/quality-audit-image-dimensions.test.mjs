import test from 'node:test';
import assert from 'node:assert/strict';
import {imageMeetsAuditAttributes} from '../quality-audit.js';

const tag=(width,height)=>`<img src="/assets/coupon-svg/article/1.svg" alt="Noon Saudi Arabia coupon guide" title="Noon Saudi guide" width="${width}" height="${height}">`;

test('SEO image-quality gate accepts 1600x1000 artwork and existing 1200x760 pages',()=>{
  assert.equal(imageMeetsAuditAttributes(tag(1600,1000)),true);
  assert.equal(imageMeetsAuditAttributes(tag(1200,760)),true);
  assert.equal(imageMeetsAuditAttributes(tag(1600,760)),false);
  assert.equal(imageMeetsAuditAttributes(tag(1200,1000)),false);
  assert.equal(imageMeetsAuditAttributes(tag(1600,100)),false);
});

test('image-quality gate still requires descriptive alt and title even for correct dimensions',()=>{
  assert.equal(imageMeetsAuditAttributes('<img width="1600" height="1000" alt="short" title="Noon">'),false);
  assert.equal(imageMeetsAuditAttributes('<img width="1600" height="1000" alt="Noon Saudi Arabia coupon guide">'),false);
  assert.equal(imageMeetsAuditAttributes('<img width="1600" height="1000" title="Noon">'),false);
});
