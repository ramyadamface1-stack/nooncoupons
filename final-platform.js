import app from './visual-platform.js';

const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function stateViaApp(origin,env,ctx){
  const r=await app.fetch(new Request(origin+'/api/state',{headers:{accept:'application/json'}}),env,ctx);
  if(!r.ok)return {articles:[]};
  try{return await r.json()}catch{return {articles:[]}}
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/api/visual-health'){
      const s=await stateViaApp(u.origin,env,ctx);
      const published=(s.articles||[]).filter(a=>a.status==='published');
      return json({
        ok:true,
        svgEngine:true,
        visualsPerArticle:5,
        publishedArticles:published.length,
        expectedSvgAssets:published.length*5,
        markets:[...new Set(published.map(a=>a.country))],
        cache:'Cloudflare Cache API + immutable browser cache',
        clickTarget:'https://www.noon.com/',
        templateText:{discount:'10% OFF',audience:'SAVE 10% • NEW & EXISTING USERS'},
        time:new Date().toISOString()
      });
    }
    if(u.pathname.startsWith('/assets/coupon-svg/')&&req.method==='GET'){
      const cache=caches.default;
      const cached=await cache.match(req);
      if(cached)return cached;
      const res=await app.fetch(req,env,ctx);
      if(res.ok)ctx.waitUntil(cache.put(req,res.clone()));
      return res;
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
