-- EHR Database Schema for Supabase
-- Run this SQL in the Supabase SQL Editor to create the database structure

-- Enable Row Level Security (RLS) globally if needed
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-secret';

-- Users table (for staff/admin logins)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'physician', 'nurse', 'user')),
  avatar TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
  id TEXT PRIMARY KEY, -- Student number
  name TEXT NOT NULL,
  year INTEGER, -- Year level
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit_date DATE,
  medications TEXT,
  allergies TEXT,
  notes TEXT,
  attachments TEXT[]
);

-- Appointments table
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT,
  clinician_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME,
  type TEXT DEFAULT 'Consult', -- Consult, Follow-up, etc.
  status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Checked-in', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students table (master list of students)
CREATE TABLE students (
  id TEXT PRIMARY KEY, -- Student ID
  name TEXT NOT NULL,
  year INTEGER -- Year level
);

-- Encounters table (for visit records)
CREATE TABLE encounters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT,
  clinician_name TEXT NOT NULL,
  encounter_date TIMESTAMPTZ DEFAULT NOW(),
  chief_complaint TEXT,
  hpi TEXT,
  physical_exam TEXT,
  assessment_plan TEXT,
  vitals JSONB, -- Store vitals as key-value pairs
  attachments TEXT[], -- URLs or file names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory table
CREATE TABLE inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL UNIQUE,
  stock_quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory transactions log
CREATE TABLE inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL, -- References inventory.item_name
  transaction_type TEXT CHECK (transaction_type IN ('in', 'out')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by TEXT -- Clinician or user
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT,
  action TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (for app settings)
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample data
INSERT INTO users (name, email, password, role) VALUES
('Dr. Rivera', 'dr.rivera@tupclinic.edu.ph', 'password', 'physician'),
('Nurse Santos', 'nurse.santos@tupclinic.edu.ph', 'password', 'nurse');

INSERT INTO students (id, name, year) VALUES
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
('2021-09876', 'Daniel Mendoza', 3);

INSERT INTO patients (id, name, year, last_visit_date) VALUES
('2021-01234', 'Juan Dela Cruz', 3, '2025-11-14'),
('2020-04567', 'Maria Santos', 4, '2025-10-28');

INSERT INTO appointments (patient_id, clinician_name, appointment_date, appointment_time, type, status) VALUES
('2021-01234', 'Dr. Rivera', '2025-11-21', '09:00', 'Consult', 'Scheduled'),
('2020-04567', 'Nurse Santos', '2025-11-21', '09:30', 'Follow-up', 'Checked-in');

INSERT INTO encounters (patient_id, clinician_name, encounter_date, chief_complaint, assessment_plan, vitals) VALUES
('2021-01234', 'Dr. Rivera', '2025-11-15T10:00:00+08:00', 'Fever', 'Antibiotics prescribed, rest advised', '{"temp": "101.5", "pulse": "90", "bp": "120/80", "weight": "60"}'),
('2021-01234', 'Dr. Rivera', '2025-11-10T11:00:00+08:00', 'Cough', 'Cough syrup and rest', '{"temp": "98.6", "pulse": "80", "bp": "118/78", "weight": "61"}'),
('2020-04567', 'Dr. Rivera', '2025-11-14T09:30:00+08:00', 'Headache', 'Pain relievers and hydration', '{"temp": "97.5", "pulse": "75", "bp": "116/76", "weight": "57"}'),
('2022-05678', 'Dr. Rivera', '2025-11-16T13:00:00+08:00', 'Stomach pain', 'Dietary changes, antacids', '{"temp": "99.0", "pulse": "78", "bp": "119/79", "weight": "55"}'),
('2022-05678', 'Dr. Rivera', '2025-11-12T10:30:00+08:00', 'Sore throat', 'Gargle salt water, lozenges', '{"temp": "98.0", "pulse": "82", "bp": "121/81", "weight": "56"}'),
('2021-01234', 'Dr. Rivera', '2025-11-18T15:00:00+08:00', 'Fever', 'Antibiotics', '{"temp": "102.0", "pulse": "92", "bp": "125/85", "weight": "59"}'),
('2023-07890', 'Dr. Rivera', '2025-11-19T14:00:00+08:00', 'Allergic reaction', 'Antihistamines, observation', '{"temp": "98.2", "pulse": "85", "bp": "118/75", "weight": "70"}'),
('2022-09876', 'Dr. Rivera', '2025-11-17T09:00:00+08:00', 'Flu symptoms', 'Antiviral medication, fluids', '{"temp": "100.8", "pulse": "88", "bp": "122/82", "weight": "62"}'),
('2021-06543', 'Nurse Santos', '2025-11-13T11:30:00+08:00', 'Sore throat', 'Salt water gargle, lozenges', '{"temp": "98.5", "pulse": "78", "bp": "115/70", "weight": "58"}'),
('2023-01278', 'Dr. Rivera', '2025-11-20T16:00:00+08:00', 'Back pain', 'Pain medication, light exercise', '{"temp": "98.0", "pulse": "75", "bp": "120/80", "weight": "68"}'),
('2020-03456', 'Nurse Santos', '2025-11-11T08:00:00+08:00', 'Cold symptoms', 'Rest, decongestants', '{"temp": "99.5", "pulse": "82", "bp": "117/74", "weight": "55"}'),
('2022-07891', 'Dr. Rivera', '2025-11-21T10:00:00+08:00', 'Anxiety symptoms', 'Counseling referral, mild sedative', '{"temp": "98.6", "pulse": "95", "bp": "135/90", "weight": "65"}'),
('2021-04321', 'Dr. Rivera', '2025-11-09T12:00:00+08:00', 'Skin rash', 'Topical cream, allergy testing', '{"temp": "97.8", "pulse": "72", "bp": "112/68", "weight": "63"}'),
('2023-05678', 'Dr. Rivera', '2025-11-22T14:30:00+08:00', 'Sleep disturbance', 'Sleep hygiene counseling, melatonin', '{"temp": "98.1", "pulse": "80", "bp": "118/76", "weight": "52"}'),
('2020-06789', 'Nurse Santos', '2025-11-08T15:00:00+08:00', 'Dizziness', 'Monitor blood pressure, hydration', '{"temp": "98.4", "pulse": "76", "bp": "110/65", "weight": "60"}'),
('2022-08901', 'Dr. Rivera', '2025-11-23T11:15:00+08:00', 'Ear infection', 'Ear drops, antibiotics', '{"temp": "98.9", "pulse": "85", "bp": "119/78", "weight": "48"}'),
('2021-07892', 'Dr. Rivera', '2025-11-07T13:00:00+08:00', 'Joint pain', 'NSAIDs, physical therapy referral', '{"temp": "98.7", "pulse": "83", "bp": "122/84", "weight": "72"}'),
('2023-04321', 'Dr. Rivera', '2025-11-24T09:45:00+08:00', 'Migraine', 'Triptans, migraine prevention meds', '{"temp": "98.3", "pulse": "88", "bp": "124/86", "weight": "58"}'),
('2020-07893', 'Nurse Santos', '2025-11-06T10:30:00+08:00', 'Stress related symptoms', 'Counseling, stress management', '{"temp": "97.9", "pulse": "82", "bp": "115/72", "weight": "61"}'),
('2022-03210', 'Dr. Rivera', '2025-11-25T12:30:00+08:00', 'Sinus congestion', 'Decongestants, nasal spray', '{"temp": "98.8", "pulse": "79", "bp": "117/75", "weight": "56"}');

INSERT INTO inventory (item_name, stock_quantity, reorder_level) VALUES
('Paracetamol 500mg', 20, 10),
('Gauze', 120, 50),
('Bandages 5cm', 50, 30),
('Aspirin 300mg', 8, 15),
('Thermometers', 25, 5),
('Blood Pressure Monitors', 12, 8),
('Syringes 5ml', 200, 100),
('Antiseptic Cream', 35, 20),
('Gloves (pairs)', 150, 75),
('Face Masks', 100, 50);

INSERT INTO inventory_transactions (item_name, transaction_type, quantity, reason, performed_by) VALUES
('Paracetamol 500mg', 'out', 5, 'Patient J. Dela Cruz', 'Dr. Rivera'),
('Gauze', 'out', 2, 'Dressing change', 'Nurse Santos'),
('Bandages 5cm', 'in', 50, 'New delivery', 'Dr. Rivera'),
('Aspirin 300mg', 'out', 2, 'Headache relief', 'Nurse Santos'),
('Thermometers', 'out', 1, 'Patient Maria Santos', 'Dr. Rivera'),
('Blood Pressure Monitors', 'in', 5, 'Clinic equipment', 'Admin'),
('Syringes 5ml', 'out', 10, 'Vaccinations', 'Nurse Santos'),
('Antiseptic Cream', 'out', 3, 'Wound treatment', 'Dr. Rivera');

INSERT INTO settings (key, value) VALUES
('timezone', 'Asia/Manila'),
('backup_frequency', 'Daily');

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE encounters DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies (basic read/write for authenticated users)
CREATE POLICY "Allow authenticated read users" ON users FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Allow authenticated insert users" ON users FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Allow anon all users" ON users FOR ALL TO anon USING (TRUE);

CREATE POLICY "Allow anon read students" ON students FOR SELECT TO anon USING (TRUE);

CREATE POLICY "Allow anon read patients" ON patients FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Allow anon insert patients" ON patients FOR INSERT TO anon WITH CHECK (TRUE);
CREATE POLICY "Allow anon update patients" ON patients FOR UPDATE TO anon USING (TRUE);
CREATE POLICY "Allow anon delete patients" ON patients FOR DELETE TO anon USING (TRUE);

-- Similar policies for other tables...
CREATE POLICY "Allow anon all appointments" ON appointments FOR ALL TO anon USING (TRUE);
CREATE POLICY "Allow authenticated all encounters" ON encounters FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "Allow authenticated all inventory" ON inventory FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "Allow anon all inventory" ON inventory FOR ALL TO anon USING (TRUE);
CREATE POLICY "Allow authenticated all inventory_transactions" ON inventory_transactions FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "Allow anon all inventory_transactions" ON inventory_transactions FOR ALL TO anon USING (TRUE);
CREATE POLICY "Allow authenticated all audit_logs" ON audit_logs FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "Allow anon all audit_logs" ON audit_logs FOR ALL TO anon USING (TRUE);
CREATE POLICY "Allow authenticated all settings" ON settings FOR ALL TO authenticated USING (TRUE);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_encounters_updated_at BEFORE UPDATE ON encounters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
