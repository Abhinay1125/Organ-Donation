import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Menu, AlertCircle, MinusCircle, User as UserIcon, ChevronDown, LogOut } from 'lucide-react';
import { dutyLabel } from '../authz';

const TAB_TITLES = {
  dashboard: 'Overview',
  donors: 'Donors',
  recipients: 'Waiting List',
  organs: 'Organ Journeys',
  'organ-detail': 'Organ Detail',
  matching: 'Matching Review',
  ml: 'ML Analytics',
  blockchain: 'Blockchain Ledger',
  audit: 'Audit Records',
  admin: 'Admin Console'
};

export const Navbar = ({
  currentTab = 'dashboard',
  sidebarOpen = false,
  onToggleSidebar,
  sidebarId = 'app-sidebar',
  menuButtonRef,
}) => {
  const { user, logout, authFetch } = useAuth();
  const [blockchainStatus, setBlockchainStatus] = useState(null); // 'connected' | 'disconnected' | 'unavailable'
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hospitalName, setHospitalName] = useState(null);

  const userMenuRef = useRef(null);
  const userButtonRef = useRef(null);

  // Poll blockchain connectivity for ADMIN and HOSPITAL roles
  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'HOSPITAL')) {
      setBlockchainStatus(null);
      setLoadingStatus(false);
      return;
    }

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await authFetch('/api/blockchain/status');
        if (!res.ok) {
          if (isMounted) setBlockchainStatus('unavailable');
          return;
        }
        const data = await res.json();
        if (data && typeof data.connected === 'boolean') {
          if (isMounted) setBlockchainStatus(data.connected ? 'connected' : 'disconnected');
        } else {
          if (isMounted) setBlockchainStatus('unavailable');
        }
      } catch {
        if (isMounted) setBlockchainStatus('unavailable');
      } finally {
        if (isMounted) setLoadingStatus(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.role]);

  // Resolve hospital name if hospital_id exists and name is not on user object
  useEffect(() => {
    if (!user) {
      setHospitalName(null);
      return;
    }

    const explicitName = user.hospital_name || (typeof user.hospital === 'string' ? user.hospital : user.hospital?.name);
    if (explicitName) {
      setHospitalName(explicitName);
      return;
    }

    if (user.hospital_id && (user.role === 'ADMIN' || user.role === 'HOSPITAL')) {
      let isMounted = true;
      authFetch('/api/hospitals')
        .then((res) => (res.ok ? res.json() : null))
        .then((list) => {
          if (!isMounted || !Array.isArray(list)) return;
          const match = list.find((h) => String(h.id) === String(user.hospital_id));
          if (match && match.name) {
            setHospitalName(match.name);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }

    setHospitalName(null);
  }, [user?.hospital_id, user?.hospital_name, user?.hospital, user?.role]);

  // Handle outside click and Escape key for user menu
  useEffect(() => {
    if (!userMenuOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setUserMenuOpen(false);
        userButtonRef.current?.focus();
      }
    };

    const handleClickOutside = (e) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(e.target)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
  };

  const renderBlockchainStatus = () => {
    if (loadingStatus || !user || (user.role !== 'ADMIN' && user.role !== 'HOSPITAL')) {
      return null;
    }

    const titleText = 'Reflects node connectivity only. It does not confirm individual transactions.';

    if (blockchainStatus === 'connected') {
      return (
        <div
          className="blockchain-status-pill status-connected"
          aria-live="polite"
          title={titleText}
        >
          <span className="status-dot status-dot-connected" aria-hidden="true" />
          <span>Blockchain: connected</span>
        </div>
      );
    }

    if (blockchainStatus === 'disconnected') {
      return (
        <div
          className="blockchain-status-pill status-disconnected"
          aria-live="polite"
          title={titleText}
        >
          <AlertCircle size={13} aria-hidden="true" />
          <span>Blockchain: not connected</span>
        </div>
      );
    }

    return (
      <div
        className="blockchain-status-pill status-unavailable"
        aria-live="polite"
        title={titleText}
      >
        <MinusCircle size={13} aria-hidden="true" />
        <span>Status unavailable</span>
      </div>
    );
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          ref={menuButtonRef}
          type="button"
          className="topbar-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Open navigation"
          aria-controls={sidebarId}
          aria-expanded={sidebarOpen}
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <div className="breadcrumb">
          <span>Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <strong>{TAB_TITLES[currentTab] || 'Overview'}</strong>
        </div>
      </div>

      <div className="topbar-right">
        {renderBlockchainStatus()}

        {user && (
          <div className="user-menu-container" ref={userMenuRef}>
            <button
              ref={userButtonRef}
              type="button"
              className="user-menu-btn"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label={user.full_name || 'User menu'}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <div className="user-avatar-badge" aria-hidden="true">
                {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : (user.username?.slice(0, 2).toUpperCase() || 'AD')}
              </div>
              <span className="user-menu-name">{user.full_name || user.username}</span>
              <ChevronDown
                size={14}
                className={`user-menu-chevron ${userMenuOpen ? 'open' : ''}`}
                aria-hidden="true"
              />
            </button>

            {userMenuOpen && (
              <div className="user-menu-panel" role="menu">
                <div className="user-menu-info">
                  <span className="user-menu-duty">
                    {dutyLabel(user.operational_role || user.role)}
                  </span>
                  {hospitalName && (
                    <span className="user-menu-hospital" title={hospitalName}>
                      {hospitalName}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="user-menu-logout"
                  role="menuitem"
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
