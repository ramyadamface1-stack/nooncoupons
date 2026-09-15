export function normalizeArabicSearch(value=''){
  return String(value??'')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[أإآٱ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/ؤ/g,'و')
    .replace(/ئ/g,'ي')
    .replace(/ـ/g,'')
    .replace(/[^\p{L}\p{N}\s]/gu,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLocaleLowerCase('ar');
}

export function arabicSearchTokens(query=''){
  return [...new Set(normalizeArabicSearch(query).split(/\s+/).filter(x=>x.length>1))].slice(0,8);
}

export function matchesArabicSearch(text,query){
  const tokens=arabicSearchTokens(query);
  if(!tokens.length)return false;
  const normalized=normalizeArabicSearch(text);
  return tokens.every(token=>normalized.includes(token));
}

export const ARABIC_SEARCH_INFO={version:1,maxTokens:8,normalizes:['diacritics','alef-hamza','alef-maqsura','waw-hamza','yaa-hamza','tatweel','punctuation'],matching:'all-query-tokens'};
