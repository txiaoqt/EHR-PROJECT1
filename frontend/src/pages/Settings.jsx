import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { loadSettings, saveSettings as saveSettingsUtil, translate, formatDate, formatTime } from '../utils.js';
import { useAuth } from '../AuthContext.jsx';

const Settings = () => {
  const { user: authUser } = useAuth();
  const [settings, setSettings] = useState(() => loadSettings());
  const [user, setUser] = useState({ name: '', role: '', email: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (authUser) {
      // Format display name like in sidebar
      let displayName = authUser.name;
      const prefix = authUser.email.split('.')[0].toLowerCase();
      if (prefix === 'dr' && !displayName.startsWith('Dr.')) {
        displayName = `Dr. ${displayName}`;
      } else if (prefix === 'nurse' && !displayName.startsWith('Nr.')) {
        displayName = `Nr. ${displayName.replace(/^(Nurse\s+)?/, '')}`;
      } else if (prefix === 'admin') {
        displayName = `Admin ${displayName}`;
      }

      // Capitalize role
      const roleFormatted = authUser.role ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1) : '';

      setUser({ name: displayName, role: roleFormatted, email: authUser.email });
      setLoading(false);
    }
  }, [authUser]);

  const applyTheme = (mode) => {
    window.applyTheme && window.applyTheme(mode);
    setSettings(prev => ({ ...prev, theme: mode }));
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    // Save to localStorage first for immediate UI updates
    saveSettingsUtil(settings);

    try {
      // Save to Supabase
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      }

      setMessage(translate('settings_saved'));
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);

      // Reload to apply translation changes
      setTimeout(() => window.location.reload(), 100);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Update password in Supabase users table
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', authUser.id);

      if (error) throw error;

      setMessage('Password changed successfully!');
      setMessageType('success');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage('Error changing password.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) return <main className="main"><div className="card">Loading settings...</div></main>;

  return (
    <main className="main">
      {message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          padding: '12px 24px',
          borderRadius: '8px',
          color: 'white',
          fontWeight: 'bold',
          backgroundColor: messageType === 'error' ? '#dc3545' : '#28a745',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          {message}
        </div>
      )}

      <section className="page">
        <div className="card">
          <h2>Settings</h2>
          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Settings Preview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <strong style={{ color: 'var(--primary)' }}>Date/Time Format</strong><br />
                <div style={{ marginTop: '4px', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px' }}>
                  {formatDate(new Date())} {formatTime(new Date())}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--primary)' }}>Sample Weight</strong><br />
                <div style={{ marginTop: '4px', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px' }}>
                  {settings.clinical_units === 'metric' ? '65.5 kg' : '144.6 lbs'}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--primary)' }}>Sample Height</strong><br />
                <div style={{ marginTop: '4px', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px' }}>
                  {settings.clinical_units === 'metric' ? '170 cm' : `5'7"`}
                </div>
              </div>
            </div>
            {settings.language === 'fil' && (
              <div style={{ marginTop: '12px', padding: '8px', background: '#e3f2fd', borderRadius: '4px' }}>
                <strong>Language Preview:</strong> Nagbabago ang wika sa Filipino kung ito ay nakikita
              </div>
            )}
            {settings.language === 'en' && (
              <div style={{ marginTop: '12px', padding: '8px', background: '#fff3cd', borderRadius: '4px' }}>
                <strong>Language Preview:</strong> Interface language has been switched to English
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Settings */}
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Profile Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="label-muted">Display Name</label>
                    <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{user.name}</div>
                  </div>
                  <div>
                    <label className="label-muted">Email</label>
                    <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{user.email}</div>
                  </div>
                  <div>
                    <label className="label-muted">Role</label>
                    <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{user.role}</div>
                  </div>
                </div>
              </div>

              {/* Password Change */}
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Change Password</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label>New Password</label>
                    <input
                      type="password"
                      className="input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      className="input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button className="btn" onClick={changePassword}>Change Password</button>
                </div>
              </div>

              {/* Appearance */}
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Appearance</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label>Theme</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        className={`btn ${settings.theme === 'light' ? 'secondary' : ''}`}
                        onClick={() => applyTheme('light')}
                      >
                        Light
                      </button>
                      <button
                        className={`btn ${settings.theme === 'dark' ? 'secondary' : ''}`}
                        onClick={() => applyTheme('dark')}
                      >
                        Dark
                      </button>
                    </div>
                  </div>
                  <div>
                    <label>Language</label>
                    <select
                      className="input"
                      value={settings.language}
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="en">English</option>
                      <option value="fil">Filipino</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Clinical Settings */}
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Clinical Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="label-muted">Measurement Units</label>
                    <select
                      className="input"
                      value={settings.clinical_units}
                      onChange={(e) => handleSettingChange('clinical_units', e.target.value)}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="metric">Metric (kg, cm)</option>
                      <option value="imperial">Imperial (lbs, in)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-muted">Date Format</label>
                    <select
                      className="input"
                      value={settings.date_format}
                      onChange={(e) => handleSettingChange('date_format', e.target.value)}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-muted">Time Format</label>
                    <select
                      className="input"
                      value={settings.time_format}
                      onChange={(e) => handleSettingChange('time_format', e.target.value)}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="12h">12-hour</option>
                      <option value="24h">24-hour</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Security Settings */}
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Security Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="label-muted">Session Timeout (minutes)</label>
                    <select
                      className="input"
                      value={settings.session_timeout}
                      onChange={(e) => handleSettingChange('session_timeout', e.target.value)}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="240">4 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-muted">Auto Logout (minutes)</label>
                    <select
                      className="input"
                      value={settings.auto_logout}
                      onChange={(e) => handleSettingChange('auto_logout', e.target.value)}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="5">5 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Application Settings */}
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Application Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="label-muted">Auto-save Forms</label>
                    <input
                      type="checkbox"
                      checked={settings.auto_save}
                      onChange={(e) => handleSettingChange('auto_save', e.target.checked)}
                      style={{ marginLeft: '8px' }}
                    />
                  </div>
                  <div>
                    <label className="label-muted">Email Notifications</label>
                    <input
                      type="checkbox"
                      checked={settings.notifications_email}
                      onChange={(e) => handleSettingChange('notifications_email', e.target.checked)}
                      style={{ marginLeft: '8px' }}
                    />
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <button className="btn" onClick={saveSettings}>Save All Settings</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Settings;
