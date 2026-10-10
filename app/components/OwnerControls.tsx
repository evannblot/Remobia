"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAuthClient } from "@neondatabase/auth/next";
const authClient = createAuthClient();
export default function OwnerControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.replace("/connexion");
      router.refresh();
    } catch { setError("La déconnexion a échoué. Réessayez."); setBusy(false); }
  }
  return <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
    <Link className="quiet-link" href="/gestion/telephones">Mes annonces</Link><Link className="quiet-link" href="/gestion/reprises">Demandes de reprise</Link>
    <button className="quiet-link" type="button" disabled={busy} onClick={signOut}>{busy ? "Déconnexion…" : "Me déconnecter"}</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
