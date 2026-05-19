import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.patient_id) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      const [{ data: appts }, { count }] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .eq('patient_id', user.patient_id)
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true }),
        supabase
          .from('encounters')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', user.patient_id),
      ]);

      if (!mounted) return;
      setAppointments(appts || []);
      setRecordsCount(count || 0);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [user?.patient_id]);

  const nextAppointment = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (appointments || []).find((a) => a.appointment_date >= today && a.status !== 'Cancelled') || null;
  }, [appointments]);

  return (
    <main className="main">
      <section className="page patient-dashboard-page">
        <div className="card patient-welcome-card">
          <h2 style={{ margin: 0 }}>Welcome, {user?.name || 'Patient'}</h2>
          <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
            Manage your appointments, messages, and clinic records.
          </div>
        </div>

        <div className="patient-main-grid">
          <div className="card patient-dashboard-card">
            <h3 className="patient-card-title">Next Appointment</h3>
            {loading ? (
              <div style={{ color: 'var(--muted)' }}>Loading...</div>
            ) : nextAppointment ? (
              <div className="patient-next-appt-content">
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {nextAppointment.appointment_date} {nextAppointment.appointment_time}
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 6 }}>
                  {nextAppointment.type} • {nextAppointment.status}
                </div>
              </div>
            ) : (
              <div className="patient-empty-state">
                <div style={{ fontWeight: 600 }}>No upcoming appointment yet</div>
                <div style={{ color: 'var(--muted)', marginTop: 6 }}>
                  Book a schedule to reserve your clinic visit.
                </div>
              </div>
            )}
            <div className="patient-btn-row">
              <button className="btn" onClick={() => navigate('/patient/schedule')}>Book Appointment</button>
              <button className="btn secondary" onClick={() => navigate('/patient/messages')}>Message Doctor</button>
            </div>
          </div>

          <div className="card patient-dashboard-card">
            <h3 className="patient-card-title">Quick Summary</h3>
            <div className="patient-summary-grid">
              <div className="patient-stat-box">
                <div className="patient-stat-value">{appointments.length}</div>
                <div className="patient-stat-label">Total Appointments</div>
              </div>
              <div className="patient-stat-box">
                <div className="patient-stat-value">{recordsCount}</div>
                <div className="patient-stat-label">Encounter Records</div>
              </div>
            </div>
            <div className="patient-btn-row">
              <button className="btn secondary" onClick={() => navigate('/patient/records')}>View Records</button>
              <button className="btn secondary" onClick={() => navigate('/patient/profile')}>Update Profile</button>
            </div>
          </div>
        </div>

        <div className="patient-preview-grid">
          <div className="card patient-dashboard-card">
            <h3 className="patient-card-title">Clinic History Preview</h3>
            <div className="patient-preview-item">No recent clinic visits yet</div>
            <div className="patient-preview-item">Completed consultations will appear here</div>
          </div>
          <div className="card patient-dashboard-card">
            <h3 className="patient-card-title">Messages Preview</h3>
            <div className="patient-preview-item">
              Doctor replies and follow-up messages are available in the Messages tab.
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn secondary" onClick={() => navigate('/patient/messages')}>Open Messages</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default PatientDashboard;
