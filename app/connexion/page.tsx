import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OwnerLogin from "../components/OwnerLogin";
import { getOwnerAuth, getOwnerIdentity, ownerMatches } from "../lib/admin-auth";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion propriétaire — REMOBIA", robots: { index: false, follow: false } };
export default async function OwnerLoginPage() {
  if (ownerMatches(await getOwnerIdentity(), process.env.SITE_ADMIN_EMAIL)) redirect("/gestion/telephones");
  if (!getOwnerAuth()) return <main className="container catalog-access"><h1>Connexion en cours de configuration.</h1><a href="/">Revenir au site</a></main>;
  return <OwnerLogin />;
}
