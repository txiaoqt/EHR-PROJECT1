import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import autoTable from 'jspdf-autotable';
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

// PDF/chart libraries
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Chart from 'chart.js/auto';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('census');
  const [reportData, setReportData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const runReport = async () => {
    try {
      const { data, error } = await supabase
        .from('encounters')
        .select('*')
        .gte('encounter_date', from || '1970-01-01')
        .lte('encounter_date', to || new Date().toISOString())
        .order('encounter_date', { ascending: false });

      if (error) throw error;

      setReportData(data);

      if (type === 'census') {
        const monthCounts = {};
        data.forEach(enc => {
          const month = new Date(enc.encounter_date).toISOString().slice(0, 7);
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        });
        const sortedMonths = Object.keys(monthCounts).sort();
        setChartData({
          type: 'bar',
          data: {
            labels: sortedMonths.map(m => m.replace('-', '/')),
            datasets: [{
              label: 'Cases',
              data: sortedMonths.map(m => monthCounts[m]),
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: 'Monthly Case Counts' }
            }
          }
        });
      } else if (type === 'diagnoses') {
        const diagCounts = {};
        data.forEach(enc => {
          const diag = enc.chief_complaint || 'Unknown';
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
                '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
              ]
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: 'Top Diagnoses' }
            }
          }
        });
      } else if (type === 'visits') {
        const visitCounts = {};
        data.forEach(enc => {
          const date = new Date(enc.encounter_date).toISOString().slice(0, 10);
          visitCounts[date] = (visitCounts[date] || 0) + 1;
        });
        const sortedDates = Object.keys(visitCounts).sort();
        setChartData({
          type: 'bar',
          data: {
            labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
            datasets: [{
              label: 'Visits',
              data: sortedDates.map(d => visitCounts[d]),
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: 'Daily Visit Trends' }
            }
          }
        });
      }
    } catch (err) {
      console.error('Error running report:', err);
      setReportData([]);
      setChartData(null);
    }
  };

  // CSV exporter (kept local)
  const exportCsv = () => {
    if (!reportData) return;
    let csv = 'Date,Patient,Clinician,Chief Complaint\n';
    reportData.forEach(enc => {
      csv += `${new Date(enc.encounter_date).toLocaleDateString()},${enc.patient_id},${enc.clinician_name},${(enc.chief_complaint || '').replace(/,/g, ' ')}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.csv';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

const createChartImage = async (config, width = 900, height = 450) => {
  // returns dataURL string like "data:image/png;base64,...."
  try {
    // create offscreen canvas and attach to DOM (hidden) so browsers render it reliably
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // hide but keep in DOM so rendering works
    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';
    canvas.style.opacity = '0';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // create chart instance on the canvas
    // eslint-disable-next-line no-unused-vars
    const chart = new Chart(ctx, config);

    // Force a full update / render
    chart.update();

    // Give Chart.js some time to finish render/animations (increase if needed)
    await new Promise(res => setTimeout(res, 700));

    // Try preferred method first
    let dataUrl = null;
    try {
      dataUrl = chart.toBase64Image();
    } catch (err) {
      // ignore here, will try fallback
      console.warn('chart.toBase64Image() failed, will try canvas.toDataURL()', err);
    }

    // Fallback: canvas.toDataURL
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) {
      try {
        dataUrl = canvas.toDataURL('image/png', 1.0);
      } catch (err) {
        console.warn('canvas.toDataURL() fallback failed', err);
      }
    }

    // Cleanup
    try { chart.destroy(); } catch (e) { /* ignore */ }
    try { document.body.removeChild(canvas); } catch (e) { /* ignore */ }

    if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
      throw new Error('Invalid chart image generated');
    }

    return dataUrl;
  } catch (err) {
    console.error('createChartImage error', err);
    throw err;
  }
};

  const buildAllReportConfigs = () => {
    const data = reportData || [];
    // Diagnoses
    const diagCounts = {};
    data.forEach(enc => {
      const diag = enc.chief_complaint || 'Unknown';
      diagCounts[diag] = (diagCounts[diag] || 0) + 1;
    });
    const diagEntries = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const diagConfig = {
      type: 'pie',
      data: {
        labels: diagEntries.map(([k]) => k),
        datasets: [{
          data: diagEntries.map(([, v]) => v),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
          ]
        }]
      },
      options: { plugins: { title: { display: true, text: 'Top Diagnoses' } } }
    };

    // Census
    const monthCounts = {};
    data.forEach(enc => {
      const month = new Date(enc.encounter_date).toISOString().slice(0, 7);
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const sortedMonths = Object.keys(monthCounts).sort();
    const censusConfig = {
      type: 'bar',
      data: {
        labels: sortedMonths.map(m => m.replace('-', '/')),
        datasets: [{
          label: 'Cases',
          data: sortedMonths.map(m => monthCounts[m]),
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
        }]
      },
      options: { plugins: { title: { display: true, text: 'Monthly Case Counts' } } }
    };

    // Visits
    const visitCounts = {};
    data.forEach(enc => {
      const date = new Date(enc.encounter_date).toISOString().slice(0, 10);
      visitCounts[date] = (visitCounts[date] || 0) + 1;
    });
    const sortedDates = Object.keys(visitCounts).sort();
    const visitsConfig = {
      type: 'bar',
      data: {
        labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
        datasets: [{
          label: 'Visits',
          data: sortedDates.map(d => visitCounts[d]),
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
        }]
      },
      options: { plugins: { title: { display: true, text: 'Daily Visit Trends' } } }
    };

    return { diagConfig, censusConfig, visitsConfig, diagEntries };
  };

  const exportPdf = async () => {
  if (!reportData || reportData.length === 0) return alert('No report data to export.');

  try {
    // Build configs and derived tables
    const { diagConfig, censusConfig, visitsConfig, diagEntries } = buildAllReportConfigs();

    const doc = new jsPDF('p', 'pt', 'a4');
    const margin = 40;
    let y = margin;

    // Export only the selected report type
    if (type === 'diagnoses') {
    
      const imgWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const imgHeight = Math.round(imgWidth * 0.6); // keep aspect ratio

      const diagImg = await createChartImage({
        ...diagConfig,
        options: {
          // tweak legend and layout for clearer rendering
          ...(diagConfig.options || {}),
          plugins: {
            ...(diagConfig.options?.plugins || {}),
            legend: { position: 'top', labels: { boxWidth: 12 } }
          },
        }
      }, imgWidth, imgHeight);

      doc.setFontSize(14);
      doc.text('Top Diagnoses', margin, y);
      y += 8;

      doc.addImage(diagImg, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 12;

      const diagRows = diagEntries.map(([k, v]) => [k, String(v)]);
      autoTable(doc, {
        head: [['Diagnosis', 'Count']],
        body: diagRows,
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'striped',
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : y + 120;
    } else if (type === 'census') {
      // Census (monthly cases) only
      const imgWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const imgHeight = Math.round(imgWidth * 0.45);

      const censusImg = await createChartImage({
        ...censusConfig,
        options: {
          ...(censusConfig.options || {}),
          plugins: {
            ...(censusConfig.options?.plugins || {}),
            legend: { display: false }
          },
        }
      }, imgWidth, imgHeight);

      doc.setFontSize(14);
      doc.text('Census (Monthly Cases)', margin, y);
      y += 8;

      doc.addImage(censusImg, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 12;

      // Build small month/count table
      const monthCounts = {};
      reportData.forEach(enc => {
        const month = new Date(enc.encounter_date).toISOString().slice(0, 7);
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });
      const sortedMonths = Object.keys(monthCounts).sort();
      const monthRows = sortedMonths.map(m => [m.replace('-', '/'), String(monthCounts[m])]);

      autoTable(doc, {
        head: [['Month', 'Cases']],
        body: monthRows,
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : y + 120;
    } else if (type === 'visits') {
      // Visit trends only
      const imgWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const imgHeight = Math.round(imgWidth * 0.45);

      const visitsImg = await createChartImage({
        ...visitsConfig,
        options: {
          ...(visitsConfig.options || {}),
          plugins: {
            ...(visitsConfig.options?.plugins || {}),
            legend: { display: false }
          },
        }
      }, imgWidth, imgHeight);

      doc.setFontSize(14);
      doc.text('Visit Trends (Daily)', margin, y);
      y += 8;

      doc.addImage(visitsImg, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 12;

      // Build small daily visits table (limit to recent 200 days for space)
      const visitCounts = {};
      reportData.forEach(enc => {
        const date = new Date(enc.encounter_date).toISOString().slice(0, 10);
        visitCounts[date] = (visitCounts[date] || 0) + 1;
      });
      const sortedDates = Object.keys(visitCounts).sort();
      const dateRows = sortedDates.slice(0, 200).map(d => [new Date(d).toLocaleDateString(), String(visitCounts[d])]);

      autoTable(doc, {
        head: [['Date', 'Visits']],
        body: dateRows,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        theme: 'grid',
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : y + 120;
    }

    // Finalize and save (filename includes selected type)
    doc.save(`report_${type || 'report'}_${new Date().toISOString().slice(0,10)}.pdf`);
    setShowExportMenu(false);
  } catch (err) {
    console.error('PDF export error', err);
    alert('Failed to generate PDF: ' + (err.message || err));
  }
};

  return (
    <main className="main">
      <section className="page">
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Reports & Analytics</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ color: 'var(--muted)', fontSize: '13px' }}>From</label>
              <input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <label style={{ color: 'var(--muted)', fontSize: '13px' }}>To</label>
              <input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <select id="r-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="census">Census</option>
                <option value="diagnoses">Top Diagnoses</option>
                <option value="visits">Visit Trends</option>
              </select>
              <button className="btn" onClick={runReport}>Run</button>

              {/* Export control */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn"
                  style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.03)' }}
                  onClick={() => setShowExportMenu(s => !s)}
                >
                  Export
                </button>

                {showExportMenu && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: 6,
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                    borderRadius: 6,
                    zIndex: 2000,
                    overflow: 'hidden'
                  }}>
                    <button onClick={exportCsv} style={{ display: 'block', padding: '8px 14px', width: '180px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      CSV
                    </button>
                    <button onClick={exportPdf} style={{ display: 'block', padding: '8px 14px', width: '180px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      PDF
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div id="report-output" className="card">
            <h3 style={{ marginTop: 0 }}>Report Preview</h3>
            {chartData ? (
              <div>
                {chartData.type === 'bar' ? (
                  <Bar data={chartData.data} options={chartData.options} />
                ) : chartData.type === 'pie' ? (
                  <Pie data={chartData.data} options={chartData.options} />
                ) : null}
              </div>
            ) : reportData ? (
              <div>No chart for this report type.</div>
            ) : (
              <div style={{ minHeight: '180px', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No report generated yet. Select dates and click "Run".</div>
            )}
            {reportData && reportData.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4>Raw Data</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" aria-label="Report data table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Patient</th>
                        <th>Clinician</th>
                        <th>Chief Complaint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map(enc => (
                        <tr key={enc.id}>
                          <td>{new Date(enc.encounter_date).toLocaleString()}</td>
                          <td>{enc.patient_id}</td>
                          <td>{enc.clinician_name}</td>
                          <td>{enc.chief_complaint || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Reports;
