import assert from 'node:assert/strict';
import {getCampaignWindow,campaignGenerationPlan,applyCampaignPlan,CAMPAIGN_CALENDAR_INFO} from './campaign-calendar.js';

const oct2=getCampaignWindow('2026-10-02');
assert(oct2.some(x=>x.id==='grocery-saver-week-noon'&&x.phase==='active'));
assert(oct2.some(x=>x.id==='grand-lifestyle-reset'&&x.phase==='preheat'));
assert(oct2.some(x=>x.id==='ten-ten-sale'&&x.phase==='preheat'));
assert(!oct2.some(x=>x.id==='mega-tech-festival'));

const ae=getCampaignWindow('2026-10-09','AE');
assert(!ae.some(x=>x.id==='ten-ten-sale'));
assert(ae.some(x=>x.id==='back-to-outdoors'));

const tenTenEvent=oct2.find(x=>x.id==='ten-ten-sale');
const tenTen=campaignGenerationPlan(0,[tenTenEvent]);
assert.equal(tenTen.forceCountry,'SA');
assert(tenTen.forceProfiles.includes('mobile'));
assert(tenTen.forceProfiles.includes('grocery'));

for(let i=0;i<120;i++){
  const plan=campaignGenerationPlan(i,ae,'AE');
  if(plan.active)assert.equal(plan.forceCountry,'AE');
}

const decorated=applyCampaignPlan({country:'SA',profileKey:'mobile'},tenTen);
assert.equal(decorated.campaignId,'ten-ten-sale');
assert.equal(decorated.campaignTentative,true);
assert.equal(decorated.campaignCalendarVersion,CAMPAIGN_CALENDAR_INFO.version);
assert.equal(getCampaignWindow('2026-11-10').length,0);
console.log('campaign-calendar-selftest: ok');
