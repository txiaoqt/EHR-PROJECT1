# TUP Clinic EHR - General Use Case Diagram

This version follows the sample format: stickman actors, one system boundary, oval use cases, and `<<include>>` relationships. Monochrome only (no colors).

```plantuml
@startuml
left to right direction
skinparam monochrome true
skinparam shadowing false
skinparam packageStyle rectangle
skinparam actorStyle stickman

title TUP Clinic EHR: Electronic Health Records System

actor "Patient / Student\n(Online Patient Portal User)" as PAT
actor "Walk-in Patient\n(Self-Service Kiosk User)" as WLK
actor "Doctor / Dentist" as DOC
actor "Nurse / Clinic Staff" as NUR
actor "Admin / IT" as ADM

rectangle "TUP Clinic EHR System" {

  (Register / Login\n(Online Patient Portal)) as P1
  (Browse Clinics and\nAvailable Services) as P2
  (Book Same-day or\nFuture Appointment) as P3
  (View Appointment /\nQueue Status) as P4
  (View Own Records\nand Vitals) as P5
  (Send Follow-up\nClinic Messages) as P6

  (Enter Student ID /\nQR Verification) as K1
  (Select Department /\nService via Kiosk) as K2
  (Book Same-day\nAppointment via Kiosk) as K3
  (Generate Queue Number /\nReference Slip) as K4

  (Secure Authentication) as C1
  (Select Department /\nService) as C2
  (View Available Slots) as C3
  (Manage Centralized\nAppointment Scheduling) as C4
  (Manage Walk-in Queue) as C5
  (Update Consultation\nStatus) as C6
  (Enforce Role / Clinic-Hours\nAccess Rules) as C7
  (Write Audit Log) as C8

  (View Patient Records) as D1
  (Record Consultation /\nEncounter) as D2
  (Mark Visit as Completed) as D3
  (Manage Appointments\nand Queue) as D4
  (Reply to Patient Messages) as D5
  (Generate Reports\nand Analytics) as D6

  (Manage Patient Records) as N1
  (Manage Walk-in Queue) as N2
  (Update Patient Profile\nNotes) as N3
  (Manage Inventory) as N4

  (Manage User Accounts\nand Roles) as A1
  (Manage System Settings) as A2
  (View Audit Logs) as A3
  (Backup and Export\nSystem Data) as A4
}

PAT -- P1
PAT -- P2
PAT -- P3
PAT -- P4
PAT -- P5
PAT -- P6

WLK -- K1
WLK -- K2
WLK -- K3
WLK -- K4

DOC -- D1
DOC -- D2
DOC -- D3
DOC -- D4
DOC -- D5
DOC -- D6

NUR -- N1
NUR -- N2
NUR -- N3
NUR -- N4
NUR -- D5
NUR -- D6

ADM -- A1
ADM -- A2
ADM -- A3
ADM -- A4

P1 .> C1 : <<include>>
P3 .> C2 : <<include>>
P3 .> C3 : <<include>>
P3 .> C4 : <<include>>
P4 .> C5 : <<include>>
P6 .> C8 : <<include>>

K2 .> C2 : <<include>>
K3 .> C4 : <<include>>
K4 .> C5 : <<include>>

D2 .> C8 : <<include>>
D3 .> C6 : <<include>>
D4 .> C4 : <<include>>
D5 .> C8 : <<include>>
D6 .> C7 : <<include>>

N1 .> C7 : <<include>>
N2 .> C5 : <<include>>
N3 .> C8 : <<include>>
N4 .> C8 : <<include>>

A1 .> C7 : <<include>>
A2 .> C8 : <<include>>
A3 .> C8 : <<include>>
A4 .> C7 : <<include>>

@enduml
```

Figure: General Use Case Diagram of the TUP Clinic EHR System
