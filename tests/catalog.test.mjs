import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  createCatalogHandlers, getPublishedPhone, imageMime, isCatalogAdmin,
  MAX_CATALOG_BODY_BYTES, MAX_PHOTO_BYTES, validateListing,
} from "../app/lib/catalog-server.ts";

// Synthetic owner identity and in-memory D1/R2 adapters: no hosted records are written.
const OWNER = { "oai-authenticated-user-id": "site-scoped-synthetic-owner-id", "oai-authenticated-user-email": "owner@example.test" };
const valid = { brand: "Samsung", model: "Galaxy S23", storage: "128 Go", color: "Noir",
  condition: "good", priceCents: 25900, battery: null, description: "Annonce de test",
  status: "draft", images: [] };
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64"));

function fixtures() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrationFolder = new URL("../drizzle/", import.meta.url);
  for (const filename of readdirSync(migrationFolder).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(filename, migrationFolder), "utf8"));
  }
  let batchTail = Promise.resolve();
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { sql, values: [],
        bind(...values) { this.values = values; return this; },
        async first() { return statement.get(...this.values) ?? null; },
        async all() { return { success: true, results: statement.all(...this.values) }; },
        run() {
          if (statement.columns().length) return { success: true, results: statement.all(...this.values), meta: { changes: 0 } };
          const result = statement.run(...this.values);
          return { success: true, results: [], meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      // D1 batches are atomic. Serialize competing transactions instead of interleaving test awaits.
      const previous = batchTail;
      let release;
      batchTail = new Promise((resolve) => { release = resolve; });
      await previous;
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      finally { release(); }
    },
  };
  const objects = new Map();
  const bucket = {
    puts: 0, deletes: [],
    async put(key, bytes, options) { this.puts++; await this.beforePut?.(key); objects.set(key, { bytes: bytes.slice(), options }); },
    async delete(keys) { for (const key of typeof keys === "string" ? [keys] : keys) { this.deletes.push(key); objects.delete(key); } },
    async get(key) { const object = objects.get(key); return object ? { body: object.bytes, size: object.bytes.length } : null; },
  };
  const env = { DB: db, BUCKET: bucket, SITE_ADMIN_EMAIL: "owner@example.test" };
  return { db, bucket, objects, sqlite, env, handlers: createCatalogHandlers(env) };
}

function request(method = "GET", listing = valid, photos = [], headers = OWNER) {
  const url = "https://atelier.example.test/api/admin/phones";
  if (method === "GET" || method === "DELETE") return new Request(url, { method, headers: { origin: "https://atelier.example.test", ...headers } });
  const form = new FormData();
  const content = method === "POST" && listing && typeof listing === "object" && !Object.hasOwn(listing, "requestId")
    ? { ...listing, requestId: crypto.randomUUID() }
    : method === "PUT" && listing?.version !== undefined && !Object.hasOwn(listing, "expectedVersion")
      ? { ...listing, expectedVersion: listing.version } : listing;
  form.set("listing", JSON.stringify(content));
  for (const photo of photos) form.append("photos", photo);
  return new Request(url, { method, headers: { origin: "https://atelier.example.test", ...headers }, body: form });
}

function photo(bytes = png, type = "image/png") { return new File([bytes], "photo.png", { type }); }
async function create(fixture, values = {}, photos = []) {
  const response = await fixture.handlers.POST(request("POST", { ...valid, ...values }, photos));
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return (await response.json()).phone;
}

test("owner authorization requires signed-in identity and matching configured email", () => {
  const env = { SITE_ADMIN_EMAIL: " OWNER@example.test " };
  assert.equal(isCatalogAdmin(request(), env), true);
  assert.equal(isCatalogAdmin(request("GET", valid, [], {}), env), false);
  assert.equal(isCatalogAdmin(request("GET", valid, [], { "oai-authenticated-user-email": OWNER["oai-authenticated-user-email"] }), env), false);
  assert.equal(isCatalogAdmin(request("GET", valid, [], { "oai-authenticated-user-id": OWNER["oai-authenticated-user-email"], "oai-authenticated-user-email": "visitor@example.test" }), env), false);
  assert.equal(isCatalogAdmin(request("GET", valid, [], { "OAI-Sites-Authorization": "Bearer synthetic-service-access" }), env), false);
  assert.equal(isCatalogAdmin(request(), {}), false);
});

test("the version migration preserves existing listings and their saved photo references", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  sqlite.exec(readFileSync(new URL(`../drizzle/${migrations[0]}`, import.meta.url), "utf8"));
  const id = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  sqlite.prepare("INSERT INTO phone_listings (id, brand, model, condition, price_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, "Samsung", "Galaxy S23", "good", 25900, "2026-10-05T10:00:00Z", "2026-10-05T10:00:00Z");
  sqlite.prepare("INSERT INTO phone_images (id, phone_id, object_key, mime_type, position) VALUES (?, ?, ?, ?, ?)")
    .run(imageId, id, `phones/${id}/${imageId}`, "image/png", 0);
  for (const filename of migrations.slice(1)) sqlite.exec(readFileSync(new URL(`../drizzle/${filename}`, import.meta.url), "utf8"));
  const preserved = sqlite.prepare("SELECT brand, model, price_cents, version, write_token FROM phone_listings WHERE id = ?").get(id);
  assert.deepEqual({ ...preserved }, { brand: "Samsung", model: "Galaxy S23", price_cents: 25900, version: 1, write_token: "" });
  assert.equal(sqlite.prepare("SELECT object_key FROM phone_images WHERE id = ?").get(imageId).object_key, `phones/${id}/${imageId}`);
  sqlite.close();
});

test("admin endpoints reject anonymous and non-owner calls before reading storage", async () => {
  const f = fixtures();
  assert.equal((await f.handlers.ADMIN_GET(request("GET", valid, [], {}))).status, 401);
  const visitor = { ...OWNER, "oai-authenticated-user-email": "visitor@example.test" };
  for (const response of [await f.handlers.ADMIN_GET(request("GET", valid, [], visitor)),
    await f.handlers.POST(request("POST", valid, [photo()], visitor)),
    await f.handlers.PUT(request("PUT", valid, [], visitor), crypto.randomUUID()),
    await f.handlers.DELETE(request("DELETE", valid, [], visitor), crypto.randomUUID())]) {
    assert.equal(response.status, 403);
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
  }
  assert.equal(f.bucket.puts, 0);
  assert.equal((await createCatalogHandlers({ ...f.env, SITE_ADMIN_EMAIL: undefined }).ADMIN_GET(request())).status, 503);
  f.sqlite.close();
});

test("mutation origin is mandatory and cross-site requests cannot create records or upload photos", async () => {
  const f = fixtures();
  for (const headers of [
    { ...OWNER, origin: "https://other.example.test" },
    { ...OWNER, origin: "null" },
    { ...OWNER, "sec-fetch-site": "cross-site" },
  ]) assert.equal((await f.handlers.POST(request("POST", valid, [photo()], headers))).status, 403);
  const missing = request("POST", valid, [photo()]);
  missing.headers.delete("origin");
  assert.equal((await f.handlers.POST(missing)).status, 403);
  assert.equal(f.bucket.puts, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM phone_listings").get().n, 0);
  f.sqlite.close();
});

test("validation normalizes text and rejects unbounded or invented states, prices, battery and image paths", () => {
  assert.equal(validateListing({ ...valid, brand: " Samsung " }).brand, "Samsung");
  for (const value of [null, [], { ...valid, brand: "" }, { ...valid, model: "x".repeat(121) },
    { ...valid, storage: "x".repeat(41) }, { ...valid, description: "x".repeat(3001) },
    { ...valid, priceCents: "100" }, { ...valid, priceCents: 0 }, { ...valid, priceCents: 1.2 },
    { ...valid, priceCents: Infinity }, { ...valid, priceCents: 1_000_001 },
    { ...valid, battery: undefined }, { ...valid, battery: 101 }, { ...valid, battery: 99.1 },
    { ...valid, condition: "new" }, { ...valid, status: "available" },
    { ...valid, images: ["https://evil.example.test/image.png"] },
    { ...valid, images: ["/api/phone-images/not-a-uuid"] }, { ...valid, brand: "a\u0000b" },
  ]) assert.throws(() => validateListing(value));
});

test("public catalogue contains only published records; admin sees draft and sold records", async () => {
  const f = fixtures();
  const published = await create(f, { status: "published", model: "Publication de test" });
  const draft = await create(f, { model: "Brouillon de test" });
  const sold = await create(f, { status: "sold", model: "Vente de test" });
  const publicResponse = await f.handlers.PUBLIC_GET();
  assert.equal(publicResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual((await publicResponse.json()).phones.map((phone) => phone.id), [published.id]);
  assert.equal((await (await f.handlers.ADMIN_GET(request())).json()).phones.length, 3);
  assert.equal((await getPublishedPhone(f.db, published.id)).id, published.id);
  assert.equal(await getPublishedPhone(f.db, draft.id), null);
  assert.equal(await getPublishedPhone(f.db, sold.id), null);
  assert.equal(await getPublishedPhone(f.db, "'; DROP TABLE phone_listings; --"), null);
  assert.match(published.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(published.version, 1);
  f.sqlite.close();
});

test("photo bytes must match the declared JPEG, PNG or WebP type and limits are enforced before upload", async () => {
  assert.equal(imageMime(png), "image/png");
  assert.equal(imageMime(Uint8Array.of(255, 216, 255)), "image/jpeg");
  assert.equal(imageMime(new TextEncoder().encode("RIFFxxxxWEBP")), "image/webp");
  assert.equal(imageMime(new TextEncoder().encode("<svg></svg>")), null);
  const f = fixtures();
  for (const [photos, status] of [
    [[photo(png, "image/jpeg")], 400], [[photo(new TextEncoder().encode("<svg></svg>"))], 400],
    [[photo(new Uint8Array(MAX_PHOTO_BYTES + 1))], 413],
    [Array.from({ length: 5 }, () => photo()), 400],
  ]) assert.equal((await f.handlers.POST(request("POST", valid, photos))).status, status);
  const oversized = request("POST");
  oversized.headers.set("content-length", String(MAX_CATALOG_BODY_BYTES + 1));
  assert.equal((await f.handlers.POST(oversized)).status, 413);
  assert.equal(f.bucket.puts, 0);
  f.sqlite.close();
});

test("draft and sold photos are hidden from visitors and become public only while published", async () => {
  const f = fixtures();
  const draft = await create(f, {}, [photo()]);
  const imageId = draft.images[0].split("/").pop();
  const anonymous = new Request(`https://atelier.example.test${draft.images[0]}`);
  const owner = new Request(anonymous.url, { headers: OWNER });
  assert.equal((await f.handlers.IMAGE_GET(anonymous, imageId)).status, 404);
  const privatePhoto = await f.handlers.IMAGE_GET(owner, imageId);
  assert.equal(privatePhoto.status, 200);
  assert.match(privatePhoto.headers.get("cache-control"), /private.*no-store/);
  assert.equal(privatePhoto.headers.get("x-content-type-options"), "nosniff");
  const publishedResponse = await f.handlers.PUT(request("PUT", { ...draft, status: "published" }), draft.id);
  assert.equal(publishedResponse.status, 200);
  const published = (await publishedResponse.json()).phone;
  assert.equal(published.version, 2);
  assert.equal((await f.handlers.IMAGE_GET(anonymous, imageId)).status, 200);
  assert.equal((await f.handlers.PUT(request("PUT", { ...published, status: "sold" }), draft.id)).status, 200);
  assert.equal((await f.handlers.IMAGE_GET(anonymous, imageId)).status, 404);
  f.sqlite.close();
});

test("updates cannot retain another listing’s photo and removal deletes only the owning listing’s object", async () => {
  const f = fixtures();
  const first = await create(f, {}, [photo()]);
  const second = await create(f, { model: "Autre téléphone de test" }, [photo()]);
  const crossPhoto = await f.handlers.PUT(request("PUT", { ...first, images: second.images }), first.id);
  assert.equal(crossPhoto.status, 400);
  assert.equal(f.objects.size, 2);
  const updated = await f.handlers.PUT(request("PUT", { ...first, images: [], status: "published" }), first.id);
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).phone.images, []);
  assert.equal(f.objects.size, 1);
  assert.equal((await f.handlers.IMAGE_GET(new Request(`https://atelier.example.test${second.images[0]}`, { headers: OWNER }), second.images[0].split("/").pop())).status, 200);
  assert.equal((await f.handlers.DELETE(request("DELETE"), second.id)).status, 200);
  assert.equal(f.objects.size, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM phone_listings").get().n, 1);
  f.sqlite.close();
});

test("database failure cleans new uploads and preserves already saved photos", async () => {
  const f = fixtures();
  const current = await create(f, {}, [photo()]);
  const failingDb = { ...f.db, async batch() { throw new Error("synthetic transaction failure"); } };
  const handlers = createCatalogHandlers({ ...f.env, DB: failingDb });
  const created = await handlers.POST(request("POST", valid, [photo()]));
  assert.equal(created.status, 503);
  assert.equal(f.objects.size, 1);
  const updated = await handlers.PUT(request("PUT", { ...current, images: [] }, [photo()]), current.id);
  assert.equal(updated.status, 503);
  assert.equal(f.objects.size, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM phone_images").get().n, 1);
  assert.ok(!(await updated.text()).includes("synthetic transaction failure"));
  f.sqlite.close();
});

test("updates require a valid expected version without changing the listing or uploading files", async () => {
  const f = fixtures();
  const current = await create(f);
  for (const expectedVersion of [undefined, null, 0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER]) {
    const response = await f.handlers.PUT(request("PUT", { ...current, expectedVersion }, [photo()]), current.id);
    assert.equal(response.status, 400);
  }
  assert.equal(f.bucket.puts, 0);
  assert.equal(f.sqlite.prepare("SELECT version FROM phone_listings WHERE id = ?").get(current.id).version, 1);
  f.sqlite.close();
});

test("an old editor cannot republish a sold phone or overwrite its current price and photos", async () => {
  const f = fixtures();
  const openedInTwoTabs = await create(f, { status: "published" }, [photo()]);
  const soldResponse = await f.handlers.PUT(request("PUT", { ...openedInTwoTabs, status: "sold" }), openedInTwoTabs.id);
  assert.equal(soldResponse.status, 200);
  const sold = (await soldResponse.json()).phone;
  assert.equal(sold.version, 2);
  const oldEditor = await f.handlers.PUT(request("PUT", { ...openedInTwoTabs, priceCents: 24900, images: [] }, [photo()]), openedInTwoTabs.id);
  assert.equal(oldEditor.status, 409);
  assert.match((await oldEditor.json()).error, /Actualisez/);
  const stored = f.sqlite.prepare("SELECT status, price_cents, version FROM phone_listings WHERE id = ?").get(sold.id);
  assert.deepEqual({ ...stored }, { status: "sold", price_cents: valid.priceCents, version: 2 });
  assert.equal(f.bucket.puts, 1);
  assert.equal(f.objects.size, 1);
  assert.equal((await (await f.handlers.ADMIN_GET(request())).json()).phones[0].images[0], sold.images[0]);
  f.sqlite.close();
});

function pauseCompetingUploads(bucket, arrivalsNeeded = 2) {
  let arrivals = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  bucket.beforePut = async () => {
    arrivals++;
    if (arrivals <= arrivalsNeeded) {
      if (arrivals === arrivalsNeeded) release();
      await ready;
    }
  };
}

test("a create retry after a lost HTTP response returns the original announcement without uploading again", async () => {
  const f = fixtures();
  const listing = { ...valid, status: "published", requestId: crypto.randomUUID() };
  // The server commits, but the caller loses the response and only knows requestId.
  const lostResponse = await f.handlers.POST(request("POST", listing, [photo()]));
  assert.equal(lostResponse.status, 201);
  const original = (await lostResponse.json()).phone;
  const retry = await f.handlers.POST(request("POST", listing, [new File([png], "renamed.png", { type: "image/png" })]));
  assert.equal(retry.status, 201);
  assert.deepEqual((await retry.json()).phone, original);
  assert.equal(original.id, listing.requestId);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images").get().n, 1);
  assert.equal(f.objects.size, 1);
  assert.equal(f.bucket.puts, 1);
  assert.equal((await (await f.handlers.PUBLIC_GET()).json()).phones.length, 1);
  f.sqlite.close();
});

test("an ambiguous committed database response keeps saved photos and can be retried with the same ID", async () => {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  const f = fixtures();
  f.env.OWNER_AUTH_CONFIGURED = true;
  f.env.OWNER_IDENTITY = { userId: "synthetic-owner", email: "owner@example.test", verified: true };
  let loseCommitResponse = true;
  let readsUnavailable = false;
  const db = { ...f.db, async batch(statements) {
    if (statements.some(statement => statement.sql.startsWith("INSERT INTO phone_listings")) && loseCommitResponse) {
      loseCommitResponse = false;
      await f.db.batch(statements);
      readsUnavailable = true;
      throw new Error("Synthetic lost database response");
    }
    if (readsUnavailable) throw new Error("Synthetic reconciliation outage");
    return f.db.batch(statements);
  } };
  const handlers = createCatalogHandlers({ ...f.env, DB: db });
  const listing = { ...valid, requestId: crypto.randomUUID() };
  try {
    const uncertain = await handlers.POST(request("POST", listing, [photo()]));
    assert.equal(uncertain.status, 503);
    assert.ok(!(await uncertain.text()).includes("Synthetic"));
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 1);
    assert.equal(f.objects.size, 1);
    assert.equal(f.bucket.deletes.length, 0);
    readsUnavailable = false;
    const retry = await handlers.POST(request("POST", listing, [photo()]));
    assert.equal(retry.status, 201);
    const saved = (await retry.json()).phone;
    assert.equal(saved.id, listing.requestId);
    assert.equal(saved.images.length, 1);
    assert.equal(saved.version, 1);
    assert.equal(f.bucket.puts, 1);
    const imageId = saved.images[0].split("/").pop();
    assert.equal((await handlers.IMAGE_GET(new Request(`https://atelier.example.test${saved.images[0]}`), imageId)).status, 200);
  } finally {
    f.sqlite.close();
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});

test("a committed transaction with a lost response is reconciled before any saved photo is cleaned", async () => {
  const f = fixtures();
  let loseCommitResponse = true;
  const db = { ...f.db, async batch(statements) {
    const result = await f.db.batch(statements);
    if (loseCommitResponse && statements.some(statement => statement.sql.startsWith("INSERT INTO phone_listings"))) {
      loseCommitResponse = false;
      throw new Error("Synthetic response lost after commit");
    }
    return result;
  } };
  const handlers = createCatalogHandlers({ ...f.env, DB: db });
  const listing = { ...valid, requestId: crypto.randomUUID() };
  const response = await handlers.POST(request("POST", listing, [photo()]));
  assert.equal(response.status, 201);
  const saved = (await response.json()).phone;
  assert.equal(saved.id, listing.requestId);
  assert.equal(saved.images.length, 1);
  assert.equal(f.objects.size, 1);
  assert.equal(f.bucket.deletes.length, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 1);
  f.sqlite.close();
});

test("simultaneous identical creates have one announcement and one photo set", async () => {
  const f = fixtures();
  const listing = { ...valid, requestId: crypto.randomUUID() };
  pauseCompetingUploads(f.bucket);
  const responses = await Promise.all([
    f.handlers.POST(request("POST", listing, [photo()])),
    f.handlers.POST(request("POST", listing, [photo()])),
  ]);
  assert.deepEqual(responses.map(response => response.status), [201, 201]);
  const first = (await responses[0].json()).phone;
  assert.deepEqual((await responses[1].json()).phone, first);
  assert.equal(first.id, listing.requestId);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images").get().n, 1);
  assert.equal(f.objects.size, 1);
  assert.equal(f.bucket.puts, 2);
  assert.equal(f.bucket.deletes.length, 1);
  f.sqlite.close();
});

test("different simultaneous creates cannot share an ID or append photos to the accepted creation", async () => {
  const f = fixtures();
  const requestId = crypto.randomUUID();
  pauseCompetingUploads(f.bucket);
  const responses = await Promise.all([
    f.handlers.POST(request("POST", { ...valid, requestId, model: "Accepted A" }, [photo()])),
    f.handlers.POST(request("POST", { ...valid, requestId, model: "Accepted B" }, [photo()])),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  const accepted = (await responses.find(response => response.status === 201).json()).phone;
  const current = (await (await f.handlers.ADMIN_GET(request())).json()).phones;
  assert.deepEqual(current, [accepted]);
  assert.equal(f.objects.size, 1);
  assert.equal(f.bucket.deletes.length, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images").get().n, 1);
  f.sqlite.close();
});

test("a creation ID cannot overwrite a different payload, changed photos, or an edited announcement", async () => {
  const f = fixtures();
  const listing = { ...valid, requestId: crypto.randomUUID() };
  const current = await create(f, listing, [photo()]);
  const changedPhoto = new Uint8Array(png);
  changedPhoto[changedPhoto.length - 1] ^= 1;
  for (const [content, photos] of [
    [{ ...listing, priceCents: 99900 }, [photo()]],
    [listing, [photo(changedPhoto)]],
  ]) {
    const response = await f.handlers.POST(request("POST", content, photos));
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Rechargez/);
  }
  assert.equal(f.bucket.puts, 1);
  const sold = await f.handlers.PUT(request("PUT", { ...current, status: "sold" }), current.id);
  assert.equal(sold.status, 200);
  assert.equal((await f.handlers.POST(request("POST", listing, [photo()]))).status, 409);
  const stored = f.sqlite.prepare("SELECT status, price_cents, version FROM phone_listings WHERE id = ?").get(current.id);
  assert.deepEqual({ ...stored }, { status: "sold", price_cents: valid.priceCents, version: 2 });
  assert.equal(f.objects.size, 1);
  f.sqlite.close();
});

test("creation IDs are required and validated before uploading or creating any announcement", async () => {
  const f = fixtures();
  for (const requestId of [undefined, null, "", "not-a-uuid", "'; DROP TABLE phone_listings; --"]) {
    assert.equal((await f.handlers.POST(request("POST", { ...valid, requestId }, [photo()]))).status, 400);
  }
  assert.equal(f.bucket.puts, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 0);
  f.sqlite.close();
});

test("simultaneous additions cannot exceed the photo limit or increment the same version twice", async () => {
  const f = fixtures();
  const current = await create(f);
  pauseCompetingUploads(f.bucket);
  const responses = await Promise.all([
    f.handlers.PUT(request("PUT", current, [photo(), photo(), photo()]), current.id),
    f.handlers.PUT(request("PUT", current, [photo(), photo(), photo()]), current.id),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const accepted = (await responses.find((response) => response.status === 200).json()).phone;
  assert.equal(accepted.version, 2);
  assert.equal(accepted.images.length, 3);
  assert.equal(f.sqlite.prepare("SELECT version FROM phone_listings WHERE id = ?").get(current.id).version, 2);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images WHERE phone_id = ?").get(current.id).n, 3);
  assert.equal(f.objects.size, 3);
  assert.equal(f.bucket.puts, 6);
  assert.equal(f.bucket.deletes.length, 3);
  f.sqlite.close();
});

test("a conflicting transaction cannot delete, reorder or insert the accepted transaction’s photos", async () => {
  const f = fixtures();
  const current = await create(f, {}, [photo(), photo()]);
  pauseCompetingUploads(f.bucket);
  const responses = await Promise.all([
    f.handlers.PUT(request("PUT", { ...current, images: [current.images[1]], model: "Accepted A" }, [photo()]), current.id),
    f.handlers.PUT(request("PUT", { ...current, images: [current.images[0]], model: "Accepted B" }, [photo()]), current.id),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const accepted = (await responses.find((response) => response.status === 200).json()).phone;
  const stored = (await (await f.handlers.ADMIN_GET(request())).json()).phones[0];
  assert.deepEqual(stored.images, accepted.images);
  assert.equal(stored.model, accepted.model);
  assert.equal(stored.version, 2);
  assert.equal(f.objects.size, 2);
  for (const path of accepted.images) {
    assert.equal((await f.handlers.IMAGE_GET(new Request(`https://atelier.example.test${path}`, { headers: OWNER }), path.split("/").pop())).status, 200);
  }
  f.sqlite.close();
});

test("deletion during an upload makes the pending update a conflict and removes only its own new objects", async () => {
  const f = fixtures();
  const current = await create(f, {}, [photo()]);
  let notifyUpload;
  const uploadStarted = new Promise((resolve) => { notifyUpload = resolve; });
  let releaseUpload;
  const uploadGate = new Promise((resolve) => { releaseUpload = resolve; });
  f.bucket.beforePut = async () => { notifyUpload(); await uploadGate; };
  const updating = f.handlers.PUT(request("PUT", current, [photo()]), current.id);
  await uploadStarted;
  assert.equal((await f.handlers.DELETE(request("DELETE"), current.id)).status, 200);
  releaseUpload();
  const updated = await updating;
  assert.equal(updated.status, 409);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images").get().n, 0);
  assert.equal(f.objects.size, 0);
  assert.equal(f.bucket.deletes.length, 2);
  f.sqlite.close();
});

test("deletion also cleans photos saved after its initial lookup and before its transaction", async () => {
  const f = fixtures();
  const current = await create(f, {}, [photo()]);
  let notifyDelete;
  const deleteReady = new Promise((resolve) => { notifyDelete = resolve; });
  let releaseDelete;
  const deleteGate = new Promise((resolve) => { releaseDelete = resolve; });
  const delayedDb = { ...f.db, async batch(statements) {
    if (statements.some((statement) => statement.sql.startsWith("DELETE FROM phone_listings"))) {
      notifyDelete();
      await deleteGate;
    }
    return f.db.batch(statements);
  } };
  const handlers = createCatalogHandlers({ ...f.env, DB: delayedDb });
  const deleting = handlers.DELETE(request("DELETE"), current.id);
  await deleteReady;
  const saved = await f.handlers.PUT(request("PUT", current, [photo()]), current.id);
  assert.equal(saved.status, 200);
  assert.equal(f.objects.size, 2);
  releaseDelete();
  assert.equal((await deleting).status, 200);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_listings").get().n, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images").get().n, 0);
  assert.equal(f.objects.size, 0);
  assert.equal(f.bucket.deletes.length, 2);
  f.sqlite.close();
});
