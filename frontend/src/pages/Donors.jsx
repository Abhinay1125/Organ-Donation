import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { canPerformAction } from '../authz';
import { RequestMessage } from '../components/RequestMessage';
import { getApiError } from '../apiErrors';
import { HeartHandshake, Plus, CheckCircle, XCircle, Search, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

const calcBmi = (h, w) =>
  h > 0 && w > 0 ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;

export const Donors = () => {
  const { authFetch, user } = useAuth();
  const [donors, setDonors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [ledgerOffline, setLedgerOffline] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    donor_id: '',
    name: '',
    age: '',
    gender: 'MALE',
    blood_group: 'O+',
    organ_type: 'Kidney',
    height_cm: '',
    weight_kg: '',
    hospital_id: user?.hospital_id || '',
    medical_notes: ''
  });

  const [approvalNotes, setApprovalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Scroll state & ref for donor registration modal
  const registerModalBodyRef = useRef(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const handleModalScroll = (e) => {
    const el = e.currentTarget;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    setIsScrolledToBottom(atBottom);
  };

  const handleScrollToggle = () => {
    const el = registerModalBodyRef.current;
    if (!el) return;
    if (isScrolledToBottom) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (showRegisterModal) {
      setIsScrolledToBottom(false);
      setTimeout(() => {
        if (registerModalBodyRef.current) {
          registerModalBodyRef.current.scrollTop = 0;
        }
      }, 0);
    }
  }, [showRegisterModal]);

  useEffect(() => {
    fetchDonors();
    if (canPerformAction(user, 'registerDonor')) fetchHospitals();
    fetchLedgerStatus();
  }, [user]);

  const fetchDonors = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/donors');
      if (!res.ok) throw new Error(await getApiError(res, 'donor records'));
      setDonors(await res.json());
    } catch (err) {
      setError(err.message || 'Unable to load donor records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await authFetch('/api/hospitals');
      if (!res.ok) throw new Error(await getApiError(res, 'hospital choices'));
      setHospitals((await res.json()).filter(hospital => hospital.id === user?.hospital_id));
    } catch (err) {
      setError(err.message || 'Unable to load hospital choices.');
    }
  };

  const fetchLedgerStatus = async () => {
    try {
      const res = await authFetch('/api/blockchain/status');
      if (res.ok) setLedgerOffline((await res.json()).connected === false);
    } catch {
      // Ledger status is non-blocking for donor registration.
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const {
        donor_id,
        name,
        age,
        gender,
        blood_group,
        organ_type,
        height_cm,
        weight_kg,
        hospital_id,
        medical_notes
      } = formData;
      const payload = {
        donor_id,
        name,
        age: Number(age),
        gender,
        blood_group,
        organ_type,
        height_cm: Number(height_cm),
        weight_kg: Number(weight_kg),
        bmi: calcBmi(Number(height_cm), Number(weight_kg)),
        hospital_id: Number(hospital_id),
        medical_notes
      };
      const res = await authFetch('/api/donors', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(await getApiError(res, 'donor registration'));
      }
      setShowRegisterModal(false);
      setFormData({
        donor_id: '',
        name: '',
        age: '',
        gender: 'MALE',
        blood_group: 'O+',
        organ_type: 'Kidney',
        height_cm: '',
        weight_kg: '',
        hospital_id: user?.hospital_id || '',
        medical_notes: ''
      });
      setSuccess('Donor registered successfully in the procurement queue.');
      await fetchDonors();
    } catch (err) {
      setError(err.message || 'Unable to register donor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalSubmit = async (isApproved) => {
    if (!selectedDonor || submitting || !approvalNotes.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await authFetch(`/api/donors/${selectedDonor.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          is_approved: isApproved,
          medical_notes: approvalNotes.trim()
        })
      });
      if (!res.ok) {
        throw new Error(await getApiError(res, 'donor medical decision'));
      }
      setShowApprovalModal(false);
      setSelectedDonor(null);
      setApprovalNotes('');
      setSuccess(`Donor medical decision (${isApproved ? 'Approved' : 'Rejected'}) recorded.`);
      await fetchDonors();
    } catch (err) {
      setError(err.message || 'Unable to record the medical decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState('');
  const showClinicalDetails = user?.operational_role === 'PATIENT_DOCTOR';
  const filtered = donors.filter(d => {
    const matchesReference = d.donor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.organ_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = matchesReference || (showClinicalDetails &&
      (d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       d.blood_group.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesStatus = !statusFilter || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Donor Registry & Medical Evaluation</h1>
          <p className="page-subtitle">Standardized physiological profiles, clinical screening, and authorized medical clearance</p>
        </div>

        {canPerformAction(user, 'registerDonor') && (
          <button 
            onClick={() => {
              const nextId = `DON-${100 + donors.length + 1}`;
              setFormData(prev => ({ ...prev, donor_id: nextId, hospital_id: user?.hospital_id || '' }));
              setShowRegisterModal(true);
            }} 
            className="btn btn-primary"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Register New Donor</span>
          </button>
        )}
      </div>

      <RequestMessage
        message={error}
        onRetry={() => {
          fetchDonors();
          if (canPerformAction(user, 'registerDonor')) fetchHospitals();
        }}
      />
      <RequestMessage type="success" message={success} />

      {/* Search & Filter Toolbar */}
      <div className="table-tools" style={{ marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', maxWidth: '300px', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} aria-hidden="true" />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px' }}
            placeholder="Search by ID, organ, blood group..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Filter donors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="form-select"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">All statuses</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Donor ID</th>
              {user?.operational_role === 'PATIENT_DOCTOR' && <th>Full Name</th>}
              <th>Organ Type</th>
              {user?.operational_role === 'PATIENT_DOCTOR' && (
                <>
                  <th>Blood Group</th>
                  <th>Age</th>
                  <th>BMI</th>
                </>
              )}
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={user?.operational_role === 'PATIENT_DOCTOR' ? '8' : '4'} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading donor records…
                </td>
              </tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id}>
                <td className="id">
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{d.donor_id}</span>
                </td>
                {user?.operational_role === 'PATIENT_DOCTOR' && <td>{d.name}</td>}
                <td>
                  <span style={{ fontWeight: 500 }}>{d.organ_type}</span>
                </td>
                {user?.operational_role === 'PATIENT_DOCTOR' && (
                  <>
                    <td>
                      <span style={{ fontWeight: 600 }}>{d.blood_group}</span>
                    </td>
                    <td>{d.age} yrs</td>
                    <td>{d.bmi?.toFixed(1)}</td>
                  </>
                )}
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td>
                  {d.status === 'PENDING_APPROVAL' && canPerformAction(user, 'approveDonor') ? (
                    <button
                      onClick={() => {
                        setSelectedDonor(d);
                        setApprovalNotes('');
                        setShowApprovalModal(true);
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      Evaluate
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {d.status === 'APPROVED' ? 'Cleared' : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={user?.operational_role === 'PATIENT_DOCTOR' ? '8' : '4'} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No donor records found matching search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot" style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderBottomLeftRadius: 'var(--radius-card)', borderBottomRightRadius: 'var(--radius-card)' }}>
        <span>Showing {filtered.length} of {donors.length} donor records</span>
        <span style={{ color: 'var(--color-text-muted)' }}>Donor medical registry</span>
      </div>

      {/* Modal: Register Donor */}
      {showRegisterModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="register-donor-title">
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="register-donor-title" className="modal-title">Register Prospective Organ Donor</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  type="button"
                  onClick={handleScrollToggle} 
                  className="modal-scroll-btn"
                  aria-label={isScrolledToBottom ? "Scroll to top of form" : "Scroll to bottom of form"}
                  title={isScrolledToBottom ? "Scroll to top of form" : "Scroll to bottom of form"}
                >
                  {isScrolledToBottom ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{isScrolledToBottom ? 'Scroll Up' : 'Scroll Down'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowRegisterModal(false)} 
                  className="btn btn-outline btn-sm"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleRegisterSubmit}>
              <div 
                className="modal-body"
                ref={registerModalBodyRef}
                onScroll={handleModalScroll}
                style={{ scrollBehavior: 'smooth' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="reg-donor-id" className="form-label">Donor ID <span className="required-star">*</span></label>
                    <input 
                      id="reg-donor-id"
                      type="text" 
                      className="form-input" 
                      value={formData.donor_id} 
                      onChange={(e) => setFormData({ ...formData, donor_id: e.target.value })} 
                      required 
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-donor-name" className="form-label">Full Name <span className="required-star">*</span></label>
                    <input 
                      id="reg-donor-name"
                      type="text" 
                      className="form-input" 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      placeholder="e.g. Ramesh Kumar" 
                      required 
                      aria-required="true"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="reg-organ-type" className="form-label">Organ Type <span className="required-star">*</span></label>
                    <select 
                      id="reg-organ-type"
                      className="form-select" 
                      value={formData.organ_type} 
                      onChange={(e) => setFormData({ ...formData, organ_type: e.target.value })}
                      required
                      aria-required="true"
                    >
                      <option value="Kidney">Kidney</option>
                      <option value="Liver">Liver</option>
                      <option value="Heart">Heart</option>
                      <option value="Lungs">Lungs</option>
                      <option value="Pancreas">Pancreas</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-blood-group" className="form-label">Blood Group <span className="required-star">*</span></label>
                    <select 
                      id="reg-blood-group"
                      className="form-select" 
                      value={formData.blood_group} 
                      onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                      required
                      aria-required="true"
                    >
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-gender" className="form-label">Gender <span className="required-star">*</span></label>
                    <select 
                      id="reg-gender"
                      className="form-select" 
                      value={formData.gender} 
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      required
                      aria-required="true"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="reg-age" className="form-label">Age (Years) <span className="required-star">*</span></label>
                    <input 
                      id="reg-age"
                      type="number" 
                      className="form-input" 
                      value={formData.age} 
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      required 
                      min="18" 
                      max="75" 
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-height" className="form-label">Height (cm) <span className="required-star">*</span></label>
                    <input
                      id="reg-height"
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={formData.height_cm}
                      onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                      required
                      min="30"
                      max="250"
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-weight" className="form-label">Weight (kg) <span className="required-star">*</span></label>
                    <input 
                      id="reg-weight"
                      type="number" 
                      step="0.5" 
                      className="form-input" 
                      value={formData.weight_kg} 
                      onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                      required
                      min="2"
                      max="400"
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-bmi" className="form-label">Calculated BMI</label>
                    <input 
                      id="reg-bmi"
                      type="number" 
                      step="0.1" 
                      className="form-input" 
                      value={calcBmi(Number(formData.height_cm), Number(formData.weight_kg)) ?? '-'}
                      readOnly 
                      style={{ backgroundColor: 'var(--bg-subtle)' }} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-hospital" className="form-label">Source Hospital Facility</label>
                  <select 
                    id="reg-hospital"
                    className="form-select" 
                    value={formData.hospital_id} 
                    onChange={(e) => setFormData({ ...formData, hospital_id: parseInt(e.target.value, 10) })}
                  >
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.city})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-notes" className="form-label">Medical Screening Notes</label>
                  <textarea 
                    id="reg-notes"
                    className="form-textarea" 
                    rows="2" 
                    value={formData.medical_notes} 
                    onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })} 
                    placeholder="Clinical observations, serology, hemodynamic stability..." 
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Do not enter personal identifiers.</small>
                </div>
                {ledgerOffline && (
                  <small style={{ color: 'var(--text-muted)' }}>
                    Ledger node is offline: a locally generated reference will be stored instead of an on-chain transaction.
                  </small>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleScrollToggle}
                  className="modal-scroll-btn"
                  title={isScrolledToBottom ? "Scroll to top of form" : "Scroll to bottom of form"}
                  aria-label={isScrolledToBottom ? "Scroll to top of form" : "Scroll to bottom of form"}
                >
                  {isScrolledToBottom ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{isScrolledToBottom ? 'Scroll to Top' : 'Scroll to Bottom'}</span>
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setShowRegisterModal(false)} className="btn btn-outline" disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-primary">
                    {submitting ? 'Registering...' : 'Register Donor'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Medical Clearance Approval */}
      {showApprovalModal && selectedDonor && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="approval-donor-title">
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="approval-donor-title" className="modal-title">Clinical Medical Clearance: {selectedDonor.donor_id}</h3>
              <button 
                type="button" 
                onClick={() => setShowApprovalModal(false)} 
                className="btn btn-outline btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ backgroundColor: '#FAFBFA', padding: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                <div><strong>Patient:</strong> {selectedDonor.name} ({selectedDonor.age} yrs, {selectedDonor.gender})</div>
                <div><strong>Organ & Blood Group:</strong> {selectedDonor.organ_type} • Blood {selectedDonor.blood_group} • BMI {selectedDonor.bmi?.toFixed(1)}</div>
              </div>

              <div className="form-group">
                <label htmlFor="eval-remarks" className="form-label">
                  Physician Evaluation Remarks <span className="required-star">*</span>
                </label>
                <textarea
                  id="eval-remarks"
                  className="form-textarea"
                  rows="3"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Record formal clinical clearance statement or reason for medical exclusion..."
                  aria-required="true"
                />
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button 
                type="button" 
                onClick={() => handleApprovalSubmit(false)} 
                disabled={submitting || !approvalNotes.trim()}
                className="btn btn-danger"
              >
                <XCircle size={15} aria-hidden="true" />
                <span>{submitting ? 'Processing...' : 'Reject Medical Clearance'}</span>
              </button>

              <button 
                type="button" 
                onClick={() => handleApprovalSubmit(true)} 
                disabled={submitting || !approvalNotes.trim()}
                className="btn btn-primary"
              >
                <CheckCircle size={15} aria-hidden="true" />
                <span>{submitting ? 'Approving...' : 'Approve & Clear Donor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
