import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Confidentialite() {
  return <main className="legal-page">
    <Link href="/" className="legal-back"><ArrowLeft size={17} aria-hidden="true" />Retour au site</Link>
    <p className="eyebrow">REMOBIA · CONFIDENTIALITÉ</p>
    <h1>Vos informations, avec attention.</h1>
    <div className="legal-notice"><p>Les demandes de devis et d’informations sur un téléphone sont envoyées à REMOBIA par email. Les demandes de reprise et leurs photos sont enregistrées dans l’espace privé du responsable, avec une notification par email.</p></div>
    <h2>Les demandes de contact</h2>
    <p>Lorsque vous envoyez une demande de devis ou d’informations sur un téléphone, votre prénom, votre email, votre téléphone facultatif et les renseignements saisis sont transmis par Resend à <a href="mailto:remobia.laval@gmail.com">remobia.laval@gmail.com</a>. REMOBIA les utilise pour étudier votre demande et vous répondre. Ces formulaires n’enregistrent pas vos réponses dans la base de données du site ni dans le stockage local de votre navigateur ; les informations envoyées figurent dans les emails reçus par REMOBIA.</p>
    <p>Avant l’envoi, vos réponses restent dans le formulaire ouvert dans votre navigateur. Le contrôle de disponibilité de l’envoi ne transmet pas vos réponses. Lorsque l’envoi est indisponible, vous pouvez préparer un récapitulatif à télécharger ou à copier vous-même. Fermer le formulaire efface les réponses de cette session.</p>
    <h2>Les demandes d’estimation de reprise</h2>
    <p>Lorsque vous envoyez une demande de reprise, vos coordonnées, les informations sur l’état du téléphone et les photos sont enregistrées sur le serveur du site. Elles permettent à REMOBIA d’étudier votre appareil à distance et de vous répondre. Les photos et les demandes sont accessibles uniquement au propriétaire connecté dans son espace de gestion ; elles ne sont pas publiées dans le catalogue.</p>
    <p>Une notification contenant les informations de la demande est envoyée à REMOBIA via Resend. Les photos restent dans le stockage privé du site et sont consultables depuis l’espace propriétaire. Si la notification ne peut pas être envoyée, la demande enregistrée reste accessible dans cet espace.</p>
    <p>Vous pouvez choisir de ne pas envoyer le formulaire. Les fichiers sélectionnés restent alors dans la session du navigateur. Le responsable peut supprimer une demande et ses photos depuis son espace de gestion. La durée de conservation reste à préciser.</p>
    <h2>Les annonces de vente</h2>
    <p>Les caractéristiques, prix, descriptions et photos ajoutés par le propriétaire sont enregistrés sur le serveur du site. Les annonces publiées apparaissent dans le catalogue. Les brouillons et les téléphones marqués comme vendus restent accessibles uniquement dans l’espace de gestion.</p>
    <h2>La connexion propriétaire</h2>
    <p>L’espace de gestion est réservé au compte vérifié du propriétaire. La connexion est gérée par Neon Auth avec un code reçu par email. Des cookies de session permettent de maintenir cette connexion et de contrôler l’accès aux annonces privées et aux demandes de reprise.</p>
    <h2>Quelques bonnes habitudes</h2>
    <p>Les formulaires ne demandent aucun code de déverrouillage, mot de passe, identifiant de compte ni numéro de série. Décrivez uniquement votre besoin. Les photos doivent montrer l’appareil sans données personnelles visibles à l’écran.</p>
    <h2>Hébergement et notifications</h2>
    <p>Le site est hébergé sur Vercel. Les annonces et les demandes de reprise sont conservées dans une base Neon ; leurs photos sont conservées dans Vercel Blob. Les photos de reprise restent privées. Les photos des annonces sont affichées dans le catalogue uniquement lorsque l’annonce est publiée. Resend assure l’envoi des demandes de contact et des notifications de reprise à REMOBIA.</p>
    <p>Pour contacter REMOBIA au sujet de vos informations : <a href="mailto:remobia.laval@gmail.com">remobia.laval@gmail.com</a>. Les informations administratives du responsable et les modalités complètes de conservation restent à compléter.</p>
    <h2>Navigation</h2>
    <p>Le site n’intègre pas d’outil de publicité ni de mesure d’audience. Les pages de présentation et les annonces publiées sont consultables sans connexion ; l’espace de gestion nécessite la connexion du propriétaire.</p>
  </main>;
}
