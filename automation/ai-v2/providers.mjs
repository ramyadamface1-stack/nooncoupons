import {classifyFailure} from './guardrails.mjs';
export async function callProvider({provider,model,key,prompt,fetchFn=fetch}){
  if(!key||!model)throw Error('PROVIDER_CREDENTIAL_MISSING');
  const headers={'content-type':'application/json'};
  let url,payload;
  if(provider==='gemini'){
    url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
    headers['x-goog-api-key']=key;
    // Gemini 3.8 Flash no longer accepts the old sampling temperature/top_p
    // migration knobs. Keep model-specific payloads minimal and supported.
    const generationConfig=model.startsWith('gemini-3.8-')?{maxOutputTokens:2500}:{temperature:0.65,maxOutputTokens:2500};
    payload={contents:[{parts:[{text:prompt}]}],generationConfig};
  }else if(provider==='groq'){
    url='https://api.groq.com/openai/v1/chat/completions';
    headers.authorization='Bearer '+key;
    payload={model,temperature:0.65,reasoning_effort:'low',include_reasoning:false,max_completion_tokens:3200,messages:[{role:'system',content:'Return original editorial article section HTML only. No fake prices, claims or coupon guarantees.'},{role:'user',content:prompt}]};
  }else throw Error('UNSUPPORTED_PROVIDER');
  // No blind retry. A lost connection after sending may still consume quota.
  const response=await fetchFn(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(105000)});
  const text=await response.text();
  if(!response.ok){
    const err=classifyFailure(response.status,text.slice(0,350),response.headers.get('retry-after')||'');
    return {ok:false,...err,provider,model,httpStatus:response.status};
  }
  let j;try{j=JSON.parse(text)}catch{return {ok:false,category:'MALFORMED_JSON',retry:false,httpStatus:response.status}}
  const content=provider==='gemini'?(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join(''):j.choices?.[0]?.message?.content||'';
  if(!content||content.trim().length<600)return {ok:false,category:'INCOMPLETE_RESPONSE',retry:false,httpStatus:response.status};
  return {ok:true,content:content.trim(),provider,model,httpStatus:response.status,requestId:response.headers.get('x-request-id')||null};
}
