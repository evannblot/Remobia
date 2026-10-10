"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BatteryCharging, Camera, Check, ChevronDown, CircleHelp, MapPin, Menu, MessageCircle, Plug, ShieldCheck, Smartphone, Volume2, X } from "lucide-react";
import QuoteWizard from "./components/QuoteWizard";

function BrandMark({ small = false }: { small?: boolean }) {
  return <span className={`brand-lockup${small ? " brand-small" : ""}`}><span className="brand-words">remobia</span></span>;
}

const repairs = [
  { code: "screen", title: "Écran & tactile", detail: "Une fissure, un écran noir ou un tactile qui ne répond plus.", Icon: Smartphone },
  { code: "battery", title: "Batterie", detail: "Une autonomie qui diminue, un téléphone qui s’éteint trop vite.", Icon: BatteryCharging },
  { code: "charging", title: "Charge & connecteur", detail: "Un câble qui tient mal ou une charge devenue impossible.", Icon: Plug },
  { code: "camera", title: "Appareil photo", detail: "Des photos floues, une caméra noire ou une mise au point difficile.", Icon: Camera },
  { code: "audio", title: "Son & microphone", detail: "Des appels difficiles à entendre ou un micro silencieux.", Icon: Volume2 },
  { code: "other", title: "Un autre problème ?", detail: "Décrivez ce que vous constatez. Nous chercherons la bonne piste.", Icon: CircleHelp },
];

const questions = [
  { title: "Combien coûte la réparation de mon téléphone ?", answer: "Le prix dépend du modèle, du problème et des pièces choisies. Votre demande de devis est gratuite : nous étudions les informations transmises, puis nous vous proposons une solution et son prix. Certaines pannes nécessitent d’examiner l’appareil pour confirmer l’intervention." },
  { title: "Je ne connais pas mon modèle ou la panne. Que faire ?", answer: "Vous pouvez quand même préparer votre demande. Choisissez « Je ne connais pas le modèle » ou « Autre / je ne sais pas », puis décrivez simplement ce qui se passe. Nous pourrons préciser les informations ensemble." },
  { title: "Puis-je choisir la qualité des pièces ?", answer: "Oui, votre préférence guide notre proposition : budget maîtrisé, priorité à la qualité ou besoin d’un conseil. Les options réellement disponibles pour votre modèle, leurs différences et les garanties proposées seront expliquées avant votre choix." },
  { title: "Quelles marques de téléphones prenez-vous en charge ?", answer: "Apple, Samsung, Google, Xiaomi, Huawei, Oppo et les autres marques sont les bienvenues. La possibilité de réparation sera confirmée selon votre modèle, le problème rencontré et la disponibilité des pièces." },
  { title: "Comment se passe la prise en charge à Laval ?", answer: "Un déplacement dans Laval est possible. Vous pouvez indiquer votre préférence pour un dépôt ou un déplacement dans votre demande. Le lieu, le créneau et les éventuels frais seront convenus ensemble avant la prise en charge." },
  { title: "Quel sera le délai de réparation ?", answer: "Le délai dépend de la panne et de la disponibilité des pièces. Nous vous communiquerons le délai envisagé avec notre proposition, avant que vous décidiez de faire réparer votre téléphone." },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (quoteOpen) {
      if (dialog && !dialog.open) dialog.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previous; };
    }
    if (dialog?.open) dialog.close();
  }, [quoteOpen]);

  function openQuote(issue?: string) {
    setSelectedIssue(issue);
    setFormKey((current) => current + 1);
    setMenuOpen(false);
    setQuoteOpen(true);
  }
  function closeQuote() { setQuoteOpen(false); }

  return <>
    <a className="skip-link" href="#contenu">Aller au contenu</a>
    <div className="topline"><div className="container"><span><span className="location-dot" />Laval, Mayenne · 53000</span><span className="topline-right">Votre téléphone a encore de beaux jours.</span></div></div>
    <header className="site-header"><div className="container header-inner">
      <a href="/" className="brand" aria-label="REMOBIA — accueil" onClick={() => setMenuOpen(false)}><BrandMark /></a>
      <nav className={`main-nav${menuOpen ? " is-open" : ""}`} aria-label="Navigation principale">
        <a href="/" aria-current="page" onClick={() => setMenuOpen(false)}>Accueil</a>
        <a href="#reparations" onClick={() => setMenuOpen(false)}>Réparation</a><a href="/telephones" onClick={() => setMenuOpen(false)}>Reconditionnés</a><a href="#reprise" onClick={() => setMenuOpen(false)}>Reprise</a><a href="#approche" onClick={() => setMenuOpen(false)}>À propos</a>
      </nav>
      <button type="button" className="button button-primary header-quote" onClick={() => openQuote()}>Devis gratuit<ArrowRight size={16} aria-hidden="true" /></button>
      <button type="button" className="mobile-menu-button" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
    </div></header>

    <main id="contenu">
      <section className="hero container" aria-labelledby="hero-title"><div className="hero-copy">
        <p className="eyebrow hero-eyebrow"><span className="mini-line" />LAVAL · MAYENNE</p>
        <h1 id="hero-title">Votre téléphone<br /><span>mérite de durer.</span></h1>
        <p className="hero-description">Réparation, reprise et smartphones reconditionnés à Laval.</p>
        <div className="hero-actions"><button type="button" className="button button-primary button-large" onClick={() => openQuote()}>Réparer mon appareil</button><a href="/telephones" className="button button-outline button-large">Acheter reconditionné</a><a href="/reprise" className="button button-outline button-large">Revendre mon appareil</a></div>
        <p className="hero-note"><Check size={14} aria-hidden="true" />Devis gratuit et personnalisé, sans prix imposé à l’avance.</p>
      </div><div className="hero-visual photo-slot" role="img" aria-label="Emplacement réservé à une future photo de restauration d’un smartphone dans l’atelier">
        <span className="photo-slot-index">01 / L’ATELIER REMOBIA</span><span className="photo-slot-center"><Camera size={31} strokeWidth={1.1} aria-hidden="true" /><strong>Votre photo d’atelier</strong><small>Une image de votre travail prendra place ici.</small></span>
      </div></section>

      <section className="service-overview" aria-label="Les services REMOBIA"><div className="service-overview-inner">
        <article className="service-overview-card"><div className="service-photo-slot photo-slot" role="img" aria-label="Emplacement prévu pour une photo de réparation"><Camera size={25} strokeWidth={1.1} aria-hidden="true" /><span>Photo réparation</span></div><div className="service-overview-copy"><h2>Réparation</h2><p>Écran, batterie, charge : prolongez la vie de votre téléphone avec une solution adaptée.</p><button type="button" className="service-arrow" aria-label="Préparer un devis de réparation" onClick={() => openQuote()}><ArrowRight size={20} aria-hidden="true" /></button></div></article>
        <article className="service-overview-card"><div className="service-photo-slot photo-slot" role="img" aria-label="Emplacement prévu pour une photo des téléphones reconditionnés"><Camera size={25} strokeWidth={1.1} aria-hidden="true" /><span>Photo téléphones</span></div><div className="service-overview-copy"><h2>Reconditionnés</h2><p>Découvrez les appareils disponibles, leur état et leur prix dans le catalogue.</p><a className="service-arrow" href="/telephones" aria-label="Voir les téléphones à vendre"><ArrowRight size={20} aria-hidden="true" /></a></div></article>
        <article className="service-overview-card"><div className="service-photo-slot photo-slot" role="img" aria-label="Emplacement prévu pour une photo du service de reprise"><Camera size={25} strokeWidth={1.1} aria-hidden="true" /><span>Photo reprise</span></div><div className="service-overview-copy"><h2>Reprise</h2><p>Envoyez les informations et les photos de votre téléphone pour recevoir une estimation.</p><a className="service-arrow" href="/reprise" aria-label="Faire estimer mon téléphone"><ArrowRight size={20} aria-hidden="true" /></a></div></article>
      </div></section>

      <div className="container reassurance-strip" aria-label="Les points essentiels">
        <div><MessageCircle size={22} strokeWidth={1.4} aria-hidden="true" /><span><strong>Un devis personnalisé</strong><small>Votre appareil, votre besoin.</small></span></div>
        <div><ShieldCheck size={23} strokeWidth={1.4} aria-hidden="true" /><span><strong>Le choix des pièces, expliqué</strong><small>Pour décider en confiance.</small></span></div>
        <div><MapPin size={22} strokeWidth={1.4} aria-hidden="true" /><span><strong>Un service local</strong><small>Déplacement possible dans Laval.</small></span></div>
      </div>

      <section className="repairs-section" id="reparations" aria-labelledby="repairs-title"><div className="container">
        <div className="section-heading"><div><p className="eyebrow">01 — LES RÉPARATIONS</p><h2 id="repairs-title">Qu’est-ce qui ne va plus ?</h2></div><p>Pas besoin de connaître la pièce.<br />Commencez par ce que vous constatez.</p></div>
        <div className="repair-grid">{repairs.map(({ code, title, detail, Icon }, index) => <button type="button" className={`repair-card${index === 0 ? " repair-card-featured" : ""}`} key={code} onClick={() => openQuote(code)}><div className="repair-card-top"><span className="repair-icon"><Icon size={26} strokeWidth={1.3} aria-hidden="true" /></span><ArrowRight className="repair-arrow" size={19} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{detail}</p><span className="repair-card-action">Préparer mon devis</span></button>)}</div>
        <div className="brands-row"><span>Toutes les marques sont les bienvenues.<br /><strong>Selon votre modèle et les pièces disponibles.</strong></span><ul aria-label="Exemples de marques"><li>Apple</li><li>Samsung</li><li>Google</li><li>Xiaomi</li><li>Et votre modèle.</li></ul></div>
      </div></section>

      <section className="sales-intro container" aria-labelledby="sales-intro-title"><div><p className="eyebrow">ENVIE DE CHANGER DE TÉLÉPHONE ?</p><h2 id="sales-intro-title">Un autre téléphone.<br /><span>Un nouveau départ.</span></h2><p>Découvrez les appareils proposés à la vente, avec leur état, leurs caractéristiques et leur prix.</p></div><a className="button button-primary" href="/telephones">Voir les téléphones à vendre<ArrowRight size={18} aria-hidden="true" /></a></section>

      <section className="trade-in-section container" id="reprise" aria-labelledby="trade-in-title"><div><p className="eyebrow">FAITES ESTIMER VOTRE TÉLÉPHONE</p><h2 id="trade-in-title">Vous souhaitez le revendre ?</h2></div><div className="trade-in-copy"><p>Indiquez le modèle, son état et les problèmes éventuels. Ajoutez une photo de l’avant et de l’arrière : REMOBIA étudiera votre téléphone à distance et vous répondra avec une estimation.</p><p className="trade-in-note">La demande est gratuite et sans engagement. Le prix de reprise sera confirmé après vérification du téléphone.</p><a className="button button-primary" href="/reprise">Faire estimer mon téléphone<ArrowRight size={18} aria-hidden="true" /></a></div></section>

      <section className="process-section" id="fonctionnement" aria-labelledby="process-title"><div className="container">
        <div className="section-heading"><div><p className="eyebrow">02 — COMMENT ÇA MARCHE</p><h2 id="process-title">Simple, à chaque étape.</h2></div><p>Une réparation commence<br />par une bonne conversation.</p></div>
        <ol className="process-grid"><li><span className="step-index">01</span><h3>Vous nous racontez.</h3><p>Votre modèle, le problème et vos préférences. Quelques informations suffisent pour commencer.</p><span className="process-detail"><Check size={14} aria-hidden="true" />Demande gratuite</span></li><li><span className="step-index">02</span><h3>Nous vous expliquons.</h3><p>Nous étudions votre demande et vous proposons les options possibles, avec un prix et un délai envisagé.</p><span className="process-detail"><Check size={14} aria-hidden="true" />Une proposition adaptée</span></li><li><span className="step-index">03</span><h3>Vous choisissez.</h3><p>Après votre accord, nous convenons des pièces et de la prise en charge de votre téléphone à Laval.</p><span className="process-detail"><Check size={14} aria-hidden="true" />Votre accord avant intervention</span></li></ol>
        <div className="process-bottom"><p>Le bon point de départ ? Votre téléphone, tel qu’il est.</p><button type="button" className="button button-cream" onClick={() => openQuote()}>Parlons de ma réparation<ArrowRight size={17} aria-hidden="true" /></button></div>
      </div></section>

      <section className="approach-section container" id="approche" aria-labelledby="approach-title"><div className="approach-copy"><p className="eyebrow">03 — NOTRE APPROCHE</p><h2 id="approach-title">La confiance commence par des <span>explications claires.</span></h2><p>Votre téléphone fait partie de votre quotidien. Vous méritez de comprendre ce qui lui arrive et ce que l’on vous propose.</p><p>REMOBIA se construit autour d’une idée simple : vous aider à choisir une réparation adaptée à votre appareil, à vos attentes et à votre budget.</p><div className="approach-signature"><span className="signature-line" /><span>Local. Attentif. À votre mesure.</span></div></div><div className="approach-principles"><article><span className="principle-number">01</span><div><h3>Comprendre avant de remplacer.</h3><p>Vos symptômes orientent l’étude du problème. Certaines situations nécessitent un diagnostic de l’appareil.</p></div></article><article><span className="principle-number">02</span><div><h3>Vous laisser le choix.</h3><p>Budget ou qualité : les différences entre les options disponibles vous sont expliquées avant votre décision.</p></div></article><article><span className="principle-number">03</span><div><h3>Rester proche, à Laval.</h3><p>Déplacement, dépôt ou récupération : nous convenons ensemble des modalités qui vous correspondent.</p></div></article></div></section>

      <section className="local-section container" id="laval" aria-labelledby="local-title"><div className="local-location"><MapPin size={30} strokeWidth={1.3} aria-hidden="true" /><div><strong>Laval</strong><span>53000 · Mayenne</span></div></div><div className="local-copy"><p className="eyebrow">ICI, PRÈS DE VOUS</p><h2 id="local-title">À Laval, tout simplement.</h2><p>Un déplacement est possible dans Laval. Le lieu, le créneau et les modalités de prise en charge seront confirmés lors de notre échange.</p><button type="button" className="quiet-link" onClick={() => openQuote()}>Préparer ma demande<ArrowRight size={17} aria-hidden="true" /></button></div></section>

      <section className="faq-section container" id="questions" aria-labelledby="faq-title"><div className="faq-intro"><p className="eyebrow">04 — VOS QUESTIONS</p><h2 id="faq-title">Les choses<br />à savoir.</h2><p>Des réponses simples<br />avant de vous lancer.</p></div><div className="faq-list">{questions.map((question) => <details key={question.title}><summary>{question.title}<ChevronDown size={18} aria-hidden="true" /></summary><p>{question.answer}</p></details>)}</div></section>
      <section className="final-cta container"><div><p className="eyebrow">ON LUI DONNE UNE SECONDE VIE ?</p><h2>Tout commence par votre demande.</h2><p>Votre téléphone. Votre problème. Notre attention.</p></div><button type="button" className="button button-primary button-large" onClick={() => openQuote()}>Demander mon devis gratuit<ArrowRight size={18} aria-hidden="true" /></button></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-top"><a href="/" className="brand" aria-label="REMOBIA — accueil"><BrandMark small /></a><p>Réparation, reprise et vente de téléphones à Laval.<br />Votre téléphone mérite de durer.</p><a href="/telephones" className="footer-location">Téléphones à vendre<ArrowRight size={16} aria-hidden="true" /></a></div><div className="footer-bottom"><span>© 2026 REMOBIA · Site en préparation</span><div><a href="/gestion/telephones">Gérer mes annonces</a><a href="/gestion/reprises">Consulter les reprises</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a></div><span className="footer-status"><span className="location-dot" />Service en préparation</span></div></div></footer>
    {!quoteOpen && <div className="mobile-quote-bar"><button type="button" className="button button-primary" onClick={() => openQuote()}>Demander mon devis gratuit<ArrowRight size={17} aria-hidden="true" /></button></div>}
    <dialog ref={dialogRef} className="quote-dialog" aria-labelledby="quote-dialog-title" onCancel={closeQuote} onClose={closeQuote} onClick={(event) => { if (event.target === dialogRef.current) closeQuote(); }}><div className="dialog-header"><BrandMark small /><span id="quote-dialog-title" className="sr-only">Demande de devis gratuit</span><button type="button" className="dialog-close" aria-label="Fermer la demande de devis" onClick={closeQuote}><X size={22} /></button></div>{quoteOpen && <QuoteWizard key={formKey} initialIssue={selectedIssue} onClose={closeQuote} />}</dialog>
  </>;
}
