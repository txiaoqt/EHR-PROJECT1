import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';

const PatientProfilePortal = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    id: '',
    name: '',
    year: '',
    medications: '',
    allergies: '',
    notes: '',
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.patient_id) return;
      const { data } = await supabase.from('patients').select('*').eq('id', user.patient_id).maybeSingle();
      if (!mounted || !data) return;
      setProfile({
        id: data.id,
        name: data.name || '',
        year: data.year || '',
        medications: data.medications || '',
        allergies: data.allergies || '',
        notes: data.notes || '',
      });
    };
    load();
    return () => { mounted = false; };
  }, [user?.patient_id]);

  useEffect(() => {
    if (msg) setMsgOpen(true);
  }, [msg]);

  const save = async () => {
    if (!user?.patient_id || !profile.name.trim()) return;
    setSaving(true);
    setMsg('');
    const payload = {
      name: profile.name.trim(),
      year: Number(profile.year || 1),
      allergies: profile.allergies || null,
      medications: profile.medications || null,
      notes: profile.notes || null,
    };
    const { error } = await supabase.from('patients').update(payload).eq('id', user.patient_id);
    if (error) {
      setMsg(`Unable to save profile: ${error.message}`);
      setSaving(false);
      return;
    }
    updateUser?.({ name: payload.name });
    setMsg('Profile saved.');
    setEditing(false);
    setSaving(false);
  };

  return (
    <main className="main">
      <section className="page patient-dashboard-page">
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Profile</h2>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            Keep your patient details up to date for scheduling and consultations.
          </div>
        </div>

        <div className="card patient-profile-card">
          <div className="patient-profile-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Personal Details</h3>
            {!editing ? (
              <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <div className="patient-profile-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}
          </div>

          <div className="patient-summary-grid patient-profile-grid">
            <div>
              <label>Name</label>
              <input className="input" value={profile.name} disabled={!editing} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label>Year</label>
              <input className="input" type="number" min={1} max={5} value={profile.year} disabled={!editing} onChange={(e) => setProfile((p) => ({ ...p, year: e.target.value }))} />
            </div>
            <div>
              <label>Medications</label>
              <textarea className="input" style={{ width: '100%', minHeight: 80 }} value={profile.medications} disabled={!editing} onChange={(e) => setProfile((p) => ({ ...p, medications: e.target.value }))} />
            </div>
            <div>
              <label>Allergies</label>
              <textarea className="input" style={{ width: '100%', minHeight: 80 }} value={profile.allergies} disabled={!editing} onChange={(e) => setProfile((p) => ({ ...p, allergies: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="input" style={{ width: '100%', minHeight: 100 }} value={profile.notes} disabled={!editing} onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        {msgOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3200, padding: 14 }}
            onClick={() => setMsgOpen(false)}
          >
            <div
              style={{ width: 'min(92vw, 520px)', background: 'var(--panel)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 18px 38px rgba(0,0,0,0.18)', padding: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Profile Notice</div>
              <div style={{ color: msg.toLowerCase().includes('unable') ? 'var(--danger)' : 'var(--text)', lineHeight: 1.45 }}>{msg}</div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn secondary" onClick={() => setMsgOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default PatientProfilePortal;
