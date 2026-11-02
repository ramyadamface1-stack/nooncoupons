import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('automatic workflow passes R2, free-only approval and native publish auth into dispatch generation job',()=>{
 const y=readFileSync('.github/workflows/noondealsnow-ai-v2.yml','utf8');
 const job=y.split('  preflight-or-generate:')[1];
 assert.ok(job,'automatic job must exist');
 for(const name of ['NOONDEALSNOW_AI_R2_CHECKPOINT_TOKEN','NOONDEALSNOW_AI_FREE_ONLY_APPROVED','CLOUDFLARE_NOONCOUPONS_DEPLOY_TOKEN1','GROQ_API_KEY'])assert.ok(job.includes('secrets.'+name),'missing job-level secret '+name);
 assert.match(job,/NOONDEALSNOW_AI_SITE_PUBLISH_TOKEN:\s*\$\{\{ secrets\.CLOUDFLARE_NOONCOUPONS_DEPLOY_TOKEN1 \}\}/);
 assert.match(y,/if: github\.event_name == 'workflow_dispatch'/);
 assert.match(job,/AI_PREFLIGHT_ONLY:/);
});

test('one-minute dispatch skips redundant full CI and private R2 canary while keeping fast runtime safety checks',()=>{
 const y=readFileSync('.github/workflows/noondealsnow-ai-v2.yml','utf8');
 const safety=y.split('  safety-tests:')[1].split('  preflight-or-generate:')[0];
 const live=y.split('  preflight-or-generate:')[1];
 assert.match(safety,/if: github.event_name == 'push'/);
 assert.doesNotMatch(live,/needs:\s*safety-tests/);
 assert.match(live,/if: github.event_name == 'workflow_dispatch'/);
 assert.match(live,/node --check automation\/ai-v2\/run\.mjs/);
 assert.match(live,/node --check automation\/ai-v2\/r2-checkpoints\.mjs/);
});
