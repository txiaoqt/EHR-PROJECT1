# About Security

This document explains the security posture of the current TUP Clinic EHR codebase: what is already implemented, what layer enforces it, and what risks still remain.

## Security Model In Place

The system currently uses a **hybrid app-level + database-level** model:

- App-level checks in React pages (`frontend/src/...`) for route access, role checks, and field restrictions.
- Database constraints and triggers in SQL (`schema.sql`, `supabase/migrations/20260414103000_security_abac_clinic_hours.sql`) for guardrails.
- Audit logging via `audit_logs` and optional `break_glass_audit_logs`.

## 1) Authentication and Session Behavior

### Implemented

- Login requires email + password and blocks login outside clinic hours.
  - Source: `frontend/src/pages/Login.jsx`, `frontend/src/pages/loginSecurity.js`
- Failed login lockout logic is implemented:
  - Max attempts: `5`
  - Lock duration: `15 minutes`
  - User fields used: `failed_login_attempts`, `last_failed_login_at`, `locked_until`
- Auto-logout and route blocking outside clinic hours.
  - Source: `frontend/src/App.jsx`

### Important Notes

- CAPTCHA has been fully removed.
- Session state is maintained through `AuthContext` and Supabase auth listener, but login credential validation is currently custom against `users` table.

## 2) RBAC (Role-Based Access Control)

### Implemented Roles

- `admin`
- `physician`
- `nurse`

Role values are constrained in SQL:
- `users.role` check constraint
- `role_permissions.role` check constraint

### Implemented RBAC Behavior

- Nurses cannot delete records.
- Physicians/admin can delete records.
- Nurse access is restricted for physician-only fields (such as `assessment_plan`).
- Role-based menu/action hiding is present in major pages:
  - `Appointments.jsx`
  - `Encounters.jsx`
  - `Encounter.jsx`
  - `PatientProfile.jsx`
  - `Inventory.jsx`

### DB RBAC Support

- `role_permissions` table + helper function `has_role_permission(...)` exist in `schema.sql`.

## 3) Rule-Based Access Control (Time Rule)

### Implemented Rule

- Allowed access window: **07:00 to 19:00 (Asia/Manila)**.

### Enforcement Points

- Frontend route/session guard:
  - Blocks protected pages outside hours.
  - Auto-logs out active users outside hours.
  - Source: `frontend/src/App.jsx`, `frontend/src/accessControl.js`
- Database write guard trigger:
  - Blocks `INSERT/UPDATE/DELETE` outside clinic hours.
  - Applied to major tables via `apply_clinic_hours_guard(...)`.
  - Source: `supabase/migrations/20260414103000_security_abac_clinic_hours.sql`

### Bypass Behavior

- Trusted bypass is available for controlled channels:
  - `service_role`, `postgres`, `supabase_admin`, or `set_config('app.bypass_clinic_hours','on',...)`

## 4) ABAC (Attribute-Based Access Control)

### Implemented Attributes

- User-side attributes:
  - `clearance_level`
  - `department`
  - `abac_attributes` (JSONB)
- Record-side attributes:
  - `sensitivity_level` (`normal`, `restricted`)
  - `abac_tags` (text[])

### Implemented ABAC Logic in App

- High-sensitivity records and physician-only fields are restricted for nurses.
- `assessment_plan` is masked for nurse users in views/exports.
- Ownership-aware updates exist (example: clinician ownership checks):
  - `isOwnerOrPrivileged(...)` in `accessControl.js`

### Break-Glass Support

- Optional emergency override audit table and insert helper exist:
  - `break_glass_audit_logs`
  - `log_break_glass_access(...)`
- This is currently logging support, not full automatic policy override workflow.

## 5) Data Integrity and Input Safety

### Implemented

- Input sanitization in key forms:
  - Encounter: sanitizes search and validates vitals formats/ranges.
  - Inventory: sanitizes names/reasons and numeric bounds.
  - Patients: sanitizes search for ilike patterns.
- Confirm-before-delete UX for destructive actions:
  - Type patient ID/item name before deletion in multiple modules.
- Foreign keys and check constraints in schema protect relational integrity.

### Auditability

- `audit_logs` table is actively written from frontend utility/helper and feature flows.

## 6) Current Security Gaps (Important)

These are critical to understand because they affect real security strength:

1. Passwords are stored and compared as plain text in current flow.
   - `schema.sql` defines `users.password text`
   - `Login.jsx` compares `pass === user.password`

2. Row Level Security (RLS) is disabled and broad table grants are enabled.
   - `schema.sql` explicitly disables RLS on public tables.
   - `anon` and `authenticated` roles are granted broad CRUD.
   - This means app-side checks can be bypassed by direct API/table access.

3. Supabase anon key has a hardcoded fallback in frontend code.
   - Source: `frontend/src/supabaseClient.js`

4. Signup still references legacy `'user'` default role in UI (`Signup.jsx`), while DB now enforces `admin|physician|nurse`.

5. Time rule in DB currently guards writes; reads are still primarily controlled at app level.

## 7) Practical Security Status

### What is strong now

- Clear RBAC/ABAC/rule-based logic in app behavior.
- Clinic-hours enforcement in both UI and DB write path.
- Lockout mechanism for repeated failed login.
- Audit trails and break-glass logging structure.

### What must be improved for production-grade security

- Move to **Supabase Auth** for authentication (no plain-text passwords).
- Enable **RLS policies** and remove wide-open anon CRUD grants.
- Keep secrets only in environment variables (remove hardcoded fallback credentials/keys).
- Enforce ABAC/RBAC at DB policy level, not just React UI.
- Restrict report/export paths with server-side authorization checks.

## 8) File Map (Where Security Logic Lives)

- App guard and auto-logout:
  - `frontend/src/App.jsx`
- Access control helpers (RBAC/ABAC/time):
  - `frontend/src/accessControl.js`
- Login lockout + clinic-hour login gate:
  - `frontend/src/pages/Login.jsx`
  - `frontend/src/pages/loginSecurity.js`
- Feature-level permission checks:
  - `frontend/src/pages/Appointments.jsx`
  - `frontend/src/pages/Encounter.jsx`
  - `frontend/src/pages/Encounters.jsx`
  - `frontend/src/pages/PatientProfile.jsx`
  - `frontend/src/pages/Inventory.jsx`
- Base schema and grants:
  - `schema.sql`
- Security migration (clinic-hours DB guard + ABAC fields + break-glass):
  - `supabase/migrations/20260414103000_security_abac_clinic_hours.sql`

---

If you want, the next upgrade step is to create a **Security v2 migration** that enforces RBAC/ABAC/time rules with RLS and removes plaintext-password auth paths.
