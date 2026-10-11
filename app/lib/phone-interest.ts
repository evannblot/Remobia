import type { PhoneListing } from "./catalog";
import { getEmailConfig, type QuoteEnvironment } from "./quotes";
import { isValidEmail as validEmail } from "./email-validation.mjs";

export const MAX_INTEREST_BODY_BYTES = 8 * 1024;

export type PhoneInterestInput = {
  requestId: string;
  phoneId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: true;
};

type Validation = { valid: true; interest: PhoneInterestInput } | { valid: false; error: string };

function text(value: unknown, maximum: number, multiline = false): string | null {
  if (typeof value !== "string" || value.length > maximum ||
      (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) return null;
  return value.trim();
}


export function validatePhoneInterest(payload: unknown): Validation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, error: "La demande doit être un objet JSON." };
  }
  const data = payload as Record<string, unknown>;
  if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestId)) {
    return { valid: false, error: "Rechargez le formulaire avant de réessayer." };
  }
  if (data.website !== undefined && (typeof data.website !== "string" || data.website.trim() !== "")) {
    return { valid: false, error: "Cette demande ne peut pas être envoyée." };
  }
  const phoneId = text(data.phoneId, 100);
  const name = text(data.name, 100);
  const email = text(data.email, 254);
  const phone = text(data.phone ?? "", 30);
  const message = text(data.message ?? "", 3000, true);
  if (!phoneId || !/^[a-zA-Z0-9_-]+$/.test(phoneId)) return { valid: false, error: "Vérifiez le téléphone sélectionné." };
  if (!name || name.length < 2) return { valid: false, error: "Indiquez votre prénom (2 à 100 caractères)." };
  if (!email || !validEmail(email)) return { valid: false, error: "Indiquez une adresse email valide." };
  if (phone === null || (phone !== "" && (!/^\+?[0-9 ().-]{6,30}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 15))) {
    return { valid: false, error: "Vérifiez le numéro de téléphone ou laissez ce champ vide." };
  }
  if (message === null) return { valid: false, error: "Votre message doit contenir au maximum 3 000 caractères." };
  if (data.consent !== true) return { valid: false, error: "Votre accord est nécessaire pour traiter la demande." };
  return { valid: true, interest: { requestId: data.requestId.toLowerCase(), phoneId, name, email, phone, message, consent: true } };
}

class InterestRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_INTEREST_BODY_BYTES) {
    throw new InterestRequestError(413, "La demande est trop volumineuse.");
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new InterestRequestError(415, "La demande doit être envoyée au format JSON.");
  }
  if (!request.body) throw new InterestRequestError(400, "La demande est vide.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INTEREST_BODY_BYTES) {
        await reader.cancel();
        throw new InterestRequestError(413, "La demande est trop volumineuse.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new InterestRequestError(400, "Le contenu de la demande est invalide."); }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function interestEmail(interest: PhoneInterestInput, phone: PhoneListing, reference: string): string {
  const price = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(phone.priceCents / 100);
  return [
    "Nouvelle demande pour un téléphone en vente", `Référence : ${reference}`, "",
    `Annonce : ${phone.id}`, `Téléphone : ${phone.brand} ${phone.model}`,
    `Stockage : ${phone.storage || "Non renseigné"}`, `Couleur : ${phone.color || "Non renseignée"}`,
    `Prix affiché au moment de la demande : ${price}`, "",
    `Prénom : ${interest.name}`, `Email : ${interest.email}`,
    `Téléphone du client : ${interest.phone || "Non renseigné"}`, "",
    "Message du client :", interest.message || "Ce téléphone m’intéresse. Est-il encore disponible ?", "",
    "Le client a accepté l’utilisation de ses coordonnées pour répondre à cette demande.",
    "Cette demande ne vaut ni réservation, ni commande, ni paiement.",
  ].join("\n");
}

/** No contact details are persisted. The listing is read again before sending. */
export function createInterestHandlers(environment: QuoteEnvironment, options: {
  readPhone: (id: string) => Promise<PhoneListing | null>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}) {
  const fetcher = options.fetcher ?? fetch;
  return {
    GET(): Response { return json({ available: getEmailConfig(environment) !== null }); },
    async POST(request: Request): Promise<Response> {
      const origin = request.headers.get("origin");
      if ((origin !== null && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
        return json({ error: "La demande doit être envoyée depuis ce site." }, 403);
      }
      let payload: unknown;
      try { payload = await readJson(request); }
      catch (error) {
        return error instanceof InterestRequestError ? json({ error: error.message }, error.status) :
          json({ error: "Impossible de lire la demande. Réessayez." }, 400);
      }
      const validation = validatePhoneInterest(payload);
      if (!validation.valid) return json({ error: validation.error }, 400);
      const config = getEmailConfig(environment);
      if (!config) return json({ error: "L’envoi des demandes n’est pas encore disponible. Aucune demande n’a été envoyée." }, 503);
      let phone: PhoneListing | null;
      try { phone = await options.readPhone(validation.interest.phoneId); }
      catch { return json({ error: "Impossible de vérifier cette annonce. Réessayez dans quelques instants." }, 503); }
      if (!phone || phone.status !== "published") {
        return json({ error: "Ce téléphone n’est plus disponible. Consultez les autres annonces." }, 409);
      }
      // Preserve the exact logical email after an ambiguous response. Only listing
      // fields present in the email affect its identity; unrelated edits do not.
      const identity = JSON.stringify({ interest: validation.interest, to: config.to, from: config.from,
        listing: { id: phone.id, brand: phone.brand, model: phone.model, storage: phone.storage,
          color: phone.color, priceCents: phone.priceCents } });
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity))),
        byte => byte.toString(16).padStart(2, "0")).join("");
      const reference = `AMV-${validation.interest.requestId.slice(0, 8).toUpperCase()}-${hash.slice(0, 12).toUpperCase()}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
      try {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `phone-interest-${hash}` },
          signal: controller.signal,
          body: JSON.stringify({ from: config.from, to: [config.to], reply_to: validation.interest.email,
            subject: `Intérêt pour un téléphone en vente — ${reference}`, text: interestEmail(validation.interest, phone, reference) }),
        });
        if (!response.ok) throw new Error("Provider rejected the request");
        const acceptance: unknown = await response.json();
        if (!acceptance || typeof acceptance !== "object" || !("id" in acceptance) ||
            typeof acceptance.id !== "string" || !acceptance.id.trim() || acceptance.id.length > 200) {
          throw new Error("Provider did not confirm acceptance");
        }
        return json({ success: true, reference });
      } catch { return json({ error: "L’envoi n’a pas pu être confirmé. Réessayez dans quelques instants." }, 502); }
      finally { clearTimeout(timeout); }
    },
  };
}
