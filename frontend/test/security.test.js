import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessTab } from '../src/authz.js';
import { clearStoredSession, restoreSession } from '../src/session.js';

test('no token never triggers session restoration', async () => {
  let called = false;
  assert.equal(await restoreSession('', async () => { called = true; }), null);
  assert.equal(called, false);
});

test('session restoration trusts only the validated /me response', async () => {
  let requestInfo;
  const user = { id: 9, role: 'HOSPITAL' };
  const restored = await restoreSession('synthetic-token', async (...args) => {
    requestInfo = args;
    return { ok: true, json: async () => user };
  });
  assert.equal(restored, user);
  assert.equal(requestInfo[0], '/api/auth/me');
  assert.equal(requestInfo[1].headers.Authorization, 'Bearer synthetic-token');
});

test('rejected and unreachable sessions restore as unauthenticated', async () => {
  assert.equal(await restoreSession('invalid', async () => ({ ok: false, status: 401 })), null);
  assert.equal(await restoreSession('unreachable', async () => { throw new Error('network'); }), null);
});

test('logout clears both cached identity and token', () => {
  const removed = [];
  clearStoredSession({ removeItem: key => removed.push(key) });
  assert.deepEqual(removed, ['token', 'user']);
});

test('tab access follows the explicit main-role policy', () => {
  assert.equal(canAccessTab('ADMIN', 'admin'), true);
  assert.equal(canAccessTab('HOSPITAL', 'matching'), true);
  assert.equal(canAccessTab('HOSPITAL', 'blockchain'), false);
  assert.equal(canAccessTab('DONOR', 'dashboard'), false);
  assert.equal(canAccessTab('RECIPIENT', 'recipients'), false);
  assert.equal(canAccessTab('ADMIN', 'unknown'), false);
});
