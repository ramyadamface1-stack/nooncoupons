// One-time deployment migration of existing user-provided GitHub secrets to
// Cloudflare Worker secrets. No provider API calls and no raw key logging.
// stdout MUST be piped directly into "wrangler secret put"; never echo it.
import {parseGeminiKeys} from '../automation/ai-v2/gemini-key-pool.mjs';
import {parseGroqKeys} from '../automation/ai-v2/groq-key-pool.mjs';
const provider=process.argv[2];
if(!['gemini','groq'].includes(provider))throw Error('VALID_PROVIDER_REQUIRED');
const parse=provider==='gemini'?parseGeminiKeys:parseGroqKeys;
const env=process.env,prefix=provider==='gemini'?'NDN_GEMINI_POOL_':'NDN_GROQ_POOL_';
const names=provider==='gemini'?['GEMINI_API_KEYS','GEMINI_API_KEYS_EXTRA','GEMINI_API_KEY']:
 ['GROQ_API_KEYS','GROQ_API_KEYS_EXTRA','GROQ_API_KEY'];
const values=[...names.map(name=>env[name]),...Array.from({length:12},(_,i)=>env[prefix+String(i+1).padStart(2,'0')])];
const keys=[...new Set(values.flatMap(raw=>parse(raw)))];
if(!keys.length)throw Error('NO_EXISTING_'+provider.toUpperCase()+'_KEYS_IN_DEPLOY_SECRETS');
const output=JSON.stringify(keys);
if(Buffer.byteLength(output)>4800)throw Error('CLOUDFLARE_SECRET_POOL_OVER_4800_BYTES_SPLIT_REQUIRED');
process.stdout.write(output);
process.stderr.write('CLOUDFLARE_'+provider.toUpperCase()+'_KEYS_MIGRATION_COUNT='+keys.length+'\n');
