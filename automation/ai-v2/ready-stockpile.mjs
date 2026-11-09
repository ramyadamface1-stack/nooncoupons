// SYSTEM1 Phase 1: dormant READY storage contract, deliberately not a publisher.
// Publishing MUST still re-run authoritative native quality, coupon, duplicate,
// and global publication-slot checks. These declarations alone are never proof of QA.
export const READY_PREFIX = '_ops/system1/ready-v1/';
export const READY_INTERVALS = Object.freeze([1, 5, 10, 15, 30, 60]);
const RULES = Object.freeze({
  SA: Object.freeze({coupon: 'NOV170', language: 'ar-SA'}),
  AE: Object.freeze({coupon: 'NOV188', language: 'en-AE'})
});
const ID = /^[a-f0-9]{24}$/;
const HASH = /^[a-f0-9]{64}$/;
const SLUG = /^[a-z0-9-]{16,120}$/;
const ASSET = /^_ops\/system1\/visuals\/[a-zA-Z0-9_/-]+\.svg$/;
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const deny = reason => ({ok: false, reason});
export function readyObjectKey(id) {
  if (!ID.test(String(id))) throw Error('INVALID_READY_ARTICLE_ID');
  return READY_PREFIX + id + '.json';
}
export function validateReadyRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return deny('INVALID_RECORD');
  const rule = RULES[input.country];
  if (!rule || input.coupon !== rule.coupon || input.language !== rule.language) return deny('MARKET_ISOLATION_FAILED');
  if (!ID.test(String(input.articleId)) || typeof input.slug !== 'string' || !SLUG.test(input.slug) || input.slug.includes('--')) return deny('INVALID_ID_OR_SLUG');
  if (!HASH.test(String(input.contentHash))) return deny('MISSING_CONTENT_HASH');
  if (input.state !== 'READY' || !iso(input.createdAt) || !iso(input.scheduledAt)) return deny('INVALID_READY_SCHEDULE');
  if (!Number.isInteger(input.quality) || input.quality < 95 || input.quality > 100 ||
      !Number.isInteger(input.wordCount) || input.wordCount < 1500) return deny('PREAUDIT_INSUFFICIENT');
  if (typeof input.html !== 'string' || input.html.length < 4000 || input.html.length > 240000) return deny('INVALID_HTML_SIZE');
  if (!Array.isArray(input.visuals) || input.visuals.length !== 5) return deny('FIVE_VISUALS_REQUIRED');
  const keys = new Set(), hashes = new Set();
  for (const visual of input.visuals) {
    if (!visual || typeof visual !== 'object' || typeof visual.key !== 'string' || !ASSET.test(visual.key) ||
        visual.width !== 1600 || visual.height !== 1000 || visual.textLanguage !== 'en' ||
        !HASH.test(String(visual.sha256)) || keys.has(visual.key) || hashes.has(visual.sha256)) return deny('VISUAL_PROOF_INVALID');
    keys.add(visual.key); hashes.add(visual.sha256);
  }
  // Stage preserves declared pre-audit only. The future publisher must verify
  // stored SVG bytes and perform original native audits before going live.
  return {ok: true};
}
export function nextReadySchedule(anchorTime, position, intervalMinutes) {
  if (!iso(anchorTime) || !Number.isSafeInteger(position) || position < 0 || position > 1000000 ||
      !READY_INTERVALS.includes(intervalMinutes)) throw Error('INVALID_READY_SCHEDULING_INPUT');
  const gap = intervalMinutes * 60000;
  const first = Math.ceil(Date.parse(anchorTime) / gap) * gap;
  return new Date(first + position * gap).toISOString();
}
export function isReadyDue(record, currentTime) {
  return validateReadyRecord(record).ok && iso(currentTime) && Date.parse(record.scheduledAt) <= Date.parse(currentTime);
}
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function stageReadyArticle(env, record) {
  const checked = validateReadyRecord(record);
  if (!checked.ok) return checked;
  if (!env?.CONTENT_FINAL?.put || !env?.CONTENT_FINAL?.get || !env?.CONTENT_FINAL?.head) return deny('R2_BINDING_UNAVAILABLE');
  if (await digest(record.html) !== record.contentHash) return deny('CONTENT_HASH_MISMATCH');
  const r2 = env.CONTENT_FINAL;
  // Never restage an already published slug or overwrite a READY record.
  let published;
  try { published = await r2.head('articles/' + record.slug + '.html'); }
  catch { return deny('PUBLICATION_LOOKUP_UNAVAILABLE'); }
  if (published) return deny('ALREADY_PUBLISHED');
  const key = readyObjectKey(record.articleId);
  const body = JSON.stringify({version: 1, ...record});
  try {
    const written = await r2.put(key, body, {onlyIf: {etagDoesNotMatch: '*'},
      httpMetadata: {contentType: 'application/json; charset=utf-8'}});
    if (!written) return deny('READY_ALREADY_STAGED');
  } catch { return deny('READY_WRITE_OUTCOME_UNKNOWN'); }
  try {
    const readback = await r2.get(key);
    if (!readback || await readback.text() !== body) return deny('READY_READBACK_UNVERIFIED');
  } catch { return deny('READY_READBACK_UNVERIFIED'); }
  return {ok: true, state: 'READY', key, scheduledAt: record.scheduledAt,
    note: 'STAGED_ONLY_NOT_PUBLISHED'};
}
