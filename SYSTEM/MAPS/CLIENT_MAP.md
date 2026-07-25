# CLIENT MAP

> All client relationships. Each client gets a folder in `04_CLIENTS/`.

---

## Client Folder Structure

Every client folder should contain:
```
04_CLIENTS/<Client_Name>/
├── README.md           ← client profile (use Client Template)
├── Meetings/           ← meeting notes
├── Contracts/          ← signed contracts
├── Invoices/           ← invoices
├── Emails/             ← important email threads
├── Reports/            ← deliverables and reports
├── Presentations/      ← pitches and presentations
└── Projects/           ← links to project folders
```

---

## Active Clients

| Client | Domain | Since | Status | Folder |
|--------|--------|-------|--------|--------|
| OLA Energy | Petroleum / Fuel | — | 🟢 Active | [→](../../04_CLIENTS/) |
| *Add clients* | — | — | — | — |

---

## Prospects / Leads

| Lead | Domain | Source | Next Action | Folder |
|------|--------|--------|-------------|--------|
| *Add leads* | — | — | — | — |

---

## Government / Institutional Partners

| Organization | Type | Relationship | Key Contact |
|-------------|------|-------------|-------------|
| MENFOP | Government | Grant applicant | — |
| UNICEF | International | Grant applicant | — |
| JICA | International | Cooperation | — |
| Google | Tech | Grant / partner | — |

---

## Archived Clients

| Client | Domain | Last Engagement | Archive |
|--------|--------|----------------|---------|
| *Move here when inactive* | — | — | [→](../../32_ARCHIVE/) |

---

## Client Lifecycle

```
Lead/Prospect
     │
     ▼
First Meeting ──────► Meeting Notes [18_MEETINGS]
     │
     ▼
Proposal ───────────► Proposal File [23_SALES/Proposals]
     │
     ▼
Contract ───────────► Contract File [19_CONTRACTS]
     │
     ▼
Active Client ──────► Client Folder [04_CLIENTS/<Name>]
     │                       │
     │               Reports, Meetings, Invoices
     ▼
Completed ──────────► Archive [32_ARCHIVE]
```

---

## New Client Checklist

- [ ] Create folder `04_CLIENTS/<Client_Name>/`
- [ ] Fill `README.md` from [Client Template](../TEMPLATES/CLIENT_TEMPLATE.md)
- [ ] Create subfolders: Meetings, Contracts, Invoices, Reports
- [ ] Add to this Client Map
- [ ] Add to [Business Dashboard](../DASHBOARDS/BUSINESS_DASHBOARD.md)
- [ ] Tag with `#Client` in all related notes

---

*→ [Company Map](./COMPANY_MAP.md) | [Project Map](./PROJECT_MAP.md) | [Master Index](../MASTER_INDEX.md)*
