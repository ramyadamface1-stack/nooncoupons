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
