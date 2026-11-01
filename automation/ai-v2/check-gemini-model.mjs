import {selectGeminiKey} from './gemini-key-pool.mjs';

export async function inspectGeminiAuth(env={},fetchFn=fetch){
  const credential=selectGeminiKey({GEMINI_API_KEYS:env.GEMINI_API_KEYS},0);
  if(!credential)return {result:'NO_NEW_GEMINI_KEY',authenticationVerified:false,checkedKeys:0,generationCalls:0};
  const url='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash';
  try{
    const res=await fetchFn(url,{method:'GET',headers:{'x-goog-api-key':credential.key},signal:AbortSignal.timeout(12000)});
    return {result:res.status===200?'MODEL_METADATA_OK':'MODEL_METADATA_HTTP_'+res.status,authenticationVerified:res.status===200,httpStatus:res.status,checkedKeys:1,generationCalls:0,selectedSource:credential.source};
  }catch{return {result:'MODEL_METADATA_NETWORK_ERROR',authenticationVerified:false,checkedKeys:1,generationCalls:0,selectedSource:credential.source}}
}
if(process.argv[1]&&import.meta.url.endsWith('/'+process.argv[1].split('/').at(-1))){
  const result=await inspectGeminiAuth(process.env);
  console.log('AI_V2_GEMINI_AUTH_CHECK '+JSON.stringify(result));
}
