// Exact production checkpoint IO smoke test; never invokes an AI provider.
import {readFileSync} from 'node:fs';
import {saveCheckpoint} from './r2-checkpoints.mjs';
const cfg=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const account='e4c35f8a50a7b2e4cfb9d6c534962603';
if(process.env.CLOUDFLARE_ACCOUNT_ID!==account)throw Error('WRONG_CLOUDFLARE_ACCOUNT');
if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('R2_CHECKPOINT_SECRET_MISSING');
if(cfg.checkpoint?.bucket!=='nooncoupons-content-v2')throw Error('WRONG_R2_BUCKET');
if(cfg.enabled!==false||cfg.publicationMode!=='checkpoint_only')throw Error('AI_V2_NOT_SAFE_TO_SMOKE_TEST');
const id='f'.repeat(24); // reserved connectivity key, never an article
const stored=saveCheckpoint(cfg,{articleId:id,siteId:'noondealsnow',state:'CONNECTION_TEST',version:1,probe:'readback-only-check',executedAt:new Date().toISOString()});
if(stored.articleId!==id||stored.state!=='CONNECTION_TEST'||stored.siteId!=='noondealsnow')throw Error('R2_CHECKPOINT_READBACK_INVALID');
console.log('AI_V2_R2_CHECKPOINT=VERIFIED account=destination bucket=nooncoupons-content-v2 readback=ok provider_calls=0 articles_published=0');
