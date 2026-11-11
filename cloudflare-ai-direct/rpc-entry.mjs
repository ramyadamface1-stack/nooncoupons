// Independent Cloudflare service. The existing GitHub scheduler is untouched during canary.
import {WorkerEntrypoint} from 'cloudflare:workers';
import engine,{requestDirectGeneration,directAdminStatus} from './engine.mjs';
import {listDirectKeys,importDirectKeys} from './keys.mjs';
export class AdminDispatch extends WorkerEntrypoint {
 async dispatchOnce(){return requestDirectGeneration(this.env)}
 async keyInventory(){return listDirectKeys(this.env)}
 async importKeys(payload){return importDirectKeys(this.env,payload)}
 async status(){return directAdminStatus(this.env)}
}
export default engine;
