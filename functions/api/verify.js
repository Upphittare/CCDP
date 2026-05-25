const FALLBACK_SECRET = 'melbourne-time-is-the-key-do-not-share-this-string-2026';

function timeToSeconds(hhmmss) {
  if (!/^\d{6}$/.test(hhmmss)) return null;
  const h = parseInt(hhmmss.slice(0, 2), 10);
  const m = parseInt(hhmmss.slice(2, 4), 10);
  const s = parseInt(hhmmss.slice(4, 6), 10);
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

function getMelbourneSecondsNow() {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = t => parseInt(parts.find(p => p.type === t).value, 10);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

async function signSession(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const sessionSecret = env.SESSION_SECRET || FALLBACK_SECRET;
  const tolerance = 10;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }

  const submitted = String(body.code || '').replace(/\D/g, '');
  const submittedSec = timeToSeconds(submitted);
  if (submittedSec === null) {
    return new Response(JSON.stringify({ error: 'bad format' }), { status: 400 });
  }

  const currentSec = getMelbourneSecondsNow();
  const rawDiff = Math.abs(submittedSec - currentSec);
  const diff = Math.min(rawDiff, 86400 - rawDiff);

  if (diff > tolerance) {
    return new Response(JSON.stringify({ error: 'out of sync', drift: diff }), { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 6;
  const payload = `v1.${exp}`;
  const sig = await signSession(payload, sessionSecret);
  const cookie = `${payload}.${sig}`;

  return new Response(JSON.stringify({ ok: true, drift: diff, usedFallback: !env.SESSION_SECRET }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `journal_pass=${cookie}; Path=/; Secure; SameSite=Lax; Max-Age=21600`
    }
  });
}
