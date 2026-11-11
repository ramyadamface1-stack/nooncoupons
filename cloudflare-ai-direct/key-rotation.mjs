// Pure deterministic credential selection for direct Cloudflare generation.
// The topic queue position must never choose the same first keys for both
// markets or repeatedly hammer keys that definitively returned 429.
export function planDirectKeyRotation(poolLength,previous,market){
 if(!Number.isInteger(poolLength)||poolLength<1||!['SA','AE'].includes(market))
  throw Error('INVALID_KEY_ROTATION_ARGUMENT');
 const window=Math.min(3,poolLength);
 const stored=Number.isSafeInteger(previous?.next)&&previous.next>=0?previous.next:null;
 const first=stored===null?(market==='AE'?Math.floor(poolLength/2):0):stored%poolLength;
 const indices=Array.from({length:window},(_,i)=>(first+i)%poolLength);
 return {indices,next:(first+window)%poolLength,market};
}
