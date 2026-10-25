// Diversify the existing approved 33m-topic space only after a low-yield streak
// or when explicitly requested by the preexisting burst optimizer. No quality gate is changed.
// This chooses candidate topics, NOT their publication or quality status.
// All checks (brand/country/coupon, semantic duplication, quality >=95,
// min words >=1500 and single global 60s publication permit) stay unchanged.
export function chooseBulkCandidateTopicSeed(cursor,tryIndex,{lowYield=false,burstMode=false,forceCountry='',previousYieldPct=100,topicSpace}={}){
  const n=Number(cursor),attempt=Number(tryIndex),space=Number(topicSpace);
  if(!Number.isSafeInteger(n)||n<0)throw Error('invalid_bulk_topic_cursor');
  if(!Number.isSafeInteger(attempt)||attempt<1)throw Error('invalid_bulk_candidate_attempt');
  if(!Number.isSafeInteger(space)||space<1||space>4294967295)throw Error('invalid_bulk_topic_space');
  const burstLowYield=burstMode&&(String(forceCountry).toUpperCase()==='SA'||Number(previousYieldPct)<2);
  // When steady publication has yielded ZERO candidates, repeatedly scanning
  // adjacent topic slots perpetuates near-duplicate slugs and semantic intent.
  // Explore ALL candidates in an independent, deterministic topic-space region
  // until a quality-checked article finally passes. Every existing duplicate,
  // originality, coupon, word-depth and SEO gate still runs unchanged.
  // For a proven zero-yield burst, diversify every attempt instead of only\n  // one in three. Healthy Saudi burst keeps its one-in-three behavior;\n  // healthy UAE/regular publishing stays sequential. All publication gates remain intact.\n  // For ordinary (healthy) publishing preserve stable sequential order.
  const shouldDiversify=Boolean(lowYield)||(burstLowYield&&(Number(previousYieldPct)<2||attempt%3===0));
  return shouldDiversify ? (Math.imul((n+1)>>>0,2654435761)>>>0)%space : n;
}

/**
 * The old-account Worker serves article writes through cross-account R2 signed
 * fetches while the new account migration remains fenced. Cloudflare Free
 * Workers allow only 50 external subrequests per invocation; a 48/384-candidate
 * zero-yield search repeats too many remote GETs and fails the ENTIRE minute.
 * Bound the candidate loop to 6 attempts under remote-R2 (previously 12),\n * reserving more of the shared cron invocation's 50 external-request\n * budget for the due publisher, migration backup and English fallback.\n * The old 12-attempt loop occasionally hit the global subrequest ceiling.\n * Reserve the remaining request
 * budget for the DO publication permit, catalogs, feed updates and legacy due
 * publisher. Every original quality, duplicate and coupon gate still runs.
 * Across cron minutes the persistent cursor advances; topics are not discarded.
 */
export function boundedBulkCandidateTries(env,original){
  const n=Number(original);
  if(!Number.isSafeInteger(n)||n<1)throw Error('invalid_bulk_candidate_limit');
  const remote=String(env?.REMOTE_EXISTING_R2_ENABLED||'').toLowerCase()==='true';
  return remote?Math.min(n,6):n;
}
