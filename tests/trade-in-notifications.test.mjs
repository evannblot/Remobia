import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpileModule(readFileSync(new URL("../app/lib/trade-in-notifications.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('from "./quotes"', `from ${JSON.stringify(new URL("../app/lib/quotes.ts", import.meta.url).href)}`)
  .replace('from "./trade-in"', `from ${JSON.stringify(new URL("../app/lib/trade-in.ts", import.meta.url).href)}`);
const { notifyTradeIn } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const details = { brand: "Example", model: "Test", storage: "128 Go", color: "Noir", condition: "good", powersOn: "yes", unlocked: "unknown", battery: 85,
  defects: ["battery"], description: "Description de test", repairs: "Aucune", accessories: ["cable"], name: "Client fictif", email: "customer@example.test", phone: "" };
function fixture(pending = true) {
  const updates = [];
  const bindings = { QUOTE_TO_EMAIL: "owner@example.test", QUOTE_FROM_EMAIL: "sender@example.test", RESEND_API_KEY: "re_" + "x".repeat(32), TRADE_IN_NOTIFICATIONS_ENABLED: true,
    DB: { prepare(sql) { return { bind(...values) { return {
      async first() { return pending ? { id: "outbox-id", reference: "R-SYNTHETIC", details: JSON.stringify(details), created_at: "2026-10-10T12:00:00Z" } : null; },
      async run() { updates.push({ sql, values }); return { success: true }; },
    }; } }; } } };
  return { bindings, updates };
}

test("accepted notifications reply to the customer, link to private photos and mark only provider acceptance", async () => {
  const { bindings, updates } = fixture(); const calls = [];
  assert.equal(await notifyTradeIn(bindings, "request-id", { fetcher: async (url, options) => { calls.push({ url, options }); return Response.json({ id: "synthetic-email-id" }); } }), true);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.reply_to, details.email);
  assert.deepEqual(body.to, [bindings.QUOTE_TO_EMAIL]);
  assert.ok(body.text.includes("/gestion/reprises"));
  assert.ok(body.text.includes("85 %"));
  assert.equal(body.attachments, undefined);
  assert.equal(updates.filter(value => value.sql.includes("sent_at = ?")).length, 1);
});

test("transient failure retries one logical message, permanent failure leaves the durable notification pending", async () => {
  const { bindings, updates } = fixture(); const calls = [];
  const sent = await notifyTradeIn(bindings, "request-id", { fetcher: async (_url, options) => { calls.push(options); return calls.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ id: "accepted" }); } });
  assert.equal(sent, true); assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  const permanent = fixture(); let attempts = 0;
  assert.equal(await notifyTradeIn(permanent.bindings, "request-id", { fetcher: async () => { attempts++; return Response.json({}, { status: 403 }); } }), false);
  assert.equal(attempts, 1);
  assert.equal(permanent.updates.some(value => value.sql.includes("sent_at = ?")), false);
  assert.equal(updates.length, 3);
});

test("absent, disabled or deleted notifications never reach the provider", async () => {
  let calls = 0; const fetcher = async () => { calls++; throw new Error("Must not send"); };
  const none = fixture(false);
  assert.equal(await notifyTradeIn(none.bindings, "id", { fetcher }), true);
  assert.equal(await notifyTradeIn({ ...none.bindings, EMAIL_DELIVERY_ENABLED: false }, "id", { fetcher }), false);
  assert.equal(await notifyTradeIn({}, "id", { fetcher }), false);
  assert.equal(calls, 0);
});
