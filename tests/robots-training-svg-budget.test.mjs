import test from 'node:test';
import assert from 'node:assert/strict';
import {robots} from '../final-platform.js';

const robotsText=robots('https://noondealsnow.com');
function group(name){
  const match=robotsText.match(new RegExp('(?:^|\\n)User-agent: '+name+'\\n([\\s\\S]*?)(?=\\nUser-agent:|\\nSitemap:|$)'));
  return match?.[1]||'';
}

test('GPTBot skips dynamically generated SVG artwork but can still crawl public article text',()=>{
  const g=group('GPTBot');
  assert.match(g,/Allow: \\//);
  assert.match(g,/Disallow: \\/assets\\/coupon-svg\\//);
  assert.doesNotMatch(g,/Disallow: \\/articles\\//);
  assert.doesNotMatch(g,/Disallow: \\/coupon\\//);
  for(const blocked of ['admin','api'])assert.match(g,new RegExp('Disallow: /'+blocked));
});

test('OAI-SearchBot stays separate from training-crawler SVG restriction',()=>{
  const search=group('OAI-SearchBot');
  assert.match(search,/Allow: \\//);
  assert.doesNotMatch(search,/coupon-svg/);
  assert.doesNotMatch(group('*'),/coupon-svg/);
  assert.match(robotsText,/Sitemap: https:\\/\\/noondealsnow\\.com\\/sitemap\\.xml/);
});
