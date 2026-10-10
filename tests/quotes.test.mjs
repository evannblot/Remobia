import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QUOTE_BODY_BYTES,
  createQuoteReference,
  createQuotesHandlers,
  getEmailConfig,
  validateQuoteInput,
} from "../app/lib/quotes.ts";

// These are synthetic values. Every e-mail call below uses an injected stub.
const environment = {
  QUOTE_TO_EMAIL: "repairer@example.test",
  QUOTE_FROM_EMAIL: "quotes@example.test",
  RESEND_API_KEY: "re_" + "x".repeat(31),
};
const validQuote = {
  brand: "Apple", model: "iPhone 13", modelUnknown: false,
  issues: ["screen", "charging"], description: "La vitre est cassée et la charge s’interrompt.",
  quality: "advice", handoff: "discuss", name: "Client de test",
  email: "client@example.test", phone: "+33 6 12 34 56 78", consent: true, website: "",
};

function quoteRequest(payload = validQuote, headers = {}) {
  return new Request("https://atelier.example.test/api/quotes", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://atelier.example.test", ...headers },
    body: JSON.stringify(payload),
  });
}

test("availability requires all three syntactically valid server bindings", async () => {
  for (const config of [
    {}, { ...environment, RESEND_API_KEY: undefined },
    { ...environment, QUOTE_FROM_EMAIL: "bad" },
    { ...environment, QUOTE_TO_EMAIL: "good@example.test\r\nBcc: victim@example.test" },
    { ...environment, RESEND_API_KEY: "placeholder" },
  ]) {
    assert.equal(getEmailConfig(config), null);
    assert.deepEqual(await createQuotesHandlers(config).GET().json(), { available: false });
  }
  const response = createQuotesHandlers(environment).GET();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { available: true });
});

test("unknown model is supported, duplicate issues are normalized, text is trimmed", () => {
  const result = validateQuoteInput({ ...validQuote, modelUnknown: true, model: "",
    name: "  Client de test  ", issues: ["screen", "screen"] });
  assert.equal(result.valid, true);
  assert.equal(result.quote.model, "");
  assert.equal(result.quote.name, "Client de test");
  assert.deepEqual(result.quote.issues, ["screen"]);
});

test("rejects invalid, missing, overlong and injected field values", () => {
  const invalid = [
    null, [], "data", { ...validQuote, brand: "" }, { ...validQuote, brand: "x".repeat(81) },
    { ...validQuote, model: "" }, { ...validQuote, modelUnknown: "true" },
    { ...validQuote, issues: [] }, { ...validQuote, issues: ["__proto__"] },
    { ...validQuote, issues: ["screen", 123] }, { ...validQuote, quality: "__proto__" },
    { ...validQuote, handoff: "courier" }, { ...validQuote, issues: ["other"], description: "" },
    { ...validQuote, description: "x".repeat(3001) }, { ...validQuote, name: "X" },
    { ...validQuote, name: "Client\nBcc: someone" },
    { ...validQuote, email: "client@example.test\r\nBcc: someone@example.test" },
    { ...validQuote, email: "invalid" }, { ...validQuote, email: ".client@example.test" },
    { ...validQuote, phone: "......" }, { ...validQuote, phone: "1234567890123456" },
    { ...validQuote, consent: false }, { ...validQuote, consent: "true" },
    { ...validQuote, website: "https://spam.example.test" }, { ...validQuote, website: 123 },
  ];
  for (const payload of invalid) assert.equal(validateQuoteInput(payload).valid, false, JSON.stringify(payload));
});

test("description is required for known and other problems after trimming", () => {
  for (const issues of [["screen"], ["other"]]) {
    for (const description of [undefined, "", " \n\t "]) {
      const result = validateQuoteInput({ ...validQuote, issues, description });
      assert.deepEqual(result, {
        valid: false,
        error: "Décrivez le problème en 3 000 caractères maximum.",
      });
    }
    const result = validateQuoteInput({ ...validQuote, issues, description: "  Le problème est intermittent. \n" });
    assert.equal(result.valid, true);
    assert.equal(result.quote.description, "Le problème est intermittent.");
  }
});

test("requests without a description return 400 and never reach the email provider", async () => {
  let calls = 0;
  const handlers = createQuotesHandlers(environment, {
    fetcher: async () => { calls++; throw new Error("must not send"); },
  });
  for (const issues of [["screen"], ["other"]]) {
    for (const description of ["", " \n\t "]) {
      const response = await handlers.POST(quoteRequest({ ...validQuote, issues, description }));
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "Décrivez le problème en 3 000 caractères maximum." });
    }
  }
  assert.equal(calls, 0);
});

test("missing configuration returns 503 and cannot call a provider", async () => {
  let calls = 0;
  const handlers = createQuotesHandlers({}, { fetcher: async () => { calls++; throw new Error("must not send"); } });
  const response = await handlers.POST(quoteRequest());
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
  assert.equal((await response.json()).success, undefined);
});

test("cross-origin, fetch metadata and honeypot requests never send", async () => {
  let calls = 0;
  const handlers = createQuotesHandlers(environment, { fetcher: async () => { calls++; throw new Error("must not send"); } });
  assert.equal((await handlers.POST(quoteRequest(validQuote, { origin: "https://other.example.test" }))).status, 403);
  assert.equal((await handlers.POST(quoteRequest(validQuote, { origin: "null" }))).status, 403);
  assert.equal((await handlers.POST(quoteRequest(validQuote, { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await handlers.POST(quoteRequest({ ...validQuote, website: "spam" }))).status, 400);
  assert.equal(calls, 0);
});

test("body limits enforce actual bytes even without Content-Length", async () => {
  const handlers = createQuotesHandlers(environment, { fetcher: async () => { throw new Error("must not send"); } });
  const overlong = await handlers.POST(quoteRequest(validQuote, { "content-length": String(MAX_QUOTE_BODY_BYTES + 1) }));
  assert.equal(overlong.status, 413);
  const oversized = new Request("https://atelier.example.test/api/quotes", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validQuote, description: "é".repeat(MAX_QUOTE_BODY_BYTES) }),
  });
  assert.equal((await handlers.POST(oversized)).status, 413);
});

test("malformed JSON, unsupported media type and empty bodies are rejected", async () => {
  const handlers = createQuotesHandlers(environment);
  assert.equal((await handlers.POST(new Request("https://atelier.example.test/api/quotes", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{invalid}",
  }))).status, 400);
  assert.equal((await handlers.POST(quoteRequest(validQuote, { "content-type": "application/jsonp" }))).status, 415);
  assert.equal((await handlers.POST(new Request("https://atelier.example.test/api/quotes", {
    method: "POST", headers: { "content-type": "application/json" },
  }))).status, 400);
});

test("provider acceptance sends one plain-text notification with customer reply-to", async () => {
  const calls = [];
  const handlers = createQuotesHandlers(environment, {
    now: () => new Date("2026-10-05T22:30:00Z"),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ id: "provider-message-id" });
    },
  });
  const response = await handlers.POST(quoteRequest({ ...validQuote, description: "<script>provided text</script>" }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.match(result.reference, /^AM-20261006-[0-9a-f]{8}$/); // Paris is already on the next day.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  const message = JSON.parse(calls[0].options.body);
  assert.deepEqual(message.to, [environment.QUOTE_TO_EMAIL]);
  assert.equal(message.from, environment.QUOTE_FROM_EMAIL);
  assert.equal(message.reply_to, validQuote.email);
  assert.equal(message.html, undefined);
  assert.match(message.text, /Charge \/ connecteur/);
  assert.ok(message.text.includes("<script>provided text</script>"));
  assert.equal(message.cc, undefined);
  assert.equal(message.bcc, undefined);
  assert.equal(calls[0].options.headers["Idempotency-Key"], result.reference);
});

test("provider failure or missing acceptance never returns success or provider diagnostics", async () => {
  for (const fetcher of [
    async () => Response.json({ message: "secret provider diagnostic" }, { status: 401 }),
    async () => Response.json({}),
    async () => Response.json({ id: "" }),
    async () => new Response("not JSON"),
    async () => { throw new Error("secret network diagnostic"); },
  ]) {
    const response = await createQuotesHandlers(environment, { fetcher }).POST(quoteRequest());
    const result = await response.json();
    assert.equal(response.status, 502);
    assert.equal(result.success, undefined);
    assert.equal(result.reference, undefined);
    assert.ok(!JSON.stringify(result).includes("secret"));
  }
});

test("send timeout aborts the provider request and returns 502", async () => {
  let aborted = false;
  const response = await createQuotesHandlers(environment, {
    timeoutMs: 5,
    fetcher: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => { aborted = true; reject(new Error("timeout")); }, { once: true });
    }),
  }).POST(quoteRequest());
  assert.equal(aborted, true);
  assert.equal(response.status, 502);
});

test("quote references use Paris dates and do not depend on a sequential counter", () => {
  const references = new Set(Array.from({ length: 20 }, () => createQuoteReference(new Date("2026-10-05T00:00:00Z"))));
  assert.equal(references.size, 20);
  for (const reference of references) assert.match(reference, /^AM-20261005-[0-9a-f]{8}$/);
});
