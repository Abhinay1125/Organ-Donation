import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { RequestMessage } from '../components/RequestMessage';
import { OrganJourneyTracker } from '../components/OrganJourneyTracker';
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
  Cpu
} from 'lucide-react';

const STAGE_LABELS = {
  READY_FOR_RETRIEVAL: 'Mark Ready for Retrieval',
  RETRIEVED: 'Procure & Retrieve Organ',
  PACKAGED: 'Complete Packaging & Preservation',
  DISPATCHED: 'Dispatch from Facility',
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
  const [locationInput, setLocationInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (organId) {
      fetchDetail();
    } else {
      setDetail(null);
      setError('Select an organ from the inventory to view its journey history.');
      setLoading(false);
    }
  }, [organId]);

  const fetchDetail = async () => {
    setLoading(true);
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

  const handleAdvanceStage = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await authFetch(`/api/organs/${organId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          stage: nextStage,
          location: locationInput.trim() || 'Hospital Facility Ward',
          notes: notesInput.trim() || `Stage advanced to ${nextStage}`
        })
      });
      if (!res.ok) {
        throw new Error(await getApiError(res, 'organ lifecycle movement'));
      }
      setShowAdvanceModal(false);
      setLocationInput('');
      setNotesInput('');
      setSuccess(`Organ lifecycle updated: ${STAGE_LABELS[nextStage] || nextStage}.`);
      await fetchDetail();
    } catch (err) {
      setError(err.message || 'Unable to record this stage transition.');
    } finally {
      setSubmitting(false);
    }
  };

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
        return ['DELIVERED'];
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

  const nextOptions = getNextPermissibleStages(organ.status);

  // Filter options based on user operational role and assigned hospital
  const authorizedOptions = nextOptions.filter((stage) => {
    const requiredHospitalId = ['RECEIVED', 'TRANSPLANTED'].includes(stage)
      ? organ.destination_hospital_id
      : organ.source_hospital_id;
    return canPerformAction(user, stage) && user?.hospital_id === requiredHospitalId;
  });

  return (
    <div className="page-container">
      {/* Top Header & Actions */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <button onClick={() => setCurrentTab('organs')} className="btn btn-outline btn-sm">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Organs</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {authorizedOptions.map((stage) => (
            <button
              key={stage}
              onClick={() => {
                setNextStage(stage);
                setShowAdvanceModal(true);
              }}
              className="btn btn-primary btn-sm"
            >
              <span>{STAGE_LABELS[stage] || `Advance to ${stage}`}</span>
            </button>
          ))}

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

      {/* Organ Lifecycle Journey Visualization */}
      <OrganJourneyTracker
        organ={organ}
        movements={movements}
        sourceHospital={source_hospital}
        destinationHospital={destination_hospital}
        donor={donor}
        matchedRecipient={matched_recipient}
        compact={false}
      />

      {/* Advance Stage Modal */}
      {showAdvanceModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="advance-modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <h2 id="advance-modal-title" className="modal-title">
                {STAGE_LABELS[nextStage] || `Transition to ${nextStage}`}
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
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Record the official transition for organ <strong>{organ.organ_id}</strong> to stage <strong>{nextStage}</strong>. This update will be recorded in the system audit log.
                </p>

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
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="transition-notes">
                    Clinical / Transport Notes
                  </label>
                  <textarea
                    id="transition-notes"
                    className="form-textarea"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Enter relevant procedural, temperature, or custody verification notes..."
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
    </div>
  );
};
