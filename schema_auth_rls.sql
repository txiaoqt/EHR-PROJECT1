-- TUP Clinic EHR: Supabase Auth + RLS hardening schema
-- Run this in Supabase SQL Editor AFTER your base schema has been created.
-- This migration removes plaintext-password app auth usage and enforces RLS.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) USERS TABLE ALIGNMENT FOR auth.users
-- -----------------------------------------------------------------------------
alter table if exists public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists last_failed_login_at timestamptz,
  add column if not exists locked_until timestamptz,
  add column if not exists lockout_reason text,
  add column if not exists last_login_at timestamptz;

alter table if exists public.appointments
  add column if not exists clinician_auth_user_id uuid references auth.users(id) on delete set null;

alter table if exists public.encounters
  add column if not exists clinician_auth_user_id uuid references auth.users(id) on delete set null;

alter table if exists public.patients
  add column if not exists sensitivity_level text not null default 'normal';

alter table if exists public.encounters
  add column if not exists sensitivity_level text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patients'::regclass
      and conname = 'patients_sensitivity_level_check'
  ) then
    alter table public.patients
      add constraint patients_sensitivity_level_check
      check (sensitivity_level in ('normal', 'restricted'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.encounters'::regclass
      and conname = 'encounters_sensitivity_level_check'
  ) then
    alter table public.encounters
      add constraint encounters_sensitivity_level_check
      check (sensitivity_level in ('normal', 'restricted'));
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'password'
  ) then
    alter table public.users
      alter column password drop not null;
  end if;
end
$$;

-- Remove plaintext password column if present.
alter table if exists public.users drop column if exists password;

-- -----------------------------------------------------------------------------
-- 2) SYNC auth.users -> public.users (admin creates accounts in Supabase Auth)
-- -----------------------------------------------------------------------------
create or replace function public.sync_public_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_name text;
begin
  if new.email is null then
    return new;
  end if;

  v_email := lower(new.email);
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), 'Clinic User');

  -- If a public user already exists by email, link it to auth_user_id.
  update public.users
  set
    auth_user_id = new.id,
    email = coalesce(email, v_email),
    updated_at = now()
  where lower(email) = v_email;

  -- If no row exists, create one with default nurse role (admin can reassign later).
  if not exists (
    select 1 from public.users u where u.auth_user_id = new.id
  ) then
    insert into public.users (id, auth_user_id, name, email, role, active, created_at, updated_at)
    values (gen_random_uuid(), new.id, v_name, v_email, 'nurse', true, now(), now());
  end if;

  return new;
exception
  when others then
    -- Do not block auth.users creation if profile sync fails.
    raise warning 'sync_public_user_from_auth failed for %: %', coalesce(new.email, '<null>'), sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_sync_public_user_from_auth_insert on auth.users;
create trigger trg_sync_public_user_from_auth_insert
after insert on auth.users
for each row execute function public.sync_public_user_from_auth();

drop trigger if exists trg_sync_public_user_from_auth_update on auth.users;
create trigger trg_sync_public_user_from_auth_update
after update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_public_user_from_auth();

-- Backfill auth_user_id for existing rows where possible.
update public.users u
set auth_user_id = au.id
from auth.users au
where lower(u.email) = lower(au.email)
  and (u.auth_user_id is null or u.auth_user_id <> au.id);

-- -----------------------------------------------------------------------------
-- 3) ROLE + CLINIC-HOURS HELPERS
-- -----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.role
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    ),
    'nurse'
  )::text;
$$;

create or replace function public.is_physician_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('physician', 'admin');
$$;

create or replace function public.current_clinician_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.name
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    ),
    ''
  )::text;
$$;

create or replace function public.can_access_sensitivity(p_sensitivity text)
returns boolean
language sql
stable
as $$
  select
    case
      when coalesce(lower(p_sensitivity), 'normal') = 'restricted' then public.is_physician_or_admin()
      else true
    end;
$$;

create or replace function public.is_within_clinic_hours()
returns boolean
language plpgsql
stable
as $$
declare
  v_manila_now time;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return true;
  end if;

  if coalesce(current_setting('app.bypass_clinic_hours', true), 'off') = 'on' then
    return true;
  end if;

  v_manila_now := (now() at time zone 'Asia/Manila')::time;
  return v_manila_now >= time '07:00' and v_manila_now < time '19:00';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) LOGIN LOCKOUT RPCS (used by login page)
-- -----------------------------------------------------------------------------
create or replace function public.get_login_lockout_status(p_email text)
returns table (
  locked_until timestamptz,
  is_locked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
begin
  select u.locked_until
    into v_locked_until
  from public.users u
  where lower(u.email) = lower(p_email)
  limit 1;

  return query
  select
    v_locked_until,
    (v_locked_until is not null and v_locked_until > now());
end;
$$;

create or replace function public.register_failed_login(
  p_email text,
  p_lock_after integer default 5,
  p_lock_minutes integer default 15,
  p_reason text default 'too_many_failed_attempts'
)
returns table (
  user_id uuid,
  failed_attempts integer,
  locked_until timestamptz,
  is_locked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_attempts integer;
  v_locked_until timestamptz;
begin
  select *
    into v_user
  from public.users u
  where lower(u.email) = lower(p_email)
  limit 1
  for update;

  if not found then
    return;
  end if;

  v_attempts := coalesce(v_user.failed_login_attempts, 0) + 1;
  if v_attempts >= greatest(p_lock_after, 1) then
    v_locked_until := now() + make_interval(mins => greatest(p_lock_minutes, 1));
  else
    v_locked_until := null;
  end if;

  update public.users
  set
    failed_login_attempts = v_attempts,
    last_failed_login_at = now(),
    locked_until = v_locked_until,
    lockout_reason = case when v_locked_until is null then null else coalesce(p_reason, 'too_many_failed_attempts') end,
    updated_at = now()
  where id = v_user.id;

  return query
  select
    v_user.id,
    v_attempts,
    v_locked_until,
    (v_locked_until is not null and v_locked_until > now());
end;
$$;

create or replace function public.clear_login_lockout(
  p_email text,
  p_touch_last_login boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    failed_login_attempts = 0,
    last_failed_login_at = null,
    locked_until = null,
    lockout_reason = null,
    last_login_at = case when p_touch_last_login then now() else last_login_at end,
    updated_at = now()
  where lower(email) = lower(p_email);
end;
$$;

create or replace function public.set_clinician_auth_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.clinician_auth_user_id is null then
    new.clinician_auth_user_id := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.get_login_lockout_status(text) from public;
revoke all on function public.register_failed_login(text, integer, integer, text) from public;
revoke all on function public.clear_login_lockout(text, boolean) from public;

grant execute on function public.get_login_lockout_status(text) to anon, authenticated;
grant execute on function public.register_failed_login(text, integer, integer, text) to anon, authenticated;
grant execute on function public.clear_login_lockout(text, boolean) to authenticated;

drop trigger if exists trg_set_appointments_clinician_auth_user_id on public.appointments;
create trigger trg_set_appointments_clinician_auth_user_id
before insert on public.appointments
for each row execute function public.set_clinician_auth_user_id();

drop trigger if exists trg_set_encounters_clinician_auth_user_id on public.encounters;
create trigger trg_set_encounters_clinician_auth_user_id
before insert on public.encounters
for each row execute function public.set_clinician_auth_user_id();

-- -----------------------------------------------------------------------------
-- 5) RLS ENABLE + POLICY SETUP
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'users',
    'role_permissions',
    'students',
    'patients',
    'appointments',
    'encounters',
    'inventory',
    'inventory_transactions',
    'settings',
    'audit_logs',
    'profiles',
    'break_glass_audit_logs'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass(format('public.%s', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end
$$;

-- Remove broad anon access and keep explicit authenticated grants.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
revoke all on tables from anon;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;

-- Drop existing policies to avoid duplication conflicts.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$$;

-- USERS: own row read/update; physician/admin can read all.
create policy users_select_policy
on public.users
for select
to authenticated
using (
  public.is_within_clinic_hours()
  and (
    auth_user_id = auth.uid()
    or public.is_physician_or_admin()
  )
);

create policy users_update_policy
on public.users
for update
to authenticated
using (
  public.is_within_clinic_hours()
  and (
    auth_user_id = auth.uid()
    or public.is_physician_or_admin()
  )
)
with check (
  public.is_within_clinic_hours()
  and (
    auth_user_id = auth.uid()
    or public.is_physician_or_admin()
  )
);

-- ROLE PERMISSIONS: read by authenticated, write by admin only.
create policy role_permissions_select_policy
on public.role_permissions
for select
to authenticated
using (public.is_within_clinic_hours());

create policy role_permissions_write_policy
on public.role_permissions
for all
to authenticated
using (public.is_within_clinic_hours() and public.current_app_role() = 'admin')
with check (public.is_within_clinic_hours() and public.current_app_role() = 'admin');

-- Core clinical tables: authenticated can read during clinic hours.
create policy students_select_policy on public.students
for select to authenticated
using (public.is_within_clinic_hours());

create policy patients_select_policy on public.patients
for select to authenticated
using (
  public.is_within_clinic_hours()
  and public.can_access_sensitivity(sensitivity_level)
);

create policy appointments_select_policy on public.appointments
for select to authenticated
using (public.is_within_clinic_hours());

create policy encounters_select_policy on public.encounters
for select to authenticated
using (
  public.is_within_clinic_hours()
  and public.can_access_sensitivity(sensitivity_level)
);

create policy inventory_select_policy on public.inventory
for select to authenticated
using (public.is_within_clinic_hours());

create policy inventory_tx_select_policy on public.inventory_transactions
for select to authenticated
using (public.is_within_clinic_hours());

create policy settings_select_policy on public.settings
for select to authenticated
using (public.is_within_clinic_hours());

create policy profiles_select_policy on public.profiles
for select to authenticated
using (public.is_within_clinic_hours());

create policy audit_logs_select_policy on public.audit_logs
for select to authenticated
using (public.is_within_clinic_hours());

-- Insert/update for nurse/physician/admin in clinic hours.
create policy students_insert_policy on public.students
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy students_update_policy on public.students
for update to authenticated
using (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'))
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy patients_insert_policy on public.patients
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy patients_update_policy on public.patients
for update to authenticated
using (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'))
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy appointments_insert_policy on public.appointments
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy appointments_update_physician_admin_policy on public.appointments
for update to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin())
with check (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy appointments_update_nurse_own_policy on public.appointments
for update to authenticated
using (
  public.is_within_clinic_hours()
  and public.current_app_role() = 'nurse'
  and (
    clinician_auth_user_id = auth.uid()
    or lower(coalesce(clinician_name, '')) = lower(public.current_clinician_name())
  )
)
with check (
  public.is_within_clinic_hours()
  and public.current_app_role() = 'nurse'
  and (
    clinician_auth_user_id = auth.uid()
    or lower(coalesce(clinician_name, '')) = lower(public.current_clinician_name())
  )
);

create policy encounters_insert_policy on public.encounters
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy encounters_update_physician_admin_policy on public.encounters
for update to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin())
with check (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy encounters_update_nurse_own_policy on public.encounters
for update to authenticated
using (
  public.is_within_clinic_hours()
  and public.current_app_role() = 'nurse'
  and (
    clinician_auth_user_id = auth.uid()
    or lower(coalesce(clinician_name, '')) = lower(public.current_clinician_name())
  )
)
with check (
  public.is_within_clinic_hours()
  and public.current_app_role() = 'nurse'
  and (
    clinician_auth_user_id = auth.uid()
    or lower(coalesce(clinician_name, '')) = lower(public.current_clinician_name())
  )
);

create policy inventory_insert_policy on public.inventory
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy inventory_update_policy on public.inventory
for update to authenticated
using (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'))
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy inventory_tx_insert_policy on public.inventory_transactions
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy settings_write_policy on public.settings
for all to authenticated
using (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'))
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

create policy audit_logs_insert_policy on public.audit_logs
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician', 'nurse'));

-- Delete is physician/admin only.
create policy patients_delete_policy on public.patients
for delete to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy appointments_delete_policy on public.appointments
for delete to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy encounters_delete_policy on public.encounters
for delete to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy inventory_delete_policy on public.inventory
for delete to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy inventory_tx_delete_policy on public.inventory_transactions
for delete to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin());

-- Break glass logs
create policy break_glass_select_policy on public.break_glass_audit_logs
for select to authenticated
using (public.is_within_clinic_hours() and public.is_physician_or_admin());

create policy break_glass_insert_policy on public.break_glass_audit_logs
for insert to authenticated
with check (public.is_within_clinic_hours() and public.current_app_role() in ('admin', 'physician'));

-- -----------------------------------------------------------------------------
-- 6) FIELD-LEVEL GUARDS
-- -----------------------------------------------------------------------------
create or replace function public.guard_users_sensitive_updates()
returns trigger
language plpgsql
as $$
begin
  -- Allow system-level / SQL editor sessions
  if current_user in ('postgres', 'supabase_admin', 'service_role') or auth.uid() is null then
    return new;
  end if;

  if not public.is_physician_or_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admin/physician can change roles.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'Only admin/physician can change active status.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'auth_user_id cannot be changed by this user.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_users_sensitive_updates on public.users;
create trigger trg_guard_users_sensitive_updates
before update on public.users
for each row execute function public.guard_users_sensitive_updates();

create or replace function public.guard_encounter_assessment_plan_updates()
returns trigger
language plpgsql
as $$
begin
  if public.current_app_role() = 'nurse'
     and new.assessment_plan is distinct from old.assessment_plan then
    raise exception 'Nurse role cannot modify assessment_plan.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_encounter_assessment_plan_updates on public.encounters;
create trigger trg_guard_encounter_assessment_plan_updates
before update on public.encounters
for each row execute function public.guard_encounter_assessment_plan_updates();

-- -----------------------------------------------------------------------------
-- 7) SEED/MAP CLINIC ACCOUNTS (role assignment happens in public.users)
-- -----------------------------------------------------------------------------
-- Create these users in Supabase Dashboard -> Authentication -> Users:
--   physician@tupclinic.local
--   nurse@tupclinic.local
-- Then run the role updates below.

insert into public.users (id, name, email, role, active, created_at, updated_at)
values
  (gen_random_uuid(), 'Dr. Rivera', 'physician@tupclinic.local', 'physician', true, now(), now()),
  (gen_random_uuid(), 'Nurse Santos', 'nurse@tupclinic.local', 'nurse', true, now(), now())
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();

update public.users u
set auth_user_id = au.id
from auth.users au
where lower(u.email) = lower(au.email)
  and lower(u.email) in ('physician@tupclinic.local', 'nurse@tupclinic.local');

update public.appointments a
set clinician_auth_user_id = u.auth_user_id
from public.users u
where a.clinician_auth_user_id is null
  and u.auth_user_id is not null
  and lower(coalesce(a.clinician_name, '')) = lower(coalesce(u.name, ''));

update public.encounters e
set clinician_auth_user_id = u.auth_user_id
from public.users u
where e.clinician_auth_user_id is null
  and u.auth_user_id is not null
  and lower(coalesce(e.clinician_name, '')) = lower(coalesce(u.name, ''));

commit;
