import {rescueSignedReadBounded} from './r2-emergency-readonly.js';

// Read only existing bulk publication archive objects. Prefer a native
// R2 binding when present, otherwise use the already configured read-only
// destination-account rescue connection. Never write, create, or mutate R2.
export async function readPublicationArchiveJson(env,key){
  if(!/^bulk\/[A-Za-z0-9/_-]+\.json$/.test(String(key||''))){
    throw new Error('publication_archive_key_not_allowed');
  }
  if(env?.CONTENT_FINAL?.get){
    const object=await env.CONTENT_FINAL.get(key);
    return object?await object.json():null;
  }
  const response=await rescueSignedReadBounded(env,key);
  if(response.status===404)return null;
  if(!response.ok)throw new Error('publication_archive_rescue_http_'+response.status);
  return response.json();
}
