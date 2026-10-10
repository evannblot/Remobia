import { ArrowLeft } from "lucide-react";

export default function Confidentialite() {
  return <main className="legal-page">
    <a href="/" className="legal-back"><ArrowLeft size={17} aria-hidden="true" />Retour au site</a>
    <p className="eyebrow">REMOBIA · VERSION DE PRÉSENTATION</p>
    <h1>Vos informations, avec attention.</h1>
    <div className="legal-notice"><p>Le service est en préparation. L’envoi des demandes par email n’est pas encore activé. Cette page décrit le fonctionnement actuel de la présentation.</p></div>
    <h2>Les demandes de contact</h2>
    <p>Les réponses aux formulaires de devis et d’intérêt pour un téléphone restent dans le formulaire ouvert dans votre navigateur lorsque l’envoi n’est pas activé. Elles ne sont pas enregistrées dans une base de données ni dans le stockage local du navigateur. Le contrôle de disponibilité de l’envoi ne transmet pas vos réponses.</p>
    <p>Lorsque vous préparez votre demande, vous pouvez en télécharger une copie sur votre appareil ou la copier vous-même. Fermer le formulaire efface les réponses de cette session.</p>
    <h2>Les demandes d’estimation de reprise</h2>
    <p>Lorsque vous envoyez une demande de reprise, vos coordonnées, les informations sur l’état du téléphone et les photos sont enregistrées sur le serveur du site. Elles permettent à REMOBIA d’étudier votre appareil à distance et de vous répondre. Les photos et les demandes sont accessibles uniquement au propriétaire connecté dans son espace de gestion ; elles ne sont pas publiées dans le catalogue.</p>
    <p>Vous pouvez choisir de ne pas envoyer le formulaire. Les fichiers sélectionnés restent alors dans la session du navigateur. Le responsable peut supprimer une demande et ses photos depuis son espace de gestion. Les modalités de contact et la durée de conservation seront précisées avant l’ouverture du site au public.</p>
    <h2>Les annonces de vente</h2>
    <p>Les caractéristiques, prix, descriptions et photos ajoutés par le propriétaire sont enregistrés sur le serveur du site. Les annonces publiées apparaissent dans le catalogue. Les brouillons et les téléphones marqués comme vendus restent accessibles uniquement dans l’espace de gestion. Cet espace est réservé au compte du propriétaire connecté avec ChatGPT.</p>
    <h2>Quand l’envoi sera activé</h2>
    <p>Votre prénom, votre email, votre téléphone facultatif et les informations sur votre appareil ou le téléphone qui vous intéresse serviront à étudier votre demande et à vous répondre. Les coordonnées du responsable, le prestataire d’envoi, les durées de conservation et les modalités d’exercice de vos droits seront précisés ici avant l’ouverture au public.</p>
    <h2>Quelques bonnes habitudes</h2>
    <p>Les formulaires ne demandent aucun code de déverrouillage, mot de passe, identifiant de compte ni numéro de série. Décrivez uniquement votre besoin. Les photos doivent montrer l’appareil sans données personnelles visibles à l’écran.</p>
    <h2>Navigation</h2>
    <p>Le site n’intègre pas d’outil de publicité ni de mesure d’audience. L’accès à la version privée est géré par la plateforme d’hébergement.</p>
  </main>;
}
