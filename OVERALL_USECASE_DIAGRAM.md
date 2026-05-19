# TUP Clinic EHR - General Use Case Diagram

The diagram below follows the same general style as the sample: actors outside the system boundary, colored oval use cases inside the system, and dashed `<<include>>` links for shared functions.

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial","fontSize":"14px","primaryTextColor":"#111","lineColor":"#555"},"flowchart":{"curve":"linear","nodeSpacing":38,"rankSpacing":58,"useMaxWidth":true}}}%%
flowchart LR
  Patient["Patient / Student<br/>(Online Portal User)"]
  Walkin["Walk-in Patient<br/>(Kiosk User)"]
  Doctor["Doctor / Dentist"]
  Nurse["Nurse / Clinic Staff"]
  Admin["Admin / IT"]

  subgraph SYS["TUP Clinic EHR System"]
    direction LR

    subgraph LEFT["Patient and Kiosk Functions"]
      direction TB
      P1([Register / Log In])
      P2([Book Same-day or Future Appointment])
      P3([View Appointment / Queue Status])
      P4([Send Message to Clinic / Doctor])
      P5([View Own Records and Vitals])
      P6([Update Patient Profile])

      K1([Enter Student ID and Name])
      K2([Book Appointment via Kiosk])
      K3([Generate Queue Number / Reference Slip])
    end

    subgraph CORE["Shared Scheduling and Security"]
      direction TB
      C1([Secure Authentication])
      C2([Select Department / Service])
      C3([View Available Slots])
      C4([Manage Centralized Scheduling])
      C5([Manage Walk-in Queue])
      C6([Update Consultation Status])
      C7([Enforce Role and Clinic-Hours Access])
      C8([Write Audit Log])
    end

    subgraph RIGHT["Staff and Admin Functions"]
      direction TB
      D1([View Patient Records])
      D2([Record Consultation / Encounter])
      D3([Record Vitals and Clinical Notes])
      D4([Mark Visit as Completed])
      D5([Reply to Patient Messages])
      D6([Generate Reports and Analytics])

      N1([Register / Manage Patient Records])
      N2([Manage Appointments and Queue])
      N3([Update Patient Profile Notes])
      N4([Manage Inventory and Stock Logs])

      A1([Manage User Accounts and Roles])
      A2([Manage System Settings])
      A3([View Audit Logs])
      A4([Backup and Export System Data])
    end
  end

  Patient --- P1
  Patient --- P2
  Patient --- P3
  Patient --- P4
  Patient --- P5
  Patient --- P6

  Walkin --- K1
  Walkin --- K2
  Walkin --- K3

  D1 --- Doctor
  D2 --- Doctor
  D3 --- Doctor
  D4 --- Doctor
  D5 --- Doctor
  D6 --- Doctor

  N1 --- Nurse
  N2 --- Nurse
  N3 --- Nurse
  N4 --- Nurse
  D3 --- Nurse
  D6 --- Nurse

  A1 --- Admin
  A2 --- Admin
  A3 --- Admin
  A4 --- Admin
  D6 --- Admin
  N4 --- Admin

  P1 -. "<<include>>" .-> C1
  P2 -. "<<include>>" .-> C2
  P2 -. "<<include>>" .-> C3
  P2 -. "<<include>>" .-> C4
  P3 -. "<<include>>" .-> C5
  P4 -. "<<include>>" .-> C8
  P5 -. "<<include>>" .-> C7
  P6 -. "<<include>>" .-> C8

  K2 -. "<<include>>" .-> C2
  K2 -. "<<include>>" .-> C3
  K2 -. "<<include>>" .-> C4
  K3 -. "<<include>>" .-> C5

  D1 -. "<<include>>" .-> C7
  D2 -. "<<include>>" .-> D3
  D2 -. "<<include>>" .-> C8
  D4 -. "<<include>>" .-> C6
  D5 -. "<<include>>" .-> C8
  D6 -. "<<include>>" .-> C7

  N1 -. "<<include>>" .-> C8
  N2 -. "<<include>>" .-> C4
  N2 -. "<<include>>" .-> C5
  N2 -. "<<include>>" .-> C6
  N3 -. "<<include>>" .-> C8
  N4 -. "<<include>>" .-> C8

  A1 -. "<<include>>" .-> C7
  A2 -. "<<include>>" .-> C8
  A3 -. "<<include>>" .-> C8
  A4 -. "<<include>>" .-> C7

  classDef actor fill:#fff,stroke:#111,stroke-width:2px,color:#111;
  classDef patient fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.5px,color:#102a14;
  classDef kiosk fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0b2c55;
  classDef core fill:#f5f5f5,stroke:#616161,stroke-width:1.5px,color:#222;
  classDef doctor fill:#ffebee,stroke:#b71c1c,stroke-width:1.5px,color:#4a0808;
  classDef nurse fill:#fff8e1,stroke:#b8860b,stroke-width:1.5px,color:#4b3500;
  classDef admin fill:#f3e5f5,stroke:#6a1b9a,stroke-width:1.5px,color:#2d0b3f;

  class Patient,Walkin,Doctor,Nurse,Admin actor;
  class P1,P2,P3,P4,P5,P6 patient;
  class K1,K2,K3 kiosk;
  class C1,C2,C3,C4,C5,C6,C7,C8 core;
  class D1,D2,D3,D4,D5,D6 doctor;
  class N1,N2,N3,N4 nurse;
  class A1,A2,A3,A4 admin;
```

**Legend**

| Color | Meaning |
|---|---|
| Green | Patient portal functions |
| Blue | Self-service kiosk functions |
| Red | Doctor / dentist functions |
| Yellow | Nurse / clinic staff functions |
| Purple | Admin / IT functions |
| Gray | Shared scheduling, security, audit, and access-control services |

**Scope Notes**

- Patient portal includes sign-up/login, appointment booking, messages, own records, and profile updates.
- Kiosk booking supports walk-in users who enter student details, choose service/schedule, and receive a queue number or reference.
- Staff portal includes patient management, appointments, encounters, queue/status updates, reports, inventory, settings, profile/activity, and backups.
- Access control is based on app roles: `patient`, `nurse`, `physician`, and `admin`.
- Staff access is guarded by clinic hours: 07:00 to 19:00, Asia/Manila.
