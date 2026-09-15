async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function expectedCookieValue(env) {
  return sha256Hex(env.LEDGER_PASSWORD + '|travel-ledger-auth');
}

async function isAuthed(request, env) {
  if (!env.LEDGER_PASSWORD) return false;
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)trip_auth=([a-f0-9]+)/);
  if (!match) return false;
  const expected = await expectedCookieValue(env);
  return match[1] === expected;
}

function loginPageHtml(showError) {
  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>密码</title>
<style>
  body{
    font-family:-apple-system,BlinkMacSystemFont,'PingFang TC','Segoe UI',sans-serif;
    background:#F7F2E7; color:#2A2420;
    display:flex; align-items:center; justify-content:center;
    min-height:100vh; margin:0; padding:20px;
  }
  form{ max-width:280px; width:100%; text-align:center; }
  h1{ font-size:19px; margin:0 0 18px; color:#1E3E39; font-weight:700; }
  input{
    width:100%; padding:13px 14px; border:1px solid #DCD2BE; border-radius:9px;
    font-size:16px; margin-bottom:12px; box-sizing:border-box; background:#FCFAF3;
  }
  input:focus{ outline:none; border-color:#2E5750; }
  button{
    width:100%; padding:13px; border:none; border-radius:9px;
    background:#2E5750; color:#fff; font-size:15px; font-weight:600; cursor:pointer;
  }
  button:active{ background:#1E3E39; }
  .err{ color:#A64B3F; font-size:13px; margin-bottom:12px; }
</style>
</head>
<body>
  <form method="POST" action="/login">
    <h1>请输入密码</h1>
    ${showError ? '<div class="err">密码不对，再试一次</div>' : ''}
    <input type="password" name="password" placeholder="密码" autofocus autocomplete="current-password">
    <button type="submit">进入</button>
  </form>
</body>
</html>`;
}

function loginResponse(showError) {
  return new Response(loginPageHtml(showError), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/login' && request.method === 'POST') {
      const form = await request.formData();
      const password = (form.get('password') || '').toString();
      if (env.LEDGER_PASSWORD && password === env.LEDGER_PASSWORD) {
        const value = await expectedCookieValue(env);
        const headers = new Headers({ Location: '/' });
        headers.append('Set-Cookie', `trip_auth=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/`);
        return new Response(null, { status: 302, headers });
      }
      return loginResponse(true);
    }

    if (!(await isAuthed(request, env))) {
      if (url.pathname === '/api/ledger') {
        return new Response('Unauthorized', { status: 401 });
      }
      return loginResponse(false);
    }

    if (url.pathname === '/api/ledger') {
      if (request.method === 'GET') {
        const value = await env.LEDGER_KV.get('ledger-data');
        return new Response(value || '{}', {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
        });
      }
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.text();
        try { JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }
        await env.LEDGER_KV.put('ledger-data', body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }
      return new Response('Method not allowed', { status: 405 });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
  }
};
