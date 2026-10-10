import { createNeonAuth } from "@neondatabase/auth/next/server";
import type { CatalogBindings } from "./catalog-server";
import { neonRedirectOrigin } from "./owner-redirect.mjs";

export function getOwnerAuthOrigin(): string | null {
  try {
    const url = new URL(process.env.NEON_AUTH_BASE_URL ?? "");
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

export function getOwnerAuthRedirectOrigin(): string | null {
  return neonRedirectOrigin(process.env.NEON_AUTH_REDIRECT_ORIGIN, getOwnerAuthOrigin());
}

export function getOwnerAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!getOwnerAuthOrigin() || !baseUrl || !secret || secret.length < 32) return null;
  // The SDK requires a positive TTL. Keep its signed cache very short.
  return createNeonAuth({ baseUrl, cookies: { secret, sessionDataTtl: 1 } });
}

export type OwnerIdentity = { userId: string; email: string; verified: boolean };

/** Identity is supplied by a verified provider session, never by browser headers. */
export async function getOwnerIdentity(): Promise<OwnerIdentity | null> {
  const auth = getOwnerAuth();
  if (!auth) return null;
  try {
    const { data, error } = await auth.getSession();
    if (error || !data?.user) return null;
    return { userId: data.user.id, email: data.user.email, verified: data.user.emailVerified === true };
  } catch { return null; }
}

export function ownerMatches(identity: OwnerIdentity | null, email: string | undefined): boolean {
  return !!identity?.verified && !!identity.userId && !!email?.trim() &&
    identity.email.trim().toLowerCase() === email.trim().toLowerCase();
}

export async function adminBindings(bindings: CatalogBindings): Promise<CatalogBindings> {
  if (process.env.VERCEL === undefined) return bindings;
  return { ...bindings, OWNER_AUTH_CONFIGURED: !!getOwnerAuth(), OWNER_IDENTITY: await getOwnerIdentity() };
}
