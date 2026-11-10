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
  now = () => new Date().toISOString(),
  pause = ms => new Promise(resolve => setTimeout(resolve, ms))
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
  // Recheck an intermittent read-only Cloudflare 5xx at most twice. The
  // publication POST is NEVER repeated, and a 404/200/429/403 ends the probe.
  // This bounded read happens within the ONE authorized reconciliation attempt.
  for (let attempt = 0; attempt < 3; attempt++) {
    let transientReadFailure = false;
    try {
      const response = await fetchFn(url, {
        method: 'GET', headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(18000)
      });
      if (response.status === 200) {
        live = (await response.text()).includes(topic.coupon);
      } else {
        transientReadFailure = response.status >= 500 && response.status < 600;
      }
    } catch {
      // A network/response-read failure proves neither presence nor absence.
      transientReadFailure = true;
    }
    if (live || !transientReadFailure || attempt === 2) break;
    await pause(500 * (attempt + 1));
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
