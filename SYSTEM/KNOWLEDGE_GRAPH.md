# KNOWLEDGE GRAPH

> Relationships between all major entities in the MALI-MEC knowledge base.

---

## Entity Relationship Overview

```
                        ┌─────────────────┐
                        │       MEC        │
                        │  (Primary Org)   │
                        └────────┬────────┘
                                 │ operates
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     ┌────────────┐    ┌──────────────────┐  ┌──────────────┐
     │Urban Beach │    │Techiftiin Institute│  │Champion School│
     │(Restaurant)│    │  (AI Education)  │  │  (K-12)      │
     └────────────┘    └──────────────────┘  └──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌─────────┐
              │ MENFOP  │  │ UNICEF  │  │  JICA   │
              │ (Grant) │  │ (Grant) │  │ (Grant) │
              └─────────┘  └─────────┘  └─────────┘
```

---

## Project → Company → Client Flow

```
Meeting
  │
  ▼
Project Brief
  │
  ├──► Company (internal)
  │         │
  │         └──► Employees / HR
  │
  ├──► Client (external)
  │         │
  │         ├──► Proposal
  │         ├──► Contract
  │         ├──► Invoice
  │         ├──► Reports
  │         └──► Presentation
  │
  └──► Deliverables
            ├──► Report
            ├──► Presentation
            └──► Archive
```

---

## MALI-MEC App — Entity Relationships

```
MALI-MEC App
  │
  ├── Fuel Trucks ──────────── OLA Energy
  │        │                        │
  │        └── Loading Records       └── Contracts
  │                  │
  │                  └── KPI Reports
  │
  ├── Drivers ──── HR Records
  │
  ├── Depots ───── Operations SOPs
  │
  └── Finance ──── Invoices / Reports
```

---

## Techiftiin Institute — Entity Relationships

```
Techiftiin Institute
  │
  ├── Vision & Strategy ──── Business Plan
  │
  ├── Courses ─────────────── Curriculum ──── Teachers
  │       │                                        │
  │       └── Students ──── Exams / Certificates   │
  │                                                │
  ├── AI Labs ──────────────────────────── AI Research
  │
  ├── Grants ───┬── MENFOP
  │             ├── UNICEF
  │             ├── JICA
  │             └── Google
  │
  ├── Marketing ──── Website ──── Social Media
  │
  └── Finance ──── Budget ──── Reports
```

---

## Petroleum Domain — Entity Relationships

```
Petroleum
  │
  ├── OLA Energy (Client)
  │       ├── Fuel Loading Operations
  │       │       ├── Trucks
  │       │       ├── Drivers
  │       │       └── Depots
  │       ├── KPI Reports
  │       ├── Safety Records
  │       └── Contracts
  │
  ├── HDTL
  │       ├── Project Records
  │       └── Reports
  │
  └── EPSE
          ├── Project Records
          └── Reports
```

---

## Education Domain — Entity Relationships

```
Education
  │
  ├── Champion School ──── Students ──── Parents
  │          │                    └── Grades / Exams
  │          ├── Teachers ──── Curriculum
  │          └── Finance
  │
  ├── Techiftiin Institute (see above)
  │
  └── Personal Education
              ├── Books ──── Summaries
              ├── Courses ──── Certificates
              └── Trainings ──── Notes
```

---

## Finance — Cross-Entity Connections

```
Finance
  ├── MEC ──── Projects ──── Invoices
  ├── Urban Beach ──── Revenue/Expenses
  ├── Champion School ──── Tuition/Payroll
  ├── Techiftiin ──── Grants/Budget
  ├── OLA Energy ──── Contract Value
  └── Personal ──── Personal Budget
```

---

## AI & Technology — Cross-Domain Connections

```
AI / Technology
  ├── Techiftiin ──── AI Courses ──── Students
  ├── MALI-MEC App ──── Development ──── Python/JS
  ├── Automation ──── n8n ──── Workflows
  ├── Claude ──── Prompts ──── Projects
  └── Research ──── Papers ──── Ideas
```

---

## Tag Co-occurrence Map

| Tag | Frequently appears with |
|-----|------------------------|
| `#AI` | `#Technology` `#Training` `#Research` `#Python` |
| `#Petroleum` | `#OLA` `#KPIs` `#Safety` `#Logistics` |
| `#Meeting` | `#ActionRequired` `#Project` `#Client` |
| `#Proposal` | `#Tender` `#Client` `#Sales` |
| `#Legal` | `#Contract` `#Compliance` `#Government` |
| `#Training` | `#AI` `#Leadership` `#Certificate` |
| `#Important` | `#ActionRequired` `#Deadline` |
| `#Education` | `#School` `#Curriculum` `#Teaching` |

---

*→ [Master Index](./MASTER_INDEX.md) | [Tags Taxonomy](./TAGS_TAXONOMY.md)*
