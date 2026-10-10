import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { isValidEmail } from "../app/lib/email-validation.mjs";

const source = await readFile(new URL("../app/lib/client-requests.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { fetchClientJson } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

async function withFetch(fetcher, check) {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { await check(); }
  finally { globalThis.fetch = original; }
}

test("a successful JSON request retains HTTP status and request options", async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, "/api/test");
    assert.equal(init.method, "PUT");
    assert.equal(init.signal.aborted, false);
    return Response.json({ error: "Annonce modifiée" }, { status: 409 });
  }, async () => {
    const result = await fetchClientJson("/api/test", { method: "PUT" }, { timeoutMs: 100 });
    assert.equal(result.response.status, 409);
    assert.deepEqual(result.data, { error: "Annonce modifiée" });
  });
});

test("a pending connection is bounded, aborted, and never reported as successful", async () => {
  let signal;
  await withFetch(async (_url, init) => {
    signal = init.signal;
    return await new Promise(() => {});
  }, async () => {
    await assert.rejects(fetchClientJson("/api/test", {}, {
      timeoutMs: 15, timeoutMessage: "Enregistrement non confirmé ; saisies conservées.",
    }), /Enregistrement non confirmé/);
    assert.equal(signal.aborted, true);
  });
});

test("the deadline also covers a stalled JSON body after HTTP headers arrive", async () => {
  let signal;
  await withFetch(async (_url, init) => {
    signal = init.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) };
  }, async () => {
    await assert.rejects(fetchClientJson("/api/test", {}, {
      timeoutMs: 15, timeoutMessage: "Le corps de la réponse est resté bloqué.",
    }), /corps de la réponse/);
    assert.equal(signal.aborted, true);
  });
});

test("canceling an obsolete load aborts it without converting it into a timeout", async () => {
  const controller = new AbortController();
  let signal;
  await withFetch(async (_url, init) => {
    signal = init.signal;
    return await new Promise(() => {});
  }, async () => {
    const pending = fetchClientJson("/api/test", { signal: controller.signal }, { timeoutMs: 200 });
    controller.abort();
    await assert.rejects(pending, (error) => error.name === "AbortError");
    assert.equal(signal.aborted, true);
  });
});

test("an invalid JSON response produces a readable error and no false success", async () => {
  await withFetch(async () => new Response("<html>Temporary outage</html>"), async () => {
    await assert.rejects(fetchClientJson("/api/test", {}, { timeoutMs: 100 }), /réponse du serveur n’a pas pu être lue/);
  });
});

test("a lost connection uses the supplied message, and a subsequent retry can succeed", async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    if (calls === 1) throw new TypeError("Failed to fetch");
    return Response.json({ success: true });
  }, async () => {
    await assert.rejects(fetchClientJson("/api/test", {}, {
      timeoutMs: 100, networkMessage: "Connexion perdue, votre formulaire est conservé.",
    }), /formulaire est conservé/);
    assert.deepEqual((await fetchClientJson("/api/test", {}, { timeoutMs: 100 })).data, { success: true });
    assert.equal(calls, 2);
  });
});

test("browser and server share strict email rules, including repeated dots and length limits", () => {
  for (const email of ["camille@example.fr", "camille+vente@example.test", "contact@atelier-mobile.example.fr"]) {
    assert.equal(isValidEmail(email), true, email);
  }
  for (const email of ["a..b@example.com", ".a@example.com", "a.@example.com", "a@invalid", "a@example..com",
    "a@-example.com", "a@example-.com", "a@example.com\nBcc: other", `${"a".repeat(65)}@example.com`, `a@${"b".repeat(64)}.com`]) {
    assert.equal(isValidEmail(email), false, email);
  }
});
