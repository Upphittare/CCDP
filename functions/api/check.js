const FALLBACK_SECRET = 'melbourne-time-is-the-key-do-not-share-this-string-2026';

async function verifySession(cookie, secret) {
  if (!cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [version, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;

  const payload = `${version}.${expStr}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return expectedB64 === sig;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/journal_pass=([^;]+)/);
  const cookie = match ? match[1] : null;

  const sessionSecret = env.SESSION_SECRET || FALLBACK_SECRET;
  const valid = await verifySession(cookie, sessionSecret);

  return new Response(JSON.stringify({ valid }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
