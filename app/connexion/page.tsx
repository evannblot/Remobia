import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import OwnerLogin from "../components/OwnerLogin";
import { getOwnerAuth, getOwnerAuthOrigin, getOwnerIdentity, ownerMatches } from "../lib/admin-auth";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion propriétaire — REMOBIA", robots: { index: false, follow: false } };
export default async function OwnerLoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (ownerMatches(await getOwnerIdentity(), process.env.SITE_ADMIN_EMAIL)) redirect("/gestion/telephones");
  const authOrigin = getOwnerAuthOrigin();
  if (!getOwnerAuth() || !authOrigin) return <main className="container catalog-access"><h1>Connexion en cours de configuration.</h1><Link href="/">Revenir au site</Link></main>;
  return <OwnerLogin error={(await searchParams).erreur === "connexion"} />;
}
