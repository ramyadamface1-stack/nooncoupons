import test from "node:test";
import assert from "node:assert/strict";
import {assessCutover} from "./new-account-readiness.mjs";
const full={zoneStatus:"active",workerFound:true,bucketFound:true,
  baseline:{ControlPlane:{manifestComplete:true,restoreComplete:true,exported:353109,restored:353109},
    GeneratorControl:{manifestComplete:true,restoreComplete:true,exported:4,restored:4}},
  fresh:{ControlPlane:{manifestComplete:true,restoreComplete:true,exported:353112,restored:353112},
    GeneratorControl:{manifestComplete:true,restoreComplete:true,exported:4,restored:4}},
  dnsRecordsVerified:true,publicStatus:200,liveCutoverApplied:false};
test("passing internal gates never claims a public cutover",()=>{const s=assessCutover(full);
 assert.equal(s.readyForOperatorCutover,true);assert.equal(s.liveOnNewAccount,false);});
test("pending Cloudflare zone blocks cutover",()=>assert.ok(assessCutover({...full,zoneStatus:"pending"}).blockers.some(x=>x.id==="zone_active")));
test("incomplete fresh DO snapshot blocks cutover",()=>assert.ok(assessCutover({...full,fresh:{...full.fresh,ControlPlane:{}}}).blockers.some(x=>x.id==="fresh_ControlPlane")));
test("mismatched restored counts block cutover",()=>assert.ok(assessCutover({...full,baseline:{...full.baseline,GeneratorControl:{manifestComplete:true,restoreComplete:true,exported:4,restored:3}}}).blockers.some(x=>x.id==="baseline_GeneratorControl")));
test("unverified DNS parity blocks cutover",()=>assert.ok(assessCutover({...full,dnsRecordsVerified:false}).blockers.some(x=>x.id==="dns_record_parity")));
test("429 is explicitly warned about",()=>assert.ok(assessCutover({...full,publicStatus:429}).warnings.some(x=>x.includes("429"))));
test("missing worker and R2 bucket block independently",()=>assert.equal(assessCutover({...full,workerFound:false,bucketFound:false}).blockers.filter(x=>["worker_exists","bucket_exists"].includes(x.id)).length,2));
