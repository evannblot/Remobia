"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { fetchClientJson } from "../lib/client-requests";
import { preparePhonePhoto } from "../lib/photo-upload";
import { isValidEmail } from "../lib/email-validation.mjs";
import { TRADE_IN_ACCESSORIES, TRADE_IN_ANSWERS, TRADE_IN_CONDITIONS, TRADE_IN_DEFECTS, type TradeInDetails } from "../lib/trade-in";
import "./trade-in.css";

type FormState = Omit<TradeInDetails, "requestId" | "condition" | "powersOn" | "unlocked" | "battery"> & {
  condition: TradeInDetails["condition"] | "";
  powersOn: TradeInDetails["powersOn"] | "";
  unlocked: TradeInDetails["unlocked"] | "";
  battery: string;
};
type PhotoKey = "frontPhoto" | "backPhoto" | "additional1" | "additional2";
type Photo = { file: File; url: string };
type Errors = Partial<Record<keyof FormState | PhotoKey | "defectsAnswered", string>>;
const photoKeys: PhotoKey[] = ["frontPhoto", "backPhoto", "additional1", "additional2"];
const steps = ["Téléphone", "État et photos", "Contact"];
const initial: FormState = { brand: "", model: "", storage: "", color: "", condition: "", powersOn: "", unlocked: "", battery: "", defects: [], description: "", repairs: "", accessories: [], name: "", email: "", phone: "", consent: false, website: "" };

export default function TradeInForm() {
  const id = useId();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormState>(initial);
  const [defectsAnswered, setDefectsAnswered] = useState(false);
  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, Photo>>>({});
  const photoRef = useRef<Partial<Record<PhotoKey, Photo>>>({});
  const photoVersions = useRef<Record<PhotoKey, number>>({ frontPhoto: 0, backPhoto: 0, additional1: 0, additional2: 0 });
  const photoControllers = useRef<Partial<Record<PhotoKey, AbortController>>>({});
  const [preparing, setPreparing] = useState<Partial<Record<PhotoKey, boolean>>>({});
  const [photoErrors, setPhotoErrors] = useState<Errors>({});
  const [errors, setErrors] = useState<Errors>({});
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completion, setCompletion] = useState<{ reference: string } | null>(null);
  const requestId = useRef("");
  const mounted = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const statusController = useRef<AbortController | null>(null);

  async function checkAvailability() {
    statusController.current?.abort();
    const controller = new AbortController();
    statusController.current = controller;
    setChecking(true);
    try {
      const { response, data } = await fetchClientJson<{ available?: boolean }>("/api/trade-ins", { cache: "no-store", signal: controller.signal }, { timeoutMs: 8000 });
      if (!response.ok) throw new Error("Unavailable");
      if (mounted.current && !controller.signal.aborted) setAvailable(data?.available === true);
    } catch { if (mounted.current && !controller.signal.aborted) setAvailable(false); }
    finally { if (mounted.current && !controller.signal.aborted) setChecking(false); }
  }

  useEffect(() => {
    mounted.current = true;
    const versions = photoVersions.current;
    const controllers = photoControllers.current;
    void checkAvailability();
    return () => {
      mounted.current = false;
      statusController.current?.abort();
      for (const key of photoKeys) { versions[key]++; controllers[key]?.abort(); const photo = photoRef.current[key]; if (photo) URL.revokeObjectURL(photo.url); }
    };
  }, []);
  useEffect(() => {
    const heading = headingRef.current;
    const shouldScroll = previousStep.current !== step || completion !== null;
    previousStep.current = step;
    heading?.focus({ preventScroll: true });
    if (shouldScroll) heading?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step, completion]);

  function invalidateRequest() { requestId.current = ""; setSubmitError(""); }
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    invalidateRequest();
  }
  function toggleDefect(key: keyof typeof TRADE_IN_DEFECTS) {
    const next = values.defects.includes(key) ? values.defects.filter((item) => item !== key) : [...values.defects, key];
    update("defects", next); setDefectsAnswered(next.length > 0); setErrors((previous) => ({ ...previous, defectsAnswered: undefined }));
  }
  function noDefects(selected: boolean) { update("defects", []); setDefectsAnswered(selected); setErrors((previous) => ({ ...previous, defectsAnswered: undefined })); }
  function toggleAccessory(key: keyof typeof TRADE_IN_ACCESSORIES) {
    update("accessories", values.accessories.includes(key) ? values.accessories.filter((item) => item !== key) : [...values.accessories, key]);
  }
  async function addPhoto(key: PhotoKey, file: File | undefined) {
    if (!file || sending) return;
    photoControllers.current[key]?.abort();
    const controller = new AbortController();
    photoControllers.current[key] = controller;
    const version = ++photoVersions.current[key];
    setPreparing((previous) => ({ ...previous, [key]: true }));
    setPhotoErrors((previous) => ({ ...previous, [key]: undefined }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    try {
      const prepared = await preparePhonePhoto(file, controller.signal);
      if (!mounted.current || photoVersions.current[key] !== version) return;
      const previous = photoRef.current[key];
      if (previous) URL.revokeObjectURL(previous.url);
      const photo = { file: prepared, url: URL.createObjectURL(prepared) };
      photoRef.current = { ...photoRef.current, [key]: photo };
      setPhotos(photoRef.current); invalidateRequest();
    } catch (error) {
      if (mounted.current && photoVersions.current[key] === version) setPhotoErrors((previous) => ({ ...previous, [key]: error instanceof Error ? error.message : "La photo n’a pas pu être préparée. Réessayez." }));
    } finally { if (photoControllers.current[key] === controller) delete photoControllers.current[key]; if (mounted.current && photoVersions.current[key] === version) setPreparing((previous) => ({ ...previous, [key]: false })); }
  }
  function removePhoto(key: PhotoKey) {
    photoVersions.current[key]++;
    photoControllers.current[key]?.abort();
    delete photoControllers.current[key];
    const photo = photoRef.current[key];
    if (photo) URL.revokeObjectURL(photo.url);
    const next = { ...photoRef.current }; delete next[key]; photoRef.current = next; setPhotos(next);
    setPreparing((previous) => ({ ...previous, [key]: false }));
    setPhotoErrors((previous) => ({ ...previous, [key]: undefined })); invalidateRequest();
  }

  function validate(target: number): Errors {
    const next: Errors = {};
    if (target === 0) {
      if (!values.brand.trim()) next.brand = "Indiquez la marque du téléphone.";
      if (!values.model.trim()) next.model = "Indiquez son modèle, même approximatif si vous avez un doute.";
    }
    if (target === 1) {
      if (!values.condition) next.condition = "Choisissez l’état général de votre téléphone.";
      if (!values.powersOn) next.powersOn = "Indiquez si le téléphone s’allume.";
      if (!values.unlocked) next.unlocked = "Indiquez si le téléphone pourra être déverrouillé, ou choisissez « Je ne sais pas ».";
      if (values.battery.trim() && (!/^\d{1,3}$/.test(values.battery.trim()) || Number(values.battery) > 100)) next.battery = "Indiquez un pourcentage entre 0 et 100, ou laissez ce champ vide.";
      if (!defectsAnswered) next.defectsAnswered = "Sélectionnez les problèmes connus, ou « Aucun problème connu ».";
      if (values.defects.length && !values.description.trim()) next.description = "Décrivez les problèmes constatés.";
      if (!photos.frontPhoto) next.frontPhoto = "Ajoutez une photo de l’avant du téléphone.";
      if (!photos.backPhoto) next.backPhoto = "Ajoutez une photo de l’arrière du téléphone.";
      for (const key of photoKeys) if (photoErrors[key]) next[key] = photoErrors[key];
    }
    if (target === 2) {
      if (values.name.trim().length < 2) next.name = "Indiquez votre nom ou prénom (au moins 2 caractères).";
      if (!isValidEmail(values.email.trim())) next.email = "Indiquez une adresse email valide, par exemple vous@exemple.fr.";
      const phone = values.phone.trim();
      if (phone && (!/^\+?[0-9 ().-]{6,30}$/.test(phone) || phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 15)) next.phone = "Vérifiez ce numéro, ou laissez le champ vide.";
      if (!values.consent) next.consent = "Confirmez votre demande avant de continuer.";
    }
    return next;
  }
  function focusError() { window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()); }
  function changeStep(next: number) { setErrors({}); setSubmitError(""); setStep(next); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || Object.values(preparing).some(Boolean)) return;
    const next = validate(step);
    setErrors(next);
    if (Object.values(next).some(Boolean)) { focusError(); return; }
    if (step < 2) { changeStep(step + 1); return; }
    for (const target of [0, 1]) {
      const earlierErrors = validate(target);
      if (Object.values(earlierErrors).some(Boolean)) { setStep(target); setErrors(earlierErrors); focusError(); return; }
    }
    if (!available) { setSubmitError("L’envoi est momentanément indisponible. Vos réponses sont conservées : vérifiez la disponibilité puis réessayez."); return; }
    if (values.website.trim()) { setSubmitError("Cette demande ne peut pas être envoyée."); return; }
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const details: TradeInDetails = { ...values, requestId: requestId.current, condition: values.condition as TradeInDetails["condition"], powersOn: values.powersOn as TradeInDetails["powersOn"], unlocked: values.unlocked as TradeInDetails["unlocked"], battery: values.battery.trim() ? Number(values.battery) : null };
    const body = new FormData(); body.set("details", JSON.stringify(details));
    body.set("frontPhoto", photos.frontPhoto!.file); body.set("backPhoto", photos.backPhoto!.file);
    for (const key of ["additional1", "additional2"] as const) if (photos[key]) body.append("additionalPhotos", photos[key]!.file);
    setSending(true); setSubmitError("");
    try {
      const { response, data: raw } = await fetchClientJson<unknown>("/api/trade-ins", { method: "POST", body }, { timeoutMs: 30_000, timeoutMessage: "L’enregistrement n’a pas pu être confirmé à temps. Vos réponses et photos sont conservées. Réessayez dans quelques instants.", networkMessage: "L’enregistrement n’a pas pu être confirmé. Vos réponses et photos sont conservées. Vérifiez votre connexion puis réessayez." });
      const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      if (!response.ok || data.success !== true || typeof data.id !== "string" || typeof data.reference !== "string") throw new Error(typeof data.error === "string" ? data.error : "Votre demande n’a pas pu être enregistrée. Réessayez dans quelques instants.");
      setCompletion({ reference: data.reference });
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Votre demande n’a pas pu être enregistrée. Vos réponses sont conservées."); }
    finally { setSending(false); }
  }

  function error(key: keyof Errors) { return errors[key] ? <p className="ti-field-error" id={`${id}-${key}-error`}>{errors[key]}</p> : null; }
  function attributes(key: keyof Errors) { return { "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined }; }
  function textField(key: "brand" | "model" | "storage" | "color" | "name" | "email" | "phone", label: string, placeholder: string, required = false) {
    return <div className="ti-field"><label htmlFor={`${id}-${key}`}>{label}{required ? <span className="ti-required"> · obligatoire</span> : <span className="ti-optional"> · facultatif</span>}</label><input id={`${id}-${key}`} value={values[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} autoComplete={key === "name" ? "name" : key === "email" ? "email" : key === "phone" ? "tel" : "off"} maxLength={key === "email" ? 254 : key === "model" ? 100 : key === "phone" ? 30 : 80} required={required} {...attributes(key)} />{error(key)}</div>;
  }
  function answer(key: "powersOn" | "unlocked", label: string, help?: string) {
    return <fieldset className="ti-choice-field" tabIndex={errors[key] ? -1 : undefined} {...attributes(key)}><legend>{label}<span className="ti-required"> · obligatoire</span></legend>{help && <p className="ti-help">{help}</p>}<div className="ti-answer-options">{Object.entries(TRADE_IN_ANSWERS).map(([value, title]) => <label key={value} className={`ti-choice${values[key] === value ? " is-selected" : ""}`}><input type="radio" name={`${id}-${key}`} value={value} checked={values[key] === value} onChange={() => update(key, value as TradeInDetails[typeof key])} /><span>{title}</span></label>)}</div>{error(key)}</fieldset>;
  }
  function photoSlot(key: PhotoKey, label: string, note: string, required: boolean) {
    const picture = photos[key]; const message = photoErrors[key] || errors[key];
    return <div className={`ti-photo-card${message ? " has-error" : ""}`}><div className="ti-photo-heading"><strong>{label}</strong><span>{required ? "Obligatoire" : "Facultative"}</span></div><div className={`ti-photo-preview${picture ? " has-photo" : ""}`}>{picture ? <img src={picture.url} alt={`Photo sélectionnée : ${label.toLowerCase()}`} /> : <><Camera size={30} strokeWidth={1.3} aria-hidden="true" /><span>{note}</span></>}</div><div className="ti-photo-controls"><label className={`ti-upload${preparing[key] ? " is-preparing" : ""}`} htmlFor={`${id}-${key}`}><input type="file" id={`${id}-${key}`} accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addPhoto(key, event.target.files?.[0]); event.target.value = ""; }} aria-label={`${picture ? "Remplacer" : "Ajouter"} ${label.toLowerCase()}`} aria-required={required} aria-invalid={!!message || undefined} aria-describedby={message ? `${id}-${key}-photo-error` : undefined} disabled={sending} />{preparing[key] ? <LoaderCircle size={15} className="ti-spin" aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}<span>{preparing[key] ? "Préparation…" : picture ? "Remplacer" : "Ajouter la photo"}</span></label>{picture && <button type="button" className="ti-photo-remove" onClick={() => removePhoto(key)} aria-label={`Retirer ${label.toLowerCase()}`}><X size={16} aria-hidden="true" /></button>}</div>{message && <p className="ti-field-error" role="alert" id={`${id}-${key}-photo-error`}>{message}</p>}</div>;
  }

  if (completion) return <section className="ti-panel ti-success" aria-labelledby={`${id}-complete`}><div className="ti-success-mark"><CheckCircle2 size={32} strokeWidth={1.5} aria-hidden="true" /></div><p className="eyebrow">DEMANDE ENREGISTRÉE</p><h2 id={`${id}-complete`} ref={headingRef} tabIndex={-1} style={{ scrollMarginTop: "110px" }}>Merci, nous avons reçu<br />les informations de votre téléphone.</h2><p>REMOBIA étudiera les caractéristiques et les photos de votre appareil, puis vous recontactera à <strong>{values.email.trim()}</strong> pour vous proposer une estimation ou demander des précisions.</p><p className="ti-reference">Votre référence : <strong>{completion.reference}</strong></p><div className="ti-success-device"><strong>{values.brand.trim()} {values.model.trim()}</strong><span>{[values.storage.trim(), values.color.trim()].filter(Boolean).join(" · ") || "Votre appareil"}</span><div className="ti-success-photos">{[photos.frontPhoto, photos.backPhoto].map((photo, index) => photo && <img key={index} src={photo.url} alt={index === 0 ? "Avant de votre téléphone" : "Arrière de votre téléphone"} />)}</div></div><p className="ti-help">Cette demande est gratuite et ne vous engage pas à vendre. Le montant éventuel sera confirmé après vérification du téléphone.</p><Link href="/" className="button button-primary">Retour à l’accueil<ArrowRight size={17} aria-hidden="true" /></Link></section>;

  return <section className="ti-panel" aria-label="Demande d’estimation de votre téléphone"><ol className="ti-steps" aria-label="Étapes de votre demande">{steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""}><button type="button" disabled={index >= step || sending} onClick={() => changeStep(index)} aria-current={index === step ? "step" : undefined}><span className="ti-step-number">{index < step ? <Check size={15} aria-hidden="true" /> : index + 1}</span><span>{label}</span></button></li>)}</ol><form ref={formRef} onSubmit={submit} noValidate aria-busy={sending}><div className="ti-panel-body"><p className="ti-step-label">ÉTAPE {step + 1} SUR 3</p><h2 ref={headingRef} tabIndex={-1} style={{ scrollMarginTop: "110px" }}>{step === 0 ? "Commençons par votre téléphone." : step === 1 ? "Montrez-nous son état." : "Comment vous recontacter ?"}</h2><p className="ti-step-intro">{step === 0 ? "Quelques informations pour identifier votre appareil. Vous pouvez laisser les détails inconnus vides." : step === 1 ? "Les photos et les problèmes connus nous aideront à faire une estimation juste." : "Nous vous répondrons après avoir étudié votre demande. Aucune estimation automatique ni paiement à cette étape."}</p>{available === false && <div className="ti-unavailable" role="status"><p>L’envoi des demandes d’estimation n’est pas encore activé. Vous pouvez préparer ce formulaire et sélectionner vos photos, mais rien ne sera envoyé.</p><button type="button" className="ti-text-button" onClick={() => void checkAvailability()} disabled={checking}>{checking ? "Vérification…" : "Vérifier à nouveau"}</button></div>}{Object.values(errors).some(Boolean) && <div className="ti-error-summary" role="alert">Vérifiez les champs indiqués ci-dessous pour continuer.</div>}<fieldset className="ti-form-fields" disabled={sending}>
      {step === 0 && <div className="ti-grid">{textField("brand", "Marque", "Ex. Apple, Samsung, Google…", true)}{textField("model", "Modèle", "Ex. iPhone 13, Galaxy S22…", true)}{textField("storage", "Capacité de stockage", "Ex. 128 Go")}{textField("color", "Couleur", "Ex. noir, bleu, blanc…")}</div>}
      {step === 1 && <><fieldset className="ti-choice-field" tabIndex={errors.condition ? -1 : undefined} {...attributes("condition")}><legend>État général<span className="ti-required"> · obligatoire</span></legend><div className="ti-condition-options">{Object.entries(TRADE_IN_CONDITIONS).map(([value, label]) => <label className={`ti-choice${values.condition === value ? " is-selected" : ""}`} key={value}><input type="radio" name={`${id}-condition`} value={value} checked={values.condition === value} onChange={() => update("condition", value as TradeInDetails["condition"])} /><span>{label}</span></label>)}</div>{error("condition")}</fieldset><div className="ti-grid ti-answer-grid">{answer("powersOn", "Le téléphone s’allume-t-il ?")}{answer("unlocked", "Pourrez-vous le déverrouiller ?", "Pouvez-vous accéder à l’appareil et retirer vos comptes avant sa remise ? Ne communiquez aucun code ni mot de passe.")}</div><div className="ti-field ti-battery"><label htmlFor={`${id}-battery`}>État de santé de la batterie<span className="ti-optional"> · facultatif</span></label><div className="ti-battery-input"><input id={`${id}-battery`} type="text" inputMode="numeric" maxLength={3} value={values.battery} onChange={(event) => update("battery", event.target.value)} placeholder="Ex. 86" {...attributes("battery")} /><span>%</span></div><p className="ti-help">Le pourcentage de santé indiqué dans les réglages, si disponible. Vous pouvez laisser ce champ vide.</p>{error("battery")}</div><fieldset className="ti-choice-field" tabIndex={errors.defectsAnswered ? -1 : undefined} {...attributes("defectsAnswered")}><legend>Quels problèmes connaissez-vous ?<span className="ti-required"> · obligatoire</span></legend><p className="ti-help">Plusieurs choix possibles. Si tout fonctionne, choisissez « Aucun problème connu ».</p><div className="ti-defect-options"><label className={`ti-choice${defectsAnswered && !values.defects.length ? " is-selected" : ""}`}><input type="checkbox" checked={defectsAnswered && !values.defects.length} onChange={(event) => noDefects(event.target.checked)} /><span>Aucun problème connu</span></label>{Object.entries(TRADE_IN_DEFECTS).map(([key, label]) => <label key={key} className={`ti-choice${values.defects.includes(key as keyof typeof TRADE_IN_DEFECTS) ? " is-selected" : ""}`}><input type="checkbox" checked={values.defects.includes(key as keyof typeof TRADE_IN_DEFECTS)} onChange={() => toggleDefect(key as keyof typeof TRADE_IN_DEFECTS)} /><span>{label}</span></label>)}</div>{error("defectsAnswered")}</fieldset><div className="ti-field"><label htmlFor={`${id}-description`}>Précisions sur l’état du téléphone<span className={values.defects.length ? "ti-required" : "ti-optional"}> · {values.defects.length ? "obligatoire" : "facultatif"}</span></label><textarea id={`${id}-description`} rows={3} maxLength={3000} value={values.description} onChange={(event) => update("description", event.target.value)} required={!!values.defects.length} placeholder="Ex. rayures au dos, écran fissuré, batterie qui se vide vite…" {...attributes("description")} />{error("description")}</div><div className="ti-field"><label htmlFor={`${id}-repairs`}>Réparations déjà effectuées<span className="ti-optional"> · facultatif</span></label><textarea id={`${id}-repairs`} rows={2} maxLength={1500} value={values.repairs} onChange={(event) => update("repairs", event.target.value)} placeholder="Ex. écran remplacé, batterie changée… Si vous ne savez pas, laissez vide." /></div><fieldset className="ti-choice-field"><legend>Accessoires disponibles<span className="ti-optional"> · facultatif</span></legend><div className="ti-answer-options">{Object.entries(TRADE_IN_ACCESSORIES).map(([key, label]) => <label key={key} className={`ti-choice${values.accessories.includes(key as keyof typeof TRADE_IN_ACCESSORIES) ? " is-selected" : ""}`}><input type="checkbox" checked={values.accessories.includes(key as keyof typeof TRADE_IN_ACCESSORIES)} onChange={() => toggleAccessory(key as keyof typeof TRADE_IN_ACCESSORIES)} /><span>{label}</span></label>)}</div></fieldset><div className="ti-photo-section"><h3>Des photos pour mieux l’estimer.</h3><p className="ti-help">Photographiez l’avant et l’arrière en entier, avec une bonne lumière. Ajoutez les défauts visibles si besoin. Évitez tout document, code ou donnée personnelle à l’écran.</p><p className="ti-photo-format">JPEG, PNG ou WebP · Jusqu’à 4 photos · Optimisées automatiquement avant envoi</p><div className="ti-photo-grid">{photoSlot("frontPhoto", "Avant du téléphone", "Écran et bords visibles", true)}{photoSlot("backPhoto", "Arrière du téléphone", "Dos et appareils photo visibles", true)}{photoSlot("additional1", "Photo supplémentaire 1", "Un défaut ou un autre angle", false)}{photoSlot("additional2", "Photo supplémentaire 2", "Un défaut ou un autre angle", false)}</div></div></>}
      {step === 2 && <><div className="ti-contact-recap"><strong>{values.brand.trim()} {values.model.trim()}</strong><span>{TRADE_IN_CONDITIONS[values.condition as TradeInDetails["condition"]]} · {Object.values(photos).filter(Boolean).length} photos</span><button type="button" className="ti-text-button" onClick={() => changeStep(0)}>Modifier les informations</button></div><div className="ti-grid">{textField("name", "Nom ou prénom", "Votre nom ou prénom", true)}{textField("email", "Adresse email", "vous@exemple.fr", true)}{textField("phone", "Numéro de téléphone", "06 00 00 00 00")}</div><div className="ti-honeypot" aria-hidden="true"><label htmlFor={`${id}-website`}>Site internet</label><input id={`${id}-website`} value={values.website} onChange={(event) => update("website", event.target.value)} autoComplete="off" tabIndex={-1} /></div><div className="ti-consent"><label><input type="checkbox" checked={values.consent} onChange={(event) => update("consent", event.target.checked)} required {...attributes("consent")} /><span>Je demande à REMOBIA d’étudier ces informations et photos pour estimer mon appareil et me répondre. J’ai pris connaissance de la <a href="/confidentialite" target="_blank" rel="noreferrer">politique de confidentialité</a>.</span></label>{error("consent")}</div><p className="ti-privacy-note"><ShieldCheck size={17} aria-hidden="true" />Vos informations et photos sont destinées à l’étude de votre demande. Elles ne sont pas publiées dans le catalogue.</p></>}
    </fieldset>{step === 2 && <><div className="ti-submit-note">La demande est gratuite et sans engagement. Une éventuelle offre reste soumise à la vérification de l’appareil.</div>{checking && available !== false && <p className="ti-availability" role="status">Vérification de l’envoi…</p>}</>}{submitError && <div className="ti-error-summary" role="alert">{submitError}</div>}</div><div className="ti-actions">{step > 0 ? <button type="button" className="button button-outline" onClick={() => changeStep(step - 1)} disabled={sending}><ArrowLeft size={17} aria-hidden="true" />Retour</button> : <span className="ti-actions-note">Environ 3 minutes</span>}<button type="submit" className="button button-primary" disabled={sending || Object.values(preparing).some(Boolean) || (step === 2 && (checking || available !== true))}>{sending ? <><LoaderCircle size={17} className="ti-spin" aria-hidden="true" />Enregistrement…</> : <>{step === 2 ? "Demander mon estimation" : "Continuer"}<ArrowRight size={17} aria-hidden="true" /></>}</button></div></form></section>;
}
