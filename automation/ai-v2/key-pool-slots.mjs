// Fixed additive GitHub Actions Secrets slots. Never overwrite existing
// GEMINI_API_KEY(S) or GROQ_API_KEY(S) just to append another credential.
// 12 slots * up to 100 credentials per slot per provider.
export const PROVIDER_SLOTS=Object.freeze({
  gemini:Object.freeze(Array.from({length:12},(_,i)=>'NDN_GEMINI_POOL_'+String(i+1).padStart(2,'0'))),
  groq:Object.freeze(Array.from({length:12},(_,i)=>'NDN_GROQ_POOL_'+String(i+1).padStart(2,'0')))
});
export const LEGACY_SECRET_NAMES=Object.freeze({
  gemini:Object.freeze(['GEMINI_API_KEY','GEMINI_API_KEYS','GEMINI_API_KEYS_EXTRA']),
  groq:Object.freeze(['GROQ_API_KEY','GROQ_API_KEYS','GROQ_API_KEYS_EXTRA'])
});
export function secretNames(provider){
  if(!PROVIDER_SLOTS[provider])throw Error('UNSUPPORTED_KEY_PROVIDER');
  return [...LEGACY_SECRET_NAMES[provider],...PROVIDER_SLOTS[provider]];
}
export function additionalKeyEntries(env,provider,parse){
  return PROVIDER_SLOTS[provider].flatMap(source=>parse(env?.[source]).map(key=>({key,source})));
}
