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

const TAB_ALIASES = {
  dashboard: 'dashboard',
  overview: 'dashboard',
  donors: 'donors',
  recipients: 'recipients',
  waitinglist: 'recipients',
  organs: 'organs',
  organjourneys: 'organs',
  'organ-detail': 'organ-detail',
  organdetail: 'organ-detail',
  matching: 'matching',
  matchingreview: 'matching',
  ml: 'ml',
  mlanalytics: 'ml',
  blockchain: 'blockchain',
  blockchainledger: 'blockchain',
  blockchainaudit: 'blockchain',
  audit: 'audit',
  auditrecords: 'audit',
  admin: 'admin',
  adminconsole: 'admin',
};

export const normalizeTab = (tabId) => {
  if (!tabId || typeof tabId !== 'string') return '';
  const clean = tabId.trim().toLowerCase().replace(/[-_\s]/g, '');
  return TAB_ALIASES[clean] || tabId;
};

/**
 * Access control helper for tabs/navigation.
 *
 * Rules:
 * - "Matching Review" (tab Matching) and "ML Analytics" (tab MLAnalytics) are visible and
 *   reachable only when user.role === "HOSPITAL" && user.operational_role === "ORGAN_MATCHING_ORGANIZER".
 * - "Admin Console" is visible and reachable only when user.role === "ADMIN".
 * - All other tabs keep their current visibility.
 *
 * Supports both canAccessTab(user, tabId) and canAccessTab(role, tabId, operationalRole).
 */
export const canAccessTab = (userOrRole, tabId, operationalRoleParam) => {
  if (!userOrRole) return false;

  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  const operationalRole = typeof userOrRole === 'string'
    ? operationalRoleParam
    : userOrRole.operational_role;

  if (!role) return false;

  const tab = normalizeTab(tabId);

  // 1. "Matching Review" (tab Matching) and "ML Analytics" (tab MLAnalytics) are visible and reachable
  // only when user.role === "HOSPITAL" && user.operational_role === "ORGAN_MATCHING_ORGANIZER".
  if (tab === 'matching' || tab === 'ml') {
    return role === 'HOSPITAL' && operationalRole === 'ORGAN_MATCHING_ORGANIZER';
  }

  // 2. "Admin Console" is visible and reachable only when user.role === "ADMIN".
  if (tab === 'admin') {
    return role === 'ADMIN';
  }

  // 3. All other tabs keep their current visibility.
  if (role === 'ADMIN') {
    const adminAllowed = [
      'dashboard',
      'donors',
      'recipients',
      'organs',
      'organ-detail',
      'blockchain',
      'audit',
      'admin',
    ];
    return adminAllowed.includes(tab);
  }

  if (role === 'HOSPITAL') {
    const baseTabs = [
      'dashboard',
      'donors',
      'recipients',
      'organs',
      'organ-detail',
      'matching',
      'ml',
    ];
    if (!baseTabs.includes(tab)) return false;

    const duties = TAB_DUTIES[tab];
    return !duties || (operationalRole ? duties.includes(operationalRole) : false);
  }

  return false;
};
