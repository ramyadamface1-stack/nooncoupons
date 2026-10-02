import assert from 'node:assert/strict';
import {intentOwnerKey,intentKey} from './quality-index.js';
import {applyKeywordStrategy} from './keyword-strategy.js';

const base={country:'SA',market:'السعودية',category:'البقالة',profileKey:'grocery',intent:'coupon',useCase:'عائلة',factor:'سعر الوحدة',scenario:'قبل الدفع',topicIndex:120};
const exact={...base,campaignId:'grocery-saver-week-noon',campaignKind:'campaign',campaignStartKnown:true,campaignEndKnown:true,seasonalTerm:'Grocery Saver Week'};
const intervention={...base,campaignId:'teachers-day',campaignKind:'intervention',campaignStartKnown:false,campaignEndKnown:true};

assert.notEqual(intentOwnerKey(base),intentOwnerKey(exact));
assert.notEqual(intentKey(base),intentKey(exact));
assert.equal(intentOwnerKey(base),intentOwnerKey(intervention));

const optimized=applyKeywordStrategy(exact);
assert(optimized.kw.toLowerCase().includes('grocery saver week'));
assert(optimized.kw.length<=70);
console.log('campaign-intent-selftest: ok');
