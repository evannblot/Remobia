"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Download, LoaderCircle, X } from "lucide-react";
import type { PhoneListing } from "../lib/catalog";
import "./interest.css";
import { fetchClientJson } from "../lib/client-requests";
import { isValidEmail } from "../lib/email-validation.mjs";

type Contact = { name: string; email: string; phone: string; message: string; consent: boolean; website: string };
type Errors = Partial<Record<"name" | "email" | "phone" | "consent", string>>;
type Completion = { kind: "draft" } | { kind: "sent"; reference: string };

function price(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value / 100);
}

function validate(contact: Contact): Errors {
  const errors: Errors = {};
  if (contact.name.trim().length < 2) errors.name = "Indiquez votre prénom (au moins 2 caractères).";
  const email = contact.email.trim();
  if (!isValidEmail(email)) {
    errors.email = "Indiquez une adresse email valide, par exemple vous@exemple.fr.";
  }
  const phone = contact.phone.trim();
  if (phone && (!/^\+?[0-9 ().-]{6,30}$/.test(phone) || phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 15)) {
    errors.phone = "Vérifiez le numéro de téléphone, ou laissez ce champ vide.";
  }
  if (!contact.consent) errors.consent = "Votre accord est nécessaire pour pouvoir répondre à votre demande.";
  return errors;
}

export default function PhoneInterest({ phone, onClose }: { phone: PhoneListing; onClose: () => void }) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "", message: "", consent: false, website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [canCopy, setCanCopy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCanCopy(Boolean(navigator.clipboard?.writeText));
    fetchClientJson<unknown>("/api/phone-interest", { cache: "no-store", signal: controller.signal }, { timeoutMs: 8000 })
      .then(({ response, data }) => {
        if (!response.ok) throw new Error("Unavailable");
        if (active && !controller.signal.aborted) setAvailable(!!data && typeof data === "object" && "available" in data && data.available === true);
      })
      .catch(() => { if (active) setAvailable(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [completion]);

  function update<K extends keyof Contact>(key: K, value: Contact[K]) {
    setContact((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setSubmitError("");
  }

  function recap(): string {
    return [
      "Demande d’information — REMOBIA, Laval", "",
      completion?.kind === "sent" ? `Référence : ${completion.reference}` : "Brouillon : cette demande n’a pas été envoyée.", "",
      `Téléphone : ${phone.brand} ${phone.model}`, `Stockage : ${phone.storage || "Non renseigné"}`,
      `Couleur : ${phone.color || "Non renseignée"}`, `Prix affiché : ${price(phone.priceCents)}`, `Annonce : ${phone.id}`, "",
      `Prénom : ${contact.name.trim()}`, `Email : ${contact.email.trim()}`, `Téléphone : ${contact.phone.trim() || "Non renseigné"}`, "",
      "Message :", contact.message.trim() || "Bonjour, ce téléphone m’intéresse. Est-il encore disponible ?", "",
      "Cette demande ne vaut ni réservation, ni commande, ni paiement.",
    ].join("\n");
  }

  function download() {
    const url = URL.createObjectURL(new Blob([recap()], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ma-demande-telephone.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(recap()); setCopyStatus("Le récapitulatif a été copié."); }
    catch { setCopyStatus("La copie est indisponible. Vous pouvez télécharger le récapitulatif."); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || available === null) return;
    const nextErrors = validate(contact);
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.values(nextErrors).some(Boolean)) {
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    if (contact.website.trim()) { setSubmitError("Cette demande ne peut pas être envoyée."); return; }
    if (!available) { setCompletion({ kind: "draft" }); return; }
    setSending(true);
    try {
      const { response, data: raw } = await fetchClientJson<unknown>("/api/phone-interest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, phoneId: phone.id }),
      }, {
        timeoutMs: 20_000,
        timeoutMessage: "L’envoi n’a pas pu être confirmé dans le délai prévu. Vos réponses sont conservées. Réessayez dans quelques instants.",
        networkMessage: "L’envoi n’a pas pu être confirmé. Vérifiez votre connexion puis réessayez.",
      });
      const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      if (!response.ok || data.success !== true || typeof data.reference !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "L’envoi n’a pas pu être confirmé. Réessayez dans quelques instants.");
      }
      setCompletion({ kind: "sent", reference: data.reference });
    } catch (error) {
      setSubmitError(error instanceof Error && error.name !== "AbortError" ? error.message : "L’envoi n’a pas pu être confirmé. Réessayez dans quelques instants.");
    } finally { setSending(false); }
  }

  const summary = (
    <div className="pi-phone-summary">
      <div><strong>{phone.brand} {phone.model}</strong><span>{[phone.storage, phone.color].filter(Boolean).join(" · ")}</span></div>
      <strong className="pi-price">{price(phone.priceCents)}</strong>
    </div>
  );

  return (
    <section className="phone-interest" aria-labelledby={`${id}-title`}>
      <button className="pi-close" type="button" onClick={onClose} aria-label="Fermer la demande"><X size={20} /></button>
      <p className="pi-eyebrow">Téléphones à vendre</p>
      {completion ? (
        <div className="pi-completion">
          <div className="pi-completion-mark"><Check size={25} /></div>
          <h2 id={`${id}-title`} tabIndex={-1} ref={headingRef}>{completion.kind === "sent" ? "Votre demande a été envoyée." : "Votre demande est prête."}</h2>
          {completion.kind === "draft" ? (
            <><p className="pi-not-sent">Elle n’a pas été envoyée.</p><p className="pi-intro">L’envoi par email est actuellement indisponible. Conservez votre récapitulatif pour le transmettre lorsque le service sera ouvert.</p></>
          ) : (
            <><p className="pi-intro">Nous avons reçu votre demande pour ce téléphone. Nous vous répondrons par email pour confirmer sa disponibilité et les modalités.</p><p className="pi-reference">Référence : {completion.reference}</p></>
          )}
          {summary}
          <div className="pi-recap"><p><strong>Votre contact</strong><br />{contact.name.trim()} · {contact.email.trim()}{contact.phone.trim() && <><br />{contact.phone.trim()}</>}</p><p><strong>Votre message</strong><br />{contact.message.trim() || "Bonjour, ce téléphone m’intéresse. Est-il encore disponible ?"}</p></div>
          <p className="pi-help">La demande ne réserve pas le téléphone et n’engage aucun achat.</p>
          <div className="pi-actions"><button className="pi-button pi-primary" type="button" onClick={download}><Download size={16} /> Télécharger le récapitulatif</button>{canCopy && <button className="pi-button pi-secondary" type="button" onClick={copy}><Copy size={16} /> Copier</button>}</div>
          <p className="pi-copy-status" role="status">{copyStatus}</p>
          <div className="pi-actions"><button className="pi-text-button" type="button" onClick={() => { setCompletion(null); setCopyStatus(""); }}>Modifier ma demande</button><button className="pi-text-button" type="button" onClick={onClose}>Retour aux téléphones</button></div>
        </div>
      ) : (
        <>
          <h2 id={`${id}-title`} tabIndex={-1} ref={headingRef}>Ce téléphone vous intéresse ?</h2>
          <p className="pi-intro">Laissez vos coordonnées et votre question. Nous échangerons avec vous avant toute décision.</p>
          {summary}
          {available === false && <p className="pi-draft-notice">L’envoi par email n’est pas encore disponible. Ce formulaire prépare uniquement un récapitulatif à conserver : aucune demande ne sera envoyée.</p>}
          <form ref={formRef} onSubmit={submit} noValidate>
            <fieldset className="pi-fields" disabled={sending}>
            <div className="pi-field"><label htmlFor={`${id}-name`}>Prénom <span>obligatoire</span></label><input id={`${id}-name`} name="name" autoComplete="given-name" maxLength={100} value={contact.name} onChange={(event) => update("name", event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-error` : undefined} />{errors.name && <p className="pi-error" id={`${id}-name-error`}>{errors.name}</p>}</div>
            <div className="pi-field"><label htmlFor={`${id}-email`}>Email <span>obligatoire</span></label><input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="vous@exemple.fr" value={contact.email} onChange={(event) => update("email", event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-error` : undefined} />{errors.email && <p className="pi-error" id={`${id}-email-error`}>{errors.email}</p>}</div>
            <div className="pi-field"><label htmlFor={`${id}-phone`}>Téléphone <span>facultatif</span></label><input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={30} value={contact.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${id}-phone-error` : undefined} />{errors.phone && <p className="pi-error" id={`${id}-phone-error`}>{errors.phone}</p>}</div>
            <div className="pi-field"><label htmlFor={`${id}-message`}>Votre message <span>facultatif</span></label><textarea id={`${id}-message`} name="message" maxLength={3000} rows={3} placeholder="Une question sur le téléphone, son état ou la remise à Laval ?" value={contact.message} onChange={(event) => update("message", event.target.value)} /></div>
            <div className="pi-honeypot" aria-hidden="true"><label htmlFor={`${id}-website`}>Site internet</label><input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" value={contact.website} onChange={(event) => update("website", event.target.value)} /></div>
            <label className="pi-consent" htmlFor={`${id}-consent`}><input id={`${id}-consent`} name="consent" type="checkbox" checked={contact.consent} onChange={(event) => update("consent", event.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${id}-consent-error` : undefined} /><span>J’accepte l’utilisation de mes coordonnées pour répondre à cette demande.</span></label>
            {errors.consent && <p className="pi-error" id={`${id}-consent-error`}>{errors.consent}</p>}
            <p className="pi-help">Vos coordonnées servent à cet échange. <a href="/confidentialite" target="_blank" rel="noreferrer">Confidentialité</a>.</p>
            </fieldset>
            {submitError && <p className="pi-submit-error" role="alert">{submitError}</p>}
            <div className="pi-submit"><button className="pi-button pi-primary" type="submit" disabled={sending || available === null}>{sending ? <><LoaderCircle className="pi-spinner" size={16} /> Envoi en cours…</> : available === null ? "Vérification de l’envoi…" : available ? "Envoyer ma demande" : "Préparer ma demande"}</button><p>Sans réservation, sans paiement.</p></div>
          </form>
        </>
      )}
    </section>
  );
}
