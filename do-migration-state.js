// Durable Object backup helper for controlled cross-account migration.
// Dormant unless DO_MIGRATION_EXPORT_ENABLED=true; only callable from DO binding.
const json=(value,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
const SAFE_DO_TYPES=new Set(['ControlPlane','GeneratorControl']);
function jsonSafe(value,seen=new WeakSet()){
  if(value==null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='object'||seen.has(value))return false;
  seen.add(value);
  if(Array.isArray(value))return value.every(item=>jsonSafe(item,seen));
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return false;
  return Object.entries(value).every(([,v])=>jsonSafe(v,seen));
}

export async function snapshotDurableObjectKeys(storage,env,type){
  if(String(env?.DO_MIGRATION_EXPORT_ENABLED||'')!=='true')return json({ok:false,reason:'export_disabled'},404);
  if(!SAFE_DO_TYPES.has(type)||!env?.CONTENT_FINAL)return json({ok:false,reason:'invalid_config'},503);
  const tag=String(env.DO_MIGRATION_EXPORT_TAG||'20261017-baseline');
  if(!/^[a-zA-Z0-9_-]{4,60}$/.test(tag))return json({ok:false,reason:'invalid_tag'},400);
  const stateKey='__noondealsnow_migration_export_'+type+'_'+tag;
  const state=await storage.get(stateKey)||{nextPart:1,cursor:null,scanned:0,exported:0,complete:false};
  if(state.complete)return json({ok:true,complete:true,...state});
  const pagesPerRequest=2,pageSize=128;
  let scanned=0,exported=0,lastPart=0;
  for(let i=0;i<pagesPerRequest;i++){
    const args={limit:pageSize};
    if(state.cursor)args.startAfter=state.cursor;
    const data=await storage.list(args);
    const rows=[...data.entries()];
    if(!rows.length){state.complete=true;break}
    const cursor=rows[rows.length-1][0];
    const payload=[];
    for(const [key,value] of rows){
      if(key.startsWith('__noondealsnow_migration_export_'))continue;
      if(!jsonSafe(value))return json({ok:false,reason:'non_json_value',type,keyKind:key.slice(0,24)},422);
      payload.push([key,value]);
    }
    const part=state.nextPart;
    const objectKey='migration/do-state/'+tag+'/'+type+'/part-'+String(part).padStart(7,'0')+'.json';
    const serialized=JSON.stringify({version:1,tag,type,part,cursorBefore:state.cursor,cursorAfter:cursor,scanned:rows.length,entries:payload});
    await env.CONTENT_FINAL.put(objectKey,serialized,{httpMetadata:{contentType:'application/json; charset=utf-8'}});
    state.cursor=cursor;
    state.nextPart+=1;
    state.scanned+=rows.length;
    state.exported+=payload.length;
    scanned+=rows.length;
    exported+=payload.length;
    lastPart=part;
    if(rows.length<pageSize)state.complete=true;
    await storage.put(stateKey,state);
    if(state.complete)break;
  }
  return json({ok:true,type,tag,scanned,exported,complete:Boolean(state.complete),nextPart:state.nextPart,lastPart,totalScanned:state.scanned,totalExported:state.exported});
}
