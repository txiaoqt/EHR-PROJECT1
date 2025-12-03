import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { logAudit } from '../utils.js';
import { useAuth } from '../AuthContext.jsx';

const Appointments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);

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
  const [filter, setFilter] = useState('all');
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = dateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const [viewDate, setViewDate] = useState(new Date()); // for calendar month
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [selectedName, setSelectedName] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [checkInAppt, setCheckInAppt] = useState(null); // Store appointment to check-in

  // table search
  const [tableSearch, setTableSearch] = useState('');

  useEffect(() => {
    const fetchAppointments = async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: false });
      if (!error) {
        setAppointments(data || []);
      } else {
        console.error('Error fetching appointments:', error);
      }
    };
    fetchAppointments();
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!patientSearch) return [];
      const { data } = await supabase
        .from('students')
        .select('id, name')
        .or(`name.ilike.%${patientSearch}%,id.ilike.%${patientSearch}%`)
        .limit(10);
      setPatientSuggestions(data || []);
    };
    fetchSuggestions();
  }, [patientSearch]);

  const buildApptMap = () => {
    const map = {};
    appointments.forEach(appt => {
      const key = appt.appointment_date || todayKey;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  };

  const apptMap = buildApptMap();

  const filterTable = () => {
    // base filter by selected filter (all/today/queued/selected)
    let filtered = appointments.filter(appt => {
      if (filter === 'selected') return appt.appointment_date === selectedDate;
      if (filter === 'today') return appt.appointment_date === todayKey;
      if (filter === 'queued') return appt.status === 'Checked-in';
      return true; // filter === 'all'
    });

    // apply tableSearch (search by patient_id, student name if available, clinician, type)
    if (tableSearch && tableSearch.trim() !== '') {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter(appt => {
        const pid = (appt.patient_id || '').toString().toLowerCase();
        const name = (appt.students?.name || appt.patient_name || '').toString().toLowerCase();
        const clinician = (appt.clinician_name || '').toLowerCase();
        const type = (appt.type || '').toLowerCase();
        return pid.includes(q) || name.includes(q) || clinician.includes(q) || type.includes(q);
      });
    }

    return filtered;
  };

  const [showForm, setShowForm] = useState(false);
  const [newAppt, setNewAppt] = useState(() => ({
    patient_id: '',
    appointment_date: '',
    appointment_time: '',
    type: 'Consult',
    clinician_name: user ? formatClinicianName(user) : '',
    status: 'Scheduled'
  }));

  const handleNewAppointment = () => setShowForm(!showForm);

  const handleNewApptChange = (e) => {
    const { id, value } = e.target;
    setNewAppt(prev => ({ ...prev, [id]: value }));
  };

  const submitNewAppointment = async () => {
    try {
      if (!newAppt.patient_id) {
        alert('Please select a student for the appointment.');
        return;
      }
      if (!newAppt.appointment_date || !newAppt.appointment_time) {
        alert('Please fill in the appointment date and time.');
        return;
      }
      const { data, error } = await supabase.from('appointments').insert([newAppt]).select();
      if (error) throw error;
      // Success
      const newRecord = { ...data[0], students: { name: selectedName } };
      setAppointments(prev => [...prev, newRecord]);
      // Log audit entry
      const patientName = selectedName || newAppt.patient_id; // fallback to ID if name not available
      await logAudit('Appointment Creation', `Added new appointment - patient name: ${patientName} (${newAppt.patient_id}) on ${newAppt.appointment_date} at ${newAppt.appointment_time}`);
      // Dispatch event for dashboard update
      window.dispatchEvent(new CustomEvent('appointmentAdded'));
      setShowForm(false);
      setShowSuccessModal(true);
      // Reset form
      setPatientSearch('');
      setPatientSuggestions([]);
      setSelectedName('');
      setFilter('all');
      setNewAppt({
        patient_id: '',
        appointment_date: '',
        appointment_time: '',
        type: 'Consult',
        clinician_name: user ? formatClinicianName(user) : '',
        status: 'Scheduled'
      });
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving appointment: ' + err.message);
    }
  };

  const confirmCheckIn = async () => {
    if (!checkInAppt) return;
    // Update status
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'Checked-in' })
      .eq('id', checkInAppt.id);
    if (!error) {
      // Update local state to reflect change
      setAppointments(prev => prev.map(a => a.id === checkInAppt.id ? { ...a, status: 'Checked-in' } : a));
      // Dispatch event for dashboard update
      window.dispatchEvent(new CustomEvent('appointmentUpdated'));
      // Log audit
      await logAudit('Appointment Status Change', `Checked-in ${checkInAppt.patient_id} for ${checkInAppt.appointment_time}`);
      setCheckInAppt(null);
      navigate('/encounter');
    }
  };

  const handleAction = async (appt, action) => {
    if (action === 'check-in') {
      setCheckInAppt(appt);
    } else if (action === 'open') {
      alert(`Opening encounter page for ${appt.patient_id}.`);
      navigate('/encounter');
    }
  };

  const renderCalendar = () => {
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let day = 1; day <= last.getDate(); day++) days.push(day);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 24px' }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}>←</button>
          <strong style={{ flex: 1, textAlign: 'center' }}>{viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px', marginTop: '8px', padding: '0 24px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
            <div key={w} style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>{w}</div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={idx}></div>;
            const currentKey = dateKey(new Date(year, month, day));
            const isToday = currentKey === todayKey;
            const isSelected = currentKey === selectedDate;
            let styles = { padding: '6px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer' };
            if (isSelected) styles = { ...styles, background: 'var(--accent)', color: 'white', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
            else if (isToday) styles = { ...styles, border: '1px solid var(--accent)', background: 'rgba(140, 21, 21, 0.1)' };
            else styles = { ...styles, background: 'transparent' };
            return <div key={day} style={styles} onClick={() => { setSelectedDate(currentKey); setFilter(currentKey === todayKey ? 'today' : 'all'); }}>{day}</div>;
          })}
        </div>
      </div>
    );
  };

  const renderTracker = () => {
  const buttons = [];
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dateKey(d);
    const count = apptMap[key] || 0;
    const isToday = key === todayKey;
    const isSelected = key === selectedDate;

    let styles = {
      minWidth: '105px',          // ⬅ wider
      padding: '12px 10px',       // ⬅ more spacious
      borderRadius: '10px',
      border: '1px solid transparent',
      background: isToday ? 'linear-gradient(90deg,var(--accent),var(--danger))' : 'transparent',
      color: isToday ? '#fff' : 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: '0.15s ease',
    };

    if (isSelected && !isToday) {
      styles = { 
        ...styles,
        border: '1px solid var(--accent)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        background: 'transparent'
      };
    }

    buttons.push(
      <button
        key={key}
        style={styles}
        onClick={() => {
          setSelectedDate(key);
          setFilter(key === todayKey ? 'today' : 'selected');
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
        <div style={{ fontWeight: 700, fontSize: '20px', marginTop: '6px' }}>{d.getDate()}</div>
        {count > 0 && (
          <div style={{
            marginTop: '10px',
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'var(--danger)',
            color: '#fff',
            fontWeight: 600
          }}>
            {count}
          </div>
        )}
      </button>
    );
  }

  return (
    <div style={{
      width: '100%',
      overflowX: 'auto',
      display: 'flex',
      justifyContent: 'center',
      gap: '60px',              // ⬅ more spacing between buttons
      padding: '10px 6px',
    }}>
      {buttons}
    </div>
  );
};

  return (
    <main className="main">
      <section className="page">
        {/* Header row with filter, search and New Appointment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: 16 }}>
          <h2 style={{ margin: 0 }}>Appointments</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* table search bar */}
            <input
              type="search"
              className="input"
              placeholder="Search appointments..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="queued">Checked-in</option>
              {selectedDate && <option value="selected">Selected Date</option>}
            </select>


            <button className="btn" onClick={handleNewAppointment}>New Appointment</button>
          </div>
        </div>

        {/* New appointment form (unchanged) */}
        {showForm && (
          <div style={{ marginTop: '12px', marginBottom: '20px' }} className="card">
            <h3>New Appointment</h3>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Search student..."
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patientSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', zIndex: 10 }}>
                  {patientSuggestions.map(s => (
                    <div key={s.id} onClick={() => { setPatientSearch(s.name + ' (' + s.id + ')'); setSelectedName(s.name); setNewAppt(prev => ({ ...prev, patient_id: s.id })); setPatientSuggestions([]); }} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                      {s.name} ({s.id})
                    </div>
                  ))}
                </div>
              )}
            </div>
            {newAppt.patient_id && (
              <div style={{ marginBottom: '8px' }}>
                Selected: <strong>{patientSearch}</strong>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <input id="appointment_date" type="date" value={newAppt.appointment_date} onChange={handleNewApptChange} className="input" />
              <input id="appointment_time" type="time" value={newAppt.appointment_time} onChange={handleNewApptChange} className="input" />
              <select id="type" value={newAppt.type} onChange={handleNewApptChange} className="input">
                <option>Consult</option>
                <option>Follow-up</option>
              </select>
              <div style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
                Clinician: <strong>{newAppt.clinician_name || 'Not logged in'}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button
                type="button"
                className= "btn secondary"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  background: '#f3f3f3',
                  color: '#333',
                  cursor: 'pointer',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={submitNewAppointment}
                disabled={!newAppt.patient_id}
              >
                Save Appointment
              </button>
            </div>
          </div>
        )}

        {/* Calendar card (full width) */}
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Calendar</h3>
          <div id="appt-calendar" style={{ marginTop: '12px', minHeight: '120px' }}>
            {renderCalendar()}
          </div>
        </div>

        {/* Week card (separate and placed below the calendar) */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Week</h3>
          <div style={{ marginTop: '12px', padding: '6px 4px' }}>
            <div id="appt-tracker-inner">
              {renderTracker()}
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            <div>Selected date: <strong>{selectedDate || '—'}</strong></div>
            <div style={{ marginTop: 6 }}>Appointments this week: <strong>{Object.values(apptMap).reduce((a,b)=>a+b,0)}</strong></div>
          </div>
        </div>

        {/* Table card (separate) */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Appointments List</h3>
            <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 13 }}>
              Showing <strong>{filterTable().length}</strong> results
            </div>
          </div>

          <div style={{ overflow: 'auto', marginBottom: '25px' }}>
            <table className="table" aria-label="Appointments table">
              <thead>
                <tr><th>Time</th><th>ID</th><th>Type</th><th>Clinician</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
  {filterTable().length === 0 ? (
    <tr>
      <td colSpan={6} style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--muted)',
        fontSize: '14px'
      }}>
        No appointments yet.
      </td>
    </tr>
  ) : (
    filterTable().map((appt) => (
      <tr key={appt.id} data-date={appt.appointment_date}>
        <td>{appt.appointment_time}</td>
        <td>
          <div>{appt.patient_id}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{appt.students?.name || ''}</div>
        </td>
        <td>{appt.type}</td>
        <td>{appt.clinician_name}</td>
        <td className="label-muted">{appt.status}</td>
        <td>
          <button
            className="btn appt-action-btn"
            onClick={() => handleAction(appt, appt.status === 'Scheduled' ? 'check-in' : 'open')}
          >
            {appt.status === 'Scheduled' ? 'Check-in' : 'Open'}
          </button>
        </td>
      </tr>
    ))
  )}
</tbody>

            </table>
          </div>
        </div>

        

        {/* success modal */}
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
              <p>Appointment saved successfully.</p>
              <button className="btn" onClick={() => setShowSuccessModal(false)}>OK</button>
            </div>
          </div>
        )}

        {/* check-in modal */}
        {checkInAppt && (
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
              <p>Checked-in {checkInAppt.patient_id} for {checkInAppt.appointment_time}. Opening New Encounter...</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                <button className="btn" onClick={confirmCheckIn}>Confirm</button>
                <button className="btn secondary" onClick={() => setCheckInAppt(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default Appointments;
