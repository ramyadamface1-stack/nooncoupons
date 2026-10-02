import assert from 'node:assert/strict';
import {intentOwnerKey,intentKey,preflightGlobalGate} from './quality-index.js';
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

const evergreen=applyKeywordStrategy(base);
const evergreenEntry={slug:evergreen.slug,title:evergreen.title,primaryKeyword:evergreen.kw,country:base.country,category:evergreen.category,intent:evergreen.intent,useCase:evergreen.useCase,factor:evergreen.factor,scenario:evergreen.scenario,queryModifier:evergreen.queryModifier,catalogLevel:evergreen.catalogLevel,catalogTarget:evergreen.catalogTarget,brandKey:evergreen.brandKey,modelKey:evergreen.modelKey,comparisonKey:evergreen.comparisonKey,intentKey:intentKey(evergreen),ownerIntentKey:intentOwnerKey(evergreen)};
const campaignGate=preflightGlobalGate(optimized,{entries:[evergreenEntry]});
assert.equal(campaignGate.pass,true);
console.log('campaign-intent-selftest: ok');
