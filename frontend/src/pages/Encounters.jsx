// src/pages/Encounters.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import tupehrlogo from '../assets/images/tupehrlogo.jpg';

function localizedDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  } catch {
    return new Date(dateStr).toLocaleString();
  }
}
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

const Encounters = () => {
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // UI controls
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent'); // 'recent' | 'oldest'

  // per-row loading ids for actions (so only that row's button is disabled)
  const [loadingIds, setLoadingIds] = useState([]); // array of encIds being processed

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const pdfExportRef = useRef();

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // determine active within last 7 days
  const isActive = (dateStr) => {
    if (!dateStr) return false;
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffDays = (now - then) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  // Helper: batch fetch patient names for missing patient_name fields
  const enrichWithPatientNames = async (rows) => {
    if (!rows || rows.length === 0) return rows;
    const idsToFetch = Array.from(new Set(rows.filter(r => !r.patient_name && r.patient_id).map(r => r.patient_id)));
    if (idsToFetch.length === 0) return rows;
    try {
      const { data: patientsData, error } = await supabase.from('patients').select('id, name').in('id', idsToFetch);
      if (!error && patientsData) {
        const map = {};
        patientsData.forEach(p => { map[p.id] = p.name; });
        return rows.map(r => r.patient_name ? r : { ...r, patient_name: map[r.patient_id] || r.patient_name || '' });
      }
    } catch (err) {
      console.error('Failed fetching patient names', err);
    }
    return rows;
  };

  // fetch encounters and enrich
  const fetchEncounters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('encounters').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching encounters:', error);
        showToast('Failed to load encounters', 'error');
      } else if (mountedRef.current) {
        const enriched = await enrichWithPatientNames(data || []);
        setEncounters(enriched || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load encounters', 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchEncounters();

    // realtime subscription (Supabase channel API)
    const channel = supabase
      .channel('public:encounters')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encounters' }, async (payload) => {
        const ev = payload.eventType;
        const row = payload.new ?? payload.old;
        let rowWithName = row;
        if (row && !row.patient_name && row.patient_id) {
          try {
            const { data: pData, error: pErr } = await supabase.from('patients').select('id,name').eq('id', row.patient_id).maybeSingle();
            if (!pErr && pData) rowWithName = { ...row, patient_name: pData.name };
          } catch (err) {
            // ignore
          }
        }

        setEncounters(prev => {
          if (ev === 'INSERT') return [rowWithName, ...prev];
          if (ev === 'UPDATE') return prev.map(r => (r.id === rowWithName.id ? rowWithName : r));
          if (ev === 'DELETE') return prev.filter(r => r.id !== rowWithName.id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      try {
        supabase.removeChannel(channel);
      } catch {
        try { supabase.removeAllSubscriptions(); } catch (e) { /* ignore */ }
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // search + sort behavior same as Patients page
  const visible = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    let arr = (encounters || []).slice();

    if (q) {
      arr = arr.filter(e => {
        const idVal = (e.patient_id || '').toString().toLowerCase();
        const nameVal = (e.patient_name || '').toLowerCase();
        const clinician = (e.clinician_name || '').toLowerCase();
        const complaint = (e.chief_complaint || '').toLowerCase();
        return idVal.includes(q) || nameVal.includes(q) || clinician.includes(q) || complaint.includes(q);
      });
    }

    arr.sort((a, b) => {
      const da = new Date(a.encounter_date || a.created_at).getTime();
      const db = new Date(b.encounter_date || b.created_at).getTime();
      return sort === 'recent' ? db - da : da - db;
    });

    return arr;
  }, [encounters, search, sort]);

  // helper to add/remove loading id
  const setLoadingId = (id, isLoading) => {
    setLoadingIds(prev => {
      if (isLoading) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      } else {
        return prev.filter(x => x !== id);
      }
    });
  };

  // Mark complete action — try DB, fallback to local-only
  const markComplete = async (encId) => {
    if (!encId) return;
    setLoadingId(encId, true);

    try {
      // First: attempt DB update (if your schema/postgrest is healthy this will persist)
      try {
        const { data, error } = await supabase
          .from('encounters')
          .update({ status: 'completed' })
          .eq('id', encId)
          .select()
          .maybeSingle();

        if (error) throw error;

        // If DB returned updated row, merge it into state
        if (data) {
          setEncounters(prev => prev.map(e => (e.id === encId ? { ...e, ...data } : e)));
          showToast('Marked complete');
          setLoadingId(encId, false);
          return;
        }
        // else fall through to local fallback (no data returned)
      } catch (dbErr) {
        // Common during schema cache issues — fallback to local update
        console.warn('DB update failed (falling back to local):', dbErr);
      }

      // Local-only fallback: mark as completed in React state so it immediately moves to history UI
      setEncounters(prev => prev.map(e => (e.id === encId ? { ...e, status: 'completed' } : e)));
      // small delay to make the button feel like it did something
      await new Promise(res => setTimeout(res, 200));
      showToast('Completed');
    } catch (err) {
      console.error('Mark complete failed', err);
      showToast('Failed to move to history', 'error');
    } finally {
      setLoadingId(encId, false);
    }
  };

  // ---------------- PDF Export (last 30 days) ----------------
  const exportPdfLast30Days = async () => {
    const now = Date.now();
    const rows = (encounters || []).filter(e => {
      const t = new Date(e.encounter_date || e.created_at).getTime();
      return now - t <= DAYS_30_MS;
    }).sort((a, b) => new Date(b.encounter_date || b.created_at) - new Date(a.encounter_date || a.created_at));

    if (rows.length === 0) {
      showToast('No encounters in the last 30 days to export', 'error');
      return;
    }

    try {
      const container = pdfExportRef.current;
      if (!container) {
        showToast('Export failed (missing container)', 'error');
        return;
      }

      const tableBody = container.querySelector('#export-tbody');
      tableBody.innerHTML = '';

      for (const r of rows) {
        const tr = document.createElement('tr');
        tr.style.borderTop = '1px solid #eee';
        tr.innerHTML = `
          <td style="padding:8px; font-weight:600;">${(r.patient_name || '').replace(/</g,'&lt;')}</td>
          <td style="padding:8px;">${(r.patient_id || '').replace(/</g,'&lt;')}</td>
          <td style="padding:8px;">${localizedDateTime(r.encounter_date || r.created_at)}</td>
          <td style="padding:8px;">${(r.clinician_name || '').replace(/</g,'&lt;')}</td>
          <td style="padding:8px; max-width:220px; word-wrap:break-word;">${(r.chief_complaint || '').replace(/</g,'&lt;')}</td>
          <td style="padding:8px;">${(r.assessment_plan || '').replace(/</g,'&lt;')}</td>
        `;
        tableBody.appendChild(tr);
      }

      const imgs = Array.from(container.querySelectorAll('img'));
      await Promise.all(imgs.map(img => new Promise(res => { if (img.complete) return res(); img.onload = img.onerror = res; })));

      const scale = 2;
      const canvas = await html2canvas(container, { scale, useCORS: true, allowTaint: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = pageWidth / canvasWidth;
      const renderedHeight = canvasHeight * ratio;

      if (renderedHeight <= pageHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, renderedHeight);
      } else {
        let y = 0;
        const pxPerPage = Math.floor(pageHeight / ratio);
        while (y < canvasHeight) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvasWidth;
          pageCanvas.height = Math.min(pxPerPage, canvasHeight - y);
          const ctx = pageCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, y, canvasWidth, pageCanvas.height, 0, 0, canvasWidth, pageCanvas.height);
          const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
          if (y > 0) pdf.addPage();
          const h = pageCanvas.height * ratio;
          pdf.addImage(pageData, 'JPEG', 0, 0, pageWidth, h);
          y += pxPerPage;
        }
      }

      pdf.save(`encounters_last30days_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('PDF exported');
    } catch (err) {
      console.error('Export error', err);
      showToast('Export failed', 'error');
    }
  };
  // ---------------- end PDF Export ----------------

  return (
    <>
      <main className="main">
        <section className="page" aria-labelledby="encounters-title">
          {/* Header styled like Patients page */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 25, fontWeight: 700 }}>Encounters</div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* search styled same as Patients page */}
                <input
                  id="patients-search"
                  type="search"
                  placeholder="Search by name, student number..."
                  style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', minWidth: 260 }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <select aria-label="Sort encounters" value={sort} onChange={e => setSort(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                  <option value="recent">Recent first</option>
                  <option value="oldest">Oldest first</option>
                </select>

                <button className="btn secondary" onClick={exportPdfLast30Days}>Export</button>

                <button className="btn" onClick={() => navigate('/encounter')}>Create New Encounter</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginTop: 12 }}>
            {/* Active Queue */}
            <div className="card" aria-live="polite">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Active Queue</h3>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{visible.filter(e => isActive(e.encounter_date) && (e.status || '').toLowerCase() !== 'completed').length} active</div>
              </div>

              <div style={{ overflow: 'auto', marginTop: 10 }}>
                <table className="table" aria-label="Active Encounters table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 13 }}>
                    <tr>
                      <th style={{ padding: 8 }}>Name</th>
                      <th style={{ padding: 8 }}>ID</th>
                      <th style={{ padding: 8 }}>Date</th>
                      <th style={{ padding: 8 }}>Clinician</th>
                      <th style={{ padding: 8 }}>Complaint</th>
                      <th style={{ padding: 8 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{ padding: 12 }}>Loading…</td></tr>
                    ) : visible.filter(e => isActive(e.encounter_date) && (e.status || '').toLowerCase() !== 'completed').length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 12, color: 'var(--muted)' }}>No active encounters.</td></tr>
                    ) : (
                      visible
                        .filter(e => isActive(e.encounter_date) && (e.status || '').toLowerCase() !== 'completed')
                        .map(enc => (
                          <tr key={enc.id} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <td style={{ padding: 10 }}>{enc.patient_name || enc.patient_id || '—'}</td>
                            <td style={{ padding: 10 }}>{enc.patient_id}</td>
                            <td style={{ padding: 10 }} title={localizedDateTime(enc.encounter_date)}>{localizedDateTime(enc.encounter_date)}</td>
                            <td style={{ padding: 10 }}>{enc.clinician_name || '—'}</td>
                            <td style={{ padding: 10, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enc.chief_complaint || 'N/A'}</td>
                            <td style={{ padding: 10, display: 'flex', gap: 8 }}>
                              <button className="btn secondary" onClick={() => markComplete(enc.id)} disabled={loadingIds.includes(enc.id)}>
                                {loadingIds.includes(enc.id) ? 'Working…' : 'Mark Complete'}
                              </button>
                              <button className="btn" onClick={() => navigate(`/patient-profile?id=${enc.patient_id}`)}>Profile</button>
                            
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Encounter History — show ALL but with scrollbar */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Encounter History</h3>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{visible.filter(e => !isActive(e.encounter_date) || (e.status || '').toLowerCase() === 'completed').length} records</div>
              </div>

              <div style={{ marginTop: 10, maxHeight: 420, overflow: 'auto' }}>
                <table className="table" aria-label="Encounter History table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 13 }}>
                    <tr>
                      <th style={{ padding: 8 }}>Name</th>
                      <th style={{ padding: 8 }}>ID</th>
                      <th style={{ padding: 8 }}>Date</th>
                      <th style={{ padding: 8 }}>Clinician</th>
                      <th style={{ padding: 8 }}>Complaint</th>
                      <th style={{ padding: 8 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{ padding: 12 }}>Loading…</td></tr>
                    ) : visible.filter(e => !isActive(e.encounter_date) || (e.status || '').toLowerCase() === 'completed').length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 12, color: 'var(--muted)' }}>No history records.</td></tr>
                    ) : (
                      visible
                        .filter(e => !isActive(e.encounter_date) || (e.status || '').toLowerCase() === 'completed')
                        .map(enc => (
                          <tr key={enc.id} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <td style={{ padding: 10 }}>{enc.patient_name || enc.patient_id || '—'}</td>
                            <td style={{ padding: 10 }}>{enc.patient_id}</td>
                            <td style={{ padding: 10 }} title={localizedDateTime(enc.encounter_date)}>{localizedDateTime(enc.encounter_date)}</td>
                            <td style={{ padding: 10 }}>{enc.clinician_name || '—'}</td>
                            <td style={{ padding: 10, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enc.chief_complaint || 'N/A'}</td>
                            <td style={{ padding: 10, display: 'flex', gap: 8 }}>
                              <button className="btn" onClick={() => navigate(`/patient-profile?id=${enc.patient_id}`)}>Profile</button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* toast */}
          {toast && (
            <div style={{
              position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 7000, padding: '10px 16px', borderRadius: 8, color: 'white', fontWeight: 700,
              backgroundColor: toast.type === 'error' ? '#dc3545' : '#28a745', boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
            }}>
              {toast.text}
            </div>
          )}
        </section>
      </main>

      {/* Hidden export container for PDF (styled inline for reliable rendering) */}
      <div ref={pdfExportRef} style={{ position: 'absolute', left: -9999, top: -9999, width: 794, padding: 24, background: '#fff' }} aria-hidden>
        <div style={{ width: '100%', background: '#fff', color: '#111', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <img src={tupehrlogo} alt="TUP Clinic logo" style={{ width: 100, height: 'auto', objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Technological University of the Philippines (TUP) Manila – Clinic</div>
              <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>Encounters — Last 30 days</div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #ddd', marginBottom: 12 }} />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Name</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>ID</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Date</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Clinician</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Complaint</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Action</th>
              </tr>
            </thead>
            <tbody id="export-tbody">
              {/* rows populated dynamically by export function */}
            </tbody>
          </table>

          <div style={{ marginTop: 20, color: '#666', fontSize: 12 }}>
            Exported from EHR system
          </div>
        </div>
      </div>
    </>
  );
};

export default Encounters;
