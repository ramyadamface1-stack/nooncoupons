NoonDealsNow | Legacy archive SEO and Cloudflare 1102 repair
Date: 2026-11-19

Upload these files to the existing repository:
  discovery-entry.js                          -> repository root (replace)
  r2-emergency-readonly.js                    -> repository root (replace)
  tests/native-article-rescue-fast.test.mjs   -> tests/ (replace)
  tests/legacy-archive-seo-dates.test.mjs     -> tests/ (add)

Safety:
- Do NOT change coupon codes, slugs, published dates, article R2 bodies or schedules.
- Prefer a new branch and pull request. Merge only after GitHub tests pass.
- This deploys a faster read-only route for legacy published pages and /blog.
- dateModified is present ONLY if explicit verified editorial change metadata exists.
- Future dated publications stay hidden until their scheduled date.
- No AI generation is routed through GitHub.

Local verification:
  node --test tests/legacy-archive-seo-dates.test.mjs tests/native-article-rescue-fast.test.mjs tests/complete-blog-listing.test.mjs tests/r2-rescue-navigation.test.mjs tests/r2-public-head-storm.test.mjs tests/legacy-article-cpu-canary.test.mjs tests/article-date-consistency.test.mjs tests/article-temporal-freshness.test.mjs
  npx wrangler deploy --dry-run --config wrangler.new-account-production.jsonc

Before deployment, 2026-11-19 UTC:
- Live / and /blog and tested legacy articles returned HTTP 503, Cloudflare 1102.
- /api/revision, /robots.txt and /blog/archive/all returned 200.
- Production 1102 is NOT confirmed fixed until fresh live tests after deploy.
- Large-scale old article editorial rewrites were NOT performed in this bundle.
- Search rankings need verified Google Search Console access to assess.
