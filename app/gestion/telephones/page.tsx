import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { chatGPTSignOutPath, requireChatGPTUser } from "../../chatgpt-auth";
import PhoneManager from "../../components/PhoneManager";
import { CatalogFooter, CatalogHeader } from "../../components/PhoneCatalog";

export const metadata: Metadata = { title: "Gérer les téléphones — REMOBIA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ManagePhonesPage() {
  const user = await requireChatGPTUser("/gestion/telephones");
  const adminEmail = typeof env.SITE_ADMIN_EMAIL === "string" ? env.SITE_ADMIN_EMAIL.trim().toLowerCase() : "";
  if (!adminEmail || user.email.trim().toLowerCase() !== adminEmail) {
    return <div className="catalog-site"><CatalogHeader management /><main className="container catalog-access" id="contenu"><p className="eyebrow">ESPACE DE GESTION</p><h1>Cet espace est réservé<br /><span>au propriétaire.</span></h1><p>{adminEmail ? "Le compte connecté n’a pas accès à la gestion des annonces. Vous pouvez vous reconnecter avec le compte du propriétaire." : "L’accès à la gestion sera activé avec le compte du propriétaire."}</p>{adminEmail && <a className="button button-primary" href={chatGPTSignOutPath("/gestion/telephones")} target="_top">Changer de compte</a>}<a className={`button ${adminEmail ? "manager-cancel" : "button-primary"}`} href="/telephones">Revenir aux téléphones</a></main><CatalogFooter management /></div>;
  }
  return <PhoneManager />;
}
