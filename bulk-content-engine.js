export * from './bulk-content-engine-base.js';

import {
  buildEnglishNativeCandidate as buildEnglishNativeCandidateBase,
  buildEnglishUsefulArticle as buildEnglishUsefulArticleBase
} from './bulk-content-engine-base.js';

const englishSlugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);

function normalizeEnglishCandidate(candidate){
  if(!candidate)return candidate;
  const nativeCategory=String(candidate.nativeCategory||'').trim();
  const nativeMarket=String(candidate.nativeMarket||'').trim();
  if(candidate.intent==='timing'){
    const nativeVariant='coupon timing guide';
    const nativeKeyword=`Noon ${nativeMarket} ${nativeCategory} coupon timing guide`.replace(/\s+/g,' ').trim();
    return {...candidate,nativeVariant,nativeKeyword,nativeSlug:englishSlugify(nativeKeyword),nativeAngle:`coupon timing guidance for ${nativeCategory} shoppers in ${nativeMarket}`};
  }
  const oldKeyword=String(candidate.nativeKeyword||'');
  const oldVariant=String(candidate.nativeVariant||'');
  if(!/\bcart test\b/i.test(oldKeyword)&&!/\bcart test\b/i.test(oldVariant))return candidate;
  const nativeVariant='checkout checklist';
  const nativeKeyword=oldKeyword.replace(/\bcart test\b/gi,nativeVariant).replace(/\s+/g,' ').trim();
  return {...candidate,nativeVariant,nativeKeyword,nativeSlug:englishSlugify(nativeKeyword),nativeAngle:`${nativeVariant} for ${nativeCategory} shoppers in ${nativeMarket}`};
}

function wordSafeMeta(text,max=155){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(clean.length<=max)return clean;
  const hard=clean.slice(0,Math.max(1,max-1));
  const cut=hard.lastIndexOf(' ');
  const body=(cut>=Math.floor(max*0.68)?hard.slice(0,cut):hard).replace(/[\s,;:\-–—.]+$/g,'');
  return `${body}.`;
}

function englishMeta(kw,code){
  const metaLead=/\bguide$/i.test(kw)?kw:`${kw} guide`;
  const long=`Practical ${metaLead}. Copy ${code}, verify cart eligibility, seller and shipping, then confirm the final checkout total.`;
  const short=`Practical ${metaLead}. Copy ${code}, verify eligibility and confirm the final checkout total.`;
  return wordSafeMeta(long.length<=155?long:short,155);
}

export function buildEnglishNativeCandidate(topic){
  return normalizeEnglishCandidate(buildEnglishNativeCandidateBase(topic));
}

export function buildEnglishUsefulArticle(candidate,cursor=0){
  const normalized=normalizeEnglishCandidate(candidate);
  const article=buildEnglishUsefulArticleBase(normalized,cursor);
  if(!article)return article;
  const kw=String(article.primaryKeyword||normalized?.nativeKeyword||'').replace(/\bcart test\b/gi,'checkout checklist').replace(/\s+/g,' ').trim();
  const title=String(article.title||kw).replace(/\bcart test\b/gi,'checkout checklist').replace(/\s+/g,' ').trim();
  const slug=String(article.slug||'').replace(/cart-test\b/gi,'checkout-checklist');
  return {...article,slug,title,primaryKeyword:kw,metaDescription:englishMeta(kw,normalized?.code||article.coupon||'')};
}
