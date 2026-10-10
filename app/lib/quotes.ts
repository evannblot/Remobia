/** Server-side quote handling. This module never persists customer submissions. */
import { isValidEmail as isEmail } from "./email-validation.mjs";

export const MAX_QUOTE_BODY_BYTES = 16 * 1024;

const ISSUE_LABELS = {
  screen: "Écran / vitre",
  battery: "Batterie / autonomie",
  charging: "Charge / connecteur",
  camera: "Appareil photo",
  audio: "Son / microphone",
  water: "Contact avec un liquide",
  power: "Ne s’allume plus",
  other: "Autre problème / diagnostic à préciser",
} as const;

const QUALITY_LABELS = {
  budget: "Le budget avant tout",
  quality: "La qualité avant tout",
  advice: "Je souhaite être conseillé",
} as const;

const HANDOFF_LABELS = {
  discuss: "À définir ensemble",
  dropoff: "Dépôt sur rendez-vous",
  laval: "Prise en charge à Laval, modalités à définir",
} as const;

export type QuoteIssue = keyof typeof ISSUE_LABELS;
export type QuoteInput = {
  brand: string;
  model: string;
  modelUnknown: boolean;
  issues: QuoteIssue[];
  description: string;
  quality: keyof typeof QUALITY_LABELS;
  handoff: keyof typeof HANDOFF_LABELS;
  name: string;
  email: string;
  phone: string;
  consent: true;
};

export type QuoteEnvironment = {
  QUOTE_TO_EMAIL?: unknown;
  QUOTE_FROM_EMAIL?: unknown;
  RESEND_API_KEY?: unknown;
};

type EmailConfig = { to: string; from: string; apiKey: string };
type Validation =
  | { valid: true; quote: QuoteInput }
  | { valid: false; error: string };

const SINGLE_LINE_CONTROL = /[\u0000-\u001f\u007f]/;
const TEXT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Availability checks syntax only; provider authentication is checked on send. */
export function getEmailConfig(environment: QuoteEnvironment): EmailConfig | null {
  const { QUOTE_TO_EMAIL, QUOTE_FROM_EMAIL, RESEND_API_KEY } = environment;
  if (typeof QUOTE_TO_EMAIL !== "string" || typeof QUOTE_FROM_EMAIL !== "string" ||
      typeof RESEND_API_KEY !== "string") return null;
  const to = QUOTE_TO_EMAIL.trim();
  const from = QUOTE_FROM_EMAIL.trim();
  const apiKey = RESEND_API_KEY.trim();
  if (!isEmail(to) || !isEmail(from) || !/^re_[A-Za-z0-9_-]{16,200}$/.test(apiKey)) return null;
  return { to, from, apiKey };
}

function readText(value: unknown, maxLength: number, multiline = false): string | null {
  if (typeof value !== "string" || value.length > maxLength) return null;
  if ((multiline ? TEXT_CONTROL : SINGLE_LINE_CONTROL).test(value)) return null;
  return value.trim();
}

function hasKey<T extends object>(object: T, key: unknown): key is keyof T {
  return typeof key === "string" && Object.hasOwn(object, key);
}

export function validateQuoteInput(payload: unknown): Validation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, error: "La demande doit être un objet JSON." };
  }
  const data = payload as Record<string, unknown>;
  // Reject bots rather than displaying a success when no message was sent.
  if (data.website !== undefined && (typeof data.website !== "string" || data.website.trim() !== "")) {
    return { valid: false, error: "Cette demande ne peut pas être envoyée." };
  }
  const brand = readText(data.brand, 80);
  const model = readText(data.model, 120);
  const description = readText(data.description, 3000, true);
  const name = readText(data.name, 100);
  const email = readText(data.email, 254);
  const phone = readText(data.phone ?? "", 30);

  if (!brand) return { valid: false, error: "Indiquez la marque du téléphone." };
  if (typeof data.modelUnknown !== "boolean" || model === null || (!data.modelUnknown && !model)) {
    return { valid: false, error: "Indiquez le modèle ou sélectionnez « je ne sais pas »." };
  }
  if (!Array.isArray(data.issues) || data.issues.length < 1 || data.issues.length > 8 ||
      !data.issues.every((issue) => hasKey(ISSUE_LABELS, issue))) {
    return { valid: false, error: "Sélectionnez au moins un problème parmi ceux proposés." };
  }
  if (!description) {
    return { valid: false, error: "Décrivez le problème en 3 000 caractères maximum." };
  }
  if (!hasKey(QUALITY_LABELS, data.quality) || !hasKey(HANDOFF_LABELS, data.handoff)) {
    return { valid: false, error: "Vérifiez vos préférences de réparation et de prise en charge." };
  }
  if (!name || name.length < 2) return { valid: false, error: "Indiquez votre nom (2 à 100 caractères)." };
  if (!email || !isEmail(email)) return { valid: false, error: "Indiquez une adresse e-mail valide." };
  if (phone === null || (phone !== "" && (!/^\+?[0-9 ().-]{6,30}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 15))) {
    return { valid: false, error: "Vérifiez le numéro de téléphone ou laissez ce champ vide." };
  }
  if (data.consent !== true) return { valid: false, error: "Votre accord est nécessaire pour traiter la demande." };

  return {
    valid: true,
    quote: {
      brand, model: data.modelUnknown ? "" : model, modelUnknown: data.modelUnknown,
      issues: [...new Set(data.issues)] as QuoteIssue[], description,
      quality: data.quality, handoff: data.handoff,
      name, email, phone, consent: true,
    },
  };
}

class QuoteRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_QUOTE_BODY_BYTES) {
    throw new QuoteRequestError(413, "La demande est trop volumineuse.");
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new QuoteRequestError(415, "La demande doit être envoyée au format JSON.");
  }
  if (!request.body) throw new QuoteRequestError(400, "La demande est vide.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_QUOTE_BODY_BYTES) {
        await reader.cancel();
        throw new QuoteRequestError(413, "La demande est trop volumineuse.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new QuoteRequestError(400, "Le contenu de la demande est invalide.");
  }
}

export function createQuoteReference(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const date = ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("");
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `AM-${date}-${suffix}`;
}

function quoteEmailText(quote: QuoteInput, reference: string): string {
  return [
    "Nouvelle demande de devis gratuit", `Référence : ${reference}`, "",
    `Nom : ${quote.name}`, `E-mail : ${quote.email}`,
    `Téléphone : ${quote.phone || "Non renseigné"}`, "",
    `Marque : ${quote.brand}`, `Modèle : ${quote.modelUnknown ? "Le client ne connaît pas le modèle" : quote.model}`,
    "Problèmes signalés :", ...quote.issues.map((issue) => `- ${ISSUE_LABELS[issue]}`), "",
    "Description du client :", quote.description || "Aucune précision supplémentaire.", "",
    `Préférence : ${QUALITY_LABELS[quote.quality]}`,
    `Prise en charge souhaitée : ${HANDOFF_LABELS[quote.handoff]}`, "",
    "Le client a accepté l’utilisation de ses coordonnées pour traiter cette demande.",
    "Cette demande ne vaut ni diagnostic confirmé, ni devis accepté, ni réservation.",
  ].join("\n");
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Dependencies are injectable so tests cannot accidentally send real e-mail. */
export function createQuotesHandlers(environment: QuoteEnvironment, options: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    GET(): Response {
      return jsonResponse({ available: getEmailConfig(environment) !== null });
    },
    async POST(request: Request): Promise<Response> {
      const origin = request.headers.get("origin");
      if ((origin !== null && origin !== new URL(request.url).origin) ||
          request.headers.get("sec-fetch-site") === "cross-site") {
        return jsonResponse({ error: "La demande doit être envoyée depuis ce site." }, 403);
      }
      let payload: unknown;
      try {
        payload = await readBoundedJson(request);
      } catch (error) {
        if (error instanceof QuoteRequestError) return jsonResponse({ error: error.message }, error.status);
        return jsonResponse({ error: "Impossible de lire la demande. Réessayez." }, 400);
      }
      const validation = validateQuoteInput(payload);
      if (!validation.valid) return jsonResponse({ error: validation.error }, 400);
      const config = getEmailConfig(environment);
      if (!config) {
        return jsonResponse({ error: "L’envoi des demandes de devis n’est pas encore disponible. Aucune demande n’a été envoyée." }, 503);
      }
      const reference = createQuoteReference(options.now?.());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": reference,
          },
          signal: controller.signal,
          body: JSON.stringify({
            from: config.from, to: [config.to], reply_to: validation.quote.email,
            subject: `Nouvelle demande de devis — ${reference}`,
            text: quoteEmailText(validation.quote, reference),
          }),
        });
        if (!result.ok) throw new Error("Email provider rejected the request");
        const acceptance: unknown = await result.json();
        if (!acceptance || typeof acceptance !== "object" ||
            !("id" in acceptance) || typeof acceptance.id !== "string" ||
            !acceptance.id.trim() || acceptance.id.length > 200) {
          throw new Error("Email provider did not confirm acceptance");
        }
        return jsonResponse({ success: true, reference });
      } catch {
        return jsonResponse({ error: "L’envoi n’a pas pu être confirmé. Réessayez dans quelques instants." }, 502);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
