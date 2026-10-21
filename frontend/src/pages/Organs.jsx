import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { RequestMessage } from '../components/RequestMessage';
import { getApiError } from '../apiErrors';
import { Activity, ArrowRight, Search, Filter } from 'lucide-react';

export const Organs = ({ setSelectedOrganId, setCurrentTab }) => {
  const { authFetch } = useAuth();
  const [organs, setOrgans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrgans();
  }, []);

  const fetchOrgans = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/organs');
      if (!res.ok) throw new Error(await getApiError(res, 'organ records'));
      setOrgans(await res.json());
    } catch (err) {
      setError(err.message || 'Unable to load organ records.');
    } finally {
      setLoading(false);
    }
  };

  const organTypes = ['ALL', ...Array.from(new Set(organs.map(o => o.organ_type).filter(Boolean)))];
  const statusOptions = ['ALL', ...new Set(organs.map(o => o.status))];

  const filtered = organs.filter(o => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      o.organ_id.toLowerCase().includes(search) ||
      o.organ_type.toLowerCase().includes(search) ||
      o.status.toLowerCase().includes(search) ||
      o.donor_ref?.toLowerCase().includes(search) ||
      o.matched_recipient_ref?.toLowerCase().includes(search);
    const matchesType = typeFilter === 'ALL' || o.organ_type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organ Inventory & Allocation Tracking</h1>
          <p className="page-subtitle">Multi-facility lifecycle surveillance from procurement through graft transplantation</p>
        </div>
      </div>

      <RequestMessage message={error} onRetry={fetchOrgans} />

      {/* Filter and Search Controls */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: '300px', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} aria-hidden="true" />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px' }}
            placeholder="Search by ID, organ type, state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {organTypes.length > 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label htmlFor="filter-organ-type" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Type:</label>
            <select
              id="filter-organ-type"
              className="form-select"
              style={{ width: 'auto', minWidth: '130px' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {organTypes.map(t => (
                <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <label htmlFor="filter-organ-status" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status:</label>
          <select
            id="filter-organ-status"
            className="form-select"
            style={{ width: 'auto', minWidth: '150px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : status.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Organ ID</th>
              <th>Organ Type</th>
              <th>Donor Ref</th>
              <th>Current Stage</th>
              <th>Matched Candidate</th>
              <th>Score</th>
              <th>Ledger Ref.</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading organ records…
                </td>
              </tr>
            )}
            {filtered.map((org) => (
              <tr key={org.id}>
                <td className="id">
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{org.organ_id}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 500 }}>{org.organ_type}</span>
                </td>
                <td>
                  <span className="mono">{org.donor_ref ?? '—'}</span>
                </td>
                <td>
                  <StatusBadge status={org.status} />
                </td>
                <td>
                  {org.matched_recipient_ref ? (
                    <span className="mono">{org.matched_recipient_ref}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Unassigned</span>
                  )}
                </td>
                <td>
                  {org.matched_score != null ? (
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--color-status-green-text)' }}>{Number(org.matched_score).toFixed(1)}%</span>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>
                  {org.blockchain_tx ? (
                    <span className="mono" style={{ fontSize: '0.725rem', color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-subtle)', padding: '0.15rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                      {org.blockchain_tx.slice(0, 14)}...
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => {
                      setSelectedOrganId(org.id);
                      setCurrentTab('organ-detail');
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    <span>View Journey</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && !error && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No organ records matching your query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot" style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderBottomLeftRadius: 'var(--radius-card)', borderBottomRightRadius: 'var(--radius-card)' }}>
        <span>Showing {filtered.length} of {organs.length} organ records</span>
        <span style={{ color: 'var(--color-text-muted)' }}>Ledger references are stored by the application; not verified against the chain here.</span>
      </div>
    </div>
  );
};
