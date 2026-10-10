import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerRedirect } from '../app/lib/owner-redirect.mjs';

const origin = 'https://auth.example.neon.tech';
test('OAuth may navigate to the configured provider or Google without relying on a popup', () => {
  assert.equal(ownerRedirect(origin + '/oauth?state=synthetic', origin), origin + '/oauth?state=synthetic');
  assert.equal(ownerRedirect('https://accounts.google.com/o/oauth2/v2/auth', origin), 'https://accounts.google.com/o/oauth2/v2/auth');
});
test('OAuth rejects foreign origins, credentials, insecure schemes and lookalike hosts', () => {
  for (const value of ['https://accounts.google.com.attacker.example/auth', 'https://attacker.example/auth',
    'http://auth.example.neon.tech/auth', 'javascript:alert(1)', 'https://user:secret@auth.example.neon.tech/auth',
    'https://accounts.google.com:8443/auth', '/relative', null, 'x'.repeat(8193)]) {
    assert.equal(ownerRedirect(value, origin), null);
  }
  assert.equal(ownerRedirect(origin + '/auth', 'not-an-origin'), null);
});
