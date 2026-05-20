import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';

const PatientMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [physicians, setPhysicians] = useState([]);
  const [form, setForm] = useState({ recipient_name: '', concern_type: 'General clinic inquiry', message_text: '' });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);

  const loadData = async () => {
    if (!user?.patient_id) return;
    const [{ data: msgs }, { data: docs }] = await Promise.all([
      supabase
        .from('patient_messages')
        .select('*')
        .eq('patient_id', user.patient_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('name')
        .eq('active', true)
        .in('role', ['physician', 'admin'])
        .order('name', { ascending: true }),
    ]);
    setMessages(msgs || []);
    setPhysicians((docs || []).map((d) => d.name).filter(Boolean));
  };

  useEffect(() => {
    loadData();
  }, [user?.patient_id]);

  useEffect(() => {
    if (notice) setNoticeOpen(true);
  }, [notice]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const msg of messages) {
      const key = msg.recipient_name || 'Clinic';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(msg);
    }
    return Array.from(map.entries());
  }, [messages]);

  const send = async () => {
    if (!user?.patient_id || !form.message_text.trim()) {
      setNotice('Message cannot be empty.');
      return;
    }
    setSending(true);
    setNotice('');
    const { error } = await supabase.from('patient_messages').insert([{
      patient_id: user.patient_id,
      patient_name: user.name || null,
      sender_role: 'patient',
      sender_name: user.name || 'Patient',
      recipient_name: form.recipient_name || 'Clinic',
      concern_type: form.concern_type,
      message_text: form.message_text.trim(),
      status: 'sent',
    }]);
    if (error) {
      setNotice(`Unable to send message: ${error.message}`);
      setSending(false);
      return;
    }
    setForm({ recipient_name: form.recipient_name, concern_type: form.concern_type, message_text: '' });
    setNotice('Message sent.');
    await loadData();
    setSending(false);
  };

  return (
    <main className="main">
      <section className="page patient-dashboard-page">
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Messages</h2>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            Send non-emergency messages to your doctor or clinic.
          </div>
        </div>

        <div className="patient-main-grid patient-msg-grid">
          <div className="card patient-msg-card">
            <h3 style={{ marginTop: 0 }}>New Message</h3>
            <select className="input" value={form.recipient_name} onChange={(e) => setForm((p) => ({ ...p, recipient_name: e.target.value }))}>
              <option value="">Clinic (General)</option>
              {physicians.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select className="input" style={{ marginTop: 10 }} value={form.concern_type} onChange={(e) => setForm((p) => ({ ...p, concern_type: e.target.value }))}>
              <option>Appointment concern</option>
              <option>Follow-up question</option>
              <option>Medical inquiry</option>
              <option>Dental inquiry</option>
              <option>General clinic inquiry</option>
            </select>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 120, marginTop: 10 }}
              placeholder="Type your concern..."
              value={form.message_text}
              onChange={(e) => setForm((p) => ({ ...p, message_text: e.target.value }))}
            />
            <div className="patient-btn-row">
              <button className="btn" onClick={send} disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
            </div>
          </div>

          <div className="card patient-msg-card">
            <h3 style={{ marginTop: 0 }}>Conversations</h3>
            {grouped.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>No messages yet.</div>
            ) : (
              grouped.map(([thread, rows]) => (
                <div key={thread} className="patient-msg-thread-row" style={{ padding: 10, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontWeight: 700 }}>{thread}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{rows.length} message(s)</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card patient-msg-card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Message History</h3>
          <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>To</th>
                <th>Concern</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr><td colSpan={5}>No messages.</td></tr>
              ) : messages.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                  <td>{m.recipient_name || 'Clinic'}</td>
                  <td>{m.concern_type || '-'}</td>
                  <td>{m.message_text}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        {noticeOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3200, padding: 14 }}
            onClick={() => setNoticeOpen(false)}
          >
            <div
              style={{ width: 'min(92vw, 520px)', background: 'var(--panel)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 18px 38px rgba(0,0,0,0.18)', padding: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Message Notice</div>
              <div style={{ color: notice.toLowerCase().includes('unable') ? 'var(--danger)' : 'var(--text)', lineHeight: 1.45 }}>{notice}</div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn secondary" onClick={() => setNoticeOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default PatientMessages;
