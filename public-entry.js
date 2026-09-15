import app from './premium-entry.js';
export {ControlPlane,GeneratorControl} from './premium-entry.js';

function cleanPublicQa(html,path){
  let out=String(html||'');
  if(path.startsWith('/articles/')){
    out=out.replace(/<div class="quality-meta">[\s\S]*?<\/div>/gi,'');
  }
  if(path==='/blog'){
    out=out.replace(/<div class="meta">\s*Quality\s+[\s\S]*?<\/div>/gi,'');
  }
  return out;
}

async function publicView(req,res){
  const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'')||'/';
  if(req.method!=='GET'||!(path.startsWith('/articles/')||path==='/blog'))return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!res.ok||!type.includes('text/html'))return res;
  const html=cleanPublicQa(await res.text(),path);
  const h=new Headers(res.headers);
  h.delete('content-length');
  h.set('x-public-quality-ui','hidden-v1');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){return publicView(req,await app.fetch(req,env,ctx))},
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const PUBLIC_ENTRY_INFO={version:1,internalQualityVisible:false,adminQualityPreserved:true};
