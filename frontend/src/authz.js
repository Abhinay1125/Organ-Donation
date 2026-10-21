const TAB_DUTIES = {
  dashboard: null,
  blockchain: ['ADMIN'],
  audit: ['ADMIN'],
  admin: ['ADMIN'],
  donors: ['PROCUREMENT_ORGANIZER', 'PATIENT_DOCTOR', 'DONOR_SURGEON'],
  recipients: ['PATIENT_DOCTOR'],
  organs: ['PROCUREMENT_ORGANIZER', 'PATIENT_DOCTOR', 'ORGAN_MATCHING_ORGANIZER', 'DONOR_SURGEON', 'TRANSPORTER', 'TRANSPLANT_SURGEON'],
  'organ-detail': ['PROCUREMENT_ORGANIZER', 'PATIENT_DOCTOR', 'ORGAN_MATCHING_ORGANIZER', 'DONOR_SURGEON', 'TRANSPORTER', 'TRANSPLANT_SURGEON'],
  matching: ['ORGAN_MATCHING_ORGANIZER'],
  ml: ['ORGAN_MATCHING_ORGANIZER'],
};

const BASE_TABS = ['dashboard', 'donors', 'recipients', 'organs', 'organ-detail', 'matching', 'ml'];
export const canAccessTab = (role, tab, operationalRole) => {
  if (role === 'ADMIN') return ['dashboard', 'donors', 'recipients', 'organs', 'organ-detail', 'matching', 'ml', 'blockchain', 'audit', 'admin'].includes(tab);
  if (role !== 'HOSPITAL' || !BASE_TABS.includes(tab)) return false;
  const duties = TAB_DUTIES[tab];
  return !duties || (operationalRole ? duties.includes(operationalRole) : true);
};

export const canPerformAction = (user, action) => {
  const duties = {
    registerDonor: ['PROCUREMENT_ORGANIZER'],
    approveDonor: ['PATIENT_DOCTOR'],
    registerRecipient: ['PATIENT_DOCTOR'],
    matching: ['ORGAN_MATCHING_ORGANIZER'],
    MATCHED: ['ORGAN_MATCHING_ORGANIZER'],
    READY_FOR_RETRIEVAL: ['DONOR_SURGEON'], RETRIEVED: ['DONOR_SURGEON'], PACKAGED: ['DONOR_SURGEON'],
    DISPATCHED: ['TRANSPORTER'], IN_TRANSIT: ['TRANSPORTER'], DELIVERED: ['TRANSPORTER'],
    RECEIVED: ['TRANSPLANT_SURGEON'], TRANSPLANTED: ['TRANSPLANT_SURGEON'],
  };
  return user?.role === 'HOSPITAL' && (duties[action] || []).includes(user.operational_role);
};

export const DUTY_LABELS = {
  ORGAN_MATCHING_ORGANIZER: 'Matching Organizer',
  MATCHING_ORGANIZER: 'Matching Organizer',
  organMatchingOrganizer: 'Matching Organizer',
  PATIENT_DOCTOR: 'Patient Doctor',
  patientDoctor: 'Patient Doctor',
  PROCUREMENT_ORGANIZER: 'Procurement Organizer',
  procurementOrganizer: 'Procurement Organizer',
  DONOR_SURGEON: 'Donor Surgeon',
  donorSurgeon: 'Donor Surgeon',
  TRANSPORTER: 'Transporter',
  transporter: 'Transporter',
  TRANSPLANT_SURGEON: 'Transplant Surgeon',
  transplantSurgeon: 'Transplant Surgeon',
  ADMIN: 'Administrator',
  ADMINISTRATOR: 'Administrator',
  admin: 'Administrator',
  administrator: 'Administrator',
  HOSPITAL: 'Hospital Staff',
  hospital: 'Hospital Staff',
  DONOR: 'Donor',
  donor: 'Donor',
  RECIPIENT: 'Recipient',
  recipient: 'Recipient',
};

/**
 * Returns a user-friendly label for any duty, operational role, or account role.
 * Unknown values fall back to a title-cased readable string, never the raw code.
 */
export const dutyLabel = (duty) => {
  if (!duty || typeof duty !== 'string') return 'Not Assigned';
  const trimmed = duty.trim();
  if (DUTY_LABELS[trimmed]) return DUTY_LABELS[trimmed];
  const upper = trimmed.toUpperCase();
  if (DUTY_LABELS[upper]) return DUTY_LABELS[upper];

  // Fallback to title-cased readable string, never the raw code
  return trimmed
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getDutyLabel = dutyLabel;

