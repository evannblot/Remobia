import { ownerRedirect } from './owner-redirect.mjs';

/** Initiate OAuth through the server so navigation needs no popup or client script. */
export async function ownerLoginResponse(request, handler, authOrigin, alternateOrigin, timeoutMs = 15_000) {
  const origin = new URL(request.url).origin;
  const failure = () => new Response(null, { status: 303, headers: {
    Location: origin + '/connexion?erreur=connexion', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  } });
  let timer;
  try {
    const headers = new Headers({ 'Content-Type': 'application/json', Origin: origin });
    for (const key of ['cookie', 'user-agent']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    const post = new Request(origin + '/api/auth/sign-in/social', { method: 'POST', headers,
      body: JSON.stringify({ provider: 'google', callbackURL: origin + '/gestion/telephones', disableRedirect: true }) });
    const exchange = (async () => {
      const response = await handler(post);
      const data = await response.json();
      const approved = ownerRedirect(data?.url, authOrigin, alternateOrigin);
      if (!response.ok || data?.error || !approved) return failure();
      const target = new URL(approved);
      // A connected Neon branch can emit an obsolete cluster alias. Only its explicitly
      // declared init origin may use the canonical host from the branch's console.
      // The endpoint, path and opaque OAuth query remain intact.
      if (target.origin !== authOrigin && target.origin === alternateOrigin &&
          target.pathname === '/neondb/auth/sign-in/social/init') target.host = new URL(authOrigin).host;
      const redirectHeaders = new Headers({ Location: target.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      for (const cookie of response.headers.getSetCookie()) redirectHeaders.append('Set-Cookie', cookie);
      return new Response(null, { status: 303, headers: redirectHeaders });
    })();
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OAuth timeout')), timeoutMs); });
    return await Promise.race([exchange, deadline]);
  } catch { return failure(); }
  finally { clearTimeout(timer); }
}
