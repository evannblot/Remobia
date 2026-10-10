import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  createCatalogHandlers, MAX_CATALOG_BODY_BYTES, MAX_VERCEL_UPLOAD_BODY_BYTES, uploadBodyLimit,
} from "../app/lib/catalog-server.ts";

const source = ts.transpileModule(readFileSync(new URL("../app/lib/trade-in-server.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replace('from "./trade-in"', `from ${JSON.stringify(new URL("../app/lib/trade-in.ts", import.meta.url).href)}`)
  .replace('from "./catalog-server"', `from ${JSON.stringify(new URL("../app/lib/catalog-server.ts", import.meta.url).href)}`)
  .replace('from "./email-validation.mjs"', `from ${JSON.stringify(new URL("../app/lib/email-validation.mjs", import.meta.url).href)}`);
const { createTradeInHandlers, MAX_TRADE_IN_BODY_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const ORIGIN = "https://remobia.example.test";
const OWNER = { "oai-authenticated-user-id": "synthetic-owner", "oai-authenticated-user-email": "owner@example.test" };

async function withVercel(value, check) {
  const previous = process.env.VERCEL;
  if (value === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = value;
  try { await check(); }
  finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
}

function storageProbe() {
  const calls = { database: 0, uploads: 0 };
  const bindings = {
    SITE_ADMIN_EMAIL: "owner@example.test",
    DB: { prepare() { calls.database++; throw new Error("Synthetic database stop after validation"); } },
    BUCKET: { async put() { calls.uploads++; }, async delete() { throw new Error("No uploads to delete"); } },
  };
  return { calls, bindings };
}

function tradeInRequest(bytesPerPhoto = 900 * 1024) {
  const bytes = new Uint8Array(bytesPerPhoto);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const details = { requestId: crypto.randomUUID(), brand: "Samsung", model: "Galaxy S23", storage: "128 Go", color: "Noir",
    condition: "good", powersOn: "yes", unlocked: "yes", battery: null, defects: [], description: "", repairs: "",
    accessories: [], name: "Camille", email: "camille@example.test", phone: "", consent: true, website: "" };
  const form = new FormData();
  form.set("details", JSON.stringify(details));
  for (const key of ["frontPhoto", "backPhoto", "additionalPhotos", "additionalPhotos"]) {
    form.append(key, new File([bytes], "synthetic.png", { type: "image/png" }));
  }
  return new Request(`${ORIGIN}/api/trade-ins`, { method: "POST", headers: { origin: ORIGIN }, body: form });
}

test("Vercel caps both multipart forms at four MiB while Sites retains its existing limits", async () => {
  assert.equal(MAX_VERCEL_UPLOAD_BODY_BYTES, 4 * 1024 * 1024);
  await withVercel(undefined, async () => {
    assert.equal(uploadBodyLimit(MAX_CATALOG_BODY_BYTES), MAX_CATALOG_BODY_BYTES);
    assert.equal(uploadBodyLimit(MAX_TRADE_IN_BODY_BYTES), MAX_TRADE_IN_BODY_BYTES);
  });
  for (const value of ["1", "0", ""]) await withVercel(value, async () => {
    assert.equal(uploadBodyLimit(MAX_CATALOG_BODY_BYTES), MAX_VERCEL_UPLOAD_BODY_BYTES);
    assert.equal(uploadBodyLimit(MAX_TRADE_IN_BODY_BYTES), MAX_VERCEL_UPLOAD_BODY_BYTES);
  });
});

test("an oversized declared trade-in body is rejected without reading the body or writing storage", async () => {
  await withVercel("1", async () => {
    for (const length of [String(MAX_VERCEL_UPLOAD_BODY_BYTES + 1), "invalid", ""]) {
      const probe = storageProbe();
      const request = tradeInRequest();
      request.headers.set("content-length", length);
      const response = await createTradeInHandlers(probe.bindings).POST(request);
      assert.equal(response.status, 413);
      assert.match((await response.json()).error, /Choisissez des images plus petites/);
      assert.equal(request.bodyUsed, false);
      assert.deepEqual(probe.calls, { database: 0, uploads: 0 });
    }
  });
});

test("trade-in streaming counts all chunks, cancels excess data and rejects a misleading content length", async () => {
  await withVercel("1", async () => {
    for (const declared of [undefined, "1024"]) {
      const probe = storageProbe();
      let cancelled = false;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(3 * 1024 * 1024));
          controller.enqueue(new Uint8Array(2 * 1024 * 1024));
        },
        cancel() { cancelled = true; },
      });
      const headers = { origin: ORIGIN, "content-type": "multipart/form-data; boundary=synthetic" };
      if (declared !== undefined) headers["content-length"] = declared;
      const response = await createTradeInHandlers(probe.bindings).POST(new Request(`${ORIGIN}/api/trade-ins`, {
        method: "POST", headers, body, duplex: "half",
      }));
      assert.equal(response.status, 413);
      assert.equal(cancelled, true);
      assert.deepEqual(probe.calls, { database: 0, uploads: 0 });
    }
  });
});

test("four photos at the client compression limit fit the Vercel request and pass multipart validation", async () => {
  await withVercel("1", async () => {
    const probe = storageProbe();
    const response = await createTradeInHandlers(probe.bindings).POST(tradeInRequest());
    // The synthetic database intentionally stops execution after form validation.
    assert.equal(response.status, 503);
    assert.deepEqual(probe.calls, { database: 1, uploads: 0 });
  });
});

test("a larger valid photo set still passes Sites validation and is rejected on Vercel before storage", async () => {
  await withVercel(undefined, async () => {
    const probe = storageProbe();
    assert.equal((await createTradeInHandlers(probe.bindings).POST(tradeInRequest(1200 * 1024))).status, 503);
    assert.deepEqual(probe.calls, { database: 1, uploads: 0 });
  });
  await withVercel("1", async () => {
    const probe = storageProbe();
    const input = tradeInRequest(1200 * 1024);
    const buffered = new Request(input.url, { method: "POST", headers: input.headers, body: await input.arrayBuffer() });
    assert.equal((await createTradeInHandlers(probe.bindings).POST(buffered)).status, 413);
    assert.deepEqual(probe.calls, { database: 0, uploads: 0 });
  });
});

test("Sites catalogue retains streamed size checks and never writes an oversized announcement", async () => {
  await withVercel(undefined, async () => {
    const probe = storageProbe();
    let cancelled = false;
    const body = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_CATALOG_BODY_BYTES + 1)); },
      cancel() { cancelled = true; },
    });
    const response = await createCatalogHandlers(probe.bindings).POST(new Request(`${ORIGIN}/api/admin/phones`, {
      method: "POST", headers: { origin: ORIGIN, ...OWNER, "content-type": "multipart/form-data; boundary=synthetic" }, body, duplex: "half",
    }));
    assert.equal(response.status, 413);
    assert.equal(cancelled, true);
    assert.deepEqual(probe.calls, { database: 0, uploads: 0 });
  });
});
