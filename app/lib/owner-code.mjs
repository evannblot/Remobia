import { isValidEmail } from './email-validation.mjs';

const MAX_BODY_BYTES = 1024;
const unavailable = 'Le service de connexion est temporairement indisponible. Réessayez dans quelques instants.';

function reply(body, status = 200, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers });
}

function safeRetryAfter(value) {
  if (!value) return null;
  if (/^\d{1,5}$/.test(value)) {
    const seconds = Number(value);
    return seconds <= 86400 ? String(seconds) : null;
  }
  // Keep only a bounded, canonical HTTP date; arbitrary provider text is private.
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return null;
  const date = Date.parse(value);
  const delta = date - Date.now();
  return Number.isFinite(date) && delta >= 0 && delta <= 86400_000 ? new Date(date).toUTCString() : null;
}

async function readInput(request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    return { error: reply({ error: 'La demande est trop volumineuse.' }, 413) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { error: reply({ error: 'La demande de connexion est invalide.' }, 400) };
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { error: reply({ error: 'La demande est trop volumineuse.' }, 413) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid input');
    const keys = Object.keys(input);
    if (input.action === 'send' && keys.length === 1) return { action: 'send' };
    if (input.action === 'verify' && keys.length === 2 && keys.includes('otp') &&
        typeof input.otp === 'string' && /^\d{6}$/.test(input.otp)) return { action: 'verify', otp: input.otp };
    throw new Error('Invalid input');
  } catch {
    return { error: reply({ error: 'La demande de connexion est invalide.' }, 400) };
  } finally { reader.releaseLock(); }
}

/** Only the server-selected owner can receive or redeem a managed Neon login code. */
export async function ownerCodeResponse(request, providerPost, configuredEmail, timeoutMs = 12_000) {
  if (request.method !== 'POST') return reply({ error: 'Utilisez le formulaire de connexion.' }, 405, { Allow: 'POST' });
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return reply({ error: 'Cette demande de connexion n’est pas autorisée.' }, 403);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    return reply({ error: 'La demande de connexion doit être au format JSON.' }, 415);
  }
  const email = typeof configuredEmail === 'string' ? configuredEmail.trim().toLowerCase() : '';
  if (!isValidEmail(email)) return reply({ error: 'La connexion propriétaire est en cours de configuration.' }, 503);
  const input = await readInput(request);
  if (input.error) return input.error;

  const path = input.action === 'send' ? ['email-otp', 'send-verification-otp'] : ['sign-in', 'email-otp'];
  const body = input.action === 'send' ? { email, type: 'sign-in' } : { email, otp: input.otp };
  const headers = new Headers({ 'Content-Type': 'application/json', Origin: origin });
  for (const key of ['cookie', 'user-agent']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const post = new Request(origin + '/api/auth/' + path.join('/'), {
    method: 'POST', headers, body: JSON.stringify(body), signal: request.signal,
  });
  let timer;
  try {
    const exchange = (async () => {
      const response = await providerPost(post, path);
      if (response.status === 429) {
        const retryAfter = safeRetryAfter(response.headers.get('retry-after'));
        return reply({ error: 'Trop de tentatives. Patientez avant de demander un nouveau code.' }, 429,
          retryAfter ? { 'Retry-After': retryAfter } : undefined);
      }
      if (!response.ok) {
        if (input.action === 'verify' && response.status === 403) {
          let rejected;
          try { rejected = await response.json(); } catch { /* Provider diagnostics remain private. */ }
          if (rejected?.code === 'TOO_MANY_ATTEMPTS' || rejected?.error?.code === 'TOO_MANY_ATTEMPTS') {
            return reply({ error: 'Ce code a été bloqué après trop de tentatives. Demandez un nouveau code.' }, 403);
          }
        }
        return input.action === 'verify' && [400, 401, 403].includes(response.status)
          ? reply({ error: 'Ce code est incorrect ou a expiré. Réessayez ou demandez un nouveau code.' }, 400)
          : reply({ error: unavailable }, 503);
      }
      const data = await response.json();
      if (input.action === 'send') {
        if (data?.success !== true) return reply({ error: unavailable }, 503);
      } else {
        const user = data?.user;
        if (!user || user.emailVerified !== true || typeof user.id !== 'string' || !user.id.trim() ||
            typeof user.email !== 'string' || user.email.trim().toLowerCase() !== email) {
          return reply({ error: 'Cette connexion ne donne pas accès à l’espace propriétaire.' }, 403);
        }
      }
      // The SDK creates and signs the session cookies. Never forward its token or user JSON.
      const cookies = response.headers.getSetCookie();
      if (input.action === 'verify' && !cookies.some(cookie => {
        const [pair, ...attributes] = cookie.split(';');
        if (!/^(?:__Secure-)?neon-auth\.session_token=[^;\s]+$/.test(pair.trim()) || pair.endsWith('=""')) return false;
        return !attributes.some(attribute => /^\s*max-age\s*=\s*(?:0|-[0-9]+)\s*$/i.test(attribute));
      })) return reply({ error: unavailable }, 503);
      const acceptedHeaders = new Headers();
      for (const cookie of cookies) acceptedHeaders.append('Set-Cookie', cookie);
      return reply({ ok: true }, 200, acceptedHeaders);
    })();
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
    });
    return await Promise.race([exchange, deadline]);
  } catch { return reply({ error: unavailable }, 503); }
  finally { clearTimeout(timer); }
}
