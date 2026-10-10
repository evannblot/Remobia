import {
  TRADE_IN_ACCESSORIES, TRADE_IN_ANSWERS, TRADE_IN_CONDITIONS, TRADE_IN_DEFECTS, TRADE_IN_PHOTO_LIMIT,
  type TradeInDetails, type TradeInRequest,
} from "./trade-in";
import { imageMime, isCatalogAdmin, type CatalogBindings } from "./catalog-server";
import { isValidEmail } from "./email-validation.mjs";

export const MAX_TRADE_IN_BODY_BYTES = TRADE_IN_PHOTO_LIMIT * 4 + 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIDES = ["front", "back", "additional1", "additional2"] as const;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie, oai-authenticated-user-id, oai-authenticated-user-email" };
type Side = typeof SIDES[number];
type RequestRow = { id: string; request_id: string; reference: string; fingerprint: string; details: string; created_at: string; state: "active" | "deleting" | "deleted" };
type ImageRow = { id: string; request_id: string; object_key: string; mime_type: string; side: Side };
type Photo = { side: Side; bytes: Uint8Array; mime: string };
type UploadedPhoto = { id: string; key: string; side: Side; mime: string };
class TradeInError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function json(value: unknown, status = 200, privateResponse = false): Response {
  return Response.json(value, { status, headers: privateResponse ? PRIVATE_HEADERS : { "Cache-Control": "no-store" } });
}
function failure(error: unknown, privateResponse = false): Response {
  return error instanceof TradeInError ? json({ error: error.message }, error.status, privateResponse) :
    json({ error: "La demande de reprise est temporairement indisponible. Réessayez dans un instant." }, 503, privateResponse);
}
function requireBindings(bindings: CatalogBindings): { db: D1Database; bucket: R2Bucket } {
  if (!bindings.DB || !bindings.BUCKET) throw new TradeInError("Les demandes de reprise sont en cours de configuration.", 503);
  return { db: bindings.DB, bucket: bindings.BUCKET };
}
function authorizeAdmin(request: Request, bindings: CatalogBindings): void {
  if (!request.headers.get("oai-authenticated-user-id") || !request.headers.get("oai-authenticated-user-email")) {
    throw new TradeInError("Connectez-vous pour consulter les demandes de reprise.", 401);
  }
  if (!bindings.SITE_ADMIN_EMAIL?.trim()) throw new TradeInError("L’accès à la gestion est en cours de configuration.", 503);
  if (!isCatalogAdmin(request, bindings)) throw new TradeInError("Cet espace est réservé au propriétaire de l’activité.", 403);
}
function assertOrigin(request: Request): void {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new TradeInError("Cette demande doit être effectuée depuis le site.", 403);
  }
}
function field(input: Record<string, unknown>, key: string, limit: number, required = false, multiline = false): string {
  const raw = input[key];
  if (typeof raw !== "string" || raw.length > limit ||
      (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(raw)) {
    throw new TradeInError("Vérifiez les champs et la longueur des textes de votre demande.");
  }
  const value = raw.trim();
  if (required && !value) throw new TradeInError("Complétez les informations obligatoires de votre demande.");
  return value;
}
function choice<T extends string>(input: Record<string, unknown>, key: string, values: Record<T, string>): T {
  const value = input[key];
  if (typeof value !== "string" || !Object.hasOwn(values, value)) throw new TradeInError("Vérifiez l’état et les réponses concernant votre téléphone.");
  return value as T;
}
function choices<T extends string>(input: Record<string, unknown>, key: string, values: Record<T, string>): T[] {
  const value = input[key];
  if (!Array.isArray(value) || value.length > Object.keys(values).length || new Set(value).size !== value.length ||
      value.some((item) => typeof item !== "string" || !Object.hasOwn(values, item))) {
    throw new TradeInError("Vérifiez les problèmes et les accessoires sélectionnés.");
  }
  // Checkbox order does not change a submission's identity.
  return [...value].sort() as T[];
}

export function validateTradeInDetails(value: unknown): TradeInDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TradeInError("La demande est incorrecte.");
  const input = value as Record<string, unknown>;
  const requestId = field(input, "requestId", 36, true).toLowerCase();
  if (!UUID.test(requestId)) throw new TradeInError("L’identifiant de la demande est incorrect. Rechargez le formulaire.");
  const brand = field(input, "brand", 80, true);
  const model = field(input, "model", 100, true);
  const storage = field(input, "storage", 80);
  const color = field(input, "color", 80);
  const condition = choice(input, "condition", TRADE_IN_CONDITIONS);
  const powersOn = choice(input, "powersOn", TRADE_IN_ANSWERS);
  const unlocked = choice(input, "unlocked", TRADE_IN_ANSWERS);
  if (input.battery !== null && (typeof input.battery !== "number" || !Number.isInteger(input.battery) || input.battery < 0 || input.battery > 100)) {
    throw new TradeInError("La batterie doit être un pourcentage de 0 à 100, ou rester non renseignée.");
  }
  const defects = choices(input, "defects", TRADE_IN_DEFECTS);
  const description = field(input, "description", 3000, defects.length > 0, true);
  const repairs = field(input, "repairs", 1500, false, true);
  const accessories = choices(input, "accessories", TRADE_IN_ACCESSORIES);
  const name = field(input, "name", 80, true);
  const email = field(input, "email", 254, true);
  const phone = field(input, "phone", 30);
  const website = field(input, "website", 200);
  if (website) throw new TradeInError("Cette demande ne peut pas être envoyée.");
  if (name.length < 2) throw new TradeInError("Indiquez votre nom ou prénom (2 caractères minimum).");
  if (!isValidEmail(email)) throw new TradeInError("Indiquez une adresse email valide.");
  if (phone && (!/^\+?[0-9 ().-]{6,30}$/.test(phone) || phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 15)) {
    throw new TradeInError("Vérifiez le numéro de téléphone ou laissez ce champ vide.");
  }
  if (input.consent !== true) throw new TradeInError("Votre accord est nécessaire pour traiter votre demande.");
  return { requestId, brand, model, storage, color, condition, powersOn, unlocked, battery: input.battery as number | null,
    defects, description, repairs, accessories, name, email, phone, consent: true, website: "" };
}

async function boundedFormData(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type)) throw new TradeInError("Le format de la demande est incorrect.", 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_TRADE_IN_BODY_BYTES)) {
    throw new TradeInError("Les photos dépassent la taille autorisée.", 413);
  }
  if (!request.body) throw new TradeInError("La demande est vide.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_TRADE_IN_BODY_BYTES) {
        await reader.cancel();
        throw new TradeInError("Les photos dépassent la taille autorisée.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return await new Response(bytes, { headers: { "Content-Type": type } }).formData(); }
  catch { throw new TradeInError("La demande n’a pas pu être lue. Réessayez."); }
}
async function readInput(request: Request): Promise<{ details: TradeInDetails; photos: Photo[] }> {
  const form = await boundedFormData(request);
  for (const key of form.keys()) if (!["details", "frontPhoto", "backPhoto", "additionalPhotos"].includes(key)) throw new TradeInError("Un champ de la demande est incorrect.");
  const detailValues = form.getAll("details");
  if (detailValues.length !== 1 || typeof detailValues[0] !== "string" || detailValues[0].length > 20_000) throw new TradeInError("La demande est incorrecte.");
  let raw: unknown;
  try { raw = JSON.parse(detailValues[0]); } catch { throw new TradeInError("La demande est incorrecte."); }
  const details = validateTradeInDetails(raw);
  const front = form.getAll("frontPhoto"), back = form.getAll("backPhoto"), additional = form.getAll("additionalPhotos");
  if (front.length !== 1 || back.length !== 1) throw new TradeInError("Ajoutez une photo de l’avant et une photo de l’arrière du téléphone.");
  if (additional.length > 2) throw new TradeInError("Ajoutez au maximum deux photos supplémentaires.");
  const files = [...front, ...back, ...additional];
  const photos: Photo[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (typeof file === "string" || file.size === 0) throw new TradeInError("Chaque photo doit être une image non vide.");
    if (file.size > TRADE_IN_PHOTO_LIMIT) throw new TradeInError("Chaque photo doit faire au maximum 3 Mo.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = imageMime(bytes);
    if (!mime || mime !== file.type) throw new TradeInError("Utilisez des photos JPEG, PNG ou WebP valides.");
    photos.push({ side: SIDES[index], bytes, mime });
  }
  return { details, photos };
}

async function digest(bytes: Uint8Array): Promise<string> {
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer));
  return Array.from(result, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function fingerprint(details: TradeInDetails, photos: Photo[]): Promise<string> {
  const hashes = [];
  for (const photo of photos) hashes.push({ side: photo.side, mime: photo.mime, hash: await digest(photo.bytes) });
  return digest(new TextEncoder().encode(JSON.stringify({ details, photos: hashes })));
}
function persistableDetails(details: TradeInDetails): Omit<TradeInDetails, "website" | "consent" | "requestId"> {
  const { requestId: _requestId, website: _website, consent: _consent, ...saved } = details;
  return saved;
}
function assertBatch(results: D1Result[]): void {
  if (results.some((result) => !result.success)) throw new Error("Trade-in transaction failed");
}
async function getByRequestId(db: D1Database, requestId: string): Promise<RequestRow | null> {
  return db.prepare("SELECT id, request_id, reference, fingerprint, details, created_at, state FROM trade_in_requests WHERE request_id = ?").bind(requestId).first<RequestRow>();
}
function receipt(row: RequestRow, expectedFingerprint: string): Response {
  if (row.state !== "active") throw new TradeInError("Cette demande a été supprimée. Ouvrez une nouvelle demande si nécessaire.", 410);
  if (row.fingerprint !== expectedFingerprint) throw new TradeInError("Cette demande a déjà été enregistrée avec un contenu différent. Ouvrez une nouvelle demande pour modifier vos informations.", 409);
  return json({ success: true, id: row.id, reference: row.reference });
}
async function cleanupUploads(bucket: R2Bucket, photos: UploadedPhoto[]): Promise<void> {
  if (photos.length) await bucket.delete(photos.map((photo) => photo.key));
}
function asRequest(row: RequestRow, images: ImageRow[]): TradeInRequest {
  return { ...JSON.parse(row.details), id: row.id, reference: row.reference, createdAt: row.created_at,
    images: SIDES.flatMap((side) => images.some((image) => image.side === side) ? [{ side, url: `/api/admin/trade-in-images/${row.id}/${side}` }] : []) };
}

export function createTradeInHandlers(bindings: CatalogBindings) {
  return {
    async GET(): Promise<Response> {
      try {
        const { db } = requireBindings(bindings);
        // Verify the deployed migration instead of advertising a form that cannot save.
        await db.prepare("SELECT id FROM trade_in_requests LIMIT 1").first();
        await db.prepare("SELECT id FROM trade_in_images LIMIT 1").first();
        return json({ available: true });
      } catch { return json({ available: false }); }
    },
    async POST(request: Request): Promise<Response> {
      let uploaded: UploadedPhoto[] = [];
      let submission: { details: TradeInDetails; hash: string; id: string } | undefined;
      let attemptedCommit = false;
      try {
        assertOrigin(request);
        const { db, bucket } = requireBindings(bindings);
        const { details, photos } = await readInput(request);
        const hash = await fingerprint(details, photos);
        const existing = await getByRequestId(db, details.requestId);
        if (existing) return receipt(existing, hash);
        const id = crypto.randomUUID();
        submission = { details, hash, id };
        const reference = `R-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
        for (const photo of photos) {
          const imageId = crypto.randomUUID();
          const key = `trade-ins/${id}/${imageId}`;
          uploaded.push({ id: imageId, key, side: photo.side, mime: photo.mime });
          await bucket.put(key, photo.bytes, { httpMetadata: { contentType: photo.mime } });
        }
        const insert = db.prepare("INSERT INTO trade_in_requests (id, request_id, reference, fingerprint, details, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING")
          .bind(id, details.requestId, reference, hash, JSON.stringify(persistableDetails(details)), new Date().toISOString());
        // A competing retry may win the requestId; only this attempt's random id can own its photos.
        const images = uploaded.map((photo) => db.prepare("INSERT INTO trade_in_images (id, request_id, object_key, mime_type, side) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM trade_in_requests WHERE id = ? AND state = 'active')")
          .bind(photo.id, id, photo.key, photo.mime, photo.side, id));
        attemptedCommit = true;
        assertBatch(await db.batch([insert, ...images]));
        const saved = await getByRequestId(db, details.requestId);
        if (!saved) throw new Error("Trade-in receipt missing");
        if (saved.id !== id) {
          await cleanupUploads(bucket, uploaded);
          uploaded = [];
        }
        return receipt(saved, hash);
      } catch (error) {
        // A database timeout can occur after a successful commit. Never remove a saved request's photos.
        let safeToClean = !attemptedCommit;
        if (attemptedCommit && submission && bindings.DB) {
          try {
            const saved = await getByRequestId(bindings.DB, submission.details.requestId);
            safeToClean = !saved || saved.id !== submission.id;
            if (saved?.id === submission.id && saved.state === "active" && saved.fingerprint === submission.hash) {
              return receipt(saved, submission.hash);
            }
          } catch { safeToClean = false; }
        }
        if (safeToClean && bindings.BUCKET) await cleanupUploads(bindings.BUCKET, uploaded).catch(() => undefined);
        return failure(error);
      }
    },
    async ADMIN_GET(request: Request): Promise<Response> {
      try {
        authorizeAdmin(request, bindings);
        const { db } = requireBindings(bindings);
        const rows = await db.prepare("SELECT id, request_id, reference, fingerprint, details, created_at, state FROM trade_in_requests WHERE state = 'active' ORDER BY created_at DESC, id DESC").all<RequestRow>();
        const images = await db.prepare("SELECT i.id, i.request_id, i.object_key, i.mime_type, i.side FROM trade_in_images i INNER JOIN trade_in_requests r ON r.id = i.request_id WHERE r.state = 'active'").all<ImageRow>();
        if (!rows.success || !images.success) throw new Error("Trade-in list unavailable");
        return json({ requests: rows.results.map((row) => asRequest(row, images.results.filter((image) => image.request_id === row.id))) }, 200, true);
      } catch (error) { return failure(error, true); }
    },
    async DELETE(request: Request, id: string): Promise<Response> {
      try {
        authorizeAdmin(request, bindings);
        assertOrigin(request);
        const { db, bucket } = requireBindings(bindings);
        if (!UUID.test(id)) throw new TradeInError("Demande introuvable.", 404);
        const current = await db.prepare("SELECT state FROM trade_in_requests WHERE id = ?").bind(id).first<{ state: RequestRow["state"] }>();
        if (!current) throw new TradeInError("Demande introuvable.", 404);
        if (current.state === "deleted") return json({ success: true }, 200, true);
        // Hide and erase personal details first. Retain photo keys until R2 confirms deletion so a failed deletion can be retried.
        const results = await db.batch([
          db.prepare("UPDATE trade_in_requests SET state = 'deleting', details = '{}', fingerprint = '' WHERE id = ? AND state != 'deleted'").bind(id),
          db.prepare("SELECT object_key FROM trade_in_images WHERE request_id = ?").bind(id),
        ]);
        assertBatch(results);
        const keys = (results[1].results as { object_key: string }[]).map((image) => image.object_key);
        if (keys.length) await bucket.delete(keys);
        assertBatch(await db.batch([
          db.prepare("DELETE FROM trade_in_images WHERE request_id = ? AND EXISTS (SELECT 1 FROM trade_in_requests WHERE id = ? AND state = 'deleting')").bind(id, id),
          db.prepare("UPDATE trade_in_requests SET state = 'deleted' WHERE id = ? AND state = 'deleting'").bind(id),
        ]));
        return json({ success: true }, 200, true);
      } catch (error) { return failure(error, true); }
    },
    async IMAGE_GET(request: Request, id: string, side: string): Promise<Response> {
      try {
        authorizeAdmin(request, bindings);
        const { db, bucket } = requireBindings(bindings);
        if (!UUID.test(id) || !SIDES.includes(side as Side)) throw new TradeInError("Photo introuvable.", 404);
        const image = await db.prepare("SELECT i.object_key, i.mime_type FROM trade_in_images i INNER JOIN trade_in_requests r ON r.id = i.request_id WHERE r.id = ? AND i.side = ? AND r.state = 'active'")
          .bind(id, side).first<{ object_key: string; mime_type: string }>();
        if (!image) throw new TradeInError("Photo introuvable.", 404);
        const object = await bucket.get(image.object_key);
        if (!object) throw new TradeInError("Photo introuvable.", 404);
        return new Response(object.body, { headers: { ...PRIVATE_HEADERS, "Content-Type": image.mime_type,
          "X-Content-Type-Options": "nosniff", "Content-Length": String(object.size), "Content-Disposition": "inline" } });
      } catch (error) { return failure(error, true); }
    },
  };
}
