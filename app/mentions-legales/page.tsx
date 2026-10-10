import { ArrowLeft } from "lucide-react";
export default function MentionsLegales() {
  return <main className="legal-page">
    <a href="/" className="legal-back"><ArrowLeft size={17} aria-hidden="true" />Retour au site</a>
    <p className="eyebrow">REMOBIA · VERSION DE PRÉSENTATION</p>
    <h1>À propos de cette version.</h1>
    <div className="legal-notice"><p>Ce site présente le projet REMOBIA : réparation, vente de téléphones et demandes d’estimation de reprise à Laval. L’envoi des demandes de devis par email n’est pas encore ouvert.</p></div>
    <h2>Informations de l’activité</h2>
    <p>L’identité de l’exploitant, son adresse professionnelle, ses coordonnées et ses informations d’immatriculation seront ajoutées avant l’ouverture du site au public.</p>
    <h2>Services et devis</h2>
    <p>Le formulaire de présentation permet de préparer un récapitulatif personnel. Il ne fournit pas de prix instantané et ne déclenche aucune intervention. Les possibilités de réparation, les pièces, le prix, le délai et les conditions de garantie seront précisés dans une proposition remise au client.</p>
    <h2>Téléphones à vendre</h2>
    <p>Les annonces indiquent les caractéristiques, l’état et le prix renseignés par le propriétaire pour chaque appareil. Une demande d’informations ne vaut ni réservation ni achat. La disponibilité, les conditions de remise et les conditions de vente seront confirmées avant toute transaction. Aucun paiement en ligne n’est proposé dans cette version.</p>
    <h2>Reprise</h2>
    <p>Le formulaire permet d’envoyer les caractéristiques, l’état et les photos d’un téléphone pour obtenir une estimation à distance. La demande est gratuite et sans engagement. Elle ne vaut ni acceptation de reprise ni vente. Un prix de reprise éventuel sera confirmé après vérification de l’appareil et accord entre les parties.</p>
    <h2>Photographies</h2>
    <p>Les emplacements de la page d’accueil seront remplacés par des photos fournies pour REMOBIA. Les annonces de vente peuvent afficher les photos des appareils ajoutées par le propriétaire.</p>
    <h2>Hébergement</h2>
    <p>Cette version est hébergée avec Sites et reste privée pour la présentation du projet. Les informations complètes d’hébergement et les mentions de l’exploitant seront finalisées avant l’ouverture au public.</p>
  </main>;
}
