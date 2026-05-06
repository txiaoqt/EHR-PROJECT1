# TUP Clinic EHR - Overall Use Case Diagram

This diagram summarizes the major actors and system-wide use cases based on the current frontend + Supabase implementation.

```mermaid
usecaseDiagram
title TUP Clinic EHR - Overall Use Case

actor Admin as A
actor Physician as P
actor Nurse as N
actor "Clinic Staff User" as U
actor "System Clock (Asia/Manila)" as T

U <|-- A
U <|-- P
U <|-- N

rectangle "TUP Clinic EHR System" {
  (Login)
  (Logout)
  (View Dashboard)

  (Manage Appointments)
  (Manage Patients)
  (Record Encounter)
  (Manage Encounters)
  (Manage Inventory)

  (Generate Reports)
  (Export Clinical Data)

  (View / Update My Profile)
  (View Audit Activity)

  (Manage Settings)
  (Run System Backup Export)

  (Enforce Clinic Hours Rule)
  (Enforce RBAC / ABAC Restrictions)
}

U --> (Login)
U --> (Logout)
U --> (View Dashboard)
U --> (View / Update My Profile)
U --> (View Audit Activity)

A --> (Manage Appointments)
P --> (Manage Appointments)
N --> (Manage Appointments)

A --> (Manage Patients)
P --> (Manage Patients)
N --> (Manage Patients)

A --> (Record Encounter)
P --> (Record Encounter)
N --> (Record Encounter)

A --> (Manage Encounters)
P --> (Manage Encounters)
N --> (Manage Encounters)

A --> (Manage Inventory)
P --> (Manage Inventory)
N --> (Manage Inventory)

A --> (Generate Reports)
P --> (Generate Reports)
N --> (Generate Reports)

A --> (Export Clinical Data)
P --> (Export Clinical Data)

A --> (Manage Settings)
A --> (Run System Backup Export)

(Login) ..> (Enforce Clinic Hours Rule) : <<include>>
(View Dashboard) ..> (Enforce Clinic Hours Rule) : <<include>>
(Manage Appointments) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Manage Patients) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Record Encounter) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Manage Encounters) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Manage Inventory) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Generate Reports) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Export Clinical Data) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>
(Manage Settings) ..> (Enforce RBAC / ABAC Restrictions) : <<include>>

T --> (Enforce Clinic Hours Rule)
```

## Notes

- `Physician` and `Admin` are modeled with elevated permissions (for example delete/export-sensitive flows).
- `Nurse` participates in core operational flows but is restricted on physician-only or high-sensitivity actions.
- Clinic-hours enforcement (`07:00-19:00`, Asia/Manila) is treated as a cross-cutting rule impacting login and protected usage.
- Access-control enforcement combines role-based and attribute/rule-based checks (RBAC + ABAC + RuleBAC).
