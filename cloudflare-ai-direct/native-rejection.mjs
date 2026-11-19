// The native endpoint returns these rejection codes before it writes an
// article. Classify only exact, documented response/status pairs. Any
// unrecognized response remains uncertain and must never be re-posted.
const PERMANENT_PREWRITE=new Set([
 'INCOMPLETE_OR_WRONG_MARKET','INVALID_MARKET_COUPON','INVALID_LANGUAGE',
 'CHECKPOINT_NOT_APPROVED','INVALID_PROVIDER_ATTRIBUTION','INVALID_SLUG',
 'INCOMPLETE_SEO','INVALID_HTML_SIZE','STALE_CURRENT_SEASON_CLAIM',
 'UNSAFE_MARKUP','INCOMPLETE_ARTICLE','COUPON_OR_OFFICIAL_STORE_MISSING',
 'CHECKPOINT_HASH_MISMATCH','DUPLICATE_INTENT','COUPON_FRESHNESS_BLOCK',
 'NATIVE_QUALITY_BLOCKED'
]);
const TEMPORARY_PREWRITE=new Set([
 'NATIVE_BINDINGS_MISSING','QUALITY_INDEX_UNAVAILABLE',
 'DUPLICATE_CHECK_UNAVAILABLE','GLOBAL_PUBLICATION_SLOT_NOT_GRANTED'
]);

export function classifyNativeRejection(status,reason){
 if(status===409&&PERMANENT_PREWRITE.has(reason))return 'BLOCKED_REVIEW';
 if(status===409&&TEMPORARY_PREWRITE.has(reason))return 'READY';
 if((status===401&&reason==='unauthorized')||
    (status===413&&reason==='payload_too_large'))return 'BLOCKED_REVIEW';
 return 'UNKNOWN_PUBLICATION_OUTCOME';
}
