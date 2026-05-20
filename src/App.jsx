import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/sidebar/Sidebar.jsx';
import PatientSidebar from './components/sidebar/PatientSidebar.jsx';
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
import PatientDashboard from './pages/patient/PatientDashboard.jsx';
import PatientSchedule from './pages/patient/PatientSchedule.jsx';
import PatientMessages from './pages/patient/PatientMessages.jsx';
import PatientRecords from './pages/patient/PatientRecords.jsx';
import PatientProfilePortal from './pages/patient/PatientProfilePortal.jsx';
import KioskBooking from './pages/patient/KioskBooking.jsx';
import './styles/main.css';
import { exportCsv } from './utils.js';
import { useAuth } from './AuthContext.jsx';
import { getClinicHoursMessage, hasRequiredRole, isWithinClinicHours } from './accessControl.js';

const DEPLOY_SURFACE = (import.meta.env.VITE_DEPLOY_SURFACE || 'admin').toLowerCase();
const IS_ADMIN_SURFACE = DEPLOY_SURFACE === 'admin';
const IS_USER_SURFACE = DEPLOY_SURFACE === 'user';

const getRoleHome = (role) => ((role || '').toLowerCase() === 'patient' ? '/patient/dashboard' : '/dashboard');
const isPatientRole = (role) => (role || '').toLowerCase() === 'patient';

const ProtectedRoute = ({ isAuthenticated, user, allowedRoles = [], children }) => {
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isWithinClinicHours()) return <Navigate to="/login" replace state={{ sessionMessage: getClinicHoursMessage() }} />;
  if (!hasRequiredRole(user, allowedRoles)) {
    return <Navigate to={IS_USER_SURFACE ? '/patient/dashboard' : '/dashboard'} replace />;
  }
  return children;
};

function AppShell() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 980);

  useEffect(() => { document.title = 'TUP Clinic EHR'; }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ehr_theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('sidebarOpen', sidebarOpen); }, [sidebarOpen]);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);
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
          if (mounted) navigate('/login', { replace: true, state: { sessionMessage: getClinicHoursMessage() } });
          autoLogoutInProgressRef.current = false;
        }
      }
    };

    enforceClinicHours();
    const intervalId = setInterval(enforceClinicHours, 30000);
    return () => { mounted = false; clearInterval(intervalId); };
  }, [isAuthenticated, logout, navigate]);

  const guard = (element, allowedRoles = []) => (
    <ProtectedRoute isAuthenticated={isAuthenticated} user={user} allowedRoles={allowedRoles}>
      {element}
    </ProtectedRoute>
  );

  const canAccessAuthenticatedHome = isAuthenticated && isWithinClinicHours();
  const roleHome = getRoleHome(user?.role);
  const surfaceHome = IS_USER_SURFACE ? '/patient/dashboard' : '/dashboard';
  const userRole = (user?.role || '').toLowerCase();
  const isRoleAllowedOnSurface = !isAuthenticated
    ? true
    : (IS_ADMIN_SURFACE ? userRole !== 'patient' : userRole === 'patient');

  return (
    <div id="app-root">
      {canAccessAuthenticatedHome && isRoleAllowedOnSurface && (
        <div id="sidebar-container" className={`sidebar-container ${sidebarOpen ? '' : 'collapsed'}`}>
          {IS_USER_SURFACE ? <PatientSidebar /> : <Sidebar />}
        </div>
      )}
      {canAccessAuthenticatedHome && isRoleAllowedOnSurface && isMobile && (
        <>
          {!sidebarOpen && (
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
            </button>
          )}
          {sidebarOpen && <button type="button" aria-label="Close navigation" className="mobile-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        </>
      )}

      <Routes>
        <Route path="/" element={canAccessAuthenticatedHome ? <Navigate to={surfaceHome} replace /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={canAccessAuthenticatedHome ? <Navigate to={surfaceHome} replace /> : <Login />} />

        {IS_ADMIN_SURFACE && (
          <>
            <Route path="/dashboard" element={guard(<Dashboard setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />, ['admin', 'physician', 'nurse'])} />
            <Route path="/appointments" element={guard(<Appointments />, ['admin', 'physician', 'nurse'])} />
            <Route path="/patients" element={guard(<Patients />, ['admin', 'physician', 'nurse'])} />
            <Route path="/encounter" element={guard(<Encounter />, ['admin', 'physician', 'nurse'])} />
            <Route path="/encounters" element={guard(<Encounters />, ['admin', 'physician', 'nurse'])} />
            <Route path="/reports" element={guard(<Reports />, ['admin', 'physician', 'nurse'])} />
            <Route path="/inventory" element={guard(<Inventory />, ['admin', 'physician', 'nurse'])} />
            <Route path="/help" element={guard(<Help />, ['admin', 'physician', 'nurse'])} />
            <Route path="/settings" element={guard(<Settings />, ['admin', 'physician', 'nurse'])} />
            <Route path="/my-profile" element={guard(<MyProfile />, ['admin', 'physician', 'nurse'])} />
            <Route path="/patient-profile" element={guard(<PatientProfile />, ['admin', 'physician', 'nurse'])} />
          </>
        )}

        {IS_USER_SURFACE && (
          <>
            <Route path="/kiosk" element={<KioskBooking />} />
            <Route path="/patient/dashboard" element={guard(<PatientDashboard />, ['patient'])} />
            <Route path="/patient/schedule" element={guard(<PatientSchedule />, ['patient'])} />
            <Route path="/patient/messages" element={guard(<PatientMessages />, ['patient'])} />
            <Route path="/patient/records" element={guard(<PatientRecords />, ['patient'])} />
            <Route path="/patient/profile" element={guard(<PatientProfilePortal />, ['patient'])} />
          </>
        )}

        <Route path="*" element={<Navigate to={canAccessAuthenticatedHome ? surfaceHome : '/login'} replace />} />
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
