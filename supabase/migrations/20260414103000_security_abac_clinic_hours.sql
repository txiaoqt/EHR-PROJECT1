-- Migration: security hardening + ABAC baseline + clinic-hours write guard
-- Safe for already-deployed schemas; idempotent where practical.

begin;

create extension if not exists pgcrypto;

-- 1) Role cleanup: remove legacy 'user' and enforce allowed roles.
do $$
begin
  if to_regclass('public.users') is not null then
    update public.users
      set role = 'nurse'
    where role is null or lower(role) = 'user';
  end if;

  if to_regclass('public.role_permissions') is not null then
    delete from public.role_permissions
    where role is null or lower(role) = 'user';
  end if;
end
$$;

do $$
declare
  r record;
begin
  if to_regclass('public.users') is not null then
    for r in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'users'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%role%'
    loop
      execute format('alter table public.users drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'users'
        and c.conname = 'users_role_check'
    ) then
      alter table public.users
        add constraint users_role_check
        check (role in ('admin', 'physician', 'nurse', 'patient'));
    end if;
  end if;

  if to_regclass('public.role_permissions') is not null then
    for r in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'role_permissions'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%role%'
    loop
      execute format('alter table public.role_permissions drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'role_permissions'
        and c.conname = 'role_permissions_role_check'
    ) then
      alter table public.role_permissions
        add constraint role_permissions_role_check
        check (role in ('admin', 'physician', 'nurse', 'patient'));
    end if;
  end if;
end
$$;

-- 2) Users lockout support columns + helper procedures.
do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists failed_login_attempts integer not null default 0,
      add column if not exists last_failed_login_at timestamptz,
      add column if not exists locked_until timestamptz,
      add column if not exists lockout_reason text,
      add column if not exists last_login_at timestamptz;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.users'::regclass
        and conname = 'users_failed_login_attempts_check'
    ) then
      alter table public.users
        add constraint users_failed_login_attempts_check
        check (failed_login_attempts >= 0);
    end if;
  end if;
end
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

-- 3) Clinic-hours DB guard (07:00-19:00 Asia/Manila) for write operations.
create or replace function public.enforce_clinic_hours_write_guard()
returns trigger
language plpgsql
as $$
declare
  v_manila_now time;
  v_bypass boolean;
begin
  v_bypass := coalesce(current_setting('app.bypass_clinic_hours', true), 'off') = 'on'
    or current_user in ('postgres', 'supabase_admin', 'service_role');

  if not v_bypass then
    v_manila_now := (now() at time zone 'Asia/Manila')::time;

    if v_manila_now < time '07:00' or v_manila_now >= time '19:00' then
      raise exception 'Write operations are allowed only between 07:00 and 19:00 Asia/Manila.'
        using errcode = 'P0001',
              hint = 'Run writes during clinic hours or set app.bypass_clinic_hours=on from a trusted backend channel.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.apply_clinic_hours_guard(p_target_table regclass)
returns void
language plpgsql
as $$
declare
  v_table text;
  v_trigger text;
begin
  select relname into v_table from pg_class where oid = p_target_table;

  if v_table is null then
    return;
  end if;

  v_trigger := 'trg_' || v_table || '_clinic_hours_guard';

  execute format('drop trigger if exists %I on %s', v_trigger, p_target_table);
  execute format(
    'create trigger %I before insert or update or delete on %s for each row execute function public.enforce_clinic_hours_write_guard()',
    v_trigger,
    p_target_table
  );
end;
$$;

do $$
begin
  if to_regclass('public.users') is not null then
    perform public.apply_clinic_hours_guard('public.users'::regclass);
  end if;
  if to_regclass('public.students') is not null then
    perform public.apply_clinic_hours_guard('public.students'::regclass);
  end if;
  if to_regclass('public.patients') is not null then
    perform public.apply_clinic_hours_guard('public.patients'::regclass);
  end if;
  if to_regclass('public.appointments') is not null then
    perform public.apply_clinic_hours_guard('public.appointments'::regclass);
  end if;
  if to_regclass('public.encounters') is not null then
    perform public.apply_clinic_hours_guard('public.encounters'::regclass);
  end if;
  if to_regclass('public.inventory') is not null then
    perform public.apply_clinic_hours_guard('public.inventory'::regclass);
  end if;
  if to_regclass('public.inventory_transactions') is not null then
    perform public.apply_clinic_hours_guard('public.inventory_transactions'::regclass);
  end if;
  if to_regclass('public.settings') is not null then
    perform public.apply_clinic_hours_guard('public.settings'::regclass);
  end if;
  if to_regclass('public.role_permissions') is not null then
    perform public.apply_clinic_hours_guard('public.role_permissions'::regclass);
  end if;
end
$$;

-- 4) ABAC support fields.
do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists clearance_level smallint not null default 1,
      add column if not exists department text,
      add column if not exists abac_attributes jsonb not null default '{}'::jsonb;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.users'::regclass
        and conname = 'users_clearance_level_check'
    ) then
      alter table public.users
        add constraint users_clearance_level_check
        check (clearance_level between 1 and 5);
    end if;
  end if;

  if to_regclass('public.patients') is not null then
    alter table public.patients
      add column if not exists sensitivity_level text not null default 'normal',
      add column if not exists abac_tags text[] not null default '{}'::text[];

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.patients'::regclass
        and conname = 'patients_sensitivity_level_check'
    ) then
      alter table public.patients
        add constraint patients_sensitivity_level_check
        check (sensitivity_level in ('normal', 'restricted'));
    end if;
  end if;

  if to_regclass('public.encounters') is not null then
    alter table public.encounters
      add column if not exists sensitivity_level text not null default 'normal',
      add column if not exists abac_tags text[] not null default '{}'::text[];

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.encounters'::regclass
        and conname = 'encounters_sensitivity_level_check'
    ) then
      alter table public.encounters
        add constraint encounters_sensitivity_level_check
        check (sensitivity_level in ('normal', 'restricted'));
    end if;
  end if;
end
$$;

create index if not exists idx_patients_sensitivity_level on public.patients (sensitivity_level);
create index if not exists idx_encounters_sensitivity_level on public.encounters (sensitivity_level);
create index if not exists idx_users_clearance_level on public.users (clearance_level);

-- 4b) Optional break-glass logging table + helper function.
create table if not exists public.break_glass_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on update cascade on delete set null,
  patient_id text references public.patients(id) on update cascade on delete set null,
  encounter_id uuid references public.encounters(id) on update cascade on delete set null,
  justification text not null,
  access_scope text not null default 'read',
  approved_by uuid references public.users(id) on update cascade on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_break_glass_user_id on public.break_glass_audit_logs (user_id);
create index if not exists idx_break_glass_patient_id on public.break_glass_audit_logs (patient_id);
create index if not exists idx_break_glass_encounter_id on public.break_glass_audit_logs (encounter_id);
create index if not exists idx_break_glass_created_at on public.break_glass_audit_logs (created_at desc);

create or replace function public.log_break_glass_access(
  p_user_id uuid,
  p_justification text,
  p_patient_id text default null,
  p_encounter_id uuid default null,
  p_access_scope text default 'read',
  p_approved_by uuid default null,
  p_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.break_glass_audit_logs (
    user_id,
    patient_id,
    encounter_id,
    justification,
    access_scope,
    approved_by,
    expires_at,
    metadata
  )
  values (
    p_user_id,
    p_patient_id,
    p_encounter_id,
    p_justification,
    coalesce(nullif(trim(p_access_scope), ''), 'read'),
    p_approved_by,
    p_expires_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Keep table accessible with existing open-access pattern.
grant select, insert on public.break_glass_audit_logs to anon, authenticated;

commit;
