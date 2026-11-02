// One tiny R2 object under the existing private checkpoint prefix.
// No article generation, no live publication and no user content.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readCheckpointRest,saveCheckpointRest} from './r2-checkpoints-http.mjs';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const id=createHash('sha256').update('noondealsnow|r2-http-rest-smoke-v1').digest('hex').slice(0,24);
try{
 const previous=await readCheckpointRest(config,id);
 const version=Number(previous?.version||0)+1;
 const record={articleId:id,state:'R2_HTTP_SMOKE',version,createdAt:previous?.createdAt||new Date().toISOString(),sections:[]};
 const saved=await saveCheckpointRest(config,record);
 if(saved.articleId!==id||saved.state!=='R2_HTTP_SMOKE'||saved.version!==version)throw Error('SMOKE_READBACK_MISMATCH');
 console.log('AI_V2_R2_REST_SMOKE=PASS');
}catch(e){
 console.error('AI_V2_R2_REST_SMOKE=FAIL '+String(e?.message||e).replace(/Bearer\\s+\\S+/gi,'[REDACTED]').slice(0,120));
 process.exitCode=1;
}
