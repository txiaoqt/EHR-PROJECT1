-- Mock seed data for TUP Clinic EHR
-- Run this in Supabase SQL Editor after your schema/migrations are applied.

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

-- 2) Patients (ensure all encounter patient_ids exist)
insert into public.patients (id, name, year, last_visit_date, sensitivity_level)
select
  s.id,
  s.name,
  s.year,
  case s.id
    when '2021-01234' then date '2025-11-14'
    when '2020-04567' then date '2025-10-28'
    else null
  end as last_visit_date,
  'normal' as sensitivity_level
from public.students s
where s.id in (
  '2021-01234','2020-04567','2022-05678','2023-07890','2022-09876','2021-06543',
  '2023-01278','2020-03456','2022-07891','2021-04321','2023-05678','2020-06789',
  '2022-08901','2021-07892','2023-04321','2020-07893'
)
on conflict (id) do update
set
  name = excluded.name,
  year = excluded.year,
  last_visit_date = coalesce(excluded.last_visit_date, public.patients.last_visit_date),
  updated_at = now();

-- 3) Appointments
insert into public.appointments
  (patient_id, clinician_name, appointment_date, appointment_time, type, status)
values
('2021-01234', 'Dr. Rivera', '2025-11-21', '09:00', 'Consult', 'Scheduled'),
('2020-04567', 'Nurse Santos', '2025-11-21', '09:30', 'Follow-up', 'Checked-in');

-- 4) Encounters
insert into public.encounters
  (patient_id, clinician_name, encounter_date, chief_complaint, assessment_plan, vitals)
values
('2021-01234', 'Dr. Rivera', '2025-11-15T10:00:00+08:00', 'Fever', 'Antibiotics prescribed, rest advised', '{"temp":"101.5","pulse":"90","bp":"120/80","weight":"60"}'::jsonb),
('2021-01234', 'Dr. Rivera', '2025-11-10T11:00:00+08:00', 'Cough', 'Cough syrup and rest', '{"temp":"98.6","pulse":"80","bp":"118/78","weight":"61"}'::jsonb),
('2020-04567', 'Dr. Rivera', '2025-11-14T09:30:00+08:00', 'Headache', 'Pain relievers and hydration', '{"temp":"97.5","pulse":"75","bp":"116/76","weight":"57"}'::jsonb),
('2022-05678', 'Dr. Rivera', '2025-11-16T13:00:00+08:00', 'Stomach pain', 'Dietary changes, antacids', '{"temp":"99.0","pulse":"78","bp":"119/79","weight":"55"}'::jsonb),
('2022-05678', 'Dr. Rivera', '2025-11-12T10:30:00+08:00', 'Sore throat', 'Gargle salt water, lozenges', '{"temp":"98.0","pulse":"82","bp":"121/81","weight":"56"}'::jsonb),
('2021-01234', 'Dr. Rivera', '2025-11-18T15:00:00+08:00', 'Fever', 'Antibiotics', '{"temp":"102.0","pulse":"92","bp":"125/85","weight":"59"}'::jsonb),
('2023-07890', 'Dr. Rivera', '2025-11-19T14:00:00+08:00', 'Allergic reaction', 'Antihistamines, observation', '{"temp":"98.2","pulse":"85","bp":"118/75","weight":"70"}'::jsonb),
('2022-09876', 'Dr. Rivera', '2025-11-17T09:00:00+08:00', 'Flu symptoms', 'Antiviral medication, fluids', '{"temp":"100.8","pulse":"88","bp":"122/82","weight":"62"}'::jsonb),
('2021-06543', 'Nurse Santos', '2025-11-13T11:30:00+08:00', 'Sore throat', 'Salt water gargle, lozenges', '{"temp":"98.5","pulse":"78","bp":"115/70","weight":"58"}'::jsonb),
('2023-01278', 'Dr. Rivera', '2025-11-20T16:00:00+08:00', 'Back pain', 'Pain medication, light exercise', '{"temp":"98.0","pulse":"75","bp":"120/80","weight":"68"}'::jsonb),
('2020-03456', 'Nurse Santos', '2025-11-11T08:00:00+08:00', 'Cold symptoms', 'Rest, decongestants', '{"temp":"99.5","pulse":"82","bp":"117/74","weight":"55"}'::jsonb),
('2022-07891', 'Dr. Rivera', '2025-11-21T10:00:00+08:00', 'Anxiety symptoms', 'Counseling referral, mild sedative', '{"temp":"98.6","pulse":"95","bp":"135/90","weight":"65"}'::jsonb),
('2021-04321', 'Dr. Rivera', '2025-11-09T12:00:00+08:00', 'Skin rash', 'Topical cream, allergy testing', '{"temp":"97.8","pulse":"72","bp":"112/68","weight":"63"}'::jsonb),
('2023-05678', 'Dr. Rivera', '2025-11-22T14:30:00+08:00', 'Sleep disturbance', 'Sleep hygiene counseling, melatonin', '{"temp":"98.1","pulse":"80","bp":"118/76","weight":"52"}'::jsonb),
('2020-06789', 'Nurse Santos', '2025-11-08T15:00:00+08:00', 'Dizziness', 'Monitor blood pressure, hydration', '{"temp":"98.4","pulse":"76","bp":"110/65","weight":"60"}'::jsonb),
('2022-08901', 'Dr. Rivera', '2025-11-23T11:15:00+08:00', 'Ear infection', 'Ear drops, antibiotics', '{"temp":"98.9","pulse":"85","bp":"119/78","weight":"48"}'::jsonb),
('2021-07892', 'Dr. Rivera', '2025-11-07T13:00:00+08:00', 'Joint pain', 'NSAIDs, physical therapy referral', '{"temp":"98.7","pulse":"83","bp":"122/84","weight":"72"}'::jsonb),
('2023-04321', 'Dr. Rivera', '2025-11-24T09:45:00+08:00', 'Migraine', 'Triptans, migraine prevention meds', '{"temp":"98.3","pulse":"88","bp":"124/86","weight":"58"}'::jsonb),
('2020-07893', 'Nurse Santos', '2025-11-06T10:30:00+08:00', 'Stress related symptoms', 'Counseling, stress management', '{"temp":"97.9","pulse":"82","bp":"115/72","weight":"61"}'::jsonb);

-- 5) Optional inventory rows (so transaction log has corresponding visible items)
insert into public.inventory (item_name, category, stock_quantity, unit, reorder_level)
values
('Paracetamol 500mg', 'Medications', 100, 'pcs', 20),
('Gauze', 'Consumables', 60, 'pcs', 15),
('Bandages 5cm', 'Consumables', 120, 'pcs', 20),
('Aspirin 300mg', 'Medications', 80, 'pcs', 20),
('Thermometers', 'Diagnostic Equipment', 20, 'pcs', 5),
('Blood Pressure Monitors', 'Diagnostic Equipment', 10, 'pcs', 3),
('Syringes 5ml', 'Consumables', 200, 'pcs', 40),
('Antiseptic Cream', 'First Aid / Disinfectants', 45, 'pcs', 10)
on conflict (item_name) do nothing;

-- 6) Inventory transactions
insert into public.inventory_transactions (item_name, transaction_type, quantity, reason, performed_by)
values
('Paracetamol 500mg', 'out', 5, 'Patient J. Dela Cruz', 'Dr. Rivera'),
('Gauze', 'out', 2, 'Dressing change', 'Nurse Santos'),
('Bandages 5cm', 'in', 50, 'New delivery', 'Dr. Rivera'),
('Aspirin 300mg', 'out', 2, 'Headache relief', 'Nurse Santos'),
('Thermometers', 'out', 1, 'Patient Maria Santos', 'Dr. Rivera'),
('Blood Pressure Monitors', 'in', 5, 'Clinic equipment', 'Admin'),
('Syringes 5ml', 'out', 10, 'Vaccinations', 'Nurse Santos'),
('Antiseptic Cream', 'out', 3, 'Wound treatment', 'Dr. Rivera');

commit;
