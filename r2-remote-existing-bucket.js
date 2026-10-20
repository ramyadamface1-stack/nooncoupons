// Temporary replacement of the DISABLED old-account R2 binding.
//
// Uses the EXISTING destination R2 bucket through SigV4 (not a new bucket).
// Activate only with REMOTE_EXISTING_R2_ENABLED='true'; Cloudflare native
// CONTENT_FINAL binding always takes precedence. Never gives public access
// to arbitrary bucket keys and NEVER supports delete.
//
// Production old-account DO namespaces remain unchanged; ONLY R2 storage is
// redirected. No new DO, Worker, bucket, route or paid capability.
const ACCOUNT='e4c35f8a50a7b2e4cfb9d6c534962603';
const BUCKET='nooncoupons-content-v2';
const HOST=ACCOUNT+'.r2.cloudflarestorage.com';
const enc=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const bytes=s=>s instanceof Uint8Array?s:new Uint8Array(s);
const hex=a=>Array.from(bytes(a),v=>v.toString(16).padStart(2,'0')).join('');
const sha=async raw=>hex(await crypto.subtle.digest('SHA-256',raw));
const hmac=async(key,data)=>{
  const k=await crypto.subtle.importKey('raw',typeof key==='string'?new TextEncoder().encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(data)));
};
const xmlText=(xml,tag)=>((xml.match(new RegExp('<(?:\\w+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?'+tag+'>'))||[])[1]||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const allowedKey=key=>typeof key==='string'&&
  /^(articles|bulk|quality|maintenance|english-canary|_ops|freshness|legacy-upgrade|migration|seo-rescue|blog|settings|coupons)\//.test(key)&&
  !key.split('/').some(p=>p==='..')&&!key.includes('\\');
const allowedPrefix=prefix=>prefix===''||allowedKey(prefix.endsWith('/')?prefix+'probe':prefix);
const storageMime=type=>String(type||'application/octet-stream').slice(0,130);
const metaValue=v=>String(v??'').replace(/[\r\n]/g,' ').slice(0,1024);
const credential=env=>{
  const id=String(env?.NOON_RESCUE_R2_ACCESS_KEY_ID||'').trim();
  const secret=String(env?.NOON_RESCUE_R2_SECRET_ACCESS_KEY||'').trim();
  if(!id||!secret)throw Error('remote_new_r2_existing_keys_missing');
  return {id,secret};
};
async function signed(env,method,key='',query={},body=null,extra={}){
  if(key&&!allowedKey(key))throw Error('remote_r2_key_not_allowlisted');
  const {id,secret}=credential(env);
  const path='/'+enc(BUCKET)+(key?'/'+key.split('/').map(enc).join('/'): '');
  const qs=Object.entries(query).filter(([k,v])=>v!==undefined&&v!==null)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>enc(k)+'='+enc(v)).join('&');
  const stamp=new Date().toISOString().replace(/[:-]|\.\d{3}/g,'');
  const day=stamp.slice(0,8);
  const raw=body===null?new Uint8Array(0):body instanceof Uint8Array?body:bytes(body);
  const hash=await sha(raw);
  const headers={
    host:HOST,
    'x-amz-content-sha256':hash,
    'x-amz-date':stamp,
    ...extra
  };
  const canonicalHeader=Object.entries(headers).map(([k,v])=>[k.toLowerCase().trim(),String(v).trim().replace(/\s+/g,' ')])
    .sort(([a],[b])=>a.localeCompare(b));
  const names=canonicalHeader.map(([k])=>k).join(';');
  const normalized=canonicalHeader.map(([k,v])=>k+':'+v+'\n').join('');
  const request=[method,path,qs,normalized,names,hash].join('\n');
  const scope=day+'/auto/s3/aws4_request';
  const toSign=['AWS4-HMAC-SHA256',stamp,scope,await sha(new TextEncoder().encode(request))].join('\n');
  let keyBytes=await hmac('AWS4'+secret,day);
  for(const item of ['auto','s3','aws4_request'])keyBytes=await hmac(keyBytes,item);
  const signature=hex(await hmac(keyBytes,toSign));
  const outgoing=new Headers(headers);
  outgoing.delete('host'); // Fetch supplies Host automatically; still sign canonical host.
  outgoing.set('Authorization','AWS4-HMAC-SHA256 Credential='+id+'/'+scope+', SignedHeaders='+names+', Signature='+signature);
  const response=await fetch('https://'+HOST+path+(qs?'?'+qs:''),{
    method,headers:outgoing,body:method==='PUT'?raw:undefined,redirect:'manual'
  });
  if(response.ok)return response;
  if(method==='GET'||method==='HEAD')if(response.status===404)return null;
  const sample=(await response.text()).slice(0,240).replace(/[\r\n]/g,' ');
  throw Error('remote_existing_r2_'+method+'_'+response.status+'_'+sample);
}
function objectResult(res,includeBody){
  const metadata={};
  res.headers.forEach((v,k)=>{if(k.startsWith('x-amz-meta-'))metadata[k.slice(11)]=v});
  const uploaded=res.headers.get('last-modified');
  const httpMetadata={
    contentType:res.headers.get('content-type')||undefined,
    cacheControl:res.headers.get('cache-control')||undefined,
    contentDisposition:res.headers.get('content-disposition')||undefined,
    contentEncoding:res.headers.get('content-encoding')||undefined,
    contentLanguage:res.headers.get('content-language')||undefined
  };
  const result={
    key:'',etag:(res.headers.get('etag')||'').replaceAll('"',''),size:Number(res.headers.get('content-length'))||0,
    uploaded:uploaded?new Date(uploaded):undefined,customMetadata:metadata,httpMetadata,
    writeHttpMetadata(headers){for(const [key,val] of Object.entries(httpMetadata))if(val)headers.set(key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),val)}
  };
  if(includeBody){
    result.body=res.body;
    result.text=()=>res.clone().text();
    result.json=()=>res.clone().json();
    result.arrayBuffer=()=>res.clone().arrayBuffer();
    result.blob=()=>res.clone().blob();
  }
  return result;
}
async function asArray(value){
  if(typeof value==='string')return new TextEncoder().encode(value);
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(value?.arrayBuffer&&typeof value.arrayBuffer==='function')return new Uint8Array(await value.arrayBuffer());
  if(value instanceof ReadableStream)return new Uint8Array(await new Response(value).arrayBuffer());
  throw Error('remote_r2_put_unsupported_body_type');
}
export function existingDestinationR2Binding(env){
  return {
    async get(key,options){
      if(!allowedKey(key))throw Error('remote_r2_get_key_not_allowlisted');
      if(options?.range||options?.onlyIf)throw Error('remote_r2_get_range_or_onlyIf_not_implemented');
      const res=await signed(env,'GET',key);
      if(!res)return null;
      const obj=objectResult(res,true);obj.key=key;return obj;
    },
    async head(key){
      if(!allowedKey(key))throw Error('remote_r2_head_key_not_allowlisted');
      const res=await signed(env,'HEAD',key);
      if(!res)return null;
      const obj=objectResult(res,false);obj.key=key;return obj;
    },
    async put(key,value,options={}){
      if(!allowedKey(key))throw Error('remote_r2_put_key_not_allowlisted');
      if(options.onlyIf)throw Error('remote_r2_put_conditional_not_implemented');
      const data=await asArray(value);
      if(data.byteLength>8*1024*1024)throw Error('remote_r2_put_size_limit_8MiB');
      const extra={};
      if(options.httpMetadata?.contentType)extra['content-type']=storageMime(options.httpMetadata.contentType);
      if(options.httpMetadata?.cacheControl)extra['cache-control']=metaValue(options.httpMetadata.cacheControl);
      if(options.httpMetadata?.contentDisposition)extra['content-disposition']=metaValue(options.httpMetadata.contentDisposition);
      if(options.httpMetadata?.contentEncoding)extra['content-encoding']=metaValue(options.httpMetadata.contentEncoding);
      if(options.httpMetadata?.contentLanguage)extra['content-language']=metaValue(options.httpMetadata.contentLanguage);
      const metadata=options.customMetadata||{};
      for(const [k,v] of Object.entries(metadata)){
        if(!/^[a-zA-Z0-9-]{1,60}$/.test(k))throw Error('remote_r2_invalid_metadata_key');
        extra['x-amz-meta-'+k.toLowerCase()]=metaValue(v);
      }
      await signed(env,'PUT',key,{},data,extra);
      return {key,size:data.byteLength,uploaded:new Date()};
    },
    async list(options={}){
      const prefix=String(options.prefix||'');
      if(!allowedPrefix(prefix))throw Error('remote_r2_list_prefix_not_allowlisted');
      const limit=Math.max(1,Math.min(1000,Math.trunc(Number(options.limit)||100)));
      const query={'list-type':'2','max-keys':String(limit),'encoding-type':'url',prefix};
      if(options.cursor)query['continuation-token']=String(options.cursor);
      if(options.delimiter)query.delimiter=String(options.delimiter);
      const res=await signed(env,'GET','',query);
      if(!res)throw Error('remote_r2_list_unexpected_404');
      const xml=await res.text();
      const objects=[];
      for(const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)){
        let key=xmlText(match[1],'Key');
        try{key=decodeURIComponent(key)}catch{}
        if(!allowedKey(key))continue;
        objects.push({key,size:Number(xmlText(match[1],'Size')||0),etag:xmlText(match[1],'ETag').replaceAll('"','')});
      }
      const truncated=xmlText(xml,'IsTruncated')==='true';
      const cursor=xmlText(xml,'NextContinuationToken');
      if(truncated&&!cursor)throw Error('remote_r2_list_missing_cursor');
      return {objects,truncated,cursor,delimitedPrefixes:[]};
    },
    async delete(){throw Error('remote_r2_delete_disabled_to_preserve_articles')},
    async createMultipartUpload(){throw Error('remote_r2_multipart_disabled')},
    async resumeMultipartUpload(){throw Error('remote_r2_multipart_disabled')}
  };
}
export function enableExistingDestinationR2(env){
  if(env?.CONTENT_FINAL)return env; // Cloudflare native binding always wins.
  if(String(env?.REMOTE_EXISTING_R2_ENABLED||'')!=='true')return env;
  credential(env);
  return {...env,CONTENT_FINAL:existingDestinationR2Binding(env)};
}
