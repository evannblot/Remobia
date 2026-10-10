"use client";
import { useState } from "react";
import Link from "next/link";
import { createAuthClient } from "@neondatabase/auth/next";
import { CatalogFooter, CatalogHeader } from "./PhoneCatalog";

const authClient = createAuthClient();
export default function OwnerLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true); setError("");
    try {
      await authClient.signOut();
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/gestion/telephones" });
      if (result.error) throw new Error("Authentication unavailable");
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
