// Pure, bounded checks for HTTP crawler-readiness. No request is proof that
// Google has indexed or an AI assistant has cited a page.
export function attribute(tag,name){
 const text=String(tag||'');
 const match=text.match(new RegExp('(?:\\s|^)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));
 return match?(match[1]??match[2]??match[3]??''):null;
}
export function extractCanonical(html){
 const tags=String(html||'').match(/<link\b[^>]*>/gi)||[];
 for(const tag of tags){
  const rel=attribute(tag,'rel')||'';
  if(rel.toLowerCase().split(/\s+/).includes('canonical')){
   return attribute(tag,'href')?.replaceAll('&amp;','&')||null;
  }
 }
 return null;
}
export function hasNoindex(html,headers=null){
 const tags=String(html||'').match(/<meta\b[^>]*>/gi)||[];
 const htmlRobots=tags.some(tag=>{
  const name=(attribute(tag,'name')||'').toLowerCase();
  return ['robots','googlebot','bingbot'].includes(name)&&
   /(?:^|[\s,])noindex(?:[\s,]|$)/i.test(attribute(tag,'content')||'');
 });
 return htmlRobots||/(?:^|[\s,])noindex(?:[\s,]|$)/i.test(headers?.get?.('x-robots-tag')||'');
}
export function verifyCouponPage({url,status,html,headers,code}){
 const canonical=extractCanonical(html);
 let matches=false;
 try{matches=Boolean(canonical)&&new URL(canonical,url).href===new URL(url).href}catch{}
 const visible=String(html||'').includes(code);
 const noindex=hasNoindex(html,headers);
 return {ok:status===200&&matches&&!noindex&&visible,
  status,canonical,canonicalMatches:matches,visible,noindex};
}
export function isXmlSitemap({status,mime,body}){
 return status===200&&/xml/i.test(String(mime||''))&&
 /<(?:[A-Za-z0-9_-]+:)?(?:urlset|sitemapindex)\b/i.test(String(body||''))&&
 /<(?:[A-Za-z0-9_-]+:)?loc>/i.test(String(body||''));
}
