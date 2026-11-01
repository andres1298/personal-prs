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
const { verifyTurnstile, captchaMode, hasCaptchaConfiguration, providerCaptchaSiteKey, readCaptchaToken } = module.namespace;

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

function withEnv(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    run();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

test('the CAPTCHA mode defaults to app and switches only on an explicit provider value', () => {
  for (const value of [undefined, '', 'app', 'APP', 'none', 'off', 'providers']) {
    withEnv({ AUTH_CAPTCHA_MODE: value }, () => assert.equal(captchaMode(), 'app', String(value)));
  }
  for (const value of ['provider', ' Provider ']) withEnv({ AUTH_CAPTCHA_MODE: value }, () => assert.equal(captchaMode(), 'provider'));
});

test('each mode requires its own configuration before registration opens', () => {
  withEnv({ AUTH_CAPTCHA_MODE: undefined, TURNSTILE_SECRET_KEY: 'secret', NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined }, () => {
    assert.equal(hasCaptchaConfiguration(), true);
    assert.equal(hasCaptchaConfiguration('provider'), false);
  });
  withEnv({ AUTH_CAPTCHA_MODE: 'provider', TURNSTILE_SECRET_KEY: undefined, NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key' }, () => {
    assert.equal(hasCaptchaConfiguration(), true);
    assert.equal(hasCaptchaConfiguration('app'), false);
  });
});

test('login and invitation forms get a site key only in provider mode', () => {
  withEnv({ AUTH_CAPTCHA_MODE: 'app', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key' }, () => assert.equal(providerCaptchaSiteKey(), ''));
  withEnv({ AUTH_CAPTCHA_MODE: 'provider', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key' }, () => assert.equal(providerCaptchaSiteKey(), 'site-key'));
  withEnv({ AUTH_CAPTCHA_MODE: 'provider', NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined }, () => assert.equal(providerCaptchaSiteKey(), ''));
});

test('form tokens are read as strings and oversized ones are dropped', () => {
  const formWith = (value) => { const form = new FormData(); if (value !== undefined) form.set('cf-turnstile-response', value); return form; };
  assert.equal(readCaptchaToken(formWith('token')), 'token');
  assert.equal(readCaptchaToken(formWith(undefined)), '');
  assert.equal(readCaptchaToken(formWith('x'.repeat(2049))), '');
  assert.equal(readCaptchaToken(formWith(new Blob(['token']))), '');
});
