import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decideTick,effectiveRuntimeConfig,managedRuntimeConfig} from '../ai-scheduler-v2/worker.mjs';
import {AI_V2_INTERVALS,AI_V2_PUBLISH_INTERVALS} from '../admin-runtime.js';
const repoText=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const cfg=JSON.parse(repoText('automation/ai-v2/config.json'));

test('60 verified publications/hour is the configured one-minute GOAL, not a fabricated success metric',()=>{
 assert.equal(cfg.targetPerHour,60);
 assert.equal(cfg.targetPerDay,1440);
 assert.equal(cfg.intervalMinutes,1);
 assert.equal(cfg.cronHeartbeat,'* * * * *');
 assert.equal(cfg.limits.freeOnly,true);
 assert.ok(cfg.limits.qualityFloor>=95);
 assert.equal(cfg.siteMarkets.SA.coupon,'NOV170');
 assert.equal(cfg.siteMarkets.AE.coupon,'NOV188');
 const admin=repoText('system1-admin-data.js');
 assert.match(admin,/todayPublished=cairoToday\?cairoToday.total:null/);
 assert.match(admin,/const todayRemaining=todayPublished===null\?null:Math.max\(0,dayTarget-todayPublished\)/);
 assert.match(admin,/verifiedFresh=verified.ledgerAvailable===true/);
 assert.match(admin,/BEHIND_TARGET/);
});

test('operator can set ANY exact 1-15 minute generation and publication interval from the panel',async()=>{
 const available=Array.from({length:15},(_,i)=>i+1);
 for(const interval of available){
  assert.ok(AI_V2_INTERVALS.includes(interval));
  assert.ok(AI_V2_PUBLISH_INTERVALS.includes(interval));
  const minute=Math.ceil(Date.parse('2026-11-10T00:00:00.000Z')/60000/interval)*interval;
  const due=minute*60000;
  assert.equal(decideTick({...cfg,enabled:true,intervalMinutes:interval},due,due).due,true);
 }
 const html=repoText('system1-control-center.js');
 for(const interval of available){
  assert.ok(html.includes('<option value="'+interval+'">'+interval+' '),
   'Missing manual interval choice '+interval);
 }
 assert.match(html,/id="genInterval"/);
 assert.match(html,/id="publishInterval"/);
 assert.match(html,/publishingIntervalMinutes:minutes/);
 const policy=await managedRuntimeConfig(cfg,{AI_V2_RUNTIME_ENABLED:'true'},
  async()=>Response.json({ok:true,enabled:true,intervalMinutes:7}));
 assert.equal(policy.controlStatus,'POLICY_VERIFIED');
 assert.equal(policy.intervalMinutes,7);
});

test('two separate market generators have a 30-second UAE offset and a still-atomic global publication permit',()=>{
 const flow=repoText('.github/workflows/noondealsnow-ai-v2.yml');
 assert.match(flow,/max-parallel:\s*2/);
 assert.match(flow,/market: \[SA, AE\]/);
 assert.match(flow,/group: noondealsnow-ai-v2-publisher-\$\{\{ matrix.market \}\}/);
 assert.match(flow,/cancel-in-progress: false/);
 assert.match(flow,/if: \$\{\{ matrix.market == 'AE' && inputs.preflight_only == false \}\}/);
 assert.match(flow,/run: sleep 30/);
 const publisher=repoText('ai-v2-native-publish-bridge.js');
 assert.match(publisher,/const earlySlot=await getPublicationSlotStatus\(env,\{aiV2:true\}\)/);
 assert.match(publisher,/const permit=await claimPublicationSlot\(env,topic.country,'ai-v2-native'\)/);
 assert.match(publisher,/if\(!permit.ok\)return reject\('GLOBAL_PUBLICATION_SLOT_NOT_GRANTED'\)/);
 assert.match(publisher,/onlyIf:\{etagDoesNotMatch:'\*'\}/);
 const scheduler=repoText('ai-scheduler-v2/worker.mjs');
 assert.match(scheduler,/PUBLISHER_BUSY_SKIP_DISPATCH/);
 assert.match(scheduler,/globalPublicationSpacingSeconds:30/);
});

test('panel metrics refresh every minute and verified R2 ledger counter snapshots refresh every five',()=>{
 const panel=repoText('system1-control-center.js');
 const summary=repoText('.github/workflows/noondealsnow-ai-v2-verified-summary.yml');
 assert.match(panel,/window\.setInterval\(\(\)=>\{if\(!document.hidden\)load\(\)\},60000\)/);
 assert.match(summary,/cron: '\*\/5 \* \* \* \*'/);
 assert.match(summary,/source':'real-R2-verified-ledger'/);
 assert.match(summary,/providerCalls':0,'articleWrites':0/);
 assert.match(panel,/id="dailyGoalPublished"/);
 assert.match(panel,/id="dailyGoalRemaining"/);
 assert.match(panel,/id="dailyGoalHour"/);
});

test('scheduler auto deployment is guarded by explicit audited release marker, destination account and live policy',()=>{
 const workflow=repoText('.github/workflows/deploy-noondealsnow-ai-scheduler-v2.yml');
 assert.match(workflow,/\[ndn-scheduler-live-update\]/);
 assert.match(workflow,/NOON_NEW_CF_API_TOKEN/);
 assert.match(workflow,/e4c35f8a50a7b2e4cfb9d6c534962603/);
 assert.match(workflow,/GITHUB_DISPATCH_READ=PREFLIGHT_PASS/);
 assert.match(workflow,/CLOUDFLARE_CRON_CONFIGURED=TRUE/);
 assert.match(workflow,/LIVE_AI_V2_SCHEDULER_ADMIN_CONTROL=PASS/);
});
