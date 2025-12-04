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

import logo from '../assets/images/tupehrlogo.jpg';

const getBase64FromImg = (imgUrl) => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = reject;
  });
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const fetchCensusData = async () => {
  const { data: encounters, error: e1 } = await supabase
    .from('encounters')
    .select('id, patient_id, encounter_date, vitals, clinician_name, chief_complaint')  // <-- Added here
    .not('vitals', 'is', null);

  if (e1) throw e1;

  const { data: students, error: e2 } = await supabase
    .from('students')
    .select('id, name');

  if (e2) throw e2;

  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = s.name; });

  return encounters.map(enc => ({
    ...enc,
    name: studentMap[enc.patient_id] || enc.patient_id,
    date: new Date(enc.encounter_date).toLocaleDateString(),
    vitals: enc.vitals,
    clinician_name: enc.clinician_name,
    chief_complaint: enc.chief_complaint
  }));
};

const Reports = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('census');
  const [reportData, setReportData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const runReport = async () => {
    try {
      if (type === 'census' && !from && !to) {
        // Use the helper for initial census data
        const censusData = await fetchCensusData();
        setReportData(censusData);

        // Chart for census (unchanged)
        const monthCounts = {};
        censusData.forEach(enc => {
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
        return;
      }

      const fromIso = from || '1970-01-01';

      let toIso;
      if (to) {
        const toDateObj = new Date(to);
        toDateObj.setHours(23, 59, 59, 999);  // Make "to" inclusive of the full day!
        toIso = toDateObj.toISOString();
      } else {
        toIso = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('encounters')
        .select('*')
        .gte('encounter_date', fromIso)
        .lte('encounter_date', toIso)
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

    if (type === 'census' && reportData[0] && reportData[0].vitals !== undefined) {
      let csv = 'Name,Date,Vitals\n';
      reportData.forEach(enc => {
        const name = enc.name || enc.patient_id;
        const date = enc.date || new Date(enc.encounter_date).toLocaleDateString();
        const vitals = JSON.stringify(enc.vitals || {});
        csv += `${name},${date},${vitals}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'census_report.csv';
      a.click();
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
      return;
    }

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
    const logoBase64 = await getBase64FromImg(logo);
    const doc = new jsPDF('p', 'pt', 'a4');
    const headerMargin = 40;
    const logoWidth = 54;
    const logoHeight = 54;
    let headerY = headerMargin;
    doc.addImage(logoBase64, 'PNG', headerMargin, headerY, logoWidth, logoHeight);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Technological University of the Philippines - Clinic', headerMargin + logoWidth + 16, headerY + 22);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(
      `R e p o r t :  ${type === 'diagnoses' ? 'T O P  D I A G N O S E S' : type === 'census' ? 'C E N S U S' : 'V I S I T  T R E N D S'}  (${from || 'ALL'} - ${to || new Date().toISOString().slice(0,10)})`,
      headerMargin + logoWidth + 16,
      headerY + 38
    );
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, headerMargin + logoWidth + 16, headerY + 53);
    let y = Math.max(headerY + logoHeight, headerY + 54) + 14;

    if (type === 'diagnoses') {
      const diagCounts = {};
      reportData.forEach(enc => {
        const diag = enc.chief_complaint || 'Unknown';
        diagCounts[diag] = (diagCounts[diag] || 0) + 1;
      });
      const diagEntries = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
      const diagChartConfig = {
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
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, position: 'top' },
            title: { display: true, text: 'Top Diagnoses' }
          }
        }
      };

      const monthCounts = {};
      reportData.forEach(enc => {
        const month = new Date(enc.encounter_date).toISOString().slice(0, 7);
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });
      const sortedMonths = Object.keys(monthCounts).sort();
      const censusChartConfig = {
        type: 'bar',
        data: {
          labels: sortedMonths.map(m => m.replace('-', '/')),
          datasets: [{
            label: 'Cases',
            data: sortedMonths.map(m => monthCounts[m]),
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Monthly Case Counts' }
          }
        }
      };

      const visitCounts = {};
      reportData.forEach(enc => {
        const date = new Date(enc.encounter_date).toISOString().slice(0, 10);
        visitCounts[date] = (visitCounts[date] || 0) + 1;
      });
      const sortedDates = Object.keys(visitCounts).sort();
      const visitsChartConfig = {
        type: 'bar',
        data: {
          labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
          datasets: [{
            label: 'Visits',
            data: sortedDates.map(d => visitCounts[d]),
            backgroundColor: 'rgba(255, 99, 132, 0.7)',
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Daily Visit Trends' }
          }
        }
      };

      const diagImgWidth = doc.internal.pageSize.getWidth() - headerMargin * 2;
      const diagImgHeight = Math.round(diagImgWidth * 0.45);
      const diagImg = await createChartImage(diagChartConfig, diagImgWidth, diagImgHeight);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Top Diagnoses', headerMargin, y);
      y += 8;
      doc.addImage(diagImg, 'PNG', headerMargin, y, diagImgWidth, diagImgHeight);
      y += diagImgHeight + 12;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Monthly Case Counts', headerMargin, y);
      y += 8;
      const censusImgWidth = diagImgWidth;
      const censusImgHeight = Math.round(censusImgWidth * 0.45);
      const censusImg = await createChartImage(censusChartConfig, censusImgWidth, censusImgHeight);
      doc.addImage(censusImg, 'PNG', headerMargin, y, censusImgWidth, censusImgHeight);
      y += censusImgHeight + 12;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Daily Visit Trends', headerMargin, y);
      y += 8;
      const visitsImgWidth = diagImgWidth;
      const visitsImgHeight = Math.round(visitsImgWidth * 0.45);
      const visitsImg = await createChartImage(visitsChartConfig, visitsImgWidth, visitsImgHeight);
      doc.addImage(visitsImg, 'PNG', headerMargin, y, visitsImgWidth, visitsImgHeight);
      y += visitsImgHeight + 12;

      const diagRows = diagEntries.map(([k, v]) => [k, String(v)]);
      autoTable(doc, {
        head: [['Diagnosis', 'Cases']],
        body: diagRows,
        startY: y,
        margin: { left: headerMargin, right: headerMargin },
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: {
          fillColor: [30, 136, 229],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : y + 120;

      autoTable(doc, {
        head: [['Date', 'ID', 'Clinician', 'Complaint']],
        body: reportData.map(enc => [
          new Date(enc.encounter_date).toLocaleString(),
          enc.patient_id,
          enc.clinician_name,
          enc.chief_complaint || 'N/A'
        ]),
        startY: y,
        margin: { left: headerMargin, right: headerMargin },
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: [56, 142, 60],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
    }
    else if (type === 'census') {
      if (!chartData || !chartData.data || !chartData.data.labels || !chartData.data.datasets) {
        alert('No chart data available for export.');
        return;
      }
      const imgWidth = doc.internal.pageSize.getWidth() - headerMargin * 2;
      const imgHeight = Math.round(imgWidth * 0.45);
      const censusImg = await createChartImage({
        type: chartData.type,
        data: chartData.data,
        options: {
          ...(chartData.options || {}),
          plugins: {
            ...(chartData.options?.plugins || {}),
            legend: { display: false },
            title: { display: true, text: 'Monthly Case Counts' }
          },
        }
      }, imgWidth, imgHeight);

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Census (Monthly Cases)', headerMargin, y);
      y += 8;
      doc.addImage(censusImg, 'PNG', headerMargin, y, imgWidth, imgHeight);
      y += imgHeight + 12;

      const monthRows = chartData.data.labels.map((label, idx) => [
        label,
        String(chartData.data.datasets[0].data[idx])
      ]);
      autoTable(doc, {
        head: [['Month', 'Cases']],
        body: monthRows,
        startY: y,
        margin: { left: headerMargin, right: headerMargin },
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: {
          fillColor: [30, 136, 229],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : y + 120;

      autoTable(doc, {
        head: [['Date', 'Patient ID', 'Clinician', 'Chief Complaint']],
        body: reportData.map(enc => [
          new Date(enc.encounter_date).toLocaleDateString(),
          enc.patient_id,
          enc.clinician_name,
          enc.chief_complaint || 'N/A'
        ]),
        startY: y,
        margin: { left: headerMargin, right: headerMargin },
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: [56, 142, 60],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
    }
    else if (type === 'visits') {
      const visitCounts = {};
      reportData.forEach(enc => {
        const date = new Date(enc.encounter_date).toISOString().slice(0, 10);
        visitCounts[date] = (visitCounts[date] || 0) + 1;
      });
      const sortedDates = Object.keys(visitCounts).sort();
      const visitsChartConfig = {
        type: 'bar',
        data: {
          labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
          datasets: [{
            label: 'Visits',
            data: sortedDates.map(d => visitCounts[d]),
            backgroundColor: 'rgba(255, 99, 132, 0.7)',
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Daily Visit Trends' }
          }
        }
      };
      const imgWidth = doc.internal.pageSize.getWidth() - headerMargin * 2;
      const imgHeight = Math.round(imgWidth * 0.45);
      const visitsImg = await createChartImage(visitsChartConfig, imgWidth, imgHeight);

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Daily Visit Trends', headerMargin, y);
      y += 8;
      doc.addImage(visitsImg, 'PNG', headerMargin, y, imgWidth, imgHeight);
      y += imgHeight + 12;

      const dateRows = sortedDates.slice(0, 200).map(d => [new Date(d).toLocaleDateString(), String(visitCounts[d])]);
      autoTable(doc, {
        head: [['Date', 'Visits']],
        body: dateRows,
        startY: y,
        margin: { left: headerMargin, right: headerMargin },
        styles: { fontSize: 9 },
        theme: 'grid',
        headStyles: {
          fillColor: [30, 136, 229],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : y + 120;

      autoTable(doc, {
        head: [['Date', 'Patient ID', 'Clinician', 'Chief Complaint']],
        body: reportData.map(enc => [
          new Date(enc.encounter_date).toLocaleDateString(),
          enc.patient_id,
          enc.clinician_name,
          enc.chief_complaint || 'N/A'
        ]),
        startY: y,
        margin: { left: headerMargin, right: headerMargin },
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: [56, 142, 60],
          textColor: 255,
          fontStyle: 'bold'
        }
      });
    }

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
