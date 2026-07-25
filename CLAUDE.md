# CLAUDE.md — AI Guidance for MALI-MEC Knowledge System

This file instructs Claude (and any AI assistant) how to work with this repository.

## Repository Purpose

MALI-MEC is a **dual-purpose** repository:
1. **Active project**: Mobile app for managing fuel truck loading operations
2. **Knowledge management system**: A structured Second Brain for all professional and personal knowledge

## Working Principles

### When adding a note
- Always read the full content before classifying — never rely on titles alone
- Prefer semantic understanding over keyword matching
- When uncertain → place in `33_NEEDS_REVIEW/` rather than wrong folder
- Preserve all original metadata: dates, attachments, links, formatting

### When organizing
- Follow the Johnny.Decimal numbering (`01_INBOX`, `02_PROJECTS`, etc.)
- Use naming convention: `YYYY-MM-DD <Context> <Subject>.md`
- Add YAML frontmatter metadata to every note (see Templates)
- Cross-link related notes using relative Markdown links

### Folder Decision Tree

```
Is it actionable and multi-step?        → 02_PROJECTS
Is it about a specific company?         → 03_COMPANIES
Is it from or about a client?           → 04_CLIENTS
Is it a meeting record?                 → 18_MEETINGS/YYYY/
Is it a contract?                       → 19_CONTRACTS
Is it a learning resource?              → 15_BOOKS / 16_COURSES / 17_TRAININGS
Is it reference material?               → 07_AI / 08_TECH / 12_PETROLEUM / 13_EDUCATION
Is it an idea (not yet a project)?      → 31_IDEAS
Is it old / completed?                  → 32_ARCHIVE
Are you not sure?                       → 33_NEEDS_REVIEW
```

### Metadata Template (add to every note)

```yaml
---
title: ""
date_created: "YYYY-MM-DD"
date_modified: "YYYY-MM-DD"
category: ""
subcategory: ""
project: ""
company: ""
client: ""
language: "fr | en | ar"
priority: "high | medium | low"
status: "active | completed | archived | needs-review"
tags: []
related_notes: []
---
```

## Key Entities

### Companies
- **MEC** — Management & Engineering Consulting (primary company)
- **Urban Beach** — Restaurant/hospitality business
- **Champion School** — Educational institution
- **Techiftiin Institute** — AI/tech training institute
- **OLA Energy** — Petroleum/fuel client
- **APEX** — Engineering/consulting firm

### Key Projects
- **MALI-MEC App** — Mobile app for fuel truck loading management
- **Techiftiin Institute** — AI education institution
- **Champion School** — School management

### Key Domains
- Petroleum / Fuel logistics
- AI & Technology education
- Construction & Engineering
- Restaurant & Hospitality
- Government grants (MENFOP, UNICEF, JICA, Google)

## Tag System

Always use tags from `SYSTEM/TAGS_TAXONOMY.md`. Primary tags:

`#AI` `#Business` `#Finance` `#Python` `#Petroleum` `#Construction`
`#Legal` `#Marketing` `#Leadership` `#Restaurant` `#School` `#Training`
`#Tender` `#Proposal` `#Meeting` `#Important` `#ActionRequired`
`#Research` `#Reference` `#Archived`

## Duplicate Handling

1. Compare content semantically, not just titles
2. Keep the richest/most complete version
3. Move older duplicates to `32_ARCHIVE/` with prefix `DUPLICATE_`
4. Never delete — always archive

## Quality Standards

- No orphan notes (every note in a folder)
- No broken relative links
- No empty folders (use a `README.md` placeholder if folder is reserved)
- Consistent naming across all notes
- Every note has YAML frontmatter
