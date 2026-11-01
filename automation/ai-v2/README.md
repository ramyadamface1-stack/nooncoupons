# NoonDealsNow AI V2 — guarded rollout

Production: https://noondealsnow.com
Repository: ramyadamface1-stack/nooncoupons (main)
Current status: DISABLED, CHECKPOINT-ONLY. One-minute cadence prepared, not active publication. Legacy publication and Cloudflare Cron are untouched.

## Verified 2026-11-01
GitHub Actions #5: 11 safety tests passed, 0 failed.
GEMINI_API_KEY: PRESENT
GROQ_API_KEY: PRESENT
NOONDEALSNOW_AI_R2_CHECKPOINT_TOKEN: PRESENT and isolated R2 canary read-back verified in GitHub Actions run 41343492318.
NOONDEALSNOW_AI_FREE_ONLY_APPROVED: PRESENT in same run.

## Security and recovery
Repository is public, so do not store unpublished drafts in a public Git branch.
Use private R2 bucket nooncoupons-content-v2 under prefix _ops/ai-v2-checkpoints/.
Each checkpoint is written and read back before proceeding.
After REQUEST_SENT, an unknown provider result becomes UNKNOWN_REQUEST_OUTCOME and is never blindly regenerated.
REQUEST_PENDING (not yet sent) and RESPONSE_RECEIVED (saved response) are safely resumable.
No automatic provider switching after quotas or organization restrictions.

## Before using paid-capable APIs
(1) GitHub Actions > NoonDealsNow AI V2 - Safe Checkpoints and Preflight > Run workflow > preflight_only=true. This does not use Gemini/Groq.
(2) Add a GitHub secret named NOONDEALSNOW_AI_R2_CHECKPOINT_TOKEN with scoped read/write permission to the existing private R2 bucket.
(3) Review actual Gemini/Groq pricing and quotas. Only after confirming approved free-only usage, add secret NOONDEALSNOW_AI_FREE_ONLY_APPROVED with value true.
(4) Enable automation/ai-v2/config.json only after verifying the private R2 checkpoint and confirming the budget. Test a single controlled draft with preflight_only=false.
(5) Native site publication is not yet connected to its full quality/image/semantic checks, global DO publication permit, RSS, sitemap and live URL verification. The new pipeline cannot claim PUBLISHED or LIVE_VERIFIED until this bridge has proof.
(6) The standalone Cloudflare scheduler source is in ai-scheduler-v2/. Do not deploy or enable it until the budget and token permissions are verified. The current site publisher Cron stays active.

## Policy
Single authoritative interval; configured for 1 minute, theoretical 60/hour, 1440/day. Actual output may be lower; scheduler remains disabled until native publishing bridge is verified.
Accepted intervals: 1/5/10/15/30/60 minutes. Update both hourly and daily targets together in central config.
Saudi market uses approved NOV170; UAE uses NOV188; original site allowlist remains authoritative.
No deletion, no destructive slug changes, no new paid services, no secret values or drafts in logs.
Never mistake a workflow success, saved draft or commit for a live indexed article.

## Scheduler bootstrap (2026-11-01)

GitHub Actions run 41344178398 validated the fine-grained dispatch token READ, deployed the isolated noondealsnow-ai-scheduler-v2 Worker to the destination Cloudflare account, stored GITHUB_DISPATCH_TOKEN as an encrypted Worker secret, and verified a * * * * * cron trigger. The Worker is intentionally inert while enabled=false. No live Cron event, GitHub dispatch, AI-generated live article or native publication bridge has been verified. The deploy workflow's one-time push bootstrap is guarded by a special commit message marker; ordinary pushes cannot deploy this scheduler.
