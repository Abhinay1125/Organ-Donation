import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerformAction, dutyLabel } from '../src/authz.js';
import { 
  JOURNEY_MILESTONES, 
  STATUS_INDEX_MAP, 
  formatJourneyTime, 
  calculateElapsedTime 
} from '../src/utils/journey.js';

test('operational role authorization for lifecycle transitions', () => {
  const donorSurgeon = { role: 'HOSPITAL', operational_role: 'DONOR_SURGEON' };
  const procurementOrg = { role: 'HOSPITAL', operational_role: 'PROCUREMENT_ORGANIZER' };
  const transporter = { role: 'HOSPITAL', operational_role: 'TRANSPORTER' };
  const transplantSurgeon = { role: 'HOSPITAL', operational_role: 'TRANSPLANT_SURGEON' };
  const patientDoctor = { role: 'HOSPITAL', operational_role: 'PATIENT_DOCTOR' };
  const admin = { role: 'ADMIN', operational_role: 'ADMIN' };
  const donor = { role: 'DONOR' };
  const recipient = { role: 'RECIPIENT' };

  // 1. Donor Hospital Handover (READY_FOR_RETRIEVAL)
  assert.equal(canPerformAction(procurementOrg, 'READY_FOR_RETRIEVAL'), true);
  assert.equal(canPerformAction(donorSurgeon, 'READY_FOR_RETRIEVAL'), true);
  assert.equal(canPerformAction(transporter, 'READY_FOR_RETRIEVAL'), false);
  assert.equal(canPerformAction(transplantSurgeon, 'READY_FOR_RETRIEVAL'), false);
  assert.equal(canPerformAction(admin, 'READY_FOR_RETRIEVAL'), false);

  // 2. Retrieval (RETRIEVED)
  assert.equal(canPerformAction(donorSurgeon, 'RETRIEVED'), true);
  assert.equal(canPerformAction(transporter, 'RETRIEVED'), false);
  assert.equal(canPerformAction(transplantSurgeon, 'RETRIEVED'), false);
  assert.equal(canPerformAction(procurementOrg, 'RETRIEVED'), false);
  assert.equal(canPerformAction(admin, 'RETRIEVED'), false);

  // 3. Packaging (PACKAGED)
  assert.equal(canPerformAction(donorSurgeon, 'PACKAGED'), true);
  assert.equal(canPerformAction(transporter, 'PACKAGED'), false);
  assert.equal(canPerformAction(transplantSurgeon, 'PACKAGED'), false);
  assert.equal(canPerformAction(admin, 'PACKAGED'), false);

  // 4. Transportation: Dispatched, In Transit, Delivered
  for (const transportStage of ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED']) {
    assert.equal(canPerformAction(transporter, transportStage), true, `Transporter should perform ${transportStage}`);
    assert.equal(canPerformAction(donorSurgeon, transportStage), false, `Donor surgeon should NOT perform ${transportStage}`);
    assert.equal(canPerformAction(transplantSurgeon, transportStage), false, `Transplant surgeon should NOT perform ${transportStage}`);
    assert.equal(canPerformAction(patientDoctor, transportStage), false, `Patient doctor should NOT perform ${transportStage}`);
    assert.equal(canPerformAction(admin, transportStage), false, `Admin should NOT perform ${transportStage}`);
    assert.equal(canPerformAction(donor, transportStage), false, `Donor should NOT perform ${transportStage}`);
    assert.equal(canPerformAction(recipient, transportStage), false, `Recipient should NOT perform ${transportStage}`);
  }

  // 5. Receipt (RECEIVED)
  assert.equal(canPerformAction(transplantSurgeon, 'RECEIVED'), true);
  assert.equal(canPerformAction(transporter, 'RECEIVED'), false);
  assert.equal(canPerformAction(donorSurgeon, 'RECEIVED'), false);
  assert.equal(canPerformAction(admin, 'RECEIVED'), false);

  // 6. Transplantation (TRANSPLANTED)
  assert.equal(canPerformAction(transplantSurgeon, 'TRANSPLANTED'), true);
  assert.equal(canPerformAction(transporter, 'TRANSPLANTED'), false);
  assert.equal(canPerformAction(donorSurgeon, 'TRANSPLANTED'), false);
  assert.equal(canPerformAction(procurementOrg, 'TRANSPLANTED'), false);
  assert.equal(canPerformAction(patientDoctor, 'TRANSPLANTED'), false);
  assert.equal(canPerformAction(admin, 'TRANSPLANTED'), false);
});

test('journey milestones structure matches research paper workflow', () => {
  assert.equal(JOURNEY_MILESTONES.length, 8);
  const keys = JOURNEY_MILESTONES.map(m => m.key);
  assert.deepEqual(keys, [
    'donor_facility',
    'retrieved',
    'packaged',
    'dispatched',
    'transport',
    'destination_arrival',
    'received',
    'transplanted'
  ]);

  const stages = JOURNEY_MILESTONES.map(m => m.transitionStage);
  assert.deepEqual(stages, [
    'READY_FOR_RETRIEVAL',
    'RETRIEVED',
    'PACKAGED',
    'DISPATCHED',
    'IN_TRANSIT',
    'DELIVERED',
    'RECEIVED',
    'TRANSPLANTED'
  ]);
});

test('status index mapping maps all lifecycle states correctly', () => {
  assert.equal(STATUS_INDEX_MAP.MEDICALLY_APPROVED, 0);
  assert.equal(STATUS_INDEX_MAP.MATCHED, 0);
  assert.equal(STATUS_INDEX_MAP.READY_FOR_RETRIEVAL, 0);
  assert.equal(STATUS_INDEX_MAP.RETRIEVED, 1);
  assert.equal(STATUS_INDEX_MAP.PACKAGED, 2);
  assert.equal(STATUS_INDEX_MAP.DISPATCHED, 3);
  assert.equal(STATUS_INDEX_MAP.IN_TRANSIT, 4);
  assert.equal(STATUS_INDEX_MAP.DELIVERED, 5);
  assert.equal(STATUS_INDEX_MAP.RECEIVED, 6);
  assert.equal(STATUS_INDEX_MAP.TRANSPLANTED, 7);
});

test('journey time and duration formatting', () => {
  assert.equal(formatJourneyTime(null), null);
  assert.equal(formatJourneyTime('invalid-date'), null);

  const t1 = '2026-11-06T10:00:00Z';
  const t2 = '2026-11-06T10:45:00Z';
  const t3 = '2026-11-06T13:15:00Z';

  assert.equal(calculateElapsedTime(t2, t1), '45m');
  assert.equal(calculateElapsedTime(t3, t1), '3h 15m');
  assert.equal(calculateElapsedTime(t1, t2), null); // negative
});

test('duty labels provide clear readable text for all operational roles', () => {
  assert.equal(dutyLabel('DONOR_SURGEON'), 'Donor Surgeon');
  assert.equal(dutyLabel('TRANSPORTER'), 'Transporter');
  assert.equal(dutyLabel('TRANSPLANT_SURGEON'), 'Transplant Surgeon');
  assert.equal(dutyLabel('PROCUREMENT_ORGANIZER'), 'Procurement Organizer');
  assert.equal(dutyLabel('ORGAN_MATCHING_ORGANIZER'), 'Matching Organizer');
  assert.equal(dutyLabel('PATIENT_DOCTOR'), 'Patient Doctor');
  assert.equal(dutyLabel('ADMIN'), 'Administrator');
});
