import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { canPerformAction } from '../authz';
import { RequestMessage } from '../components/RequestMessage';
import { getApiError } from '../apiErrors';
import { Users, Plus, Search } from 'lucide-react';

export const Recipients = () => {
  const { authFetch, user } = useAuth();
  const [recipients, setRecipients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [organFilter, setOrganFilter] = useState('ALL');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    recipient_id: '',
    name: '',
    age: 40,
    gender: 'FEMALE',
    blood_group: 'O+',
    required_organ: 'Kidney',
    height_cm: 165.0,
    weight_kg: 62.0,
    bmi: 22.8,
    hospital_id: user?.hospital_id || '',
    cpra: 0.0,
    dialysis_months: 12.0,
    urgency_tier: 'STANDARD'
  });

  useEffect(() => {
    fetchRecipients();
    if (canPerformAction(user, 'registerRecipient')) fetchHospitals();
  }, [user]);

  const fetchRecipients = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/recipients');
      if (!res.ok) throw new Error(await getApiError(res, 'recipient records'));
      setRecipients(await res.json());
    } catch (err) {
      setError(err.message || 'Unable to load recipient records.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await authFetch('/api/recipients', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        throw new Error(await getApiError(res, 'recipient registration'));
      }
      setShowModal(false);
      setFormData({
        recipient_id: '',
        name: '',
        age: 40,
        gender: 'FEMALE',
        blood_group: 'O+',
        required_organ: 'Kidney',
        height_cm: 165.0,
        weight_kg: 62.0,
        bmi: 22.8,
        hospital_id: user?.hospital_id || '',
        cpra: 0.0,
        dialysis_months: 12.0,
        urgency_tier: 'STANDARD'
      });
      setSuccess('Patient enrolled on transplant waiting list successfully.');
      await fetchRecipients();
    } catch (err) {
      setError(err.message || 'Unable to register recipient.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = recipients.filter(r => {
    const matchesSearch = r.recipient_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrgan = organFilter === 'ALL' || r.required_organ.toLowerCase() === organFilter.toLowerCase();
    return matchesSearch && matchesOrgan;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organ Recipient Waiting Registry</h1>
          <p className="page-subtitle">Waiting list management, immunological sensitization metrics, and clinical prioritization</p>
        </div>

        {canPerformAction(user, 'registerRecipient') && (
          <button 
            onClick={() => {
              const nextId = `REC-${200 + recipients.length + 1}`;
              setFormData(prev => ({ ...prev, recipient_id: nextId, hospital_id: user?.hospital_id || '' }));
              setShowModal(true);
            }} 
            className="btn btn-primary"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add Patient to Waiting List</span>
          </button>
        )}
      </div>

      <RequestMessage
        message={error}
        onRetry={() => {
          fetchRecipients();
          if (canPerformAction(user, 'registerRecipient')) fetchHospitals();
        }}
      />
      <RequestMessage type="success" message={success} />

      {/* Filter Row */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: '300px', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} aria-hidden="true" />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px' }}
            placeholder="Search by ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <label htmlFor="filter-rec-organ" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Organ:</label>
          <select 
            id="filter-rec-organ"
            className="form-select" 
            style={{ width: 'auto', minWidth: '140px' }}
            value={organFilter}
            onChange={(e) => setOrganFilter(e.target.value)}
          >
            <option value="ALL">All Organs</option>
            <option value="Kidney">Kidney</option>
            <option value="Liver">Liver</option>
            <option value="Heart">Heart</option>
            <option value="Lungs">Lungs</option>
            <option value="Pancreas">Pancreas</option>
          </select>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Recipient Reference</th>
              <th>Required Organ</th>
              <th>Urgency Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading recipient records…
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="id">
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{r.recipient_id}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 500 }}>{r.required_organ}</span>
                </td>
                <td>
                  <span style={{ 
                    fontSize: '0.725rem', 
                    fontWeight: 600, 
                    color: r.urgency_tier === 'URGENT' ? 'var(--color-status-red-text)' : 'var(--color-primary)',
                    backgroundColor: r.urgency_tier === 'URGENT' ? 'var(--color-status-red-bg)' : 'var(--color-primary-subtle)',
                    border: `1px solid ${r.urgency_tier === 'URGENT' ? 'var(--color-status-red-border)' : 'var(--color-primary-border)'}`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    {r.urgency_tier}
                  </span>
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && !error && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No recipient records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot" style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderBottomLeftRadius: 'var(--radius-card)', borderBottomRightRadius: 'var(--radius-card)' }}>
        <span>Showing {filtered.length} of {recipients.length} wait-list records</span>
        <span style={{ color: 'var(--color-text-muted)' }}>Hospital transplantation registry</span>
      </div>

      {/* Modal: Add Recipient */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-recipient-title">
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="add-recipient-title" className="modal-title">Enroll Recipient on Transplant Waiting List</h3>
              <button 
                type="button"
                onClick={() => setShowModal(false)} 
                className="btn btn-outline btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="rec-id" className="form-label">Recipient ID <span className="required-star">*</span></label>
                    <input 
                      id="rec-id"
                      type="text" 
                      className="form-input" 
                      value={formData.recipient_id} 
                      onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rec-name" className="form-label">Patient Full Name <span className="required-star">*</span></label>
                    <input 
                      id="rec-name"
                      type="text" 
                      className="form-input" 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      placeholder="e.g. Priya Sharma" 
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="rec-organ" className="form-label">Required Organ <span className="required-star">*</span></label>
                    <select 
                      id="rec-organ"
                      className="form-select" 
                      value={formData.required_organ} 
                      onChange={(e) => setFormData({ ...formData, required_organ: e.target.value })}
                    >
                      <option value="Kidney">Kidney</option>
                      <option value="Liver">Liver</option>
                      <option value="Heart">Heart</option>
                      <option value="Lungs">Lungs</option>
                      <option value="Pancreas">Pancreas</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="rec-bg" className="form-label">Blood Group <span className="required-star">*</span></label>
                    <select 
                      id="rec-bg"
                      className="form-select" 
                      value={formData.blood_group} 
                      onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
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
                    <label htmlFor="rec-urgency" className="form-label">Urgency Tier <span className="required-star">*</span></label>
                    <select 
                      id="rec-urgency"
                      className="form-select" 
                      value={formData.urgency_tier} 
                      onChange={(e) => setFormData({ ...formData, urgency_tier: e.target.value })}
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="URGENT">Urgent Priority</option>
                      <option value="ELECTIVE">Elective</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="rec-age" className="form-label">Age (Years) <span className="required-star">*</span></label>
                    <input 
                      id="rec-age"
                      type="number" 
                      className="form-input" 
                      value={formData.age} 
                      onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value, 10) || 0 })} 
                      required 
                      min="18" 
                      max="75" 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rec-height" className="form-label">Height (cm)</label>
                    <input 
                      id="rec-height"
                      type="number" 
                      className="form-input" 
                      value={formData.height_cm} 
                      onChange={(e) => {
                        const h = parseFloat(e.target.value) || 165;
                        const w = formData.weight_kg || 60;
                        const calcBmi = parseFloat((w / ((h / 100) * (h / 100))).toFixed(1));
                        setFormData({ ...formData, height_cm: h, bmi: calcBmi });
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rec-bmi" className="form-label">Calculated BMI</label>
                    <input 
                      id="rec-bmi"
                      type="number" 
                      step="0.1" 
                      className="form-input" 
                      value={formData.bmi} 
                      readOnly 
                      style={{ backgroundColor: 'var(--bg-subtle)' }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="rec-dialysis" className="form-label">Dialysis Duration (Months)</label>
                    <input 
                      id="rec-dialysis"
                      type="number" 
                      step="1" 
                      className="form-input" 
                      value={formData.dialysis_months} 
                      onChange={(e) => setFormData({ ...formData, dialysis_months: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rec-cpra" className="form-label">Sensitization / cPRA (%)</label>
                    <input 
                      id="rec-cpra"
                      type="number" 
                      step="1" 
                      className="form-input" 
                      min="0" 
                      max="100" 
                      value={formData.cpra} 
                      onChange={(e) => setFormData({ ...formData, cpra: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="rec-hospital" className="form-label">Managing Hospital</label>
                  <select 
                    id="rec-hospital"
                    className="form-select" 
                    value={formData.hospital_id} 
                    onChange={(e) => setFormData({ ...formData, hospital_id: parseInt(e.target.value, 10) })}
                  >
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.city})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Enrolling Patient...' : 'Enroll Patient on Waiting List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
