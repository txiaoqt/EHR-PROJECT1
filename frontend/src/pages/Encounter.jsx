import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { logAudit } from '../utils.js';
import { useAuth } from '../AuthContext.jsx';

const fetchStudents = async (query) => {
  if (!query) return [];
  const { data } = await supabase
    .from('students')
    .select('id, name')
    .or(`name.ilike.%${query}%,id.ilike.%${query}%`)
    .limit(10);
  return data || [];
};

const Encounter = () => {
  const { user } = useAuth();

  // Function to format clinician name like in Sidebar
  const formatClinicianName = (userData) => {
    if (!userData) return '';
    let displayName = userData.name;
    const prefix = userData.email.split('.')[0].toLowerCase();
    if (prefix === 'dr' && !displayName.startsWith('Dr.')) {
      displayName = `Dr. ${displayName}`;
    } else if (prefix === 'nurse' && !displayName.startsWith('Nr.')) {
      displayName = `Nr. ${displayName.replace(/^(Nurse\s+)?/, '')}`;
    } else if (prefix === 'admin') {
      displayName = `Admin ${displayName}`;
    }
    return displayName;
  };

  const [form, setForm] = useState(() => ({
    patient: '',
    complaint: '',
    hpi: '',
    exam: '',
    plan: '',
    temp: '',
    pulse: '',
    bp: '',
    weight: '',
    visitType: 'Walk-in',
    clinician: user ? formatClinicianName(user) : '',
    date: '',
    attachment: null
  }));
  const [draftState, setDraftState] = useState('no draft');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState([]);

  useEffect(() => {
    const existing = localStorage.getItem('encounter_draft');
    if (existing) {
      try {
        const obj = JSON.parse(existing);
        setForm(prev => ({ ...prev, ...obj }));
        setDraftState('loaded');
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const suggestions = await fetchStudents(patientSearch);
      setPatientSuggestions(suggestions);
    };
    if (patientSearch) fetchSuggestions();
    else setPatientSuggestions([]);
  }, [patientSearch]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (e) => {
    setForm(prev => ({ ...prev, attachment: e.target.files[0] }));
  };

  const saveDraft = () => {
    const data = {
      patient: form.patient,
      complaint: form.complaint,
      hpi: form.hpi,
      exam: form.exam,
      plan: form.plan
    };
    localStorage.setItem('encounter_draft', JSON.stringify(data));
    setDraftState('saved');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Check if patient exists in patients table
      const { data: existingPatient, error: checkError } = await supabase
        .from('patients')
        .select('id')
        .eq('id', form.patient)
        .single();

      if (!existingPatient && !checkError) {
        // Patient not found, get from students
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, name, year')
          .eq('id', form.patient)
          .single();

        if (studentData && !studentError) {
          // Insert into patients from students data
          const { error: insertError } = await supabase.from('patients').insert([{
            id: studentData.id,
            name: studentData.name,
            year: studentData.year,
            last_visit_date: new Date().toISOString().split('T')[0] // today's date as last visit
          }]);
          if (insertError) {
            console.error('Error inserting patient:', insertError);
            alert('Error creating patient record.');
            return;
          }
        } else {
          alert('Patient ID not found in students. Please select a valid patient.');
          return;
        }
      } else if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is single row not found
        throw checkError;
      }

      const encDate = form.date || new Date().toISOString();
      const vitalsJson = {
        temp: form.temp,
        pulse: form.pulse,
        bp: form.bp,
        weight: form.weight
      };
      const { error } = await supabase.from('encounters').insert([{
        patient_id: form.patient,
        clinician_name: form.clinician,
        encounter_date: encDate,
        chief_complaint: form.complaint,
        hpi: form.hpi,
        physical_exam: form.exam,
        assessment_plan: form.plan,
        vitals: vitalsJson,
        attachments: []
      }]);
      if (error) throw error;
      // Log audit entry
      await logAudit('Encounter Creation', `Created new encounter for patient ${form.patient} - Chief complaint: ${form.complaint}`);
      // Dispatch event for dashboard update
      window.dispatchEvent(new CustomEvent('encounterAdded'));
      localStorage.removeItem('encounter_draft');
      setShowSuccessModal(true);
      setForm({
        patient: '',
        complaint: '',
        hpi: '',
        exam: '',
        plan: '',
        temp: '',
        pulse: '',
        bp: '',
        weight: '',
        visitType: 'Walk-in',
        clinician: user ? formatClinicianName(user) : '',
        date: '',
        attachment: null
      });
      setDraftState('no draft');
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving encounter.');
    }
  };

  const selectPatient = () => {
    alert('Open patient selection modal (implement later).');
  };

  return (
    <main className="main">
      <section className="page">
        <div className="card" style={{ maxWidth: '1100px', margin: '12px auto' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: 'red' }}>Encounter Page Loaded</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <h2 style={{ margin: 0 }}>New Encounter</h2>
            <div style={{ color: 'var(--muted)' }}>Draft autosave: <span>{draftState}</span></div>
          </div>
          <form onSubmit={handleSubmit} style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '18px' }}>
            <div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <label className="label-muted">Patient</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                  <input type="text" placeholder="Search patient (name or student #)" style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }} value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                  {patientSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', zIndex: 10 }}>
                      {patientSuggestions.map(s => (
                        <div key={s.id} onClick={() => { setPatientSearch(s.name + ' (' + s.id + ')'); setForm(prev => ({ ...prev, patient: s.id })); setPatientSuggestions([]); }} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                          {s.name} ({s.id})
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn" onClick={selectPatient}>Select</button>
                </div>
              </div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <label className="label-muted">Chief Complaint</label>
                <input id="complaint" className="input" type="text" placeholder="e.g., Fever, cough" value={form.complaint} onChange={handleChange} />
              </div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <label className="label-muted">History of Present Illness (HPI)</label>
                <textarea id="hpi" style={{ width: '100%', resize: 'vertical', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', fontFamily: 'inherit' }} rows="6" placeholder="Describe the HPI..." value={form.hpi} onChange={handleChange}></textarea>
              </div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <label className="label-muted">Physical Exam</label>
                <textarea id="exam" style={{ width: '100%', resize: 'vertical', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', fontFamily: 'inherit' }} rows="4" placeholder="Findings..." value={form.exam} onChange={handleChange}></textarea>
              </div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <label className="label-muted">Assessment / Plan</label>
                <textarea id="plan" style={{ width: '100%', resize: 'vertical', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', fontFamily: 'inherit' }} rows="4" placeholder="Assessment and plan..." value={form.plan} onChange={handleChange}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={saveDraft}>Save Draft</button>
                <button type="submit" className="btn">Save & Sign</button>
              </div>
            </div>
            <aside>
              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>Vitals</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input id="temp" className="input" placeholder="Temp" value={form.temp} onChange={handleChange} />
                  <input id="pulse" className="input" placeholder="Pulse" value={form.pulse} onChange={handleChange} />
                  <input id="bp" className="input" placeholder="BP" value={form.bp} onChange={handleChange} />
                  <input id="weight" className="input" placeholder="Weight" value={form.weight} onChange={handleChange} />
                </div>
              </div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>Metadata</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select id="visitType" className="input" value={form.visitType} onChange={handleChange}>
                    <option>Walk-in</option>
                    <option>Scheduled</option>
                    <option>Follow-up</option>
                  </select>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--panel)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    Clinician: <strong>{form.clinician || 'Not logged in'}</strong>
                  </div>
                  <input id="date" className="input" type="datetime-local" value={form.date} onChange={handleChange} />
                </div>
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 8px 0' }}>Attachments</h3>
                <input type="file" onChange={handleFileChange} />
              </div>
            </aside>
          </form>
        </div>
      </section>
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <p>Encounter saved successfully.</p>
            <button className="btn" onClick={() => setShowSuccessModal(false)}>OK</button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Encounter;
