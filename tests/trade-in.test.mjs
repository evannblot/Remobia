import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/trade-in-server.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('from "./trade-in"', `from ${JSON.stringify(new URL("../app/lib/trade-in.ts", import.meta.url).href)}`)
  .replace('from "./catalog-server"', `from ${JSON.stringify(new URL("../app/lib/catalog-server.ts", import.meta.url).href)}`)
  .replace('from "./email-validation.mjs"', `from ${JSON.stringify(new URL("../app/lib/email-validation.mjs", import.meta.url).href)}`);
const { createTradeInHandlers, validateTradeInDetails, MAX_TRADE_IN_BODY_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const OWNER = { "oai-authenticated-user-id": "synthetic-owner-id", "oai-authenticated-user-email": "owner@example.test" };
const VISITOR = { ...OWNER, "oai-authenticated-user-email": "visitor@example.test" };
const ORIGIN = "https://remobia.example.test";
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64"));
function valid(values = {}) { return { requestId: crypto.randomUUID(), brand: "Samsung", model: "Galaxy S23", storage: "128 Go", color: "Noir",
  condition: "good", powersOn: "yes", unlocked: "unknown", battery: null, defects: [], description: "", repairs: "",
  accessories: ["box"], name: "Camille", email: "camille@example.test", phone: "", consent: true, website: "", ...values }; }
function photo(bytes = png, type = "image/png") { return new File([bytes], "test.png", { type }); }
function post(details = valid(), photos = [photo(), photo()], headers = {}) {
  const form = new FormData();
  form.set("details", JSON.stringify(details));
  if (photos[0] !== undefined) form.set("frontPhoto", photos[0]);
  if (photos[1] !== undefined) form.set("backPhoto", photos[1]);
  for (const extra of photos.slice(2)) form.append("additionalPhotos", extra);
  return new Request(`${ORIGIN}/api/trade-ins`, { method: "POST", headers: { origin: ORIGIN, ...headers }, body: form });
}
function ownerRequest(method = "GET", headers = OWNER) {
  return new Request(`${ORIGIN}/api/admin/trade-ins`, { method, headers: { origin: ORIGIN, ...headers } });
}
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
    async put(key, bytes, options) { this.puts++; await this.beforePut?.(key, this.puts); objects.set(key, { bytes: bytes.slice(), options }); },
    async delete(keys) {
      await this.beforeDelete?.();
      for (const key of typeof keys === "string" ? [keys] : keys) { this.deletes.push(key); objects.delete(key); }
    },
    async get(key) { const object = objects.get(key); return object ? { body: object.bytes, size: object.bytes.length } : null; },
  };
  const env = { DB: db, BUCKET: bucket, SITE_ADMIN_EMAIL: "owner@example.test" };
  return { db, bucket, objects, sqlite, env, handlers: createTradeInHandlers(env) };
}
async function create(f, details = valid(), photos) {
  const response = await f.handlers.POST(post(details, photos));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const saved = await response.json();
  assert.equal(saved.success, true);
  return saved;
}

test("details normalize text and reject invalid enums, identifiers, numbers, contacts and consent", () => {
  assert.equal(validateTradeInDetails(valid({ brand: " Samsung " })).brand, "Samsung");
  assert.deepEqual(validateTradeInDetails(valid({ accessories: ["charger", "box"] })).accessories, ["box", "charger"]);
  for (const invalid of [null, [], valid({ requestId: "../../secret" }), valid({ brand: "" }), valid({ brand: "x".repeat(81) }),
    valid({ model: "x".repeat(101) }), valid({ storage: "x".repeat(81) }), valid({ color: "x".repeat(81) }),
    valid({ name: "X" }), valid({ name: "Camille\nInjected" }), valid({ email: ".name@example.test" }),
    valid({ email: "name@example.test\r\nInjected" }), valid({ phone: "......." }), valid({ consent: "true" }),
    valid({ consent: false }), valid({ website: "https://bot.test" }), valid({ condition: "new" }), valid({ powersOn: true }),
    valid({ unlocked: "maybe" }), valid({ battery: undefined }), valid({ battery: -1 }), valid({ battery: 101 }), valid({ battery: 99.5 }),
    valid({ defects: "battery" }), valid({ defects: ["invented"] }), valid({ defects: ["battery", "battery"] }),
    valid({ defects: ["battery"], description: " " }), valid({ accessories: ["invented"] }),
    valid({ description: "x".repeat(3001) }), valid({ repairs: "x".repeat(1501) }), valid({ description: "a\u0000b" }),
  ]) assert.throws(() => validateTradeInDetails(invalid));
  assert.equal(validateTradeInDetails(valid({ defects: ["battery"], description: "X" })).description, "X");
  assert.equal(validateTradeInDetails(valid({ phone: "+33 6 12 34 56 78", battery: 100 })).battery, 100);
});

test("availability requires both bindings and migrated tables; missing services never accept a request", async () => {
  for (const env of [{}, { DB: {} }, { BUCKET: {} }, { DB: { prepare() { throw new Error("Unmigrated"); } }, BUCKET: {} }]) {
    const handlers = createTradeInHandlers(env);
    assert.deepEqual(await (await handlers.GET()).json(), { available: false });
    assert.equal((await handlers.POST(post())).status, 503);
  }
  const f = fixtures();
  assert.deepEqual(await (await f.handlers.GET()).json(), { available: true });
  f.sqlite.close();
});

test("strict origin rejects absent, foreign, null and cross-site origins before uploading", async () => {
  const f = fixtures();
  for (const headers of [{ origin: "https://other.test" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }]) {
    assert.equal((await f.handlers.POST(post(valid(), undefined, headers))).status, 403);
  }
  const missing = post(); missing.headers.delete("origin");
  assert.equal((await f.handlers.POST(missing)).status, 403);
  assert.equal(f.bucket.puts, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_requests").get().n, 0);
  f.sqlite.close();
});

test("front and back photos are required, extra photos are limited, and image bytes match their MIME", async () => {
  const f = fixtures();
  for (const [photos, status] of [
    [[], 400], [[photo()], 400], [["url", photo()], 400], [[photo(), photo(), photo(), photo(), photo()], 400],
    [[photo(new Uint8Array(0)), photo()], 400], [[photo(png, "image/jpeg"), photo()], 400],
    [[photo(new TextEncoder().encode("<svg/>")), photo()], 400], [[photo(new Uint8Array(3 * 1024 * 1024 + 1)), photo()], 413],
  ]) assert.equal((await f.handlers.POST(post(valid(), photos))).status, status);
  const unknown = post();
  const form = await unknown.formData(); form.set("evil", "value");
  assert.equal((await f.handlers.POST(new Request(unknown.url, { method: "POST", headers: { origin: ORIGIN }, body: form }))).status, 400);
  const duplicate = post();
  const duplicateForm = await duplicate.formData(); duplicateForm.append("frontPhoto", photo());
  assert.equal((await f.handlers.POST(new Request(duplicate.url, { method: "POST", headers: { origin: ORIGIN }, body: duplicateForm }))).status, 400);
  assert.equal(f.bucket.puts, 0);
  f.sqlite.close();
});

test("multipart content and declared or streamed body limits are enforced before storage", async () => {
  const f = fixtures();
  const declared = post(); declared.headers.set("content-length", String(MAX_TRADE_IN_BODY_BYTES + 1));
  assert.equal((await f.handlers.POST(declared)).status, 413);
  const badLength = post(); badLength.headers.set("content-length", "invalid");
  assert.equal((await f.handlers.POST(badLength)).status, 413);
  assert.equal((await f.handlers.POST(new Request(`${ORIGIN}/api/trade-ins`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" }))).status, 415);
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_TRADE_IN_BODY_BYTES + 1)); }, cancel() { cancelled = true; } });
  const streamed = new Request(`${ORIGIN}/api/trade-ins`, { method: "POST", headers: { origin: ORIGIN, "content-type": "multipart/form-data; boundary=x" }, body, duplex: "half" });
  assert.equal((await f.handlers.POST(streamed)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(f.bucket.puts, 0);
  f.sqlite.close();
});

test("a valid request durably saves details and four private image references visible only to owner", async () => {
  const f = fixtures();
  const detail = valid({ defects: ["battery"], description: "Autonomie faible" });
  const saved = await create(f, detail, [photo(), photo(), photo(), photo()]);
  assert.match(saved.reference, /^R-[A-F0-9]{12}$/);
  const response = await f.handlers.ADMIN_GET(ownerRequest());
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  const request = (await response.json()).requests[0];
  assert.equal(request.name, detail.name);
  assert.equal(request.description, detail.description);
  assert.equal(request.id, saved.id);
  assert.deepEqual(request.images.map((image) => image.side), ["front", "back", "additional1", "additional2"]);
  assert.equal(Object.hasOwn(request, "consent"), false);
  assert.equal(Object.hasOwn(request, "requestId"), false);
  assert.equal(Object.hasOwn(request, "fingerprint"), false);
  for (const image of request.images) assert.match(image.url, new RegExp(`^/api/admin/trade-in-images/${saved.id}/${image.side}$`));
  assert.equal(f.objects.size, 4);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM phone_images").get().n, 0);
  f.sqlite.close();
});

test("admin data and photo endpoints deny anonymous, service-only and non-owner identities", async () => {
  const f = fixtures();
  const saved = await create(f);
  for (const [headers, status] of [[{}, 401], [{ "OAI-Sites-Authorization": "Bearer synthetic" }, 401], [VISITOR, 403]]) {
    for (const response of [await f.handlers.ADMIN_GET(ownerRequest("GET", headers)),
      await f.handlers.IMAGE_GET(ownerRequest("GET", headers), saved.id, "front"),
      await f.handlers.DELETE(ownerRequest("DELETE", headers), saved.id)]) {
      assert.equal(response.status, status);
      assert.match(response.headers.get("cache-control"), /private.*no-store/);
    }
  }
  const image = await f.handlers.IMAGE_GET(ownerRequest(), saved.id, "front");
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.match(image.headers.get("cache-control"), /private.*no-store/);
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
  assert.equal((await f.handlers.IMAGE_GET(ownerRequest(), saved.id, "../../secret")).status, 404);
  assert.equal((await f.handlers.IMAGE_GET(ownerRequest(), "../secret", "front")).status, 404);
  assert.equal(f.objects.size, 2);
  f.sqlite.close();
});

test("identical retries reuse their reference without uploads; different details or photos conflict", async () => {
  const f = fixtures();
  const details = valid();
  const first = await create(f, details);
  const retry = await create(f, details);
  assert.deepEqual(retry, first);
  assert.equal(f.bucket.puts, 2);
  assert.equal((await f.handlers.POST(post({ ...details, model: "Galaxy S24" }))).status, 409);
  const changedBytes = new Uint8Array([...png, 1]);
  assert.equal((await f.handlers.POST(post(details, [photo(changedBytes), photo()]))).status, 409);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_requests").get().n, 1);
  f.sqlite.close();
});

test("simultaneous identical retries commit one record and clean the losing attempt's photos", async () => {
  const f = fixtures();
  let release; const gate = new Promise((resolve) => { release = resolve; });
  f.bucket.beforePut = async (_key, count) => { if (count <= 2) { if (count === 2) release(); await gate; } };
  const details = valid();
  const responses = await Promise.all([f.handlers.POST(post(details)), f.handlers.POST(post(details))]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  const results = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(results[0], results[1]);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_requests").get().n, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_images").get().n, 2);
  assert.equal(f.objects.size, 2);
  assert.equal(f.bucket.deletes.length, 2);
  f.sqlite.close();
});

test("R2 upload and database transaction failures return no success and clean new objects", async () => {
  const f = fixtures();
  f.bucket.beforePut = async (_key, count) => { if (count === 2) throw new Error("Synthetic upload failure"); };
  const uploadFailure = await f.handlers.POST(post());
  assert.equal(uploadFailure.status, 503);
  assert.equal(f.objects.size, 0);
  f.bucket.beforePut = undefined;
  const handlers = createTradeInHandlers({ ...f.env, DB: { ...f.db, async batch() { throw new Error("Synthetic DB failure"); } } });
  const dbFailure = await handlers.POST(post());
  assert.equal(dbFailure.status, 503);
  assert.equal(f.objects.size, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_requests").get().n, 0);
  assert.ok(!(await dbFailure.text()).includes("Synthetic"));
  f.sqlite.close();
});

test("an acknowledgement timeout after commit recovers receipt and preserves saved photos", async () => {
  const f = fixtures();
  const handlers = createTradeInHandlers({ ...f.env, DB: { ...f.db, async batch(statements) { await f.db.batch(statements); throw new Error("Synthetic response timeout"); } } });
  const details = valid();
  const response = await handlers.POST(post(details));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(f.objects.size, 2);
  const retry = await create(f, details);
  assert.equal(f.bucket.puts, 2);
  assert.match(retry.reference, /^R-/);
  f.sqlite.close();
});

test("deletion requires owner and matching origin, erases details and photos, and cannot resurrect on retry", async () => {
  const f = fixtures();
  const details = valid();
  const saved = await create(f, details);
  const foreign = ownerRequest("DELETE"); foreign.headers.set("origin", "https://other.test");
  assert.equal((await f.handlers.DELETE(foreign, saved.id)).status, 403);
  const absent = ownerRequest("DELETE"); absent.headers.delete("origin");
  assert.equal((await f.handlers.DELETE(absent, saved.id)).status, 403);
  assert.equal(f.objects.size, 2);
  assert.equal((await f.handlers.DELETE(ownerRequest("DELETE"), saved.id)).status, 200);
  assert.equal((await f.handlers.DELETE(ownerRequest("DELETE"), saved.id)).status, 200);
  assert.equal(f.objects.size, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_images").get().n, 0);
  assert.deepEqual({ ...f.sqlite.prepare("SELECT state, details, fingerprint FROM trade_in_requests WHERE id = ?").get(saved.id) }, { state: "deleted", details: "{}", fingerprint: "" });
  assert.deepEqual((await (await f.handlers.ADMIN_GET(ownerRequest())).json()).requests, []);
  assert.equal((await f.handlers.IMAGE_GET(ownerRequest(), saved.id, "front")).status, 404);
  assert.equal((await f.handlers.POST(post(details))).status, 410);
  assert.equal(f.objects.size, 0);
  f.sqlite.close();
});

test("a failed photo deletion hides all data and retains cleanup metadata for a successful retry", async () => {
  const f = fixtures();
  const saved = await create(f);
  f.bucket.beforeDelete = async () => { throw new Error("Synthetic bucket deletion failure"); };
  assert.equal((await f.handlers.DELETE(ownerRequest("DELETE"), saved.id)).status, 503);
  assert.deepEqual((await (await f.handlers.ADMIN_GET(ownerRequest())).json()).requests, []);
  assert.equal((await f.handlers.IMAGE_GET(ownerRequest(), saved.id, "front")).status, 404);
  assert.equal(f.sqlite.prepare("SELECT details FROM trade_in_requests WHERE id = ?").get(saved.id).details, "{}");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_images").get().n, 2);
  f.bucket.beforeDelete = undefined;
  assert.equal((await f.handlers.DELETE(ownerRequest("DELETE"), saved.id)).status, 200);
  assert.equal(f.objects.size, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_images").get().n, 0);
  f.sqlite.close();
});

test("deletion while a concurrent retry is uploading cannot recreate records or leave its photos", async () => {
  const f = fixtures();
  let notify; const uploading = new Promise((resolve) => { notify = resolve; });
  let release; const gate = new Promise((resolve) => { release = resolve; });
  f.bucket.beforePut = async (_key, count) => { if (count === 1) { notify(); await gate; } };
  const details = valid();
  const pending = f.handlers.POST(post(details));
  await uploading;
  const winner = await create(f, details);
  assert.equal((await f.handlers.DELETE(ownerRequest("DELETE"), winner.id)).status, 200);
  release();
  const response = await pending;
  assert.equal(response.status, 410);
  assert.equal(f.objects.size, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_images").get().n, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trade_in_requests WHERE state = 'active'").get().n, 0);
  f.sqlite.close();
});
