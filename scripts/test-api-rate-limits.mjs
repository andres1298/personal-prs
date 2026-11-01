import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const apiRoot = new URL('../src/app/api/', import.meta.url);
const ownerId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://app.example.test';

async function apiRoutes() {
  const entries = await readdir(apiRoot, { recursive: true });
  return entries.filter((entry) => entry.endsWith('route.js')).sort();
}

test('every authenticated API handler is rate limited per verified user', async () => {
  const routes = await apiRoutes();
  assert.ok(routes.length >= 9, `found ${routes.length} API routes`);
  for (const path of routes) {
    const source = await readFile(new URL(path, apiRoot), 'utf8');
    assert.match(source, /import \{ rateLimitResponse \} from '(\.\.\/)+lib\/server\/rate-limit';/, path);
    // Helpers such as requireAccess(policy) may perform the check for the handlers that call them.
    const helpers = [...source.matchAll(/^async function (\w+)\(([^)]*)\) \{([\s\S]*?)\n\}/gm)]
      .map(([, name, parameter, body]) => ({ name, parameter, body }));
    const handlers = source.split(/export async function /).slice(1);
    assert.ok(handlers.length > 0, path);
    for (const handler of handlers) {
      const name = handler.match(/^\w+/)[0];
      const direct = /rateLimitResponse\('api(Read|Write)', access\.user\.id\)/.test(handler);
      const viaHelper = helpers.some(({ name: helper, parameter, body }) =>
        (new RegExp(`${helper}\\('api(Read|Write)'\\)`).test(handler) && body.includes(`rateLimitResponse(${parameter}, access.user.id)`)) ||
        (new RegExp(`${helper}\\(request\\)`).test(handler) && body.includes("rateLimitResponse('apiWrite', access.user.id)")));
      assert.ok(direct || viaHelper, `${path} ${name} is not rate limited`);
      // Reads use the looser budget, everything else the stricter write budget.
      if (name !== 'GET') assert.doesNotMatch(handler, /'apiRead'/, `${path} ${name} must use the write budget`);
    }
  }
});

async function tour(access, { limited = false } = {}) {
  const calls = [];
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../lib/server/auth': { getAccess: async () => access, hasSameOrigin },
    '../../../lib/server/rate-limit': {
      rateLimitResponse: async (policy, subject) => {
        calls.push(['limit', policy, subject]);
        return limited ? Response.json({ error: 'Demasiadas solicitudes.' }, { status: 429, headers: { 'Retry-After': '30' } }) : null;
      },
    },
    '../../../lib/server/records': { completeTour: async (id) => { calls.push(['complete', id]); } },
  };
  const module = new SourceTextModule(await readFile(new URL('tour/route.js', apiRoot), 'utf8'));
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return { POST: module.namespace.POST, calls };
}

const post = () => new Request(`${origin}/api/tour`, { method: 'POST', headers: { origin } });

test('completing the tour counts against the write budget and stops when limited', async () => {
  const allowed = await tour({ user: { id: ownerId }, authorized: true });
  assert.equal((await allowed.POST(post())).status, 200);
  assert.deepEqual(allowed.calls, [['limit', 'apiWrite', ownerId], ['complete', ownerId]]);
  const limited = await tour({ user: { id: ownerId }, authorized: true }, { limited: true });
  const response = await limited.POST(post());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '30');
  assert.deepEqual(limited.calls, [['limit', 'apiWrite', ownerId]]);
  const anonymous = await tour({ user: null, authorized: false });
  assert.equal((await anonymous.POST(post())).status, 401);
  assert.deepEqual(anonymous.calls, []);
});
