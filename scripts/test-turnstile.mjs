import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/turnstile.js', import.meta.url), 'utf8');
const module = new SourceTextModule(source);
await module.link((specifier) => {
  if (specifier !== 'server-only') throw new Error(`Unexpected dependency: ${specifier}`);
  return new SyntheticModule([], () => {});
});
await module.evaluate();
const { verifyTurnstile } = module.namespace;

function fetchReturning(result, calls = []) {
  return async (url, init) => { calls.push([url, init]); return typeof result === 'function' ? result() : { ok: true, json: async () => result }; };
}

test('only an explicit success from Cloudflare passes', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const calls = [];
  assert.equal(await verifyTurnstile('token', '203.0.113.7', fetchReturning({ success: true }, calls)), true);
  const [url, init] = calls[0];
  assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.deepEqual(Object.fromEntries(init.body), { secret: 'secret', response: 'token', remoteip: '203.0.113.7' });
  assert.equal(await verifyTurnstile('token', null, fetchReturning({ success: false, 'error-codes': ['timeout-or-duplicate'] })), false);
  assert.equal(await verifyTurnstile('token', null, fetchReturning({})), false);
});

test('missing token or secret, bad responses and network errors fail closed', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const never = fetchReturning(() => { throw new Error('must not be called'); });
  assert.equal(await verifyTurnstile('', null, never), false);
  assert.equal(await verifyTurnstile('x'.repeat(2049), null, never), false);
  assert.equal(await verifyTurnstile('token', null, fetchReturning(() => ({ ok: false, json: async () => ({ success: true }) }))), false);
  assert.equal(await verifyTurnstile('token', null, fetchReturning(() => { throw new Error('network'); })), false);
  process.env.TURNSTILE_SECRET_KEY = '';
  assert.equal(await verifyTurnstile('token', null, never), false);
});
