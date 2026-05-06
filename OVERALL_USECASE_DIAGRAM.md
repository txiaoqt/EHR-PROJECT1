# TUP Clinic EHR - Overall Use Case Diagram

This diagram summarizes the major actors and system-wide use cases based on the current frontend + Supabase implementation.

```mermaid
flowchart LR
  A[Admin]
  P[Physician]
  N[Nurse]
  U[Clinic Staff User]
  T["System Clock (Asia/Manila)"]

  subgraph SYS[TUP Clinic EHR System]
    L([Login])
    LO([Logout])
    VD([View Dashboard])
    MA([Manage Appointments])
    MP([Manage Patients])
    RE([Record Encounter])
    ME([Manage Encounters])
    MI([Manage Inventory])
    GR([Generate Reports])
    EC([Export Clinical Data])
    VP([View / Update My Profile])
    VA([View Audit Activity])
    MS([Manage Settings])
    SB([Run System Backup Export])
    CH([Enforce Clinic Hours Rule])
    AC([Enforce RBAC / ABAC Restrictions])
  end

  U --- L
  U --- LO
  U --- VD
  U --- VP
  U --- VA

  A --- MA
  P --- MA
  N --- MA

  A --- MP
  P --- MP
  N --- MP

  A --- RE
  P --- RE
  N --- RE

  A --- ME
  P --- ME
  N --- ME

  A --- MI
  P --- MI
  N --- MI

  A --- GR
  P --- GR
  N --- GR

  A --- EC
  P --- EC

  A --- MS
  A --- SB

  L -. <<include>> .-> CH
  VD -. <<include>> .-> CH
  MA -. <<include>> .-> AC
  MP -. <<include>> .-> AC
  RE -. <<include>> .-> AC
  ME -. <<include>> .-> AC
  MI -. <<include>> .-> AC
  GR -. <<include>> .-> AC
  EC -. <<include>> .-> AC
  MS -. <<include>> .-> AC

  T --- CH
```

## Notes

- `Physician` and `Admin` are modeled with elevated permissions (for example delete/export-sensitive flows).
- `Nurse` participates in core operational flows but is restricted on physician-only or high-sensitivity actions.
- Clinic-hours enforcement (`07:00-19:00`, Asia/Manila) is treated as a cross-cutting rule impacting login and protected usage.
- Access-control enforcement combines role-based and attribute/rule-based checks (RBAC + ABAC + RuleBAC).
