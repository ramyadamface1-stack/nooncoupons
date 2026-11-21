import test from 'node:test';
import assert from 'node:assert/strict';
import {robots} from '../final-platform.js';

const robotsText=robots('https://noondealsnow.com');
function group(name){
  const lines=robotsText.split('\n');
  const start=lines.indexOf('User-agent: '+name);
  if(start<0)return '';
  const next=lines.findIndex((line,index)=>index>start&&(line.startsWith('User-agent:')||line.startsWith('Sitemap:')));
  return lines.slice(start+1,next>=0?next:undefined).join('\n');
}

test('training bot skips SVG artwork while article text remains crawlable',()=>{
  const g=group('GPTBot');
  assert.ok(g.includes('Allow: /'));
  assert.ok(g.includes('Disallow: /assets/coupon-svg/'));
  assert.ok(!g.includes('Disallow: /articles/'));
  assert.ok(!g.includes('Disallow: /coupon/'));
  for(const blocked of ['admin','api'])assert.ok(g.includes('Disallow: /'+blocked));
});

test('OAI-SearchBot still crawls public pages and static image rules are bot-specific',()=>{
  const search=group('OAI-SearchBot');
  assert.ok(search.includes('Allow: /'));
  assert.ok(!search.includes('coupon-svg'));
  assert.ok(!group('*').includes('coupon-svg'));
  assert.ok(robotsText.includes('Sitemap: https://noondealsnow.com/sitemap.xml'));
});
