-- Latest mock seed data for TUP Clinic EHR (2026)
-- Run this in Supabase SQL Editor after schema setup.
-- Safe to re-run: uses deterministic UUIDs + upserts where possible.

begin;

-- If clinic-hours DB guard is enabled, bypass for this seed session.
select set_config('app.bypass_clinic_hours', 'on', true);

-- 1) Students
insert into public.students (id, name, year)
values
('2021-01234', 'Juan Dela Cruz', 3),
('2020-04567', 'Maria Santos', 4),
('2022-05678', 'Ana Reyes', 2),
('2023-07890', 'Carlos Garcia', 1),
('2022-09876', 'Elena Lopez', 2),
('2021-06543', 'Miguel Torres', 3),
('2023-01278', 'Isabella Rodriguez', 1),
('2020-03456', 'Diego Fernandez', 4),
('2022-07891', 'Sofia Martinez', 2),
('2021-04321', 'Alejandro Ruiz', 3),
('2023-05678', 'Valentina Gomez', 1),
('2020-06789', 'Mateo Morales', 4),
('2022-08901', 'Camila Silva', 2),
('2021-07892', 'Sebastian Ramirez', 3),
('2023-04321', 'Luna Castillo', 1),
('2020-07893', 'Ethan Flores', 4),
('2022-03210', 'Mia Castro', 2),
('2021-09876', 'Daniel Mendoza', 3)
on conflict (id) do update
set
  name = excluded.name,
  year = excluded.year,
  updated_at = now();

-- 2) Patients
insert into public.patients (id, name, year, last_visit_date)
select
  s.id,
  s.name,
  s.year,
  null::date
from public.students s
where s.id in (
  '2021-01234','2020-04567','2022-05678','2023-07890','2022-09876','2021-06543',
  '2023-01278','2020-03456','2022-07891','2021-04321','2023-05678','2020-06789',
  '2022-08901','2021-07892','2023-04321','2020-07893','2022-03210','2021-09876'
)
on conflict (id) do update
set
  name = excluded.name,
  year = excluded.year,
  updated_at = now();

-- 3) Appointments (2026)
insert into public.appointments
  (id, patient_id, patient_name, clinician_name, appointment_date, appointment_time, type, status)
values
('b7d0aa65-644a-4dc5-87a8-5fa6e4b56001', '2021-01234', 'Juan Dela Cruz', 'Dr. Rivera', '2026-04-14', '09:00', 'Consult', 'Checked-in'),
('b7d0aa65-644a-4dc5-87a8-5fa6e4b56002', '2020-04567', 'Maria Santos', 'Nurse Santos', '2026-04-14', '09:30', 'Follow-up', 'Checked-in'),
('b7d0aa65-644a-4dc5-87a8-5fa6e4b56003', '2022-05678', 'Ana Reyes', 'Dr. Rivera', '2026-04-15', '10:00', 'Consult', 'Scheduled'),
('b7d0aa65-644a-4dc5-87a8-5fa6e4b56004', '2023-07890', 'Carlos Garcia', 'Nurse Santos', '2026-04-15', '10:30', 'Follow-up', 'Scheduled'),
('b7d0aa65-644a-4dc5-87a8-5fa6e4b56005', '2022-09876', 'Elena Lopez', 'Dr. Rivera', '2026-04-16', '13:00', 'Consult', 'Scheduled'),
('b7d0aa65-644a-4dc5-87a8-5fa6e4b56006', '2021-06543', 'Miguel Torres', 'Nurse Santos', '2026-04-16', '13:30', 'Follow-up', 'Scheduled')
on conflict (id) do update
set
  patient_id = excluded.patient_id,
  patient_name = excluded.patient_name,
  clinician_name = excluded.clinician_name,
  appointment_date = excluded.appointment_date,
  appointment_time = excluded.appointment_time,
  type = excluded.type,
  status = excluded.status,
  updated_at = now();

-- 4) Encounters (last 30 days in 2026 for dashboard trends)
insert into public.encounters
  (id, patient_id, patient_name, clinician_name, encounter_date, chief_complaint, assessment_plan, vitals)
values
('d5e34175-dac7-4ae7-a88d-2aa8a0f77001', '2021-01234', 'Juan Dela Cruz', 'Dr. Rivera', '2026-03-20T09:15:00+08:00', 'Fever', 'Paracetamol and hydration', '{"temp":"38.2","pulse":"90","bp":"120/80","weight":"60"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77002', '2020-04567', 'Maria Santos', 'Dr. Rivera', '2026-03-22T10:40:00+08:00', 'Headache', 'Rest, hydration, monitor symptoms', '{"temp":"36.9","pulse":"76","bp":"118/76","weight":"57"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77003', '2022-05678', 'Ana Reyes', 'Dr. Rivera', '2026-03-25T11:20:00+08:00', 'Cough', 'Cough syrup and steam inhalation', '{"temp":"37.1","pulse":"82","bp":"119/79","weight":"55"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77004', '2023-07890', 'Carlos Garcia', 'Nurse Santos', '2026-03-27T08:35:00+08:00', 'Sore throat', 'Warm saline gargle and lozenges', '{"temp":"37.0","pulse":"80","bp":"117/75","weight":"70"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77005', '2022-09876', 'Elena Lopez', 'Dr. Rivera', '2026-03-29T14:10:00+08:00', 'Flu symptoms', 'Oseltamivir, rest, fluids', '{"temp":"38.4","pulse":"92","bp":"122/82","weight":"62"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77006', '2021-06543', 'Miguel Torres', 'Nurse Santos', '2026-04-01T09:50:00+08:00', 'Cold symptoms', 'Decongestant and rest', '{"temp":"37.4","pulse":"84","bp":"116/74","weight":"58"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77007', '2023-01278', 'Isabella Rodriguez', 'Dr. Rivera', '2026-04-03T15:25:00+08:00', 'Back pain', 'NSAID and posture advice', '{"temp":"36.8","pulse":"74","bp":"120/80","weight":"68"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77008', '2020-03456', 'Diego Fernandez', 'Nurse Santos', '2026-04-05T10:05:00+08:00', 'Dizziness', 'Blood pressure monitoring', '{"temp":"36.7","pulse":"78","bp":"110/68","weight":"55"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77009', '2022-07891', 'Sofia Martinez', 'Dr. Rivera', '2026-04-07T13:45:00+08:00', 'Anxiety symptoms', 'Counseling referral and follow-up', '{"temp":"36.9","pulse":"96","bp":"132/88","weight":"65"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77010', '2021-04321', 'Alejandro Ruiz', 'Dr. Rivera', '2026-04-08T11:30:00+08:00', 'Skin rash', 'Topical corticosteroid for 5 days', '{"temp":"36.6","pulse":"72","bp":"114/70","weight":"63"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77011', '2023-05678', 'Valentina Gomez', 'Dr. Rivera', '2026-04-09T14:20:00+08:00', 'Migraine', 'Triptan and trigger tracking', '{"temp":"36.8","pulse":"86","bp":"124/84","weight":"52"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77012', '2020-06789', 'Mateo Morales', 'Nurse Santos', '2026-04-10T09:00:00+08:00', 'Stress related symptoms', 'Stress management guidance', '{"temp":"36.7","pulse":"82","bp":"115/72","weight":"60"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77013', '2022-08901', 'Camila Silva', 'Dr. Rivera', '2026-04-11T10:10:00+08:00', 'Ear infection', 'Ear drops and antibiotic', '{"temp":"37.2","pulse":"84","bp":"118/78","weight":"48"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77014', '2021-07892', 'Sebastian Ramirez', 'Dr. Rivera', '2026-04-12T16:00:00+08:00', 'Joint pain', 'NSAID and stretching exercises', '{"temp":"36.9","pulse":"83","bp":"122/84","weight":"72"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77015', '2023-04321', 'Luna Castillo', 'Dr. Rivera', '2026-04-13T08:20:00+08:00', 'Fever', 'Hydration and antipyretic', '{"temp":"38.0","pulse":"89","bp":"121/79","weight":"58"}'::jsonb),
('d5e34175-dac7-4ae7-a88d-2aa8a0f77016', '2020-07893', 'Ethan Flores', 'Nurse Santos', '2026-04-14T10:00:00+08:00', 'Cough', 'Symptomatic treatment and rest', '{"temp":"37.3","pulse":"81","bp":"116/73","weight":"61"}'::jsonb)
on conflict (id) do update
set
  patient_id = excluded.patient_id,
  patient_name = excluded.patient_name,
  clinician_name = excluded.clinician_name,
  encounter_date = excluded.encounter_date,
  chief_complaint = excluded.chief_complaint,
  assessment_plan = excluded.assessment_plan,
  vitals = excluded.vitals,
  updated_at = now();

-- Keep patient last_visit_date fresh based on seeded encounters.
update public.patients p
set
  last_visit_date = e.max_date,
  updated_at = now()
from (
  select patient_id, max(encounter_date::date) as max_date
  from public.encounters
  group by patient_id
) e
where p.id = e.patient_id;

-- 5) Inventory rows
insert into public.inventory (item_name, category, stock_quantity, unit, reorder_level)
values
('Paracetamol 500mg', 'Medications', 102, 'pcs', 20),
('Gauze', 'Consumables', 58, 'pcs', 15),
('Bandages 5cm', 'Consumables', 120, 'pcs', 20),
('Aspirin 300mg', 'Medications', 78, 'pcs', 20),
('Thermometers', 'Diagnostic Equipment', 19, 'pcs', 5),
('Blood Pressure Monitors', 'Diagnostic Equipment', 10, 'pcs', 3),
('Syringes 5ml', 'Consumables', 190, 'pcs', 40),
('Antiseptic Cream', 'First Aid / Disinfectants', 42, 'pcs', 10)
on conflict (item_name) do update
set
  category = excluded.category,
  stock_quantity = excluded.stock_quantity,
  unit = excluded.unit,
  reorder_level = excluded.reorder_level,
  updated_at = now();

-- 6) Inventory transactions (2026)
insert into public.inventory_transactions (id, item_name, transaction_type, quantity, reason, performed_by, created_at)
values
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41001', 'Paracetamol 500mg', 'out', 5, 'Patient J. Dela Cruz', 'Dr. Rivera', '2026-04-14T10:17:01+08:00'),
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41002', 'Gauze', 'out', 2, 'Dressing change', 'Nurse Santos', '2026-04-14T10:18:12+08:00'),
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41003', 'Bandages 5cm', 'in', 50, 'New delivery', 'Dr. Rivera', '2026-04-14T10:19:35+08:00'),
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41004', 'Aspirin 300mg', 'out', 2, 'Headache relief', 'Nurse Santos', '2026-04-14T10:22:41+08:00'),
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41005', 'Thermometers', 'out', 1, 'Patient M. Santos', 'Dr. Rivera', '2026-04-14T10:25:18+08:00'),
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41006', 'Syringes 5ml', 'out', 10, 'Vaccinations', 'Nurse Santos', '2026-04-14T10:28:04+08:00'),
('f4f8a30d-6fbb-4f15-b7ae-cf8a2fd41007', 'Antiseptic Cream', 'out', 3, 'Wound treatment', 'Dr. Rivera', '2026-04-14T10:30:11+08:00')
on conflict (id) do update
set
  item_name = excluded.item_name,
  transaction_type = excluded.transaction_type,
  quantity = excluded.quantity,
  reason = excluded.reason,
  performed_by = excluded.performed_by,
  created_at = excluded.created_at;

commit;
