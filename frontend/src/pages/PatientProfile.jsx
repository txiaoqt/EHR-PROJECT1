import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const PatientProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const id = searchParams.get('id') || (location.state && location.state.patientId);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState([]);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [notes, setNotes] = useState([]);
  const [vitalsData, setVitalsData] = useState(null);
  const [editingMedications, setEditingMedications] = useState(false);
  const [editingAllergies, setEditingAllergies] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingAttachments, setEditingAttachments] = useState(false);
  const [newMedications, setNewMedications] = useState('');
  const [newAllergies, setNewAllergies] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        // Fetch patient
        const { data: patientData, error: patientError } = await supabase.from('patients').select('id, name, year, created_at, updated_at, last_visit_date').eq('id', id).single();
        if (!patientError) {
          setPatient(patientData);
        } else {
          console.error('Error fetching patient:', patientError);
        }

        // Fetch encounters
        const { data: encData } = await supabase.from('encounters').select('*').eq('patient_id', id).order('created_at', { ascending: false });
        setEncounters(encData || []);

        // Fetch encounters with vitals for history
        const { data: vitalsEncData } = await supabase.from('encounters').select('encounter_date, vitals').eq('patient_id', id).not('vitals', 'is', null).order('encounter_date', { ascending: true });
        const vitals = vitalsEncData.map(enc => ({ date: enc.encounter_date, ...enc.vitals }));
        setVitalsHistory(vitals);

        // Prepare chart data
        if (vitals.length > 0) {
          const labels = vitals.map(v => new Date(v.date).toLocaleDateString());
          const temps = vitals.map(v => v.temp).filter(t => t);
          const pulses = vitals.map(v => v.pulse).filter(p => p);
          setVitalsData({
            labels,
            datasets: [
              {
                label: 'Temperature (°C)',
                data: temps,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                tension: 0.1
              },
              {
                label: 'Pulse (bpm)',
                data: pulses,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                tension: 0.1
              }
            ]
          });
        }

        setLoading(false);
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [id]);

  const saveData = async (field, value) => {
    try {
      const { error } = await supabase.from('patients').update({ [field]: value }).eq('id', id);
      if (!error) {
        setPatient(prev => ({ ...prev, [field]: value }));
      } else {
        alert(`Error saving ${field}: ${error.message}`);
      }
    } catch (err) {
      alert(`Error saving ${field}: Column may not exist in database. Please add the column via SQL: ALTER TABLE patients ADD COLUMN ${field} TEXT;`);
    }
  };

  const handleSaveAttachments = async () => {
    const uploadedUrls = [];
    for (const file of selectedFiles) {
      const fileName = `${id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('attachments').upload(fileName, file);
      if (!error) {
        const { data: url } = supabase.storage.from('attachments').getPublicUrl(fileName);
        uploadedUrls.push(url.publicUrl);
      }
    }
    const newAttachments = [...(patient.attachments || []), ...uploadedUrls];
    await saveData('attachments', newAttachments);
    setEditingAttachments(false);
    setSelectedFiles([]);
  };

  if (loading) return <main className="main"><div className="card">Loading...</div></main>;

  if (!patient) return <main className="main"><div className="card">Patient not found.</div></main>;

  return (
    <main className="main">
      <section className="page" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card">
          <h2>Patient Profile</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><strong>Name:</strong> {patient.name}</div>
            <div><strong>Student ID:</strong> {patient.id}</div>
            <div><strong>Year:</strong> {patient.year}</div>
            <div><strong>Last Visit:</strong> {patient.last_visit_date}</div>
          </div>
          <button className="btn" onClick={() => navigate('/patients')}>Back</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="card">
            <h3>Encounters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {encounters.length > 0 ? encounters.map(enc => (
                <div key={enc.id} style={{ padding: '8px', border: '1px solid var(--muted)', borderRadius: '4px' }}>
                  <div><strong>Date:</strong> {new Date(enc.encounter_date).toLocaleDateString()}</div>
                  <div><strong>Complaint:</strong> {enc.chief_complaint || 'N/A'}</div>
                  <div><strong>Assessment:</strong> {enc.assessment_plan || 'N/A'}</div>
                </div>
              )) : <div>No encounters found.</div>}
            </div>
            <button className="btn" onClick={() => navigate('/encounter', { state: { patientId: id } })}>New Encounter</button>
          </div>

          <div className="card">
            <h3>Vitals History</h3>
            {vitalsData ? <Line data={vitalsData} /> : <div>No vitals history.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
              {vitalsHistory.map((vital, index) => (
                <div key={index} style={{ padding: '4px', borderBottom: '1px solid #eee' }}>
                  <strong>{new Date(vital.date).toLocaleDateString()}:</strong> Temp: {vital.temp}°, Pulse: {vital.pulse} bpm, BP: {vital.bp}, Weight: {vital.weight} kg
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Medications / Allergies</h3>
            <div>
              <h4>Medications:</h4>
              {editingMedications ? (
                <div>
                  <textarea value={newMedications} onChange={(e) => setNewMedications(e.target.value)} style={{ width: '100%', minHeight: '60px' }} />
                  <button className="btn" onClick={() => { saveData('medications', newMedications); setEditingMedications(false); }}>Save</button>
                  <button className="btn" onClick={() => setEditingMedications(false)}>Cancel</button>
                </div>
              ) : (
                <div onClick={() => setEditingMedications(true)} style={{ cursor: 'pointer' }}>
                  {patient.medications || 'None'}
                </div>
              )}
            </div>
            <div>
              <h4>Allergies:</h4>
              {editingAllergies ? (
                <div>
                  <textarea value={newAllergies} onChange={(e) => setNewAllergies(e.target.value)} style={{ width: '100%', minHeight: '60px' }} />
                  <button className="btn" onClick={() => { saveData('allergies', newAllergies); setEditingAllergies(false); }}>Save</button>
                  <button className="btn" onClick={() => setEditingAllergies(false)}>Cancel</button>
                </div>
              ) : (
                <div onClick={() => setEditingAllergies(true)} style={{ cursor: 'pointer' }}>
                  {patient.allergies || 'None'}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Attachments & Scans</h3>
            {editingAttachments ? (
              <div>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                  style={{ width: '100%' }}
                />
                <button className="btn" onClick={handleSaveAttachments}>Save</button>
                <button className="btn" onClick={() => setEditingAttachments(false)}>Cancel</button>
              </div>
            ) : (
              <div onClick={() => setEditingAttachments(true)} style={{ cursor: 'pointer' }}>
                {patient.attachments && patient.attachments.length > 0 ? (
                  <ul>
                    {patient.attachments.map((att, index) => (
                      <li key={index}>
                        <a href={att} target="_blank" rel="noopener noreferrer">{att.split('/').pop()}</a>
                      </li>
                    ))}
                  </ul>
                ) : 'None'}
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Click to upload new files</div>
              </div>
            )}
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <h3>Notes / Messages</h3>
            {editingNotes ? (
              <div>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} style={{ width: '100%', minHeight: '100px' }} />
                <button className="btn" onClick={() => { saveData('notes', newNotes); setEditingNotes(false); }}>Save</button>
                <button className="btn" onClick={() => setEditingNotes(false)}>Cancel</button>
              </div>
            ) : (
              <div onClick={() => setEditingNotes(true)} style={{ cursor: 'pointer', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', background: '#f9f9f9' }}>
                {patient.notes || 'No notes or messages.'}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default PatientProfile;
