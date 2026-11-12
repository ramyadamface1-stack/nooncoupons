// Pure scheduling for Cloudflare-only Gemini/Groq key windows. No secrets here.
// Interleave providers so an available Groq key is not hidden behind 30+ Gemini
// keys; both market cursors advance before any billable provider request.
export function planDirectProviderWindow(counts,{market,previous=null,maxAttempts=3,preferredProvider=null,allowFallback=true}={}){
 if(!['SA','AE'].includes(market)||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||
   !Number.isSafeInteger(counts?.gemini)||!Number.isSafeInteger(counts?.groq)||
   counts.gemini<0||counts.groq<0||
   (preferredProvider!==null&&!['gemini','groq'].includes(preferredProvider)))
  throw Error('INVALID_DIRECT_PROVIDER_WINDOW');
 const preferred=preferredProvider||(market==='SA'?'gemini':'groq');
 const alternate=preferred==='gemini'?'groq':'gemini';
 const providers=allowFallback?[preferred,alternate]:[preferred];
 const next={geminiNext:0,groqNext:0},positions={},used={gemini:0,groq:0};
 for(const provider of ['gemini','groq']){
  const length=counts[provider];
  const previousCursor=previous?.[provider+'Next'];
  positions[provider]=length===0?0:
   Number.isSafeInteger(previousCursor)&&previousCursor>=0?previousCursor%length:
   market==='AE'?Math.floor(length/2):0;
 }
 const attempts=[];
 while(attempts.length<maxAttempts){
  let appended=false;
  for(const provider of providers){
   if(attempts.length>=maxAttempts)break;
   const length=counts[provider];
   if(used[provider]>=length)continue;
   const keyIndex=(positions[provider]+used[provider])%length;
   attempts.push({provider,keyIndex});
   used[provider]++;
   appended=true;
  }
  if(!appended)break;
 }
 for(const provider of ['gemini','groq']){
  const length=counts[provider];
  next[provider+'Next']=length?(positions[provider]+used[provider])%length:0;
 }
 return {preferred,attempts,next};
}
