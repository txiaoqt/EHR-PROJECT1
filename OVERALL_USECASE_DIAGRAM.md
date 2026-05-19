# TUP Clinic EHR - General Use Case Diagram

This is a simplified general use case diagram for the current TUP Clinic EHR app. It follows the simple format shown in the reference: actors outside the system boundary, main system use cases inside, and direct association lines.

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Arial","fontSize":"16px","primaryTextColor":"#222","lineColor":"#555"},"flowchart":{"curve":"linear","nodeSpacing":60,"rankSpacing":80,"useMaxWidth":true}}}%%
flowchart LR
  Patient["Patient / Student"]
  Walkin["Walk-in Patient"]

  subgraph SYS["TUP Clinic EHR System"]
    direction TB
    UC1([Register / Log In])
    UC2([Book Appointment])
    UC3([View Queue / Appointment Status])
    UC4([View Patient Records])
    UC5([Send / Reply to Messages])
    UC6([Manage Patient Records])
    UC7([Manage Appointments and Queue])
    UC8([Record Consultation / Encounter])
    UC9([Manage Inventory])
    UC10([Generate Reports and Analytics])
    UC11([Manage Settings, Users, Audit, and Backup])
  end

  Staff["Doctor / Nurse / Clinic Staff"]
  Admin["Admin / IT"]

  Patient --- UC1
  Patient --- UC2
  Patient --- UC3
  Patient --- UC4
  Patient --- UC5

  Walkin --- UC2
  Walkin --- UC3

  UC4 --- Staff
  UC5 --- Staff
  UC6 --- Staff
  UC7 --- Staff
  UC8 --- Staff
  UC9 --- Staff
  UC10 --- Staff

  UC10 --- Admin
  UC11 --- Admin

  classDef actor fill:#fff,stroke:#222,stroke-width:2px,color:#111;
  classDef usecase fill:#fff2cc,stroke:#b7a25a,stroke-width:1.5px,color:#222;

  class Patient,Walkin,Staff,Admin actor;
  class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11 usecase;
```

**Figure:** General Use Case Diagram of the TUP Clinic EHR System

**Actors**

- Patient / Student: uses the online patient portal.
- Walk-in Patient: uses the kiosk booking flow.
- Doctor / Nurse / Clinic Staff: manages clinical and operational workflows.
- Admin / IT: handles administrative, audit, backup, and system settings workflows.
