import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../AuthContext.jsx';

const SLOT_TIMES = ['09:00-12:00', '13:00-16:00', '16:00-19:00'];
const SLOT_CAPACITY = 1;
const DAILY_PATIENT_LIMIT = SLOT_TIMES.length * SLOT_CAPACITY;
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SERVICES = {
  'Medical Clinic': ['Consultation', 'Check-up'],
  'Dental Clinic': ['Dental cleaning', 'Tooth extraction/bunot', 'Dental check-up'],
};

const pad = (v) => String(v).padStart(2, '0');
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const formatLongDate = (key) => {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const createReferenceCode = (dateKey) => {
  const raw = `${dateKey.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  return `APT-${raw}`;
};

const AppointmentBookingFlow = ({ source = 'portal', kioskMode = false }) => {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfMonth(new Date()));
  const [form, setForm] = useState({
    department: 'Medical Clinic',
    appointment_type: 'Same-day Appointment',
    appointment_date: today,
    appointment_time: '',
    clinician_name: '',
    service_type: 'Consultation',
    patient_id: user?.patient_id || '',
    patient_name: user?.name || '',
  });

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true });
    setAppointments(data || []);
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    const loadStaff = async () => {
      const { data } = await supabase
        .from('users')
        .select('name, role')
        .eq('active', true)
        .in('role', ['physician', 'nurse', 'admin'])
        .order('name', { ascending: true });
      setStaffList(data || []);
    };
    loadStaff();
  }, []);

  useEffect(() => {
    if (user?.patient_id && !kioskMode) {
      setForm((p) => ({ ...p, patient_id: user.patient_id, patient_name: user.name || p.patient_name }));
    }
  }, [user?.patient_id, user?.name, kioskMode]);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      appointment_date: p.appointment_type === 'Same-day Appointment' ? today : (p.appointment_date < today ? today : p.appointment_date),
      service_type: SERVICES[p.department][0],
      appointment_time: p.appointment_type === 'Same-day Appointment' && p.appointment_date !== today ? '' : p.appointment_time,
    }));
  }, [form.department, form.appointment_type, today]);

  const visibleStaff = useMemo(() => {
    if (form.department === 'Dental Clinic') {
      return staffList.filter((s) => /dent/i.test(s.name || ''));
    }
    return staffList;
  }, [staffList, form.department]);

  const selectedWeekDay = new Date(`${form.appointment_date}T00:00:00`).getDay();

  const isDateSelectable = (dateKey) => {
    if (form.appointment_type === 'Same-day Appointment') return dateKey === today;
    return dateKey >= today;
  };

  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);
    const startWeekDay = first.getDay();
    const daysInMonth = last.getDate();
    const cells = [];
    for (let i = 0; i < startWeekDay; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const dayAvailability = useMemo(() => {
    const map = new Map();
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);
    for (let day = 1; day <= last.getDate(); day += 1) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      const key = toDateKey(d);
      if (!isDateSelectable(key)) continue;
      const booked = appointments.filter((a) =>
        a.appointment_date === key &&
        a.department === form.department &&
        a.status !== 'Cancelled',
      ).length;
      const dayCapacity = DAILY_PATIENT_LIMIT;
      const available = Math.max(dayCapacity - booked, 0);
      const pct = dayCapacity ? Math.round((available / dayCapacity) * 100) : 0;
      map.set(key, pct);
    }
    return map;
  }, [appointments, form.department, form.appointment_type, today, viewMonth]);

  const availableSlots = useMemo(() => {
    return SLOT_TIMES.filter((time) => {
      const slotBookedCount = appointments.filter((a) =>
        a.appointment_date === form.appointment_date &&
        a.department === form.department &&
        (a.appointment_time || '') === time &&
        a.status !== 'Cancelled',
      ).length;
      const dailyBookedCount = appointments.filter((a) =>
        a.appointment_date === form.appointment_date &&
        a.department === form.department &&
        a.status !== 'Cancelled',
      ).length;
      return dailyBookedCount < DAILY_PATIENT_LIMIT && slotBookedCount < SLOT_CAPACITY;
    });
  }, [appointments, form.appointment_date, form.department]);

  const slotRows = useMemo(() => {
    const dailyBookedCount = appointments.filter((a) =>
      a.appointment_date === form.appointment_date &&
      a.department === form.department &&
      a.status !== 'Cancelled',
    ).length;
    const dailyRemaining = Math.max(DAILY_PATIENT_LIMIT - dailyBookedCount, 0);

    return SLOT_TIMES.map((time) => {
      const windowBookedCount = appointments.filter((a) =>
        a.appointment_date === form.appointment_date &&
        a.department === form.department &&
        (a.appointment_time || '') === time &&
        a.status !== 'Cancelled',
      ).length;
      const availableCount = Math.max(SLOT_CAPACITY - windowBookedCount, 0);
      const pct = SLOT_CAPACITY ? Math.round((availableCount / SLOT_CAPACITY) * 100) : 0;
      return { time, availableCount, pct, disabled: dailyRemaining <= 0 || availableCount <= 0, windowBookedCount };
    });
  }, [appointments, form.appointment_date, form.department]);

  const submit = async () => {
    if (!form.patient_id || !form.patient_name || !form.appointment_date || !form.appointment_time || !form.service_type) {
      setNotice('Please complete all required fields.');
      return;
    }
    const dayBookedCount = appointments.filter((a) =>
      a.appointment_date === form.appointment_date &&
      a.department === form.department &&
      a.status !== 'Cancelled',
    ).length;
    if (dayBookedCount >= DAILY_PATIENT_LIMIT) {
      setNotice(`Selected date is already full (${DAILY_PATIENT_LIMIT}/${DAILY_PATIENT_LIMIT} patients). Please pick another date.`);
      return;
    }
    const selectedSlotBookedCount = appointments.filter((a) =>
      a.appointment_date === form.appointment_date &&
      a.department === form.department &&
      (a.appointment_time || '') === form.appointment_time &&
      a.status !== 'Cancelled',
    ).length;
    if (selectedSlotBookedCount >= SLOT_CAPACITY) {
      setNotice('Selected timeframe is no longer available. Please choose another one.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      let queueNumber = null;
      let referenceCode = null;
      let status = 'Scheduled';

      if (form.appointment_type === 'Same-day Appointment') {
        const sameDayRows = appointments.filter((a) =>
          a.appointment_date === form.appointment_date &&
          a.department === form.department &&
          a.appointment_type === 'Same-day Appointment' &&
          typeof a.queue_number === 'number',
        );
        const maxQueue = sameDayRows.reduce((m, a) => Math.max(m, a.queue_number || 0), 0);
        queueNumber = maxQueue + 1;
        status = 'Checked-in';
      } else {
        referenceCode = createReferenceCode(form.appointment_date);
      }

      const payload = {
        patient_id: form.patient_id.trim(),
        patient_name: form.patient_name.trim(),
        clinician_name: form.clinician_name || 'To be assigned',
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        type: form.department === 'Dental Clinic' ? 'Follow-up' : 'Consult',
        source,
        department: form.department,
        appointment_type: form.appointment_type,
        service_type: form.service_type,
        queue_number: queueNumber,
        reference_code: referenceCode,
        status,
      };

      const { error } = await supabase.from('appointments').insert([payload]);
      if (error) throw error;

      setNotice(
        form.appointment_type === 'Same-day Appointment'
          ? `Queue generated: #${queueNumber}. Please proceed to clinic waiting area.`
          : `Appointment submitted. Reference: ${referenceCode}.`,
      );
      setForm((p) => ({ ...p, appointment_time: '' }));
      await loadAppointments();
    } catch (e) {
      console.error(e);
      setNotice(`Booking failed: ${e.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main">
      <section className="page">
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{kioskMode ? 'Clinic Kiosk Booking' : 'Appointment Booking'}</h2>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            Book same-day or future appointments synced with the EHR scheduling dashboard.
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['Medical Clinic', 'Dental Clinic'].map((dept) => {
                const active = form.department === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    className="btn secondary"
                    onClick={() => setForm((p) => ({ ...p, department: dept }))}
                    style={{ justifyContent: 'center', padding: 14, borderRadius: 8, background: active ? 'rgba(140,21,21,0.12)' : 'transparent', color: active ? 'var(--text)' : 'var(--muted)' }}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['Same-day Appointment', 'Future Appointment'].map((kind) => {
                const active = form.appointment_type === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    className="btn secondary"
                    onClick={() => setForm((p) => ({ ...p, appointment_type: kind }))}
                    style={{ justifyContent: 'center', padding: 14, borderRadius: 8, background: active ? 'rgba(140,21,21,0.12)' : 'transparent', color: active ? 'var(--text)' : 'var(--muted)' }}
                  >
                    {kind}
                  </button>
                );
              })}
            </div>

            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <button className="btn secondary small" type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))}>{'<'}</button>
                <strong style={{ fontSize: 18 }}>{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</strong>
                <button className="btn secondary small" type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))}>{'>'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {DAYS_SHORT.map((day, i) => (
                  <div key={day} style={{ textAlign: 'center', padding: 6, fontWeight: 700, color: i === selectedWeekDay ? 'var(--accent)' : 'var(--muted)' }}>{day}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {calendarCells.map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} style={{ height: 60, border: '1px solid rgba(0,0,0,0.05)', borderRadius: 6 }} />;
                  const key = toDateKey(cell);
                  const selected = key === form.appointment_date;
                  const selectable = isDateSelectable(key);
                  const pct = dayAvailability.get(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!selectable}
                      onClick={() => {
                        setForm((p) => ({ ...p, appointment_date: key, appointment_time: '' }));
                        setNotice('');
                      }}
                      style={{
                        height: 60,
                        borderRadius: 6,
                        border: selected ? '1px solid var(--accent)' : '1px solid rgba(0,0,0,0.16)',
                        background: selected ? 'rgba(140,21,21,0.14)' : 'transparent',
                        color: selectable ? 'var(--text)' : 'var(--muted)',
                        opacity: selectable ? 1 : 0.45,
                        cursor: selectable ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{cell.getDate()}</div>
                      {typeof pct === 'number' ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>{pct}% free</div> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: 10, fontWeight: 700, textAlign: 'center' }}>{formatLongDate(form.appointment_date)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(0,0,0,0.03)', fontWeight: 700 }}>
                <div style={{ padding: 10, borderRight: '1px solid rgba(0,0,0,0.1)' }}>Time</div>
                <div style={{ padding: 10, borderRight: '1px solid rgba(0,0,0,0.1)' }}>Available Slots</div>
                <div style={{ padding: 10 }}>In Percentage</div>
              </div>
              {slotRows.map((row) => {
                const selected = form.appointment_time === row.time;
                return (
                  <div key={row.time} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ padding: 8 }}>
                      <button
                        type="button"
                        disabled={row.disabled || !availableSlots.includes(row.time)}
                        className="btn secondary"
                        onClick={() => setForm((p) => ({ ...p, appointment_time: row.time }))}
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          background: selected ? 'var(--accent)' : 'transparent',
                          color: selected ? '#fff' : 'var(--text)',
                          borderColor: selected ? 'var(--accent)' : 'rgba(0,0,0,0.1)',
                          opacity: row.disabled ? 0.45 : 1,
                        }}
                      >
                        {row.time}
                      </button>
                    </div>
                    <div style={{ padding: 12 }}>{row.availableCount}</div>
                    <div style={{ padding: 12 }}>{row.pct}%</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select className="input" value={form.clinician_name} onChange={(e) => setForm((p) => ({ ...p, clinician_name: e.target.value }))}>
                <option value="">Any available personnel</option>
                {visibleStaff.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.role})</option>)}
              </select>
              <select className="input" value={form.service_type} onChange={(e) => setForm((p) => ({ ...p, service_type: e.target.value }))}>
                {SERVICES[form.department].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="input" placeholder="Student ID" value={form.patient_id} onChange={(e) => setForm((p) => ({ ...p, patient_id: e.target.value }))} disabled={!kioskMode} />
              <input className="input" placeholder="Full Name" value={form.patient_name} onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))} disabled={!kioskMode && !!user?.name} />
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div><strong>Review:</strong> {form.department} • {form.appointment_type} • {form.appointment_date} {form.appointment_time || ''}</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>
              Service: {form.service_type || '-'} • Personnel: {form.clinician_name || 'Any available'}
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            <span style={{ color: notice.includes('failed') ? 'var(--danger)' : 'var(--muted)' }}>{notice}</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AppointmentBookingFlow;
