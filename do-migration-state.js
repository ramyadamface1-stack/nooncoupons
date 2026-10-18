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
  if(state.complete){
    if(!state.manifestSaved){
      const manifest={version:1,type,tag,complete:true,parts:state.nextPart-1,scanned:state.scanned,exported:state.exported,completedAt:new Date().toISOString()};
      await env.CONTENT_FINAL.put('migration/do-state/'+tag+'/'+type+'/manifest.json',JSON.stringify(manifest),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
      state.manifestSaved=true;
      await storage.put(stateKey,state);
    }
    return json({ok:true,complete:true,...state});
  }
  // Bounded acceleration for emergency source-account migration:
  // the default remains two pages; production opts into twenty, never more.
  const configured=Number.parseInt(String(env.DO_MIGRATION_EXPORT_PAGES_PER_TICK||'2'),10);
  const pagesPerRequest=Number.isFinite(configured)?Math.max(1,Math.min(20,configured)):2;
  const pageSize=128,startedAt=Date.now();
  let scanned=0,exported=0,lastPart=0;
  for(let i=0;i<pagesPerRequest;i++){
    // Do not monopolize a single cron invocation; progress is persisted each page.
    if(i>0&&Date.now()-startedAt>12000)break;
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


async function writeRestoreProgress(env,type,tag,state,manifest){
  const key='migration/restore-progress/'+tag+'/'+type+'.json';
  const body=JSON.stringify({version:1,type,tag,complete:Boolean(state.complete),
    partsDone:state.nextPart-1,partsTotal:manifest.parts,
    keysRestored:state.restored,keysTotal:manifest.exported,
    updatedAt:new Date().toISOString()});
  await env.CONTENT_FINAL.put(key,body,{httpMetadata:{contentType:'application/json; charset=utf-8'}});
}

export async function restoreDurableObjectKeys(storage,env,type){
  if(String(env?.DO_MIGRATION_RESTORE_ENABLED||'')!=='true')return json({ok:false,reason:'restore_disabled'},404);
  if(!SAFE_DO_TYPES.has(type)||!env?.CONTENT_FINAL)return json({ok:false,reason:'invalid_config'},503);
  const tag=String(env.DO_MIGRATION_EXPORT_TAG||'20261017-baseline');
  if(!/^[a-zA-Z0-9_-]{4,60}$/.test(tag))return json({ok:false,reason:'invalid_tag'},400);
  const prefix='migration/do-state/'+tag+'/'+type+'/';
  const marker=await env.CONTENT_FINAL.get(prefix+'manifest.json');
  // Fail closed until the entire source archive (including the final manifest)
  // has been SHA256-mirrored to private destination R2 by GitHub Actions.
  if(!marker)return json({ok:false,reason:'source_export_manifest_not_ready'},409);
  const manifest=await marker.json();
  if(manifest.version!==1||manifest.complete!==true||manifest.type!==type||
     manifest.tag!==tag||!Number.isInteger(manifest.parts)||manifest.parts<1||
     !Number.isInteger(manifest.exported)||manifest.exported<0)
    return json({ok:false,reason:'invalid_export_manifest'},422);
  const stateKey='__noondealsnow_migration_import_'+type+'_'+tag;
  const state=await storage.get(stateKey)||{nextPart:1,restored:0,complete:false};
  if(state.complete){
    if(!state.progressSaved){
      await writeRestoreProgress(env,type,tag,state,manifest);
      state.progressSaved=true;
      await storage.put(stateKey,state);
    }
    return json({ok:true,type,tag,...state});
  }
  if(!Number.isInteger(state.nextPart)||state.nextPart<1||state.nextPart>manifest.parts+1)
    return json({ok:false,reason:'invalid_restore_checkpoint'},422);
  const count=Number.parseInt(String(env.DO_MIGRATION_RESTORE_PARTS_PER_TICK||'1'),10);
  const maxParts=Number.isFinite(count)?Math.max(1,Math.min(20,count)):1;
  const started=Date.now();
  let imported=0,importedParts=0;
  for(let i=0;i<maxParts&&state.nextPart<=manifest.parts;i++){
    if(i>0&&Date.now()-started>12000)break;
    const key=prefix+'part-'+String(state.nextPart).padStart(7,'0')+'.json';
    const file=await env.CONTENT_FINAL.get(key);
    if(!file)return json({ok:false,reason:'export_part_missing',part:state.nextPart},409);
    const data=await file.json();
    if(data.version!==1||data.type!==type||data.tag!==tag||data.part!==state.nextPart||
       !Array.isArray(data.entries)||data.entries.length>128||
       data.scanned<data.entries.length)
      return json({ok:false,reason:'invalid_export_part',part:state.nextPart},422);
    const keys=new Set();
    for(const pair of data.entries){
      if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||
         pair[0].startsWith('__noondealsnow_migration_')||keys.has(pair[0])||
         !jsonSafe(pair[1]))
        return json({ok:false,reason:'invalid_export_entry',part:state.nextPart},422);
      keys.add(pair[0]);
    }
    // Durable Object Storage supports an atomic multi-key put. One batch per
    // archive part is cheaper and avoids 128 serial storage writes per part.
    if(data.entries.length){
      await storage.put(Object.fromEntries(data.entries));
    }
    state.restored+=data.entries.length;
    state.nextPart+=1;
    await storage.put(stateKey,state);
    imported+=data.entries.length;importedParts++;
  }
  if(state.nextPart>manifest.parts){
    if(state.restored!==manifest.exported)
      return json({ok:false,reason:'restored_count_mismatch',
                   actual:state.restored,expected:manifest.exported},409);
    state.complete=true;
    await storage.put(stateKey,state);
  }
  await writeRestoreProgress(env,type,tag,state,manifest);
  if(state.complete){
    state.progressSaved=true;
    await storage.put(stateKey,state);
  }
  return json({ok:true,type,tag,complete:Boolean(state.complete),
    imported,importedParts,totalImported:state.restored,
    partsRemaining:Math.max(0,manifest.parts-state.nextPart+1)});
}
