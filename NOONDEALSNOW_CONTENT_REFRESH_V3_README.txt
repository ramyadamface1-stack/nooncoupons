NoonDealsNow | Legacy sales, SEO, archive, and verified freshness V3
Date: 2026-11-19

Upload the following paths to the same repository in ONE pull request:
  discovery-entry.js                           -> root (replace)
  r2-emergency-readonly.js                     -> root (replace)
  complete-blog-listing.js                     -> root (replace)
  tests/native-article-rescue-fast.test.mjs    -> tests/ (replace)
  tests/legacy-archive-seo-dates.test.mjs      -> tests/ (add)
  tests/legacy-content-refresh.test.mjs        -> tests/ (add)
  scripts/gsc-decay-refresh-plan.mjs           -> scripts/ (add)
  NOONDEALSNOW_CONTENT_REFRESH_V3_README.txt  -> documentation only

Verified freshness implementation:
- Real publication timestamps remain historically accurate and visible.
- Articles with a verified, subsequent `editorialUpdatedAt` or
  `substantiveUpdatedAt` R2 custom metadata value display "Last substantially
  updated / آخر تحديث تحريري" beside their original publication date.
- The same verified date is exposed as Article.dateModified, modified Open
  Graph time, and on the /blog listing from R2 custom metadata.
- Merely moving to a new R2 bucket, changing a month label, or modifying a
  file timestamp NEVER fabricates an editorial date. Future updates are hidden.
- To mark a specific old article as truly refreshed, substantively revise its
  factual/commercial advice AND store the actual edit timestamp in the R2
  object's `editorialUpdatedAt` custom metadata. Preserve all original fields.
- The ZIP does NOT rewrite tens of thousands of R2 objects, bulk-move
  publication dates or identify which pages lost traffic without GSC data.

Content decay targeting:
- Export Google Search Console -> Search results -> Pages as CSV for TWO equal
  time windows (prior baseline and recent). Prefer periods that ended at
  least 3 days ago to avoid reporting lag.
- Run the report locally (does not write to the website or R2):
  node scripts/gsc-decay-refresh-plan.mjs --before=before.csv --after=after.csv --out=priority.json
- Use priority.json to select the articles with the most lost organic clicks,
  verify missing queries and improve each article substantially before setting
  the verified update date. Do not delete, redirect or change its slug.

Previous V2 fixes retained:
- Unwrap legacy HTML page shells to avoid duplicate title, canonical and head.
- Correct known old self-domain navigation and broken archive links.
- Read-only native R2 public fast path avoids slow nested decorators.
- Keep market-specific coupon actions, images and original article bodies.
- Generation/scheduling remains in Cloudflare, NOT GitHub Actions.

Validation on 2026-11-19:
- 71/71 targeted tests passed.
- `npx wrangler deploy --dry-run --config wrangler.new-account-production.jsonc` passed.
- No deployment or production R2 write was performed.

After merging, verify the GitHub deploy workflow, then inspect a live old
article's canonical, title, image, coupon copy, click-through, publication and
real editorial dates. Use GSC to measure actual change over subsequent weeks.
