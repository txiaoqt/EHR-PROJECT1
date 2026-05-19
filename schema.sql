-- TUP EHR Supabase schema
-- Paste this whole file into the Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'nurse' check (role in ('admin', 'physician', 'nurse', 'patient')),
  avatar text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ROLE PERMISSIONS
-- This table defines module access per role for app-level RBAC checks.
create table if not exists public.role_permissions (
  role text not null check (role in ('admin', 'physician', 'nurse', 'patient')),
  module text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, module)
);

-- STUDENTS (master list)
create table if not exists public.students (
  id text primary key,
  name text not null,
  year integer not null check (year >= 1 and year <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PATIENTS
create table if not exists public.patients (
  id text primary key references public.students(id) on update cascade on delete restrict,
  name text not null,
  year integer not null check (year >= 1 and year <= 5),
  last_visit_date date,
  medications text,
  allergies text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.users
  add column if not exists patient_id text references public.patients(id) on update cascade on delete set null;

-- APPOINTMENTS
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null references public.students(id) on update cascade on delete restrict,
  patient_name text,
  appointment_date date not null,
  appointment_time time not null,
  type text not null default 'Consult' check (type in ('Consult', 'Follow-up')),
  clinician_name text not null,
  clinician_id text,
  clinician text,
  source text not null default 'staff' check (source in ('staff', 'portal', 'kiosk')),
  department text not null default 'Medical Clinic' check (department in ('Medical Clinic', 'Dental Clinic')),
  appointment_type text not null default 'Future Appointment' check (appointment_type in ('Same-day Appointment', 'Future Appointment')),
  service_type text,
  queue_number integer,
  reference_code text,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Checked-in', 'Cancelled', 'Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ENCOUNTERS
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null references public.patients(id) on update cascade on delete restrict,
  patient_name text,
  clinician_name text not null,
  clinician_id text,
  clinician text,
  encounter_date timestamptz not null default now(),
  chief_complaint text,
  hpi text,
  physical_exam text,
  assessment_plan text,
  vitals jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INVENTORY
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique,
  category text not null default 'Uncategorized',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  unit text not null default 'pcs',
  reorder_level integer not null default 10 check (reorder_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INVENTORY TRANSACTIONS
-- NOTE: no FK on item_name by design, because app inserts a transaction after item deletion.
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  transaction_type text not null check (transaction_type in ('in', 'out')),
  quantity integer not null check (quantity > 0),
  reason text,
  performed_by text,
  created_at timestamptz not null default now()
);

-- SETTINGS (key-value)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AUDIT LOGS
-- Includes both legacy and newer fields used across the app.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  action text not null,
  description text,
  performed_by text,
  detail text,
  message text,
  type text,
  meta jsonb,
  reference_id text,
  item_id text,
  encounter_id text,
  appointment_id text,
  created_at timestamptz not null default now()
);

-- PATIENT MESSAGES
create table if not exists public.patient_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null references public.patients(id) on update cascade on delete cascade,
  patient_name text,
  sender_role text not null check (sender_role in ('patient', 'physician', 'nurse', 'admin', 'clinic')),
  sender_name text,
  recipient_name text,
  concern_type text not null default 'General clinic inquiry' check (concern_type in ('Appointment concern', 'Follow-up question', 'Medical inquiry', 'Dental inquiry', 'General clinic inquiry')),
  message_text text not null,
  status text not null default 'sent' check (status in ('sent', 'read', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PROFILES (optional helper table read by Dashboard fallback)
create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_users_email on public.users (email);

create index if not exists idx_students_name on public.students (name);

create index if not exists idx_patients_name on public.patients (name);
create index if not exists idx_patients_last_visit_date on public.patients (last_visit_date);

create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_patient_id on public.appointments (patient_id);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_created_at on public.appointments (created_at desc);

create index if not exists idx_encounters_patient_id on public.encounters (patient_id);
create index if not exists idx_encounters_status on public.encounters (status);
create index if not exists idx_encounters_date on public.encounters (encounter_date desc);
create index if not exists idx_encounters_created_at on public.encounters (created_at desc);
create index if not exists idx_encounters_clinician_name on public.encounters (clinician_name);

create index if not exists idx_inventory_item_name on public.inventory (item_name);
create index if not exists idx_inventory_category on public.inventory (category);

create index if not exists idx_inventory_txn_item_name on public.inventory_transactions (item_name);
create index if not exists idx_inventory_txn_created_at on public.inventory_transactions (created_at desc);
create index if not exists idx_inventory_txn_type on public.inventory_transactions (transaction_type);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_performed_by on public.audit_logs (performed_by);
create index if not exists idx_patient_messages_patient_id on public.patient_messages (patient_id);
create index if not exists idx_patient_messages_created_at on public.patient_messages (created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.has_role_permission(
  p_role text,
  p_module text,
  p_action text
)
returns boolean
language sql
stable
as $$
  select
    case
      when p_action = 'view' then rp.can_view
      when p_action = 'create' then rp.can_create
      when p_action = 'update' then rp.can_update
      when p_action = 'delete' then rp.can_delete
      else false
    end
  from public.role_permissions rp
  where rp.role = p_role and rp.module = p_module
  limit 1;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_students_set_updated_at on public.students;
create trigger trg_students_set_updated_at
before update on public.students
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_patients_set_updated_at on public.patients;
create trigger trg_patients_set_updated_at
before update on public.patients
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_appointments_set_updated_at on public.appointments;
create trigger trg_appointments_set_updated_at
before update on public.appointments
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_encounters_set_updated_at on public.encounters;
create trigger trg_encounters_set_updated_at
before update on public.encounters
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_inventory_set_updated_at on public.inventory;
create trigger trg_inventory_set_updated_at
before update on public.inventory
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_settings_set_updated_at on public.settings;
create trigger trg_settings_set_updated_at
before update on public.settings
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_role_permissions_set_updated_at on public.role_permissions;
create trigger trg_role_permissions_set_updated_at
before update on public.role_permissions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_patient_messages_set_updated_at on public.patient_messages;
create trigger trg_patient_messages_set_updated_at
before update on public.patient_messages
for each row execute procedure public.set_updated_at();

-- Keep access simple for current frontend usage (anon key + direct table access)
alter table public.users disable row level security;
alter table public.role_permissions disable row level security;
alter table public.students disable row level security;
alter table public.patients disable row level security;
alter table public.appointments disable row level security;
alter table public.encounters disable row level security;
alter table public.inventory disable row level security;
alter table public.inventory_transactions disable row level security;
alter table public.settings disable row level security;
alter table public.audit_logs disable row level security;
alter table public.profiles disable row level security;
alter table public.patient_messages disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;

-- Seed RBAC defaults
insert into public.role_permissions (role, module, can_view, can_create, can_update, can_delete) values
('admin', 'dashboard', true, true, true, true),
('admin', 'patients', true, true, true, true),
('admin', 'appointments', true, true, true, true),
('admin', 'encounters', true, true, true, true),
('admin', 'inventory', true, true, true, true),
('admin', 'reports', true, true, true, true),
('admin', 'settings', true, true, true, true),
('admin', 'users', true, true, true, true),
('physician', 'dashboard', true, true, true, true),
('physician', 'patients', true, true, true, true),
('physician', 'appointments', true, true, true, true),
('physician', 'encounters', true, true, true, true),
('physician', 'inventory', true, true, true, true),
('physician', 'reports', true, true, true, true),
('physician', 'settings', true, true, true, true),
('physician', 'users', true, false, false, false),
('nurse', 'dashboard', true, false, false, false),
('nurse', 'patients', true, true, true, false),
('nurse', 'appointments', true, true, true, false),
('nurse', 'encounters', true, true, true, false),
('nurse', 'inventory', true, true, true, false),
('nurse', 'reports', true, true, false, false),
('nurse', 'settings', false, false, false, false),
('nurse', 'users', false, false, false, false),
('patient', 'patient_dashboard', true, false, false, false),
('patient', 'patient_schedule', true, true, true, false),
('patient', 'patient_messages', true, true, false, false),
('patient', 'patient_records', true, false, false, false),
('patient', 'patient_profile', true, true, true, false)
on conflict (role, module) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  updated_at = now();

-- Mock login users for your current login screen
insert into public.users (name, email, password, role, active) values
('Dr. Rivera', 'physician@tupclinic.local', 'Physician@123', 'physician', true),
('Nurse Santos', 'nurse@tupclinic.local', 'Nurse@123', 'nurse', true)
on conflict (email) do update set
  name = excluded.name,
  password = excluded.password,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();

commit;
