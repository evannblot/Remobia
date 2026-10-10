import type { Metadata } from "next";
import { ArrowLeft, Camera, MessageCircle, Smartphone } from "lucide-react";
import { CatalogFooter, CatalogHeader } from "../components/PhoneCatalog";
import TradeInForm from "../components/TradeInForm";
import "../components/trade-in.css";

export const metadata: Metadata = {
  title: "Estimation de reprise à distance — REMOBIA, Laval",
  description: "Vous souhaitez vendre votre téléphone ? Envoyez ses caractéristiques, son état et des photos à REMOBIA pour une estimation gratuite à distance.",
};

export default function TradeInPage() {
  return <div className="trade-in-site"><CatalogHeader activePage="trade-in" /><main id="contenu" className="ti-main"><section className="ti-intro"><a className="catalog-back" href="/"><ArrowLeft size={15} aria-hidden="true" />Retour à l’accueil</a><p className="eyebrow">VOUS SOUHAITEZ VENDRE VOTRE TÉLÉPHONE ?</p><h1>Estimez votre téléphone<br /><span>à distance.</span></h1><p>Décrivez votre appareil et ajoutez des photos. REMOBIA étudiera votre demande et vous recontactera avec une estimation, ou pour quelques précisions.</p><div className="ti-benefits"><span><Smartphone size={17} aria-hidden="true" />Toutes les marques</span><span><Camera size={17} aria-hidden="true" />Photos avant et arrière</span><span><MessageCircle size={17} aria-hidden="true" />Gratuit et sans engagement</span></div></section><TradeInForm /></main><CatalogFooter /></div>;
}
