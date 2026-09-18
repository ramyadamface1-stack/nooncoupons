const enabled=env=>String(env?.INDEXNOW_ENABLED||'false').toLowerCase()==='true'&&Boolean(env?.INDEXNOW_KEY)&&Boolean(env?.SITE_ORIGIN);

export async function submitIndexNow(env,records=[]){
  if(!enabled(env)||!records.length)return {enabled:enabled(env),submitted:0,status:null,error:null};
  let origin;
  try{origin=new URL(env.SITE_ORIGIN)}catch{return {enabled:true,submitted:0,status:null,error:'invalid_site_origin'}}
  const urlList=[...new Set(records.filter(r=>r?.slug&&r?.indexable!==false).map(r=>{
    const explicit=String(r.urlPath||'').trim();
    const path=explicit.startsWith('/')?explicit:'/articles/'+encodeURI(r.slug);
    try{return new URL(path,origin.origin).toString()}catch{return null}
  }).filter(Boolean))].slice(0,10000);
  if(!urlList.length)return {enabled:true,submitted:0,status:null,error:null};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try{
    const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({host:origin.hostname,key:String(env.INDEXNOW_KEY),keyLocation:origin.origin+'/'+String(env.INDEXNOW_KEY)+'.txt',urlList}),signal:controller.signal});
    return {enabled:true,submitted:r.ok?urlList.length:0,status:r.status,error:r.ok?null:'indexnow_http_'+r.status};
  }catch(e){return {enabled:true,submitted:0,status:null,error:e?.name==='AbortError'?'indexnow_timeout':'indexnow_submit_failed'}}
  finally{clearTimeout(timer)}
}

export const INDEXNOW_INFO={version:2,urlPathAware:true,endpoint:'https://api.indexnow.org/indexnow',batchPerPublish:true,nonBlockingForPublication:true};
