import type { PhoneListing } from "./catalog";

export type CatalogBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  SITE_ADMIN_EMAIL?: string;
};

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_CATALOG_BODY_BYTES = MAX_PHOTO_BYTES * 4 + 64 * 1024;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_PATH_PATTERN = /^\/api\/phone-images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie, oai-authenticated-user-id, oai-authenticated-user-email" };
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const PHONE_COLUMNS = "id, brand, model, storage, color, condition, price_cents, battery, description, status, created_at, updated_at, version";
const CONFLICT_MESSAGE = "Cette annonce a été modifiée ou supprimée depuis son ouverture. Vos changements n’ont pas été enregistrés. Actualisez la fiche avant de réessayer.";

type ListingInput = Omit<PhoneListing, "id" | "createdAt" | "updatedAt" | "version">;
type PhoneRow = Omit<PhoneListing, "priceCents" | "createdAt" | "updatedAt" | "images"> & {
  price_cents: number;
  created_at: string;
  updated_at: string;
};
type ImageRow = { id: string; phone_id: string; object_key: string; mime_type: string; position: number };
type UploadedImage = { id: string; key: string; mime: string };

class CatalogError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function json(value: unknown, status = 200, privateResponse = false): Response {
  return Response.json(value, { status, headers: privateResponse ? PRIVATE_HEADERS : NO_STORE_HEADERS });
}

function failure(error: unknown, privateResponse = false): Response {
  if (error instanceof CatalogError) return json({ error: error.message }, error.status, privateResponse);
  return json({ error: "Le catalogue est temporairement indisponible. Réessayez dans un instant." }, 503, privateResponse);
}

/** The hosted Sites gateway validates identity and injects these headers; service access alone has no visitor identity. */
export function isCatalogAdmin(request: Request, bindings: CatalogBindings): boolean {
  const expectedEmail = bindings.SITE_ADMIN_EMAIL?.trim().toLowerCase();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  return !!expectedEmail && !!userId && !!email && email === expectedEmail;
}

function authorizeAdmin(request: Request, bindings: CatalogBindings): void {
  if (!request.headers.get("oai-authenticated-user-id") || !request.headers.get("oai-authenticated-user-email")) {
    throw new CatalogError("Connectez-vous pour gérer les téléphones.", 401);
  }
  if (!bindings.SITE_ADMIN_EMAIL?.trim()) throw new CatalogError("L’accès à la gestion est en cours de configuration.", 503);
  if (!isCatalogAdmin(request, bindings)) throw new CatalogError("Cet espace est réservé au propriétaire de l’activité.", 403);
}

export function assertCatalogOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new CatalogError("Cette demande doit être effectuée depuis le site.", 403);
  }
}

function requireBindings(bindings: CatalogBindings): { db: D1Database; bucket: R2Bucket } {
  if (!bindings.DB || !bindings.BUCKET) throw new CatalogError("Le catalogue est en cours de configuration.", 503);
  return { db: bindings.DB, bucket: bindings.BUCKET };
}

function textField(record: Record<string, unknown>, field: string, maximum: number, required = false): string {
  const raw = record[field] ?? "";
  if (typeof raw !== "string") throw new CatalogError("Un champ de l’annonce est incorrect.");
  const value = raw.trim();
  if (value.length > maximum || (required && !value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new CatalogError("Vérifiez les champs et la longueur des textes de l’annonce.");
  }
  return value;
}

export function validateListing(value: unknown): ListingInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogError("L’annonce est incorrecte.");
  const input = value as Record<string, unknown>;
  const brand = textField(input, "brand", 60, true);
  const model = textField(input, "model", 120, true);
  const storage = textField(input, "storage", 40);
  const color = textField(input, "color", 60);
  const description = textField(input, "description", 3000);
  if (typeof input.priceCents !== "number" || !Number.isSafeInteger(input.priceCents) || input.priceCents < 1 || input.priceCents > 1_000_000) {
    throw new CatalogError("Indiquez un prix entre 0,01 € et 10 000 €.");
  }
  if (input.battery !== null && (typeof input.battery !== "number" || !Number.isInteger(input.battery) || input.battery < 0 || input.battery > 100)) {
    throw new CatalogError("La batterie doit être un pourcentage de 0 à 100, ou rester non renseignée.");
  }
  if (input.condition !== "excellent" && input.condition !== "good" && input.condition !== "fair") throw new CatalogError("Choisissez l’état du téléphone.");
  if (input.status !== "draft" && input.status !== "published" && input.status !== "sold") throw new CatalogError("Choisissez le statut de l’annonce.");
  const images = input.images ?? [];
  if (!Array.isArray(images) || images.length > 4 || images.some((image) => typeof image !== "string" || !IMAGE_PATH_PATTERN.test(image)) || new Set(images).size !== images.length) {
    throw new CatalogError("Les photos conservées sont incorrectes.");
  }
  return { brand, model, storage, color, description, priceCents: input.priceCents, battery: input.battery as number | null,
    condition: input.condition, status: input.status, images: images as string[] };
}

/** Validate actual file bytes as well as the browser-provided media type. */
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return "image/webp";
  return null;
}

async function boundedFormData(request: Request): Promise<FormData> {
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) throw new CatalogError("Le format de l’annonce est incorrect.", 415);
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_CATALOG_BODY_BYTES)) throw new CatalogError("Les photos dépassent la taille autorisée.", 413);
  if (!request.body) throw new CatalogError("L’annonce est vide.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CATALOG_BODY_BYTES) {
        await reader.cancel();
        throw new CatalogError("Les photos dépassent la taille autorisée.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try { return await new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
  catch { throw new CatalogError("L’annonce n’a pas pu être lue."); }
}

async function readInput(request: Request, updating: boolean): Promise<{ listing: ListingInput; expectedVersion: number | null; photos: { bytes: Uint8Array; mime: string }[] }> {
  const form = await boundedFormData(request);
  for (const key of form.keys()) if (key !== "listing" && key !== "photos") throw new CatalogError("Un champ de l’annonce est incorrect.");
  const listingValues = form.getAll("listing");
  if (listingValues.length !== 1 || typeof listingValues[0] !== "string" || listingValues[0].length > 20_000) throw new CatalogError("L’annonce est incorrecte.");
  let raw: unknown;
  try { raw = JSON.parse(listingValues[0]); } catch { throw new CatalogError("L’annonce est incorrecte."); }
  if (updating && (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).images))) throw new CatalogError("Indiquez les photos à conserver.");
  const expectedVersion = updating ? (raw as Record<string, unknown>).expectedVersion : null;
  if (updating && (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || expectedVersion >= Number.MAX_SAFE_INTEGER)) {
    throw new CatalogError("La version de cette annonce est incorrecte. Actualisez la fiche avant de réessayer.");
  }
  const listing = validateListing(raw);
  const files = form.getAll("photos");
  if (files.length + listing.images.length > 4) throw new CatalogError("Ajoutez au maximum quatre photos.");
  const photos: { bytes: Uint8Array; mime: string }[] = [];
  for (const file of files) {
    if (typeof file === "string" || !file.size || file.size > MAX_PHOTO_BYTES) throw new CatalogError("Chaque photo doit faire moins de 3 Mo et ne pas être vide.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = imageMime(bytes);
    if (!mime || mime !== file.type) throw new CatalogError("Utilisez une photo JPEG, PNG ou WebP valide.");
    photos.push({ bytes, mime });
  }
  return { listing, expectedVersion: expectedVersion as number | null, photos };
}

function asPhone(row: PhoneRow, images: ImageRow[]): PhoneListing {
  return {
    id: row.id, brand: row.brand, model: row.model, storage: row.storage, color: row.color,
    condition: row.condition, priceCents: row.price_cents, battery: row.battery, description: row.description,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
    images: images.map((image) => `/api/phone-images/${image.id}`),
  };
}

async function getImages(db: D1Database, id: string): Promise<ImageRow[]> {
  const result = await db.prepare("SELECT id, phone_id, object_key, mime_type, position FROM phone_images WHERE phone_id = ? ORDER BY position, id").bind(id).all<ImageRow>();
  return result.results;
}

async function getPhone(db: D1Database, id: string): Promise<{ phone: PhoneListing; images: ImageRow[] } | null> {
  if (!ID_PATTERN.test(id)) return null;
  const row = await db.prepare(`SELECT ${PHONE_COLUMNS} FROM phone_listings WHERE id = ?`).bind(id).first<PhoneRow>();
  if (!row) return null;
  const images = await getImages(db, id);
  return { phone: asPhone(row, images), images };
}

export async function getPublishedPhone(db: D1Database, id: string): Promise<PhoneListing | null> {
  if (!ID_PATTERN.test(id)) return null;
  const row = await db.prepare(`SELECT ${PHONE_COLUMNS} FROM phone_listings WHERE id = ? AND status = 'published'`).bind(id).first<PhoneRow>();
  if (!row) return null;
  return asPhone(row, await getImages(db, id));
}

async function listPhones(db: D1Database, publicOnly: boolean): Promise<PhoneListing[]> {
  const phones = await db.prepare(`SELECT ${PHONE_COLUMNS} FROM phone_listings${publicOnly ? " WHERE status = 'published'" : ""} ORDER BY updated_at DESC, id DESC`).all<PhoneRow>();
  const images = await db.prepare(`SELECT i.id, i.phone_id, i.object_key, i.mime_type, i.position FROM phone_images i INNER JOIN phone_listings p ON p.id = i.phone_id${publicOnly ? " WHERE p.status = 'published'" : ""} ORDER BY i.position, i.id`).all<ImageRow>();
  const byPhone = new Map<string, ImageRow[]>();
  for (const image of images.results) {
    const group = byPhone.get(image.phone_id) ?? [];
    group.push(image);
    byPhone.set(image.phone_id, group);
  }
  return phones.results.map((phone) => asPhone(phone, byPhone.get(phone.id) ?? []));
}

async function cleanupImages(bucket: R2Bucket, keys: string[]): Promise<void> {
  if (keys.length) await bucket.delete(keys).catch(() => undefined);
}

async function uploadImages(bucket: R2Bucket, phoneId: string, photos: { bytes: Uint8Array; mime: string }[]): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  try {
    for (const photo of photos) {
      const id = crypto.randomUUID();
      const key = `phones/${phoneId}/${id}`;
      uploaded.push({ id, key, mime: photo.mime });
      await bucket.put(key, photo.bytes, { httpMetadata: { contentType: photo.mime } });
    }
    return uploaded;
  } catch (error) {
    await cleanupImages(bucket, uploaded.map((image) => image.key));
    throw error;
  }
}

function imageInsert(db: D1Database, phoneId: string, image: UploadedImage, position: number): D1PreparedStatement {
  return db.prepare("INSERT INTO phone_images (id, phone_id, object_key, mime_type, position) VALUES (?, ?, ?, ?, ?)").bind(image.id, phoneId, image.key, image.mime, position);
}

/** Every photo mutation shares the successful update's marker inside the same D1 transaction. */
function guardedImageInsert(db: D1Database, phoneId: string, image: UploadedImage, position: number, writeToken: string): D1PreparedStatement {
  return db.prepare("INSERT INTO phone_images (id, phone_id, object_key, mime_type, position) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM phone_listings WHERE id = ? AND write_token = ?)")
    .bind(image.id, phoneId, image.key, image.mime, position, phoneId, writeToken);
}

function assertBatch(results: D1Result[]): void {
  if (results.some((result) => !result.success)) throw new Error("Catalogue transaction failed");
}

export function createCatalogHandlers(bindings: CatalogBindings) {
  return {
    async PUBLIC_GET(): Promise<Response> {
      try { return json({ phones: await listPhones(requireBindings(bindings).db, true) }); }
      catch (error) { return failure(error); }
    },
    async ADMIN_GET(request: Request): Promise<Response> {
      try {
        authorizeAdmin(request, bindings);
        return json({ phones: await listPhones(requireBindings(bindings).db, false) }, 200, true);
      } catch (error) { return failure(error, true); }
    },
    async POST(request: Request): Promise<Response> {
      let uploaded: UploadedImage[] = [];
      try {
        authorizeAdmin(request, bindings);
        assertCatalogOrigin(request);
        const { db, bucket } = requireBindings(bindings);
        const { listing, photos } = await readInput(request, false);
        if (listing.images.length) throw new CatalogError("Une nouvelle annonce ne peut pas reprendre des photos existantes.");
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        uploaded = await uploadImages(bucket, id, photos);
        const insert = db.prepare("INSERT INTO phone_listings (id, brand, model, storage, color, condition, price_cents, battery, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, listing.brand, listing.model, listing.storage, listing.color, listing.condition, listing.priceCents, listing.battery, listing.description, listing.status, now, now);
        assertBatch(await db.batch([insert, ...uploaded.map((image, index) => imageInsert(db, id, image, index))]));
        return json({ phone: { ...listing, id, images: uploaded.map((image) => `/api/phone-images/${image.id}`), createdAt: now, updatedAt: now, version: 1 } }, 201, true);
      } catch (error) {
        if (bindings.BUCKET) await cleanupImages(bindings.BUCKET, uploaded.map((image) => image.key));
        return failure(error, true);
      }
    },
    async PUT(request: Request, id: string): Promise<Response> {
      let uploaded: UploadedImage[] = [];
      try {
        authorizeAdmin(request, bindings);
        assertCatalogOrigin(request);
        const { db, bucket } = requireBindings(bindings);
        const current = await getPhone(db, id);
        if (!current) throw new CatalogError(CONFLICT_MESSAGE, ID_PATTERN.test(id) ? 409 : 404);
        const { listing, photos, expectedVersion } = await readInput(request, true);
        if (current.phone.version !== expectedVersion) throw new CatalogError(CONFLICT_MESSAGE, 409);
        const byPath = new Map(current.images.map((image) => [`/api/phone-images/${image.id}`, image]));
        if (listing.images.some((path) => !byPath.has(path))) throw new CatalogError("Une photo n’appartient pas à cette annonce.");
        const retained = listing.images.map((path) => byPath.get(path)!);
        const removed = current.images.filter((image) => !listing.images.includes(`/api/phone-images/${image.id}`));
        const now = new Date().toISOString();
        uploaded = await uploadImages(bucket, id, photos);
        const writeToken = crypto.randomUUID();
        const update = db.prepare("UPDATE phone_listings SET brand = ?, model = ?, storage = ?, color = ?, condition = ?, price_cents = ?, battery = ?, description = ?, status = ?, updated_at = ?, version = version + 1, write_token = ? WHERE id = ? AND version = ?")
          .bind(listing.brand, listing.model, listing.storage, listing.color, listing.condition, listing.priceCents, listing.battery, listing.description, listing.status, now, writeToken, id, expectedVersion);
        const statements = [update,
          ...removed.map((image) => db.prepare("DELETE FROM phone_images WHERE id = ? AND phone_id = ? AND EXISTS (SELECT 1 FROM phone_listings WHERE id = ? AND write_token = ?)").bind(image.id, id, id, writeToken)),
          ...retained.map((image, index) => db.prepare("UPDATE phone_images SET position = ? WHERE id = ? AND phone_id = ? AND EXISTS (SELECT 1 FROM phone_listings WHERE id = ? AND write_token = ?)").bind(index, image.id, id, id, writeToken)),
          ...uploaded.map((image, index) => guardedImageInsert(db, id, image, retained.length + index, writeToken))];
        const results = await db.batch(statements);
        assertBatch(results);
        if (results[0]?.meta.changes !== 1) throw new CatalogError(CONFLICT_MESSAGE, 409);
        await cleanupImages(bucket, removed.map((image) => image.object_key));
        return json({ phone: { ...listing, id, images: [...listing.images, ...uploaded.map((image) => `/api/phone-images/${image.id}`)], createdAt: current.phone.createdAt, updatedAt: now, version: expectedVersion! + 1 } }, 200, true);
      } catch (error) {
        if (bindings.BUCKET) await cleanupImages(bindings.BUCKET, uploaded.map((image) => image.key));
        return failure(error, true);
      }
    },
    async DELETE(request: Request, id: string): Promise<Response> {
      try {
        authorizeAdmin(request, bindings);
        assertCatalogOrigin(request);
        const { db, bucket } = requireBindings(bindings);
        const current = await getPhone(db, id);
        if (!current) throw new CatalogError("Cette annonce est introuvable.", 404);
        const results = await db.batch<{ object_key: string }>([
          db.prepare("SELECT object_key FROM phone_images WHERE phone_id = ?").bind(id),
          db.prepare("DELETE FROM phone_images WHERE phone_id = ?").bind(id),
          db.prepare("DELETE FROM phone_listings WHERE id = ?").bind(id),
        ]);
        assertBatch(results);
        await cleanupImages(bucket, results[0].results.map((image) => image.object_key));
        return json({ deleted: true }, 200, true);
      } catch (error) { return failure(error, true); }
    },
    async IMAGE_GET(request: Request, id: string): Promise<Response> {
      try {
        if (!ID_PATTERN.test(id)) throw new CatalogError("Photo introuvable.", 404);
        const { db, bucket } = requireBindings(bindings);
        const image = await db.prepare("SELECT i.id, i.phone_id, i.object_key, i.mime_type, i.position, p.status FROM phone_images i INNER JOIN phone_listings p ON p.id = i.phone_id WHERE i.id = ?").bind(id).first<ImageRow & { status: PhoneListing["status"] }>();
        if (!image || (image.status !== "published" && !isCatalogAdmin(request, bindings))) throw new CatalogError("Photo introuvable.", 404);
        const object = await bucket.get(image.object_key);
        if (!object) throw new CatalogError("Photo introuvable.", 404);
        return new Response(object.body, { headers: { ...PRIVATE_HEADERS, "Content-Type": image.mime_type, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Content-Length": String(object.size) } });
      } catch (error) { return failure(error, true); }
    },
  };
}
