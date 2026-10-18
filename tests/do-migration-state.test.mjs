import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotDurableObjectKeys,restoreDurableObjectKeys} from '../do-migration-state.js';

const makeStorage=(init={})=>{
  const m=new Map(Object.entries(init));
  return {
    raw:m,
    async get(k){return m.get(k)},
    async put(k,v){m.set(k,v)},
    async list({limit=128,startAfter=null}={}){
      const entries=[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).filter(([k])=>startAfter===null||k>startAfter).slice(0,limit);
      return new Map(entries);
    }
  };
};
const makeR2=()=>{
  const objects=new Map();
  return {
    objects,
    async get(key){const value=objects.get(key);return value===undefined?null:{json:async()=>JSON.parse(value)}},
    async put(key,value){objects.set(key,value);}
  };
};
const exportEnv=r2=>({CONTENT_FINAL:r2,DO_MIGRATION_EXPORT_ENABLED:'true',DO_MIGRATION_EXPORT_TAG:'migration-test'});
const restoreEnv=r2=>({CONTENT_FINAL:r2,DO_MIGRATION_RESTORE_ENABLED:'true',DO_MIGRATION_EXPORT_TAG:'migration-test'});

test('exports DO state into paginated R2 archive and restores without modifying source',async()=>{
  const data={config:{enabled:true,minWords:1500},state:{articles:[{slug:'keep-original-slug',status:'published'}]},'visit-total:abc':{count:41},englishScheduler:{published:20,ok:true}};
  const original=makeStorage(data),r2=makeR2();
  const resp=await snapshotDurableObjectKeys(original,exportEnv(r2),'ControlPlane');
  assert.equal(resp.status,200);
  const x=await resp.json();
  assert.equal(x.ok,true);assert.equal(x.complete,true);assert.equal(x.totalExported,4);
  assert(r2.objects.has('migration/do-state/migration-test/ControlPlane/part-0000001.json'));
  assert(r2.objects.has('migration/do-state/migration-test/ControlPlane/manifest.json'));
  const destination=makeStorage();
  let imported=await restoreDurableObjectKeys(destination,restoreEnv(r2),'ControlPlane');
  assert.equal(imported.status,200);
  imported=await restoreDurableObjectKeys(destination,restoreEnv(r2),'ControlPlane');
  assert.equal((await imported.json()).complete,true);
  for(const [k,v] of Object.entries(data)){
    assert.deepEqual(destination.raw.get(k),v);
    assert.deepEqual(original.raw.get(k),v);
  }
});

test('disabled export and restore perform zero writes',async()=>{
  const storage=makeStorage({status:{published:123}}),r2=makeR2();
  const a=await snapshotDurableObjectKeys(storage,{CONTENT_FINAL:r2},'GeneratorControl');
  const b=await restoreDurableObjectKeys(storage,{CONTENT_FINAL:r2},'GeneratorControl');
  assert.equal(a.status,404);assert.equal(b.status,404);assert.equal(r2.objects.size,0);
  assert.equal(storage.raw.size,1);
});

test('unsupported structured clone type blocks export before any writes',async()=>{
  const storage=makeStorage({start:new Date('2026-10-17T00:00:00Z')}),r2=makeR2();
  const a=await snapshotDurableObjectKeys(storage,exportEnv(r2),'GeneratorControl');
  assert.equal(a.status,422);
  assert.equal(r2.objects.size,0);
});

test('bounded acceleration exports six pages per tick and resumes without losing keys',async()=>{
  const input={};
  for(let i=0;i<950;i++)input['article-'+String(i).padStart(5,'0')]={slug:'article-'+i,score:95};
  const state=makeStorage(input),r2=makeR2();
  const env={...exportEnv(r2),DO_MIGRATION_EXPORT_PAGES_PER_TICK:'6'};
  let response=await snapshotDurableObjectKeys(state,env,'ControlPlane');
  let first=await response.json();
  assert.equal(response.status,200);
  assert.equal(first.complete,false);
  assert.equal(first.lastPart,6);
  assert.equal(first.totalExported,768);
  response=await snapshotDurableObjectKeys(state,env,'ControlPlane');
  const second=await response.json();
  assert.equal(response.status,200);
  assert.equal(second.complete,true);
  assert.equal(second.totalExported,950);
  const manifest=JSON.parse(r2.objects.get('migration/do-state/migration-test/ControlPlane/manifest.json'));
  assert.equal(manifest.parts,8);
  assert.equal(manifest.exported,950);
  assert.equal(manifest.complete,true);
  assert.equal(state.raw.get('article-00000').slug,'article-0');
});

test('malformed export rate is safely clamped and legacy default remains two pages',async()=>{
  const input={};
  for(let i=0;i<850;i++)input['row-'+String(i).padStart(5,'0')]=i;
  const original=makeStorage(input),r2=makeR2();
  const response=await snapshotDurableObjectKeys(original,{...exportEnv(r2),DO_MIGRATION_EXPORT_PAGES_PER_TICK:'99999'},'ControlPlane');
  assert.equal((await response.json()).lastPart,6);
  const another=makeStorage(input),r2b=makeR2();
  const baseline=await snapshotDurableObjectKeys(another,exportEnv(r2b),'ControlPlane');
  assert.equal((await baseline.json()).lastPart,2);
});
