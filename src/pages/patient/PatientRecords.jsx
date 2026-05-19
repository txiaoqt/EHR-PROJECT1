import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';

const PatientRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.patient_id) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('encounters')
        .select('id, encounter_date, clinician_name, chief_complaint, assessment_plan, vitals, status')
        .eq('patient_id', user.patient_id)
        .order('encounter_date', { ascending: false });
      if (!mounted) return;
      setRecords(data || []);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [user?.patient_id]);

  return (
    <main className="main">
      <section className="page">
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Records</h2>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            View your encounter summaries and vitals.
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Encounter History</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Doctor</th>
                <th>Chief Complaint</th>
                <th>Assessment / Plan</th>
                <th>Vitals</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5}>No records yet.</td></tr>
              ) : records.map((r) => (
                <tr key={r.id}>
                  <td>{r.encounter_date ? new Date(r.encounter_date).toLocaleString() : '-'}</td>
                  <td>{r.clinician_name || '-'}</td>
                  <td>{r.chief_complaint || '-'}</td>
                  <td>{r.assessment_plan || '-'}</td>
                  <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>{JSON.stringify(r.vitals || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default PatientRecords;
