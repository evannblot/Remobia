"use client";
import { useState } from "react";
import Link from "next/link";
import { fetchClientJson } from "../lib/client-requests";
import { ownerRedirect } from "../lib/owner-redirect.mjs";
import { CatalogFooter, CatalogHeader } from "./PhoneCatalog";

export default function OwnerLogin({ authOrigin, authRedirectOrigin }: { authOrigin: string; authRedirectOrigin?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true); setError("");
    try {
      const previous = await fetchClientJson<{ error?: unknown }>("/api/auth/sign-out", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!previous.response.ok || previous.data?.error) throw new Error("Sign out failed");
      const result = await fetchClientJson<{ url?: unknown; error?: unknown }>("/api/auth/sign-in/social", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: new URL("/gestion/telephones", window.location.origin).href, disableRedirect: true }),
      });
      const target = ownerRedirect(result.data?.url, authOrigin, authRedirectOrigin);
      if (!result.response.ok || result.data?.error || !target) throw new Error("Authentication unavailable");
      window.location.assign(target);
    } catch { setError("La connexion n’a pas pu démarrer. Réessayez dans un instant."); setBusy(false); }
  }
  return <div className="catalog-site"><CatalogHeader management /><main className="container catalog-access" id="contenu">
    <p className="eyebrow">ESPACE PROPRIÉTAIRE</p><h1>Bienvenue dans<br /><span>votre atelier.</span></h1>
    <p>Connectez-vous avec le compte Google de REMOBIA pour gérer vos annonces et consulter les demandes de reprise.</p>
    {error && <p role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy} onClick={signIn}>{busy ? "Connexion…" : "Se connecter avec Google"}</button>
    <Link className="button manager-cancel" href="/">Revenir au site</Link>
  </main><CatalogFooter management /></div>;
}
