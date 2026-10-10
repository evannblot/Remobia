import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerRedirect, neonRedirectOrigin } from '../app/lib/owner-redirect.mjs';

const origin = 'https://auth.example.neon.tech';
test('OAuth may navigate to the configured provider or Google without relying on a popup', () => {
  assert.equal(ownerRedirect(origin + '/oauth?state=synthetic', origin), origin + '/oauth?state=synthetic');
  assert.equal(ownerRedirect('https://accounts.google.com/o/oauth2/v2/auth', origin), 'https://accounts.google.com/o/oauth2/v2/auth');
});

test('A declared alternate Neon routing origin preserves state for the same endpoint only', () => {
  const configured = 'https://ep-synthetic.neonauth.c-8.eu-central-1.aws.neon.tech';
  const alternate = 'https://ep-synthetic.neonauth.c-6.eu-central-1.aws.neon.tech';
  const url = alternate + '/neondb/auth/sign-in/social/init?state=synthetic%2Bstate';
  assert.equal(ownerRedirect(url, configured), null);
  assert.equal(neonRedirectOrigin(alternate, configured), alternate);
  assert.equal(ownerRedirect(url, configured, alternate), url);
  assert.equal(ownerRedirect(alternate + '/untrusted/path', configured, alternate), null);
  assert.equal(ownerRedirect(url.replace('c-6', 'c-7'), configured, alternate), null);
  for (const candidate of [alternate.replace('ep-synthetic', 'ep-other'),
    alternate.replace('eu-central-1', 'us-east-1'), alternate + ':8443', alternate + '/path',
    alternate + '?override=1', alternate + '#fragment', alternate.replace('https://', 'https://user:secret@'),
    alternate + '.attacker.example', alternate.replace('https:', 'http:')]) {
    assert.equal(neonRedirectOrigin(candidate, configured), null);
    assert.equal(ownerRedirect(url, configured, candidate), null);
  }
});
test('OAuth rejects foreign origins, credentials, insecure schemes and lookalike hosts', () => {
  for (const value of ['https://accounts.google.com.attacker.example/auth', 'https://attacker.example/auth',
    'http://auth.example.neon.tech/auth', 'javascript:alert(1)', 'https://user:secret@auth.example.neon.tech/auth',
    'https://accounts.google.com:8443/auth', '/relative', null, 'x'.repeat(8193)]) {
    assert.equal(ownerRedirect(value, origin), null);
  }
  assert.equal(ownerRedirect(origin + '/auth', 'not-an-origin'), null);
});
