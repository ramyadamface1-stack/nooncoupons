// Strict provider HTTP outcome classification. Confirmed 401/403 cannot
// produce an article and allow testing a distinct valid key; no blind retry.
// Timeout/5xx responses may already have consumed quota or produced content.
export function providerOutcomeAction({ok=false,http=null}={}){
 if(ok===true)return 'ACCEPT';
 if(http===429)return 'NEXT_FREE_KEY';
 if(http===401||http===403)return 'NEXT_VALID_KEY';
 if(Number.isInteger(http)&&http>=500&&http<=599)return 'QUARANTINE_UNKNOWN';
 return 'STOP';
}
