import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ownerCodeResponse } from '../app/lib/owner-code.mjs';
import ts from 'typescript';

const site = 'https://remobia.example.test';
const owner = 'owner@example.test';
const privateDiagnostic = 'Synthetic provider diagnostic and token';
const request = (data = { action: 'send' }, headers = {}) => new Request(site + '/api/auth/owner-code', {
  method: 'POST', headers: { Origin: site, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
});
const accepted = (data, status = 200) => {
  const headers = new Headers();
  headers.append('Set-Cookie', '__Secure-neon-auth.session_token=synthetic; HttpOnly; Secure; SameSite=Lax');
  headers.append('Set-Cookie', '__Secure-neon-auth.local.session_data=synthetic; HttpOnly; Secure; SameSite=Lax');
  return Response.json(data, { status, headers });
};
const verified = (extra = {}) => ({ user: { id: 'synthetic-id', email: owner, emailVerified: true, ...extra }, token: privateDiagnostic });

test('send delegates only the server email to the SDK and sanitizes its success', async () => {
  let calls = 0;
  const result = await ownerCodeResponse(request({ action: 'send' }, { Cookie: 'existing=synthetic', 'Content-Length': '17' }),
    async (post, path) => {
      calls++;
      assert.deepEqual(path, ['email-otp', 'send-verification-otp']);
      assert.equal(post.url, site + '/api/auth/email-otp/send-verification-otp');
      assert.equal(post.headers.get('cookie'), 'existing=synthetic');
      assert.equal(post.headers.get('origin'), site);
      assert.equal(post.headers.get('content-length'), null);
      assert.deepEqual(await post.json(), { email: owner, type: 'sign-in' });
      return accepted({ success: true, token: privateDiagnostic, email: owner });
    }, ' OWNER@EXAMPLE.TEST ');
  assert.equal(calls, 1);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await result.json(), { ok: true });
  assert.deepEqual(result.headers.getSetCookie(), [
    '__Secure-neon-auth.session_token=synthetic; HttpOnly; Secure; SameSite=Lax',
    '__Secure-neon-auth.local.session_data=synthetic; HttpOnly; Secure; SameSite=Lax',
  ]);
});

test('verify requires a provider-confirmed verified owner and preserves independent signed cookies', async () => {
  const result = await ownerCodeResponse(request({ action: 'verify', otp: '012345' }), async (post, path) => {
    assert.deepEqual(path, ['sign-in', 'email-otp']);
    assert.deepEqual(await post.json(), { email: owner, otp: '012345' });
    return accepted(verified({ email: ' OWNER@EXAMPLE.TEST ' }));
  }, owner);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(result.headers.getSetCookie().length, 2);
});

test('unverified, wrong-email and missing-identity provider sessions never become browser sessions', async () => {
  for (const data of [verified({ emailVerified: false }), verified({ emailVerified: 'true' }),
    verified({ email: 'someone@example.test' }), verified({ id: '' }), verified({ id: null }), { token: privateDiagnostic }]) {
    const result = await ownerCodeResponse(request({ action: 'verify', otp: '012345' }), async () => accepted(data), owner);
    assert.equal(result.status, 403);
    assert.equal(result.headers.getSetCookie().length, 0);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await result.text(), /Synthetic|someone|token/);
  }
});

test('a verified owner response needs a usable Neon session cookie before showing success', async () => {
  for (const cookie of [null, 'other.session_token=synthetic; Secure', '__Secure-neon-auth.session_token=; Secure',
    '__Secure-neon-auth.session_token=""; Secure', '__Secure-neon-auth.session_token=synthetic; Max-Age=0; Secure']) {
    const result = await ownerCodeResponse(request({ action: 'verify', otp: '012345' }), async () => Response.json(verified(), {
      headers: cookie ? { 'Set-Cookie': cookie } : {},
    }), owner);
    assert.equal(result.status, 503);
    assert.equal(result.headers.getSetCookie().length, 0);
  }
  const unprefixed = await ownerCodeResponse(request({ action: 'verify', otp: '012345' }), async () => Response.json(verified(), {
    headers: { 'Set-Cookie': 'neon-auth.session_token=synthetic; HttpOnly; Secure; SameSite=Lax' },
  }), owner);
  assert.equal(unprefixed.status, 200);
});

test('client email, extra fields, unknown actions and non-six-digit codes are rejected before provider access', async () => {
  const invalid = [null, [], {}, { action: 'send', email: owner }, { action: 'send', otp: '123456' },
    { action: 'verify', otp: '123456', email: owner }, { action: 'verify', otp: 123456 },
    { action: 'verify', otp: '12345' }, { action: 'verify', otp: '1234567' }, { action: 'verify', otp: '１２３４５６' },
    { action: 'sign-in' }, { action: 'verify', otp: '12 456' }];
  for (const data of invalid) {
    const result = await ownerCodeResponse(request(data), () => assert.fail('Provider must not be called'), owner);
    assert.equal(result.status, 400);
    assert.equal(result.headers.getSetCookie().length, 0);
  }
});

test('method, explicit origin, fetch-site and JSON content type are enforced before provider access', async () => {
  const cases = [
    [new Request(site + '/api/auth/owner-code'), 405],
    [request(undefined, { Origin: '' }), 403],
    [request(undefined, { Origin: 'null' }), 403],
    [request(undefined, { Origin: 'https://other.example.test' }), 403],
    [request(undefined, { 'Sec-Fetch-Site': 'cross-site' }), 403],
    [request(undefined, { 'Content-Type': 'text/plain' }), 415],
    [request(undefined, { 'Content-Type': 'application/jsonp' }), 415],
  ];
  for (const [post, status] of cases) {
    const result = await ownerCodeResponse(post, () => assert.fail('Provider must not be called'), owner);
    assert.equal(result.status, status);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    if (status === 405) assert.equal(result.headers.get('allow'), 'POST');
  }
});

test('declared and actual streamed byte limits cannot be bypassed with a small content length', async () => {
  for (const length of ['1025', '999999999999', '-1', 'unknown']) {
    const result = await ownerCodeResponse(request(undefined, { 'Content-Length': length }),
      () => assert.fail('Provider must not be called'), owner);
    assert.equal(result.status, 413);
  }
  let cancelled = false;
  const bytes = new TextEncoder().encode(JSON.stringify({ action: 'send' }) + ' '.repeat(1200));
  const body = new ReadableStream({
    start(controller) { controller.enqueue(bytes.slice(0, 600)); controller.enqueue(bytes.slice(600)); },
    cancel() { cancelled = true; },
  });
  const post = new Request(site + '/api/auth/owner-code', { method: 'POST',
    headers: { Origin: site, 'Content-Type': 'application/json', 'Content-Length': '17' }, body, duplex: 'half' });
  const result = await ownerCodeResponse(post, () => assert.fail('Provider must not be called'), owner);
  assert.equal(result.status, 413);
  assert.equal(cancelled, true);
});

test('malformed JSON, invalid UTF-8 and unavailable owner configuration fail without provider calls', async () => {
  for (const body of ['{"action":', new Uint8Array([0xff, 0xfe]), 'null']) {
    const post = new Request(site + '/api/auth/owner-code', { method: 'POST',
      headers: { Origin: site, 'Content-Type': 'application/json' }, body });
    const result = await ownerCodeResponse(post, () => assert.fail('Provider must not be called'), owner);
    assert.equal(result.status, 400);
  }
  for (const email of [undefined, '', 'not-an-email', 'a@example.test\nBcc:other@example.test']) {
    const result = await ownerCodeResponse(request(), () => assert.fail('Provider must not be called'), email);
    assert.equal(result.status, 503);
  }
});

test('provider failures and malformed successes remain readable, private and cookie-free', async () => {
  const providers = [
    async () => accepted({ error: privateDiagnostic }, 500),
    async () => accepted({ success: false, error: privateDiagnostic }),
    async () => new Response(privateDiagnostic),
    async () => { throw new Error(privateDiagnostic); },
  ];
  for (const provider of providers) {
    const result = await ownerCodeResponse(request(), provider, owner);
    assert.equal(result.status, 503);
    assert.equal(result.headers.getSetCookie().length, 0);
    assert.doesNotMatch(await result.text(), /Synthetic|token/);
  }
  const invalidCode = await ownerCodeResponse(request({ action: 'verify', otp: '123456' }),
    async () => accepted({ error: privateDiagnostic }, 401), owner);
  assert.equal(invalidCode.status, 400);
  assert.match((await invalidCode.json()).error, /incorrect ou a expiré/);
  assert.equal(invalidCode.headers.getSetCookie().length, 0);
  const blockedCode = await ownerCodeResponse(request({ action: 'verify', otp: '123456' }),
    async () => accepted({ code: 'TOO_MANY_ATTEMPTS', message: privateDiagnostic }, 403), owner);
  assert.equal(blockedCode.status, 403);
  assert.match((await blockedCode.json()).error, /Demandez un nouveau code/);
  assert.equal(blockedCode.headers.getSetCookie().length, 0);
});

test('provider rate limits preserve only a safely bounded Retry-After', async () => {
  const later = new Date(Date.now() + 120_000).toUTCString();
  for (const [retry, expected] of [['60', '60'], ['00060', '60'], [later, later], ['99999999', null],
    ['-1', null], ['Synthetic private diagnostic', null], ['Mon, 01 Jan 2100 00:00:00 GMT', null]]) {
    const result = await ownerCodeResponse(request(), async () => Response.json({ error: privateDiagnostic }, {
      status: 429, headers: { 'Retry-After': retry, 'Set-Cookie': 'session=synthetic' },
    }), owner);
    assert.equal(result.status, 429);
    assert.equal(result.headers.get('retry-after'), expected);
    assert.equal(result.headers.getSetCookie().length, 0);
    assert.doesNotMatch(await result.text(), /Synthetic|token/);
  }
});

test('a stalled managed provider returns a bounded retryable failure', async () => {
  const result = await ownerCodeResponse(request(), () => new Promise(() => {}), owner, 5);
  assert.equal(result.status, 503);
  assert.equal(result.headers.getSetCookie().length, 0);
});

const stateKey = Symbol.for('remobia.owner-code.route-test');
const mockSource = `
  const state = () => globalThis[Symbol.for('remobia.owner-code.route-test')];
  export function getOwnerAuth() { return state().auth; }
  export function getOwnerAuthOrigin() { return 'https://synthetic.neonauth.example'; }
  export function getOwnerAuthRedirectOrigin() { return null; }
`;
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
let routeSource = ts.transpileModule(await readFile(new URL('../app/api/auth/[...path]/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
routeSource = routeSource.replace('"../../../lib/admin-auth"', JSON.stringify(moduleUrl(mockSource)))
  .replace('"../../../lib/owner-login.mjs"', JSON.stringify(new URL('../app/lib/owner-login.mjs', import.meta.url).href))
  .replace('"../../../lib/owner-code.mjs"', JSON.stringify(new URL('../app/lib/owner-code.mjs', import.meta.url).href));
const route = await import(moduleUrl(routeSource));
const context = path => ({ params: Promise.resolve({ path: path.split('/') }) });

test('route delegates owner code internally while blocking direct OTP and disabled Google bypasses', async () => {
  const savedEmail = process.env.SITE_ADMIN_EMAIL;
  const savedGoogle = process.env.OWNER_GOOGLE_LOGIN_ENABLED;
  let calls = 0;
  globalThis[stateKey] = { auth: { handler: () => ({ POST: async (post, ctx) => {
    calls++;
    assert.deepEqual((await ctx.params).path, ['email-otp', 'send-verification-otp']);
    assert.deepEqual(await post.json(), { email: owner, type: 'sign-in' });
    return Response.json({ success: true });
  } }) } };
  try {
    process.env.SITE_ADMIN_EMAIL = owner;
    delete process.env.OWNER_GOOGLE_LOGIN_ENABLED;
    const sent = await route.POST(request(), context('owner-code'));
    assert.equal(sent.status, 200);
    assert.deepEqual(await sent.json(), { ok: true });
    assert.equal(calls, 1);
    for (const path of ['email-otp/send-verification-otp', 'sign-in/email-otp', 'sign-in/social']) {
      const blocked = await route.POST(request({ email: 'someone@example.test' }), context(path));
      assert.ok([404, 503].includes(blocked.status));
      assert.equal(blocked.headers.get('cache-control'), 'no-store');
    }
    const disabledGoogle = await route.GET(new Request(site + '/api/auth/owner-login'), context('owner-login'));
    assert.equal(disabledGoogle.status, 303);
    assert.equal(disabledGoogle.headers.get('location'), site + '/connexion?erreur=connexion');
    assert.equal(calls, 1);
    const wrongMethod = await route.GET(new Request(site + '/api/auth/owner-code'), context('owner-code'));
    assert.equal(wrongMethod.status, 405);
    globalThis[stateKey].auth = null;
    const unavailable = await route.POST(request(), context('owner-code'));
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  } finally {
    if (savedEmail === undefined) delete process.env.SITE_ADMIN_EMAIL; else process.env.SITE_ADMIN_EMAIL = savedEmail;
    if (savedGoogle === undefined) delete process.env.OWNER_GOOGLE_LOGIN_ENABLED; else process.env.OWNER_GOOGLE_LOGIN_ENABLED = savedGoogle;
    delete globalThis[stateKey];
  }
});
