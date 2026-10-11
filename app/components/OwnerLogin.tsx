"use client";
import Link from "next/link";
import { CatalogFooter, CatalogHeader } from "./PhoneCatalog";

export default function OwnerLogin({ error = false }: { error?: boolean }) {
  return <div className="catalog-site"><CatalogHeader management /><main className="container catalog-access" id="contenu">
    <p className="eyebrow">ESPACE PROPRIÉTAIRE</p><h1>Bienvenue dans<br /><span>votre atelier.</span></h1>
    <p>Connectez-vous avec le compte Google de REMOBIA pour gérer vos annonces et consulter les demandes de reprise.</p>
    {error && <p role="alert">La connexion n’a pas pu démarrer. Réessayez dans un instant.</p>}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth needs a full HTTP navigation to preserve the redirect and response cookies. */}
    <a className="button button-primary" href="/api/auth/owner-login">Se connecter avec Google</a>
    <Link className="button manager-cancel" href="/">Revenir au site</Link>
  </main><CatalogFooter management /></div>;
}
