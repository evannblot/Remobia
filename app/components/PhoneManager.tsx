"use client";
import OwnerControls from "./OwnerControls";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { conditionLabels, formatPrice, statusLabels, type PhoneListing } from "../lib/catalog";
import { CatalogFooter, CatalogHeader, PhonePlaceholder } from "./PhoneCatalog";
import { fetchClientJson } from "../lib/client-requests";
import { MAX_PHONE_PHOTOS, preparePhonePhoto, validatePhonePhoto } from "../lib/photo-upload";
import "./catalog.css";

type Editing = {
  id?: string;
  version?: number;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: PhoneListing["condition"];
  price: string;
  battery: string;
  description: string;
  status: PhoneListing["status"];
  images: string[];
};
type NewPhoto = { file: File; url: string };
type FieldErrors = Partial<Record<"brand" | "model" | "price" | "battery", string>>;
const blank: Editing = { brand: "", model: "", storage: "", color: "", condition: "good", price: "", battery: "", description: "", status: "draft", images: [] };

function fromPhone(phone: PhoneListing): Editing {
  return { id: phone.id, version: phone.version, brand: phone.brand, model: phone.model, storage: phone.storage, color: phone.color, condition: phone.condition, price: (phone.priceCents / 100).toFixed(2), battery: phone.battery === null ? "" : String(phone.battery), description: phone.description, status: phone.status, images: [...phone.images] };
}

export default function PhoneManager({ vercelOwner = false }: { vercelOwner?: boolean }) {
  const [phones, setPhones] = useState<PhoneListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const files = newPhotos.map((photo) => photo.file);
  const previews = newPhotos.map((photo) => photo.url);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState("");
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const photoErrorRef = useRef<HTMLParagraphElement>(null);
  const loadController = useRef<AbortController | null>(null);
  const photoController = useRef<AbortController | null>(null);
  const editorVersion = useRef(0);
  const mounted = useRef(true);
  const newPhotosRef = useRef<NewPhoto[]>([]);

  function fetchPhones() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    return fetchClientJson<{ phones?: PhoneListing[]; error?: string }>("/api/admin/phones", { cache: "no-store", signal: controller.signal }, {
      timeoutMessage: "Vos annonces mettent trop de temps à répondre. Vérifiez votre connexion puis réessayez.",
    }).then(({ response, data }) => {
      if (controller.signal.aborted) return;
      if (!response.ok || !Array.isArray(data.phones)) throw new Error(data.error || "Les annonces n’ont pas pu être chargées.");
      setPhones(data.phones);
    }).catch((error) => { if (!controller.signal.aborted) setPageError(error instanceof Error ? error.message : "Les annonces n’ont pas pu être chargées."); })
      .finally(() => { if (loadController.current === controller && !controller.signal.aborted) setLoading(false); });
  }
  function load() { setLoading(true); setPageError(""); return fetchPhones(); }
  useEffect(() => {
    mounted.current = true;
    void fetchPhones();
    return () => {
      mounted.current = false; loadController.current?.abort(); photoController.current?.abort();
      for (const photo of newPhotosRef.current) URL.revokeObjectURL(photo.url);
    };
  }, []);
  const editingId = editing?.id;
  const editorOpen = editing !== null;
  useEffect(() => {
    if (editorOpen) { editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); firstField.current?.focus({ preventScroll: true }); }
  }, [editingId, editorOpen]);
  useEffect(() => {
    if (formError) { formErrorRef.current?.focus({ preventScroll: true }); formErrorRef.current?.scrollIntoView({ block: "nearest" }); }
  }, [formError]);
  useEffect(() => {
    if (photoError) { photoErrorRef.current?.focus({ preventScroll: true }); photoErrorRef.current?.scrollIntoView({ block: "nearest" }); }
  }, [photoError]);

  function replaceNewPhotos(next: NewPhoto[]) {
    for (const photo of newPhotosRef.current) if (!next.includes(photo)) URL.revokeObjectURL(photo.url);
    newPhotosRef.current = next; setNewPhotos(next);
  }
  function cancelPhotoPreparation() {
    photoController.current?.abort(); photoController.current = null; editorVersion.current++; setPreparingPhotos(false);
  }
  function start(phone?: PhoneListing) {
    cancelPhotoPreparation();
    setEditing(phone ? fromPhone(phone) : { ...blank, images: [] }); replaceNewPhotos([]); setFormError(""); setFieldErrors({}); setPhotoError(""); setConflict(false); setConfirmReload(false); setNotice(""); setDeleting(null);
  }
  function closeEditor() { cancelPhotoPreparation(); setEditing(null); replaceNewPhotos([]); setFormError(""); setFieldErrors({}); setPhotoError(""); setConflict(false); setConfirmReload(false); }
  function update<K extends keyof Editing>(field: K, value: Editing[K]) {
    setEditing((current) => current ? { ...current, [field]: value } : current);
    setFormError("");
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    if (field === "images") setPhotoError("");
  }
  async function addPhotos(selected: FileList | null) {
    const incoming = selected ? Array.from(selected) : [];
    // Keep the input reusable, including after a rejected selection.
    if (photoInput.current) photoInput.current.value = "";
    if (!editing || !incoming.length || saving || reloading || photoController.current) return;
    if (editing.images.length + files.length + incoming.length > MAX_PHONE_PHOTOS) { setPhotoError("Vous pouvez ajouter 4 photos au maximum. Retirez une photo pour en ajouter une autre."); return; }
    try { incoming.forEach(validatePhonePhoto); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : "Choisissez des photos JPEG, PNG ou WebP."); return; }
    const controller = new AbortController();
    const version = editorVersion.current;
    photoController.current = controller;
    setPreparingPhotos(true); setPhotoError("");
    try {
      const prepared: File[] = [];
      // Sequential decoding bounds memory use for large originals on mobile devices.
      for (const file of incoming) prepared.push(await preparePhonePhoto(file, controller.signal));
      if (mounted.current && !controller.signal.aborted && editorVersion.current === version && photoController.current === controller) {
        replaceNewPhotos([...newPhotosRef.current, ...prepared.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted && editorVersion.current === version && photoController.current === controller) {
        setPhotoError(error instanceof Error ? error.message : "Les photos n’ont pas pu être préparées. Vos photos précédentes sont conservées.");
      }
    } finally {
      if (photoController.current === controller) { photoController.current = null; if (mounted.current) setPreparingPhotos(false); }
    }
  }
  function showFieldErrors(nextErrors: FieldErrors) {
    setFieldErrors(nextErrors);
    const field = Object.keys(nextErrors)[0];
    window.requestAnimationFrame(() => editorRef.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus());
  }
  async function reloadEditing() {
    if (!editing?.id || reloading || saving) return;
    const editingId = editing.id;
    setReloading(true); setFormError("");
    try {
      const { response, data } = await fetchClientJson<{ phones?: PhoneListing[]; error?: string }>("/api/admin/phones", { cache: "no-store" }, {
        timeoutMessage: "La fiche met trop de temps à répondre. Vos saisies sont conservées ; vous pouvez réessayer.",
      });
      if (!response.ok || !Array.isArray(data.phones)) throw new Error(data.error || "La fiche n’a pas pu être rechargée. Vos saisies sont conservées.");
      const latest = data.phones.find((phone) => phone.id === editingId);
      if (!latest) throw new Error("Cette annonce a été supprimée. Vos saisies sont conservées dans le formulaire, mais cette fiche ne peut plus être enregistrée.");
      setPhones((current) => [latest, ...current.filter((phone) => phone.id !== latest.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      start(latest);
    } catch (error) { setFormError(error instanceof Error ? error.message : "La fiche n’a pas pu être rechargée. Vos saisies sont conservées."); }
    finally { setReloading(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing || saving || reloading || preparingPhotos || photoController.current) return;
    setFormError(""); setNotice("");
    const nextErrors: FieldErrors = {};
    if (!editing.brand.trim()) nextErrors.brand = "Indiquez la marque du téléphone.";
    if (!editing.model.trim()) nextErrors.model = "Indiquez le modèle du téléphone.";
    const normalizedPrice = editing.price.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedPrice)) nextErrors.price = "Indiquez un prix en euros, avec au maximum deux décimales.";
    const priceCents = Math.round(Number(normalizedPrice) * 100);
    if (!nextErrors.price && (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 1000000)) nextErrors.price = "Le prix doit être compris entre 0,01 € et 10 000 €.";
    const battery = editing.battery.trim() === "" ? null : Number(editing.battery);
    if (battery !== null && (!Number.isInteger(battery) || battery < 0 || battery > 100)) nextErrors.battery = "L’état de la batterie doit être un nombre entier entre 0 et 100 %, ou rester vide.";
    if (Object.keys(nextErrors).length) { showFieldErrors(nextErrors); return; }
    setFieldErrors({});
    const data = new FormData();
    data.append("listing", JSON.stringify({ brand: editing.brand.trim(), model: editing.model.trim(), storage: editing.storage.trim(), color: editing.color.trim(), condition: editing.condition, priceCents, battery, description: editing.description.trim(), status: editing.status, images: editing.images, ...(editing.id ? { expectedVersion: editing.version } : {}) }));
    files.forEach((file) => data.append("photos", file));
    // An older list response must not overwrite the just-saved announcement.
    loadController.current?.abort(); setLoading(false);
    setSaving(true);
    try {
      const { response, data: result } = await fetchClientJson<{ phone?: PhoneListing; error?: string }>(editing.id ? `/api/admin/phones/${encodeURIComponent(editing.id)}` : "/api/admin/phones", { method: editing.id ? "PUT" : "POST", body: data }, {
        timeoutMs: 45_000,
        timeoutMessage: "L’enregistrement n’a pas pu être confirmé dans le délai prévu. Vos saisies et vos photos sont conservées. Réessayez dans quelques instants.",
      });
      if (response.status === 409) { setConflict(true); setConfirmReload(false); }
      if (!response.ok || !result.phone) throw new Error(result.error || "L’annonce n’a pas été enregistrée. Réessayez.");
      const saved = result.phone;
      setPhones((current) => [saved, ...current.filter((phone) => phone.id !== saved.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      closeEditor();
      setNotice(saved.status === "published" ? "L’annonce est enregistrée et visible dans le catalogue." : saved.status === "sold" ? "L’appareil est marqué comme vendu. Il n’apparaît plus dans le catalogue." : "Le brouillon est enregistré. Il n’apparaît pas encore dans le catalogue.");
    } catch (error) { setFormError(error instanceof Error ? error.message : "L’annonce n’a pas été enregistrée. Réessayez."); }
    finally { setSaving(false); }
  }
  async function remove(phone: PhoneListing) {
    if (deleteBusy || saving || reloading) return;
    loadController.current?.abort(); setLoading(false);
    setDeleteBusy(true); setPageError(""); setNotice("");
    try {
      const { response, data: result } = await fetchClientJson<{ error?: string }>(`/api/admin/phones/${encodeURIComponent(phone.id)}`, { method: "DELETE" }, {
        timeoutMessage: "La suppression n’a pas pu être confirmée. Actualisez vos annonces avant de réessayer.",
      });
      if (!response.ok) throw new Error(result.error || "L’annonce n’a pas été supprimée.");
      setPhones((current) => current.filter((item) => item.id !== phone.id));
      if (editing?.id === phone.id) closeEditor();
      setDeleting(null); setNotice("L’annonce a été supprimée.");
    } catch (error) { setPageError(error instanceof Error ? error.message : "L’annonce n’a pas été supprimée."); }
    finally { setDeleteBusy(false); }
  }

  return <div className="catalog-site"><CatalogHeader management /><main className="container manager-main" id="contenu">{vercelOwner && <OwnerControls />}<a className="catalog-back" href="/telephones"><ArrowLeft size={15} aria-hidden="true" />Voir le catalogue</a><div className="manager-intro"><div><p className="eyebrow">VOTRE ESPACE DE GESTION</p><h1>Les téléphones<br /><span>que vous proposez.</span></h1><p>Ajoutez vos appareils, leurs photos et leur prix. Vous choisissez quand chaque annonce devient visible.</p></div><button type="button" className="button button-primary button-large" onClick={() => start()} disabled={saving || reloading || deleteBusy}><Plus size={18} aria-hidden="true" />Ajouter un téléphone</button></div><div className="manager-status-explainer"><span><span className="listing-status status-draft">Brouillon</span>Visible uniquement ici</span><span><span className="listing-status status-published">En vente</span>Visible dans le catalogue</span><span><span className="listing-status status-sold">Vendu</span>Retiré du catalogue</span></div>{notice && <div className="manager-notice" role="status"><Check size={18} aria-hidden="true" /><p>{notice}</p><button type="button" aria-label="Fermer la confirmation" onClick={() => setNotice("")}><X size={18} /></button></div>}{pageError && <div className="manager-error" role="alert"><p>{pageError}</p><button className="quiet-link" type="button" onClick={() => void load()} disabled={loading || saving || reloading || deleteBusy}>Réessayer<RefreshCw size={15} aria-hidden="true" /></button></div>}{editing && <section className="manager-editor" ref={editorRef} aria-labelledby="editor-title"><div className="manager-editor-heading"><div><p className="eyebrow">{editing.id ? "MODIFIER L’ANNONCE" : "UNE NOUVELLE ANNONCE"}</p><h2 id="editor-title">{editing.id ? "La fiche de votre appareil." : "Présentons votre téléphone."}</h2></div><button type="button" className="catalog-close" aria-label="Fermer le formulaire" disabled={saving || reloading} onClick={closeEditor}><X size={22} /></button></div><form onSubmit={save} aria-busy={saving || reloading || preparingPhotos}><fieldset disabled={saving || reloading}><div className="manager-form-grid"><label>Marque <span className="field-required">*</span><input ref={firstField} name="brand" aria-invalid={Boolean(fieldErrors.brand)} aria-describedby={fieldErrors.brand ? "manager-brand-error" : undefined} required maxLength={60} value={editing.brand} onChange={(event) => update("brand", event.target.value)} placeholder="Samsung, Apple, Google…" autoComplete="off" />{fieldErrors.brand && <span className="manager-field-error" id="manager-brand-error">{fieldErrors.brand}</span>}</label><label>Modèle <span className="field-required">*</span><input name="model" aria-invalid={Boolean(fieldErrors.model)} aria-describedby={fieldErrors.model ? "manager-model-error" : undefined} required maxLength={120} value={editing.model} onChange={(event) => update("model", event.target.value)} placeholder="Le nom précis de l’appareil" autoComplete="off" />{fieldErrors.model && <span className="manager-field-error" id="manager-model-error">{fieldErrors.model}</span>}</label><label>Stockage<input name="storage" maxLength={40} value={editing.storage} onChange={(event) => update("storage", event.target.value)} placeholder="128 Go" autoComplete="off" /></label><label>Couleur<input name="color" maxLength={60} value={editing.color} onChange={(event) => update("color", event.target.value)} placeholder="Noir, bleu, blanc…" autoComplete="off" /></label><label>État de l’appareil <span className="field-required">*</span><select name="condition" value={editing.condition} onChange={(event) => update("condition", event.target.value as Editing["condition"])}>{Object.entries(conditionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Prix en euros <span className="field-required">*</span><div className="manager-input-unit"><input name="price" aria-invalid={Boolean(fieldErrors.price)} aria-describedby={fieldErrors.price ? "manager-price-error" : undefined} inputMode="decimal" required maxLength={9} value={editing.price} onChange={(event) => update("price", event.target.value)} placeholder="250,00" /><span aria-hidden="true">€</span></div>{fieldErrors.price && <span className="manager-field-error" id="manager-price-error">{fieldErrors.price}</span>}</label><label>État de la batterie<div className="manager-input-unit"><input name="battery" aria-invalid={Boolean(fieldErrors.battery)} aria-describedby={fieldErrors.battery ? "manager-battery-error" : "manager-battery-help"} type="number" min={0} max={100} step={1} value={editing.battery} onChange={(event) => update("battery", event.target.value)} placeholder="Facultatif" /><span aria-hidden="true">%</span></div>{fieldErrors.battery && <span className="manager-field-error" id="manager-battery-error">{fieldErrors.battery}</span>}<small id="manager-battery-help">Laissez vide si cette information n’est pas disponible.</small></label><label>Visibilité de l’annonce<select name="status" value={editing.status} onChange={(event) => update("status", event.target.value as Editing["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>Un brouillon reste privé jusqu’à votre publication.</small></label><label className="manager-full-field">Description<textarea name="description" rows={5} maxLength={3000} value={editing.description} onChange={(event) => update("description", event.target.value)} placeholder="Décrivez l’état réel, les éventuelles marques d’usure, les accessoires inclus et les informations utiles." /><small>{editing.description.length} / 3 000 caractères</small></label></div><div className="manager-photos"><div><h3>Photos de l’appareil</h3><p>Jusqu’à 4 photos · JPG, PNG ou WebP · Photos optimisées automatiquement avant envoi.</p></div><div className="manager-photo-grid">{editing.images.map((url, index) => <div className="manager-photo" key={url}><img src={url} alt={`Photo enregistrée ${index + 1}`} width="220" height="220" /><button type="button" aria-label={`Retirer la photo enregistrée ${index + 1}`} onClick={() => update("images", editing.images.filter((image) => image !== url))}><X size={17} /></button><span>Enregistrée</span></div>)}{previews.map((url, index) => <div className="manager-photo" key={url}><img src={url} alt={`Nouvelle photo ${index + 1}`} width="220" height="220" /><button type="button" aria-label={`Retirer la nouvelle photo ${index + 1}`} onClick={() => { replaceNewPhotos(newPhotosRef.current.filter((_, itemIndex) => itemIndex !== index)); setPhotoError(""); }}><X size={17} /></button><span>Nouvelle photo</span></div>)}{editing.images.length + files.length < MAX_PHONE_PHOTOS && <button type="button" className="manager-photo-add" disabled={preparingPhotos} onClick={() => photoInput.current?.click()}><ImagePlus size={26} strokeWidth={1.4} aria-hidden="true" /><span>{preparingPhotos ? "Préparation des photos…" : "Ajouter des photos"}</span></button>}</div><input ref={photoInput} className="sr-only" aria-label="Choisir des photos du téléphone" aria-describedby={photoError ? "manager-photo-error" : undefined} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={preparingPhotos} onChange={(event) => void addPhotos(event.target.files)} />{photoError && <p ref={photoErrorRef} tabIndex={-1} id="manager-photo-error" className="manager-form-error" role="alert">{photoError}</p>}</div>{formError && <p ref={formErrorRef} tabIndex={-1} className="manager-form-error" role="alert">{formError}</p>}{conflict && <div className="manager-conflict" role="status"><p>Vos saisies restent dans le formulaire. Rechargez la fiche actuelle pour éviter de remplacer les changements enregistrés depuis un autre appareil.</p>{confirmReload ? <div className="manager-conflict-confirm"><p><strong>Recharger remplacera vos modifications non enregistrées et vos nouvelles photos par la dernière fiche enregistrée.</strong></p><div><button className="button manager-cancel" type="button" onClick={() => setConfirmReload(false)}>Conserver mes saisies</button><button className="button button-primary" type="button" onClick={() => void reloadEditing()}>{reloading ? "Rechargement…" : "Confirmer le rechargement"}</button></div></div> : <button type="button" className="quiet-link" onClick={() => setConfirmReload(true)}><RefreshCw size={15} aria-hidden="true" />Recharger la fiche</button>}</div>}<div className="manager-editor-actions"><p><span className="field-required">*</span> Champs obligatoires. Les photos sont facultatives.</p><div><button className="button manager-cancel" type="button" onClick={closeEditor}>Annuler</button><button className="button button-primary" type="submit" disabled={preparingPhotos}><Save size={17} aria-hidden="true" />{saving ? "Enregistrement…" : reloading ? "Rechargement…" : preparingPhotos ? "Préparation des photos…" : "Enregistrer l’annonce"}</button></div></div></fieldset></form></section>}<section className="manager-list" aria-labelledby="manager-list-title"><div className="catalog-list-heading"><h2 id="manager-list-title">Vos annonces</h2><button type="button" className="quiet-link" onClick={() => void load()} disabled={loading || saving || reloading || deleteBusy}><RefreshCw size={15} aria-hidden="true" />Actualiser</button></div>{loading ? <div className="catalog-state" role="status"><span className="catalog-loader" /><p>Chargement de vos annonces…</p></div> : phones.length === 0 && !pageError ? <div className="manager-empty"><PhonePlaceholder label="" /><h3>Votre première annonce commence ici.</h3><p>Ajoutez un téléphone puis enregistrez-le en brouillon ou mettez-le directement en vente.</p><button className="quiet-link" type="button" onClick={() => start()} disabled={saving || reloading || deleteBusy}>Ajouter mon premier téléphone<ArrowRight size={16} aria-hidden="true" /></button></div> : <div className="manager-list-items">{phones.map((phone) => <article className="manager-list-card" key={phone.id}><div className="manager-list-photo">{phone.images[0] ? <img src={phone.images[0]} alt={`${phone.brand} ${phone.model}`} width="150" height="150" /> : <PhonePlaceholder label="" />}</div><div className="manager-list-copy"><div><span className={`listing-status status-${phone.status}`}>{statusLabels[phone.status]}</span><span className="manager-list-condition">{conditionLabels[phone.condition]}</span></div><h3>{phone.brand} {phone.model}</h3><p>{[phone.storage, phone.color].filter(Boolean).join(" · ") || "Caractéristiques à compléter"}</p><strong>{formatPrice(phone.priceCents)}</strong></div><div className="manager-list-actions"><button type="button" className="quiet-link" onClick={() => start(phone)} disabled={saving || reloading || deleteBusy}><Pencil size={16} aria-hidden="true" />Modifier</button><button type="button" className="quiet-link manager-delete" onClick={() => { setDeleting(phone.id); setPageError(""); }} disabled={saving || reloading || deleteBusy}><Trash2 size={16} aria-hidden="true" />Supprimer</button></div>{deleting === phone.id && <div className="manager-delete-confirm" role="alert"><div><strong>Supprimer cette annonce ?</strong><p>{phone.brand} {phone.model} sera retiré de votre liste et du catalogue.</p></div><div><button type="button" className="button manager-cancel" onClick={() => setDeleting(null)} disabled={deleteBusy}>Conserver</button><button type="button" className="button manager-delete-button" onClick={() => void remove(phone)} disabled={deleteBusy}>{deleteBusy ? "Suppression…" : "Supprimer l’annonce"}</button></div></div>}</article>)}</div>}</section></main><CatalogFooter management /></div>;
}
