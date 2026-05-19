// src/pages/MyProfile.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const MyProfile = () => {
  const { user: authUser, updateUser } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState({ name: '', role: '', email: '', avatar: '' });
  const [editableUser, setEditableUser] = useState({ name: '', avatar: '' });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({
    encountersCreated: 0,
    appointmentsScheduled: 0,
    patientsReferred: 0
  });

  // Recent activity entries (merged)
  const [recentActivity, setRecentActivity] = useState([]);

  // Modal for viewing all activity
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [modalTab, setModalTab] = useState('audit'); // 'audit' | 'encounters' | 'appointments'
  const [modalData, setModalData] = useState({ audit: [], encounters: [], appointments: [] });
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!authUser) return;

      // Format display name like in sidebar
      let displayName = authUser.name || '';
      const prefix = (authUser.email || '').split('.')[0].toLowerCase();
      if (prefix === 'dr' && displayName && !displayName.startsWith('Dr.')) {
        displayName = `Dr. ${displayName}`;
      } else if (prefix === 'nurse' && displayName && !displayName.startsWith('Nr.')) {
        displayName = `Nr. ${displayName.replace(/^(Nurse\s+)?/, '')}`;
      } else if (prefix === 'admin' && displayName) {
        displayName = `Admin ${displayName}`;
      }

      // Capitalize role
      const roleFormatted = authUser.role ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1) : '';

      setUser({ name: displayName, role: roleFormatted, email: authUser.email, avatar: authUser.avatar });
      setEditableUser({ name: displayName, avatar: authUser.avatar });

      try {
        // Fetch statistics
        const { count: encountersCount } = await supabase
          .from('encounters')
          .select('*', { count: 'exact', head: true })
          .eq('clinician_name', displayName);

        const { count: appointmentsCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('clinician_name', displayName);

        setStats({
          encountersCreated: encountersCount || 0,
          appointmentsScheduled: appointmentsCount || 0,
          patientsReferred: 0 // Placeholder, can implement later
        });
      } catch (err) {
        console.warn('Error fetching stats for profile:', err);
      }

      // Build merged recent activity feed with robust matching
      try {
        const normalize = (s = '') => {
          if (!s) return '';
          return s.toString().toLowerCase().replace(/\b(dr|nr|nurse|admin)\b\.?/g, '').replace(/[^a-z0-9\s]/g, '').trim();
        };

        const matchesClinician = (clinicianField) => {
          const c = normalize(clinicianField || '');
          const namesToCheck = [
            normalize(displayName),
            normalize(authUser.name),
            normalize(authUser.email),
            (authUser.id || '').toString()
          ].filter(Boolean);

          // direct id match
          if (namesToCheck.includes((clinicianField || '').toString())) return true;

          for (const n of namesToCheck) {
            if (!n) continue;
            if (c === n) return true;
            if (c.includes(n) || n.includes(c)) return true;
            const parts = n.split(/\s+/).filter(Boolean);
            for (const p of parts) {
              if (p.length > 2 && c.includes(p)) return true;
            }
          }
          return false;
        };

        // 1) recent audit logs
        const { data: logs, error: logsErr } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40);

        const auditEntries = (!logsErr && Array.isArray(logs)) ? logs : [];

        const filteredAudit = auditEntries.filter(l => {
          const performedBy = (l.performed_by || '').toString();
          return matchesClinician(performedBy);
        }).map(l => ({
          id: l.id,
          source: 'audit',
          action: l.action || l.type || 'Activity',
          detail: l.detail || l.message || l.description || JSON.stringify(l.meta || {}),
          created_at: l.created_at,
          raw: l
        }));

        // 2) recent encounters (last 50)
        let encounterEntries = [];
        try {
          const { data: encs, error: encErr } = await supabase
            .from('encounters')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!encErr && Array.isArray(encs)) {
            encounterEntries = encs.filter(e => {
              return matchesClinician(e.clinician_name) || matchesClinician(e.clinician_id) || matchesClinician(e.clinician);
            }).map(e => ({
              id: e.id,
              source: 'encounter',
              action: `Encounter: ${e.chief_complaint || (e.assessment_plan ? e.assessment_plan.split(',')[0] : 'Consult')}`,
              detail: `Patient: ${e.patient_id || e.patient_name || 'Unknown'}`,
              created_at: e.created_at || e.encounter_date || null,
              raw: e
            }));
          }
        } catch (e) {
          console.warn('Error fetching encounters for recent activity', e);
        }

        // 3) recent appointments (last 50)
        let appointmentEntries = [];
        try {
          const { data: appts, error: apptErr } = await supabase
            .from('appointments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!apptErr && Array.isArray(appts)) {
            appointmentEntries = appts.filter(a => {
              return matchesClinician(a.clinician_name) || matchesClinician(a.clinician_id) || matchesClinician(a.clinician);
            }).map(a => ({
              id: a.id,
              source: 'appointment',
              action: `Appointment: ${a.type || 'Appointment'} (${a.status || 'Scheduled'})`,
              detail: `Patient: ${a.patient_id || a.patient_name || 'Unknown'} on ${a.appointment_date || ''} ${a.appointment_time || ''}`,
              created_at: a.created_at || (a.appointment_date ? `${a.appointment_date}T00:00:00Z` : null),
              raw: a
            }));
          }
        } catch (e) {
          console.warn('Error fetching appointments for recent activity', e);
        }

        // Merge and sort
        const merged = [
          ...filteredAudit,
          ...encounterEntries,
          ...appointmentEntries
        ].filter(x => x && x.created_at)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);

        setRecentActivity(merged);
      } catch (err) {
        console.warn('Error building recent activity:', err);
        setRecentActivity([]);
      }

      setLoading(false);
    };

    fetchProfileData();
  }, [authUser]);

  // ---------- Modal: load full activity on demand ----------
  const openActivityModal = async () => {
    setShowActivityModal(true);
    setModalLoading(true);
    try {
      const [aRes, eRes, pRes] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('encounters').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('appointments').select('*').order('created_at', { ascending: false }).limit(200)
      ]);

      setModalData({
        audit: aRes.data || [],
        encounters: eRes.data || [],
        appointments: pRes.data || []
      });
    } catch (err) {
      console.error('Error loading modal activity data', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeActivityModal = () => {
    setShowActivityModal(false);
    setModalTab('audit');
  };

  // Navigate helpers for clickable rows
  const openActivity = (act) => {
    if (!act) return;
    if (act.source === 'encounter') {
      // some apps use /encounter to open a new encounter view
      navigate(`/encounter?id=${act.id}`);
    } else if (act.source === 'appointment') {
      // open appointment detail page — adjust route as your app expects
      navigate(`/appointments?id=${act.id}`);
    } else if (act.source === 'audit') {
      // for audit entries maybe open nothing or navigate to a related item if available
      // attempt to parse raw metadata for an encounter/appointment id
      const raw = act.raw || {};
      // try common fields
      const possibleId = raw?.reference_id || raw?.item_id || raw?.encounter_id || raw?.appointment_id;
      if (possibleId) {
        // try encounter first
        navigate(`/encounter?id=${possibleId}`);
      } else {
        // fallback: just show the audit detail in the modal (we keep user on profile)
        // no navigation
        setMessage('This audit entry has no direct link.');
        setMessageType('info');
        setTimeout(() => setMessage(''), 2000);
      }
    }
  };

  const startEdit = () => {
    setEditableUser({ ...user });
    setIsEditing(true);
    setMessage('');
  };

  const cancelEdit = () => {
    setEditableUser({ ...user });
    setIsEditing(false);
    setMessage('');
  };

  const saveProfile = async () => {
    if (!editableUser.name.trim()) {
      setMessage('Name cannot be empty.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('users')
        .update({
          name: editableUser.name,
          avatar: editableUser.avatar || null
        })
        .eq('id', authUser.id);

      if (error) throw error;

      // Update local state
      setUser(prev => ({
        ...prev,
        name: editableUser.name,
        avatar: editableUser.avatar
      }));

      // Update auth context if needed
      if (updateUser) {
        updateUser({
          ...authUser,
          name: editableUser.name,
          avatar: editableUser.avatar
        });
      }

      setIsEditing(false);
      setMessage('Profile updated successfully!');
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditableUser(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (limit to 2MB to keep database size manageable)
    if (file.size > 2 * 1024 * 1024) {
      setMessage('File size too large. Please select an image under 2MB.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUploading(true);

    // Convert to base64 for storage
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target.result;

      // Update editable user with the base64 image
      setEditableUser(prev => ({ ...prev, avatar: base64String }));
      setUploading(false);
      setMessage('Avatar selected successfully!');
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    };
    reader.onerror = () => {
      setMessage('Error reading file.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const openFileInput = () => {
    const el = document.getElementById('avatarInput');
    if (el) el.click();
  };

  if (loading) return <main className="main"><div className="card">Loading profile...</div></main>;

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
          <h2>My Profile</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'start', marginTop: '20px' }}>
            {/* Profile Picture */}
            <div style={{ textAlign: 'center' }}>
              <img
                src={isEditing ? (editableUser.avatar || '/src/assets/images/avatar-placeholder.jpg') : (user.avatar || '/src/assets/images/avatar-placeholder.jpg')}
                alt="Profile"
                onClick={isEditing ? openFileInput : undefined}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: isEditing ? '3px solid var(--accent, #3b82f6)' : '3px solid var(--accent, #3b82f6)',
                  cursor: isEditing ? 'pointer' : 'default',
                  opacity: uploading ? 0.5 : 1
                }}
              />
              {isEditing && (
                <>
                  <input
                    id="avatarInput"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                    Click image to upload avatar
                  </div>
                </>
              )}
            </div>

            {/* Profile Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>Personal Information</h3>
                  {!isEditing ? (
                    <button className="btn" onClick={startEdit}>Edit Profile</button>
                  ) : (
                    <div>
                      <button className="btn secondary" onClick={cancelEdit} style={{ marginRight: '8px' }}>Cancel</button>
                      <button className="btn" onClick={saveProfile}>Save</button>
                    </div>
                  )}
                </div>
                {!isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="label-muted">Display Name</label>
                      <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{user.name}</div>
                    </div>
                    <div>
                      <label className="label-muted">Role</label>
                      <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{user.role}</div>
                    </div>
                    <div>
                      <label className="label-muted">Email Address</label>
                      <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{user.email}</div>
                    </div>
                    <div>
                      <label className="label-muted">Account Status</label>
                      <div style={{ color: 'var(--muted)', marginTop: '4px' }}>Active</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label>Display Name</label>
                      <input
                        type="text"
                        name="name"
                        value={editableUser.name}
                        onChange={handleEditChange}
                        className="input"
                        placeholder="Enter your name"
                      />
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      Note: Role and Email cannot be changed from this page. Click the avatar image to upload a photo.
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Account Statistics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.encountersCreated}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Encounters Created</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.appointmentsScheduled}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Appointments Scheduled</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.patientsReferred}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Patients Referred</div>
                  </div>
                </div>
              </div>

              <div className="card">
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }}
  >
    <h3 style={{ margin: 0 }}>Recent Activity</h3>

    <button className="btn secondary" onClick={openActivityModal}>
      View all activity
    </button>
  </div>

                {/* Render recentActivity if present, otherwise show no recent activity */}
                {recentActivity && recentActivity.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recentActivity.map(act => (
                      <button
                        key={act.id || `${act.created_at}-${Math.random()}`}
                        onClick={() => openActivity(act)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px',
                          borderRadius: 8,
                          background: 'rgba(0,0,0,0.02)',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                        title={act.detail || ''}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{act.action || act.type || 'Activity'}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{act.detail || act.message || ''}</div>
                        </div>
                        <div style={{ color: 'var(--muted)', marginLeft: 12, fontSize: 12, textAlign: 'right' }}>
                          {act.created_at ? new Date(act.created_at).toLocaleString() : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                    No recent activity to display.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Activity Modal */}
      {showActivityModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000,
          padding: 20
        }}>
          <div style={{ width: '96%', maxWidth: 1000, background: 'var(--panel)', borderRadius: 12, padding: 16, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>All Activity</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn ${modalTab === 'audit' ? '' : 'secondary'}`} onClick={() => setModalTab('audit')}>Audit Logs</button>
                <button className={`btn ${modalTab === 'encounters' ? '' : 'secondary'}`} onClick={() => setModalTab('encounters')}>Encounters</button>
                <button className={`btn ${modalTab === 'appointments' ? '' : 'secondary'}`} onClick={() => setModalTab('appointments')}>Appointments</button>
                <button className="btn small secondary" onClick={closeActivityModal}>Close</button>
              </div>
            </div>

            {modalLoading ? (
              <div style={{ padding: 20, color: 'var(--muted)' }}>Loading activity…</div>
            ) : (
              <div>
                {modalTab === 'audit' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr><th>Time</th><th>Action</th><th>Performed By</th><th>Detail</th></tr>
                      </thead>
                      <tbody>
                        {(modalData.audit || []).map(row => (
                          <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => {
                            // try to navigate to related item if possible
                            const possibleId = row.reference_id || row.item_id || row.encounter_id || row.appointment_id;
                            if (possibleId) {
                              // try encounter first
                              navigate(`/encounter?id=${possibleId}`);
                              closeActivityModal();
                            } else {
                              setMessage('No direct link for this audit log.');
                              setMessageType('info');
                              setTimeout(() => setMessage(''), 2000);
                            }
                          }}>
                            <td>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td>
                            <td>{row.action || row.type}</td>
                            <td>{row.performed_by}</td>
                            <td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.detail || row.message || JSON.stringify(row.meta || {})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {modalTab === 'encounters' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr><th>Time</th><th>ID</th><th>Patient</th><th>Clinician</th><th>Complaint</th></tr>
                      </thead>
                      <tbody>
                        {(modalData.encounters || []).map(row => (
                          <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => { navigate(`/encounter?id=${row.id}`); closeActivityModal(); }}>
                            <td>{row.created_at ? new Date(row.created_at).toLocaleString() : (row.encounter_date ? new Date(row.encounter_date).toLocaleString() : '')}</td>
                            <td>{row.id}</td>
                            <td>{row.patient_name || row.patient_id}</td>
                            <td>{row.clinician_name || row.clinician}</td>
                            <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.chief_complaint || (row.assessment_plan ? row.assessment_plan.split(',')[0] : '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {modalTab === 'appointments' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr><th>Time</th><th>ID</th><th>Patient</th><th>Clinician</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {(modalData.appointments || []).map(row => (
                          <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => { navigate(`/appointments?id=${row.id}`); closeActivityModal(); }}>
                            <td>{row.created_at ? new Date(row.created_at).toLocaleString() : (row.appointment_date ? `${row.appointment_date} ${row.appointment_time || ''}` : '')}</td>
                            <td>{row.id}</td>
                            <td>{row.patient_name || row.patient_id}</td>
                            <td>{row.clinician_name || row.clinician}</td>
                            <td>{row.status || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default MyProfile;
