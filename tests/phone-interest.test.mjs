import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Compile this isolated module, preserving injected I/O and without a worker runtime.
const source = await readFile(new URL("../app/lib/phone-interest.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('from "./quotes"', `from ${JSON.stringify(new URL("../app/lib/quotes.ts", import.meta.url).href)}`)
  .replace('from "./email-validation.mjs"', `from ${JSON.stringify(new URL("../app/lib/email-validation.mjs", import.meta.url).href)}`);
const { createInterestHandlers, validatePhoneInterest, MAX_INTEREST_BODY_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const environment = { QUOTE_TO_EMAIL: "owner@example.test", QUOTE_FROM_EMAIL: "sales@example.test", RESEND_API_KEY: "re_" + "x".repeat(31) };
const listing = {
  id: "5bbd3fe0-09dc-42c1-9061-c9e910693852", brand: "Samsung", model: "Galaxy S22", storage: "128 Go", color: "Noir",
  condition: "good", priceCents: 23900, battery: null, description: "Téléphone de test", status: "published", images: [],
  createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z",
};
const interest = { requestId: "e77ddf35-198e-4f70-a40e-07488f14f960", phoneId: listing.id,
  name: "Camille", email: "camille@example.test", phone: "", message: "Est-il disponible ?", consent: true, website: "" };
function request(payload = interest, headers = {}) {
  return new Request("https://atelier.example.test/api/phone-interest", { method: "POST", headers: {
    "content-type": "application/json", origin: "https://atelier.example.test", ...headers,
  }, body: JSON.stringify(payload) });
}
const readPhone = async (id) => id === listing.id ? listing : null;

test("invalid contact fields and honeypot are rejected", () => {
  for (const invalid of [null, [], { ...interest, requestId: undefined }, { ...interest, requestId: "invalid" },
    { ...interest, phoneId: "../../private" }, { ...interest, name: "X" },
    { ...interest, name: "Camille\nBcc: other" }, { ...interest, email: ".camille@example.test" },
    { ...interest, email: "email@invalid" }, { ...interest, email: "camille@example.test\r\nInjected" },
    { ...interest, phone: "......" }, { ...interest, message: "x".repeat(3001) },
    { ...interest, consent: false }, { ...interest, website: "https://bot.test" }]) {
    assert.equal(validatePhoneInterest(invalid).valid, false);
  }
  assert.equal(validatePhoneInterest({ ...interest, phone: "+33 6 12 34 56 78", message: "" }).valid, true);
});

test("unconfigured mail is explicitly unavailable and never reads or sends", async () => {
  let calls = 0;
  const handlers = createInterestHandlers({}, { readPhone: async () => { calls++; return listing; }, fetcher: async () => { calls++; throw new Error("Never"); } });
  assert.deepEqual(await handlers.GET().json(), { available: false });
  const response = await handlers.POST(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, undefined);
  assert.equal(calls, 0);
});

test("unpublished or absent announcements cannot send", async () => {
  let calls = 0;
  for (const phone of [null, { ...listing, status: "sold" }, { ...listing, status: "draft" }]) {
    const response = await createInterestHandlers(environment, { readPhone: async () => phone,
      fetcher: async () => { calls++; return Response.json({ id: "test" }); } }).POST(request());
    assert.equal(response.status, 409);
  }
  assert.equal(calls, 0);
});

test("canonical listing data is reread; client price/title never enters the email", async () => {
  const calls = [];
  const response = await createInterestHandlers(environment, { readPhone, now: () => new Date("2026-10-05T22:30:00Z"),
    fetcher: async (url, options) => { calls.push({ url, options }); return Response.json({ id: "provider-id" }); },
  }).POST(request({ ...interest, priceCents: 100, model: "Fake phone", brand: "Fake brand" }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.match(result.reference, /^AMV-E77DDF35-[0-9A-F]{12}$/);
  assert.equal(calls.length, 1);
  const email = JSON.parse(calls[0].options.body);
  assert.deepEqual(email.to, [environment.QUOTE_TO_EMAIL]);
  assert.equal(email.reply_to, interest.email);
  assert.match(email.text, /Samsung Galaxy S22/);
  assert.match(email.text, /239,00/);
  assert.ok(!email.text.includes("Fake phone"));
  assert.equal(email.html, undefined);
  assert.match(calls[0].options.headers["Idempotency-Key"], /^phone-interest-[0-9a-f]{64}$/);
});

test("an accepted email whose response times out is deduplicated when the client retries", async () => {
  const acceptedMessages = new Map();
  const calls = [];
  let attempt = 0;
  const fetcher = async (_url, options) => {
    const key = options.headers["Idempotency-Key"];
    calls.push({ key, body: options.body });
    const existing = acceptedMessages.get(key);
    if (existing) {
      assert.equal(options.body, existing.body, "A reused provider key must have the same complete email");
      return Response.json({ id: existing.id });
    }
    acceptedMessages.set(key, { body: options.body, id: "accepted-synthetic-message" });
    attempt++;
    if (attempt === 1) {
      // The provider accepts, but its reply never reaches the caller before timeout.
      return new Promise((_resolve, reject) => options.signal.addEventListener("abort",
        () => reject(new Error("Synthetic lost response")), { once: true }));
    }
    return Response.json({ id: "accepted-synthetic-message" });
  };
  const first = await createInterestHandlers(environment, { readPhone, fetcher, timeoutMs: 5 }).POST(request());
  assert.equal(first.status, 502);
  assert.equal((await first.json()).success, undefined);
  // A fresh server instance models a later request landing on another Vercel worker.
  const retried = await createInterestHandlers(environment, { readPhone, fetcher }).POST(request());
  const retriedData = await retried.json();
  assert.equal(retried.status, 200);
  assert.equal(retriedData.success, true);
  assert.equal(acceptedMessages.size, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  const confirmedAgain = await createInterestHandlers(environment, { readPhone, fetcher }).POST(request());
  assert.equal((await confirmedAgain.json()).reference, retriedData.reference);
  assert.equal(acceptedMessages.size, 1);
});

test("equivalent normalized input is stable; changed contact, listing or delivery content never reuses a key", async () => {
  const calls = [];
  const fetcher = async (_url, options) => { calls.push({ key: options.headers["Idempotency-Key"], body: options.body }); return Response.json({ id: "synthetic" }); };
  const send = async (payload, phone = listing, config = environment) => {
    const response = await createInterestHandlers(config, { readPhone: async () => phone, fetcher }).POST(request(payload));
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await send(interest);
  const normalized = await send({ ...interest, requestId: interest.requestId.toUpperCase(), name: " Camille ", message: " Est-il disponible ? " },
    { ...listing, updatedAt: "2027-01-01T00:00:00Z", version: 2, images: ["/unrelated-photo"] });
  assert.equal(first.reference, normalized.reference);
  assert.deepEqual(calls[0], calls[1]);
  for (const [payload, phone, config] of [
    [{ ...interest, requestId: "1da9c15f-33e9-4d05-b63d-10d2625d4abc" }, listing, environment],
    [{ ...interest, message: "Puis-je le voir demain ?" }, listing, environment],
    [{ ...interest, email: "other@example.test" }, listing, environment],
    [interest, { ...listing, priceCents: 24900 }, environment],
    [interest, { ...listing, model: "Galaxy S23" }, environment],
    [interest, listing, { ...environment, QUOTE_TO_EMAIL: "new-owner@example.test" }],
    [interest, listing, { ...environment, QUOTE_FROM_EMAIL: "new-sales@example.test" }],
  ]) {
    const changed = await send(payload, phone, config);
    assert.notEqual(changed.reference, first.reference);
    assert.notEqual(calls.at(-1).key, calls[0].key);
  }
  assert.equal(new Set(calls.slice(1).map(call => call.key)).size, calls.length - 1);
});

test("cross origin, oversized or malformed requests cannot send", async () => {
  let calls = 0;
  const handlers = createInterestHandlers(environment, { readPhone, fetcher: async () => { calls++; throw new Error("Never"); } });
  assert.equal((await handlers.POST(request(interest, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handlers.POST(request(interest, { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await handlers.POST(request(interest, { "content-length": String(MAX_INTEREST_BODY_BYTES + 1) }))).status, 413);
  assert.equal((await handlers.POST(request({ ...interest, message: "é".repeat(MAX_INTEREST_BODY_BYTES) }))).status, 413);
  assert.equal((await handlers.POST(request(interest, { "content-type": "application/jsonp" }))).status, 415);
  assert.equal((await handlers.POST(new Request("https://atelier.example.test/api/phone-interest", { method: "POST", headers: { "content-type": "application/json" }, body: "{invalid}" }))).status, 400);
  assert.equal(calls, 0);
});

test("provider rejection, missing confirmation and timeout never report success", async () => {
  for (const fetcher of [async () => Response.json({ diagnostic: "private" }, { status: 401 }), async () => Response.json({}),
    async () => Response.json({ id: "" }), async () => { throw new Error("private"); }]) {
    const response = await createInterestHandlers(environment, { readPhone, fetcher }).POST(request());
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.equal(result.success, undefined);
    assert.ok(!JSON.stringify(result).includes("private"));
  }
  let aborted = false;
  const response = await createInterestHandlers(environment, { readPhone, timeoutMs: 5,
    fetcher: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => { aborted = true; reject(new Error("timeout")); }, { once: true });
    }),
  }).POST(request());
  assert.equal(response.status, 502);
  assert.equal(aborted, true);
});
