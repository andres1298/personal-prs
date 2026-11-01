import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/rate-limit.js', import.meta.url), 'utf8');
const userId = '11111111-1111-4111-8111-111111111111';

// Mirrors the single upsert in Postgres: a new or expired bucket restarts at 1, otherwise it grows.
function fakeDatabase({ failure = null } = {}) {
  const db = {
    clock: Date.parse('2026-11-01T12:00:00.000Z'),
    buckets: new Map(),
    queries: [],
    prunes: 0,
    $queryRaw: async (strings, ...values) => {
      if (failure) throw failure;
      db.queries.push({ sql: strings.join('?'), values });
      const [key, windowSeconds] = values;
      const current = db.buckets.get(key);
      const bucket = !current || current.expiresAt.getTime() <= db.clock
        ? { count: 1, expiresAt: new Date(db.clock + windowSeconds * 1000) }
        : { ...current, count: current.count + 1 };
      db.buckets.set(key, bucket);
      return [{ ...bucket }];
    },
    $executeRaw: async (strings) => {
      db.prunes += 1;
      assert.match(strings.join('?'), /DELETE FROM "RateLimitBucket" WHERE "expiresAt" < now\(\)/);
      for (const [key, bucket] of db.buckets) if (bucket.expiresAt.getTime() < db.clock) db.buckets.delete(key);
      return 0;
    },
  };
  return db;
}

async function limiter(options) {
  // Key derivation reads RATE_LIMIT_SECRET; tests pass a secret explicitly when they need one.
  delete process.env.RATE_LIMIT_SECRET;
  const db = fakeDatabase(options);
  const logs = [];
  const dependencies = {
    'server-only': {},
    'node:crypto': { createHash, createHmac },
    'node:net': { isIPv6 },
    './prisma.js': { getPrisma: () => db },
  };
  const module = new SourceTextModule(source);
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  const originalError = console.error;
  const api = module.namespace;
  // Deterministic clock and no random pruning unless a test asks for it.
  const check = async (policy, subject, extra = {}) => {
    console.error = (...args) => logs.push(args);
    try {
      return await api.checkRateLimit(policy, subject, { random: () => 1, now: () => db.clock, ...extra });
    } finally {
      console.error = originalError;
    }
  };
  return { api, db, logs, check };
}

test('keys are SHA-256 hashes of the policy and subject, never the raw identifiers', async () => {
  const { api, db, check } = await limiter();
  const key = api.rateLimitKey('login', '203.0.113.7', '');
  assert.equal(key, createHash('sha256').update('login:203.0.113.7').digest('hex'));
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.notEqual(api.rateLimitKey('apiRead', userId), api.rateLimitKey('apiWrite', userId));
  assert.equal(api.rateLimitKey('login', null), api.rateLimitKey('login', 'unknown'));
  assert.equal(api.rateLimitKey('login', '  '), api.rateLimitKey('login', 'unknown'));
  await check('login', '203.0.113.7');
  await check('apiWrite', userId);
  const stored = JSON.stringify(db.queries.map((query) => query.values));
  assert.doesNotMatch(stored, /203\.0\.113\.7/);
  assert.ok(!stored.includes(userId));
});

test('with a server secret the keys are HMACs that cannot be recomputed from the subject alone', async () => {
  const { api, db } = await limiter();
  const secret = 'test-only-secret';
  const key = api.rateLimitKey('login', '203.0.113.7', secret);
  assert.equal(key, createHmac('sha256', secret).update('login:203.0.113.7').digest('hex'));
  assert.notEqual(key, api.rateLimitKey('login', '203.0.113.7', ''));
  assert.notEqual(key, api.rateLimitKey('login', '203.0.113.7', 'another-secret'));
  process.env.RATE_LIMIT_SECRET = secret;
  try {
    assert.equal(api.rateLimitKey('login', '203.0.113.7'), key);
    await api.checkRateLimit('login', '203.0.113.7', { random: () => 1, now: () => db.clock });
    assert.equal(db.queries[0].values[0], key);
  } finally {
    delete process.env.RATE_LIMIT_SECRET;
  }
});

test('IPv6 clients share a bucket per /64 while IPv4 addresses stay exact', async () => {
  const { api } = await limiter();
  assert.equal(api.ipSubject('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
  assert.equal(api.ipSubject('2001:DB8:1:2::1'), '2001:db8:1:2::/64');
  assert.equal(api.ipSubject('2001:0db8:0001:0002:ffff::7'), '2001:db8:1:2::/64');
  assert.equal(api.ipSubject('[2001:db8:1:2::1]'), '2001:db8:1:2::/64');
  assert.equal(api.ipSubject('fe80::1%eth0'), 'fe80:0:0:0::/64');
  assert.equal(api.ipSubject('2001:db8::'), '2001:db8:0:0::/64');
  assert.equal(api.ipSubject('::1'), '0:0:0:0::/64');
  assert.notEqual(api.ipSubject('2001:db8:1:2::1'), api.ipSubject('2001:db8:1:3::1'));
  // IPv4-mapped addresses count as the IPv4 client they carry.
  assert.equal(api.ipSubject('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(api.ipSubject('::ffff:cb00:7107'), '203.0.113.7');
  assert.equal(api.ipSubject('203.0.113.7'), '203.0.113.7');
  assert.equal(api.ipSubject(' 203.0.113.7 '), '203.0.113.7');
  assert.equal(api.ipSubject('not-an-ip'), 'not-an-ip');
  assert.equal(api.ipSubject('1:2:3'), '1:2:3');
  assert.equal(api.clientIp(new Headers({ 'x-real-ip': '2001:db8:1:2:aaaa::1' })), '2001:db8:1:2::/64');
  assert.equal(api.clientIp(new Headers({ 'x-forwarded-for': '2001:db8:1:2::9, 10.0.0.1' })), '2001:db8:1:2::/64');
  assert.equal(api.rateLimitKey('login', api.clientIp(new Headers({ 'x-real-ip': '2001:db8:1:2::1' }))),
    api.rateLimitKey('login', api.clientIp(new Headers({ 'x-real-ip': '2001:db8:1:2:ffff:ffff:ffff:fffe' }))));
});

test('the upsert is one parameterized statement on the hashed key', async () => {
  const { api, db, check } = await limiter();
  await check('login', '203.0.113.7');
  const [{ sql, values }] = db.queries;
  assert.match(sql, /INSERT INTO "RateLimitBucket"/);
  assert.match(sql, /ON CONFLICT \("key"\) DO UPDATE/);
  assert.match(sql, /RETURNING "count", "expiresAt"/);
  assert.deepEqual(values, [api.rateLimitKey('login', '203.0.113.7'), api.RATE_LIMITS.login.windowSeconds]);
});

test('a fixed window allows the limit, then blocks with Retry-After until it expires', async () => {
  const { api, db, check } = await limiter();
  const { limit, windowSeconds } = api.RATE_LIMITS.login;
  for (let index = 0; index < limit; index += 1) assert.deepEqual(await check('login', '203.0.113.7'), { allowed: true, retryAfter: 0 });
  assert.deepEqual(await check('login', '203.0.113.7'), { allowed: false, retryAfter: windowSeconds });
  // Other addresses and other policies keep their own budgets.
  assert.equal((await check('login', '198.51.100.4')).allowed, true);
  assert.equal((await check('logout', '203.0.113.7')).allowed, true);
  db.clock += (windowSeconds - 30) * 1000;
  assert.deepEqual(await check('login', '203.0.113.7'), { allowed: false, retryAfter: 30 });
  db.clock += 30 * 1000;
  assert.deepEqual(await check('login', '203.0.113.7'), { allowed: true, retryAfter: 0 });
});

test('expired buckets are pruned occasionally', async () => {
  const { db, check } = await limiter();
  await check('login', '203.0.113.7');
  assert.equal(db.prunes, 0);
  db.clock += 3600 * 1000;
  await check('apiRead', userId, { random: () => 0 });
  assert.equal(db.prunes, 1);
  assert.equal(db.buckets.size, 1);
});

test('database failures fail open and log no personal data', async () => {
  const failure = Object.assign(new Error(`relation "RateLimitBucket" does not exist for 203.0.113.7 ${userId}`), { code: 'P2010' });
  const { check, logs } = await limiter({ failure });
  assert.deepEqual(await check('login', '203.0.113.7'), { allowed: true, retryAfter: 0 });
  assert.deepEqual(await check('apiWrite', userId), { allowed: true, retryAfter: 0 });
  assert.equal(logs.length, 2);
  const logged = JSON.stringify(logs);
  assert.match(logged, /P2010/);
  assert.doesNotMatch(logged, /203\.0\.113\.7/);
  assert.ok(!logged.includes(userId));
});

test('unknown policies are programming errors', async () => {
  const { check } = await limiter();
  await assert.rejects(check('signup-typo', '203.0.113.7'), /Unknown rate limit policy/);
  await assert.rejects(check('toString', '203.0.113.7'), /Unknown rate limit policy/);
});

test('the policy table limits public routes by IP and the API by user, with stricter writes', async () => {
  const { api } = await limiter();
  assert.ok(Object.isFrozen(api.RATE_LIMITS));
  for (const name of ['login', 'logout', 'inviteAccept', 'invitePage']) assert.equal(api.RATE_LIMITS[name].subject, 'ip', name);
  for (const name of ['apiRead', 'apiWrite']) assert.equal(api.RATE_LIMITS[name].subject, 'user', name);
  for (const policy of Object.values(api.RATE_LIMITS)) {
    assert.ok(Number.isInteger(policy.limit) && policy.limit > 0);
    assert.ok(Number.isInteger(policy.windowSeconds) && policy.windowSeconds > 0);
  }
  const perMinute = ({ limit, windowSeconds }) => limit / windowSeconds;
  assert.ok(perMinute(api.RATE_LIMITS.apiWrite) < perMinute(api.RATE_LIMITS.apiRead));
});

test('client IPs come from the platform headers with a shared fallback bucket', async () => {
  const { api } = await limiter();
  assert.equal(api.clientIp(new Headers({ 'x-real-ip': ' 203.0.113.7 ', 'x-forwarded-for': '198.51.100.4' })), '203.0.113.7');
  assert.equal(api.clientIp(new Headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' })), '198.51.100.4');
  assert.equal(api.clientIp(new Headers()), 'unknown');
  assert.equal(api.clientIp(new Headers({ 'x-forwarded-for': ' , ' })), 'unknown');
});

test('provider rate limits are recognized by status or over_* code', async () => {
  const { api } = await limiter();
  assert.equal(api.isProviderRateLimit({ status: 429 }), true);
  assert.equal(api.isProviderRateLimit({ status: 400, code: 'over_request_rate_limit' }), true);
  assert.equal(api.isProviderRateLimit({ code: 'over_email_send_rate_limit' }), true);
  assert.equal(api.isProviderRateLimit({ status: 400, code: 'invalid_credentials' }), false);
  assert.equal(api.isProviderRateLimit(null), false);
});

test('API responses answer 429 in Spanish with Retry-After once the limit is hit', async () => {
  const { api, db } = await limiter();
  // rateLimitResponse uses the real clock.
  db.clock = Date.now();
  const originalRandom = Math.random;
  Math.random = () => 1;
  try {
    for (let index = 0; index < api.RATE_LIMITS.apiWrite.limit; index += 1) assert.equal(await api.rateLimitResponse('apiWrite', userId), null);
    const response = await api.rateLimitResponse('apiWrite', userId);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.ok(Number(response.headers.get('Retry-After')) >= 1);
    assert.equal((await response.json()).error, api.RATE_LIMIT_MESSAGE);
    assert.match(api.RATE_LIMIT_MESSAGE, /Demasiadas solicitudes/);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(db.queries.length, api.RATE_LIMITS.apiWrite.limit + 1);
});
