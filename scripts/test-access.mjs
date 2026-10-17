import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasSameOrigin, isAuthorizedUser } from '../src/lib/server/access-policy.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

test('access stays closed without a verified user or explicit authorization', () => {
  assert.equal(isAuthorizedUser(null, ownerId), false);
  assert.equal(isAuthorizedUser({ id: ownerId }), false);
  assert.equal(isAuthorizedUser({ id: otherId }, ownerId), false);
  assert.equal(isAuthorizedUser({ id: ownerId, is_anonymous: true }, ownerId), false);
});

test('editable metadata cannot grant access and revocation takes effect immediately', () => {
  const user = { id: otherId, user_metadata: { authorized: true, role: 'admin', id: ownerId } };
  assert.equal(isAuthorizedUser(user, ownerId), false);
  assert.equal(isAuthorizedUser({ id: ownerId }, ` ${ownerId}, ${otherId} `), true);
  assert.equal(isAuthorizedUser({ id: ownerId }, otherId), false);
});

test('mutations reject cross-origin requests and missing origins', () => {
  const request = (origin) => new Request('https://app.example.test/api/records', {
    method: 'POST', headers: origin == null ? {} : { origin },
  });
  assert.equal(hasSameOrigin(request('https://app.example.test')), true);
  for (const origin of [null, 'null', 'https://other.example.test', 'https://app.example.test.attacker.test', 'http://app.example.test']) {
    assert.equal(hasSameOrigin(request(origin)), false);
  }
});
