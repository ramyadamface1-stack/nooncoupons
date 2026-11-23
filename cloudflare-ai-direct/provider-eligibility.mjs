// Secret-safe R2 availability probe BEFORE any new article topic/checkpoint
// reservation or billable LLM request. A 429 cooldown must not permanently
// exhaust unrelated N12 topics while all selected free keys are cooling.
// This does not validate provider credentials, quotas, or promise a response.
// It only prevents definite local R2 cooldown/rejection from burning slots.
const ROOT='_ops/noondealsnow-direct-ai-v1/';
export async function inspectDirectProviderEligibility(bucket,keys,window,{
 fingerprint,atMs=Date.now()
}={}){
 if(!bucket||typeof bucket.head!=='function'||typeof bucket.get!=='function'||
    !keys||!Array.isArray(window?.attempts)||typeof fingerprint!=='function'||
    !Number.isFinite(atMs)||atMs<0)throw Error('INVALID_DIRECT_PROVIDER_ELIGIBILITY_INPUT');
 const eligible=[],diagnostics={considered:0,cooling:0,rejected:0,unreadable:0,eligible:0};
 for(const selected of window.attempts){
  const key=keys[selected?.provider]?.[selected?.keyIndex];
  if(!['gemini','groq'].includes(selected?.provider)||typeof key!=='string'||!key){
   diagnostics.unreadable++;
   continue;
  }
  diagnostics.considered++;
  const digest=await fingerprint(key),keyRef=String(digest||'').slice(0,12);
  if(!/^[a-f0-9]{12}$/.test(keyRef))throw Error('INVALID_PROVIDER_FINGERPRINT');
  const rejectKey=ROOT+'provider-rejected/'+selected.provider+'/'+keyRef+'.json';
  const cooldownKey=ROOT+'provider-quota-cooldown/'+selected.provider+'/'+keyRef+'.json';
  // R2 transport/JSON errors are not evidence that a key is safe. Fail closed
  // before assigning any topic or advancing its cursor.
  const rejected=await bucket.head(rejectKey);
  if(rejected){diagnostics.rejected++;continue}
  const item=await bucket.get(cooldownKey);
  if(item){
   const record=await item.json();
   const until=Date.parse(String(record?.until||''));
   if(!Number.isFinite(until)){diagnostics.unreadable++;continue}
   if(until>atMs){diagnostics.cooling++;continue}
  }
  eligible.push({provider:selected.provider,keyIndex:selected.keyIndex});
  diagnostics.eligible++;
 }
 return {eligible,diagnostics};
}
