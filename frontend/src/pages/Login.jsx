import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, AlertCircle, ShieldCheck } from 'lucide-react';

export const Login = () => {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--color-bg)', 
      padding: '1.5rem' 
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '44px', 
            height: '44px', 
            borderRadius: 'var(--radius-md)', 
            backgroundColor: 'var(--color-primary)', 
            color: '#FFFFFF', 
            marginBottom: '0.875rem' 
          }}>
            <Activity size={24} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Organ Donation & Transplantation
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Clinical Operations & Decision Support Management System
          </p>
        </div>

        {/* Login Box */}
        <div className="card" style={{ padding: '1.75rem', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
            Authorized Personnel Portal
          </h2>

          {error && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              backgroundColor: 'var(--color-status-red-bg)', 
              border: '1px solid var(--color-status-red-border)', 
              color: 'var(--color-status-red-text)', 
              padding: '0.65rem 0.85rem', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.8125rem', 
              marginBottom: '1rem' 
            }} role="alert">
              <AlertCircle size={16} aria-hidden="true" flexShrink={0} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-username" className="form-label">
                Username <span className="required-star">*</span>
              </label>
              <input
                id="login-username"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter account username"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">
                Password <span className="required-star">*</span>
              </label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.625rem', fontSize: '0.875rem' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Secure Clinical Protocol • Authorized Hospital & Administrator Access Only
        </div>
      </div>
    </div>
  );
};
