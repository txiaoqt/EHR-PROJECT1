# Structure Explanation

This document explains the three access-control structures implemented in the system:

1. Role-Based Access Control (RBAC)
2. Attribute-Based Access Control (ABAC)
3. Rule-Based Access Control (RuleBAC)

## 1. Role-Based Access Control (RBAC)

RBAC controls what a user can do based on their assigned role.

### Roles Used
- `admin`
- `physician`
- `nurse`

### How RBAC Is Applied
- Users are assigned one role in the `users` table.
- Frontend checks role before showing or allowing sensitive actions.
- A `role_permissions` structure is available in schema/migration for per-module access mapping.

### Current Role Behavior in the App
- `physician`:
  - Full clinical control.
  - Can delete records (appointments, encounters, inventory items, patient records).
  - Can edit physician-only fields like `assessment_plan`.
- `nurse`:
  - Can perform daily operations (view/create/update where allowed).
  - Cannot delete records.
  - Cannot edit physician-only fields such as `assessment_plan`.

## 2. Attribute-Based Access Control (ABAC)

ABAC controls access based on record/user attributes, not only role.

### Attributes Added/Used
- `sensitivity_level` on clinical records (for example: `normal`, `restricted`).
- Ownership context such as clinician name (`clinician_name`) for “own record” checks.
- Extensible ABAC metadata fields in migration:
  - user attributes (`abac_attributes`, clearance/department support)
  - record tags (`abac_tags`)

### How ABAC Is Applied
- Sensitivity-aware display:
  - Restricted fields are masked for nurses where policy requires.
- Field-level attribute restriction:
  - `assessment_plan` is treated as physician-only.
- Ownership-aware update rule:
  - Non-privileged users are restricted to their own assigned records for specific update paths.

### Break-Glass Support
- A break-glass audit structure is included in migration:
  - `break_glass_audit_logs`
  - helper function to log emergency override events with justification.

## 3. Rule-Based Access Control (RuleBAC)

RuleBAC enforces fixed system rules regardless of user preference.

### Rule Implemented
- System access window: **07:00 to 19:00 (Asia/Manila)**.

### How RuleBAC Is Applied
- Frontend route guard:
  - Protected pages are blocked outside clinic hours.
- Auto-logout:
  - Active sessions are logged out automatically outside clinic hours.
- Login-time enforcement:
  - Login is denied outside allowed operating hours.
- Database write guard (migration):
  - Trigger-based restriction blocks write operations outside clinic hours (with trusted bypass options for controlled backend/admin use).

## Login Hardening Included

Additional security controls were also added to login:
- Failed attempt tracking in `users`:
  - `failed_login_attempts`
  - `last_failed_login_at`
  - `locked_until`
- Lockout policy:
  - default threshold: 5 failed attempts
  - lock duration: 15 minutes
- Successful login clears lockout counters.

