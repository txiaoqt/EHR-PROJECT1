import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/sidebar/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Appointments from './pages/Appointments.jsx';
import Patients from './pages/Patients.jsx';
import Encounter from './pages/Encounter.jsx';
import Encounters from './pages/Encounters.jsx';
import PatientProfile from './pages/PatientProfile.jsx';
import Reports from './pages/Reports.jsx';
import Inventory from './pages/Inventory.jsx';
import Help from './pages/Help.jsx';
import Login from './pages/Login.jsx';
import Settings from './pages/Settings.jsx';
import MyProfile from './pages/MyProfile.jsx';
import './styles/main.css';
import { exportCsv } from './utils.js';
import { useAuth } from './AuthContext.jsx';
import { getClinicHoursMessage, hasRequiredRole, isWithinClinicHours } from './accessControl.js';

const ProtectedRoute = ({ isAuthenticated, user, allowedRoles = [], children }) => {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isWithinClinicHours()) {
    return <Navigate to="/login" replace state={{ sessionMessage: getClinicHoursMessage() }} />;
  }

  if (!hasRequiredRole(user, allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppShell() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ehr_theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const autoLogoutInProgressRef = useRef(false);

  useEffect(() => {
    document.title = 'TUP Clinic EHR';
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ehr_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  // Expose globally
  useEffect(() => {
    window.applyTheme = (mode) => setTheme(mode);
    window.exportCsv = exportCsv;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      autoLogoutInProgressRef.current = false;
      return;
    }

    let mounted = true;

    const enforceClinicHours = async () => {
      if (!isWithinClinicHours() && !autoLogoutInProgressRef.current) {
        autoLogoutInProgressRef.current = true;
        try {
          await logout();
        } catch (e) {
          console.error('Auto-logout failed');
        } finally {
          if (mounted) {
            navigate('/login', {
              replace: true,
              state: { sessionMessage: getClinicHoursMessage() },
            });
          }
          autoLogoutInProgressRef.current = false;
        }
      }
    };

    enforceClinicHours();
    const intervalId = setInterval(enforceClinicHours, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, logout, navigate]);

  const guard = (element, allowedRoles = []) => (
    <ProtectedRoute isAuthenticated={isAuthenticated} user={user} allowedRoles={allowedRoles}>
      {element}
    </ProtectedRoute>
  );

  const canAccessAuthenticatedHome = isAuthenticated && isWithinClinicHours();

  return (
    <div id="app-root">
        {canAccessAuthenticatedHome && (
          <div id="sidebar-container" className={`sidebar-container ${sidebarOpen ? '' : 'collapsed'}`}>
            <Sidebar />
          </div>
        )}
        <Routes>
          <Route path="/" element={canAccessAuthenticatedHome ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
          <Route path="/dashboard" element={guard(<Dashboard setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />)} />
          <Route path="/appointments" element={guard(<Appointments />)} />
          <Route path="/patients" element={guard(<Patients />)} />
          <Route path="/encounter" element={guard(<Encounter />)} />
          <Route path="/encounters" element={guard(<Encounters />)} />
          <Route path="/reports" element={guard(<Reports />)} />
          <Route path="/inventory" element={guard(<Inventory />)} />

          <Route path="/help" element={guard(<Help />)} />
          <Route path="/login" element={canAccessAuthenticatedHome ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/settings" element={guard(<Settings />)} />
          <Route path="/my-profile" element={guard(<MyProfile />)} />
          <Route path="/patient-profile" element={guard(<PatientProfile />)} />
          <Route path="*" element={<Navigate to={canAccessAuthenticatedHome ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
