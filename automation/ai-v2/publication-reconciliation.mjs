// Read-only repair for ambiguous publication outcomes. Never re-POST the
// native publish request and never call an AI provider from this path.
export const AMBIGUOUS_PUBLICATION_STATES = Object.freeze([
  'PUBLISH_REQUEST_SENT', 'UNKNOWN_PUBLICATION_OUTCOME', 'DEPLOYING'
]);
export const MAX_READ_ONLY_RECONCILIATIONS_PER_RUN = 2;

export function ambiguousPublicationState(checkpoint) {
  return AMBIGUOUS_PUBLICATION_STATES.includes(checkpoint?.state);
}

export async function reconcileAmbiguousPublication({
  domain, topic, checkpoint, fetchFn = fetch, persist,
  now = () => new Date().toISOString()
}) {
  if (!ambiguousPublicationState(checkpoint) ||
      !topic || typeof topic.slug !== 'string' ||
      !/^[a-z0-9-]{16,120}$/.test(topic.slug) ||
      typeof topic.coupon !== 'string' || !topic.coupon ||
      typeof persist !== 'function') {
    throw Error('INVALID_READ_ONLY_PUBLICATION_RECONCILIATION');
  }
  const url = domain + '/articles/' + encodeURIComponent(topic.slug);
  let live = false;
  try {
    const response = await fetchFn(url, {
      method: 'GET', headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(18000)
    });
    live = response.status === 200 && (await response.text()).includes(topic.coupon);
  } catch {
    // A failed read is not permission to repeat a possibly committed POST.
  }
  if (live) {
    await persist('LIVE_VERIFIED', { liveVerifiedAt: now(), liveUrl: url });
    return { status: 'LIVE_VERIFIED', reason: 'RESUMED_AFTER_AMBIGUOUS_PUBLISH',
      url, livePublished: true };
  }
  const formerState = checkpoint.state;
  const patch = formerState === 'UNKNOWN_PUBLICATION_OUTCOME'
    ? { publicationReconciliationAttemptedAt: now(), lastPublicVerificationAt: now(),
        reviewRequired: true, candidateLiveUrl: url }
    : { errorCategory: 'PUBLISH_PUBLIC_URL_NOT_VERIFIED', reviewRequired: true,
        lastPublicVerificationAt: now(), candidateLiveUrl: url };
  await persist('UNKNOWN_PUBLICATION_OUTCOME', patch);
  return { status: 'BLOCKED', reason: 'PUBLISH_OUTCOME_QUARANTINED_FOR_REVIEW',
    url, formerState, livePublished: false };
}
