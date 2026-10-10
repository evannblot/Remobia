"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Camera,
  Check,
  CircleHelp,
  Copy,
  Download,
  Droplets,
  LoaderCircle,
  Plug,
  Power,
  Smartphone,
  Volume2,
} from "lucide-react";
import "./quote.css";
import { fetchClientJson } from "../lib/client-requests";
import { isValidEmail } from "../lib/email-validation.mjs";

type Quality = "budget" | "quality" | "advice";
type Handoff = "discuss" | "dropoff" | "laval";
type Step = 1 | 2 | 3;
type IssueCode = "screen" | "battery" | "charging" | "camera" | "audio" | "water" | "power" | "other";
type FormData = {
  brand: string;
  model: string;
  modelUnknown: boolean;
  issues: IssueCode[];
  description: string;
  quality: Quality;
  handoff: Handoff;
  name: string;
  email: string;
  phone: string;
  consent: boolean;
  website: string;
};
type Errors = Partial<Record<"brand" | "model" | "issues" | "description" | "name" | "email" | "phone" | "consent", string>>;
type Completion = { kind: "draft" } | { kind: "sent"; reference: string };

const issues = [
  { code: "screen", label: "Écran / tactile", detail: "Vitre cassée, affichage ou toucher", icon: Smartphone },
  { code: "battery", label: "Batterie", detail: "Autonomie ou batterie fatiguée", icon: BatteryCharging },
  { code: "charging", label: "Charge", detail: "Charge lente ou impossible", icon: Plug },
  { code: "camera", label: "Appareil photo", detail: "Image floue ou caméra en panne", icon: Camera },
  { code: "audio", label: "Son / microphone", detail: "Écoute, appels ou enregistrement", icon: Volume2 },
  { code: "water", label: "Contact avec un liquide", detail: "Humidité ou téléphone mouillé", icon: Droplets },
  { code: "power", label: "Ne démarre plus", detail: "Téléphone bloqué ou éteint", icon: Power },
  { code: "other", label: "Autre / je ne sais pas", detail: "Décrivez simplement ce que vous voyez", icon: CircleHelp },
] as const;

const qualityOptions: { value: Quality; label: string; detail: string }[] = [
  { value: "budget", label: "Budget maîtrisé", detail: "Le coût compte avant tout." },
  { value: "quality", label: "Priorité à la qualité", detail: "Je privilégie la qualité de la pièce." },
  { value: "advice", label: "J’ai besoin d’un conseil", detail: "Aidez-moi à choisir." },
];

const handoffOptions: { value: Handoff; label: string }[] = [
  { value: "discuss", label: "À définir ensemble" },
  { value: "dropoff", label: "Je préfère déposer mon téléphone" },
  { value: "laval", label: "Je souhaite un déplacement à Laval" },
];

function initialIssueCode(value?: string): IssueCode | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const direct = issues.find((issue) => issue.code === normalized);
  if (direct) return direct.code;
  if (normalized.includes("ecran")) return "screen";
  if (normalized.includes("batterie")) return "battery";
  if (normalized.includes("charge")) return "charging";
  if (normalized.includes("camera") || normalized.includes("photo")) return "camera";
  if (normalized.includes("son") || normalized.includes("micro")) return "audio";
  if (normalized.includes("humid") || normalized.includes("liquide")) return "water";
  if (normalized.includes("demarr")) return "power";
  return undefined;
}

function deviceLabel(form: FormData): string {
  const brand = form.brand === "Apple" ? "iPhone (Apple)" : form.brand;
  return form.modelUnknown ? `${brand} · modèle à identifier` : `${brand} · ${form.model.trim()}`;
}

function issueLabels(codes: IssueCode[]): string {
  return issues.filter((issue) => codes.includes(issue.code)).map((issue) => issue.label).join(", ");
}

function validate(form: FormData, step: Step): Errors {
  const errors: Errors = {};
  if (step === 1 && !form.brand) errors.brand = "Choisissez la marque, ou « Autre / je ne sais pas ».";
  if (step === 1 && !form.modelUnknown && !form.model.trim()) {
    errors.model = "Indiquez le modèle, ou cochez « Je ne connais pas le modèle ».";
  }
  if (step === 2) {
    if (!form.issues.length) errors.issues = "Choisissez au moins un problème. « Je ne sais pas » est aussi possible.";
    if (!form.description.trim()) {
      errors.description = "Décrivez ce que vous constatez, même en quelques mots.";
    }
  }
  if (step === 3) {
    if (form.name.trim().length < 2) errors.name = "Indiquez votre prénom (au moins 2 caractères).";
    if (!isValidEmail(form.email.trim())) {
      errors.email = "Indiquez une adresse email valide, par exemple vous@exemple.fr.";
    }
    const phone = form.phone.trim();
    if (phone && (!/^\+?[0-9 ().-]{6,30}$/.test(phone) || phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 15)) {
      errors.phone = "Vérifiez le numéro de téléphone, ou laissez ce champ vide.";
    }
    if (!form.consent) errors.consent = "Votre accord est nécessaire pour pouvoir répondre à votre demande.";
  }
  return errors;
}

export default function QuoteWizard({ initialIssue, onClose }: { initialIssue?: string; onClose?: () => void }) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef("");
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(() => {
    const selected = initialIssueCode(initialIssue);
    return {
      brand: "", model: "", modelUnknown: false, issues: selected ? [selected] : [],
      description: "", quality: "advice", handoff: "discuss", name: "", email: "", phone: "",
      consent: false, website: "",
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [canCopy, setCanCopy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchClientJson<unknown>("/api/quotes", { signal: controller.signal, cache: "no-store" }, { timeoutMs: 8000 })
      .then(({ response, data }) => {
        if (!response.ok) throw new Error("Service indisponible");
        if (active && !controller.signal.aborted) setAvailable(!!data && typeof data === "object" && "available" in data && data.available === true);
      })
      .catch(() => { if (active) setAvailable(false); })
      .finally(() => { if (active) setCanCopy(Boolean(navigator.clipboard?.writeText)); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [step, completion]);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError("");
  }

  function focusError(nextErrors: Errors) {
    setErrors(nextErrors);
    requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  function goNext() {
    const nextErrors = validate(form, step);
    if (Object.keys(nextErrors).length) {
      focusError(nextErrors);
      return;
    }
    setErrors({});
    setStep((current) => (current < 3 ? (current + 1) as Step : current));
  }

  function goTo(target: Step) {
    setErrors({});
    setSubmitError("");
    setStep(target);
  }

  function toggleIssue(code: IssueCode) {
    update("issues", form.issues.includes(code)
      ? form.issues.filter((value) => value !== code)
      : [...form.issues, code]);
  }

  async function finish() {
    if (sending || available === null) return;
    for (const currentStep of [1, 2, 3] as const) {
      const nextErrors = validate(form, currentStep);
      if (Object.keys(nextErrors).length) {
        setStep(currentStep);
        focusError(nextErrors);
        return;
      }
    }
    setErrors({});
    setSubmitError("");
    if (!available) {
      setCompletion({ kind: "draft" });
      return;
    }
    setSending(true);
    try {
      const { response, data: raw } = await fetchClientJson<unknown>("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestId: requestIdRef.current || (requestIdRef.current = crypto.randomUUID()),
          model: form.modelUnknown ? "" : form.model.trim(),
          description: form.description.trim(), name: form.name.trim(),
          email: form.email.trim(), phone: form.phone.trim(),
        }),
      }, {
        timeoutMs: 20_000,
        timeoutMessage: "L’envoi n’a pas pu être confirmé dans le délai prévu. Vos réponses sont conservées. Réessayez dans quelques instants.",
        networkMessage: "L’envoi n’a pas pu être confirmé. Vérifiez votre connexion puis réessayez.",
      });
      const data = raw && typeof raw === "object" ? raw as { success?: boolean; reference?: string; error?: string; message?: string } : {};
      if (!response.ok || data.success !== true) {
        const message = data.error || data.message;
        throw new Error(typeof message === "string" && message.length < 400 ? message : "L’envoi de votre demande n’a pas pu être confirmé. Réessayez dans un instant.");
      }
      setCompletion({ kind: "sent", reference: data.reference || "" });
    } catch (error) {
      setSubmitError(error instanceof Error && error.message !== "Failed to fetch"
        ? error.message
        : "L’envoi n’a pas pu être confirmé. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSending(false);
    }
  }

  function plainText(): string {
    return [
      "REMOBIA LAVAL — DEMANDE DE DEVIS",
      "Demande préparée, non envoyée.", "",
      `Téléphone : ${deviceLabel(form)}`,
      `Problème(s) : ${issueLabels(form.issues)}`,
      ...(form.description.trim() ? [`Précisions : ${form.description.trim()}`] : []),
      `Préférence : ${qualityOptions.find((option) => option.value === form.quality)?.label}`,
      `Prise en charge souhaitée : ${handoffOptions.find((option) => option.value === form.handoff)?.label}`,
      "Modalités de prise en charge à confirmer après échange.", "",
      `Prénom : ${form.name.trim()}`, `Email : ${form.email.trim()}`,
      ...(form.phone.trim() ? [`Téléphone : ${form.phone.trim()}`] : []),
      "", "Cette demande ne constitue pas un devis chiffré.",
    ].join("\n");
  }

  function download() {
    const url = URL.createObjectURL(new Blob([plainText()], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ma-demande-remobia-laval.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText());
      setCopyMessage("Votre demande a été copiée.");
    } catch {
      setCopyMessage("La copie n’a pas été autorisée par votre navigateur. Vous pouvez télécharger la demande.");
    }
  }

  function summary(editable: boolean) {
    return (
      <div className="qw-summary">
        <div className="qw-summary-title"><h3>Votre récapitulatif</h3><span>Demande gratuite</span></div>
        <div className="qw-summary-section">
          <div className="qw-summary-label"><span>Votre téléphone</span>{editable && <button type="button" onClick={() => goTo(1)}>Modifier<span className="qw-sr-only"> le téléphone</span></button>}</div>
          <p>{deviceLabel(form)}</p>
        </div>
        <div className="qw-summary-section">
          <div className="qw-summary-label"><span>Le problème</span>{editable && <button type="button" onClick={() => goTo(2)}>Modifier<span className="qw-sr-only"> les problèmes et les préférences</span></button>}</div>
          <p>{issueLabels(form.issues)}</p>
          {form.description.trim() && <p className="qw-summary-note">{form.description.trim()}</p>}
        </div>
        <div className="qw-summary-section">
          <div className="qw-summary-label"><span>Vos préférences</span></div>
          <p>{qualityOptions.find((option) => option.value === form.quality)?.label}</p>
          <p>{handoffOptions.find((option) => option.value === form.handoff)?.label}</p>
          <small>Les modalités et les pièces disponibles seront confirmées après échange.</small>
        </div>
        {!editable && <div className="qw-summary-section">
          <div className="qw-summary-label"><span>Vos coordonnées</span></div>
          <p>{form.name.trim()}</p><p>{form.email.trim()}</p>
          {form.phone.trim() && <p>{form.phone.trim()}</p>}
        </div>}
      </div>
    );
  }

  if (completion) {
    const isDraft = completion.kind === "draft";
    return (
      <div className="quote-wizard qw-completion" ref={containerRef}>
        <div className="qw-completion-mark" aria-hidden="true"><Check size={28} /></div>
        <p className="qw-eyebrow">{isDraft ? "Récapitulatif personnel" : "Demande reçue"}</p>
        <h2 ref={headingRef} tabIndex={-1}>{isDraft ? "Votre demande est prête" : "Votre demande a bien été envoyée"}</h2>
        {isDraft ? <>
          <p className="qw-not-sent">Elle n’a pas été envoyée.</p>
          <p className="qw-intro">Le service est encore en préparation. Vous pouvez conserver votre demande en la téléchargeant{canCopy ? " ou en la copiant" : ""}.</p>
        </> : <>
          <p className="qw-intro">Nous allons étudier les informations transmises et vous répondre à <strong>{form.email.trim()}</strong>.</p>
          {completion.reference && <p className="qw-reference">Référence : <strong>{completion.reference}</strong></p>}
        </>}
        {summary(false)}
        <div className="qw-completion-actions">
          {isDraft && <button type="button" className="qw-button qw-button-primary" onClick={download}><Download size={18} aria-hidden="true" />Télécharger ma demande (.txt)</button>}
          {isDraft && canCopy && <button type="button" className="qw-button qw-button-secondary" onClick={copy}><Copy size={18} aria-hidden="true" />Copier ma demande</button>}
          {isDraft && <button type="button" className="qw-text-button" onClick={() => { setCompletion(null); setCopyMessage(""); }}>Modifier mes réponses</button>}
          {onClose && <button type="button" className="qw-text-button" onClick={onClose}>Retour au site</button>}
        </div>
        <p className="qw-copy-status" role="status">{copyMessage}</p>
      </div>
    );
  }

  return (
    <div className="quote-wizard" ref={containerRef}>
      <ol className="qw-progress" aria-label="Étapes de la demande de devis">
        {["Téléphone", "Réparation", "Contact"].map((label, index) => (
          <li key={label} className={step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : ""} aria-current={step === index + 1 ? "step" : undefined}>
            <span className="qw-progress-number" aria-hidden="true">{step > index + 1 ? <Check size={14} /> : index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      {available === false && <p className="qw-demo-notice" role="status">L’envoi des demandes de devis n’est pas encore activé. Vous pouvez préparer ce formulaire, mais votre demande ne sera pas envoyée.</p>}
      <p className="qw-eyebrow" aria-live="polite">Étape {step} sur 3 · Devis gratuit</p>
      <h2 ref={headingRef} tabIndex={-1}>{step === 1 ? "Quel téléphone souhaitez-vous réparer ?" : step === 2 ? "Que se passe-t-il ?" : "Où vous répondre ?"}</h2>
      <p className="qw-intro">{step === 1 ? "Pas besoin d’être un expert. Indiquez simplement ce que vous connaissez." : step === 2 ? "Sélectionnez un ou plusieurs problèmes et décrivez ce que vous constatez. Nous vous aiderons à trouver la bonne solution." : "Vérifiez votre demande et laissez vos coordonnées pour recevoir une réponse personnalisée."}</p>

      <form noValidate onSubmit={(event) => { event.preventDefault(); if (step < 3) goNext(); else void finish(); }}>
        <fieldset className="qw-form-fields" disabled={sending}>
          <legend className="qw-sr-only">{step === 1 ? "Votre appareil" : step === 2 ? "Les problèmes et vos préférences" : "Vos coordonnées et le récapitulatif"}</legend>
          {step === 1 && <div className="qw-device-fields">
            <div className="qw-field">
              <label htmlFor={`${id}-brand`}>Marque</label>
              <select id={`${id}-brand`} value={form.brand} required aria-invalid={Boolean(errors.brand)} aria-describedby={errors.brand ? `${id}-brand-error` : undefined} onChange={(event) => update("brand", event.target.value)}>
                <option value="" disabled>Choisir une marque</option><option value="Apple">Apple</option><option>Samsung</option><option>Google</option><option>Xiaomi</option><option>Huawei</option><option>Oppo</option><option value="Autre marque">Autre / je ne sais pas</option>
              </select>
              {errors.brand && <p className="qw-error" id={`${id}-brand-error`}>{errors.brand}</p>}
            </div>
            <div className="qw-field">
              <label htmlFor={`${id}-model`}>Modèle{!form.modelUnknown && <span className="qw-required-note"> · obligatoire</span>}</label>
              <input id={`${id}-model`} name="model" type="text" value={form.model} disabled={form.modelUnknown} required={!form.modelUnknown} maxLength={100} placeholder={form.brand === "Apple" ? "Par exemple : iPhone 13, iPhone SE…" : "Par exemple : Galaxy S23, Pixel 8…"} onChange={(event) => update("model", event.target.value)} aria-invalid={Boolean(errors.model)} aria-describedby={`${id}-model-help${errors.model ? ` ${id}-model-error` : ""}`} />
              <p className="qw-field-help" id={`${id}-model-help`}>{form.brand === "Apple" ? "Réglages → Général → Informations → Nom du modèle." : "Regardez dans les paramètres, rubrique « À propos du téléphone », ou sur la boîte de l’appareil."}</p>
              {errors.model && <p className="qw-error" id={`${id}-model-error`}>{errors.model}</p>}
            </div>
            <label className="qw-checkbox-line"><input type="checkbox" checked={form.modelUnknown} onChange={(event) => { update("modelUnknown", event.target.checked); setErrors((current) => ({ ...current, model: undefined })); }} /><span>Je ne connais pas le modèle<span className="qw-checkbox-detail">Nous l’identifierons ensemble.</span></span></label>
            <div className="qw-soft-note"><Smartphone size={21} aria-hidden="true" /><p>Chaque appareil mérite notre attention. Nous étudierons les possibilités de réparation pour votre modèle.</p></div>
          </div>}

          {step === 2 && <>
            <fieldset className="qw-issue-fieldset" aria-describedby={errors.issues ? `${id}-issues-error` : undefined}>
              <legend>Le ou les problèmes<span className="qw-required-note"> · au moins un choix</span></legend>
              <div className="qw-issue-grid">
                {issues.map((issue, index) => {
                  const Icon = issue.icon;
                  const selected = form.issues.includes(issue.code);
                  return <label key={issue.code} className={`qw-issue-option${selected ? " is-selected" : ""}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleIssue(issue.code)} aria-invalid={index === 0 && Boolean(errors.issues)} aria-describedby={errors.issues ? `${id}-issues-error` : undefined} />
                    <Icon size={21} className="qw-issue-icon" aria-hidden="true" />
                    <span><strong>{issue.label}</strong><small>{issue.detail}</small></span>
                    <span className="qw-check-indicator" aria-hidden="true">{selected && <Check size={13} />}</span>
                  </label>;
                })}
              </div>
              {errors.issues && <p className="qw-error" id={`${id}-issues-error`}>{errors.issues}</p>}
            </fieldset>
            <div className="qw-field qw-description-field">
              <label htmlFor={`${id}-description`}>Description du problème<span className="qw-required-note"> · obligatoire</span></label>
              <textarea id={`${id}-description`} rows={3} required maxLength={1500} value={form.description} placeholder="Par exemple : le téléphone est tombé, l’écran s’allume mais le tactile ne répond plus…" onChange={(event) => update("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? `${id}-description-error` : undefined} />
              {errors.description && <p className="qw-error" id={`${id}-description-error`}>{errors.description}</p>}
            </div>
            <fieldset className="qw-choice-fieldset">
              <legend>Qu’est-ce qui compte pour vous ?</legend>
              <div className="qw-quality-options">{qualityOptions.map((option) => <label key={option.value} className={`qw-radio-card${form.quality === option.value ? " is-selected" : ""}`}><input type="radio" name={`${id}-quality`} value={option.value} checked={form.quality === option.value} onChange={() => update("quality", option.value)} /><span><strong>{option.label}</strong><small>{option.detail}</small></span></label>)}</div>
              <p className="qw-field-help">Une préférence pour orienter notre conseil. Les options possibles dépendront de votre appareil.</p>
            </fieldset>
            <div className="qw-field qw-handoff-field">
              <label htmlFor={`${id}-handoff`}>Votre préférence de prise en charge</label>
              <select id={`${id}-handoff`} value={form.handoff} onChange={(event) => update("handoff", event.target.value as Handoff)}>{handoffOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <p className="qw-field-help">Il s’agit d’une préférence, à confirmer ensemble après échange.</p>
            </div>
          </>}

          {step === 3 && <div className="qw-review-layout">
            <div className="qw-contact-fields">
              <div className="qw-field"><label htmlFor={`${id}-name`}>Prénom<span className="qw-required-note"> · obligatoire</span></label><input id={`${id}-name`} name="given-name" autoComplete="given-name" type="text" required maxLength={100} value={form.name} placeholder="Votre prénom" onChange={(event) => update("name", event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} />{errors.name && <p className="qw-error" id={`${id}-name-error`}>{errors.name}</p>}</div>
              <div className="qw-field"><label htmlFor={`${id}-email`}>Email<span className="qw-required-note"> · obligatoire</span></label><input id={`${id}-email`} name="email" autoComplete="email" inputMode="email" type="email" required maxLength={254} value={form.email} placeholder="vous@exemple.fr" onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={`${id}-email-help${errors.email ? ` ${id}-email-error` : ""}`} /><p className="qw-field-help" id={`${id}-email-help`}>Nous vous répondrons à cette adresse.</p>{errors.email && <p className="qw-error" id={`${id}-email-error`}>{errors.email}</p>}</div>
              <div className="qw-field"><label htmlFor={`${id}-phone`}>Téléphone<span className="qw-required-note"> · facultatif</span></label><input id={`${id}-phone`} name="tel" autoComplete="tel" type="tel" maxLength={30} value={form.phone} placeholder="Pour faciliter un échange si besoin" onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${id}-phone-error` : undefined} />{errors.phone && <p className="qw-error" id={`${id}-phone-error`}>{errors.phone}</p>}</div>
              <label className="qw-checkbox-line qw-consent"><input type="checkbox" required checked={form.consent} onChange={(event) => update("consent", event.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? `${id}-consent-error` : undefined} /><span>J’accepte que mes coordonnées soient utilisées pour répondre à ma demande.</span></label>
              {errors.consent && <p className="qw-error" id={`${id}-consent-error`}>{errors.consent}</p>}
              <p className="qw-privacy-note">Consultez notre <a href="/confidentialite" target="_blank" rel="noopener noreferrer">politique de confidentialité<span className="qw-sr-only"> (nouvel onglet)</span></a>.</p>
            </div>
            {summary(true)}
          </div>}
          <div className="qw-honeypot" aria-hidden="true"><label htmlFor={`${id}-website`}>Site web</label><input id={`${id}-website`} name="website" type="text" autoComplete="off" tabIndex={-1} value={form.website} onChange={(event) => update("website", event.target.value)} /></div>
        </fieldset>
        {submitError && <p className="qw-submit-error" role="alert">{submitError} Vos réponses sont conservées dans ce formulaire.</p>}
        <div className="qw-navigation">
          {step > 1 ? <button type="button" className="qw-button qw-button-secondary" disabled={sending} onClick={() => goTo((step - 1) as Step)}><ArrowLeft size={17} aria-hidden="true" />Retour</button> : <span className="qw-navigation-note">Simple, gratuit et personnalisé.</span>}
          <button type="submit" className="qw-button qw-button-primary" disabled={sending || (step === 3 && available === null)}>
            {sending ? <><LoaderCircle size={18} className="qw-spinner" aria-hidden="true" />Envoi en cours…</> : step < 3 ? <>Continuer<ArrowRight size={17} aria-hidden="true" /></> : available === null ? <>Vérification du service…</> : available ? <>Envoyer ma demande gratuite<ArrowRight size={17} aria-hidden="true" /></> : <>Préparer ma demande<ArrowRight size={17} aria-hidden="true" /></>}
          </button>
        </div>
        {step === 3 && available !== false && <p className="qw-bottom-note">Le prix sera proposé après étude de votre demande. Aucun paiement à cette étape.</p>}
      </form>
    </div>
  );
}
