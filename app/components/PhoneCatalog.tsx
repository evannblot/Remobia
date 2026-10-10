"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Battery, ChevronRight, MapPin, Menu, Search, Smartphone, X } from "lucide-react";
import { conditionLabels, formatPrice, type PhoneListing } from "../lib/catalog";
import PhoneInterest from "./PhoneInterest";
import { fetchClientJson } from "../lib/client-requests";
import "./catalog.css";

export function CatalogBrand() {
  return <span className="brand-lockup"><span className="brand-words">remobia</span></span>;
}

export function CatalogHeader({ management = false, activePage = "catalog" }: { management?: boolean; activePage?: "catalog" | "trade-in" }) {
  const [open, setOpen] = useState(false);
  return <><a className="skip-link" href="#contenu">Aller au contenu</a><div className="topline"><div className="container"><span><span className="location-dot" />Laval, Mayenne · 53000</span><span className="topline-right">Votre téléphone mérite de durer.</span></div></div><header className="site-header catalog-header"><div className="container header-inner"><a href="/" className="brand" aria-label="REMOBIA — accueil"><CatalogBrand /></a><nav className={`catalog-nav${open ? " is-open" : ""}`} aria-label="Navigation principale"><a href="/" onClick={() => setOpen(false)}>Accueil</a><a href="/#reparations" onClick={() => setOpen(false)}>Réparation</a><a href="/telephones" aria-current={!management && activePage === "catalog" ? "page" : undefined} onClick={() => setOpen(false)}>Reconditionnés</a><a href="/reprise" aria-current={!management && activePage === "trade-in" ? "page" : undefined} onClick={() => setOpen(false)}>Reprise</a></nav>{management && <span className="catalog-owner-label">Espace de gestion</span>}<button type="button" className="catalog-menu" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button></div></header></>;
}

export function CatalogFooter({ management = false }: { management?: boolean }) {
  return <footer className="site-footer catalog-footer"><div className="container"><div className="footer-top"><a href="/" className="brand" aria-label="REMOBIA — accueil"><CatalogBrand /></a><p>Réparation, reprise et vente de téléphones à Laval.<br />Votre téléphone mérite de durer.</p><a href="/#laval" className="footer-location"><MapPin size={16} aria-hidden="true" />Laval, Mayenne</a></div><div className="footer-bottom"><span>© 2026 REMOBIA · Site en préparation</span><div><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a>{!management && <><a href="/gestion/telephones">Gérer mes annonces</a><a href="/gestion/reprises">Consulter les reprises</a></>}</div><span className="footer-status"><span className="location-dot" />Service en préparation</span></div></div></footer>;
}

export function PhonePlaceholder({ label = "Photo à venir" }: { label?: string }) {
  return <div className="phone-placeholder"><svg viewBox="0 0 110 166" width="80" height="122" fill="none" aria-hidden="true"><rect x="17" y="6" width="76" height="154" rx="16" stroke="currentColor" strokeWidth="2" /><rect x="23" y="12" width="64" height="141" rx="11" stroke="currentColor" strokeWidth=".7" opacity=".35" /><path d="M44 17h22M45 146h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M65 67C49 67 36 77 36 94c16 0 29-10 29-27Z" fill="currentColor" opacity=".3" /><path d="m45 89 25-27" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg><span>{label}</span></div>;
}

function Details({ phone, onInterest, onClose }: { phone: PhoneListing; onInterest: () => void; onClose: () => void }) {
  const [imageIndex, setImageIndex] = useState(0);
  return <><div className="catalog-dialog-bar"><p className="eyebrow">LA FICHE DE L’APPAREIL</p><button type="button" className="catalog-close" aria-label="Fermer la fiche du téléphone" onClick={onClose}><X size={23} /></button></div><div className="phone-detail-layout"><div className="phone-detail-gallery"><div className="phone-detail-photo">{phone.images.length ? <img src={phone.images[imageIndex]} alt={`${phone.brand} ${phone.model}, photo ${imageIndex + 1}`} width="600" height="600" /> : <PhonePlaceholder label="Aucune photo ajoutée" />}</div>{phone.images.length > 1 && <div className="phone-thumbnails">{phone.images.map((url, index) => <button type="button" key={url} className={index === imageIndex ? "is-active" : ""} aria-label={`Voir la photo ${index + 1}`} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}><img src={url} alt="" width="80" height="80" /></button>)}</div>}</div><div className="phone-detail-copy"><p className="phone-brand">{phone.brand}</p><h2 id="phone-detail-title">{phone.model}</h2><p className="phone-detail-price">{formatPrice(phone.priceCents)}</p><span className="phone-condition">{conditionLabels[phone.condition]}</span><dl className="phone-specs">{phone.storage && <div><dt>Stockage</dt><dd>{phone.storage}</dd></div>}{phone.color && <div><dt>Couleur</dt><dd>{phone.color}</dd></div>}{phone.battery !== null && <div><dt>État de la batterie</dt><dd><Battery size={15} aria-hidden="true" />{phone.battery} %</dd></div>}<div><dt>Localisation</dt><dd>Laval, Mayenne</dd></div></dl>{phone.description && <div className="phone-description"><h3>À propos de cet appareil</h3><p>{phone.description}</p></div>}<button type="button" className="button button-primary phone-interest-button" onClick={onInterest}>Cet appareil m’intéresse<ArrowRight size={17} aria-hidden="true" /></button><p className="phone-detail-note">Posez vos questions et convenez des modalités de vente avec nous.</p></div></div></>;
}

export default function PhoneCatalog() {
  const [phones, setPhones] = useState<PhoneListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<PhoneListing | null>(null);
  const [interest, setInterest] = useState<PhoneListing | null>(null);
  const detailRef = useRef<HTMLDialogElement>(null);
  const interestRef = useRef<HTMLDialogElement>(null);
  const loadController = useRef<AbortController | null>(null);

  async function load() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true); setError("");
    try {
      const { response, data } = await fetchClientJson<{ phones?: PhoneListing[]; error?: string }>("/api/phones", { cache: "no-store", signal: controller.signal }, {
        timeoutMessage: "Le catalogue met trop de temps à répondre. Vérifiez votre connexion puis réessayez.",
      });
      if (controller.signal.aborted) return;
      if (!response.ok || !Array.isArray(data.phones)) throw new Error(data.error || "Le catalogue n’a pas pu être chargé.");
      setPhones(data.phones.filter((phone) => phone.status === "published"));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Le catalogue est momentanément indisponible. Vous pouvez réessayer.");
    }
    finally { if (loadController.current === controller && !controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { void load(); return () => loadController.current?.abort(); }, []);
  useEffect(() => {
    if (selected && !detailRef.current?.open) detailRef.current?.showModal();
    if (!selected && detailRef.current?.open) detailRef.current.close();
    if (interest && !interestRef.current?.open) interestRef.current?.showModal();
    if (!interest && interestRef.current?.open) interestRef.current.close();
    if (!selected && !interest) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected, interest]);
  const brands = useMemo(() => Array.from(new Set(phones.map((phone) => phone.brand))).sort((a, b) => a.localeCompare(b, "fr")), [phones]);
  const results = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("fr");
    return phones.filter((phone) => (!brand || phone.brand === brand) && (!text || `${phone.brand} ${phone.model} ${phone.storage} ${phone.color}`.toLocaleLowerCase("fr").includes(text))).sort((a, b) => sort === "price-low" ? a.priceCents - b.priceCents : sort === "price-high" ? b.priceCents - a.priceCents : b.createdAt.localeCompare(a.createdAt));
  }, [phones, query, brand, sort]);

  return <div className="catalog-site"><CatalogHeader /><main id="contenu"><section className="container catalog-intro"><a className="catalog-back" href="/"><ArrowLeft size={15} aria-hidden="true" />Retour à l’accueil</a><p className="eyebrow">UNE SECONDE VIE, AUSSI POUR VOTRE PROCHAIN TÉLÉPHONE</p><div className="catalog-intro-row"><h1>Votre prochain téléphone.<br /><span>À découvrir ici.</span></h1><p>Les appareils proposés par REMOBIA à Laval, avec leur état, leurs caractéristiques et leur prix. Une fiche claire pour faire votre choix.</p></div><div className="catalog-local-note"><MapPin size={17} aria-hidden="true" /><span>Laval, Mayenne</span><span className="catalog-note-separator" /><span>Échange direct avant la vente</span></div></section><section className="catalog-list-section"><div className="container"><div className="catalog-list-heading"><h2>Les téléphones à vendre</h2><p>{loading ? "Chargement des annonces…" : `${phones.length} ${phones.length === 1 ? "appareil proposé" : "appareils proposés"}`}</p></div>{phones.length > 0 && <div className="catalog-filters"><label className="catalog-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Rechercher un téléphone</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Une marque, un modèle…" /></label><label><span className="sr-only">Filtrer par marque</span><select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">Toutes les marques</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="sr-only">Trier les annonces</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Ajouts récents</option><option value="price-low">Prix croissant</option><option value="price-high">Prix décroissant</option></select></label></div>}{loading ? <div className="catalog-state" role="status"><span className="catalog-loader" /><p>Nous ouvrons le catalogue…</p></div> : error ? <div className="catalog-state catalog-error" role="alert"><Smartphone size={34} strokeWidth={1.3} aria-hidden="true" /><h3>Les annonces ne sont pas disponibles.</h3><p>{error}</p><button type="button" className="button button-primary" onClick={() => void load()}>Réessayer<ArrowRight size={16} aria-hidden="true" /></button></div> : phones.length === 0 ? <div className="catalog-empty"><div className="catalog-empty-symbol"><PhonePlaceholder label="" /></div><div><p className="eyebrow">LE CATALOGUE SE PRÉPARE</p><h3>Les premières annonces<br />arriveront ici.</h3><p>Chaque téléphone aura sa propre fiche : photos, état, caractéristiques et prix. Revenez découvrir les appareils dès leur mise en vente.</p><a href="/#reparations" className="quiet-link">Et si votre téléphone pouvait durer ?<ArrowRight size={16} aria-hidden="true" /></a></div></div> : results.length === 0 ? <div className="catalog-state"><Search size={30} strokeWidth={1.3} aria-hidden="true" /><h3>Aucun appareil pour cette recherche.</h3><p>Essayez une autre marque ou un autre modèle.</p><button type="button" className="quiet-link" onClick={() => { setQuery(""); setBrand(""); }}>Voir tous les appareils<ArrowRight size={16} aria-hidden="true" /></button></div> : <><p className="sr-only" role="status">{results.length} résultat{results.length > 1 ? "s" : ""}</p><div className="phone-grid">{results.map((phone) => <button type="button" className="phone-card" key={phone.id} onClick={() => setSelected(phone)} aria-label={`Voir la fiche du ${phone.brand} ${phone.model}, ${formatPrice(phone.priceCents)}`}><div className="phone-card-photo">{phone.images[0] ? <img src={phone.images[0]} alt={`${phone.brand} ${phone.model}`} width="600" height="600" loading="lazy" /> : <PhonePlaceholder /> }<span className="phone-condition">{conditionLabels[phone.condition]}</span></div><div className="phone-card-copy"><p className="phone-brand">{phone.brand}</p><h3>{phone.model}</h3><p className="phone-card-specs">{[phone.storage, phone.color].filter(Boolean).join(" · ") || "Détails dans la fiche"}</p><div className="phone-card-bottom"><strong>{formatPrice(phone.priceCents)}</strong><span>Voir l’appareil<ChevronRight size={16} aria-hidden="true" /></span></div></div></button>)}</div></>}<div className="catalog-repair-note"><Smartphone size={25} strokeWidth={1.3} aria-hidden="true" /><div><h3>Votre téléphone mérite peut-être une réparation.</h3><p>Écran, batterie, charge… découvrons ce qu’il est possible de faire.</p></div><a className="quiet-link" href="/#reparations">Voir les réparations<ArrowRight size={16} aria-hidden="true" /></a></div></div></section></main><CatalogFooter /><dialog ref={detailRef} className="catalog-detail-dialog" aria-labelledby="phone-detail-title" onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={(event) => { if (event.target === detailRef.current) setSelected(null); }}>{selected && <Details key={selected.id} phone={selected} onClose={() => setSelected(null)} onInterest={() => { setInterest(selected); setSelected(null); }} />}</dialog><dialog ref={interestRef} className="catalog-interest-dialog" aria-label="Demande d’informations sur un téléphone" onCancel={() => setInterest(null)} onClose={() => setInterest(null)} onClick={(event) => { if (event.target === interestRef.current) setInterest(null); }}>{interest && <PhoneInterest phone={interest} onClose={() => setInterest(null)} />}</dialog></div>;
}
