import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { publicPageMetadata } from "../lib/site-config";

export const metadata = publicPageMetadata(
  "/confidentialite",
  "Confidentialité et données personnelles — REMOBIA",
  "Comment REMOBIA utilise vos informations pour les demandes de devis, de reprise et de renseignements sur les téléphones.",
  { index: false },
);

export default function Confidentialite() {
  return <main className="legal-page">
    <Link href="/" className="legal-back"><ArrowLeft size={17} aria-hidden="true" />Retour au site</Link>
    <p className="eyebrow">REMOBIA · CONFIDENTIALITÉ</p>
    <h1>Vos informations, avec attention.</h1>
    <div className="legal-notice"><p>Les demandes de devis et d’informations sur un téléphone sont envoyées à REMOBIA par email. Les demandes de reprise et leurs photos sont enregistrées dans l’espace privé du responsable, avec une notification par email.</p></div>
    <h2>Qui s’occupe de vos informations ?</h2>
    <p>L’exploitant de REMOBIA traite vos demandes. Vous pouvez le contacter à <a href="mailto:remobia.laval@gmail.com">remobia.laval@gmail.com</a>. Son identité administrative complète et son adresse restent à compléter dans les <Link href="/mentions-legales">mentions légales</Link>.</p>
    <h2>Pourquoi ces informations sont-elles utilisées ?</h2>
    <p>Elles servent à étudier votre besoin de réparation, à préparer une estimation de reprise ou à répondre à vos questions sur un téléphone en vente. Ces échanges préparent une éventuelle prestation ou vente à votre demande : leur base légale est l’exécution de mesures précontractuelles, prévue par l’article 6, paragraphe 1 b du RGPD. L’envoi d’un formulaire ne conclut aucun contrat et ne vous inscrit à aucune newsletter.</p>
    <h2>Les informations nécessaires et facultatives</h2>
    <p>Votre nom ou prénom et votre email sont nécessaires pour vous répondre. Le devis demande aussi la marque, le modèle ou l’indication « je ne sais pas », les problèmes rencontrés et leur description. La reprise demande la marque, le modèle, l’état, les réponses sur le fonctionnement et le verrouillage de l’appareil, ainsi qu’une photo de l’avant et une de l’arrière. Une description est nécessaire si vous signalez un problème.</p>
    <p>Votre numéro de téléphone est facultatif. Pour la reprise, la capacité, la couleur, l’état de la batterie, les réparations précédentes, les accessoires et les photos supplémentaires peuvent rester non renseignés. Le message accompagnant une demande sur une annonce est également facultatif. Les champs nécessaires sont signalés dans chaque formulaire ; sans eux, la demande ne peut pas être envoyée ou étudiée.</p>
    <h2>L’envoi et l’accès à vos demandes</h2>
    <p>Les demandes de devis et d’informations sur une annonce sont transmises à REMOBIA par Resend et reçues dans sa boîte Gmail. Elles comprennent vos coordonnées et les renseignements saisis. Ces formulaires n’enregistrent pas vos réponses dans la base de données du site ni dans le stockage local de votre navigateur.</p>
    <p>Les demandes de reprise sont enregistrées dans la base Neon, et leurs photos dans le stockage privé Vercel Blob. Dans l’espace de gestion, seul le propriétaire connecté peut les consulter. Elles ne sont pas publiées dans le catalogue. Resend envoie une notification à REMOBIA ; les photos restent consultables depuis l’espace privé. Une notification indisponible n’efface pas la demande enregistrée.</p>
    <p>Les destinataires sont l’exploitant de REMOBIA et les prestataires nécessaires au fonctionnement du service : Vercel pour l’hébergement et les photos, Neon pour la base et la connexion propriétaire, Resend pour l’envoi et Google Gmail pour la réception des emails. Certains traitements ont lieu hors de l’Union européenne, notamment aux États-Unis chez Resend. Les garanties contractuelles applicables à ces transferts restent à documenter.</p>
    <h2>Avant l’envoi et après</h2>
    <p>Avant l’envoi, les réponses et les fichiers sélectionnés restent dans la session du formulaire ouvert dans votre navigateur. Le contrôle de disponibilité ne transmet pas ces réponses. Si l’envoi d’un devis ou d’une demande sur une annonce est indisponible, vous pouvez préparer un récapitulatif à télécharger ou à copier vous-même.</p>
    <p>Les durées de conservation des demandes, des photos et des emails restent à définir. Aucune suppression automatique selon leur ancienneté n’est actuellement mise en place. Le propriétaire peut supprimer une demande de reprise et ses photos depuis son espace de gestion ; les emails correspondants doivent être supprimés séparément de sa messagerie.</p>
    <h2>Vos droits</h2>
    <p>Vous pouvez demander l’accès à vos informations, leur rectification, leur effacement ou la limitation de leur utilisation, et exercer votre droit à la portabilité lorsqu’il s’applique. Pour toute demande ou question, écrivez à <a href="mailto:remobia.laval@gmail.com">remobia.laval@gmail.com</a>. Certaines informations peuvent devoir être conservées pour respecter une obligation légale ou traiter un litige.</p>
    <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une <a href="https://www.cnil.fr/fr/plaintes">réclamation à la CNIL</a>.</p>
    <h2>Les annonces de vente</h2>
    <p>Les caractéristiques, prix, descriptions et photos ajoutés par le propriétaire sont enregistrés sur le serveur du site. Les annonces publiées apparaissent dans le catalogue. Les brouillons et les téléphones marqués comme vendus restent accessibles uniquement dans l’espace de gestion.</p>
    <h2>La connexion propriétaire</h2>
    <p>L’espace de gestion est réservé au compte vérifié du propriétaire. La connexion est gérée par Neon Auth avec un code reçu par email. Des cookies de session permettent de maintenir cette connexion et de contrôler l’accès aux annonces privées et aux demandes de reprise.</p>
    <h2>Quelques bonnes habitudes</h2>
    <p>Les formulaires ne demandent aucun code de déverrouillage, mot de passe, identifiant de compte ni numéro de série. Décrivez uniquement votre besoin. Les photos doivent montrer l’appareil sans données personnelles visibles à l’écran.</p>
    <h2>Navigation et cookies</h2>
    <p>Le site n’intègre pas d’outil de publicité ni de mesure d’audience. Les pages publiques se consultent sans connexion. Les cookies nécessaires à la connexion propriétaire maintiennent la session et sécurisent l’accès à l’espace privé ; ils sont exemptés de consentement préalable. Aucun cookie publicitaire n’est utilisé.</p>
  </main>;
}
