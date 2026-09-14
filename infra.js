import app from './site.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (path === '/api/platform-health') {
      return new Response(JSON.stringify({
        ok: true,
        version: 'platform-v2',
        d1: Boolean(env.CONTROL_DB_V2),
        r2: Boolean(env.CONTENT_V2),
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
      });
    }
    return app.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (app.scheduled) return app.scheduled(event, env, ctx);
  }
};
