import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerLoginResponse } from '../app/lib/owner-login.mjs';

const site = 'https://remobia.example.test';
const authOrigin = 'https://ep-synthetic.neonauth.c-8.eu-central-1.aws.neon.tech';
const alternate = authOrigin.replace('c-8', 'c-6');
const request = () => new Request(site + '/api/auth/owner-login', { headers: { Cookie: 'existing=synthetic' } });

test('server OAuth navigation binds the callback to this site and preserves separate provider cookies', async () => {
  const target = alternate + '/neondb/auth/sign-in/social/init?state=synthetic%2Bstate';
  const result = await ownerLoginResponse(request(), async post => {
    assert.equal(post.method, 'POST');
    assert.equal(post.headers.get('origin'), site);
    assert.equal(post.headers.get('cookie'), 'existing=synthetic');
    assert.deepEqual(await post.json(), { provider: 'google', callbackURL: site + '/gestion/telephones', disableRedirect: true });
    const headers = new Headers();
    headers.append('Set-Cookie', 'state=synthetic; HttpOnly; Secure');
    headers.append('Set-Cookie', 'challenge=synthetic; HttpOnly; Secure');
    return Response.json({ url: target, redirect: false }, { headers });
  }, authOrigin, alternate);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), target.replace(alternate, authOrigin));
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.getSetCookie().length, 2);
});

test('canonical provider and Google redirects are not altered', async () => {
  for (const target of [authOrigin + '/neondb/auth/sign-in/social/init?state=synthetic',
    'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic']) {
    const result = await ownerLoginResponse(request(), async () => Response.json({ url: target }), authOrigin, alternate);
    assert.equal(result.headers.get('location'), target);
  }
});

test('provider rejection, foreign redirect and stalled response return to a readable login error', async () => {
  for (const handler of [async () => Response.json({ url: 'https://attacker.example/auth' }),
    async () => Response.json({ error: 'Private provider diagnostic' }, { status: 500 }),
    async () => new Response('invalid JSON'), () => new Promise(() => {})]) {
    const result = await ownerLoginResponse(request(), handler, authOrigin, alternate, 5);
    assert.equal(result.status, 303);
    assert.equal(result.headers.get('location'), site + '/connexion?erreur=connexion');
    assert.equal(await result.text(), '');
    assert.equal(result.headers.getSetCookie().length, 0);
  }
});
