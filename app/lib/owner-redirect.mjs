/** Accept only the configured auth service or Google's own OAuth origin. */
export function ownerRedirect(value, authOrigin) {
  if (typeof value !== 'string' || value.length > 8192 || typeof authOrigin !== 'string') return null;
  try {
    const configured = new URL(authOrigin);
    const target = new URL(value);
    if (configured.protocol !== 'https:' || configured.username || configured.password ||
        target.protocol !== 'https:' || target.username || target.password) return null;
    if (target.origin !== configured.origin && target.origin !== 'https://accounts.google.com') return null;
    return target.href;
  } catch { return null; }
}
