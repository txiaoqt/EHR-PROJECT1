import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { translate } from '../../utils';
import { useAuth } from '../../AuthContext.jsx';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [languageChange, setLanguageChange] = useState(0); // Force re-render trigger

  useEffect(() => {
    // Listen for settings changes
    const handleSettingsChange = () => {
      setLanguageChange(prev => prev + 1);
    };

    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, []);

  useEffect(() => {
    // update profile display from current user
    if (user) {
      const avatar = document.querySelector('.avatar');
      const footer = document.querySelector('.sidebar-footer');

      // Generate display name based on email prefix
      let displayName = user.name;
      const prefix = user.email.split('.')[0].toLowerCase();
      if (prefix === 'dr' && !displayName.startsWith('Dr.')) {
        displayName = `Dr. ${displayName}`;
      } else if (prefix === 'nurse' && !displayName.startsWith('Nr.')) {
        displayName = `Nr. ${displayName.replace(/^(Nurse\s+)?/, '')}`;
      } else if (prefix === 'admin') {
        displayName = `Admin ${displayName}`;
      }

      if (footer) {
        const userDiv = footer.querySelector('div');
        if (userDiv) userDiv.innerHTML = `Logged in as <strong>${displayName}</strong>`;
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

  const handleNavigation = (page) => {
    // Remove active class from all, add to this
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

  const toggleProfileMenu = () => {
    setProfileMenuOpen(!profileMenuOpen);
  };

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      {/* TOP BAR: PROFILE ON TOP RIGHT */}
      <div className="sidebar-header">
        <div className="brand">
          {/* logo: use your new image file */}
          <div className="logo">
            <img src="/src/assets/images/tupehrlogo.jpg" alt="TUP EHR logo" className="logo-img" />
          </div>
          <div>
            <h1 className="brand-title">TUP Clinic</h1>
            <div className="brand-sub">Staff Dashboard</div>
          </div>
        </div>

        {/* PROFILE BUTTON TOP RIGHT */}
        <button id="profileBtn" className="profile-btn" aria-haspopup="true" aria-expanded={profileMenuOpen} onClick={toggleProfileMenu}>
          <img src="/src/assets/images/avatar-placeholder.jpg" alt="Profile" className="avatar" />
        </button>

        {/* Profile Dropdown */}
        <div id="profileMenu" className={`profile-menu ${profileMenuOpen ? '' : 'hidden'}`}>
          <div className="profile-menu-item" id="profileView" onClick={() => { setProfileMenuOpen(false); navigate('/my-profile'); }}>View Profile</div>
          <div className="profile-menu-item" id="profileSettings" onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}>Settings</div>
          <div className="profile-menu-item danger" id="signOut" onClick={handleSignOut}>Sign Out</div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="menu" role="navigation">
        <div className="menu-item active" data-page="dashboard" onClick={() => handleNavigation('dashboard')}>🏠 {translate('dashboard')}</div>
        <div className="menu-item" data-page="appointments" onClick={() => handleNavigation('appointments')}>📅 {translate('appointments')}</div>
        <div className="menu-item" data-page="patients" onClick={() => handleNavigation('patients')}>🧑‍🤝‍🧑 {translate('patients')}</div>
        <div className="menu-item" data-page="encounters" onClick={() => handleNavigation('encounters')}>🩺 {translate('encounters')}</div>
        <div className="menu-item" data-page="reports" onClick={() => handleNavigation('reports')}>📈 {translate('reports')}</div>
        <div className="menu-item" data-page="inventory" onClick={() => handleNavigation('inventory')}>🧾 {translate('inventory')}</div>
        <div className="menu-item" data-page="help" onClick={() => handleNavigation('help')}>❓ {translate('help')}</div>
      </nav>

      {/* FOOTER */}
      <div className="sidebar-footer">
        <div>Logged in as <strong>Dr. Rivera</strong></div>
        <div className="muted">Last backup: <strong>2 days ago</strong></div>

        <div className="footer-actions">
          <button id="sidebarSettings" className="btn small" onClick={() => navigate('/settings')}>Settings</button>
          <button id="sidebarSignout" className="btn secondary small" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
