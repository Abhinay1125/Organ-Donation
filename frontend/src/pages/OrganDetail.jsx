import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { RequestMessage } from '../components/RequestMessage';
import { OrganJourneyTracker, formatJourneyTime } from '../components/OrganJourneyTracker';
import { getApiError } from '../apiErrors';
import { canPerformAction, dutyLabel } from '../authz';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  User, 
  Building, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Layers, 
  Cpu,
  Hash,
  Sparkles,
  Lock
} from 'lucide-react';

const STAGE_LABELS = {
  READY_FOR_RETRIEVAL: 'Donor Hospital Handover',
  RETRIEVED: 'Procure & Retrieve Organ',
  PACKAGED: 'Complete Packaging & Preservation',
  DISPATCHED: 'Dispatch from Facility',
  IN_TRANSIT: 'Record Transit Checkpoint',
  DELIVERED: 'Confirm Delivery at Destination',
  RECEIVED: 'Receive at Transplant Center',
  TRANSPLANTED: 'Complete Graft Transplantation'
};

export const OrganDetail = ({ organId, setCurrentTab }) => {
  const { authFetch, user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [nextStage, setNextStage] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [locationInput, setLocationInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inspectedStage, setInspectedStage] = useState(null);
  const [restrictedNotice, setRestrictedNotice] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (organId) {
      fetchDetail();
    } else {
      setDetail(null);
      setError('');
      setLoading(false);
    }
  }, [organId]);

  const fetchDetail = async () => {
    setLoading(true);
    setDetail(null);
    setError('');
    try {
      const res = await authFetch(`/api/organs/${organId}`);
      if (!res.ok) throw new Error(await getApiError(res, 'organ record'));
      setDetail(await res.json());
    } catch (err) {
      setError(err.message || 'Unable to load organ lifecycle record.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransition = (stageKey, milestone) => {
    setNextStage(stageKey);
    setSelectedMilestone(milestone || null);
    
    // Suggest contextual location based on the stage being initiated
    let suggestedLoc = '';
    if (stageKey === 'IN_TRANSIT') {
      suggestedLoc = 'Transit Vehicle / Transport Logistics Corridor';
    } else if (stageKey === 'DELIVERED') {
      suggestedLoc = detail?.destination_hospital?.name || 'Destination Hospital Bay';
    } else if (stageKey === 'RECEIVED') {
      suggestedLoc = detail?.destination_hospital ? `${detail.destination_hospital.name} ICU / Reception` : 'Transplant Center ICU';
    } else if (stageKey === 'TRANSPLANTED') {
      suggestedLoc = detail?.destination_hospital ? `${detail.destination_hospital.name} OT` : 'Transplant Operation Theatre';
    } else if (stageKey === 'DISPATCHED') {
      suggestedLoc = detail?.source_hospital ? `${detail.source_hospital.name} Logistics Exit` : 'Ambulance Bay';
    } else {
      suggestedLoc = detail?.source_hospital?.name || 'Donor Center Surgical Suite';
    }

    setLocationInput(suggestedLoc);
    setNotesInput('');
    setModalError('');
    setShowAdvanceModal(true);
  };

  const handleAdvanceStage = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!locationInput.trim()) {
      setModalError('Operational location is required.');
      return;
    }

    setSubmitting(true);
    setModalError('');
    setError('');
    setSuccess('');
    try {
      const res = await authFetch(`/api/organs/${organId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          stage: nextStage,
          location: locationInput.trim(),
          notes: notesInput.trim() || undefined,
          current_stage: detail?.organ?.status
        })
      });
      if (!res.ok) {
        throw new Error(await getApiError(res, 'organ lifecycle movement'));
      }
      setShowAdvanceModal(false);
      setLocationInput('');
      setNotesInput('');
      setModalError('');
      setSuccess(`Organ lifecycle updated successfully to ${nextStage}.`);
      await fetchDetail();
    } catch (err) {
      setModalError(err.message || 'Unable to record this stage transition.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!organId) {
    return (
      <div className="page-container">
        <button 
          onClick={() => setCurrentTab('organs')} 
          className="btn btn-outline btn-sm" 
          style={{ marginBottom: '1rem' }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Organs</span>
        </button>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p className="empty-state" style={{ margin: 0 }}>
            Select an organ from Organ Journeys to view its details
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container" role="status" aria-live="polite">
        <button 
          onClick={() => setCurrentTab('organs')} 
          className="btn btn-outline btn-sm" 
          style={{ marginBottom: '1rem' }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Organs</span>
        </button>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading organ lifecycle and movement tracking data...
        </div>
      </div>
    );
  }

  if (!detail || !detail.organ) {
    return (
      <div className="page-container">
        <button 
          onClick={() => setCurrentTab('organs')} 
          className="btn btn-outline btn-sm" 
          style={{ marginBottom: '1rem' }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Organs</span>
        </button>
        <RequestMessage message={error || 'Organ record could not be found.'} onRetry={organId ? fetchDetail : undefined} />
      </div>
    );
  }

  const { organ, donor, matched_recipient, source_hospital, destination_hospital, movements = [] } = detail;

  // Permissible stage transitions according to backend VALID_TRANSITIONS
  const getNextPermissibleStages = (curr) => {
    switch (curr) {
      case 'MEDICALLY_APPROVED':
        return [];
      case 'MATCHED':
        return ['READY_FOR_RETRIEVAL', 'RETRIEVED'];
      case 'READY_FOR_RETRIEVAL':
        return ['RETRIEVED'];
      case 'RETRIEVED':
        return ['PACKAGED'];
      case 'PACKAGED':
        return ['DISPATCHED'];
      case 'DISPATCHED':
        return ['IN_TRANSIT', 'DELIVERED'];
      case 'IN_TRANSIT':
        return ['DELIVERED'];
      case 'DELIVERED':
        return ['RECEIVED'];
      case 'RECEIVED':
        return ['TRANSPLANTED'];
      default:
        return [];
    }
  };

  // Derive next permissible stages and authorized stages from backend response or client policy fallback
  const nextPermissibleStages = detail.next_permissible_stages || getNextPermissibleStages(organ.status);
  const authorizedStages = detail.authorized_next_stages || nextPermissibleStages.filter((stage) => {
    if (user?.role !== 'HOSPITAL') return false;
    const requiredHospitalId = ['RECEIVED', 'TRANSPLANTED'].includes(stage)
      ? organ.destination_hospital_id
      : organ.source_hospital_id;
    return canPerformAction(user, stage) && user?.hospital_id === requiredHospitalId;
  });

  return (
    <div className="page-container">
      {/* Top Header & Navigation */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <button onClick={() => setCurrentTab('organs')} className="btn btn-outline btn-sm">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Organs</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {organ.status === 'MEDICALLY_APPROVED' && canPerformAction(user, 'matching') && (
            <button onClick={() => setCurrentTab('matching')} className="btn btn-primary btn-sm">
              <Cpu size={14} aria-hidden="true" />
              <span>Proceed to Compatibility Matching</span>
            </button>
          )}
        </div>
      </div>

      <RequestMessage type="success" message={success} />
      <RequestMessage message={error} onRetry={fetchDetail} />

      {/* Role-Aware Operational Status Banner */}
      {authorizedStages.length > 0 ? (
        <div className="notice-banner" style={{ marginBottom: '1.25rem', borderLeftColor: 'var(--color-primary)' }}>
          <Sparkles size={16} flexShrink={0} style={{ color: 'var(--color-primary)', marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong>Interactive Transition Available:</strong>
            <span>
              {' '}You are authorized to advance this organ to <strong>{authorizedStages.join(', ')}</strong>. Click the highlighted stage on the timeline below to update the organ journey.
            </span>
          </div>
        </div>
      ) : user?.role === 'ADMIN' ? (
        <div className="notice-banner" style={{ marginBottom: '1.25rem', borderLeftColor: 'var(--border-color)' }}>
          <Shield size={16} flexShrink={0} style={{ color: 'var(--color-primary)', marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong>System Administrator Oversight:</strong>
            <span>
              {' '}You have monitoring and audit visibility across all organ lifecycle stages. Clinical stage transitions are restricted to authorized operational hospital roles.
            </span>
          </div>
        </div>
      ) : null}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Organ Specification */}
        <div className="card">
          <div className="card-title">Organ Specification</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>{organ.organ_id}</span>
            <StatusBadge status={organ.status} />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            <strong>Organ Type:</strong> {organ.organ_type}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            <strong>Origin Hospital:</strong> {source_hospital ? source_hospital.name : `Hospital #${organ.source_hospital_id}`}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            <strong>Destination Hospital:</strong> {destination_hospital ? destination_hospital.name : 'Not assigned'}
          </div>
        </div>

        {/* Donor Reference */}
        <div className="card">
          <div className="card-title">Donor Reference</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {donor ? `${donor.donor_id} · ${donor.name}` : 'No donor linked'}
          </div>
          {donor && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div><strong>Blood Group:</strong> {donor.blood_group} • <strong>Age:</strong> {donor.age} yrs</div>
              <div><strong>BMI:</strong> {donor.bmi ? donor.bmi.toFixed(1) : 'N/A'} • <strong>Organ:</strong> {donor.organ_type}</div>
              <div style={{ marginTop: '0.25rem' }}>
                <StatusBadge status={donor.status} />
              </div>
            </div>
          )}
        </div>

        {/* Recipient Reference */}
        <div className="card">
          <div className="card-title">
            {organ.status === 'TRANSPLANTED' ? 'Transplanted Recipient' : 'Matched Candidate'}
          </div>
          {matched_recipient ? (
            <div style={{ marginTop: '0.35rem' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {matched_recipient.recipient_id} · {matched_recipient.name}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div><strong>Blood Group:</strong> {matched_recipient.blood_group} • <strong>Required:</strong> {matched_recipient.required_organ}</div>
                <div><strong>Urgency:</strong> {matched_recipient.urgency_tier || 'STANDARD'} • <strong>cPRA:</strong> {matched_recipient.cpra || 0}%</div>
                <div style={{ marginTop: '0.25rem' }}>
                  <StatusBadge status={matched_recipient.status} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              No recipient candidate currently assigned to this organ.
            </div>
          )}
        </div>
      </div>

      {/* Role-Based Interactive Organ Lifecycle Timeline */}
      <OrganJourneyTracker
        organ={organ}
        movements={movements}
        sourceHospital={source_hospital}
        destinationHospital={destination_hospital}
        donor={donor}
        matchedRecipient={matched_recipient}
        compact={false}
        authorizedStages={authorizedStages}
        nextPermissibleStages={nextPermissibleStages}
        onInitiateTransition={handleOpenTransition}
        onInspectStage={(stage) => setInspectedStage(stage)}
        onRestrictedClick={(stage) => setRestrictedNotice(stage)}
        user={user}
      />

      {/* Contextual Transition Confirmation Dialog */}
      {showAdvanceModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="advance-modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <h2 id="advance-modal-title" className="modal-title">
                Update Organ Journey
              </h2>
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="btn btn-outline btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdvanceStage}>
              <div className="modal-body">
                {/* Dynamically populated Context Panel */}
                <div className="card" style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', padding: '0.875rem 1rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>Organ ID</span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{organ.organ_id}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>Organ Type</span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{organ.organ_type}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>Current Stage</span>
                      <div style={{ marginTop: '0.15rem' }}>
                        <StatusBadge status={organ.status} />
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>Next Stage</span>
                      <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                        {nextStage}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>Authenticated User</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{user?.full_name || user?.username}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>Operational Role</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{dutyLabel(user?.operational_role || user?.role)}</span>
                    </div>
                  </div>
                </div>

                {modalError && (
                  <div className="notice-banner" style={{ marginBottom: '1rem', borderLeftColor: 'var(--color-status-red)', color: 'var(--color-status-red-text)' }} role="alert">
                    <AlertCircle size={16} flexShrink={0} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="transition-location">
                    Operational Location <span className="required-star">*</span>
                  </label>
                  <input
                    id="transition-location"
                    type="text"
                    className="form-input"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="e.g. Operating Room 3, Transit Vehicle, Reception Bay"
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    Specific facility department, transit checkpoint, or vehicle tracking point.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="transition-notes">
                    Clinical / Transport Notes
                  </label>
                  <textarea
                    id="transition-notes"
                    className="form-textarea"
                    rows={3}
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Enter procedural notes, temperature recordings, or custody transfer verifications..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="btn btn-outline"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Recording Transition...' : 'Confirm Stage Transition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Stage Inspection Dialog */}
      {inspectedStage && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="stage-inspect-title">
          <div className="modal-card">
            <div className="modal-header">
              <h2 id="stage-inspect-title" className="modal-title">
                Stage Record: {inspectedStage.label}
              </h2>
              <button
                type="button"
                onClick={() => setInspectedStage(null)}
                className="btn btn-outline btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: </span>
                  <span className={`journey-state-pill pill-${inspectedStage.state}`} style={{ marginLeft: '0.35rem' }}>
                    {inspectedStage.state === 'completed' ? 'Completed' : inspectedStage.state === 'current' ? 'Current Active Stage' : 'Logged'}
                  </span>
                </div>
                {inspectedStage.movement?.timestamp && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {formatJourneyTime(inspectedStage.movement.timestamp)}
                    {inspectedStage.elapsed && <strong style={{ marginLeft: '0.35rem', color: 'var(--text-main)' }}>(+{inspectedStage.elapsed})</strong>}
                  </span>
                )}
              </div>

              <div className="card" style={{ backgroundColor: 'var(--bg-subtle, #FAFBFA)', padding: '1rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {inspectedStage.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <Building size={14} className="meta-icon" />
                    <strong style={{ minWidth: '110px' }}>Location:</strong>
                    <span>{inspectedStage.location}</span>
                  </div>
                )}

                {inspectedStage.actor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <User size={14} className="meta-icon" />
                    <strong style={{ minWidth: '110px' }}>Recorded By:</strong>
                    <span>{inspectedStage.actor}</span>
                  </div>
                )}

                {inspectedStage.duty && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <Layers size={14} className="meta-icon" />
                    <strong style={{ minWidth: '110px' }}>Operational Role:</strong>
                    <span>{inspectedStage.duty}</span>
                  </div>
                )}

                {inspectedStage.tx && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <Hash size={14} className="meta-icon" />
                    <strong style={{ minWidth: '110px' }}>Tx Hash:</strong>
                    <span className="code-font" style={{ wordBreak: 'break-all' }}>{inspectedStage.tx}</span>
                  </div>
                )}

                {inspectedStage.notes && (
                  <div style={{ marginTop: '0.35rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Observations / Notes:</strong>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      "{inspectedStage.notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setInspectedStage(null)}
                className="btn btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Restriction Notice Dialog */}
      {restrictedNotice && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="restricted-modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <h2 id="restricted-modal-title" className="modal-title">
                Action Restricted
              </h2>
              <button
                type="button"
                onClick={() => setRestrictedNotice(null)}
                className="btn btn-outline btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="notice-banner" style={{ marginBottom: '1rem', borderLeftColor: 'var(--color-status-amber)', color: 'var(--text-main)' }}>
                <AlertCircle size={16} flexShrink={0} style={{ color: 'var(--color-status-amber-text)' }} />
                <div>
                  <strong>Role Authorization Required</strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Transitioning to stage <strong>{restrictedNotice.label}</strong> is restricted to personnel with the <strong>{restrictedNotice.fallbackRole}</strong> role.
                  </p>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                <div><strong>Signed In As:</strong> {user?.full_name || user?.username}</div>
                <div><strong>Your Operational Duty:</strong> {dutyLabel(user?.operational_role || user?.role)}</div>
                {user?.role === 'ADMIN' && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Administrators have oversight and audit visibility across the system but cannot execute clinical organ transitions.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setRestrictedNotice(null)}
                className="btn btn-primary"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
