import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeImages} from '../brand-runtime.js';

test('preloaded coupon image URL matches the HTML image URL after exactly one escaping pass',()=>{
 const source='<!doctype html><html><head></head><body><img src="/assets/coupon-svg/saudi-article/1.svg?v=11&amp;coupon=NOV195&amp;country=SA" alt="Noon Saudi" width="1600" height="1000"></body></html>';
 const {html,count}=optimizeImages(source);
 assert.equal(count,1);
 assert.match(html,/<link rel="preload" as="image" href="\/assets\/coupon-svg\/saudi-article\/1\.svg\?v=11&amp;coupon=NOV195&amp;country=SA" fetchpriority="high">/);
 assert.doesNotMatch(html,/&amp;amp;/,'a double-escaped query parameter would preload the wrong asset');
 assert.match(html,/<img src="\/assets\/coupon-svg\/saudi-article\/1\.svg\?v=11&amp;coupon=NOV195&amp;country=SA"/);
});

test('an existing image preload is preserved instead of inserting a duplicate',()=>{
 const source='<head><link rel="preload" as="image" href="/img.svg"></head><body><img src="/img.svg" alt="guide"></body>';
 const {html}=optimizeImages(source);
 assert.equal((html.match(/rel="preload"/g)||[]).length,1);
});
