import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/invite/route.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';
const token = 'tok/en+1';

async function accept(failure) {
  const calls = [];
  class InvitationError extends Error { constructor(code) { super(code); this.code = code; } }
  const dependencies = {
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    '../../../lib/server/auth': {
      hasSameOrigin,
      createAuthClient: async () => ({ auth: { signInWithPassword: async (credentials) => { calls.push(['signIn', credentials]); return { error: null }; } } }),
    },
    '../../../lib/server/invitations': {
      InvitationError,
      acceptInvitation: async (value, password) => {
        calls.push(['accept', value, password]);
        if (failure === 'unexpected') throw new Error('Private failure');
        if (failure) throw new InvitationError(failure);
        return { email: 'ana@example.test' };
      },
    },
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
  return { POST: module.namespace.POST, calls };
}

function form(fields, requestOrigin = origin) {
  return new Request(`${origin}/auth/invite`, { method: 'POST', headers: { origin: requestOrigin }, body: new URLSearchParams(fields) });
}
const valid = { token, password: 'long-password', confirm: 'long-password' };
const back = (query = '') => `${origin}/invite/${encodeURIComponent(token)}${query}`;

test('mismatched passwords never reach the invitation service', async () => {
  const { POST, calls } = await accept();
  const response = await POST(form({ ...valid, confirm: 'other-password' }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), back('?error=mismatch'));
  assert.deepEqual(calls, []);
});

test('accepted invitations sign in with the invited email', async () => {
  const { POST, calls } = await accept();
  const response = await POST(form(valid));
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [['accept', token, 'long-password'], ['signIn', { email: 'ana@example.test', password: 'long-password' }]]);
});

test('invitation errors return to the invitation page without diagnostics', async () => {
  for (const [failure, location] of [['invalid_link', back()], ['email_taken', back('?error=email_taken')], ['weak_password', back('?error=weak_password')], ['unexpected', back('?error=unknown')]]) {
    const { POST, calls } = await accept(failure);
    const response = await POST(form(valid));
    assert.equal(response.headers.get('Location'), location);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.ok(!calls.some(([name]) => name === 'signIn'));
  }
});

test('cross-origin acceptance is rejected', async () => {
  const { POST, calls } = await accept();
  assert.equal((await POST(form(valid, 'https://other.example.test'))).status, 403);
  assert.deepEqual(calls, []);
});

test('the invitation page keeps the Origin header on its same-origin form post', async () => {
  // A no-referrer policy makes browsers send Origin: null on form POSTs, which hasSameOrigin rejects.
  const page = await readFile(new URL('../src/app/invite/[token]/page.jsx', import.meta.url), 'utf8');
  const policy = page.match(/referrer:\s*'([^']+)'/)?.[1];
  assert.ok(['same-origin', 'strict-origin', 'strict-origin-when-cross-origin'].includes(policy), `unexpected referrer policy ${policy}`);
});
