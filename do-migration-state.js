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
  if(state.complete&&!state.manifestSaved){
    const manifest={version:1,type,tag,complete:true,parts:state.nextPart-1,scanned:state.scanned,exported:state.exported,completedAt:new Date().toISOString()};
    await env.CONTENT_FINAL.put('migration/do-state/'+tag+'/'+type+'/manifest.json',JSON.stringify(manifest),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
    state.manifestSaved=true;
    await storage.put(stateKey,state);
  }
  return json({ok:true,type,tag,scanned,exported,complete:Boolean(state.complete),nextPart:state.nextPart,lastPart,totalScanned:state.scanned,totalExported:state.exported});
}


export async function restoreDurableObjectKeys(storage,env,type){
  if(String(env?.DO_MIGRATION_RESTORE_ENABLED||'')!=='true')return json({ok:false,reason:'restore_disabled'},404);
  if(!SAFE_DO_TYPES.has(type)||!env?.CONTENT_FINAL)return json({ok:false,reason:'invalid_config'},503);
  const tag=String(env.DO_MIGRATION_EXPORT_TAG||'20261017-baseline');
  if(!/^[a-zA-Z0-9_-]{4,60}$/.test(tag))return json({ok:false,reason:'invalid_tag'},400);
  const prefix='migration/do-state/'+tag+'/'+type+'/';
  const marker=await env.CONTENT_FINAL.get(prefix+'manifest.json');
  if(!marker)return json({ok:false,reason:'source_export_manifest_not_ready'},409);
  const manifest=await marker.json();
  if(manifest.complete!==true||manifest.type!==type||manifest.tag!==tag||!Number.isInteger(manifest.parts)||manifest.parts<1)return json({ok:false,reason:'invalid_export_manifest'},422);
  const stateKey='__noondealsnow_migration_import_'+type+'_'+tag;
  const state=await storage.get(stateKey)||{nextPart:1,restored:0,complete:false};
  if(state.complete)return json({ok:true,type,tag,...state});
  if(state.nextPart>manifest.parts){
    if(state.restored!==manifest.exported)return json({ok:false,reason:'restored_count_mismatch'},409);
    state.complete=true;
    await storage.put(stateKey,state);
    return json({ok:true,type,tag,...state});
  }
  const key=prefix+'part-'+String(state.nextPart).padStart(7,'0')+'.json';
  const file=await env.CONTENT_FINAL.get(key);
  if(!file)return json({ok:false,reason:'export_part_missing',part:state.nextPart},409);
  const data=await file.json();
  if(data.version!==1||data.type!==type||data.tag!==tag||data.part!==state.nextPart||!Array.isArray(data.entries)||data.entries.length>128)return json({ok:false,reason:'invalid_export_part',part:state.nextPart},422);
  for(const pair of data.entries){
    if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||pair[0].startsWith('__noondealsnow_migration_')||!jsonSafe(pair[1]))return json({ok:false,reason:'invalid_export_entry'},422);
    await storage.put(pair[0],pair[1]);
  }
  state.restored+=data.entries.length;
  state.nextPart+=1;
  await storage.put(stateKey,state);
  return json({ok:true,type,tag,complete:false,imported:data.entries.length,totalImported:state.restored,remainingParts:manifest.parts-state.nextPart+1});
}
