export const GSC_SNAPSHOT={
  version:2,
  property:'sc-domain:noondealsnow.com',
  source:'Google Search Console',
  syncedAt:'2026-09-28T00:00:00Z',
  requestedRange:{startDate:'2026-08-29',endDate:'2026-09-25'},
  effectiveRange:{startDate:'2026-08-29',endDate:'2026-09-25'},
  comparisonRange:{startDate:'2026-08-01',endDate:'2026-08-28'},
  totals:{clicks:4,impressions:846,ctr:0.004728132387706856,position:33.829787234042556},
  previousTotals:{clicks:0,impressions:0,ctr:0,position:0},
  dataAvailable:true,
  topObservedQueries:[
    {query:'noon coupon',clicks:0,impressions:30,ctr:0,position:56.13333333333333},
    {query:'noon coupon ksa',clicks:0,impressions:11,ctr:0,position:47.90909090909091},
    {query:'كوبون نون',clicks:0,impressions:10,ctr:0,position:68.3},
    {query:'اكواد خصم نون',clicks:0,impressions:9,ctr:0,position:48.44444444444444},
    {query:'كود خصم نون السعودية',clicks:1,impressions:8,ctr:0.125,position:58.5},
    {query:'noon grocery code',clicks:0,impressions:8,ctr:0,position:29.625}
  ],
  cannibalizationCandidates:[
    {query:'noon code',owners:['/saudi-arabia/noon-coupon-code','/saudi-arabia/noon-coupon-code-today'],action:'consolidate-freshness-variants'},
    {query:'noon code خصم',owners:['/','/saudi-arabia/noon-coupon-code','/saudi-arabia/noon-coupon-code-today'],action:'clarify-primary-owner'},
    {query:'noon coupon',owners:['/en/saudi','/en/uae'],action:'keep-market-specific-owners'},
    {query:'كود خصم نون',owners:['/','/coupons','/saudi'],action:'differentiate-home-coupons-market-hub'}
  ],
  priorityClusters:['country-coupons','coupon-eligibility','coupon-troubleshooting','mobiles','grocery','computers-laptops','automotive','how-to-use-coupon'],
  limitations:[
    'Search Console data is finalized with an approximately three-day delay.',
    'Impressions are site impressions, not keyword search volume.',
    'The observed sample is small; no ranking probability or search-volume claim is derived from it.'
  ]
};
export function gscSeoDropsSnapshot(){return structuredClone(GSC_SNAPSHOT)}
