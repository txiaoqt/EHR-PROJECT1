import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { translate } from '../../utils';
import { useAuth } from '../../AuthContext.jsx';
import { supabase } from '../../supabaseClient.js';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [languageChange, setLanguageChange] = useState(0);

  // Confirmation popup state
  const [showConfirm, setShowConfirm] = useState(false);

  // show last backup timestamp
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('last_backup') || '--');

  useEffect(() => {
    // re-render trigger for settings changes
    const handleSettingsChange = () => setLanguageChange(prev => prev + 1);
    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, []);

  useEffect(() => {
    // update display name + avatar from user object (if available)
    if (user) {
      const avatar = document.querySelector('.avatar');
      const footer = document.querySelector('.sidebar-footer');

      let displayName = user.name || '';
      const emailPrefix = (user.email || '').split('.')[0].toLowerCase();
      if (emailPrefix === 'dr' && displayName && !displayName.startsWith('Dr.')) {
        displayName = `Dr. ${displayName}`;
      } else if (emailPrefix === 'nurse' && displayName && !displayName.startsWith('Nr.')) {
        displayName = `Nr. ${displayName.replace(/^(Nurse\s+)?/, '')}`;
      } else if (emailPrefix === 'admin' && displayName) {
        displayName = `Admin ${displayName}`;
      }

      if (footer) {
        const userDiv = footer.querySelector('div');
        if (userDiv) userDiv.innerHTML = `Logged in as <strong>${displayName || 'User'}</strong>`;
      }
      if (avatar && user.avatar) avatar.src = user.avatar;
    }

    // close profile menu when clicking outside
    const handleClickOutside = (ev) => {
      if (!document.getElementById('sidebar-container')?.contains(ev.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [user]);

  // Fetch last_backup from Supabase on mount (fallback to localStorage), and listen to backupCompleted events
  useEffect(() => {
    let mounted = true;

    const fetchLastBackup = async () => {
      try {
        // try reading from settings table (authoritative)
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'last_backup')
          .maybeSingle();

        if (!error && data && data.value) {
          if (mounted) {
            setLastBackup(data.value);
            localStorage.setItem('last_backup', data.value);
          }
        } else {
          // fallback to localStorage (already initialised)
          const local = localStorage.getItem('last_backup');
          if (mounted && local) setLastBackup(local);
        }
      } catch (err) {
        // ignore — keep localStorage or default
        const local = localStorage.getItem('last_backup');
        if (mounted && local) setLastBackup(local);
      }
    };

    fetchLastBackup();

    const onBackupCompleted = (ev) => {
      // ev may be a CustomEvent with detail timestamp, or a plain Event
      const ts = ev?.detail || localStorage.getItem('last_backup') || '--';
      setLastBackup(ts);
      if (ts && ts !== '--') localStorage.setItem('last_backup', ts);
    };

    window.addEventListener('backupCompleted', onBackupCompleted);

    return () => {
      mounted = false;
      window.removeEventListener('backupCompleted', onBackupCompleted);
    };
  }, []);

  const handleNavigation = (page) => {
    // Keep UI active state in sync
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(i => i.classList.remove('active'));
    const target = document.querySelector(`[data-page="${page}"]`);
    if (target) target.classList.add('active');
    navigate('/' + page);
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const handleSignOutClick = () => {
    setShowConfirm(true);
  };

  const toggleProfileMenu = () => setProfileMenuOpen(prev => !prev);

  // When clicking Last backup, navigate to settings and focus the backup card
  const openBackupSettings = () => navigate('/settings', { state: { focus: 'backup' } });

  return (
    <>
      <aside className="sidebar" aria-label="Primary navigation">
        {/* Header */}
        <div className="sidebar-header">
          <div className="brand">
            <div className="logo">
              <img src="/src/assets/images/tupehrlogo.jpg" alt="TUP EHR logo" className="logo-img" />
            </div>
            <div>
              <h1 className="brand-title">TUP Clinic</h1>
              <div className="brand-sub">Staff Dashboard</div>
            </div>
          </div>

          <button
            id="profileBtn"
            className="profile-btn"
            aria-haspopup="true"
            aria-expanded={profileMenuOpen}
            onClick={toggleProfileMenu}
          >
            <img src="/src/assets/images/avatar-placeholder.jpg" alt="Profile" className="avatar" />
          </button>

          <div id="profileMenu" className={`profile-menu ${profileMenuOpen ? '' : 'hidden'}`}>
            <div
              className="profile-menu-item"
              id="profileView"
              onClick={() => { setProfileMenuOpen(false); navigate('/my-profile'); }}
            >
              View Profile
            </div>
            <div
              className="profile-menu-item"
              id="profileSettings"
              onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}
            >
              Settings
            </div>
            <div
              className="profile-menu-item danger"
              id="signOut"
              onClick={handleSignOutClick}
            >
              Sign Out
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="menu" role="navigation">
          <div className="menu-item active" data-page="dashboard" onClick={() => handleNavigation('dashboard')}>
            🏠 {translate('dashboard')}
          </div>
          <div className="menu-item" data-page="appointments" onClick={() => handleNavigation('appointments')}>
            📅 {translate('appointments')}
          </div>
          <div className="menu-item" data-page="patients" onClick={() => handleNavigation('patients')}>
            🧑‍🤝‍🧑 {translate('patients')}
          </div>
          <div className="menu-item" data-page="encounters" onClick={() => handleNavigation('encounters')}>
            🩺 {translate('encounters')}
          </div>
          <div className="menu-item" data-page="reports" onClick={() => handleNavigation('reports')}>
            📈 {translate('reports')}
          </div>
          <div className="menu-item" data-page="inventory" onClick={() => handleNavigation('inventory')}>
            🧾 {translate('inventory')}
          </div>
          <div className="menu-item" data-page="help" onClick={() => handleNavigation('help')}>
            ❓ {translate('help')}
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div>Logged in as <strong>Dr. Rivera</strong></div>

          <div
            className="muted"
            style={{ cursor: 'pointer' }}
            onClick={openBackupSettings}
            title="Open backup settings"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openBackupSettings(); }}
          >
            Last backup: <strong>{lastBackup}</strong>
          </div>

          <div className="footer-actions">
            <button id="sidebarSettings" className="btn small" onClick={() => navigate('/settings')}>Settings</button>
            <button id="sidebarSignout" className="btn secondary small" onClick={handleSignOutClick}>Sign Out</button>
          </div>
        </div>
      </aside>

      {/* Inline Confirm Popup for Sign Out */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
          }}
        >
          <div
            style={{
              background: 'var(--panel)',
              padding: '22px',
              width: '360px',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
              textAlign: 'center'
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-heading"
          >
            <h3 id="confirm-heading" style={{ margin: '0 0 8px' }}>Sign Out?</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--muted)' }}>
              Are you sure you want to sign out?
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button className="btn secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button
                className="btn"
                onClick={() => {
                  setShowConfirm(false);
                  handleSignOut();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
