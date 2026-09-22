// Protegge entrambe le app anche tramite l'indirizzo tecnico *.pages.dev.
// Configurare PRIVATE_ACCESS_PASSWORD e PRIVATE_SESSION_KEY come secrets Pages.
const ROOT = '/privato/';
const LOGIN = '/privato/entra';
const COOKIE = 'dan_private_session';
const DAYS = 30;
const MAX_AGE = DAYS * 24 * 60 * 60;
const encoder = new TextEncoder();

function page(title, body) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${title}</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111820;color:#f6f1e8;font:16px/1.5 system-ui,sans-serif;padding:24px}.card{width:min(100%,420px);background:#1d2933;border:1px solid #34424c;border-radius:18px;padding:32px;box-shadow:0 20px 60px #0005}h1{font-size:1.6rem;margin:0 0 8px}p{color:#bdcbd2;margin:0 0 24px}label{display:block;margin:0 0 8px}input{display:block;width:100%;font:inherit;padding:12px 14px;color:#fff;background:#111820;border:1px solid #71818c;border-radius:9px}button,.link{display:inline-block;padding:12px 18px;border:0;border-radius:9px;background:#dd8657;color:#161a1e;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}button{margin-top:18px}.error{color:#ffc7b4;margin:14px 0 0}.apps{display:grid;gap:12px}.apps a{display:block;padding:16px;border:1px solid #64717b;border-radius:10px;color:#fff;text-decoration:none}.apps a:hover,.apps a:focus-visible{border-color:#dd8657}small{display:block;color:#bdcbd2;font-weight:400}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #f5bc76;outline-offset:3px}
  </style></head><body><main class="card">${body}</main></body></html>`;
}

function htmlResponse(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...extra,
  }});
}

function safeNext(value) {
  return typeof value === 'string' && value.startsWith(ROOT) && !value.startsWith('//') && !value.startsWith(LOGIN)
    ? value : ROOT;
}

function loginPage(next, error = '') {
  const target = encodeURIComponent(safeNext(next));
  return page('Accesso privato · Dan On The Road', `<h1>Area privata</h1><p>Dan On The Road</p><form method="post" action="${LOGIN}?next=${target}"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Accedi</button>${error ? '<div class="error" role="alert">Password non corretta.</div>' : ''}</form>`);
}

function dashboard() {
  return page('Area privata · Dan On The Road', '<h1>Area privata</h1><p>Scegli l’app che vuoi aprire.</p><nav class="apps"><a href="/privato/split-with-dan/">Split With Dan<small>Viaggi e spese condivise</small></a><a href="/privato/onthecouch/">OnTheCouch<small>Film e serie TV</small></a></nav><p style="margin:24px 0 0"><a href="/privato/esci" style="color:#f5bc76">Esci</a></p>');
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function signature(payload, env) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.PRIVATE_SESSION_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const passwordDigest = await digest(env.PRIVATE_ACCESS_PASSWORD);
  const message = new Uint8Array(encoder.encode(payload).length + passwordDigest.length);
  message.set(encoder.encode(payload));
  message.set(passwordDigest, encoder.encode(payload).length);
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  return Array.from(signed, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function validSession(request, env) {
  const value = request.headers.get('Cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const match = /^v1\.(\d{10,11})\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const expiration = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiration <= now || expiration > now + MAX_AGE) return false;
  const expected = await signature(`v1.${expiration}`, env);
  return bytesEqual(encoder.encode(match[2]), encoder.encode(expected));
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname !== '/privato' && !url.pathname.startsWith(ROOT)) return next();

  if (!env.PRIVATE_ACCESS_PASSWORD || !env.PRIVATE_SESSION_KEY || env.PRIVATE_SESSION_KEY.length < 32) {
    return new Response('Area privata non configurata.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  if (url.pathname === '/privato') return Response.redirect(`${url.origin}${ROOT}`, 308);

  if (url.pathname === '/privato/esci') {
    return htmlResponse('', 303, { Location: LOGIN, 'Set-Cookie': `${COOKIE}=; Path=/privato; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
  }

  if (url.pathname === LOGIN) {
    const target = safeNext(url.searchParams.get('next'));
    if (request.method === 'GET') return htmlResponse(loginPage(target));
    if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405 });
    if (Number(request.headers.get('Content-Length') || 0) > 4096) return new Response('Richiesta troppo grande', { status: 413 });
    const form = await request.formData();
    const entered = form.get('password');
    const correct = typeof entered === 'string' && entered.length <= 256 && bytesEqual(await digest(entered), await digest(env.PRIVATE_ACCESS_PASSWORD));
    if (!correct) return htmlResponse(loginPage(target, 'wrong'), 401);
    const expiration = Math.floor(Date.now() / 1000) + MAX_AGE;
    const token = `v1.${expiration}.${await signature(`v1.${expiration}`, env)}`;
    return htmlResponse('', 303, { Location: target, 'Set-Cookie': `${COOKIE}=${token}; Path=/privato; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}` });
  }

  if (!await validSession(request, env)) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Accesso richiesto', { status: 401 });
    return Response.redirect(`${url.origin}${LOGIN}?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }

  if (url.pathname === ROOT) return htmlResponse(dashboard());
  if (url.pathname === '/privato/onthecouch' || url.pathname === '/privato/split-with-dan') {
    return Response.redirect(`${url.origin}${url.pathname}/`, 308);
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
