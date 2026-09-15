function checkAuth(request, env) {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const separatorIndex = decoded.indexOf(':');
  const password = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);
  return password === env.LEDGER_PASSWORD;
}

function authRequired() {
  return new Response('Password required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Travel Ledger"' }
  });
}

export default {
  async fetch(request, env) {
    // 密码保护整个站点，包括 API——不然光锁网页、API 还是能被直接读到
    if (!env.LEDGER_PASSWORD || !checkAuth(request, env)) {
      return authRequired();
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/ledger') {
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
