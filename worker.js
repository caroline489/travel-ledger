export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ledger') {
      // No login by design — anyone with the site URL can read/write this
      // one shared ledger. That's the trade-off for a zero-signup tool.
      if (request.method === 'GET') {
        const value = await env.LEDGER_KV.get('ledger-data');
        return new Response(value || '{}', {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
          }
        });
      }

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.text();
        // basic sanity check so a stray request can't wipe the KV value
        try {
          JSON.parse(body);
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        await env.LEDGER_KV.put('ledger-data', body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // Everything else is a static asset (index.html, sw.js, ...).
    // If it doesn't match a real file, fall back to index.html.
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
  }
};
