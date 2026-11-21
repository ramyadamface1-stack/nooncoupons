// Manual-only, reversible 5th WAF custom rule for free Worker request budget.
// Narrowly block automated SEO/training agents on per-article image SVG files
// but keep their HTML article pages readable. Preserve all SEO/search crawlers,
// normal user agents, coupon HTML, admin, API and content publishing.
// Do not use an IP/country/ASN block: irrelevant to legitimate customers.
export const RULE_LABEL='NDN quota guard: secondary automated SVG crawler requests only';
export const RULE_EXPRESSION='(http.request.method eq "GET" and starts_with(http.request.uri.path, "/assets/coupon-svg/") and (http.user_agent contains "SemrushBot" or http.user_agent contains "AhrefsBot" or http.user_agent contains "Bytespider" or http.user_agent contains "ClaudeBot") and not http.user_agent contains "OAI-SearchBot" and not http.user_agent contains "ChatGPT-User" and not http.user_agent contains "Googlebot" and not http.user_agent contains "bingbot" and not http.user_agent contains "Google-InspectionTool" and not http.user_agent contains "GoogleOther" and not http.user_agent contains "Applebot")';
export const PRIMARY_ALLOWED_AGENTS=Object.freeze(['Googlebot','bingbot','OAI-SearchBot','ChatGPT-User','Google-InspectionTool','GoogleOther','Applebot']);
export const SVG_ONLY_AUTOMATED_AGENTS=Object.freeze(['SemrushBot','AhrefsBot','Bytespider','ClaudeBot']);
const token=process.env.CF_TOKEN||'',account=process.env.CF_ACCOUNT||'';
const mode=process.env.NDN_SECONDARY_SVG_MODE||'';
function must(cond,message){if(!cond)throw Error(message)}
async function run(){
  must(['apply','disable'].includes(mode),'MODE_MUST_BE_EXPLICIT_APPLY_OR_DISABLE');
  must(token&&account,'ACCOUNT_AND_TOKEN_REQUIRED');
  const api=async(path,{method='GET',body}={})=>{
    const r=await fetch('https://api.cloudflare.com/client/v4'+path,{
      method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(18000)
    });
    const obj=await r.json();
    if(!r.ok||obj.success!==true)throw Error(method+'_HTTP_'+r.status+'_'+String(obj.errors?.[0]?.message||'unknown').slice(0,140));
    return obj.result;
  };
  const zones=await api('/zones?name=noondealsnow.com');
  const zone=zones.find(x=>x.name==='noondealsnow.com'&&x?.account?.id===account&&x?.status==='active');
  must(zone?.id,'ZONE_NOT_FOUND_IN_EXPECTED_ACCOUNT');
  const phase='/zones/'+zone.id+'/rulesets/phases/http_request_firewall_custom/entrypoint';
  const set=await api(phase);
  must(set?.id,'EXISTING_WAF_RULESET_REQUIRED');
  const found=(set.rules||[]).filter(x=>x.description===RULE_LABEL);
  must(found.length<=1,'DUPLICATE_RULE_REQUIRES_REVIEW');
  if(found.length===1){
    must(found[0].expression===RULE_EXPRESSION&&found[0].action==='block','REFUSE_MUTATED_RULE');
  }
  if(mode==='apply'){
    if(found.length===0){
      must((set.rules||[]).length>=4,'P0_WAF_BASE_RULES_MISSING_REFUSE');
      await api('/zones/'+zone.id+'/rulesets/'+set.id+'/rules',{
        method:'POST',body:{action:'block',expression:RULE_EXPRESSION,description:RULE_LABEL,enabled:true}
      });
    }else if(found[0].enabled!==true){
      await api('/zones/'+zone.id+'/rulesets/'+set.id+'/rules/'+found[0].id,{method:'PATCH',body:{enabled:true}});
    }
  }else{
    must(found.length===1,'NO_EXACT_RULE_TO_DISABLE');
    if(found[0].enabled!==false)
      await api('/zones/'+zone.id+'/rulesets/'+set.id+'/rules/'+found[0].id,{method:'PATCH',body:{enabled:false}});
  }
  const now=await api(phase);
  const owned=(now.rules||[]).filter(x=>x.description===RULE_LABEL);
  must(owned.length===1&&owned[0].enabled===(mode==='apply')&&owned[0].expression===RULE_EXPRESSION,'POST_CHANGE_VERIFICATION_FAILED');
  console.log('NDN_SECONDARY_SVG_WAF_RULE_'+(mode==='apply'?'ENABLED':'DISABLED')+'_VERIFIED='+owned[0].id);
  console.log('SCOPE=GET /assets/coupon-svg/* only; secondary agents SemrushBot, AhrefsBot, Bytespider and ClaudeBot');
  console.log('ALWAYS_ALLOWED=Googlebot, GoogleOther, Bingbot, OAI-SearchBot, ChatGPT-User, Applebot, normal browsers; all HTML, admin and publisher');
  console.log('WORKER_DEPLOY=NONE;DNS=UNCHANGED;ARTICLE_CONTENT=UNCHANGED;R2_WRITES=NONE;BILLING_UPGRADE=NONE');
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href)
  await run();
