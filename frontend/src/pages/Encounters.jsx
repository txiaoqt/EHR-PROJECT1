import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNavigate } from 'react-router-dom';

const Encounters = () => {
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState([]);

  useEffect(() => {
    const fetchEncounters = async () => {
      const { data, error } = await supabase.from('encounters').select('*').order('created_at', { ascending: false });
      if (!error) {
        setEncounters(data || []);
      } else {
        console.error('Error fetching encounters:', error);
      }
    };
    fetchEncounters();
  }, []);

  const isActive = (encounterDate) => {
    const now = new Date();
    const encDate = new Date(encounterDate);
    const diffTime = Math.abs(now - encDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7; // consider active if within 7 days
  };

  const activeEncounters = encounters.filter(enc => isActive(enc.encounter_date));
  const historyEncounters = encounters.filter(enc => !isActive(enc.encounter_date));

  return (
    <main className="main">
      <section className="page">
        <h2 style={{ margin: 0 }}>Encounters</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
          <div className="card">
            <h3>New Encounter</h3>
            <button className="btn" onClick={() => navigate('/encounter')}>Create New Encounter</button>
          </div>
          <div className="card">
            <h3>Active Queue</h3>
            <div style={{ overflow: 'auto' }}>
              <table className="table" aria-label="Active Encounters table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Clinician</th>
                    <th>Date</th>
                    <th>Chief Complaint</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEncounters.map(enc => (
                    <tr key={enc.id}>
                      <td>{enc.patient_id}</td>
                      <td>{enc.clinician_name}</td>
                      <td>{new Date(enc.encounter_date).toLocaleString()}</td>
                      <td>{enc.chief_complaint || 'N/A'}</td>
                      <td>
                        <button className="btn" onClick={() => navigate(`/patient-profile?id=${enc.patient_id}`)}>View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3>Encounter History</h3>
            <div style={{ overflow: 'auto' }}>
              <table className="table" aria-label="Encounter History table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Clinician</th>
                    <th>Date</th>
                    <th>Chief Complaint</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEncounters.map(enc => (
                    <tr key={enc.id}>
                      <td>{enc.patient_id}</td>
                      <td>{enc.clinician_name}</td>
                      <td>{new Date(enc.encounter_date).toLocaleString()}</td>
                      <td>{enc.chief_complaint || 'N/A'}</td>
                      <td>
                        <button className="btn" onClick={() => navigate(`/patient-profile?id=${enc.patient_id}`)}>View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Encounters;
