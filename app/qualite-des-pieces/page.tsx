import type { Metadata } from "next";
import { ArrowDown, BatteryCharging, Camera, ChevronDown, Layers, Plug, Smartphone, Star, Volume2 } from "lucide-react";
import { CatalogFooter, CatalogHeader } from "../components/PhoneCatalog";
import PartsQuoteButton from "../components/PartsQuoteButton";
import { publicPageMetadata } from "../lib/site-config";
import "./parts-guide.css";

export const metadata: Metadata = publicPageMetadata(
  "/qualite-des-pieces",
  "Qualité des pièces : écrans, batteries et réparations — REMOBIA Laval",
  "LCD, OLED, pièces d’origine ou compatibles : comprenez les choix de réparation pour votre écran, batterie, caméra et connecteur avec les conseils REMOBIA à Laval.",
);

const chapters = [
  { id: "ecrans", label: "Écrans", Icon: Smartphone },
  { id: "batteries", label: "Batteries", Icon: BatteryCharging },
  { id: "charge", label: "Charge", Icon: Plug },
  { id: "cameras", label: "Caméras", Icon: Camera },
  { id: "audio", label: "Son & micro", Icon: Volume2 },
  { id: "chassis", label: "Vitre & châssis", Icon: Layers },
];

function Advice({ children }: { children: React.ReactNode }) {
  return <aside className="parts-advice"><p className="parts-advice-label">Notre conseil</p><p>{children}</p></aside>;
}

function Stars({ score }: { score: number }) {
  return <span className="parts-rating" role="img" aria-label={`Repère REMOBIA : ${score} étoile${score > 1 ? "s" : ""} sur 5`}>
    <span className="parts-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={17} className={value <= score ? "is-filled" : undefined} />)}</span>
    <span aria-hidden="true">{score}/5</span>
  </span>;
}

function PieceRatings({ originalLabel = "Origine adaptée" }: { originalLabel?: string }) {
  return <ul className="parts-type-ratings" aria-label="Repères de choix pour cette pièce">
    <li><strong>Compatible économique</strong><Stars score={1} /></li>
    <li><strong>Compatible sélectionnée</strong><Stars score={3} /></li>
    <li><strong>{originalLabel}</strong><Stars score={5} /></li>
  </ul>;
}

export default function PartsQualityPage() {
  return <div className="catalog-site parts-guide-site">
    <CatalogHeader activePage="parts" />
    <main id="contenu" className="parts-guide-main">
      <section className="container parts-hero" aria-labelledby="parts-title">
        <div>
          <p className="eyebrow">LE GUIDE DES PIÈCES · REMOBIA, LAVAL</p>
          <h1 id="parts-title">La bonne pièce.<br /><span>Pour votre usage.</span></h1>
          <p className="parts-hero-description">Écran, batterie, caméra… voici les différences à connaître et nos choix préférés, selon votre téléphone et votre budget.</p>
          <PartsQuoteButton label="Être conseillé pour ma réparation" />
        </div>
        <aside className="parts-start-note">
          <span className="parts-note-index" aria-hidden="true">01 / LE BON RÉFLEXE</span>
          <h2>Partir de votre téléphone.</h2>
          <p>La technologie d’origine et la référence exacte passent avant une étiquette « premium ». Les pièces disponibles, leurs limites et leur prix seront précisés dans la proposition.</p>
          <a href="#ecrans">Comprendre les écrans<ArrowDown size={18} aria-hidden="true" /></a>
        </aside>
      </section>

      <nav className="container parts-chapters" aria-label="Les pièces du guide">
        {chapters.map(({ id, label, Icon }) => <a key={id} href={`#${id}`}><Icon size={18} aria-hidden="true" />{label}</a>)}
      </nav>

      <div className="container parts-sections">
        <aside className="parts-rating-key" aria-labelledby="rating-key-title">
          <h2 id="rating-key-title">Des étoiles pour vous guider.</h2>
          <p><strong>1 :</strong> économique · <strong>2 :</strong> compromis · <strong>3 :</strong> équilibré · <strong>4 :</strong> proche de l’origine · <strong>5 :</strong> notre choix privilégié.</p>
          <p>Ce repère REMOBIA exprime une préférence, pas une certification. La note dépend de la référence, de la provenance, de l’état et des contrôles. Toute pièce doit être adaptée et traçable ; aucune gamme n’est disponible systématiquement.</p>
        </aside>
        <section id="ecrans" className="parts-section" aria-labelledby="screens-title">
          <div className="parts-section-heading"><span className="parts-section-number">01</span><h2 id="screens-title">Écrans.<br /><span>Comprendre ce que vous regardez.</span></h2></div>
          <div className="parts-section-body">
            <p><strong>LCD et OLED sont des technologies, pas des niveaux de qualité.</strong> Le LCD utilise un rétroéclairage ; chaque pixel OLED émet sa lumière, avec des noirs profonds lorsqu’il est éteint. AMOLED appartient à la famille OLED.</p>
            <div className="parts-screen-options">
              <article><span className="parts-card-kicker">ADAPTATION ÉCONOMIQUE</span><h3>LCD sur modèle OLED</h3><Stars score={1} /><p>Une alternative économique, avec des noirs moins profonds et un rendu différent. Cette étoile concerne la conversion sur OLED, pas tous les écrans LCD.</p></article>
              <article><span className="parts-card-kicker">COMPATIBLE</span><h3>OLED rigide</h3><Stars score={2} /><p>La dalle repose sur un support rigide. Elle conserve la technologie OLED, avec des compromis de construction et d’ajustement selon la référence.</p></article>
              <article><span className="parts-card-kicker">COMPATIBLE</span><h3>OLED souple</h3><Stars score={3} /><p>Son support flexible est souvent plus proche de la conception d’origine. La vitre extérieure reste rigide. Le résultat dépend de la référence.</p></article>
              <article><span className="parts-card-kicker">PIÈCE CONSTRUCTEUR</span><h3>Origine reconditionné</h3><Stars score={4} /><p>Un écran constructeur remis en état, parfois avec une vitre remplacée. Nous le privilégions si sa provenance, son état et ses fonctions sont vérifiés.</p></article>
              <article className="parts-screen-preferred"><span className="parts-card-kicker">PIÈCE CONSTRUCTEUR</span><h3>Origine neuf</h3><Stars score={5} /><p>Notre préférence pour rester proche des caractéristiques prévues par le constructeur, si la pièce et la procédure adaptée sont accessibles pour votre modèle.</p></article>
            </div>
            <div className="parts-provenance">
              <h3>Votre téléphone avait déjà un LCD ?</h3>
              <p>Un LCD adapté est alors le choix normal : un LCD constructeur neuf peut recevoir <strong>5 étoiles</strong>, un compatible sélectionné <strong>3 étoiles</strong>, selon la référence.</p>
              <p><strong>Compatible</strong> signifie fabriqué par un autre fournisseur. « Premium », « OEM » ou « AAA » ne prouvent ni une origine constructeur, ni des performances précises.</p>
            </div>
            <Advice>Si votre téléphone avait un OLED, nous privilégions une pièce d’origine identifiée et en bon état, ou un bon OLED souple compatible. Sur un appareil LCD, un LCD adapté convient. Une conversion LCD sur OLED peut répondre à un petit budget, à condition d’en connaître les différences.</Advice>
            <p className="parts-note">Luminosité, couleurs, tactile, fréquence d’affichage et fonctions comme True Tone peuvent varier. La technologie seule ne garantit ni 120 Hz, ni la même autonomie, ni toutes les fonctions d’origine.</p>
            <PartsQuoteButton initialIssue="screen" label="Choisir un écran pour mon téléphone" secondary />
          </div>
        </section>

        <section id="batteries" className="parts-section" aria-labelledby="battery-title">
          <div className="parts-section-heading"><span className="parts-section-number">02</span><h2 id="battery-title">Batteries.<br /><span>La fiabilité avant les chiffres.</span></h2></div>
          <div className="parts-section-body">
            <p>Une batterie perd de la capacité avec le temps. Il faut une pièce adaptée, de provenance connue et de capacité cohérente. Une capacité annoncée très supérieure à l’origine mérite vérification.</p>
            <PieceRatings originalLabel="Origine neuve adaptée" />
            <Advice>Nous privilégions une batterie neuve adaptée, d’origine ou compatible de provenance identifiée, plutôt qu’une batterie d’occasion déjà usée. L’autonomie dépend aussi de l’usage, des réglages et de l’état du téléphone.</Advice>
            <p>Selon le modèle et la procédure de réparation, un message de pièce non reconnue peut apparaître ou l’état de santé ne plus être affiché. Ces limites doivent être expliquées avant intervention.</p>
            <p className="parts-safety-note">Batterie gonflée, téléphone qui se déforme ou chauffe anormalement : cessez de l’utiliser et de le charger, puis demandez un diagnostic. Ne percez pas la batterie.</p>
          </div>
        </section>

        <section id="charge" className="parts-section" aria-labelledby="charge-title">
          <div className="parts-section-heading"><span className="parts-section-number">03</span><h2 id="charge-title">Charge & connecteur.<br /><span>Vérifier avant de remplacer.</span></h2></div>
          <div className="parts-section-body">
            <p>Une charge lente ou intermittente peut venir du câble, du chargeur, d’un connecteur encrassé, de la batterie ou d’un autre circuit. Le port n’est donc pas automatiquement la pièce à changer.</p>
            <PieceRatings />
            <Advice>D’abord un diagnostic, puis, si nécessaire, un module adapté au modèle. Charge rapide, transfert de données et accessoires compatibles dépendent de l’ensemble téléphone, pièce, câble et chargeur.</Advice>
          </div>
        </section>

        <section id="cameras" className="parts-section" aria-labelledby="camera-title">
          <div className="parts-section-heading"><span className="parts-section-number">04</span><h2 id="camera-title">Caméras.<br /><span>Préserver ce qui compte en photo.</span></h2></div>
          <div className="parts-section-body">
            <p>La petite vitre extérieure protège la caméra ; le module derrière capture l’image. Une rayure sur la vitre et une panne de mise au point ne demandent pas forcément le même remplacement.</p>
            <PieceRatings originalLabel="Module d’origine adapté" />
            <Advice>Si la photo est importante pour vous, nous privilégions un module d’origine identifié, selon disponibilité et état. Mise au point, stabilisation et calibrage doivent être vérifiés pour votre modèle.</Advice>
            <p>Une caméra compatible peut présenter des différences de rendu ou de fonctions. Remplacer une caméra ne rétablit pas automatiquement Face ID ou une autre reconnaissance biométrique.</p>
          </div>
        </section>

        <section id="audio" className="parts-section" aria-labelledby="audio-title">
          <div className="parts-section-heading"><span className="parts-section-number">05</span><h2 id="audio-title">Son & microphone.<br /><span>Retrouver des échanges clairs.</span></h2></div>
          <div className="parts-section-body">
            <p>Écouteur d’appel, haut-parleur et microphones ont des rôles différents. Un son faible peut aussi venir d’une grille obstruée ; un réglage ou un problème logiciel peut ressembler à une panne matérielle.</p>
            <PieceRatings />
            <Advice>Identifier le composant concerné avant de choisir une pièce adaptée. La compatibilité électrique et mécanique compte davantage qu’un nom de gamme. Appels, enregistrement et haut-parleur permettent de contrôler plusieurs usages.</Advice>
          </div>
        </section>

        <section id="chassis" className="parts-section" aria-labelledby="chassis-title">
          <div className="parts-section-heading"><span className="parts-section-number">06</span><h2 id="chassis-title">Vitre arrière & châssis.<br /><span>Un bon ajustement, au-delà du look.</span></h2></div>
          <div className="parts-section-body">
            <p>La vitre arrière et le châssis protègent et maintiennent les composants. Leur remplacement peut concerner l’ajustement, les antennes ou la recharge sans fil, selon la construction du téléphone.</p>
            <PieceRatings />
            <Advice>Choisir une pièce aux bonnes dimensions et vérifier les fonctions concernées. Une coque déformée mérite un diagnostic : remplacer seulement la vitre peut être insuffisant.</Advice>
            <p>Les adhésifs et joints participent à la protection, mais une réparation ne garantit pas le retour à l’étanchéité d’origine. Les conditions de garantie seront précisées avec la proposition.</p>
          </div>
        </section>

        <section className="parts-questions" aria-labelledby="parts-faq-title">
          <div><p className="eyebrow">AVANT DE CHOISIR</p><h2 id="parts-faq-title">Vos questions.</h2></div>
          <div className="parts-faq-list">
            <details><summary>Une pièce compatible est-elle forcément moins bonne ?<ChevronDown size={20} aria-hidden="true" /></summary><p>Non. Cela décrit sa provenance. Certaines pièces compatibles conviennent très bien ; d’autres ont des limites. La référence, le modèle et les fonctions attendues permettent de comparer.</p></details>
            <details><summary>Comment comparer les propositions ?<ChevronDown size={20} aria-hidden="true" /></summary><p>Regardez la référence de la pièce, sa provenance, les fonctions conservées et les limites annoncées. Le devis précise les options possibles pour votre modèle avant de décider.</p></details>
            <details><summary>Je ne sais pas quoi choisir. Comment faire ?<ChevronDown size={20} aria-hidden="true" /></summary><p>Indiquez votre appareil, ce que vous constatez et votre priorité : budget, qualité ou conseil. Ce guide donne des repères ; le choix précis se fait pour votre téléphone.</p></details>
          </div>
        </section>

        <section className="parts-end" aria-labelledby="parts-end-title"><div><p className="eyebrow">FAISONS LE POINT ENSEMBLE</p><h2 id="parts-end-title">Une pièce adaptée.<br />Un choix expliqué.</h2><p>Décrivez votre téléphone et vos attentes. Nous pourrons orienter votre demande vers la solution la plus pertinente.</p></div><PartsQuoteButton /></section>

        <div className="parts-sources"><details><summary>Les références de ce guide<ChevronDown size={18} aria-hidden="true" /></summary><p>Repères techniques : <a href="https://support.apple.com/fr-fr/103256">Apple — écrans</a>, <a href="https://support.apple.com/fr-fr/103269">Apple — batteries</a>, <a href="https://support.apple.com/fr-fr/103259">Apple — caméras</a>, <a href="https://fr.ifixit.com/Wiki/iPhone_Screen_Repair">iFixit — LCD et OLED</a>. Les remarques propres à Apple ne s’appliquent pas à tous les téléphones.</p></details></div>
      </div>
    </main>
    <CatalogFooter />
  </div>;
}
