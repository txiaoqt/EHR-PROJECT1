import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { logAudit } from '../utils.js';

const Patients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    const fetchPatients = async () => {
      const { data, error } = await supabase.from('patients').select('*').order('name');
      if (!error) {
        setPatients(data || []);
      } else {
        console.error('Error fetching patients:', error);
      }
    };
    fetchPatients();
  }, []);
  const [search, setSearch] = useState('');

  const filteredPatients = patients.filter(p =>
    search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
  );

  const handleOpenProfile = (id) => {
    navigate('/patient-profile', { state: { patientId: id } });
  };

  const handleNewEncounter = (patient) => {
    navigate('/encounter', { params: { patientId: patient.id, patientName: patient.name } });
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDeletePatient = (patient) => {
    setDeleteConfirm(patient);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      console.log('Attempting to delete patient:', deleteConfirm.id);
      const { error } = await supabase.from('patients').delete().eq('id', deleteConfirm.id);
      if (!error) {
        setPatients(prev => prev.filter(p => p.id !== deleteConfirm.id));
        setDeleteConfirm(null);
      } else {
        console.error('Error deleting patient:', error);
        setDeleteConfirm(null);
        alert('Error deleting patient');
      }
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const [showForm, setShowForm] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', id: '', year: 1 });
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState([]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!studentSearch) return [];
      const { data } = await supabase
        .from('students')
        .select('id, name, year')
        .or(`name.ilike.%${studentSearch}%,id.ilike.%${studentSearch}%`)
        .limit(10);
      setStudentSuggestions(data || []);
    };
    fetchStudents();
  }, [studentSearch]);

  const handleNewPatient = () => setShowForm(!showForm);

  const submitNewPatient = async () => {
    const lastVisit = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('patients').insert([{ ...newPatient, last_visit_date: lastVisit }]);
    if (!error) {
      setPatients(prev => [...prev, { ...newPatient, last_visit_date: lastVisit, created_at: new Date().toISOString() }]);
      // Log audit entry
      await logAudit('Patient Registration', `Registered new patient: ${newPatient.name} (${newPatient.id})`);
      setShowForm(false);
      setNewPatient({ name: '', id: '', year: 1 });
      setStudentSearch('');
      setStudentSuggestions([]);
    } else {
      alert('Error registering patient');
    }
  };

  return (
    <main className="main">
      <section className="page">
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Patients</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="patients-search"
                type="search"
                placeholder="Search by name, student number..."
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', minWidth: '300px' }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button className="btn" onClick={handleNewPatient}>Register Patient</button>
            </div>
          </div>
          {showForm && (
            <div style={{ marginTop: '12px' }} className="card">
              <h3>Register New Patient</h3>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input
                  placeholder="Search and select student..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                {studentSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', zIndex: 10 }}>
                    {studentSuggestions.map(s => (
                      <div key={s.id} onClick={() => { setStudentSearch(s.name + ' (' + s.id + ')'); setNewPatient(s); setStudentSuggestions([]); }} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                        {s.name} ({s.id}, Year {s.year})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {newPatient.id && (
                <div style={{ marginBottom: '8px' }}>
                  Selected: <strong>{newPatient.name} ({newPatient.id}, Year {newPatient.year})</strong>
                </div>
              )}
              <button className="btn" onClick={submitNewPatient} disabled={!newPatient.id}>Register Patient</button>
            </div>
          )}
          {deleteConfirm && (
            <div className="card" style={{ marginTop: '12px', marginBottom: '12px', border: '1px solid var(--danger)', background: 'rgba(220, 53, 69, 0.05)' }}>
              <div>Are you sure you want to delete patient <strong>{deleteConfirm.name}</strong>?</div>
              <div style={{ marginTop: '8px' }}>
                <button className="btn" style={{ background: 'red', color: 'white' }} onClick={confirmDelete}>Yes, Delete</button>
                <button className="btn" style={{ background: 'transparent', color: 'var(--muted)' }} onClick={cancelDelete}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ marginBottom: '10px', color: 'var(--muted)', fontSize: '13px' }}>
            Results: <span>{filteredPatients.length}</span>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ textAlign: 'left', color: 'var(--muted)', fontSize: '13px' }}>
                <tr>
                  <th style={{ padding: '10px 8px' }}>Name</th>
                  <th style={{ padding: '10px 8px' }}>Student #</th>
                  <th style={{ padding: '10px 8px' }}>Year</th>
                  <th style={{ padding: '10px 8px' }}>Last Visit</th>
                  <th style={{ padding: '10px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(patient => (
                  <tr key={patient.id} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '10px 8px' }}>{patient.name}</td>
                    <td style={{ padding: '10px 8px' }}>{patient.id}</td>
                    <td style={{ padding: '10px 8px' }}>{patient.year}</td>
                    <td style={{ padding: '10px 8px' }}>{patient.last_visit_date}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <button className="btn" onClick={() => handleOpenProfile(patient.id)}>Open</button>
                      <button className="btn" style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.03)' }} onClick={() => handleNewEncounter(patient)}>New Encounter</button>
                      <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={() => handleDeletePatient(patient)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Patients;
