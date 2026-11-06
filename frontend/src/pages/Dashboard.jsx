import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { RequestMessage } from '../components/RequestMessage';
import { OrganJourneyTracker } from '../components/OrganJourneyTracker';
import { getApiError } from '../apiErrors';
import { canAccessTab, dutyLabel } from '../authz';
import { formatDateTime } from '../utils/dates';
import { 
  HeartHandshake, 
  Users, 
  Activity, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  Cpu,
  Layers,
  FileText,
  Info
} from 'lucide-react';

export const Dashboard = ({ setCurrentTab, setSelectedOrganId, openOrgan }) => {
  const { authFetch, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [stats, setStats] = useState(null);
  const [organs, setOrgans] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workData, setWorkData] = useState({ donors: [], recipients: [], hospitals: [] });

  // Organ journey overview selection
  const [selectedJourneyOrganId, setSelectedJourneyOrganId] = useState(null);
  const [journeyDetail, setJourneyDetail] = useState(null);
  const [loadingJourney, setLoadingJourney] = useState(false);

  // Organ journey table filtering on Dashboard
  const [journeySearch, setJourneySearch] = useState('');
  const [journeyStatusFilter, setJourneyStatusFilter] = useState('');

  const filteredDashboardOrgans = useMemo(() => {
    return organs.filter(o => {
      const q = journeySearch.toLowerCase().trim();
      const matchQ = !q || o.organ_id?.toLowerCase().includes(q) || o.organ_type?.toLowerCase().includes(q);
      const matchStatus = !journeyStatusFilter || o.status === journeyStatusFilter;
      return matchQ && matchStatus;
    });
  }, [organs, journeySearch, journeyStatusFilter]);
  const ledgerConnected = stats?.blockchain?.status?.connected === true;

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoints = [['organs', '/api/organs']];
      if (isAdmin) {
        endpoints.push(
          ['transactions', '/api/blockchain/transactions'], ['stats', '/api/admin/stats'],
          ['donors', '/api/donors'], ['recipients', '/api/recipients'],
        );
      } else {
        endpoints.push(['hospitals', '/api/hospitals']);
        if (user.operational_role === 'PROCUREMENT_ORGANIZER' || user.operational_role === 'PATIENT_DOCTOR') {
          endpoints.push(['donors', '/api/donors']);
        }
        if (user.operational_role === 'PATIENT_DOCTOR') {
          endpoints.push(['recipients', '/api/recipients']);
        }
      }

      const responses = await Promise.all(endpoints.map(async ([key, url]) => {
        const response = await authFetch(url);
        if (!response.ok) throw new Error(await getApiError(response, key));
        return [key, await response.json()];
      }));
      const data = Object.fromEntries(responses);
      const organList = data.organs || [];
      setOrgans(organList);

      if (organList.length > 0 && !selectedJourneyOrganId) {
        setSelectedJourneyOrganId(organList[0].id);
        fetchJourneyDetail(organList[0].id);
      }

      if (isAdmin) {
        setStats(data.stats);
        setRecentTx(data.transactions?.transactions || []);
        setWorkData({ donors: data.donors || [], recipients: data.recipients || [], hospitals: [] });
      } else {
        setWorkData({
          donors: data.donors || [],
          recipients: data.recipients || [],
          hospitals: data.hospitals || [],
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const fetchJourneyDetail = async (organId) => {
    if (!organId) return;
    setLoadingJourney(true);
    try {
      const res = await authFetch(`/api/organs/${organId}`);
      if (res.ok) {
        const detail = await res.json();
        setJourneyDetail(detail);
      }
    } catch {
      // Non-blocking for the dashboard
    } finally {
      setLoadingJourney(false);
    }
  };

  const handleOrganSelectChange = (e) => {
    const id = parseInt(e.target.value, 10);
    setSelectedJourneyOrganId(id);
    fetchJourneyDetail(id);
  };

  const handleNavigateDetail = (organId) => {
    if (openOrgan) {
      openOrgan(organId);
    } else {
      setSelectedOrganId?.(organId);
      setCurrentTab('organ-detail');
    }
  };

  if (loading) {
    return (
      <div className="page-container" role="status" aria-live="polite">
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading dashboard metrics and active workflows...
        </div>
      </div>
    );
  }

  if (error && !stats && organs.length === 0) {
    return (
      <div className="page-container">
        <h1 className="page-title">{isAdmin ? 'Clinical Operations Dashboard' : 'Your work area'}</h1>
        <RequestMessage message={error} onRetry={fetchDashboardData} />
      </div>
    );
  }

  // Hospital staff dashboard
  if (!isAdmin) {
    const duty = user?.operational_role;
    const hospital = workData.hospitals.find(item => item.id === user?.hospital_id);
    const pendingDonors = workData.donors.filter(item => item.status === 'PENDING_APPROVAL');
    const waitingRecipients = workData.recipients.filter(item => item.status === 'WAITING');
    const queue = duty === 'PROCUREMENT_ORGANIZER'
      ? [{
          title: 'Donors Registered',
          tab: 'donors',
          records: workData.donors,
          label: item => item.donor_id,
          summary: `${workData.donors.length} registered donors at facility`,
        }, {
          title: 'Awaiting Medical Approval',
          tab: 'donors',
          records: pendingDonors,
          label: item => item.donor_id,
          summary: `${pendingDonors.length} awaiting physician evaluation`,
        }]
      : duty === 'PATIENT_DOCTOR'
        ? [{
            title: 'Donors Awaiting Medical Review',
            tab: 'donors',
            records: pendingDonors,
            label: item => item.donor_id,
            summary: `${pendingDonors.length} pending clinical clearance`,
          }, {
            title: 'Recipients on Waitlist',
            tab: 'recipients',
            records: waitingRecipients,
            label: item => `${item.recipient_id} · ${item.required_organ}`,
            summary: `${waitingRecipients.length} actively waiting for compatible match`,
          }]
        : duty === 'ORGAN_MATCHING_ORGANIZER'
          ? [{
              title: 'Medically Approved Organs',
              tab: 'organs',
              records: organs.filter(item => item.status === 'MEDICALLY_APPROVED'),
              label: item => `${item.organ_id} · ${item.organ_type}`,
              summary: `${organs.filter(item => item.status === 'MEDICALLY_APPROVED').length} ready for compatibility evaluation`,
            }]
          : duty === 'DONOR_SURGEON'
            ? [{
                title: 'Organs Awaiting Donor Surgery',
                tab: 'organs',
                records: organs.filter(item => ['MATCHED', 'READY_FOR_RETRIEVAL', 'RETRIEVED'].includes(item.status)),
                label: item => `${item.organ_id} · ${item.status.replace(/_/g, ' ')}`,
                summary: `${organs.filter(item => ['MATCHED', 'READY_FOR_RETRIEVAL', 'RETRIEVED'].includes(item.status)).length} in surgical procurement workflow`,
              }]
            : duty === 'TRANSPORTER'
              ? [{
                  title: 'Organ Logistics Queue',
                  tab: 'organs',
                  records: organs.filter(item => ['PACKAGED', 'DISPATCHED', 'IN_TRANSIT'].includes(item.status)),
                  label: item => `${item.organ_id} · ${item.status.replace(/_/g, ' ')}`,
                  summary: `${organs.filter(item => ['PACKAGED', 'DISPATCHED', 'IN_TRANSIT'].includes(item.status)).length} in transport custody`,
                }]
              : [{
                  title: 'Destination Center Inflow',
                  tab: 'organs',
                  records: organs.filter(item => ['DELIVERED', 'IN_TRANSIT', 'RECEIVED'].includes(item.status)),
                  label: item => `${item.organ_id} · ${item.status.replace(/_/g, ' ')}`,
                  summary: `${organs.filter(item => ['DELIVERED', 'IN_TRANSIT', 'RECEIVED'].includes(item.status)).length} arriving or awaiting implantation`,
                }];

    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Clinical Work Area</h1>
            <p className="page-subtitle">
              {user.full_name || user.username} · {dutyLabel(duty)}
              {' · '}{hospital?.name || 'Assigned Hospital Facility'}
            </p>
          </div>
          {canAccessTab(user.role, 'matching', user.operational_role) && (
            <button onClick={() => setCurrentTab('matching')} className="btn btn-primary">
              <Cpu size={15} aria-hidden="true" />
              <span>Open Compatibility Matching</span>
            </button>
          )}
        </div>

        <RequestMessage message={error} onRetry={fetchDashboardData} />

        <section aria-labelledby="work-queue-heading">
          <h2 id="work-queue-heading" className="page-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
            Operational Queue
          </h2>
          <div className="card-grid">
            {queue.map(panel => (
              <section className="card" key={panel.title}>
                <div className="card-title">{panel.title}</div>
                <p className="card-value">{panel.records.length}</p>
                <p className="card-subtext">{panel.summary}</p>
                {panel.records.length ? (
                  <ul className="queue-list">
                    {panel.records.slice(0, 5).map(item => (
                      <li key={item.id}>
                        <span>{panel.label(item)}</span>
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={() => {
                            if (panel.tab === 'organs') {
                              if (openOrgan) {
                                openOrgan(item.id);
                              } else {
                                setSelectedOrganId?.(item.id);
                                setCurrentTab('organ-detail');
                              }
                            } else {
                              setCurrentTab(panel.tab);
                            }
                          }}
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="empty-state">No items currently requiring action.</p>}
              </section>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Admin Dashboard View
  const countBy = (items, field, value) => items.filter(i => i[field] === value).length;
  const donorsPending = countBy(workData.donors, 'status', 'PENDING_APPROVAL');
  const donorsApproved = countBy(workData.donors, 'status', 'APPROVED');
  const donorsDonated = countBy(workData.donors, 'status', 'DONATED');
  const recWaiting = countBy(workData.recipients, 'status', 'WAITING');
  const recMatched = countBy(workData.recipients, 'status', 'MATCHED');
  const recTransplanted = countBy(workData.recipients, 'status', 'TRANSPLANTED');
  const activeOrgans = organs.filter(o => o.status !== 'TRANSPLANTED');
  const awaitingMatch = countBy(organs, 'status', 'MEDICALLY_APPROVED');
  const matchedOrgans = countBy(organs, 'status', 'MATCHED');
  const inProgress = activeOrgans.length - awaitingMatch - matchedOrgans;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Clinical Dashboard</h1>
          <p className="page-subtitle">
            Surveillance of organ allocation, decision support pipeline, and recorded audit events
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canAccessTab(user.role, 'matching', user.operational_role) && (
            <button onClick={() => setCurrentTab('matching')} className="btn btn-primary">
              <Cpu size={15} aria-hidden="true" />
              <span>Launch Decision Matching</span>
            </button>
          )}
          <button onClick={() => setCurrentTab('blockchain')} className="btn btn-outline">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Audit Trail & Ledger</span>
          </button>
        </div>
      </div>

      <RequestMessage message={error} onRetry={fetchDashboardData} />

      {/* Operational Pipeline Architecture Banner */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-md)', 
        padding: '0.875rem 1.25rem', 
        marginBottom: '1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Layers size={18} color="var(--color-primary)" aria-hidden="true" />
          <span>
            <strong style={{ color: 'var(--text-main)' }}>Decision Support Pipeline:</strong> Donor Registry → Rule Screening → Random Forest Prediction ({stats?.ml?.model_version || 'RF-v1'}) → Human Clinical Authorization → Audit Log with Transaction Reference
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-primary)', fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ledgerConnected ? 'var(--color-primary)' : 'var(--color-warning)' }} aria-hidden="true" />
          <span style={{ color: ledgerConnected ? 'var(--color-primary)' : 'var(--color-warning)' }}>
            {stats?.blockchain?.status?.mode || 'Audit Logging Active'}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="card">
          <div className="card-title">
            <span>Donors Registered</span>
            <HeartHandshake size={18} color="var(--color-primary)" aria-hidden="true" />
          </div>
          <div className="card-value">{workData.donors.length}</div>
          <div className="card-subtext">
            {donorsApproved} cleared • {donorsDonated} donated • {donorsPending} pending
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>Waiting Recipients</span>
            <Users size={18} color="var(--color-primary)" aria-hidden="true" />
          </div>
          <div className="card-value">{recWaiting}</div>
          <div className="card-subtext">
            {workData.recipients.length} registered • {recMatched} matched • {recTransplanted} transplanted
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>Active Organ Journeys</span>
            <Activity size={18} color="var(--color-primary)" aria-hidden="true" />
          </div>
          <div className="card-value">{activeOrgans.length}</div>
          <div className="card-subtext">
            {awaitingMatch} awaiting match • {matchedOrgans} matched • {inProgress} in retrieval / logistics
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>Completed Transplants</span>
            <CheckCircle2 size={18} color="var(--color-status-green-text)" aria-hidden="true" />
          </div>
          <div className="card-value" style={{ color: 'var(--color-status-green-text)' }}>
            {countBy(organs, 'status', 'TRANSPLANTED')}
          </div>
          <div className="card-subtext">
            Organs with a recorded Transplanted stage
          </div>
        </div>
      </div>

      {/* Organ Journey Overview Section */}
      <section aria-labelledby="journey-overview-heading" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 id="journey-overview-heading" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Organ Journey Overview
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Inspect recorded stage progression for any tracked organ from procurement to graft implantation
            </p>
          </div>

          {organs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="organ-journey-select" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Select Organ:
              </label>
              <select
                id="organ-journey-select"
                className="form-select"
                style={{ width: 'auto', minWidth: '220px' }}
                value={selectedJourneyOrganId || ''}
                onChange={handleOrganSelectChange}
              >
                {organs.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.organ_id} · {o.organ_type} ({o.status.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {journeyDetail && journeyDetail.organ ? (
          <OrganJourneyTracker
            organ={journeyDetail.organ}
            movements={journeyDetail.movements || []}
            sourceHospital={journeyDetail.source_hospital}
            destinationHospital={journeyDetail.destination_hospital}
            compact={true}
            onNavigateDetail={handleNavigateDetail}
          />
        ) : loadingJourney ? (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Loading organ journey...
          </div>
        ) : (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No organs currently registered for tracking.
          </div>
        )}
      </section>

      {/* Main Operational Tables Grid (Reference Dashboard) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Active Organ Movements Table with Search & Status Filters */}
        <div className="card table-card" style={{ padding: '0' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Organ Journeys
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Track the current stage and destination of each organ
              </span>
            </div>
            <div className="table-tools">
              <input 
                type="text" 
                placeholder="Filter by ID or organ..." 
                value={journeySearch}
                onChange={(e) => setJourneySearch(e.target.value)}
                aria-label="Filter organ journeys" 
                style={{ width: '160px' }}
              />
              <select 
                value={journeyStatusFilter}
                onChange={(e) => setJourneyStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="MEDICALLY_APPROVED">Medically approved</option>
                <option value="MATCHED">Matched</option>
                <option value="READY_FOR_RETRIEVAL">Ready for retrieval</option>
                <option value="RETRIEVED">Retrieved</option>
                <option value="PACKAGED">Packaged</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="IN_TRANSIT">In transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="RECEIVED">Received</option>
                <option value="TRANSPLANTED">Transplanted</option>
              </select>
            </div>
          </div>

          <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
            <table>
              <thead>
                <tr>
                  <th>Organ ID</th>
                  <th>Organ</th>
                  <th>Current Stage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDashboardOrgans.slice(0, 6).map((org) => (
                  <tr key={org.id}>
                    <td className="id">
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{org.organ_id}</span>
                    </td>
                    <td>{org.organ_type}</td>
                    <td>
                      <StatusBadge status={org.status} />
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          if (openOrgan) {
                            openOrgan(org.id);
                          } else {
                            setSelectedOrganId?.(org.id);
                            setCurrentTab('organ-detail');
                          }
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        Track Timeline
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDashboardOrgans.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                      No organ journeys match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>Showing {Math.min(filteredDashboardOrgans.length, 6)} of {organs.length} records</span>
            <button 
              onClick={() => setCurrentTab('organs')} 
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              <span>View all organs</span>
              <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Recent Application Audit Events */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Recent Activity
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Latest recorded workflow and audit events
              </span>
            </div>
            <button 
              onClick={() => setCurrentTab('audit')} 
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              <span>View audit →</span>
            </button>
          </div>

          <div className="activity">
            {recentTx.slice(0, 5).map((t, idx) => (
              <div key={idx} className="activity-item">
                <div className="activity-mark">
                  <Activity size={15} aria-hidden="true" />
                </div>
                <div className="activity-text">
                  <b>{t.action.replace(/_/g, ' ')}</b>
                  <p>
                    {t.actor} ({dutyLabel(t.role)}) · <span className="mono">{t.blockchain_tx ? `${t.blockchain_tx.slice(0, 16)}...` : 'Audit Log'}</span>
                  </p>
                </div>
                <time>{formatDateTime(t.timestamp)}</time>
              </div>
            ))}
            {recentTx.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem', fontSize: '0.8125rem' }}>
                No recent application audit events recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision-Support Notice Banner */}
      <div className="notice-banner">
        <Info size={18} style={{ flexShrink: 0, color: 'var(--color-warning)', marginTop: '2px' }} aria-hidden="true" />
        <div>
          <strong>Decision-support notice</strong>
          <span>
            Matching and ML scores are decision-support outputs only. Final decisions remain with an authorized human reviewer. This system records workflow events with ledger references stored by the application; they are not verified against the chain on this page.
          </span>
        </div>
      </div>
    </div>
  );
};
