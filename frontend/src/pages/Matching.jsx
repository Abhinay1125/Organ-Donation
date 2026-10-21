import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { canPerformAction } from '../authz';
import { RequestMessage } from '../components/RequestMessage';
import { getApiError } from '../apiErrors';
import { 
  GitMerge, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  Info, 
  AlertTriangle,
  Layers,
  FileCheck
} from 'lucide-react';

const FEATURE_LABELS = {
  mmDR: 'HLA-DR mismatches', mmB: 'HLA-B mismatches', mmA: 'HLA-A mismatches',
  cPRA: 'cPRA (sensitization)', dialysis: 'Dialysis duration',
  recipient_age: 'Recipient age', donor_age: 'Donor age',
  recipient: 'Recipient blood group', donor: 'Donor blood group', // confirm in ml/model.py
};
const featureLabel = (k) => FEATURE_LABELS[k] || k;
const fmtNum = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—');
const fmtPct = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(d)}%` : '—');
const LOW_SCORE_WARNING = 50; // UI warning threshold only, not a clinical criterion

const firstDefined = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k] !== undefined) return obj[k];
  return undefined;
};
const normalizeRuleScreening = (rs) => {
  const abo = firstDefined(rs, 'abo', 'abo_check');
  const organ = firstDefined(rs, 'organ_type', 'organ_check');
  const phys = firstDefined(rs, 'physiological', 'physio_check');
  return {
    abo: { ok: firstDefined(abo, 'compatible', 'passed'), detail: abo?.detail },
    organ: { ok: firstDefined(organ, 'compatible', 'passed'), detail: organ?.detail },
    phys: {
      ok: firstDefined(phys, 'age_compatible', 'age_ok', 'passed'),
      age: firstDefined(phys, 'age_difference', 'age_diff'),
      bmi: firstDefined(phys, 'bmi_difference', 'bmi_diff'),
    },
    messages: Array.isArray(rs?.explanations) ? rs.explanations : [],
  };
};
const checkState = (ok) => (ok === true ? 'pass' : ok === false ? 'fail' : 'note');
const CHECK_LABEL = { pass: 'Pass', fail: 'Fail', note: 'n/a' };
const messageState = (m) => (/^PASS/i.test(m) ? 'pass' : /^FAIL/i.test(m) ? 'fail' : 'note');

export const Matching = ({ setCurrentTab, setSelectedOrganId }) => {
  const { authFetch, user } = useAuth();
  const [organs, setOrgans] = useState([]);
  const [selectedOrgan, setSelectedOrgan] = useState(null);
  const [matchingData, setMatchingData] = useState(null);
  const [mlMetrics, setMlMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOrgans, setLoadingOrgans] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected candidate for detail review
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [ackRisk, setAckRisk] = useState(false);
  const [ledgerOffline, setLedgerOffline] = useState(false);

  // Explainability modal
  const [explainCandidate, setExplainCandidate] = useState(null);

  useEffect(() => {
    fetchAvailableOrgans();
    fetchMLMetrics();
    fetchLedgerStatus();
  }, []);

  const fetchLedgerStatus = async () => {
    try {
      const res = await authFetch('/api/blockchain/status');
      if (res.ok) setLedgerOffline((await res.json()).connected === false);
    } catch {
      // Ledger status is non-blocking for candidate evaluation.
    }
  };

  const fetchMLMetrics = async () => {
    try {
      const res = await authFetch('/api/ml/metrics');
      if (res.ok) {
        setMlMetrics(await res.json());
      }
    } catch {
      // Non-blocking for candidate evaluation
    }
  };

  const fetchAvailableOrgans = async () => {
    setLoadingOrgans(true);
    setError('');
    try {
      const res = await authFetch('/api/organs');
      if (!res.ok) throw new Error(await getApiError(res, 'organ records'));
      const data = (await res.json()).filter(organ => organ.status === 'MEDICALLY_APPROVED');
      setOrgans(data);
      if (data.length) {
        setSelectedOrgan(data[0]);
        fetchCandidateRankings(data[0].id);
      } else {
        setSelectedOrgan(null);
        setMatchingData(null);
        selectCandidate(null);
      }
    } catch (err) {
      setError(err.message || 'Unable to load organs for matching.');
    } finally {
      setLoadingOrgans(false);
    }
  };

  const fetchCandidateRankings = async (organId) => {
    setLoading(true);
    setError('');
    setMatchingData(null);
    try {
      const res = await authFetch(`/api/matching/candidates/${organId}`);
      if (!res.ok) throw new Error(await getApiError(res, 'matching candidates'));
      const data = await res.json();
      setMatchingData(data);
      if (data.ranked_candidates && data.ranked_candidates.length > 0) {
        selectCandidate(data.ranked_candidates[0]);
      } else {
        selectCandidate(null);
      }
    } catch (err) {
      setError(err.message || 'Unable to load matching candidates.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrganChange = (e) => {
    const id = parseInt(e.target.value, 10);
    const org = organs.find(o => o.id === id);
    setSelectedOrgan(org);
    setReviewNotes('');
    setReviewError('');
    setSuccess('');
    setAckRisk(false);
    if (org) {
      fetchCandidateRankings(org.id);
    }
  };

  const selectCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setReviewNotes('');
    setReviewError('');
    setAckRisk(false);
  };

  const handleReviewDecision = async (decision) => {
    if (!selectedOrgan || !selectedCandidate || submittingReview) return;
    
    // Validate notes length (min 10 characters as specified in reference)
    const trimmedNotes = reviewNotes.trim();
    if (trimmedNotes.length < 10) {
      setReviewError('Reviewer notes are required and must be at least 10 characters long to record clinical justification.');
      return;
    }

    const recipientId = selectedCandidate.id;
    if (!Number.isInteger(recipientId)) {
      setReviewError('The recipient database ID is unavailable. Please re-select the candidate row.');
      return;
    }

    setSubmittingReview(true);
    setReviewError('');
    setSuccess('');
    try {
      const res = await authFetch(`/api/matching/review/${selectedOrgan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: recipientId,
          decision: decision,
          notes: trimmedNotes
        })
      });
      if (!res.ok) {
        throw new Error(await getApiError(res, 'matching review'));
      }
      await res.json();
      setReviewNotes('');
      setReviewError('');
      setSuccess(`Match decision (${decision}) for candidate ${selectedCandidate.recipient_id} recorded successfully in audit log.`);
      await fetchAvailableOrgans();
    } catch (err) {
      setReviewError(err.message || 'Unable to record the matching decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const canReview = canPerformAction(user, 'matching') && selectedOrgan?.status === 'MEDICALLY_APPROVED';
  const riskNotes = [];
  if (selectedCandidate?.rule_passed === false) riskNotes.push('Rule screening failed for this candidate.');
  if (typeof selectedCandidate?.score === 'number' && selectedCandidate.score < LOW_SCORE_WARNING) {
    riskNotes.push(`Combined score is below ${LOW_SCORE_WARNING}%.`);
  }
  if (selectedOrgan && selectedOrgan.organ_type?.toLowerCase() !== 'kidney') {
    riskNotes.push('The model was trained on a synthetic kidney dataset; scores for other organs are not validated.');
  }
  if (ledgerOffline) {
    riskNotes.push('Ledger node is offline: a locally generated reference will be stored instead of an on-chain transaction.');
  }
  const m = mlMetrics?.metrics;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Matching Review</h1>
          <p className="page-subtitle">
            Candidates for {selectedOrgan ? `${selectedOrgan.organ_id} · ${selectedOrgan.organ_type}` : 'Selected Organ'}
            {matchingData?.donor ? ` · Donor Blood Group ${matchingData.donor.blood_group}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-subtle)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-primary-border)', fontSize: '0.8rem', fontWeight: 600 }}>
          <Layers size={15} aria-hidden="true" />
          <span>Decision Model: {matchingData?.model_version || mlMetrics?.model_version || 'RF-v1'}</span>
        </div>
      </div>

      <RequestMessage message={error} onRetry={fetchAvailableOrgans} />
      <RequestMessage type="success" message={success} />

      {/* Mandatory Decision Support Notice */}
      <div className="notice-banner">
        <AlertTriangle size={18} style={{ flexShrink: 0, color: 'var(--color-warning)', marginTop: '2px' }} aria-hidden="true" />
        <div>
          <strong>Clinical Decision Support Notice</strong>
          <span>
            ML predictions are decision-support outputs, not clinical decisions. The model was trained on synthetic data. Final decisions must be made by an authorized human reviewer in accordance with applicable clinical and allocation requirements.
          </span>
        </div>
      </div>

      {/* Organ Selector Card */}
      <div className="card" style={{ padding: '1.125rem 1.25rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <label htmlFor="matching-organ-select" className="form-label">
              Select Medically Approved Organ for Review:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select 
                id="matching-organ-select"
                className="form-select" 
                style={{ minWidth: '280px', width: 'auto' }}
                value={selectedOrgan?.id || ''}
                onChange={handleOrganChange}
                disabled={loadingOrgans}
              >
                {organs.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.organ_id} · {o.organ_type} ({o.status.replace(/_/g, ' ')})
                  </option>
                ))}
                {!organs.length && <option value="">No medically approved organs available for matching</option>}
              </select>

              {selectedOrgan && (
                <StatusBadge status={selectedOrgan.status} />
              )}
            </div>
          </div>

          {matchingData && matchingData.donor && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', backgroundColor: '#FAFBFA', padding: '0.625rem 1rem', borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)' }}>
              <div><strong>Donor ID:</strong> <span className="mono">{matchingData.donor.donor_id}</span></div>
              <div>Blood Group: <strong style={{ color: 'var(--color-primary)' }}>{matchingData.donor.blood_group}</strong> • Age: {matchingData.donor.age} yrs • BMI: {matchingData.donor.bmi?.toFixed(1)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Two-Column Matching Review Layout (Reference Prototype) */}
      <div className="matching-grid">
        {/* Left Column: Ranked Candidates + Rule Check Detail + Review Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Ranked Candidates Table */}
          <div className="card" style={{ padding: '0' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                  Ranked Candidates
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Select a row to inspect rule check details and record allocation decision
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {matchingData?.ranked_candidates?.length || 0} evaluated
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Evaluating candidates through Rule Screening and Random Forest index...
              </div>
            ) : !selectedOrgan ? (
              <p className="empty-state" style={{ padding: '2.5rem 1rem' }}>No medically approved organs available.</p>
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Recipient</th>
                      <th>Blood</th>
                      <th>Rule Check</th>
                      <th style={{ textAlign: 'right' }}>Model Score</th>
                      <th style={{ textAlign: 'right' }}>Waiting</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingData?.ranked_candidates?.map((c, idx) => {
                      const isSelected = selectedCandidate?.recipient_id === c.recipient_id;
                      return (
                        <tr 
                          key={c.recipient_id}
                          onClick={() => selectCandidate(c)}
                          className={isSelected ? 'selected-row' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              width: '22px', 
                              height: '22px', 
                              borderRadius: '50%', 
                              fontSize: '0.725rem', 
                              fontWeight: 700, 
                              backgroundColor: idx === 0 && c.rule_passed ? 'var(--color-primary)' : 'var(--color-border)',
                              color: idx === 0 && c.rule_passed ? '#FFFFFF' : 'var(--color-text)'
                            }}>
                              {idx + 1}
                            </span>
                          </td>
                          <td>
                            <div className="mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{c.recipient_id}</div>
                            <small style={{ color: 'var(--color-text-secondary)', fontSize: '0.725rem' }}>{c.hospital || c.hospital_name || 'Facility'}</small>
                          </td>
                          <td>
                            <strong>{c.blood_group}</strong>
                          </td>
                          <td>
                            {c.rule_passed ? (
                              <span style={{ color: 'var(--color-status-green-text)', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <CheckCircle size={13} aria-hidden="true" />
                                <span>Pass</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-status-red-text)', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <XCircle size={13} aria-hidden="true" />
                                <span>Incompatible</span>
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {c.score}%
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {c.waiting_days}d
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExplainCandidate(c);
                              }}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.725rem' }}
                              title="View Feature Importance and Attribution"
                            >
                              <Info size={12} aria-hidden="true" />
                              <span>Explain</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {matchingData?.ranked_candidates?.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                          No eligible recipients found matching the requested organ type.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-foot">
              <span>Showing {matchingData?.ranked_candidates?.length || 0} candidate records</span>
              <span>Layer 1: Rule Screening + Layer 2: Random Forest</span>
            </div>
          </div>

          {/* Rule Check Detail Panel (Reference Prototype) */}
          {selectedCandidate && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                  Rule Check Detail
                </h3>
                <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                  {selectedCandidate.recipient_id}
                </span>
              </div>

              {(() => {
              const rs = normalizeRuleScreening(selectedCandidate.analysis?.rule_screening);
              const rows = [
                { key: 'abo', state: checkState(rs.abo.ok), title: 'ABO Compatibility',
                  body: `Donor ${matchingData?.donor?.blood_group} → Recipient ${selectedCandidate.blood_group}${rs.abo.detail ? ` · ${rs.abo.detail}` : ''}` },
                { key: 'organ', state: checkState(rs.organ.ok), title: 'Organ Type', body: rs.organ.detail || '—' },
                { key: 'phys', state: checkState(rs.phys.ok), title: 'Physiological Constraints',
                  body: `Age difference: ${fmtNum(rs.phys.age)} yrs (≤ 35 yrs permissible) • BMI difference: ${fmtNum(rs.phys.bmi)} kg/m²` },
              ];
              return (
                <>
                  <ul className="chk-list">
                    {rows.map(r => (
                      <li key={r.key} className="chk-item">
                        <span className={`chk-badge ${r.state}`}>{CHECK_LABEL[r.state]}</span>
                        <div><strong>{r.title}:</strong> {r.body}</div>
                      </li>
                    ))}
                  </ul>
                  {rs.messages.length > 0 && (
                    <details style={{ marginTop: '0.75rem' }}>
                      <summary style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Rule engine messages ({rs.messages.length})</summary>
                      <ul className="chk-list">
                        {rs.messages.map((m, i) => (
                          <li key={i} className="chk-item">
                            <span className={`chk-badge ${messageState(m)}`}>{CHECK_LABEL[messageState(m)]}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              );
            })()}
            </div>
          )}

          {/* Authorized Reviewer Action Form (Reference Prototype) */}
          {selectedCandidate && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                  Authorized Reviewer Decision
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0' }}>
                  Record clinical allocation notes (at least 10 characters required) before recording approval
                </p>
              </div>

              {reviewError && (
                <div style={{ padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-status-red-bg)', color: 'var(--color-status-red-text)', border: '1px solid var(--color-status-red-border)', borderRadius: 'var(--radius-btn)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                  {reviewError}
                </div>
              )}

              <form onSubmit={(e) => e.preventDefault()}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label htmlFor="reviewer-notes" className="form-label" style={{ fontWeight: 600 }}>
                    Clinical Reviewer Notes:
                  </label>
                  <textarea
                    id="reviewer-notes"
                    className="form-textarea"
                    rows={3}
                    placeholder="Enter clinical rationale, cross-match verification, and surgical readiness notes..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    disabled={!canReview || submittingReview}
                  />
                  <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Required: minimum 10 characters. Entered: {reviewNotes.trim().length} chars.
                  </div>
                </div>

                {riskNotes.length > 0 && (
                  <div className="notice-banner" role="alert" style={{ marginBottom: '0.875rem' }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0, color: 'var(--color-warning)' }} aria-hidden="true" />
                    <div>
                      <strong>Review before approving</strong>
                      <ul style={{ margin: '0.25rem 0 0.5rem 1rem' }}>
                        {riskNotes.map(n => <li key={n}>{n}</li>)}
                      </ul>
                      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <input type="checkbox" checked={ackRisk} onChange={e => setAckRisk(e.target.checked)} />
                        I have reviewed these points and take responsibility for this decision.
                      </label>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleReviewDecision('Approved')}
                    className="btn btn-primary"
                    disabled={!canReview || submittingReview || reviewNotes.trim().length < 10 || (riskNotes.length > 0 && !ackRisk)}
                  >
                    <FileCheck size={15} aria-hidden="true" />
                    <span>{submittingReview ? 'Recording...' : `Approve Match for ${selectedCandidate.recipient_id}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewDecision('Rejected')}
                    className="btn btn-danger"
                    disabled={!canReview || submittingReview || reviewNotes.trim().length < 10}
                  >
                    <XCircle size={15} aria-hidden="true" />
                    <span>Reject</span>
                  </button>

                  {!canReview && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {user?.operational_role !== 'ORGAN_MATCHING_ORGANIZER' 
                        ? 'Allocation decision requires Matching Reviewer credentials.' 
                        : 'Organ must be in MEDICALLY_APPROVED status.'}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Model Evaluation Panel & Confusion Matrix (Reference Prototype) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Model Evaluation
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                From saved metrics ({mlMetrics?.model_version || 'RF-v1'}) · synthetic validation cohort
              </span>
            </div>

            <dl className="kv">
              <dt>Dataset records</dt>
              <dd>{mlMetrics?.dataset_records?.toLocaleString() ?? '—'}</dd>
              <dt>Train / test samples</dt>
              <dd>{mlMetrics?.train_samples ?? '—'} / {mlMetrics?.test_samples ?? '—'}</dd>
              <dt>Accuracy</dt>
              <dd>{fmtPct(m?.accuracy, 2)}</dd>
              <dt>Precision</dt>
              <dd>{fmtPct(m?.precision, 2)}</dd>
              <dt>Recall</dt>
              <dd>{fmtPct(m?.recall, 2)}</dd>
              <dt>F1 Score</dt>
              <dd>{fmtPct(m?.f1_score, 2)}</dd>
            </dl>

            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', margin: '1.25rem 0 0.5rem' }}>
              Confusion Matrix (Test Set)
            </h3>
            
            <div className="cm">
              <div className="h"></div>
              <div className="h">Predicted no</div>
              <div className="h">Predicted yes</div>
              
              <div className="h">Actual no</div>
              <div className="g">{m?.tn ?? '—'}</div>
              <div className="b">{m?.fp ?? '—'}</div>
              
              <div className="h">Actual yes</div>
              <div className="b">{m?.fn ?? '—'}</div>
              <div className="g">{m?.tp ?? '—'}</div>
            </div>

            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', margin: '1.25rem 0 0.5rem' }}>
              Top Feature Importances (Random Forest)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {Object.keys(mlMetrics?.feature_importance || {}).length === 0 && (
                <p className="empty-state">Feature importance unavailable.</p>
              )}
              {Object.entries(mlMetrics?.feature_importance || {}).slice(0, 6).map(([feat, val]) => (
                <div key={feat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{featureLabel(feat)}</span>
                    <span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}%</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, val * 1.5)}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Model Explainability Breakdown */}
      {explainCandidate && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="explain-modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="explain-modal-title" className="modal-title">
                Compatibility Breakdown: {matchingData?.donor?.donor_id} → {explainCandidate.recipient_id}
              </h3>
              <button 
                type="button" 
                onClick={() => setExplainCandidate(null)} 
                className="btn btn-outline btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Score Summary Box */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFBFA', padding: '1rem', borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Combined Decision Support Index
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                    {explainCandidate.score}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                    Recommendation: {explainCandidate.analysis?.recommendation || 'Evaluated'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Model Probability</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                    {explainCandidate.analysis?.rf_probability != null ? fmtPct(explainCandidate.analysis.rf_probability * 100) : '—'}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
                    Version: {explainCandidate.analysis?.model_version || 'RF-v1'}
                  </div>
                </div>
              </div>

              {/* Layer 1 Rule Screening Explanations */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                  Layer 1: Deterministic Rule-Based Screening
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
                  {explainCandidate.analysis?.rule_screening?.explanations?.map((exp, i) => {
                    const isPassed = exp.startsWith('PASSED');
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          padding: '0.4rem 0.65rem', 
                          borderRadius: 'var(--radius-sm)', 
                          backgroundColor: isPassed ? 'var(--color-status-green-bg)' : 'var(--color-status-red-bg)', 
                          border: `1px solid ${isPassed ? 'var(--color-status-green-border)' : 'var(--color-status-red-border)'}`, 
                          color: isPassed ? 'var(--color-status-green-text)' : 'var(--color-status-red-text)' 
                        }}
                      >
                        {exp}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Layer 2 Random Forest Feature Attribution */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                  Layer 2: Feature Importance Weights (Random Forest Gini Impurity)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(explainCandidate.analysis?.feature_importance || {}).slice(0, 6).map(([feat, val]) => (
                    <div key={feat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{featureLabel(feat)}</span>
                        <span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}% weight</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, val * 2.5)}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setExplainCandidate(null)} 
                className="btn btn-outline"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
