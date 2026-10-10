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
const interest = { phoneId: listing.id, name: "Camille", email: "camille@example.test", phone: "", message: "Est-il disponible ?", consent: true, website: "" };
function request(payload = interest, headers = {}) {
  return new Request("https://atelier.example.test/api/phone-interest", { method: "POST", headers: {
    "content-type": "application/json", origin: "https://atelier.example.test", ...headers,
  }, body: JSON.stringify(payload) });
}
const readPhone = async (id) => id === listing.id ? listing : null;

test("invalid contact fields and honeypot are rejected", () => {
  for (const invalid of [null, [], { ...interest, phoneId: "../../private" }, { ...interest, name: "X" },
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
  assert.match(result.reference, /^AMV-20261006-[0-9a-f]{8}$/);
  assert.equal(calls.length, 1);
  const email = JSON.parse(calls[0].options.body);
  assert.deepEqual(email.to, [environment.QUOTE_TO_EMAIL]);
  assert.equal(email.reply_to, interest.email);
  assert.match(email.text, /Samsung Galaxy S22/);
  assert.match(email.text, /239,00/);
  assert.ok(!email.text.includes("Fake phone"));
  assert.equal(email.html, undefined);
  assert.equal(calls[0].options.headers["Idempotency-Key"], result.reference);
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
