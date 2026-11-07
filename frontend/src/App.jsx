import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { canAccessTab } from './utils/access';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Donors } from './pages/Donors';
import { Recipients } from './pages/Recipients';
import { Organs } from './pages/Organs';
import { OrganDetail } from './pages/OrganDetail';
import { Matching } from './pages/Matching';
import { MLAnalytics } from './pages/MLAnalytics';
import { BlockchainAudit } from './pages/BlockchainAudit';
import { Admin } from './pages/Admin';

export function App() {
  const { user, initializing, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedOrganId, setSelectedOrganId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(max-width: 768px)').matches;
    }
    return false;
  });
  const menuButtonRef = useRef(null);

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  const openOrgan = (organId) => {
    setSelectedOrganId(organId);
    handleTabChange('organ-detail');
  };

  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setSidebarCollapsed((prev) => {
          const next = !prev;
          try {
            localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return;
    const landingTab = user.role === 'ADMIN'
      ? 'dashboard'
      : user.role === 'HOSPITAL'
        ? ({
            PROCUREMENT_ORGANIZER: 'donors',
            PATIENT_DOCTOR: 'donors',
            ORGAN_MATCHING_ORGANIZER: 'matching',
            DONOR_SURGEON: 'organs',
            TRANSPORTER: 'organs',
            TRANSPLANT_SURGEON: 'organs',
          }[user.operational_role] || 'dashboard')
        : 'dashboard';
    setCurrentTab(landingTab);
  }, [user]);

  // Fall back to the Overview tab if the active tab becomes disallowed
  useEffect(() => {
    if (user && !canAccessTab(user, currentTab)) {
      setCurrentTab('dashboard');
    }
  }, [user, currentTab]);

  useEffect(() => {
    if (!initializing && !user) {
      window.location.replace('/login.html');
    }
  }, [initializing, user]);

  if (initializing) {
    return <div className="page-container" role="status" aria-live="polite">Restoring your session...</div>;
  }

  if (!user) {
    return (
      <div className="page-container" role="status" aria-live="polite">
        Redirecting to sign in...
      </div>
    );
  }

  if (user.role === 'DONOR' || user.role === 'RECIPIENT') {
    return (
      <main className="portal-unavailable">
        <section className="card" aria-labelledby="portal-unavailable-title">
          <h1 id="portal-unavailable-title" className="page-title">Portal unavailable</h1>
          <p>Your account type does not have a portal in this version of the system.</p>
          <button onClick={logout} className="btn btn-outline">Log out</button>
        </section>
      </main>
    );
  }

  const renderContent = () => {
    if (!canAccessTab(user, currentTab)) {
      return (
        <div className="card" role="alert">
          <h1 className="page-title">Access restricted</h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Your role does not have access to this section.
          </p>
        </div>
      );
    }
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard 
            setCurrentTab={handleTabChange} 
            setSelectedOrganId={setSelectedOrganId} 
            openOrgan={openOrgan}
          />
        );
      case 'donors':
        return <Donors />;
      case 'recipients':
        return <Recipients />;
      case 'organs':
        return (
          <Organs 
            setSelectedOrganId={setSelectedOrganId} 
            setCurrentTab={handleTabChange} 
            openOrgan={openOrgan}
          />
        );
      case 'organ-detail':
        return (
          <OrganDetail 
            organId={selectedOrganId} 
            setCurrentTab={handleTabChange} 
          />
        );
      case 'matching':
        return (
          <Matching 
            setCurrentTab={handleTabChange} 
            setSelectedOrganId={setSelectedOrganId} 
            openOrgan={openOrgan}
          />
        );
      case 'ml':
        return <MLAnalytics />;
      case 'blockchain':
        return <BlockchainAudit />;
      case 'audit':
        return <BlockchainAudit mode="audit" />;
      case 'admin':
        return <Admin />;
      default:
        return (
          <Dashboard 
            setCurrentTab={handleTabChange} 
            setSelectedOrganId={setSelectedOrganId} 
            openOrgan={openOrgan}
          />
        );
    }
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="app-container">
        <Sidebar
          id="app-sidebar"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentTab={currentTab}
          setCurrentTab={handleTabChange}
          selectedOrganId={selectedOrganId}
          triggerRef={menuButtonRef}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
        />
        <div className="main-content">
          <Navbar
            currentTab={currentTab}
            sidebarId="app-sidebar"
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            menuButtonRef={menuButtonRef}
          />
          <main id="main-content" tabIndex={-1} className="content-area">
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
}
