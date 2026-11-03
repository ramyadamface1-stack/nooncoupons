import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SITEMAP_HEALTH_PROBE_GROUPS} from '../discovery-entry.js';
test('sitemap health probes are bounded and cover every required sitemap exactly once',()=>{
 const groups=SITEMAP_HEALTH_PROBE_GROUPS;
 assert.equal(groups.length,5);
 assert.ok(groups.every(g=>g.length<=3));
 const all=groups.flat();assert.equal(all.length,15);
 assert.equal(new Set(all).size,all.length);
 for(const path of ['/sitemap.xml','/sitemap-core.xml','/sitemap-ai-v2.xml'])assert.ok(groups[0].includes(path));
 assert.ok(groups.every(g=>g.every(p=>p.startsWith('/sitemap-')||p==='/sitemap.xml')));
});
