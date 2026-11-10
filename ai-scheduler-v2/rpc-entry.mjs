// This entrypoint is private to the named service binding on the SAME
// Cloudflare account. /health remains the only externally reachable HTTP path.
import {WorkerEntrypoint} from 'cloudflare:workers';
import scheduler,{adminManualDispatch} from './worker.mjs';
export class AdminDispatch extends WorkerEntrypoint{
 async dispatchOnce(){
  return adminManualDispatch(this.env);
 }
}
export default scheduler;
