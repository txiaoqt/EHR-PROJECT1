// src/pages/Reports.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import Chart from 'chart.js/auto';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import 'jspdf-autotable';
import { formatDate, logAudit } from '../utils.js';
import tupehrlogo from '../assets/images/tupehrlogo.jpg';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const DEFAULT_LOOKBACK_DAYS = 30;

const Reports = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('census');
  const [reportData, setReportData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateError, setDateError] = useState('');
  const mountedRef = useRef(false);

  useEffect(() => {
    const today = new Date();
    const prior = new Date();
    prior.setDate(today.getDate() - DEFAULT_LOOKBACK_DAYS + 1);
    setFrom(prior.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, type]);

  const validateDates = (f, t) => {
    if (!f || !t) return false;
    const df = new Date(f);
    const dt = new Date(t);
    return !isNaN(df.getTime()) && !isNaN(dt.getTime()) && df <= dt;
  };

  const runReport = async (opts = {}) => {
    const useFrom = opts.from ?? from;
    const useTo = opts.to ?? to;

    if (!validateDates(useFrom, useTo)) {
      setDateError('Please provide a valid date range (From ≤ To).');
      setReportData([]);
      setChartData(null);
      return;
    } else {
      setDateError('');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('encounters')
        .select('*')
        .gte('encounter_date', useFrom)
        .lte('encounter_date', useTo + 'T23:59:59')
        .order('encounter_date', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      setReportData(rows);

      // build preview chart for the selected type
      if (type === 'census') {
        const monthCounts = {};
        rows.forEach(enc => {
          const m = new Date(enc.encounter_date).toISOString().slice(0, 7);
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        });
        const labels = Object.keys(monthCounts).sort();
        setChartData({
          type: 'bar',
          data: {
            labels: labels.map(l => l.replace('-', '/')),
            datasets: [{
              label: 'Cases',
              data: labels.map(l => monthCounts[l]),
              backgroundColor: 'rgba(54,162,235,0.85)',
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: `Monthly Cases (${useFrom} → ${useTo})` },
            },
          },
        });
      } else if (type === 'diagnoses') {
        const diagCounts = {};
        rows.forEach(enc => {
          const diag = (enc.chief_complaint || 'Unknown').trim() || 'Unknown';
          diagCounts[diag] = (diagCounts[diag] || 0) + 1;
        });
        const entries = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
        setChartData({
          type: 'pie',
          data: {
            labels: entries.map(([k]) => k),
            datasets: [{
              data: entries.map(([, v]) => v),
              backgroundColor: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#8BC34A', '#607D8B', '#9E9E9E', '#FFC107',
              ]
            }]
          },
          options: {
            responsive: true,
            plugins: { title: { display: true, text: `Top Diagnoses (${useFrom} → ${useTo})` } }
          }
        });
      } else if (type === 'visits') {
        const visitCounts = {};
        rows.forEach(enc => {
          const d = new Date(enc.encounter_date).toISOString().slice(0, 10);
          visitCounts[d] = (visitCounts[d] || 0) + 1;
        });
        const dates = Object.keys(visitCounts).sort();
        setChartData({
          type: 'bar',
          data: {
            labels: dates.map(d => new Date(d).toLocaleDateString()),
            datasets: [{
              label: 'Visits',
              data: dates.map(d => visitCounts[d]),
              backgroundColor: 'rgba(255,99,132,0.85)',
            }]
          },
          options: {
            responsive: true,
            plugins: { title: { display: true, text: `Daily Visits (${useFrom} → ${useTo})` } }
          }
        });
      } else {
        setChartData(null);
      }

      try { await logAudit('run_report', `Run ${type} report ${useFrom} → ${useTo}`); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Error running report:', err);
      setReportData([]);
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  // CSV exporter
  const exportCsv = (mode = 'full') => {
    if (!reportData || reportData.length === 0) {
      setShowExportMenu(false);
      return;
    }

    const headers = ['Date', 'Patient', 'Clinician', 'Chief Complaint', 'Encounter ID'];
    const rows = (reportData || []).map(enc => {
      const date = new Date(enc.encounter_date).toLocaleString();
      const patient = enc.patient_name || enc.patient_id || 'Unknown';
      const clinician = enc.clinician_name || 'Unknown';
      const complaint = (enc.chief_complaint || '').replace(/,/g, ' ');
      const id = enc.id || '';
      return [date, patient, clinician, complaint, id].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tup_report_${type}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Chart -> dataURL (for higher-res images)
  const createChartImage = async (config, width = 1200, height = 600) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, config);
    chart.update();
    // give Chart.js a short moment to settle (increase if needed)
    await new Promise(res => setTimeout(res, 500));
    let dataUrl;
    try {
      dataUrl = chart.toBase64Image();
    } catch (e) {
      dataUrl = canvas.toDataURL('image/png', 1.0);
    }
    try { chart.destroy(); } catch {}
    try { document.body.removeChild(canvas); } catch {}
    return dataUrl;
  };

  // load local image asset -> dataURL (safe for jsPDF)
  const loadImageDataUrl = (src, timeout = 5000) => {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let resolved = false;
      img.onload = () => {
        if (resolved) return;
        resolved = true;
        try {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => { if (!resolved) { resolved = true; resolve(null); } };
      img.src = src;
      setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, timeout);
    });
  };

  const buildAllReportConfigs = () => {
    const data = reportData || [];

    const diagCounts = {};
    data.forEach(enc => {
      const diag = (enc.chief_complaint || 'Unknown').trim() || 'Unknown';
      diagCounts[diag] = (diagCounts[diag] || 0) + 1;
    });
    const diagEntries = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 50);
    const diagConfig = {
      type: 'pie',
      data: {
        labels: diagEntries.map(([k]) => k),
        datasets: [{ data: diagEntries.map(([, v]) => v) }]
      },
      options: { plugins: { title: { display: true, text: 'Top Diagnoses' } } }
    };

    const monthCounts = {};
    data.forEach(enc => {
      const month = new Date(enc.encounter_date).toISOString().slice(0, 7);
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const months = Object.keys(monthCounts).sort();
    const censusConfig = {
      type: 'bar',
      data: {
        labels: months.map(m => m.replace('-', '/')),
        datasets: [{ label: 'Cases', data: months.map(m => monthCounts[m]) }]
      },
      options: { plugins: { title: { display: true, text: 'Monthly Case Counts' } } }
    };

    const visitCounts = {};
    data.forEach(enc => {
      const date = new Date(enc.encounter_date).toISOString().slice(0, 10);
      visitCounts[date] = (visitCounts[date] || 0) + 1;
    });
    const dates = Object.keys(visitCounts).sort();
    const visitsConfig = {
      type: 'bar',
      data: {
        labels: dates.map(d => new Date(d).toLocaleDateString()),
        datasets: [{ label: 'Visits', data: dates.map(d => visitCounts[d]) }]
      },
      options: { plugins: { title: { display: true, text: 'Daily Visit Trends' } } }
    };

    return { diagConfig, censusConfig, visitsConfig, diagEntries, months, dates };
  };

  // placeChart draws title, chart image, and table below it.
  // It does NOT add the clinic header/logo — only a small footer page number is added.
  const placeChart = async (doc, title, config, smallTableRows = null) => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;

    // Title near top of page
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const startY = margin + 10;
    doc.text(title, margin, startY);

    // Chart image area
    const imgW = pageW - margin * 2;
    const imgH = Math.round(imgW * 0.45);
    const chartImg = await createChartImage(config, Math.round(imgW * 2), Math.round(imgH * 2));
    const imgY = startY + 18;
    try {
      doc.addImage(chartImg, 'PNG', margin, imgY, imgW, imgH);
    } catch (e) {
      doc.setFontSize(10);
      doc.text('Chart rendering error', margin, imgY + 10);
    }

    // Table below chart — use autoTable and only draw page number in didDrawPage
    if (smallTableRows && smallTableRows.length) {
      const tableStart = imgY + imgH + 12;
      autoTable(doc, {
        head: [smallTableRows[0]],
        body: smallTableRows.slice(1),
        startY: tableStart,
        margin: { left: margin, right: margin, top: margin, bottom: 60 },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 6 },
        headStyles: { fillColor: [245,245,245] },
        showHead: 'everyPage',
        didDrawPage: function (data) {
          // footer: page number only
          const pageNumber = doc.internal.getNumberOfPages();
          doc.setFontSize(9);
          doc.text(`Page ${pageNumber}`, pageW - margin - 40, pageH - 18);
        }
      });
    } else {
      // no table — still draw page number
      const pageNumber = doc.internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.text(`Page ${pageNumber}`, pageW - margin - 40, pageH - 18);
    }
  };

  // Export PDF (selected | full)
  const exportPdf = async (mode = 'selected') => {
    if (!reportData || reportData.length === 0) {
      setShowExportMenu(false);
      return;
    }
    setExporting(true);

    try {
      const { diagConfig, censusConfig, visitsConfig, diagEntries } = buildAllReportConfigs();
      const doc = new jsPDF('p', 'pt', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 40;

      const logoDataUrl = await loadImageDataUrl(tupehrlogo);
      const rangeText = `${from} → ${to}`;

      // --- COVER PAGE (page 1) with centered layout ---
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      let y = 120;

      // LOGO (centered)
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', pageW / 2 - 35, y, 70, 55);
        } catch (e) {
          // ignore image errors
        }
      }
      y += 90;

      // SCHOOL + CLINIC NAME
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(
        "Technological University of the Philippines - Clinic",
        pageW / 2,
        y,
        { align: "center" }
      );

      y += 40;

      // FULL REPORT (DATE RANGE)
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `FULL REPORT (${from} - ${to})`,
        pageW / 2,
        y,
        { align: "center" }
      );

      y += 35;

      // Generated By (left blank for manual fill or can be auto-filled)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated by: __________________________`,
        pageW / 2,
        y,
        { align: "center" }
      );

      y += 22;

      // Generated On
      doc.text(
        `Generated on: ${formatDate(new Date(), "YYYY-MM-DD HH:mm")}`,
        pageW / 2,
        y,
        { align: "center" }
      );

      y += 22;

      // Generated From
      doc.text(
        `Generated from EHR System`,
        pageW / 2,
        y,
        { align: "center" }
      );

      // --- SELECTED MODE: cover + single chart page ---
      if (mode === 'selected') {
        doc.addPage(); // page 2
        if (type === 'census') {
          await placeChart(doc, 'Monthly Case Counts', censusConfig, [
            ['Month', 'Cases'],
            ...(censusConfig.data?.labels || []).map((lbl, i) => [lbl, censusConfig.data.datasets?.[0]?.data?.[i] || 0])
          ]);
        } else if (type === 'diagnoses') {
          await placeChart(doc, 'Top Diagnoses', diagConfig, [
            ['Diagnosis', 'Count'],
            ...diagEntries.slice(0, 50).map(([k, v]) => [k, v])
          ]);
        } else if (type === 'visits') {
          await placeChart(doc, 'Daily Visit Trends', visitsConfig, [
            ['Date', 'Visits'],
            ...(visitsConfig.data?.labels || []).map((lbl, i) => [lbl, visitsConfig.data.datasets?.[0]?.data?.[i] || 0])
          ]);
        }
      } else {
        // --- FULL MODE: EXACT PAGE ORDER ---
        // page 2 - Census
        doc.addPage();
        await placeChart(doc, 'Monthly Case Counts', censusConfig, [
          ['Month', 'Cases'],
          ...(censusConfig.data?.labels || []).map((lbl, i) => [lbl, censusConfig.data.datasets?.[0]?.data?.[i] || 0])
        ]);

        // page 3 - Top Diagnoses
        doc.addPage();
        await placeChart(doc, 'Top Diagnoses', diagConfig, [
          ['Diagnosis', 'Count'],
          ...diagEntries.slice(0, 50).map(([k, v]) => [k, v])
        ]);

        // page 4 - Visit Trends
        doc.addPage();
        await placeChart(doc, 'Daily Visit Trends', visitsConfig, [
          ['Date', 'Visits'],
          ...(visitsConfig.data?.labels || []).map((lbl, i) => [lbl, visitsConfig.data.datasets?.[0]?.data?.[i] || 0])
        ]);
      }

      const filename = `tup_report_${type}_${new Date().toISOString().slice(0,10)}.pdf`;
      doc.save(filename);
      setShowExportMenu(false);
    } catch (err) {
      console.error('PDF export error', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="main">
      <section className="page">
        {/* Header card with short description */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Reports & Analytics</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ color: 'var(--muted)', fontSize: 13 }}>From</label>
              <input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <label style={{ color: 'var(--muted)', fontSize: 13 }}>To</label>
              <input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />

              <select id="r-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="census">Census</option>
                <option value="diagnoses">Top Diagnoses</option>
                <option value="visits">Visit Trends</option>
              </select>

              <div style={{ position: 'relative' }}>
                <button className="btn" onClick={() => setShowExportMenu(s => !s)}>Export</button>
                {showExportMenu && (
                  <div style={{
                    position: 'absolute', right: 0, marginTop: 6, background: 'var(--panel)',
                    border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                    borderRadius: 6, zIndex: 2000, overflow: 'hidden', minWidth: 220
                  }}>
                    <button onClick={() => exportCsv('full')} style={menuBtnStyle} disabled={!reportData || reportData.length === 0}>CSV (Full)</button>
                    <button onClick={() => exportPdf('selected')} style={menuBtnStyle} disabled={!reportData || reportData.length === 0 || exporting}>PDF (Selected)</button>
                    <button onClick={() => exportPdf('full')} style={menuBtnStyle} disabled={!reportData || reportData.length === 0 || exporting}>PDF (Full)</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 14 }}>
            Generate clinic analytics (census, top diagnoses, visit trends) across a date range.
            Use Export → PDF (Selected) to create a cover + selected chart (with its raw data), or PDF (Full) to generate a cover + Census / Diagnoses / Visits each on their own pages with their raw data.
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="grid-2col" style={{ gap: 12 }}>
            <div id="report-output">
              <h3 style={{ marginTop: 0 }}>Report Preview</h3>

              {dateError && <div style={{ color: '#b71c1c', marginBottom: 8 }}>{dateError}</div>}

              {chartData ? (
                <div style={{ marginBottom: 12 }}>
                  {chartData.type === 'bar' ? <Bar data={chartData.data} options={chartData.options} /> :
                   chartData.type === 'pie' ? <Pie data={chartData.data} options={chartData.options} /> : null}
                </div>
              ) : (
                <div style={{ minHeight: 140, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {loading ? 'Loading chart…' : 'No chart for this report type.'}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <h4>Raw Data</h4>
                {(!reportData || reportData.length === 0) ? (
                  <div style={{ color: 'var(--muted)' }}>No data for the selected range.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" aria-label="Report data table">
                      <thead>
                        <tr><th>Date</th><th>Patient</th><th>Clinician</th><th>Complaint</th></tr>
                      </thead>
                      <tbody>
                        {reportData.map(enc => (
                          <tr key={enc.id || Math.random()}>
                            <td>{new Date(enc.encounter_date).toLocaleString()}</td>
                            <td>{enc.patient_name || enc.patient_id}</td>
                            <td>{enc.clinician_name}</td>
                            <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{enc.chief_complaint || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <aside style={{ width: 360 }}>
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ marginTop: 0 }}>Clinical Guide</h4>
                <div style={{ marginBottom: 12 }}>
                  <strong>Auto 30-day view:</strong> this page loads the last {DEFAULT_LOOKBACK_DAYS} days automatically.
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong>Interpretation tips:</strong>
                  <ul style={{ marginTop: 8 }}>
                    <li>Rising visit trend → consider staffing/triage review.</li>
                    <li>High-frequency diagnosis → investigate for clusters or follow-up needs.</li>
                    <li>Use the "Raw Data" table to drill into specific encounters.</li>
                  </ul>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong>Export notes:</strong>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    PDFs: cover page shows clinic title/logo; subsequent pages contain chart + raw data and only a small page-number footer.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
};

const menuBtnStyle = {
  display: 'block',
  padding: '8px 14px',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13
};

export default Reports;
