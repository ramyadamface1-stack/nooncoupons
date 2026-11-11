// Strict provider HTTP outcome classification. Only confirmed quota 429
// permits a different free credential within the bounded request budget.
// Timeout/5xx responses may already have consumed quota or produced content.
export function providerOutcomeAction({ok=false,http=null}={}){
 if(ok===true)return 'ACCEPT';
 if(http===429)return 'NEXT_FREE_KEY';
 if(Number.isInteger(http)&&http>=500&&http<=599)return 'QUARANTINE_UNKNOWN';
 return 'STOP';
}
