import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createCatalogHandlers, isCatalogAdmin } from "../app/lib/catalog-server.ts";

const OWNER = {
  "oai-authenticated-user-id": "synthetic-owner-id",
  "oai-authenticated-user-email": "owner@example.test",
};
const id = "11111111-1111-4111-8111-111111111111";
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const headersMockURL = dataModule(`
  export let reads = 0;
  let requestHeaders;
  export function setHeaders(value) { requestHeaders = value; reads = 0; }
  export async function headers() { reads++; return requestHeaders; }
`);
const navigationMockURL = dataModule(`
  export function redirect(destination) {
    const error = new Error("redirect");
    error.destination = destination;
    throw error;
  }
`);
const headersMock = await import(headersMockURL);
const authSource = ts.transpileModule(readFileSync(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replace('from "next/headers"', `from ${JSON.stringify(headersMockURL)}`)
  .replace('from "next/navigation"', `from ${JSON.stringify(navigationMockURL)}`);
const { getChatGPTUser, requireChatGPTUser } = await import(dataModule(authSource));

const tradeInSource = ts.transpileModule(readFileSync(new URL("../app/lib/trade-in-server.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replace('from "./trade-in"', `from ${JSON.stringify(new URL("../app/lib/trade-in.ts", import.meta.url).href)}`)
  .replace('from "./catalog-server"', `from ${JSON.stringify(new URL("../app/lib/catalog-server.ts", import.meta.url).href)}`)
  .replace('from "./email-validation.mjs"', `from ${JSON.stringify(new URL("../app/lib/email-validation.mjs", import.meta.url).href)}`);
const { createTradeInHandlers } = await import(dataModule(tradeInSource));

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

function forgedRequest(method = "GET") {
  return new Request("https://remobia.example.test/api/admin/phones", {
    method, headers: { origin: "https://remobia.example.test", ...OWNER },
  });
}

test("Sites retains its gateway identity while Vercel never reads or accepts forged identity headers", async () => {
  await withVercel(undefined, async () => {
    headersMock.setHeaders(new Headers(OWNER));
    assert.equal((await getChatGPTUser()).email, "owner@example.test");
    assert.equal(isCatalogAdmin(forgedRequest(), { SITE_ADMIN_EMAIL: "owner@example.test" }), true);
  });
  for (const value of ["1", "0", ""]) {
    await withVercel(value, async () => {
      headersMock.setHeaders(new Headers(OWNER));
      assert.equal(await getChatGPTUser(), null);
      assert.equal(headersMock.reads, 0);
      assert.equal(isCatalogAdmin(forgedRequest(), { SITE_ADMIN_EMAIL: "owner@example.test" }), false);
      await assert.rejects(requireChatGPTUser("/gestion/reprises"), (error) => error.destination === "/");
    });
  }
});

test("forged owner headers cannot read or mutate the Vercel catalogue even if storage and owner email exist", async () => {
  let storageCalls = 0;
  const bindings = {
    SITE_ADMIN_EMAIL: "owner@example.test",
    DB: { prepare() { storageCalls++; throw new Error("Storage must not be reached"); } },
    BUCKET: { async put() { storageCalls++; }, async delete() { storageCalls++; } },
  };
  const handlers = createCatalogHandlers(bindings);
  await withVercel("1", async () => {
    for (const response of [
      await handlers.ADMIN_GET(forgedRequest()),
      await handlers.POST(forgedRequest("POST")),
      await handlers.PUT(forgedRequest("PUT"), id),
      await handlers.DELETE(forgedRequest("DELETE"), id),
    ]) {
      assert.equal(response.status, 503);
      assert.match(response.headers.get("cache-control"), /private.*no-store/);
    }
  });
  assert.equal(storageCalls, 0);
});

test("forged owner headers cannot reveal, erase, or download private trade-in submissions on Vercel", async () => {
  let storageCalls = 0;
  const handlers = createTradeInHandlers({
    SITE_ADMIN_EMAIL: "owner@example.test",
    DB: { prepare() { storageCalls++; throw new Error("Storage must not be reached"); } },
    BUCKET: { async get() { storageCalls++; }, async delete() { storageCalls++; } },
  });
  await withVercel("1", async () => {
    for (const response of [
      await handlers.ADMIN_GET(forgedRequest()),
      await handlers.DELETE(forgedRequest("DELETE"), id),
      await handlers.IMAGE_GET(forgedRequest(), id, "front"),
    ]) {
      assert.equal(response.status, 503);
      assert.match(response.headers.get("cache-control"), /private.*no-store/);
    }
  });
  assert.equal(storageCalls, 0);
});

test("forged owner headers cannot download a draft catalogue photo on Vercel", async () => {
  let photoReads = 0;
  const handlers = createCatalogHandlers({
    SITE_ADMIN_EMAIL: "owner@example.test",
    DB: { prepare() { return { bind() { return this; }, async first() {
      return { id, phone_id: id, object_key: "private-test-photo", mime_type: "image/png", position: 0, status: "draft" };
    } }; } },
    BUCKET: { async get() { photoReads++; return { body: new Uint8Array([1]), size: 1 }; } },
  });
  await withVercel("1", async () => {
    assert.equal((await handlers.IMAGE_GET(forgedRequest(), id)).status, 404);
  });
  assert.equal(photoReads, 0);
});

test("configured Vercel management requires a verified matching session and never trusts gateway headers", async () => {
  await withVercel("1", async () => {
    const base = { SITE_ADMIN_EMAIL: "owner@example.test", OWNER_AUTH_CONFIGURED: true };
    for (const identity of [null, { userId: "other", email: "other@example.test", verified: true }, { userId: "owner", email: "owner@example.test", verified: false }]) {
      const bindings = { ...base, OWNER_IDENTITY: identity };
      assert.equal(isCatalogAdmin(forgedRequest(), bindings), false);
      assert.equal((await createCatalogHandlers(bindings).ADMIN_GET(forgedRequest())).status, identity ? 403 : 401);
      assert.equal((await createTradeInHandlers(bindings).ADMIN_GET(forgedRequest())).status, identity ? 403 : 401);
    }
    assert.equal(isCatalogAdmin(forgedRequest(), { ...base, OWNER_IDENTITY: { userId: "owner", email: "OWNER@example.test", verified: true } }), true);
    assert.equal(isCatalogAdmin(forgedRequest(), base), false);
  });
});
