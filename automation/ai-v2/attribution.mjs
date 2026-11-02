// Opaque non-secret audit attribution. A 'published article per key' is
// assigned to the key responsible for the most completed article sections.
// Other contributing keys remain recorded; never reveal API keys.
const safeProvider=p=>p==='gemini'||p==='groq';
const safeRef=r=>typeof r==='string'&&/^[a-f0-9]{12}$/.test(r);
export function normalizeAttribution(value){
 if(!value||!safeProvider(value.provider)||!safeRef(value.keyRef)||
   !Array.isArray(value.contributors)||value.contributors.length<1||value.contributors.length>5)return null;
 const seen=new Set(),contributors=[];let total=0;
 for(const item of value.contributors){
  if(!safeProvider(item?.provider)||!safeRef(item?.keyRef)||
    !Number.isInteger(item?.sections)||item.sections<1||item.sections>5)return null;
  const id=item.provider+':'+item.keyRef;
  if(seen.has(id))return null;
  seen.add(id);total+=item.sections;
  contributors.push({provider:item.provider,keyRef:item.keyRef,sections:item.sections});
 }
 if(total!==5)return null;
 const top=contributors.reduce((a,b)=>b.sections>a.sections?b:a);
 if(value.provider!==top.provider||value.keyRef!==top.keyRef)return null;
 return {provider:top.provider,keyRef:top.keyRef,contributors,mixed:contributors.length>1};
}
export function summarizeSectionAttribution(sections){
 if(!Array.isArray(sections)||sections.length!==5)return null;
 const contributors=[];
 for(const part of sections){
  if(!safeProvider(part?.provider)||!safeRef(part?.keyRef))return null;
  let match=contributors.find(x=>x.provider===part.provider&&x.keyRef===part.keyRef);
  if(!match){match={provider:part.provider,keyRef:part.keyRef,sections:0};contributors.push(match)}
  match.sections++;
 }
 const top=contributors.reduce((a,b)=>b.sections>a.sections?b:a);
 return normalizeAttribution({provider:top.provider,keyRef:top.keyRef,contributors});
}
