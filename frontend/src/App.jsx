import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

// Placeholder components for other pages
const PlaceholderPage = ({ title }) => <main className="main"><div className="card">{title} Page</div></main>;

function App() {
  const { isAuthenticated } = useAuth();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ehr_theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

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

  return (
    <Router>
    <div id="app-root">
        {isAuthenticated && (
          <div id="sidebar-container" className={`sidebar-container ${sidebarOpen ? '' : 'collapsed'}`}>
            <Sidebar />
          </div>
        )}
        <Routes>
          <Route path="/" element={isAuthenticated ? <Dashboard setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} /> : <Navigate to="/login" />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} /> : <Navigate to="/login" />} />
          <Route path="/appointments" element={isAuthenticated ? <Appointments /> : <Navigate to="/login" />} />
          <Route path="/patients" element={isAuthenticated ? <Patients /> : <Navigate to="/login" />} />
          <Route path="/encounter" element={isAuthenticated ? <Encounter /> : <Navigate to="/login" />} />
          <Route path="/encounters" element={isAuthenticated ? <Encounters /> : <Navigate to="/login" />} />
          <Route path="/reports" element={isAuthenticated ? <Reports /> : <Navigate to="/login" />} />
          <Route path="/inventory" element={isAuthenticated ? <Inventory /> : <Navigate to="/login" />} />

          <Route path="/help" element={isAuthenticated ? <Help /> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
          <Route path="/my-profile" element={isAuthenticated ? <MyProfile /> : <Navigate to="/login" />} />
          <Route path="/patient-profile" element={isAuthenticated ? <PatientProfile /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
