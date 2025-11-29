import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);


const Dashboard = ({ setSidebarOpen, sidebarOpen }) => {
  const navigate = useNavigate();
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [checkedInToday, setCheckedInToday] = useState(0);
  const [encountersToday, setEncountersToday] = useState(0);
  const [pendingReferrals, setPendingReferrals] = useState(0);
  const [recentEncounters, setRecentEncounters] = useState([]);
  const [visitsData, setVisitsData] = useState(null);
  const [complaintsData, setComplaintsData] = useState(null);
  const [diagnosesData, setDiagnosesData] = useState(null);
  const [vitalsData, setVitalsData] = useState([]);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [editableVitals, setEditableVitals] = useState([]);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [alertShown, setAlertShown] = useState(() => {
    const today = new Date().toDateString();
    return localStorage.getItem('lowStockAlertShown') === today;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  const updateDateTime = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString();
    setCurrentDateTime(`${dateStr} — ${timeStr}`);
  }, []);

  useEffect(() => {
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [updateDateTime]);

  const fetchDashboardData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Patients checked-in today
    const { data: checkedInData } = await supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', today)
      .eq('status', 'Checked-in');
    setCheckedInToday(checkedInData ? checkedInData.length : 0);

    // Encounters today
    const { count: encToday } = await supabase
      .from('encounters')
      .select('*', { count: 'exact', head: true })
      .gte('encounter_date', today)
      .lt('encounter_date', tomorrow);
    setEncountersToday(encToday || 0);

    // Pending referrals (assume appointments with type 'Referral' and status 'Scheduled')
    const { count: referrals } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Scheduled')
      .ilike('type', '%referral%'); // Adjust based on your type values
    setPendingReferrals(referrals || 0);



    // Recent encounters
    const { data: recents, error } = await supabase
      .from('encounters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(4);
    if (!error) {
      setRecentEncounters(recents || []);
    }

    // Chart data: Visits over time
    const { data: visits } = await supabase
      .from('encounters')
      .select('encounter_date');
    const dateCounts = {};
    visits.forEach(enc => {
      const date = enc.encounter_date.split('T')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    });
    const labels = Object.keys(dateCounts).sort();
    setVisitsData({
      labels,
      datasets: [{
        label: 'Visits',
        data: labels.map(label => dateCounts[label]),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    });

    // Top 5 Chief Complaints
    const { data: complaints } = await supabase
      .from('encounters')
      .select('chief_complaint')
      .not('chief_complaint', 'is', null);
    console.log('Chief complaints data:', complaints);
    const compCounts = {};
    complaints.forEach(enc => {
      const comp = enc.chief_complaint;
      compCounts[comp] = (compCounts[comp] || 0) + 1;
    });
    const top10 = Object.entries(compCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log('Top 10 complaints:', top10);
    setComplaintsData({
      labels: top10.map(([k]) => k),
      datasets: [{
        label: 'Count',
        data: top10.map(([, v]) => v),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    });

    // Diagnoses Distribution (using assessment_plan as proxy)
    const { data: diagnoses } = await supabase
      .from('encounters')
      .select('assessment_plan')
      .not('assessment_plan', 'is', null);
    console.log('Diagnoses data:', diagnoses);
    const diagCounts = {};
    diagnoses.forEach(enc => {
      // Simple split by comma or something, but for demo, count unique
      const diag = enc.assessment_plan.split(',')[0] || enc.assessment_plan; // or full
      diagCounts[diag] = (diagCounts[diag] || 0) + 1;
    });
    const diagTop10 = Object.entries(diagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log('diagTop10:', diagTop10);
    setDiagnosesData({
      labels: diagTop10.map(([k]) => k.substring(0, 20) + '...'),
      datasets: [{
        data: diagTop10.map(([, v]) => v),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 205, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 205, 86, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderWidth: 1
      }]
    });

    // Vitals Quick View: recent vitals from all encounters
    const { data: recentEncounters } = await supabase
      .from('encounters')
      .select('patient_id, vitals, created_at, id')
      .not('vitals', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20); // recent 20 encounters with vitals

    const uniquePatientIds = [...new Set(recentEncounters.map(enc => enc.patient_id))];

    const { data: patients } = await supabase
      .from('students')
      .select('id, name')
      .in('id', uniquePatientIds);

    const patientMap = {};
    patients.forEach(p => patientMap[p.id] = p.name);

    const vitalsList = recentEncounters.map(enc => ({
      id: enc.id,
      patient_id: enc.patient_id,
      name: patientMap[enc.patient_id] || enc.patient_id,
      date: new Date(enc.created_at).toLocaleDateString(),
      temp: enc.vitals?.temp,
      pulse: enc.vitals?.pulse,
      bp: enc.vitals?.bp,
      weight: enc.vitals?.weight
    }));
    setVitalsData(vitalsList);
    console.log('Vitals list:', vitalsList);
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const handleDataUpdate = () => {
      fetchDashboardData();
    };

    window.addEventListener('appointmentAdded', handleDataUpdate);
    window.addEventListener('appointmentUpdated', handleDataUpdate);
    window.addEventListener('encounterAdded', handleDataUpdate);

    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // Poll every 30 seconds to update charts dynamically

    return () => {
      window.removeEventListener('appointmentAdded', handleDataUpdate);
      window.removeEventListener('appointmentUpdated', handleDataUpdate);
      window.removeEventListener('encounterAdded', handleDataUpdate);
      clearInterval(pollInterval);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    const fetchLowStock = async () => {
      const { data: lowStock, error } = await supabase
        .from('inventory')
        .select('item_name, stock_quantity, reorder_level')
        .lt('stock_quantity', 15);
      if (!error && lowStock) {
        setLowStockItems(lowStock);
        if (lowStock.length > 0 && !showLowStockAlert && !alertShown) {
          setShowLowStockAlert(true);
          setAlertShown(true);
          const today = new Date().toDateString();
          localStorage.setItem('lowStockAlertShown', today);
        }
      }
    };
    fetchLowStock();
    const pollInterval = setInterval(fetchLowStock, 30000); // Check every 30 seconds
    return () => clearInterval(pollInterval);
  }, [showLowStockAlert]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!searchQuery.trim()) {
        setSearchSuggestions([]);
        return;
      }
      const { data } = await supabase
        .from('students')
        .select('id, name')
        .or(`name.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`)
        .limit(10);
      setSearchSuggestions(data || []);
    };
    fetchSuggestions();
  }, [searchQuery]);

  const navigateToEncounter = () => {
    navigate('/encounter');
  };

  const regPatient = () => {
    navigate('/patients');
  };

  const recordVitals = () => {
    setEditableVitals([...vitalsData]); // Copy current vitals for editing
    setShowVitalsModal(true);
  };

  const handleSaveVitals = async () => {
    try {
      for (const vital of editableVitals) {
        // Update the specific encounter
        const { error: updateError } = await supabase
          .from('encounters')
          .update({
            vitals: {
              temp: vital.temp,
              pulse: vital.pulse,
              bp: vital.bp,
              weight: vital.weight
            }
          })
          .eq('id', vital.id);
        if (updateError) {
          console.error('Error updating vitals:', updateError);
        }
      }
      setShowSaveSuccessModal(true);
      setShowVitalsModal(false);
      // Update local state immediately
      setVitalsData([...editableVitals]);
    } catch (err) {
      alert('Error updating vitals.');
      console.error(err);
    }
  };

  const updateVital = (index, field, value) => {
    const updated = [...editableVitals];
    updated[index][field] = value;
    setEditableVitals(updated);
  };

  const exportCensus = async () => {
    try {
      const { data: encounters } = await supabase
        .from('encounters')
        .select('patient_id, encounter_date, vitals')
        .not('vitals', 'is', null);

      const { data: students } = await supabase
        .from('students')
        .select('id, name');

      const studentMap = {};
      students.forEach(s => studentMap[s.id] = s.name);

      const csvContent = encounters.map(enc => {
        const name = studentMap[enc.patient_id] || enc.patient_id;
        const date = new Date(enc.encounter_date).toLocaleDateString();
        const vitals = JSON.stringify(enc.vitals || {});
        return `${name},${date},${vitals}`;
      }).join('\n');

      const csvData = `Name,Date,Vitals\n${csvContent}`;

      if (window.exportCsv) {
        window.exportCsv('census_report.csv', csvData);
        setShowExportSuccessModal(true);
      }
    } catch (error) {
      console.error('Error exporting census:', error);
      alert('Error exporting census. Please try again.');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const selectSuggestion = (student) => {
    setSearchQuery(`${student.name} (${student.id})`);
    setSearchSuggestions([]);
    // Navigate to patient profile
    navigate(`/patient-profile?id=${student.id}`);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      // Check if exact match
      const trimmed = searchQuery.trim();
      const exactMatch = searchSuggestions.find(s => s.name === trimmed || s.id === trimmed || `${s.name} (${s.id})` === trimmed);
      if (exactMatch) {
        navigate(`/patient-profile?id=${exactMatch.id}`);
      } else {
        // Navigate to patients with search query
        navigate(`/patients?search=${encodeURIComponent(trimmed)}`);
      }
      setSearchSuggestions([]);
    } else {
      navigate('/patients');
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchSuggestions([]);
  };

  return (
    <main className="main">
      <div className="topbar">
        <div className="search" style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          <button className="btn" id="toggleSidebar" onClick={toggleSidebar}>☰</button>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search patient name or student number..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}
            />
            {searchSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', maxHeight: '200px', overflowY: 'auto', zIndex: 10, borderRadius: '4px', marginTop: '2px' }}>
                {searchSuggestions.map(student => (
                  <div
                    key={student.id}
                    onClick={() => selectSuggestion(student)}
                    style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                  >
                    {student.name} ({student.id})
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn" onClick={handleSearchSubmit} style={{ marginRight: '4px' }}>Search</button>
          {searchQuery && <button className="btn secondary" onClick={clearSearch}>Clear</button>}
        </div>

        <div id="current-datetime" style={{ marginLeft: '12px', color: 'var(--muted)', alignSelf: 'center', fontWeight: 600 }}>
          {currentDateTime}
        </div>

        <div className="actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn" id="newEncounterTopBtn" onClick={navigateToEncounter}>New Encounter</button>
        </div>
      </div>

        <section style={{ display: 'flex', gap: '18px', alignItems: 'start' }}>
        <div className="left" style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: '18px', flex: 1 }}>
          <div className="kpis" style={{ display: 'flex', gap: '12px' }}>
            <div className="kpi card"><div className="num">{checkedInToday}</div><div className="label" style={{ color: 'var(--muted)' }}>Patients checked-in today</div></div>
            <div className="kpi card"><div className="num">{encountersToday}</div><div className="label" style={{ color: 'var(--muted)' }}>Encounters today</div></div>
            <div className="kpi card"><div className="num">{pendingReferrals}</div><div className="label" style={{ color: 'var(--muted)' }}>Pending referrals</div></div>
          </div>

          <div className="charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="card"><h3>Visits Over Time</h3>{visitsData && <Line data={visitsData} />}</div>
            <div className="card"><h3>Top 10 Chief Complaints</h3>{complaintsData && <Bar data={complaintsData} />}</div>
            <div className="card"><h3>Diagnoses Distribution</h3>{diagnosesData && <Pie data={diagnosesData} />}</div>
            <div className="card"><h3>Vitals Quick View</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {vitalsData.map((vital, index) => (
                  <div key={vital.id} style={{
                    background: `hsl(${(index * 60) % 360}, 60%, 90%)`,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}>
                    <div><strong>{vital.name} - {vital.date}</strong></div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                      <span>Temp: {vital.temp}°</span>
                      <span>Pulse: {vital.pulse} bpm</span>
                      <span>BP: {vital.bp}</span>
                      <span>Weight: {vital.weight} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="right" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '360px', flexShrink: 0 }}>
          <div className="card recent">
            <h3>Recent Encounters</h3>
            {recentEncounters.slice(0, 4).map(enc => (
              <div key={enc.id} className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                <div>{enc.patient_id} — {enc.chief_complaint || 'N/A'}</div>
                <div style={{ color: 'var(--muted)' }}>{new Date(enc.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>

          <div className="card quick">
            <h3>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn" id="regPatientDashBtn" onClick={regPatient}>Register Patient</button>
              <button className="btn" id="recordVitalsDashBtn" onClick={recordVitals}>Record Vitals</button>
              <button className="btn" id="exportCensusDashBtn" onClick={exportCensus}>Export Census</button>
            </div>
          </div>

          <div className="card">
            <h3>Alerts</h3>
            {lowStockItems.map((item, index) => (
              <div key={index} style={{ color: 'var(--muted)', fontSize: '13px', marginTop: index > 0 ? '8px' : '0' }}>
                Low stock: {item.item_name} ({item.stock_quantity} left)
              </div>
            ))}
          </div>
        </aside>
      </section>
      {showSaveSuccessModal && (
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
            <p>Vitals updated successfully.</p>
            <button className="btn" onClick={() => setShowSaveSuccessModal(false)}>OK</button>
          </div>
        </div>
      )}
      {showVitalsModal && (
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
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3>Update Vitals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {editableVitals.map((vital, index) => (
                <div key={vital.id} style={{
                  background: `hsl(${(index * 60) % 360}, 60%, 95%)`,
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}>
                  <div style={{ marginBottom: '12px' }}><strong>{vital.name} - {vital.date}</strong></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginTop: '0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Temp (°C)</label>
                      <input type="text" value={vital.temp} onChange={(e) => updateVital(index, 'temp', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Pulse (bpm)</label>
                      <input type="text" value={vital.pulse} onChange={(e) => updateVital(index, 'pulse', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>BP (sys/dia)</label>
                      <input type="text" value={vital.bp} onChange={(e) => updateVital(index, 'bp', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Weight (kg)</label>
                      <input type="text" value={vital.weight} onChange={(e) => updateVital(index, 'weight', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn" onClick={() => setShowVitalsModal(false)}>Cancel</button>
              <button className="btn" onClick={handleSaveVitals}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showExportSuccessModal && (
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
            <h3>Census Exported Successfully</h3>
            <p>The census data has been exported to census_report.csv</p>
            <button className="btn" onClick={() => setShowExportSuccessModal(false)}>Close</button>
          </div>
        </div>
      )}

      {showLowStockAlert && (
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
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h3>Low Stock Alert</h3>
            <div style={{ textAlign: 'left', marginTop: '16px' }}>
              {lowStockItems.map((item, index) => (
                <div key={index} style={{ marginBottom: '8px' }}>
                  • Low stock: {item.item_name} ({item.stock_quantity} left)
                </div>
              ))}

            </div>
            <button className="btn" onClick={() => setShowLowStockAlert(false)} style={{ marginTop: '20px' }}>OK</button>
          </div>
        </div>
      )}

    </main>
  );
};

export default Dashboard;
