import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../apiErrors';
import { RequestMessage } from '../components/RequestMessage';
import { dutyLabel } from '../authz';
import { 
  Shield, 
  ShieldCheck, 
  Key, 
  Hash, 
  Clock, 
  User, 
  FileCode,
  Layers,
  Copy,
  Check,
  Info
} from 'lucide-react';

export const BlockchainAudit = ({ mode = 'blockchain' }) => {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedTx, setCopiedTx] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLedger();
  }, [mode]);

  const fetchLedger = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const isAudit = mode === 'audit';
      const res = await authFetch(isAudit ? '/api/audit?limit=100' : '/api/blockchain/transactions');
      if (!res.ok) throw new Error(await getApiError(res, isAudit ? 'audit records' : 'blockchain transactions'));
      const result = await res.json();
      setData(isAudit
        ? {
            status: null,
            transactions: result.map(log => ({
              ...log,
              actor: log.actor_username,
              role: log.actor_role,
            })),
          }
        : result);
    } catch (err) {
      setError(err.message || 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(text);
    setTimeout(() => setCopiedTx(''), 2500);
  };

  if (loading) {
    return (
      <div className="page-container" role="status" aria-live="polite">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading application audit records...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-container">
        <RequestMessage message={error} onRetry={fetchLedger} />
      </div>
    );
  }

  const status = data?.status || {};
  const transactions = data?.transactions || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{mode === 'audit' ? 'System Audit Log' : 'Workflow Ledger & Audit Trail'}</h1>
          <p className="page-subtitle">
            {mode === 'audit'
              ? 'Administrative application audit log tracking system actions, user sessions, and database events.'
              : 'Application audit records containing ledger transaction references and operational contract bindings.'}
          </p>
        </div>

        {mode !== 'audit' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.45rem', 
            color: status.connected ? 'var(--color-status-green-text)' : 'var(--color-status-amber-text)', 
            backgroundColor: status.connected ? 'var(--color-status-green-bg)' : 'var(--color-status-amber-bg)', 
            padding: '0.35rem 0.75rem', 
            borderRadius: 'var(--radius-sm)', 
            border: `1px solid ${status.connected ? 'var(--color-status-green-border)' : 'var(--color-status-amber-border)'}`, 
            fontSize: '0.8rem', 
            fontWeight: 500 
          }}>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Node Connectivity: {status.connected ? 'Connected' : 'Offline'}</span>
          </div>
        )}
      </div>

      <RequestMessage message={error} onRetry={fetchLedger} />

      {/* Contract & Roles Grid */}
      {mode !== 'audit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Smart Contracts Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <FileCode size={18} color="var(--color-primary)" aria-hidden="true" />
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Deployed Smart Contract Bindings (Solidity)
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#FAFBFA', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>OrganDonation Contract</span>
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-status-green-text)', fontWeight: 600 }}>Active</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Waiting list, medical approval, donor registration, match authorization</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '0.35rem', wordBreak: 'break-all' }}>
                  {status.organ_donation_address || '0x5FbDB2315678afecb367f032d93F642f64180aa3'}
                </div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#FAFBFA', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>OrganTransplantation Contract</span>
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-status-green-text)', fontWeight: 600 }}>Active</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Organ retrieval, packaging, dispatch, delivery, center receipt, graft transplantation</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '0.35rem', wordBreak: 'break-all' }}>
                  {status.organ_transplantation_address || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'}
                </div>
              </div>
            </div>
          </div>

          {/* Operational Roles Mapping Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Key size={18} color="var(--color-primary)" aria-hidden="true" />
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Authorized Cryptographic Identities & Operational Duties
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
              {Object.entries(status.roles || {
                patientDoctor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                procurementOrganizer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
                organMatchingOrganizer: '0x7c852118294e51e653712a81e05800f419141751',
                donorSurgeon: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
                transporter: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
                transplantSurgeon: '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
              }).map(([rName, rAddr]) => (
                <div key={rName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{dutyLabel(rName)}</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {rAddr.slice(0, 10)}...{rAddr.slice(-8)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Stream Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {mode === 'audit' ? 'Database Audit Records' : 'Application Audit Log with Transaction References'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {mode === 'audit'
                ? 'Records loaded from the server application audit log table.'
                : 'Transaction hashes represent recorded references generated during workflow operations.'}
            </p>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Recorded Entries: <strong>{transactions.length}</strong>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Action / Event</th>
                <th>Actor</th>
                <th>Operational Duty</th>
                <th>Resource Ref</th>
                <th>Transaction Reference</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {tx.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{tx.actor}</td>
                  <td>
                    <span style={{ fontSize: '0.725rem', backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                      {dutyLabel(tx.role)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem' }}>
                      <strong>{tx.resource_type}:</strong> {tx.resource_id}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.725rem', color: 'var(--color-primary)', backgroundColor: '#FAFBFA', border: '1px solid var(--border-color)', padding: '0.15rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                        {tx.blockchain_tx ? `${tx.blockchain_tx.slice(0, 16)}...` : '0x...'}
                      </span>
                      {tx.blockchain_tx && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tx.blockchain_tx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', padding: '2px' }}
                          title="Copy Full Transaction Hash"
                          aria-label="Copy transaction hash"
                        >
                          {copiedTx === tx.blockchain_tx ? (
                            <Check size={13} color="var(--color-primary)" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                    {tx.details || '—'}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                    No audit records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
