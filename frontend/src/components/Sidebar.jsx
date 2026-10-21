import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  HeartHandshake, 
  Users, 
  Activity, 
  GitMerge, 
  LineChart, 
  Shield, 
  ClipboardList,
  Settings 
} from 'lucide-react';
import { canAccessTab, dutyLabel } from '../authz';

export const Sidebar = ({
  currentTab,
  setCurrentTab,
  selectedOrganId,
  open = false,
  onClose,
  id = 'app-sidebar',
  triggerRef,
}) => {
  const { user } = useAuth();
  const sidebarRef = useRef(null);
  const prevOpenRef = useRef(open);

  const workspaceItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'donors', label: 'Donors', icon: HeartHandshake },
    { id: 'recipients', label: 'Waiting List', icon: Users },
    { id: 'organs', label: 'Organ Journeys', icon: Activity },
    ...(selectedOrganId ? [{ id: 'organ-detail', label: 'Organ Detail', icon: Activity }] : []),
    { id: 'matching', label: 'Matching Review', icon: GitMerge },
    { id: 'ml', label: 'ML Analytics', icon: LineChart },
  ].filter((item) => canAccessTab(user?.role, item.id, user?.operational_role));

  const adminItems = [
    { id: 'blockchain', label: 'Blockchain Ledger', icon: Shield },
    { id: 'audit', label: 'Audit Records', icon: ClipboardList },
    { id: 'admin', label: 'Admin Console', icon: Settings },
  ].filter((item) => canAccessTab(user?.role, item.id, user?.operational_role));

  // Focus management and keyboard navigation for drawer under 900px
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open || window.innerWidth >= 900) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        triggerRef?.current?.focus();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = sidebarRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    if (open && window.innerWidth < 900) {
      const firstFocusable = sidebarRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
      document.addEventListener('keydown', handleKeyDown);
    } else if (prevOpenRef.current && !open && window.innerWidth < 900) {
      triggerRef?.current?.focus();
    }

    prevOpenRef.current = open;

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, triggerRef]);

  const handleItemClick = (itemId) => {
    if (canAccessTab(user?.role, itemId, user?.operational_role)) {
      setCurrentTab(itemId);
      if (window.innerWidth < 900) {
        onClose?.();
      }
    }
  };

  const userInitials = user?.full_name 
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.username ? user.username.slice(0, 2).toUpperCase() : 'U');

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id={id}
        ref={sidebarRef}
        className={`sidebar ${open ? 'open' : ''}`}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Activity size={16} aria-hidden="true" />
            </div>
            <div>
              <div className="sidebar-brand-title">
                OrganFlow <span className="sidebar-brand-badge">{user?.role || 'PORTAL'}</span>
              </div>
              <div className="sidebar-brand-sub">Transplantation Registry</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {workspaceItems.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-nav-eyebrow">WORKSPACE</div>
              <ul className="sidebar-nav-list">
                {workspaceItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <li key={item.id} className="sidebar-nav-item">
                      <button
                        type="button"
                        onClick={() => handleItemClick(item.id)}
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {adminItems.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-nav-eyebrow">ADMINISTRATION & AUDIT</div>
              <ul className="sidebar-nav-list">
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <li key={item.id} className="sidebar-nav-item">
                      <button
                        type="button"
                        onClick={() => handleItemClick(item.id)}
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>

        {user && (
          <div className="sidebar-bottom-user">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.full_name || user.username}</span>
              <small className="sidebar-user-role">{dutyLabel(user.operational_role || user.role)}</small>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
