# NoonDealsNow — Migration pre-cutover gates (20 October 2026)

This is a **non-executable** operator checklist. It must **not** be mistaken for a cutover authorization.

## Current confirmed state

- GitHub main: `4e0a749e4978e6bcef64286af3ba0990dc92eaff`. Continue from actual latest HEAD, not a memorized SHA, when applying work.
- Public site works on the **old** Cloudflare zone through emergency public read-only article/image/SEO fallback to the **existing new** R2; original URLs remain intact.
- Old-account R2 is **NotEntitled (10042)**. Source delta listing/copy and DO backup exports are blocked. There is **no verified complete final delta**.
- The new account's existing staging Worker `noondealsnow-migration-staging` has **no public routes, workers.dev disabled, publishing off**, cron once per minute, R2 and both DO namespaces bound. Re-deployed without script name or DO namespace changes on 20 October.
- New `GeneratorControl` DO restore baseline: **4/4 keys, complete**.
- New `ControlPlane` DO baseline at last verified checkpoint: **2,700/2,759 parts; 345,600/353,109 keys (97.9%)**; 7,509 remaining, 59 parts.
- Cloudflare Observability showed **`Exceeded allowed rows written in Durable Objects free tier`** for both cron restore requests; new account exceeded daily free limit. The existing Cron should retry on reset, but this requires live verification.
- Original final source snapshot part 2,701 and final part 2,759 were readable and structurally valid on new R2; no corrupt sampled parts.
- Last strict DNS read-only parity check passed: **10/10 matching old/new DNS records** including MX priorities, TXT values and proxy state; Full SSL and Universal SSL enabled both; DNSSEC disabled; zones still old active / new pending; **nameservers deliberately unchanged**.
- Old source publishing blocked by R2 entitlement; last known successful publication **2026-10-19T13:40:23Z**; do not claim publishing works.

## Mandatory gates, in strict order

1. **DO full restore**: Read existing new R2 checkpoint `migration/restore-progress/20261017-baseline/ControlPlane.json`. Require `complete=true`, `partsDone=2759`, `partsTotal=2759`, `keysRestored=353109`, `keysTotal=353109`. GeneratorControl also complete 4/4.
2. **Do not silently equate baseline with final DO state**: Baseline dated October 17; source continued publishing through October 19. Compare origin DO state since baseline and plan safe, deterministic final delta after source writer quiescence. Do not blindly replay stale source keys over destination changes.
3. **Article corpus and mutable R2 parity**: Reconcile old/new `articles/`, `bulk/`, `quality/`, `maintenance/`, `english-canary/`, `_ops/`, `freshness/`, and other active metadata prefixes by key and checksum when old R2 access is restored. **Do not erase destination newer state**. A completed INITIAL backup does not mean the final delta was copied.
4. **No duplicate publisher**: Exact `GLOBAL_PUBLISH_MIN_INTERVAL_SECONDS=60`, `GLOBAL_PUBLISH_MAX_PER_MINUTE=1`, and one unique `ControlPlane` locking namespace. Old production publishing must be verifiably off before new one is enabled. Existing staging is restore-only; never promote a new Worker script name with empty DO storage accidentally.
5. **New Worker runtime**: Reuse the same restore namespace via the same script identity or verified external DO `script_name` binding; verify migration state and no accidental empty namespace; verify new public script/route binding before DNS delegation. No new buckets, Workers AI paid plans or infrastructure without explicit approval.
6. **DNS and HTTPS**: Confirm old/new record parity again, all MX and TXT, Cloudflare pending-zone certificate eligibility/issuance, apex and www behavior, canonical redirects, Cloudflare custom-domain routing. The strict DNS parity check passed on October 20 but does **not** mean TLS already issued or Worker domain has been attached.
7. **Live QA**: Article pages in Arabic and English, full archives, country blogs, 190,351 quality-checked sitemap URLs in segment sets, image XML, home and brand pages, GA4, robots/llms, JSON-LD and Google/Bing visibility must be rechecked. Search Console actual indexing is an independent metric, not confirmed by HTTP 200.
8. **Cost gate**: R2 metered Class A/B on new account; keep public edge cache before R2 fetch and monitor billing. Do not increase free-plan quotas via payment without user request.
9. **Rollback**: Keep old zone and code unchanged until new site/certificate and one publisher are confirmed. Do not delete a single article, change URL slug, or erase backups. Keep provenance, count and checksum audit logs.

## Time gate

Free-tier Durable Object daily row-write quota normally resets **00:00 UTC = 03:00 Cairo**, next **21 October 2026**. This is only a quota reset, **not** automatic approval to change nameservers. Read the exact R2 checkpoint and Cron observability after reset.

## Evidence

- Baseline restore/quota: GitHub Actions `39366125825`, `39366448591`.
- DNS exact match: `39366901883`.
- Source migration blocked NotEntitled: `39352616303`, `39371460196`.
- Source initial full copy now indicates only `COPY_INITIAL_BASELINE_COMPLETE_ALREADY=true; final_delta_still_required`: `39372714652`.
- Old R2 Class-B hourly HEAD quiet: `39371591340`.
- SEO/public safe recovery work: prior PRs #22–#32 and tracking PR #19.

**Preserve old live nameservers and publishing isolation at all times.**
