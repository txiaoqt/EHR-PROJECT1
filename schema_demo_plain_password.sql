-- Demo rollback patch: plain-password login via public.users
-- Use this ONLY for demo mode (not production).

begin;

-- Restore password column if removed
alter table if exists public.users
  add column if not exists password text;

update public.users
set password = coalesce(password, 'Demo@123')
where password is null;

alter table if exists public.users
  alter column password set not null;

-- Disable RLS for demo simplicity
alter table if exists public.users disable row level security;
alter table if exists public.role_permissions disable row level security;
alter table if exists public.students disable row level security;
alter table if exists public.patients disable row level security;
alter table if exists public.appointments disable row level security;
alter table if exists public.encounters disable row level security;
alter table if exists public.inventory disable row level security;
alter table if exists public.inventory_transactions disable row level security;
alter table if exists public.settings disable row level security;
alter table if exists public.audit_logs disable row level security;
alter table if exists public.profiles disable row level security;

-- Ensure anon/authenticated can read/write tables as before
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Make sure demo users exist with plaintext passwords
insert into public.users (id, name, email, password, role, active, created_at, updated_at)
values
  (gen_random_uuid(), 'Dr. Rivera', 'physician@tupclinic.local', 'Physician@123', 'physician', true, now(), now()),
  (gen_random_uuid(), 'Nurse Santos', 'nurse@tupclinic.local', 'Nurse@123', 'nurse', true, now(), now())
on conflict (email) do update set
  name = excluded.name,
  password = excluded.password,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();

commit;
