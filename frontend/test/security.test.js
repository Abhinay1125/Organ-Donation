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

test('tab access follows the explicit main-role and operational-role policy', () => {
  assert.equal(canAccessTab('ADMIN', 'admin'), true);
  assert.equal(canAccessTab('ADMIN', 'matching'), false);
  assert.equal(canAccessTab('ADMIN', 'ml'), false);
  assert.equal(canAccessTab({ role: 'ADMIN' }, 'admin'), true);
  assert.equal(canAccessTab({ role: 'ADMIN' }, 'matching'), false);
  assert.equal(canAccessTab({ role: 'ADMIN' }, 'ml'), false);
  assert.equal(canAccessTab({ role: 'HOSPITAL', operational_role: 'ORGAN_MATCHING_ORGANIZER' }, 'matching'), true);
  assert.equal(canAccessTab({ role: 'HOSPITAL', operational_role: 'ORGAN_MATCHING_ORGANIZER' }, 'ml'), true);
  assert.equal(canAccessTab({ role: 'HOSPITAL', operational_role: 'ORGAN_MATCHING_ORGANIZER' }, 'admin'), false);
  assert.equal(canAccessTab({ role: 'HOSPITAL', operational_role: 'PATIENT_DOCTOR' }, 'matching'), false);
  assert.equal(canAccessTab({ role: 'HOSPITAL', operational_role: 'PATIENT_DOCTOR' }, 'ml'), false);
  assert.equal(canAccessTab('HOSPITAL', 'matching'), false);
  assert.equal(canAccessTab('HOSPITAL', 'blockchain'), false);
  assert.equal(canAccessTab('DONOR', 'dashboard'), false);
  assert.equal(canAccessTab('RECIPIENT', 'recipients'), false);
  assert.equal(canAccessTab('ADMIN', 'unknown'), false);
});

test('sidebar item filtering matches exact acceptance criteria for all roles', () => {
  const allItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'donors', label: 'Donors' },
    { id: 'recipients', label: 'Waiting List' },
    { id: 'organs', label: 'Organ Journeys' },
    { id: 'matching', label: 'Matching Review' },
    { id: 'ml', label: 'ML Analytics' },
    { id: 'blockchain', label: 'Blockchain Ledger' },
    { id: 'audit', label: 'Audit Records' },
    { id: 'admin', label: 'Admin Console' },
  ];

  const filterFor = (user) => allItems.filter(item => canAccessTab(user, item.id)).map(item => item.label);

  // 1. Log in as ADMIN:
  // sidebar shows Overview, Donors, Waiting List, Organ Journeys, Blockchain Ledger, Audit Records, Admin Console;
  // no Matching Review, no ML Analytics.
  const adminLabels = filterFor({ role: 'ADMIN' });
  assert.deepEqual(adminLabels, [
    'Overview',
    'Donors',
    'Waiting List',
    'Organ Journeys',
    'Blockchain Ledger',
    'Audit Records',
    'Admin Console'
  ]);
  assert.equal(adminLabels.includes('Matching Review'), false);
  assert.equal(adminLabels.includes('ML Analytics'), false);

  // 2. Log in as matching organizer:
  // Matching Review and ML Analytics appear; Admin Console does not.
  const matchingOrganizerLabels = filterFor({
    role: 'HOSPITAL',
    operational_role: 'ORGAN_MATCHING_ORGANIZER'
  });
  assert.equal(matchingOrganizerLabels.includes('Matching Review'), true);
  assert.equal(matchingOrganizerLabels.includes('ML Analytics'), true);
  assert.equal(matchingOrganizerLabels.includes('Admin Console'), false);

  // 3. Log in as hospital user with another operational role: neither appears.
  const otherRoles = ['PATIENT_DOCTOR', 'DONOR_SURGEON', 'TRANSPORTER', 'TRANSPLANT_SURGEON', 'PROCUREMENT_ORGANIZER', null, undefined];
  for (const opRole of otherRoles) {
    const labels = filterFor({ role: 'HOSPITAL', operational_role: opRole });
    assert.equal(labels.includes('Matching Review'), false, `Matching Review should not appear for ${opRole}`);
    assert.equal(labels.includes('ML Analytics'), false, `ML Analytics should not appear for ${opRole}`);
    assert.equal(labels.includes('Admin Console'), false, `Admin Console should not appear for ${opRole}`);
  }
});
