import type { Metadata } from "next";
import Link from "next/link";
import { env } from "cloudflare:workers";
import { chatGPTSignOutPath, isVercelDeployment, requireChatGPTUser } from "../../chatgpt-auth";
import TradeInManager from "../../components/TradeInManager";
import { CatalogFooter, CatalogHeader } from "../../components/PhoneCatalog";

export const metadata: Metadata = { title: "Demandes de reprise — REMOBIA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ManageTradeInsPage() {
  if (isVercelDeployment()) {
    return <div className="catalog-site"><CatalogHeader management /><main className="container catalog-access" id="contenu"><p className="eyebrow">ESPACE DE GESTION</p><h1>Gestion en cours<br /><span>de configuration.</span></h1><p>L’espace propriétaire doit être sécurisé sur ce nouvel hébergement avant de pouvoir consulter les demandes de reprise et leurs photos.</p><Link className="button button-primary" href="/">Revenir au site</Link></main><CatalogFooter management /></div>;
  }
  const user = await requireChatGPTUser("/gestion/reprises");
  const adminEmail = typeof env.SITE_ADMIN_EMAIL === "string" ? env.SITE_ADMIN_EMAIL.trim().toLowerCase() : "";
  if (!adminEmail || user.email.trim().toLowerCase() !== adminEmail) {
    return <div className="catalog-site"><CatalogHeader management /><main className="container catalog-access" id="contenu"><p className="eyebrow">ESPACE DE GESTION</p><h1>Cet espace est réservé<br /><span>au propriétaire.</span></h1><p>{adminEmail ? "Le compte connecté n’a pas accès aux demandes de reprise. Reconnectez-vous avec le compte du propriétaire pour les consulter." : "L’accès aux demandes de reprise sera activé avec le compte du propriétaire."}</p>{adminEmail && <a className="button button-primary" href={chatGPTSignOutPath("/gestion/reprises")} target="_top">Changer de compte</a>}<Link className={`button ${adminEmail ? "manager-cancel" : "button-primary"}`} href="/">Revenir au site</Link></main><CatalogFooter management /></div>;
  }
  return <TradeInManager />;
}
