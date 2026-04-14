# About Security

This file rechecks the 5 critical security items and shows current status.

## 5-Point Security Recheck

## 1) Plain-text passwords

Status: **Done in code and schema**

- Frontend login now uses Supabase Auth:
  - `supabase.auth.signInWithPassword(...)`
  - File: `frontend/src/pages/Login.jsx`
- Password update now uses Supabase Auth:
  - `supabase.auth.updateUser({ password })`
  - File: `frontend/src/pages/Settings.jsx`
- Plain-text `public.users.password` is removed in the new SQL:
  - File: `schema_auth_rls.sql`
- `public.users` is linked to `auth.users` via `auth_user_id`.

## 2) RLS disabled + broad CRUD grants

Status: **Done in new schema file**

- RLS is enabled across sensitive tables (`users`, `patients`, `encounters`, `appointments`, `inventory`, etc.).
- Broad `anon` table access is revoked.
- Policies are explicit per role and action.
- Delete permissions are physician/admin only.
- Nurse restrictions are enforced in DB (not only UI), including:
  - nurse cannot modify `assessment_plan` (trigger)
  - nurse updates are restricted to own appointments/encounters (ownership-aware policies)
- File: `schema_auth_rls.sql`

## 3) Hardcoded anon key fallback

Status: **Done in code**

- Removed fallback URL/key from frontend.
- App now fails fast if env vars are missing.
- File: `frontend/src/supabaseClient.js`

Manual action still required:
- Rotate the exposed anon key in Supabase Project Settings.
- Update Vercel env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## 4) Legacy `user` role in signup UI

Status: **Done by removing signup flow**

- `Signup.jsx` has been removed.
- Account creation is now expected to be admin-managed via Supabase Auth dashboard/backend process.
- Roles in DB are constrained to `admin | physician | nurse`.

## 5) Time rule only guarding writes in DB

Status: **Done in new schema file**

- `public.is_within_clinic_hours()` is now used inside RLS `USING` policies for **reads** as well.
- This means direct table reads are also blocked outside 07:00-19:00 Asia/Manila (unless trusted bypass context is used).
- File: `schema_auth_rls.sql`

---

## Additional ABAC/RBAC Policy Hardening Included

In `schema_auth_rls.sql`, the following were also added:

- Sensitivity-aware DB reads:
  - `restricted` records are visible only to physician/admin via `can_access_sensitivity(...)`.
- Ownership-aware updates:
  - nurse can only update own clinical rows (`clinician_auth_user_id` / clinician name fallback).
- `auth.users -> public.users` sync trigger:
  - auto-link profile rows by email and `auth_user_id`.
- Login lockout RPC helpers used by login page.

---

## What You Must Do in Supabase Dashboard

1. Run `schema_auth_rls.sql` in SQL Editor.
2. Create clinic accounts in **Authentication -> Users**:
   - `physician@tupclinic.local`
   - `nurse@tupclinic.local`
3. Disable public self-signup in Auth settings.
4. Rotate anon key and update deployment env vars.

---

## Primary Security Files

- `schema_auth_rls.sql`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/AuthContext.jsx`
- `frontend/src/supabaseClient.js`
- `frontend/src/accessControl.js`
