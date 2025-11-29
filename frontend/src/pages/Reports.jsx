import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { exportCsv } from '../utils.js';
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';
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
        // Monthly case counts
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
              title: {
                display: true,
                text: 'Monthly Case Counts'
              }
            }
          }
        });
      } else if (type === 'diagnoses') {
        // Top diagnoses
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
              title: {
                display: true,
                text: 'Top Diagnoses'
              }
            }
          }
        });
      } else if (type === 'visits') {
        // Visit trends over time
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
              title: {
                display: true,
                text: 'Daily Visit Trends'
              }
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

  const exportCsv = () => {
    if (!reportData) return;
    let csv = 'Date,Patient,Clinician,Chief Complaint\n';
    reportData.forEach(enc => {
      csv += `${new Date(enc.encounter_date).toLocaleDateString()},${enc.patient_id},${enc.clinician_name},${enc.chief_complaint || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // const exportPdf = () => {
  //   if (!reportData) return;
  //   const doc = new jsPDF();
  //   doc.text(`${type.toUpperCase()} Report (${from} to ${to})`, 14, 16);
  //   const tableColumn = ['Date', 'Patient', 'Clinician', 'Chief Complaint'];
  //   const tableRows = reportData.map(enc => [
  //     new Date(enc.encounter_date).toLocaleDateString(),
  //     enc.patient_id,
  //     enc.clinician_name,
  //     enc.chief_complaint || ''
  //   ]);
  //   doc.autoTable(tableColumn, tableRows, { startY: 20 });
  //   doc.save('report.pdf');
  // };

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
              <button className="btn" style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.03)' }} onClick={exportCsv}>Export CSV</button>
              {/* <button className="btn" style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.03)' }} onClick={exportPdf}>Export PDF</button> */}
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
