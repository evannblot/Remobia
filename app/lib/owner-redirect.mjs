/** A second exact Neon origin is permitted only for the same endpoint and region. */
export function neonRedirectOrigin(value, authOrigin) {
  if (typeof value !== 'string' || typeof authOrigin !== 'string') return null;
  try {
    const configured = new URL(authOrigin);
    const alternate = new URL(value);
    const host = /^(ep-[a-z0-9-]+)\.neonauth\.c-[0-9]+\.([a-z0-9-]+)\.aws\.neon\.tech$/;
    const source = configured.hostname.match(host);
    const target = alternate.hostname.match(host);
    if (configured.protocol !== 'https:' || configured.username || configured.password || configured.port ||
        alternate.protocol !== 'https:' || alternate.username || alternate.password || alternate.port ||
        alternate.pathname !== '/' || alternate.search || alternate.hash || !source || !target ||
        source[1] !== target[1] || source[2] !== target[2]) return null;
    return alternate.origin;
  } catch { return null; }
}

/** Accept only exact configured origins; never rewrite an OAuth URL or its state. */
export function ownerRedirect(value, authOrigin, alternateOrigin) {
  if (typeof value !== 'string' || value.length > 8192 || typeof authOrigin !== 'string') return null;
  try {
    const configured = new URL(authOrigin);
    const target = new URL(value);
    if (configured.protocol !== 'https:' || configured.username || configured.password ||
        target.protocol !== 'https:' || target.username || target.password) return null;
    const alternate = neonRedirectOrigin(alternateOrigin, authOrigin);
    const isNeonInit = alternate && target.origin === alternate && target.pathname === '/neondb/auth/sign-in/social/init';
    if (target.origin !== configured.origin && target.origin !== 'https://accounts.google.com' && !isNeonInit) return null;
    return target.href;
  } catch { return null; }
}
