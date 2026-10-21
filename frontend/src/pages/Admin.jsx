import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../apiErrors';
import { RequestMessage } from '../components/RequestMessage';
import { dutyLabel } from '../authz';
import {
  Users, Building2, ShieldCheck, Activity, CheckCircle,
  AlertTriangle, Plus, RefreshCw, Key, Database, Cpu,
  Search, Filter, Edit2, UserX, UserCheck, Copy, Check,
  Clock, Shield, Layers, Hash, Phone, MapPin, Mail,
  FileText, ExternalLink, X, Info
} from 'lucide-react';

export function Admin() {
  const { authFetch } = useAuth();

  // Primary datasets
  const [usersList, setUsersList] = useState([]);
  const [hospitalsList, setHospitalsList] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs: 'users', 'hospitals', 'audit', 'system'
  const [activeTab, setActiveTab] = useState('users');

  // Copy feedback
  const [copiedItem, setCopiedItem] = useState('');

  // Messages
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Filter & Search States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userOpRoleFilter, setUserOpRoleFilter] = useState('');
  const [userHospitalFilter, setUserHospitalFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  const [hospitalSearch, setHospitalSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // New User Form State
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'HOSPITAL',
    operational_role: '',
    hospital_id: '',
    eth_address: ''
  });

  // Edit User Form State
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    role: 'HOSPITAL',
    operational_role: '',
    hospital_id: '',
    eth_address: '',
    is_active: true
  });

  // New Hospital Form State
  const [newHospital, setNewHospital] = useState({
    code: '',
    name: '',
    city: '',
    state: '',
    address: '',
    contact_phone: ''
  });

  const [submittingUser, setSubmittingUser] = useState(false);
  const [submittingHospital, setSubmittingHospital] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);

  // Fetch all administrative telemetry and data
  const fetchAdminData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');
    try {
      const endpoints = [
        ['users', '/api/admin/users'],
        ['hospitals', '/api/hospitals'],
        ['stats', '/api/admin/stats'],
        ['audit', '/api/audit?limit=100']
      ];

      const responses = await Promise.all(endpoints.map(async ([key, url]) => {
        const response = await authFetch(url);
        if (!response.ok) {
          throw new Error(await getApiError(response, `${key} records`));
        }
        return [key, await response.json()];
      }));

      const data = Object.fromEntries(responses);
      setUsersList(data.users || []);
      setHospitalsList(data.hospitals || []);
      setHealthStatus(data.stats || null);
      setAuditLogs(data.audit || []);

      if (data.hospitals?.length && !newUser.hospital_id) {
        setNewUser(prev => ({ ...prev, hospital_id: String(data.hospitals[0].id) }));
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setErrorMsg(err.message || 'Failed to load administrative records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(''), 2500);
  };

  // Create User Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFeedbackMsg('');
    setErrorMsg('');
    try {
      setSubmittingUser(true);
      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUser,
          role: newUser.role,
          operational_role: newUser.operational_role || null,
          hospital_id: newUser.role === 'HOSPITAL' ? Number(newUser.hospital_id) : (newUser.hospital_id ? Number(newUser.hospital_id) : null),
          eth_address: newUser.eth_address.trim() || null
        })
      });

      if (!res.ok) {
        throw new Error(await getApiError(res, 'user account creation'));
      }

      const created = await res.json();
      setFeedbackMsg(`User ${created.username} created successfully.`);
      setShowCreateUserModal(false);
      setNewUser({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'HOSPITAL',
        operational_role: '',
        hospital_id: hospitalsList[0]?.id ? String(hospitalsList[0].id) : '',
        eth_address: ''
      });
      fetchAdminData(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingUser(false);
    }
  };

  // Open Edit User Modal
  const openEditUser = (user) => {
    setEditingUser(user);
    setEditFormData({
      full_name: user.full_name || '',
      role: user.role || 'HOSPITAL',
      operational_role: user.operational_role || '',
      hospital_id: user.hospital_id ? String(user.hospital_id) : '',
      eth_address: user.eth_address || '',
      is_active: user.is_active ?? true
    });
    setShowEditUserModal(true);
  };

  // Submit Edit User
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setFeedbackMsg('');
    setErrorMsg('');
    try {
      setUpdatingUser(true);
      const payload = {
        full_name: editFormData.full_name.trim(),
        role: editFormData.role,
        operational_role: editFormData.operational_role || null,
        hospital_id: editFormData.role === 'HOSPITAL'
          ? Number(editFormData.hospital_id)
          : (editFormData.hospital_id ? Number(editFormData.hospital_id) : null),
        eth_address: editFormData.eth_address.trim() || null,
        is_active: Boolean(editFormData.is_active)
      };

      const res = await authFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(await getApiError(res, 'user account update'));
      }

      setFeedbackMsg(`User @${editingUser.username} updated successfully.`);
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchAdminData(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUpdatingUser(false);
    }
  };

  // Quick Toggle User Active/Inactive
  const handleToggleUserStatus = async (user) => {
    const nextStatus = !user.is_active;
    const confirmMsg = nextStatus
      ? `Reactivate access for @${user.username}?`
      : `Deactivate account for @${user.username}? They will not be able to log in.`;

    if (!window.confirm(confirmMsg)) return;

    setFeedbackMsg('');
    setErrorMsg('');
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextStatus })
      });

      if (!res.ok) {
        throw new Error(await getApiError(res, 'user status update'));
      }

      setFeedbackMsg(`Account @${user.username} is now ${nextStatus ? 'ACTIVE' : 'DEACTIVATED'}.`);
      fetchAdminData(true);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Create Hospital Handler
  const handleCreateHospital = async (e) => {
    e.preventDefault();
    setFeedbackMsg('');
    setErrorMsg('');
    try {
      setSubmittingHospital(true);
      const res = await authFetch('/api/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newHospital.code.trim().toUpperCase(),
          name: newHospital.name.trim(),
          city: newHospital.city.trim(),
          state: newHospital.state.trim(),
          address: newHospital.address.trim() || null,
          contact_phone: newHospital.contact_phone.trim() || null
        })
      });

      if (!res.ok) {
        throw new Error(await getApiError(res, 'hospital creation'));
      }

      setFeedbackMsg(`Healthcare facility ${newHospital.name} registered.`);
      setShowHospitalModal(false);
      setNewHospital({
        code: '',
        name: '',
        city: '',
        state: '',
        address: '',
        contact_phone: ''
      });
      fetchAdminData(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingHospital(false);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const q = userSearch.toLowerCase();
      const matchesSearch = !q ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.eth_address && u.eth_address.toLowerCase().includes(q));

      const matchesRole = !userRoleFilter || u.role === userRoleFilter;
      const matchesOpRole = !userOpRoleFilter || u.operational_role === userOpRoleFilter;
      const matchesHospital = !userHospitalFilter || String(u.hospital_id) === String(userHospitalFilter);
      const matchesStatus = !userStatusFilter || (
        userStatusFilter === 'active' ? u.is_active : !u.is_active
      );

      return matchesSearch && matchesRole && matchesOpRole && matchesHospital && matchesStatus;
    });
  }, [usersList, userSearch, userRoleFilter, userOpRoleFilter, userHospitalFilter, userStatusFilter]);

  // Filtered Hospitals List
  const filteredHospitals = useMemo(() => {
    return hospitalsList.filter(h => {
      const q = hospitalSearch.toLowerCase();
      return !q ||
        (h.name && h.name.toLowerCase().includes(q)) ||
        (h.code && h.code.toLowerCase().includes(q)) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.state && h.state.toLowerCase().includes(q)) ||
        (h.contact_phone && h.contact_phone.toLowerCase().includes(q));
    });
  }, [hospitalsList, hospitalSearch]);

  // Filtered Audit Logs List
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const q = auditSearch.toLowerCase();
      const matchesSearch = !q ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.actor_username && log.actor_username.toLowerCase().includes(q)) ||
        (log.resource_type && log.resource_type.toLowerCase().includes(q)) ||
        (log.resource_id && String(log.resource_id).toLowerCase().includes(q)) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.blockchain_tx && log.blockchain_tx.toLowerCase().includes(q));

      const matchesAction = !auditActionFilter || (
        log.action && log.action.includes(auditActionFilter)
      );

      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  // Count users per hospital
  const userCountByHospital = useMemo(() => {
    const map = {};
    usersList.forEach(u => {
      if (u.hospital_id) {
        map[u.hospital_id] = (map[u.hospital_id] || 0) + 1;
      }
    });
    return map;
  }, [usersList]);

  // Calculate high-level metrics
  const activeUsersCount = usersList.filter(u => u.is_active).length;
  const adminUsersCount = usersList.filter(u => u.role === 'ADMIN').length;
  const hospitalStaffCount = usersList.filter(u => u.role === 'HOSPITAL').length;

  if (loading) {
    return (
      <div className="page-container">
        <h1 className="page-title">Platform Administration</h1>
        <RequestMessage type="info" message="Loading administrative records…" />
      </div>
    );
  }

  if (errorMsg && !usersList.length && !hospitalsList.length && !healthStatus) {
    return (
      <div className="page-container">
        <h1 className="page-title">Platform Administration</h1>
        <RequestMessage message={errorMsg} onRetry={() => fetchAdminData(true)} />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="badge badge-indigo" style={{ marginBottom: '0.4rem' }}>
            SYSTEM GOVERNANCE & ACCESS CONTROL
          </div>
          <h1 className="page-title">Platform Administration</h1>
          <p className="page-subtitle">
            Centralized governance of institutional participants, RBAC credentials, audit history, and ledger node telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchAdminData(true)}
            disabled={refreshing}
            className="btn btn-outline"
            title="Refresh administrative data and statistics"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh Telemetry'}</span>
          </button>

          <button
            onClick={() => setShowCreateUserModal(true)}
            className="btn btn-primary"
          >
            <Plus size={15} />
            <span>New User</span>
          </button>

          <button
            onClick={() => setShowHospitalModal(true)}
            className="btn btn-outline"
          >
            <Building2 size={15} />
            <span>Register Hospital</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          color: '#166534',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#991b1b',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* High-Level Enterprise KPI Overview */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-content">
            <div className="card-title" title="Authorized Personnel">Authorized Personnel</div>
            <div className="card-value">{usersList.length}</div>
            <div className="card-subtext" title={`${activeUsersCount} active · ${usersList.length - activeUsersCount} suspended`}>
              <span style={{ color: '#166534', fontWeight: 600 }}>{activeUsersCount} active</span> · {usersList.length - activeUsersCount} suspended
            </div>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
            <Users size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-content">
            <div className="card-title" title="Healthcare Centers">Healthcare Centers</div>
            <div className="card-value">{hospitalsList.length}</div>
            <div className="card-subtext" title={`${hospitalStaffCount} clinical staff affiliated`}>
              {hospitalStaffCount} clinical staff affiliated
            </div>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: '#faf5ff', color: '#7e22ce' }}>
            <Building2 size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-content">
            <div className="card-title" title="Donors & Recipients">Donors & Recipients</div>
            <div className="card-value">
              {(healthStatus?.donors?.total || 0) + (healthStatus?.recipients?.total || 0)}
            </div>
            <div className="card-subtext" title={`${healthStatus?.donors?.approved || 0} donors approved · ${healthStatus?.recipients?.waiting || 0} waiting`}>
              {healthStatus?.donors?.approved || 0} donors approved · {healthStatus?.recipients?.waiting || 0} waiting
            </div>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
            <ShieldCheck size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-content">
            <div className="card-title" title="Ledger & Audit Events">Ledger & Audit Events</div>
            <div className="card-value">
              {healthStatus?.blockchain?.recorded_transactions || auditLogs.length}
            </div>
            <div className="card-subtext" title={`Chain ID: ${healthStatus?.blockchain?.status?.chain_id ?? '31337'} · ${healthStatus?.blockchain?.status?.connected ? 'Online' : 'Standby'}`}>
              Chain ID: {healthStatus?.blockchain?.status?.chain_id ?? '31337'} · {healthStatus?.blockchain?.status?.connected ? 'Online' : 'Standby'}
            </div>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: '#eef2ff', color: '#4338ca' }}>
            <Shield size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-content">
            <div className="card-title" title="AI Decision Engine">AI Decision Engine</div>
            <div className="card-value" style={{ fontSize: '1.35rem' }}>
              {healthStatus?.ml?.is_ready ? 'Operational' : 'Initializing'}
            </div>
            <div className="card-subtext" title={`Model: ${healthStatus?.ml?.model_version || 'Random Forest v1'}`}>
              Model: {healthStatus?.ml?.model_version || 'Random Forest v1'}
            </div>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
            <Cpu size={20} />
          </div>
        </div>
      </div>

      {/* Admin Tabs Navigation */}
      <div className="admin-tabs-nav">
        <button
          onClick={() => setActiveTab('users')}
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>User Personnel & RBAC</span>
          <span className="tab-counter">{usersList.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('hospitals')}
          className={`admin-tab-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
        >
          <Building2 size={16} />
          <span>Member Hospitals</span>
          <span className="tab-counter">{hospitalsList.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
        >
          <FileText size={16} />
          <span>Governance & Audit Trail</span>
          <span className="tab-counter">{auditLogs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`admin-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
        >
          <Activity size={16} />
          <span>Infrastructure & Ledger Telemetry</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: USERS & RBAC
          ========================================================================= */}
      {activeTab === 'users' && (
        <div>
          {/* User Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <div className="search-input-wrapper">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search by name, @username, email, or eth address…"
                  className="form-input"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
              >
                <option value="">All Account Roles</option>
                <option value="ADMIN">System Administrator</option>
                <option value="HOSPITAL">Hospital Personnel</option>
                <option value="DONOR">Donor</option>
                <option value="RECIPIENT">Recipient</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={userOpRoleFilter}
                onChange={e => setUserOpRoleFilter(e.target.value)}
              >
                <option value="">All Operational Roles</option>
                <option value="ORGAN_MATCHING_ORGANIZER">{dutyLabel('ORGAN_MATCHING_ORGANIZER')}</option>
                <option value="DONOR_SURGEON">{dutyLabel('DONOR_SURGEON')}</option>
                <option value="TRANSPORTER">{dutyLabel('TRANSPORTER')}</option>
                <option value="TRANSPLANT_SURGEON">{dutyLabel('TRANSPLANT_SURGEON')}</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={userHospitalFilter}
                onChange={e => setUserHospitalFilter(e.target.value)}
              >
                <option value="">All Affiliated Hospitals</option>
                {hospitalsList.map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                ))}
              </select>

              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated Only</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {(userSearch || userRoleFilter || userOpRoleFilter || userHospitalFilter || userStatusFilter) && (
                <button
                  onClick={() => {
                    setUserSearch('');
                    setUserRoleFilter('');
                    setUserOpRoleFilter('');
                    setUserHospitalFilter('');
                    setUserStatusFilter('');
                  }}
                  className="btn btn-outline btn-sm"
                >
                  Reset Filters
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{filteredUsers.length}</strong> of {usersList.length} users
              </span>
            </div>
          </div>

          {/* Users Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Identity / Username</th>
                  <th>Contact Email</th>
                  <th>RBAC & Operational Role</th>
                  <th>Institution Affiliation</th>
                  <th>Ledger Key (ETH Address)</th>
                  <th>Account Status</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                      <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600 }}>No authorized users matched the criteria</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Try clearing filters or adding a new user.</div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const hosp = hospitalsList.find(h => h.id === u.hospital_id);
                    const initials = (u.full_name || u.username || 'U')
                      .split(' ')
                      .map(n => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div className="avatar-circle">
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.full_name || u.username}</div>
                              <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b' }}>@{u.username}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155', fontSize: '0.8rem' }}>
                            <Mail size={13} color="#94a3b8" />
                            <span>{u.email}</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                            <span className={`badge ${u.role === 'ADMIN' ? 'badge-rose' :
                                u.role === 'HOSPITAL' ? 'badge-blue' :
                                  u.role === 'DONOR' ? 'badge-emerald' :
                                    'badge-amber'
                              }`}>
                              {dutyLabel(u.role)}
                            </span>
                            {u.operational_role && (
                              <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>
                                {dutyLabel(u.operational_role)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          {hosp ? (
                            <div>
                              <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8rem' }}>{hosp.name}</div>
                              <span className="badge badge-neutral" style={{ fontSize: '0.68rem', fontFamily: 'monospace' }}>
                                {hosp.code}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                              National System Oversight
                            </span>
                          )}
                        </td>

                        <td>
                          {u.eth_address ? (
                            <div
                              className="eth-address-pill"
                              onClick={() => handleCopy(u.eth_address, `eth-${u.id}`)}
                              title="Click to copy full Ethereum Address"
                            >
                              <span>{u.eth_address.slice(0, 6)}…{u.eth_address.slice(-4)}</span>
                              {copiedItem === `eth-${u.id}` ? <Check size={12} color="#166534" /> : <Copy size={12} />}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>

                        <td>
                          {u.is_active ? (
                            <span className="badge badge-success">
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-error">
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                              Suspended
                            </span>
                          )}
                        </td>

                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'System Seed'}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => openEditUser(u)}
                              className="action-btn"
                              title="Edit user details and roles"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`action-btn ${u.is_active ? 'danger' : 'success'}`}
                              title={u.is_active ? 'Deactivate user access' : 'Reactivate user'}
                            >
                              {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MEMBER HOSPITALS
          ========================================================================= */}
      {activeTab === 'hospitals' && (
        <div>
          {/* Hospital Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <div className="search-input-wrapper">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search by facility name, code, city, state, or phone…"
                  className="form-input"
                  value={hospitalSearch}
                  onChange={e => setHospitalSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {hospitalSearch && (
                <button onClick={() => setHospitalSearch('')} className="btn btn-outline btn-sm">
                  Clear
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{filteredHospitals.length}</strong> of {hospitalsList.length} institutions
              </span>
            </div>
          </div>

          {/* Hospitals Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Facility Name & Code</th>
                  <th>Location & Physical Address</th>
                  <th>City & State</th>
                  <th>Contact Phone</th>
                  <th>Affiliated Personnel</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHospitals.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                      <Building2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600 }}>No participating hospitals found</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Register a new hospital using the button above.</div>
                    </td>
                  </tr>
                ) : (
                  filteredHospitals.map((h) => {
                    const personnelCount = userCountByHospital[h.id] || 0;
                    return (
                      <tr key={h.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{h.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                            <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                              {h.code}
                            </span>
                            <button
                              onClick={() => handleCopy(h.code, `code-${h.id}`)}
                              className="action-btn"
                              style={{ width: '20px', height: '20px' }}
                              title="Copy hospital code"
                            >
                              {copiedItem === `code-${h.id}` ? <Check size={10} color="#166534" /> : <Copy size={10} />}
                            </button>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.8rem', color: '#334155' }}>
                            <MapPin size={13} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                            <span>{h.address || 'Address not listed'}</span>
                          </div>
                        </td>

                        <td style={{ fontSize: '0.8rem', color: '#334155' }}>
                          <strong>{h.city}</strong>, {h.state}
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#334155', fontFamily: 'monospace' }}>
                            <Phone size={13} color="#94a3b8" />
                            <span>{h.contact_phone || '—'}</span>
                          </div>
                        </td>

                        <td>
                          <span className="badge badge-info">
                            <Users size={12} />
                            {personnelCount} staff registered
                          </span>
                        </td>

                        <td>
                          <span className="badge badge-success">
                            <CheckCircle size={12} /> Active Node
                          </span>
                        </td>

                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : 'System Seed'}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setUserHospitalFilter(String(h.id));
                              setActiveTab('users');
                            }}
                            className="btn btn-outline btn-sm"
                            title="Filter users belonging to this facility"
                          >
                            <span>View Personnel</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: GOVERNANCE & AUDIT TRAIL
          ========================================================================= */}
      {activeTab === 'audit' && (
        <div>
          {/* Audit Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <div className="search-input-wrapper">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search actions, actor username, resource ID, or tx hash…"
                  className="form-input"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={auditActionFilter}
                onChange={e => setAuditActionFilter(e.target.value)}
              >
                <option value="">All Action Types</option>
                <option value="USER">User Account Events</option>
                <option value="HOSPITAL">Hospital Events</option>
                <option value="ORGAN">Organ Registry Events</option>
                <option value="MATCH">AI Match Events</option>
                <option value="DONOR">Donor Events</option>
                <option value="RECIPIENT">Recipient Events</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {(auditSearch || auditActionFilter) && (
                <button
                  onClick={() => {
                    setAuditSearch('');
                    setAuditActionFilter('');
                  }}
                  className="btn btn-outline btn-sm"
                >
                  Reset
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{filteredAuditLogs.length}</strong> of {auditLogs.length} recent audit records
              </span>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action Event</th>
                  <th>Actor / Role</th>
                  <th>Resource Target</th>
                  <th>Operational Details</th>
                  <th>Blockchain TX Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                      <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600 }}>No audit trail records matched</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>All administrative and clinical activities are cryptographically recorded here.</div>
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={12} color="#94a3b8" />
                          <span>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${log.action.includes('USER') ? 'badge-rose' :
                            log.action.includes('HOSPITAL') ? 'badge-blue' :
                              log.action.includes('MATCH') ? 'badge-purple' :
                                log.action.includes('ORGAN') ? 'badge-emerald' :
                                  'badge-neutral'
                          }`}>
                          {log.action}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }}>
                          @{log.actor_username || 'system'}
                        </div>
                        {log.actor_role && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {dutyLabel(log.actor_role)}
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 500, color: '#334155' }}>{log.resource_type}</span>
                          {log.resource_id && (
                            <span style={{ fontFamily: 'monospace', color: '#64748b', marginLeft: '0.35rem' }}>
                              #{log.resource_id}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: '#334155', maxWidth: '300px' }}>
                        {log.details || '—'}
                      </td>

                      <td>
                        {log.blockchain_tx ? (
                          <div
                            className="eth-address-pill"
                            onClick={() => handleCopy(log.blockchain_tx, `tx-${log.id}`)}
                            title="Click to copy Transaction Hash"
                          >
                            <Hash size={11} />
                            <span>{log.blockchain_tx.slice(0, 8)}…{log.blockchain_tx.slice(-6)}</span>
                            {copiedItem === `tx-${log.id}` ? <Check size={11} color="#166534" /> : <Copy size={11} />}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Database Only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: INFRASTRUCTURE & LEDGER TELEMETRY
          ========================================================================= */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Status Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* Relational DB */}
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                <Database size={16} color="#059669" />
                <span>RELATIONAL STORE & ORM STATE</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Operational & Synchronized
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                SQLite / SQLAlchemy persistence engine active. Multi-table foreign keys and transaction isolation enabled.
              </div>
            </div>

            {/* Blockchain Node */}
            <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                <ShieldCheck size={16} color="#4f46e5" />
                <span>PERMISSIONED ETHEREUM LEDGER</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {healthStatus?.blockchain?.status?.connected ? 'Online (Hardhat EVM)' : 'Standby / Local Node'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                RPC: {healthStatus?.blockchain?.status?.rpc_url || 'http://127.0.0.1:8545'} · Chain ID: {healthStatus?.blockchain?.status?.chain_id ?? '31337'}
              </div>
            </div>

            {/* ML Decision Support */}
            <div className="card" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                <Cpu size={16} color="#0284c7" />
                <span>AI MATCH SCREENING ENGINE</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {healthStatus?.ml?.is_ready ? `${healthStatus.ml.model_version || 'Random Forest v1'} Ready` : 'Offline / Mock'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                Multi-factorial clinical scoring pipeline with blood type rule pre-screening and HLA matching.
              </div>
            </div>
          </div>

          {/* Smart Contract Deployments */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#0369a1" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                  Smart Contract Deployments (Solidity on EVM)
                </h3>
              </div>
              {healthStatus?.blockchain?.status?.organ_donation_address && healthStatus?.blockchain?.status?.organ_transplantation_address ? (
                <span className="badge badge-neutral">
                  Contract addresses configured
                </span>
              ) : (
                <span className="badge badge-neutral">
                  Addresses not configured
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                    OrganDonation.sol
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Allocation & Registration</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Governs donor registry verification, recipient waiting list entry, and matching decision records.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#0369a1', backgroundColor: '#ffffff', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, wordBreak: 'break-all' }}>
                    {healthStatus?.blockchain?.status?.organ_donation_address || '0x5FbDB2315678afecb367f032d93F642f64180aa3'}
                  </div>
                  <button
                    onClick={() => handleCopy(healthStatus?.blockchain?.status?.organ_donation_address || '0x5FbDB2315678afecb367f032d93F642f64180aa3', 'contract-don')}
                    className="btn btn-outline btn-sm"
                  >
                    {copiedItem === 'contract-don' ? <Check size={13} color="#166534" /> : <Copy size={13} />}
                    <span>{copiedItem === 'contract-don' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                    OrganTransplantation.sol
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Custody & Chain of Custody</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Enforces verifiable organ retrieval, transit dispatch, hospital receiving confirmation, and surgical completion.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#0369a1', backgroundColor: '#ffffff', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, wordBreak: 'break-all' }}>
                    {healthStatus?.blockchain?.status?.organ_transplantation_address || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'}
                  </div>
                  <button
                    onClick={() => handleCopy(healthStatus?.blockchain?.status?.organ_transplantation_address || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', 'contract-tx')}
                    className="btn btn-outline btn-sm"
                  >
                    {copiedItem === 'contract-tx' ? <Check size={13} color="#166534" /> : <Copy size={13} />}
                    <span>{copiedItem === 'contract-tx' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Security & System Architecture Overview */}
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
              Security Architecture & Regulatory Protocol
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.8rem', color: '#334155' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Non-Repudiation</div>
                <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  Each lifecycle action creates an audit entry with a transaction reference.
                </p>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Role-Based Access Control (RBAC)</div>
                <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  JWT token authentication with cryptographically hashed passwords and strict role gates (ADMIN, HOSPITAL, DONOR, RECIPIENT).
                </p>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Dual Verification Flow</div>
                <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  AI recommendations must be reviewed and explicitly authorized by licensed medical personnel before any organ allocation is executed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE NEW USER
          ========================================================================= */}
      {showCreateUserModal && (
        <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} color="#0369a1" />
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Create Authorized User</h2>
              </div>
              <button
                onClick={() => setShowCreateUserModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Dr. Eleanor Vance"
                    value={newUser.full_name}
                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ fontFamily: 'monospace' }}
                      placeholder="evance"
                      value={newUser.username}
                      onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="evance@hospital.org"
                      value={newUser.email}
                      onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Initial Password *</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="••••••••••••"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Account Role *</label>
                    <select
                      required
                      className="form-select"
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="HOSPITAL">Hospital Personnel</option>
                      <option value="ADMIN">System Administrator</option>
                      <option value="DONOR">Donor</option>
                      <option value="RECIPIENT">Recipient</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Operational Role (Optional)</label>
                    <select
                      className="form-select"
                      value={newUser.operational_role}
                      onChange={e => setNewUser({ ...newUser, operational_role: e.target.value })}
                    >
                      <option value="">None (General)</option>
                      <option value="ORGAN_MATCHING_ORGANIZER">{dutyLabel('ORGAN_MATCHING_ORGANIZER')}</option>
                      <option value="DONOR_SURGEON">{dutyLabel('DONOR_SURGEON')}</option>
                      <option value="TRANSPORTER">{dutyLabel('TRANSPORTER')}</option>
                      <option value="TRANSPLANT_SURGEON">{dutyLabel('TRANSPLANT_SURGEON')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Hospital Affiliation {newUser.role === 'HOSPITAL' && <span style={{ color: '#e11d48' }}>*</span>}
                  </label>
                  <select
                    required={newUser.role === 'HOSPITAL'}
                    className="form-select"
                    value={newUser.hospital_id}
                    onChange={e => setNewUser({ ...newUser, hospital_id: e.target.value })}
                  >
                    <option value="">{newUser.role === 'HOSPITAL' ? 'Select Hospital (Required)' : 'No Hospital (National Oversight)'}</option>
                    {hospitalsList.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ethereum Wallet Address (Optional for Ledger Signing)</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    value={newUser.eth_address}
                    onChange={e => setNewUser({ ...newUser, eth_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateUserModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submittingUser} className="btn btn-primary">
                  {submittingUser ? 'Registering…' : 'Create User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT USER
          ========================================================================= */}
      {showEditUserModal && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditUserModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} color="#0369a1" />
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                  Edit User: @{editingUser.username}
                </h2>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editFormData.full_name}
                    onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Account Role</label>
                    <select
                      required
                      className="form-select"
                      value={editFormData.role}
                      onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
                    >
                      <option value="HOSPITAL">Hospital Personnel</option>
                      <option value="ADMIN">System Administrator</option>
                      <option value="DONOR">Donor</option>
                      <option value="RECIPIENT">Recipient</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Operational Role</label>
                    <select
                      className="form-select"
                      value={editFormData.operational_role}
                      onChange={e => setEditFormData({ ...editFormData, operational_role: e.target.value })}
                    >
                      <option value="">None (General)</option>
                      <option value="ORGAN_MATCHING_ORGANIZER">{dutyLabel('ORGAN_MATCHING_ORGANIZER')}</option>
                      <option value="DONOR_SURGEON">{dutyLabel('DONOR_SURGEON')}</option>
                      <option value="TRANSPORTER">{dutyLabel('TRANSPORTER')}</option>
                      <option value="TRANSPLANT_SURGEON">{dutyLabel('TRANSPLANT_SURGEON')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Hospital Affiliation {editFormData.role === 'HOSPITAL' && <span style={{ color: '#e11d48' }}>*</span>}
                  </label>
                  <select
                    required={editFormData.role === 'HOSPITAL'}
                    className="form-select"
                    value={editFormData.hospital_id}
                    onChange={e => setEditFormData({ ...editFormData, hospital_id: e.target.value })}
                  >
                    <option value="">{editFormData.role === 'HOSPITAL' ? 'Select Hospital (Required)' : 'No Hospital (National Oversight)'}</option>
                    {hospitalsList.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ethereum Wallet Address</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="0x..."
                    value={editFormData.eth_address}
                    onChange={e => setEditFormData({ ...editFormData, eth_address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editFormData.is_active}
                      onChange={e => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>Account Active (Check to grant login access, uncheck to suspend)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditUserModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={updatingUser} className="btn btn-primary">
                  {updatingUser ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REGISTER HOSPITAL
          ========================================================================= */}
      {showHospitalModal && (
        <div className="modal-overlay" onClick={() => setShowHospitalModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} color="#0369a1" />
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Register Healthcare Facility</h2>
              </div>
              <button
                onClick={() => setShowHospitalModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateHospital}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Hospital Name *</label>
                    <input
                      type="text"
                      required
                      maxLength={150}
                      className="form-input"
                      placeholder="e.g. Memorial General Hospital"
                      value={newHospital.name}
                      onChange={e => setNewHospital({ ...newHospital, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={20}
                      className="form-input"
                      style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                      placeholder="MGH01"
                      value={newHospital.code}
                      onChange={e => setNewHospital({ ...newHospital, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      className="form-input"
                      placeholder="Boston"
                      value={newHospital.city}
                      onChange={e => setNewHospital({ ...newHospital, city: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">State / Region *</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      className="form-input"
                      placeholder="MA"
                      value={newHospital.state}
                      onChange={e => setNewHospital({ ...newHospital, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Street / Physical Address (Optional)</label>
                  <input
                    type="text"
                    maxLength={255}
                    className="form-input"
                    placeholder="55 Fruit St, Medical Center Complex"
                    value={newHospital.address}
                    onChange={e => setNewHospital({ ...newHospital, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Contact / Emergency Phone (Optional)</label>
                  <input
                    type="tel"
                    maxLength={30}
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="+1 (617) 726-2000"
                    value={newHospital.contact_phone}
                    onChange={e => setNewHospital({ ...newHospital, contact_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowHospitalModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submittingHospital} className="btn btn-primary">
                  {submittingHospital ? 'Registering…' : 'Register Hospital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
