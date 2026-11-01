import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/signup-retry.js', import.meta.url), 'utf8');
const module = new SourceTextModule(source);
await module.link((specifier) => {
  if (specifier === 'server-only') return new SyntheticModule([], () => {});
  if (specifier !== 'node:crypto') throw new Error(`Unexpected dependency: ${specifier}`);
  return new SyntheticModule(Object.keys(nodeCrypto), function () {
    for (const [name, value] of Object.entries(nodeCrypto)) this.setExport(name, value);
  });
});
await module.evaluate();
const { createPasswordRetry, readPasswordRetry, passwordRetryCookieOptions, PASSWORD_RETRY_SECONDS } = module.namespace;

const userId = '22222222-2222-4222-8222-222222222222';
const now = Date.UTC(2026, 10, 1, 10, 0, 0);

test('a marker is readable only for the user it was issued for, until it expires', () => {
  process.env.SUPABASE_SECRET_KEY = 'test-only-server-secret';
  const marker = createPasswordRetry(userId, now);
  assert.equal(readPasswordRetry(marker, now), userId);
  assert.equal(readPasswordRetry(marker, now + (PASSWORD_RETRY_SECONDS - 1) * 1000), userId);
  assert.equal(readPasswordRetry(marker, now + PASSWORD_RETRY_SECONDS * 1000), null);
  assert.doesNotMatch(marker, /test-only-server-secret/);
});

test('changing the user, the expiry or the signature invalidates the marker', () => {
  process.env.SUPABASE_SECRET_KEY = 'test-only-server-secret';
  const [, expiresAt, signature] = createPasswordRetry(userId, now).split('.');
  const otherUser = '33333333-3333-4333-8333-333333333333';
  for (const value of [
    `${otherUser}.${expiresAt}.${signature}`,
    `${userId}.${Number(expiresAt) + 3600}.${signature}`,
    `${userId}.${expiresAt}.${signature.slice(0, -1)}`,
    `${userId}.${expiresAt}.${signature}.extra`,
    `${userId}.${expiresAt}`,
    'not-a-marker', '', undefined, null, 42,
  ]) assert.equal(readPasswordRetry(value, now), null, String(value));
});

test('a marker signed with another secret is rejected, and without a secret none is issued or accepted', () => {
  process.env.SUPABASE_SECRET_KEY = 'test-only-server-secret';
  const marker = createPasswordRetry(userId, now);
  process.env.SUPABASE_SECRET_KEY = 'another-test-secret';
  assert.equal(readPasswordRetry(marker, now), null);
  delete process.env.SUPABASE_SECRET_KEY;
  assert.equal(createPasswordRetry(userId, now), null);
  assert.equal(readPasswordRetry(marker, now), null);
});

test('markers are only issued for user ids and the cookie stays server-only and same-site', () => {
  process.env.SUPABASE_SECRET_KEY = 'test-only-server-secret';
  for (const value of ['', 'abc', `${userId}.x`, undefined]) assert.equal(createPasswordRetry(value, now), null);
  assert.deepEqual(passwordRetryCookieOptions(new Request('https://app.example.test/auth/callback')), { httpOnly: true, sameSite: 'strict', secure: true, path: '/auth', maxAge: PASSWORD_RETRY_SECONDS });
  assert.equal(passwordRetryCookieOptions(new Request('http://localhost:3000/auth/callback'), 0).secure, false);
});
