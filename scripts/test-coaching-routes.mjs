import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';
import { TrainingInputError } from '../src/lib/training.js';

const coachId = '11111111-1111-4111-8111-111111111111';
const athleteId = '22222222-2222-4222-8222-222222222222';
const origin = 'https://app.example.test';

class CoachingError extends Error { constructor(code) { super(code); this.code = code; } }

async function link(path, dependencies) {
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'));
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return module.namespace;
}

// The real route wrapper over a fake session and a fake coach check.
async function wrapper(access, coach = false) {
  return link('../src/lib/server/api.js', {
    'server-only': {},
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    './auth.js': { getAccess: async () => access, hasSameOrigin },
    './coaching.js': { CoachingError, isCoach: async () => coach },
    '../training.js': { TrainingInputError },
  });
}

const signedIn = { user: { id: coachId }, authorized: true };
const send = (method, body, requestOrigin = origin) => new Request(`${origin}/api/x?from=2026-11-01`, {
  method, headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});

test('anonymous, unapproved and non-coach sessions never reach a coach handler', async () => {
  for (const [access, coach, status] of [
    [{ user: null, authorized: false }, true, 401], [{ user: { id: coachId }, authorized: false }, true, 403], [signedIn, false, 403],
  ]) {
    let reached = false;
    const { route } = await wrapper(access, coach);
    const response = await route({ coach: true }, () => { reached = true; })(send('GET'));
    assert.deepEqual([response.status, reached], [status, false]);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('members without the coach role still reach athlete handlers', async () => {
  const { route } = await wrapper(signedIn, false);
  const response = await route({}, ({ userId, query }) => ({ userId, from: query.get('from') }))(send('GET'));
  assert.deepEqual([response.status, await response.json()], [200, { userId: coachId, from: '2026-11-01' }]);
});

test('mutations require the same origin and a JSON object within the size limit', async () => {
  const { route } = await wrapper(signedIn, true);
  const calls = [];
  const handler = route({ coach: true, body: 50, status: 201 }, ({ input, params }) => { calls.push([input, params]); });
  assert.equal((await handler(send('POST', { name: 'A' }, 'https://other.example.test'))).status, 403);
  for (const body of ['not json', '[]', '"text"', 'null']) assert.equal((await handler(send('POST', body))).status, 400);
  assert.equal((await handler(send('POST', { name: 'x'.repeat(60) }))).status, 413);
  assert.deepEqual(calls, []);
  const created = await handler(send('POST', { name: 'A' }), { params: Promise.resolve({ id: athleteId }) });
  assert.deepEqual([created.status, await created.json(), calls], [201, {}, [[{ name: 'A' }, { id: athleteId }]]]);
});

test('known errors map to safe statuses and unknown ones never leak', async () => {
  const { route } = await wrapper(signedIn, true);
  const failing = (error) => route({ coach: true }, () => { throw error; })(send('GET'));
  for (const [code, status] of [['not_found', 404], ['invalid_input', 400], ['invalid_link', 404], ['own_link', 409], ['has_coach', 409], ['has_logs', 409], ['forbidden', 403]]) {
    const response = await failing(new CoachingError(code));
    assert.deepEqual([response.status, (await response.json()).code], [status, code]);
  }
  assert.equal((await failing(new TrainingInputError('Block id must be an id.'))).status, 400);
  const unknown = await failing(new Error('Private database diagnostic'));
  assert.equal(unknown.status, 503);
  assert.doesNotMatch(await unknown.text(), /Private/);
});

// Each route passes the verified user, never an id from the request, as the acting coach or athlete.
test('routes act as the session user', async () => {
  const calls = [];
  const record = (name) => async (...args) => { calls.push([name, ...args]); return name === 'getCoaching' ? { id: coachId } : []; };
  const route = (options, handler) => (input) => handler({ userId: athleteId, input, params: { id: 's1' }, query: new URLSearchParams('from=a&to=b') });
  const coaching = { acceptJoin: record('acceptJoin'), endLink: record('endLink'), getCoaching: record('getCoaching'), CoachingError };
  const join = await link('../src/app/api/coaching/route.js', { '../../../lib/server/api': { route }, '../../../lib/server/coaching': coaching });
  await join.POST({ code: 'ABCDEFGH', athleteId: coachId });
  await join.DELETE();
  const plan = await link('../src/app/api/plan/[id]/route.js', { '../../../../lib/server/api': { route }, '../../../../lib/server/training': { saveLog: record('saveLog') } });
  await plan.PUT({ completed: true });
  assert.deepEqual(calls, [
    ['acceptJoin', athleteId, 'ABCDEFGH'], ['getCoaching', athleteId], ['endLink', athleteId, { coachId, athleteId }],
    ['saveLog', athleteId, 's1', { completed: true }],
  ]);
});
