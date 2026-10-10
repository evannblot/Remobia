"use client";
import OwnerControls from "./OwnerControls";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImageIcon, Mail, RefreshCw, Smartphone, Trash2, X } from "lucide-react";
import { fetchClientJson } from "../lib/client-requests";
import { TRADE_IN_ACCESSORIES, TRADE_IN_ANSWERS, TRADE_IN_CONDITIONS, TRADE_IN_DEFECTS, type TradeInRequest } from "../lib/trade-in";
import { CatalogFooter, CatalogHeader } from "./PhoneCatalog";
import "./catalog.css";
import "./trade-in-manager.css";

const PHOTO_LABELS = { front: "Face avant", back: "Face arrière", additional1: "Photo complémentaire 1", additional2: "Photo complémentaire 2" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTradeInRequest(value: unknown): value is TradeInRequest {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID.test(value.id)) return false;
  const stringFields = ["reference", "createdAt", "brand", "model", "storage", "color", "description", "repairs", "name", "email", "phone"];
  if (stringFields.some((field) => typeof value[field] !== "string")) return false;
  if (!value.reference || !value.brand || !value.model || !value.name || !value.email || !Number.isFinite(Date.parse(value.createdAt as string))) return false;
  if (typeof value.condition !== "string" || !Object.hasOwn(TRADE_IN_CONDITIONS, value.condition)) return false;
  if (typeof value.powersOn !== "string" || !Object.hasOwn(TRADE_IN_ANSWERS, value.powersOn)) return false;
  if (typeof value.unlocked !== "string" || !Object.hasOwn(TRADE_IN_ANSWERS, value.unlocked)) return false;
  if (value.battery !== null && (typeof value.battery !== "number" || !Number.isInteger(value.battery) || value.battery < 0 || value.battery > 100)) return false;
  if (!Array.isArray(value.defects) || value.defects.some((item) => typeof item !== "string" || !Object.hasOwn(TRADE_IN_DEFECTS, item))) return false;
  if (!Array.isArray(value.accessories) || value.accessories.some((item) => typeof item !== "string" || !Object.hasOwn(TRADE_IN_ACCESSORIES, item))) return false;
  if (!Array.isArray(value.images) || value.images.length < 2 || value.images.length > 4) return false;
  const sides = new Set<string>();
  for (const image of value.images) {
    if (!isRecord(image) || typeof image.side !== "string" || !Object.hasOwn(PHOTO_LABELS, image.side) || sides.has(image.side)) return false;
    if (image.url !== `/api/admin/trade-in-images/${value.id}/${image.side}`) return false;
    sides.add(image.side);
  }
  return sides.has("front") && sides.has("back");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value));
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value || "Non renseigné"}</dd></div>;
}

function RequestPhoto({ image, model }: { image: TradeInRequest["images"][number]; model: string }) {
  const [failed, setFailed] = useState(false);
  const label = PHOTO_LABELS[image.side];
  return <figure className="trade-in-request-photo">
    {failed ? <div className="trade-in-photo-error"><ImageIcon size={26} aria-hidden="true" /><p>La photo n’a pas pu être chargée.</p><button type="button" className="quiet-link" onClick={() => setFailed(false)}>Réessayer</button></div> : <a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la photo : ${label} du ${model}`}><img src={image.url} alt={`${label} du ${model}`} width={600} height={600} loading="lazy" onError={() => setFailed(true)} /></a>}
    <figcaption>{label}<span>{failed ? "" : "Cliquez pour agrandir"}</span></figcaption>
  </figure>;
}

export default function TradeInManager({ vercelOwner = false }: { vercelOwner?: boolean }) {
  const [requests, setRequests] = useState<TradeInRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const deleteLock = useRef(false);

  async function retrieve(controller: AbortController) {
    try {
      const { response, data } = await fetchClientJson<unknown>("/api/admin/trade-ins", { cache: "no-store", signal: controller.signal }, {
        timeoutMessage: "Les demandes mettent trop de temps à répondre. Vérifiez votre connexion puis réessayez.",
      });
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(isRecord(data) && typeof data.error === "string" ? data.error : "Les demandes n’ont pas pu être chargées.");
      if (!isRecord(data) || !Array.isArray(data.requests) || !data.requests.every(isTradeInRequest)) throw new Error("Les demandes reçues ne peuvent pas être affichées. Réessayez dans un instant.");
      setRequests(data.requests);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Les demandes n’ont pas pu être chargées.");
    } finally {
      if (controllerRef.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }

  function load() {
    if (deleteLock.current) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true); setError(""); setDeleting(null); setDeleteError("");
    void retrieve(controller);
  }

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    void retrieve(controller);
    return () => controller.abort();
  }, []);

  async function remove(request: TradeInRequest) {
    if (deleteLock.current || loading || deleting !== request.id) return;
    deleteLock.current = true;
    setDeleteBusy(true); setDeleteError(""); setNotice("");
    try {
      const { response, data } = await fetchClientJson<unknown>(`/api/admin/trade-ins/${encodeURIComponent(request.id)}`, { method: "DELETE" }, {
        timeoutMessage: "La suppression n’a pas pu être confirmée. Actualisez les demandes pour vérifier si elle a abouti avant de réessayer.",
      });
      if (!response.ok || !isRecord(data) || data.success !== true) throw new Error(isRecord(data) && typeof data.error === "string" ? data.error : "La suppression n’a pas pu être confirmée. La demande reste affichée.");
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setDeleting(null); setNotice(`La demande ${request.reference} a été supprimée.`);
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "La demande n’a pas pu être supprimée.");
    } finally {
      deleteLock.current = false; setDeleteBusy(false);
    }
  }

  return <div className="catalog-site trade-in-manager"><CatalogHeader management /><main className="container manager-main" id="contenu">{vercelOwner && <OwnerControls />}
    <div className="trade-in-manager-links"><a className="catalog-back" href="/"><ArrowLeft size={15} aria-hidden="true" />Revenir au site</a><a className="quiet-link" href="/gestion/telephones">Gérer mes annonces<ArrowRight size={15} aria-hidden="true" /></a></div>
    <div className="manager-intro"><div><p className="eyebrow">VOTRE ESPACE DE GESTION</p><h1>Les téléphones<br /><span>qu’on vous propose.</span></h1><p>Consultez les informations et les photos envoyées par les clients. Vous pouvez leur répondre par email pour demander une précision ou proposer votre estimation.</p></div></div>
    <div className="trade-in-manager-private"><Smartphone size={19} aria-hidden="true" /><p>Ces demandes et leurs photos sont privées. Elles ne sont pas affichées dans le catalogue de vente.</p></div>
    {notice && <div className="manager-notice" role="status"><Check size={18} aria-hidden="true" /><p>{notice}</p><button type="button" aria-label="Fermer la confirmation" onClick={() => setNotice("")}><X size={18} aria-hidden="true" /></button></div>}
    {error && <div className="manager-error" role="alert"><p>{error}</p><button type="button" className="quiet-link" onClick={() => void load()} disabled={loading || deleteBusy}>Réessayer<RefreshCw size={15} aria-hidden="true" /></button></div>}
    <section className="trade-in-request-list" aria-labelledby="trade-in-list-title"><div className="catalog-list-heading"><div><h2 id="trade-in-list-title">Demandes d’estimation</h2>{!loading && !error && <p>{requests.length} demande{requests.length > 1 ? "s" : ""}</p>}</div><button type="button" className="quiet-link" onClick={() => void load()} disabled={loading || deleteBusy}><RefreshCw size={15} aria-hidden="true" />Actualiser</button></div>
      {loading ? <div className="catalog-state" role="status"><span className="catalog-loader" /><p>Chargement des demandes…</p></div> : requests.length === 0 && !error ? <div className="catalog-state"><Smartphone size={32} strokeWidth={1.3} aria-hidden="true" /><h3>Les premières demandes arriveront ici.</h3><p>Les clients peuvent envoyer les détails de leur téléphone et ses photos depuis la rubrique Reprise.</p><a className="quiet-link" href="/reprise">Voir le formulaire de reprise<ArrowRight size={16} aria-hidden="true" /></a></div> : <div className="trade-in-request-cards">{requests.map((request) => {
        const model = `${request.brand} ${request.model}`;
        return <article className="trade-in-request-card" key={request.id} aria-labelledby={`trade-in-${request.id}`}>
          <div className="trade-in-request-heading"><div><p className="trade-in-request-reference">{request.reference}<time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time></p><h3 id={`trade-in-${request.id}`}>{model}</h3><p className="trade-in-request-overview">{[request.storage, request.color, TRADE_IN_CONDITIONS[request.condition]].filter(Boolean).join(" · ")}</p><p className="trade-in-request-customer">Proposé par <strong>{request.name}</strong></p></div><a className="button button-primary trade-in-reply" href={`mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(`Votre demande ${request.reference} — ${model}`)}`}><Mail size={16} aria-hidden="true" />Répondre au client</a></div>
          <details className="trade-in-request-details"><summary>Voir les informations et les photos<ChevronDown size={17} aria-hidden="true" /></summary><div className="trade-in-request-detail-body"><div className="trade-in-request-data"><section><h4>Le téléphone</h4><dl><Detail label="Marque" value={request.brand} /><Detail label="Modèle" value={request.model} /><Detail label="Stockage" value={request.storage} /><Detail label="Couleur" value={request.color} /><Detail label="État général" value={TRADE_IN_CONDITIONS[request.condition]} /><Detail label="Le téléphone s’allume" value={TRADE_IN_ANSWERS[request.powersOn]} /><Detail label="Déverrouillage et retrait des comptes possibles" value={TRADE_IN_ANSWERS[request.unlocked]} /><Detail label="État de la batterie" value={request.battery === null ? "Non renseigné" : `${request.battery} %`} /><Detail label="Problèmes signalés" value={request.defects.length ? request.defects.map((value) => TRADE_IN_DEFECTS[value]).join(", ") : "Aucun problème signalé"} /><Detail label="Accessoires" value={request.accessories.length ? request.accessories.map((value) => TRADE_IN_ACCESSORIES[value]).join(", ") : "Aucun accessoire indiqué"} /></dl></section><section><h4>Les précisions du client</h4><dl className="trade-in-request-text"><Detail label="Description de l’état et des problèmes" value={request.description} /><Detail label="Réparations déjà effectuées" value={request.repairs} /></dl><h4>Pour contacter le client</h4><dl><Detail label="Nom" value={request.name} /><div><dt>Email</dt><dd><a href={`mailto:${encodeURIComponent(request.email)}`}>{request.email}</a></dd></div><Detail label="Téléphone" value={request.phone} /></dl><p className="trade-in-reply-help">« Répondre au client » ouvre votre application de messagerie. Aucun email n’est envoyé automatiquement.</p></section></div><section className="trade-in-request-photos"><h4>Les photos reçues</h4><div>{request.images.map((image) => <RequestPhoto key={image.side} image={image} model={model} />)}</div></section></div></details>
          <div className="trade-in-request-actions"><button type="button" className="quiet-link trade-in-delete" onClick={() => { setDeleting(request.id); setDeleteError(""); }} disabled={deleteBusy || loading} aria-expanded={deleting === request.id} aria-controls={`trade-in-delete-${request.id}`}><Trash2 size={15} aria-hidden="true" />Supprimer la demande</button></div>
          {deleting === request.id && <div className="trade-in-delete-confirm" id={`trade-in-delete-${request.id}`} role="alert"><div><strong>Supprimer la demande {request.reference} ?</strong><p>Les informations du client et les photos de ce téléphone seront supprimées. Cette action ne peut pas être annulée.</p>{deleteError && <p className="trade-in-delete-error">{deleteError}</p>}</div><div className="trade-in-delete-confirm-buttons"><button type="button" className="button manager-cancel" onClick={() => { setDeleting(null); setDeleteError(""); }} disabled={deleteBusy}>Conserver</button><button type="button" className="button trade-in-delete-button" onClick={() => void remove(request)} disabled={deleteBusy}>{deleteBusy ? "Suppression…" : "Confirmer la suppression"}</button></div></div>}
        </article>;
      })}</div>}
    </section>
  </main><CatalogFooter management /></div>;
}
