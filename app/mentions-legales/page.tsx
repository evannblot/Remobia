import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { publicPageMetadata } from "../lib/site-config";

export const metadata = publicPageMetadata(
  "/mentions-legales",
  "Mentions légales — REMOBIA",
  "Informations sur REMOBIA, ses services de réparation, de vente et de reprise de téléphones à Laval, et l’hébergement du site.",
  { index: false },
);

export default function MentionsLegales() {
  return <main className="legal-page">
    <Link href="/" className="legal-back"><ArrowLeft size={17} aria-hidden="true" />Retour au site</Link>
    <p className="eyebrow">REMOBIA · INFORMATIONS DU SITE</p>
    <h1>À propos de REMOBIA.</h1>
    <div className="legal-notice"><p>Ce site présente REMOBIA : réparation, vente de téléphones et demandes d’estimation de reprise à Laval. Les formulaires de devis et d’informations sur un téléphone permettent d’envoyer une demande par email à REMOBIA.</p></div>
    <h2>Informations de l’activité</h2>
    <p>REMOBIA est joignable à <a href="mailto:remobia.laval@gmail.com">remobia.laval@gmail.com</a>. L’identité administrative de l’exploitant, son adresse professionnelle et ses informations d’immatriculation restent à compléter.</p>
    <h2>Services et devis</h2>
    <p>Le formulaire de devis transmet les informations sur votre appareil, les problèmes constatés et vos coordonnées à REMOBIA par email, via Resend. Il ne fournit pas de prix instantané et ne déclenche aucune intervention. Les possibilités de réparation, les pièces, le prix, le délai et les conditions de garantie seront précisés dans une proposition remise au client.</p>
    <h2>Téléphones à vendre</h2>
    <p>Les annonces indiquent les caractéristiques, l’état et le prix renseignés par le propriétaire pour chaque appareil. Une demande d’informations ne vaut ni réservation ni achat. La disponibilité, les conditions de remise et les conditions de vente seront confirmées avant toute transaction. Aucun paiement en ligne n’est proposé dans cette version.</p>
    <h2>Reprise</h2>
    <p>Le formulaire permet d’envoyer les caractéristiques, l’état et les photos d’un téléphone pour obtenir une estimation à distance. La demande est gratuite et sans engagement. Elle ne vaut ni acceptation de reprise ni vente. Un prix de reprise éventuel sera confirmé après vérification de l’appareil et accord entre les parties.</p>
    <h2>Photographies</h2>
    <p>Les emplacements de la page d’accueil seront remplacés par des photos fournies pour REMOBIA. Les annonces de vente peuvent afficher les photos des appareils ajoutées par le propriétaire.</p>
    <h2>Hébergement</h2>
    <p>Le site est hébergé sur Vercel. Les annonces et les demandes de reprise utilisent une base Neon ; les photos sont conservées dans Vercel Blob. La connexion à l’espace propriétaire est gérée par Neon Auth avec un code reçu par email. Resend assure l’envoi des demandes de contact et des notifications de reprise. Les informations administratives complètes de l’hébergeur et de l’exploitant restent à compléter.</p>
  </main>;
}
