import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { canAccessTab } from './authz';

// Pages
import { Login } from './pages/Login';
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
  const menuButtonRef = useRef(null);

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

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

  if (initializing) {
    return <div className="page-container" role="status" aria-live="polite">Restoring your session...</div>;
  }

  if (!user) {
    return <Login />;
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
    if (!canAccessTab(user.role, currentTab, user.operational_role)) {
      return (
        <div className="card" role="alert">
          <h1 className="page-title">Access denied</h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Your account is not authorized to view this page.
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
