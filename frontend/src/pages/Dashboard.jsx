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
  Filler,
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
  Legend,
  Filler
);

const Dashboard = ({ setSidebarOpen, sidebarOpen }) => {
  const navigate = useNavigate();

  // Basic state & KPIs
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [checkedInToday, setCheckedInToday] = useState(0);
  const [encountersToday, setEncountersToday] = useState(0);
  const [futureScheduledAppointments, setFutureScheduledAppointments] = useState(0);
  const [totalVisitsWeek, setTotalVisitsWeek] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0); // NEW: total patients

  // Data & lists
  const [recentEncounters, setRecentEncounters] = useState([]);
  const [visitsData, setVisitsData] = useState(null);
  const [complaintsData, setComplaintsData] = useState(null);
  const [diagnosesData, setDiagnosesData] = useState(null);

  // Export / alerts
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  // Weather state (Open-Meteo)
  const [weatherState, setWeatherState] = useState({
    loading: false,
    error: null,
    current: null,
    daily: null,
    place: null,
  });

  // Weather UI: active tab (temperature | precipitation | wind)
  const [weatherTab, setWeatherTab] = useState('temperature');

  // Date/time updater
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

  // Fetch dashboard data (unchanged except added totalPatients fetch)
  const fetchDashboardData = useCallback(async () => {
    const todayIso = new Date().toISOString().split('T')[0];
    const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // checked-in appointments today
    const { data: checkedInData } = await supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', todayIso)
      .eq('status', 'Checked-in');
    setCheckedInToday(checkedInData ? checkedInData.length : 0);

    // encounters today
    const { count: encToday } = await supabase
      .from('encounters')
      .select('*', { count: 'exact', head: true })
      .gte('encounter_date', todayIso)
      .lt('encounter_date', tomorrowIso);
    setEncountersToday(encToday || 0);

    // future scheduled appointments
    const { count: futureCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gt('appointment_date', todayIso)
      .eq('status', 'Scheduled');
    setFutureScheduledAppointments(futureCount || 0);

    // total patients (NEW)
    const { count: patientsCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    setTotalPatients(patientsCount || 0);

    // recent encounters
    const { data: recents, error: recError } = await supabase
      .from('encounters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);
    if (!recError) setRecentEncounters(recents || []);

    // visits over time
    const { data: visits } = await supabase
      .from('encounters')
      .select('encounter_date');
    const dateCounts = {};
    if (visits && Array.isArray(visits)) {
      visits.forEach(enc => {
        if (!enc?.encounter_date) return;
        const date = enc.encounter_date.split('T')[0];
        dateCounts[date] = (dateCounts[date] || 0) + 1;
      });
    }
    const labels = Object.keys(dateCounts).sort();
    setVisitsData({
      labels,
      datasets: [{
        label: 'Visits',
        data: labels.map(label => dateCounts[label]),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75,192,192,0.06)',
        tension: 0.15,
        fill: true,
      }]
    });

    // total visits over last 7 days
    const now = new Date();
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      last7.push(d.toISOString().split('T')[0]);
    }
    const weekTotal = last7.reduce((sum, d) => sum + (dateCounts[d] || 0), 0);
    setTotalVisitsWeek(weekTotal);

    // top complaints
    const { data: complaints } = await supabase
      .from('encounters')
      .select('chief_complaint')
      .not('chief_complaint', 'is', null);
    const compCounts = {};
    if (complaints && Array.isArray(complaints)) {
      complaints.forEach(enc => {
        const comp = enc.chief_complaint;
        compCounts[comp] = (compCounts[comp] || 0) + 1;
      });
    }
    const top10 = Object.entries(compCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
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

    // diagnoses distribution
    const { data: diagnoses } = await supabase
      .from('encounters')
      .select('assessment_plan')
      .not('assessment_plan', 'is', null);
    const diagCounts = {};
    if (diagnoses && Array.isArray(diagnoses)) {
      diagnoses.forEach(enc => {
        const raw = enc.assessment_plan || '';
        const diag = raw.split(',')[0] || raw;
        diagCounts[diag] = (diagCounts[diag] || 0) + 1;
      });
    }
    const diagTop10 = Object.entries(diagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    setDiagnosesData({
      labels: diagTop10.map(([k]) => (k.length > 20 ? k.substring(0, 20) + '...' : k)),
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

  }, []);

  useEffect(() => {
    fetchDashboardData();

    const handleDataUpdate = () => fetchDashboardData();
    window.addEventListener('appointmentAdded', handleDataUpdate);
    window.addEventListener('appointmentUpdated', handleDataUpdate);
    window.addEventListener('encounterAdded', handleDataUpdate);

    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => {
      window.removeEventListener('appointmentAdded', handleDataUpdate);
      window.removeEventListener('appointmentUpdated', handleDataUpdate);
      window.removeEventListener('encounterAdded', handleDataUpdate);
      clearInterval(pollInterval);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    const fetchLowStock = async () => {
      const { data: inventory, error } = await supabase
        .from('inventory')
        .select('id, item_name, stock_quantity, reorder_level, unit');
      if (!error && inventory) {
        const lowStock = inventory.filter(item =>
          Number(item.stock_quantity) <= Number(item.reorder_level)
        );
        setLowStockItems(lowStock);
      }
    };
    fetchLowStock();
    const pollInterval = setInterval(fetchLowStock, 30000);
    return () => clearInterval(pollInterval);
  }, []);

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

  const navigateToEncounter = () => navigate('/encounter');
  const regPatient = () => navigate('/patients');
  const exportCensus = async () => {
    try {
      const { data: encounters } = await supabase
        .from('encounters')
        .select('patient_id, encounter_date, vitals');
      const { data: students } = await supabase
        .from('students')
        .select('id, name');

      const studentMap = {};
      (students || []).forEach(s => studentMap[s.id] = s.name);

      const csvContent = (encounters || []).map(enc => {
        const name = studentMap[enc.patient_id] || enc.patient_id;
        const date = enc.encounter_date ? new Date(enc.encounter_date).toLocaleDateString() : '';
        const vitals = JSON.stringify(enc.vitals || {});
        return `${name},${date},${vitals}`;
      }).join('\n');

      const csvData = `Name,Date,Vitals\n${csvContent}`;

      if (window.exportCsv) {
        window.exportCsv('census_report.csv', csvData);
        setShowExportSuccessModal(true);
      }
    } catch (err) {
      console.error('Error exporting census:', err);
      alert('Error exporting census. Please try again.');
    }
  };

  // keep toggleSidebar function if parent uses it (button removed from UI)
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleSearchChange = (e) => setSearchQuery(e.target.value);
  const handleSearchKeyDown = (e) => { if (e.key === 'Enter') handleSearchSubmit(); };
  const selectSuggestion = (student) => {
    setSearchQuery(`${student.name} (${student.id})`);
    setSearchSuggestions([]);
    navigate(`/patient-profile?id=${student.id}`);
  };
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      const trimmed = searchQuery.trim();
      const exactMatch = searchSuggestions.find(s => s.name === trimmed || s.id === trimmed || `${s.name} (${s.id})` === trimmed);
      if (exactMatch) navigate(`/patient-profile?id=${exactMatch.id}`);
      else navigate(`/patients?search=${encodeURIComponent(trimmed)}`);
      setSearchSuggestions([]);
    } else {
      navigate('/patients');
    }
  };
  const clearSearch = () => { setSearchQuery(''); setSearchSuggestions([]); };

  // -------------------- Weather functions --------------------
  const weatherCodeToEmoji = (code) => {
    if (code === undefined || code === null) return '⛅';
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return '⛅';
    if (code === 3) return '☁️';
    if ((code >= 45 && code <= 48) || (code >= 51 && code <= 55)) return '🌫️';
    if ((code >= 56 && code <= 57) || (code >= 61 && code <= 65) || (code >= 66 && code <= 67)) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '⛅';
  };

  const loadWeather = async () => {
    if (!('geolocation' in navigator)) {
      setWeatherState({ loading: false, error: 'Geolocation unavailable', current: null, daily: null, place: null });
      return;
    }
    setWeatherState(prev => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // request current + daily metrics
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&hourly=temperature_2m,precipitation,windgusts_10m&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');
        const json = await res.json();
        setWeatherState({
          loading: false,
          error: null,
          current: json.current_weather || null,
          daily: json.daily || null,
          hourly: json.hourly || null,
          place: json.timezone || null,
        });
      } catch (err) {
        console.warn('Weather fetch error', err);
        setWeatherState({ loading: false, error: 'Weather unavailable', current: null, daily: null, place: null });
      }
    }, (err) => {
      console.warn('Geolocation error', err);
      setWeatherState({ loading: false, error: 'Location permission denied', current: null, daily: null, place: null });
    }, { timeout: 10000 });
  };

  useEffect(() => {
    loadWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prepare sparkline chart data depending on tab (temperature / precipitation / wind)
  const getWeatherSparkline = () => {
    if (!weatherState.hourly) return null;
    const hourly = weatherState.hourly;
    // hourly.time is ISO strings; we choose up to 24 points (today)
    const labels = (hourly.time || []).slice(0, 24).map(t => {
      const d = new Date(t);
      return d.getHours() === 0 ? '12 AM' : (d.getHours() % 12 === 0 ? '12 PM' : `${d.getHours() % 12} ${d.getHours() < 12 ? 'AM' : 'PM'}`);
    });

    let dataPoints = [];
    if (weatherTab === 'temperature') {
      dataPoints = (hourly.temperature_2m || []).slice(0, 24);
    } else if (weatherTab === 'precipitation') {
      dataPoints = (hourly.precipitation || []).slice(0, 24);
    } else if (weatherTab === 'wind') {
      // open-meteo hourly wind gusts field maybe 'windgusts_10m' or missing — use fallback of zeros
      dataPoints = (hourly.windgusts_10m || []).slice(0, 24);
    }

    return {
      labels,
      datasets: [{
        label: weatherTab,
        data: dataPoints,
        borderColor: '#f6b21c',
        backgroundColor: 'rgba(246,178,28,0.12)',
        tension: 0.25,
        fill: true,
        pointRadius: 0,
      }]
    };
  };

  const sparkOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { display: false },
      y: { display: false }
    },
    elements: { line: { borderWidth: 2 } }
  };

  // helper to render daily forecast cards (first 7)
  const renderDailyForecast = () => {
    if (!weatherState.daily) return null;
    const days = weatherState.daily.time || [];
    const maxs = weatherState.daily.temperature_2m_max || [];
    const mins = weatherState.daily.temperature_2m_min || [];
    const codes = weatherState.daily.weathercode || [];

    return (
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 8 }}>
        {days.slice(0, 7).map((d, i) => {
          const date = new Date(d);
          const shortDay = date.toLocaleDateString(undefined, { weekday: 'short' });
          return (
            <div key={d} style={{ minWidth: 68, textAlign: 'center', padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 12 }}>{shortDay}</div>
              <div style={{ fontSize: 18, marginTop: 6 }}>{weatherCodeToEmoji(codes[i])}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>{Math.round(maxs[i] || 0)}° / {Math.round(mins[i] || 0)}°</div>
            </div>
          );
        })}
      </div>
    );
  };

  // -------------------- Render --------------------
  return (
    <main className="main" style={{ padding: 20 }}>
      {/* Top row: big title left, search right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {/* Large title exactly "Dashboard" */}
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: 0.4 }}>Dashboard</h1>
          <div style={{ marginTop: 8, color: 'var(--muted)', fontWeight: 600 }}>{currentDateTime}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search patient name or student number..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', minWidth: 300 }}
            />
            {searchSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', maxHeight: '200px', overflowY: 'auto', zIndex: 50, borderRadius: 6, marginTop: 6 }}>
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
        </div>
      </div>

      {/* KPIs */}
      <section style={{ display: 'flex', gap: 12, marginTop: 18 }}>
        <div className="card" style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Encounters Today</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{encountersToday}</div>
        </div>

        <div className="card" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Appointments Today</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{checkedInToday}</div>
        </div>

        <div className="card" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Future Scheduled Appointments</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{futureScheduledAppointments}</div>
        </div>

        <div className="card" style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Total Visits Over the Week</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{totalVisitsWeek}</div>
        </div>

        {/* NEW KPI: Total Patients */}
        <div className="card" style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Total Patients</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{totalPatients}</div>
        </div>
      </section>

      {/* Main grid */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 18 }}>
        {/* Left 2x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card" style={{ gridColumn: '1 / span 1' }}>
            <h3 style={{ marginTop: 0 }}>Visit Over Time</h3>
            {visitsData ? <Line data={visitsData} /> : <div style={{ color: 'var(--muted)' }}>No data</div>}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Recent Encounters</h3>
            {(recentEncounters || []).map(enc => (
              <div key={enc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', borderRadius: 8, marginTop: 6, background: 'rgba(0,0,0,0.01)' }}>
                <div style={{ fontWeight: 600 }}>{enc.patient_id}</div>
                <div style={{ color: 'var(--muted)', flex: 1, marginLeft: 12 }}>{enc.chief_complaint || 'N/A'}</div>
                <div style={{ color: 'var(--muted)', marginLeft: 12 }}>{new Date(enc.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
            {recentEncounters.length === 0 && <div style={{ color: 'var(--muted)', marginTop: 8 }}>No recent encounters</div>}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Diagnosis Distribution</h3>
            {diagnosesData ? <Pie data={diagnosesData} /> : <div style={{ color: 'var(--muted)' }}>No data</div>}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Top 10 Chief Complaints</h3>
            {complaintsData ? <Bar data={complaintsData} /> : <div style={{ color: 'var(--muted)' }}>No data</div>}
          </div>
        </div>

        {/* Right aside */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick actions */}
          <div className="card quick">
            <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" id="regPatientDashBtn" onClick={regPatient}>Register Patient</button>
              <button className="btn" onClick={navigateToEncounter}>New Encounter</button>
              <button className="btn" id="exportCensusDashBtn" onClick={exportCensus}>Export Census</button>
            </div>
          </div>

          {/* Weather (rich) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0 }}>Weather</h3>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{weatherState.place || ''}</div>
            </div>

            {/* top summary: big icon + temp + details */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.03)', fontSize: 28 }}>
                  {weatherState.current ? weatherCodeToEmoji(weatherState.current.weathercode) : '⛅'}
                </div>
                <div style={{ fontSize: 34, fontWeight: 800 }}>
                  {weatherState.current ? `${Math.round(weatherState.current.temperature)}°C` : '--'}
                </div>
              </div>

              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                <div><strong>Precipitation:</strong> {weatherState.daily && weatherState.daily.precipitation_sum ? `${Math.round((weatherState.daily.precipitation_sum[0] || 0) * 10) / 10} mm` : '—'}</div>
                <div style={{ marginTop: 6 }}><strong>Wind:</strong> {weatherState.current ? `${weatherState.current.windspeed} m/s` : '—'}</div>
                <div style={{ marginTop: 6 }}><strong>Condition:</strong> {weatherState.current ? weatherCodeToEmoji(weatherState.current.weathercode) : '—'}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: 8 }}>
              <div onClick={() => setWeatherTab('temperature')} style={{ cursor: 'pointer', paddingBottom: 6, borderBottom: weatherTab === 'temperature' ? '3px solid #f6b21c' : '3px solid transparent', color: weatherTab === 'temperature' ? 'var(--text)' : 'var(--muted)' }}>Temperature</div>
              <div onClick={() => setWeatherTab('precipitation')} style={{ cursor: 'pointer', paddingBottom: 6, borderBottom: weatherTab === 'precipitation' ? '3px solid #f6b21c' : '3px solid transparent', color: weatherTab === 'precipitation' ? 'var(--text)' : 'var(--muted)' }}>Precipitation</div>
              <div onClick={() => setWeatherTab('wind')} style={{ cursor: 'pointer', paddingBottom: 6, borderBottom: weatherTab === 'wind' ? '3px solid #f6b21c' : '3px solid transparent', color: weatherTab === 'wind' ? 'var(--text)' : 'var(--muted)' }}>Wind</div>
            </div>

            {/* Sparkline/chart area */}
            <div style={{ height: 120, marginTop: 12 }}>
              {weatherState.loading && <div style={{ color: 'var(--muted)' }}>Fetching weather…</div>}
              {!weatherState.loading && weatherState.error && (
                <div style={{ color: 'var(--muted)' }}>
                  {weatherState.error}
                  <div style={{ marginTop: 8 }}>
                    <button className="btn" onClick={loadWeather}>Try again</button>
                  </div>
                </div>
              )}
              {!weatherState.loading && !weatherState.error && weatherState.hourly && (
                <Line data={getWeatherSparkline()} options={sparkOptions} />
              )}
            </div>

            {/* daily forecast row */}
            <div style={{ marginTop: 8 }}>
              {renderDailyForecast()}
            </div>
          </div>

          {/* Alerts */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Alerts</h3>
            {lowStockItems.length === 0 && <div style={{ color: 'var(--muted)' }}>No alerts</div>}
            {lowStockItems.map((item, idx) => (
              <div key={idx} style={{ color: 'var(--muted)', fontSize: 13, marginTop: idx > 0 ? 8 : 0 }}>
                Low stock: {item.item_name} ({item.stock_quantity} left)
              </div>
            ))}
          </div>
        </aside>
      </section>

      {/* Export success modal */}
      {showExportSuccessModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 4px 8px rgba(0,0,0,0.1)', maxWidth: 400, textAlign: 'center' }}>
            <h3>Census Exported Successfully</h3>
            <p>The census data has been exported to census_report.csv</p>
            <button className="btn" onClick={() => setShowExportSuccessModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Low stock alert modal */}
      {showLowStockAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 4px 8px rgba(0,0,0,0.1)', maxWidth: 500, textAlign: 'center' }}>
            <h3>Low Stock Alert</h3>
            <div style={{ textAlign: 'left', marginTop: 16 }}>
              {lowStockItems.map((item, i) => <div key={i} style={{ marginBottom: 8 }}>• Low stock: {item.item_name} ({item.stock_quantity} left)</div>)}
            </div>
            <button className="btn" onClick={() => setShowLowStockAlert(false)} style={{ marginTop: 20 }}>OK</button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
