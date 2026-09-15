# Nooncoupons Quality-First Runtime

This file records the publishing rules that must remain true unless explicitly changed by the owner.

## Active runtime

- Main entry: `auto-platform.js`
- Generator: `generator-5.0-quality-first`
- Platform: `platform-1.6-quality-first`
- Primary AI: Cloudflare Workers AI only
- Primary model: `@cf/zai-org/glm-4.7-flash`
- Cloudflare-hosted technical fallback: `@cf/google/gemma-4-26b-a4b-it`
- External AI providers: disabled
- New bulk engine: `programmatic-cloudflare:v2-helpful`
- Legacy requalification engine: `programmatic-cloudflare:v2-legacy-upgrade`

## Publish gate

A new or rebuilt article must not be published unless all of the following are true:

- Overall quality score is 95–100.
- No P0 critical issue exists.
- Core quality group floor is at least 88.
- Article length is 1000–2000 words.
- Brand, country and coupon locks pass.
- Unsupported discount/value claims are absent.
- Semantic uniqueness passes; do not weaken this just to increase volume.
- Useful decision support, visible FAQ, official Noon source and verification methodology are present.
- Article/Breadcrumb/FAQ structured data is present where eligible.
- Country and currency localization is correct.
- Image/ALT/CTA/accessibility checks pass.

The 2000 articles/day setting is a maximum, never a forced quota. Fewer articles must be published when there are not enough useful and unique candidates.

## Legacy content policy

- Preserve existing URLs/slugs while rebuilding old articles.
- Do not rewrite the 11 existing Workers AI articles through the legacy upgrader.
- Rebuild legacy pages only after the replacement passes the same quality gate.
- A failed replacement must leave the current live page untouched.
- Legacy upgrading uses a cursor and at most three semantic-differentiation passes.
- Pages still failing semantic uniqueness after pass 3 must be marked for consolidation/canonical review rather than forced through the gate.
- Once final-pass consolidation candidates exist, automatic rescanning stops to avoid wasting CPU/R2 operations.

## Verification

Required CI workflows:

- `Verify Live Worker`
- `Bulk Quality Selftest`
- `Verify Legacy Upgrade V2`

They must continue checking Cloudflare-only provider isolation, live article rendering, R2/blog/sitemap health, quality floors, legacy progress and preservation of Workers AI content.
