import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/rate-limit.js', import.meta.url), 'utf8');
const hour = 60 * 60 * 1000;
const now = new Date('2026-10-21T12:00:00.000Z');

function fakeDatabase() {
  const events = [];
  const inWindow = (row, { key, createdAt }) => (key === undefined || row.key === key)
    && (!createdAt?.gt || row.createdAt > createdAt.gt) && (!createdAt?.lt || row.createdAt < createdAt.lt);
  return {
    events,
    rateLimitEvent: {
      createMany: async ({ data }) => { events.push(...data.map((row) => ({ ...row }))); return { count: data.length }; },
      count: async ({ where }) => events.filter((row) => inWindow(row, where)).length,
      deleteMany: async ({ where }) => {
        const stale = events.filter((row) => inWindow(row, where));
        stale.forEach((row) => events.splice(events.indexOf(row), 1));
        return { count: stale.length };
      },
    },
  };
}

async function limiter() {
  const db = fakeDatabase();
  const dependencies = { 'server-only': {}, 'node:crypto': crypto, './prisma.js': { getPrisma: () => db } };
  const module = new SourceTextModule(source);
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return { api: module.namespace, db };
}

const limits = (email, ip) => [
  { scope: 'recovery:email', subject: email, max: 3, windowMs: hour },
  { scope: 'recovery:ip', subject: ip, max: 10, windowMs: hour },
];

test('allows up to the limit per email, then blocks until the window passes', async () => {
  const { api } = await limiter();
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal(await api.consumeRateLimits(limits('ana@example.test', '203.0.113.7'), now), false);
  assert.equal(await api.consumeRateLimits(limits('ana@example.test', '203.0.113.8'), now), true);
  // Another email from the same IP is still allowed.
  assert.equal(await api.consumeRateLimits(limits('bea@example.test', '203.0.113.7'), now), false);
  assert.equal(await api.consumeRateLimits(limits('ana@example.test', '203.0.113.7'), new Date(now.getTime() + hour + 1)), false);
});

test('blocks an IP that asks for many different emails', async () => {
  const { api } = await limiter();
  for (let index = 0; index < 10; index += 1) assert.equal(await api.consumeRateLimits(limits(`user${index}@example.test`, '203.0.113.7'), now), false);
  assert.equal(await api.consumeRateLimits(limits('new@example.test', '203.0.113.7'), now), true);
  assert.equal(await api.consumeRateLimits(limits('new@example.test', '198.51.100.1'), now), false);
});

test('stores only hashes of the subjects', async () => {
  const { api, db } = await limiter();
  await api.consumeRateLimits(limits('ana@example.test', '203.0.113.7'), now);
  assert.equal(db.events.length, 2);
  assert.equal(db.events[0].key, crypto.createHash('sha256').update('recovery:email:ana@example.test').digest('hex'));
  const stored = JSON.stringify(db.events);
  assert.ok(!stored.includes('ana@example.test') && !stored.includes('203.0.113.7'));
});

test('skips limits without a subject and prunes rows older than a day', async () => {
  const { api, db } = await limiter();
  assert.equal(await api.consumeRateLimits(limits('ana@example.test', null), now), false);
  assert.equal(db.events.length, 1);
  await api.consumeRateLimits(limits('bea@example.test', null), new Date(now.getTime() + 25 * hour));
  assert.equal(db.events.length, 1);
  assert.equal(await api.consumeRateLimits([], now), false);
});
