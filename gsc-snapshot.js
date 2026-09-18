export const GSC_SNAPSHOT={
  version:1,
  property:'sc-domain:noondealsnow.com',
  source:'Google Search Console',
  syncedAt:'2026-09-18T17:59:00Z',
  requestedRange:{startDate:'2026-08-19',endDate:'2026-09-15'},
  effectiveRange:{startDate:'2026-08-19',endDate:'2026-09-15'},
  comparisonRange:{startDate:'2026-07-22',endDate:'2026-08-18'},
  totals:{clicks:0,impressions:0,ctr:0,position:0},
  previousTotals:{clicks:0,impressions:0,ctr:0,position:0},
  changes:{clicks:0,impressions:0,ctr:0,position:0},
  drops:[],
  lowCtrPages:[],
  fallingKeywords:[],
  strikingDistanceKeywords:[],
  cannibalizationCandidates:[],
  dataAvailable:false,
  status:'no_rows_returned',
  message:'Google Search Console is connected, but no usable performance rows were returned for the finalized range.',
  limitations:[
    'Search Console data is finalized with an approximately three-day delay.',
    'Rankings and opportunities are derived from returned rows, not a stored analytics copy.'
  ]
};
export function gscSeoDropsSnapshot(){return structuredClone(GSC_SNAPSHOT)}
