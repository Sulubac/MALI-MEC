# MISSING METADATA REPORT

> Notes that lack required frontmatter fields.

---

## Status: No Notes To Audit

The system is new. This report will be populated after notes are imported.

---

## Required Metadata Fields

Every note must have these fields in its YAML frontmatter:

| Field | Required | Example |
|-------|----------|---------|
| `title` | ✅ | "2026-07-25 OLA Meeting Q3" |
| `date_created` | ✅ | "2026-07-25" |
| `date_modified` | ✅ | "2026-07-25" |
| `category` | ✅ | "Meeting" |
| `status` | ✅ | "active" |
| `tags` | ✅ | ["Meeting", "OLA", "Petroleum"] |
| `subcategory` | ⭕ Optional | "Fuel Loading" |
| `project` | ⭕ If applicable | "MALI-MEC App" |
| `company` | ⭕ If applicable | "OLA Energy" |
| `client` | ⭕ If applicable | "OLA Energy" |
| `language` | ⭕ Optional | "fr" |
| `priority` | ⭕ Optional | "high" |
| `related_notes` | ⭕ Optional | ["path/to/note.md"] |

---

## Notes With Missing Metadata

| File | Missing Fields | Date Found | Fixed? |
|------|---------------|------------|--------|
| — | — | — | ⬜ |

---

## Metadata Audit Process

Run after every large import batch:

1. Scan all `.md` files for YAML frontmatter
2. Flag files missing required fields
3. For each flagged file: add metadata manually or with AI assistance
4. Mark as fixed in this log

---

## Metadata Quality Statistics

| Metric | Count | % Coverage |
|--------|-------|-----------|
| Notes with full metadata | 0 | — |
| Notes with partial metadata | 0 | — |
| Notes with no metadata | 0 | — |
| **Total notes** | **0** | — |

---

*→ [Missing Metadata Fixed Date: —] | [Master Index](../MASTER_INDEX.md)*
