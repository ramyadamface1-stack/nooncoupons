// Existing service binding, now powered ENTIRELY by Cloudflare Cron + R2.
// This file intentionally imports no GitHub dispatch workflow or PAT.
import {WorkerEntrypoint} from 'cloudflare:workers';
import directEngine,{requestDirectGeneration,directStatus} from '../cloudflare-ai-direct/engine.mjs';
import {listDirectKeys,importDirectKeys} from '../cloudflare-ai-direct/keys.mjs';
export class AdminDispatch extends WorkerEntrypoint{
 async dispatchOnce(){return requestDirectGeneration(this.env)}
 async keyInventory(){return listDirectKeys(this.env)}
 async importKeys(payload){return importDirectKeys(this.env,payload)}
 async status(){return directStatus(this.env)}
}
export default directEngine;
