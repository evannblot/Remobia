import type { Metadata } from "next";
import { ArrowDown, BatteryCharging, ChevronDown, Smartphone, Star } from "lucide-react";
import { CatalogFooter, CatalogHeader } from "../components/PhoneCatalog";
import PartsQuoteButton from "../components/PartsQuoteButton";
import { publicPageMetadata } from "../lib/site-config";
import "./parts-guide.css";

export const metadata: Metadata = publicPageMetadata(
  "/qualite-des-pieces",
  "Écrans et batteries : comprendre les qualités — REMOBIA Laval",
  "Écran d’origine, Soft OLED, Hard OLED, LCD et batteries : comparez les options avec les étoiles et les conseils REMOBIA à Laval, sans tarifs affichés.",
);

const chapters = [
  { id: "ecrans", label: "Écrans", Icon: Smartphone },
  { id: "batteries", label: "Batteries", Icon: BatteryCharging },
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

export default function PartsQualityPage() {
  return <div className="catalog-site parts-guide-site">
    <CatalogHeader activePage="parts" />
    <main id="contenu" className="parts-guide-main">
      <section className="container parts-hero" aria-labelledby="parts-title">
        <div>
          <p className="eyebrow">LE GUIDE DES PIÈCES · REMOBIA, LAVAL</p>
          <h1 id="parts-title">La bonne pièce.<br /><span>Pour votre usage.</span></h1>
          <p className="parts-hero-description">Écrans et batteries : des explications simples pour comparer les options et choisir celle qui vous convient. Nos conseils, selon votre téléphone et votre budget.</p>
          <PartsQuoteButton label="Être conseillé pour ma réparation" />
        </div>
        <aside className="parts-start-note">
          <span className="parts-note-index" aria-hidden="true">01 / LE BON RÉFLEXE</span>
          <h2>Partir de votre téléphone.</h2>
          <p>Le bon choix dépend du modèle et de sa technologie d’origine. Les étoiles vous donnent un repère ; nous précisons la référence et les fonctions conservées avant la réparation.</p>
          <a href="#ecrans">Comprendre les écrans<ArrowDown size={18} aria-hidden="true" /></a>
        </aside>
      </section>

      <nav className="container parts-chapters" aria-label="Les pièces du guide">
        {chapters.map(({ id, label, Icon }) => <a key={id} href={`#${id}`}><Icon size={18} aria-hidden="true" />{label}</a>)}
      </nav>

      <div className="container parts-sections">
        <aside className="parts-rating-key" aria-labelledby="rating-key-title">
          <h2 id="rating-key-title">Des étoiles pour vous guider.</h2>
          <p><strong>1 :</strong> économique · <strong>2 :</strong> compromis · <strong>3 :</strong> intermédiaire · <strong>4 :</strong> équilibre conseillé · <strong>5 :</strong> fidélité à l’origine privilégiée.</p>
          <p>Ce repère REMOBIA exprime une préférence, pas une certification. La note dépend de la référence, de la provenance, de l’état et des contrôles. Toute pièce doit être adaptée et traçable ; aucune gamme n’est disponible systématiquement.</p>
        </aside>
        <section id="ecrans" className="parts-section parts-section-comparison" aria-labelledby="screens-title">
          <div className="parts-section-heading"><span className="parts-section-number">01</span><h2 id="screens-title">Écrans.<br /><span>Quatre options, un choix expliqué.</span></h2></div>
          <div className="parts-section-body">
            <p>Voici les grandes familles pour un téléphone équipé d’un OLED à l’origine. Les modèles LCD ont leur propre cas, expliqué juste après.</p>
            <div className="parts-screen-options">
              <article><span className="parts-card-kicker">LA RÉFÉRENCE CONSTRUCTEUR</span><h3>Écran d’origine</h3><Stars score={5} /><p>Une pièce constructeur neuve et identifiée : Apple pour un iPhone, ou le fabricant de votre appareil. À privilégier si votre priorité est de rester au plus près des caractéristiques d’origine.</p><p className="parts-card-choice">Pour vous : vous souhaitez une pièce constructeur.</p></article>
              <article className="parts-screen-preferred"><span className="parts-card-kicker">NOTRE CONSEIL POUR L’ÉQUILIBRE</span><h3>Soft OLED</h3><Stars score={4} /><p>Un OLED compatible à support souple, souvent plus proche de la construction d’origine. Nous le conseillons généralement pour conserver un bon rendu OLED avec un budget maîtrisé, si la référence convient.</p><p className="parts-card-choice">Pour vous : vous cherchez un bon équilibre entre rendu et budget.</p></article>
              <article><span className="parts-card-kicker">LE COMPROMIS OLED</span><h3>Hard OLED</h3><Stars score={2} /><p>Un OLED compatible à support rigide. Une alternative quand le Soft OLED adapté n’est pas disponible ou dépasse votre budget. L’ajustement et les performances dépendent de la référence.</p><p className="parts-card-choice">Pour vous : vous souhaitez garder l’OLED avec davantage de compromis.</p></article>
              <article><span className="parts-card-kicker">L’OPTION ÉCONOMIQUE</span><h3>LCD / In-cell</h3><Stars score={1} /><p>Un LCD compatible utilise un rétroéclairage. Sur un appareil conçu pour l’OLED, les noirs et le rendu diffèrent. Une solution pour un budget réduit, si le modèle et la pièce le permettent.</p><p className="parts-card-choice">Pour vous : vous acceptez les différences pour limiter votre budget.</p></article>
            </div>
            <div className="parts-provenance">
              <h3>Votre téléphone avait déjà un LCD ?</h3>
              <p>Un LCD adapté est alors le choix normal. La note <strong>1 étoile</strong> ci-dessus concerne une conversion OLED vers LCD, pas tous les LCD. Un écran LCD constructeur neuf adapté peut recevoir <strong>5 étoiles</strong>.</p>
              <p><strong>OLED :</strong> les pixels émettent leur lumière et peuvent s’éteindre pour afficher du noir. <strong>LCD :</strong> un rétroéclairage éclaire la dalle. Le support « souple » du Soft OLED ne rend pas la vitre extérieure flexible.</p>
              <p>Dans la gamme LCD / In-cell, « In-cell » désigne l’intégration du tactile dans la dalle. Ce terme ne garantit ni une origine constructeur ni un niveau de qualité.</p>
            </div>
            <Advice>Sur un appareil OLED, un bon <strong>Soft OLED</strong> compatible est souvent notre premier conseil pour équilibrer rendu et budget. Choisissez l’<strong>origine</strong> si la fidélité au constructeur passe en premier. Le <strong>Hard OLED</strong> et le <strong>LCD / In-cell</strong> sont des alternatives à discuter selon les compromis que vous acceptez.</Advice>
            <p className="parts-note">Luminosité, tactile, couleurs, fréquence d’affichage et fonctions comme True Tone peuvent varier. Le type de dalle ne garantit pas à lui seul toutes les fonctions d’origine. La disponibilité et les procédures de configuration dépendent du modèle. Un écran d’origine reconditionné peut aussi être envisagé après vérification de son état et de sa provenance.</p>
            <PartsQuoteButton initialIssue="screen" label="Être conseillé pour mon écran" secondary />
          </div>
        </section>

        <section id="batteries" className="parts-section parts-section-comparison" aria-labelledby="battery-title">
          <div className="parts-section-heading"><span className="parts-section-number">02</span><h2 id="battery-title">Batteries.<br /><span>Une pièce neuve, adaptée et traçable.</span></h2></div>
          <div className="parts-section-body">
            <p>Le nom de la gamme ne suffit pas. Nous privilégions une batterie neuve de provenance connue, adaptée à votre téléphone, avec une capacité cohérente.</p>
            <div className="parts-screen-options parts-battery-options">
              <article><span className="parts-card-kicker">LA RÉFÉRENCE CONSTRUCTEUR</span><h3>Batterie d’origine</h3><Stars score={5} /><p>Une batterie constructeur neuve et identifiée. Notre préférence si vous souhaitez rester proche des spécifications prévues pour l’appareil, sous réserve de disponibilité et de configuration adaptée.</p></article>
              <article className="parts-screen-preferred"><span className="parts-card-kicker">L’ALTERNATIVE CONSEILLÉE</span><h3>Compatible sélectionnée</h3><Stars score={4} /><p>Une batterie neuve d’un autre fournisseur, de provenance connue. Un choix équilibré si sa référence, ses caractéristiques et les contrôles sont adaptés au modèle.</p></article>
              <article><span className="parts-card-kicker">L’OPTION ÉCONOMIQUE</span><h3>Compatible économique</h3><Stars score={1} /><p>Une option pour limiter le budget, uniquement si la batterie est neuve, traçable et adaptée. Une étoile décrit sa place dans notre comparaison, pas une dispense de contrôles.</p></article>
            </div>
            <Advice>Pour un téléphone que vous souhaitez garder, privilégiez une <strong>batterie d’origine neuve</strong> ou une <strong>compatible sélectionnée</strong>. Évitez de choisir uniquement sur une promesse de « grande capacité » : l’autonomie réelle dépend aussi de votre usage, des réglages et de l’état du téléphone.</Advice>
            <p>Une capacité annoncée très supérieure à celle d’origine mérite vérification. Selon le modèle et la procédure, un message de pièce non reconnue peut apparaître ou l’état de santé ne plus être affiché. Nous précisons les limites de l’option envisagée avant intervention.</p>
            <p className="parts-safety-note">Batterie gonflée, téléphone qui se déforme ou chauffe anormalement : cessez de l’utiliser et de le charger, puis demandez un diagnostic. Ne percez pas la batterie.</p>
            <PartsQuoteButton initialIssue="battery" label="Être conseillé pour ma batterie" secondary />
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

        <div className="parts-sources"><details><summary>Les références de ce guide<ChevronDown size={18} aria-hidden="true" /></summary><p>Repères techniques : <a href="https://support.apple.com/fr-fr/103256">Apple — écrans</a>, <a href="https://support.apple.com/fr-fr/103269">Apple — batteries</a>, <a href="https://fr.ifixit.com/Wiki/iPhone_Screen_Repair">iFixit — LCD et OLED</a>. Les remarques propres à Apple ne s’appliquent pas à tous les téléphones.</p></details></div>
      </div>
    </main>
    <CatalogFooter />
  </div>;
}
