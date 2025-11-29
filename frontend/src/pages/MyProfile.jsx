import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../AuthContext.jsx';

const MyProfile = () => {
  const { user: authUser, updateUser } = useAuth();
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

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!authUser) return;

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

      setUser({ name: displayName, role: roleFormatted, email: authUser.email, avatar: authUser.avatar });
      setEditableUser({ name: displayName, avatar: authUser.avatar });

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

      setLoading(false);
    };

    fetchProfileData();
  }, [authUser]);

  if (loading) return <main className="main"><div className="card">Loading profile...</div></main>;

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
    document.getElementById('avatarInput').click();
  };

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
                <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
                <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                  No recent activity to display.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default MyProfile;
