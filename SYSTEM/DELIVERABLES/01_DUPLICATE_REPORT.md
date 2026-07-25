# DUPLICATE REPORT

> Last scan: 2026-07-25 | Next scan: schedule after first note import

---

## Status: No Duplicates Found

The system was built on an empty repository. No duplicate notes exist at this time.

---

## Duplicate Detection Protocol

Run this analysis each time a large batch of notes is imported.

### Detection Categories

| Category | Description | Action |
|----------|-------------|--------|
| **Exact duplicate** | Identical content, same or different name | Keep richest, archive rest |
| **Near duplicate** | 80%+ similar content | Review manually, merge or archive |
| **Version duplicate** | Different versions of same document | Keep latest, archive older with `v1_`, `v2_` prefix |
| **Copy** | Deliberately copied with minor edits | Review purpose; merge or keep both |

### Detection Process

1. **Hash comparison** — Flag files with identical MD5/SHA hashes
2. **Title comparison** — Flag files with identical or near-identical names
3. **Content scan** — Semantic similarity check (AI-assisted)
4. **Date comparison** — Identify which version is newer/richer

### Resolution Rules

```
IF exact duplicate:
  → Keep richest version (most content, most metadata)
  → Move duplicate to 32_ARCHIVE/ with prefix DUPLICATE_YYYY-MM-DD_
  → NEVER delete

IF near duplicate:
  → Move both to 33_NEEDS_REVIEW/
  → Add note: "Possible duplicate of [other file]"
  → Human reviews and decides

IF version duplicate:
  → Keep most recent version in original location
  → Move older versions to 32_ARCHIVE/ with version prefix
```

---

## Duplicate Log

When duplicates are found, record them here:

| Date Found | Original File | Duplicate File | Action Taken | Notes |
|------------|--------------|----------------|--------------|-------|
| — | — | — | — | — |

---

*→ [Notes Moved Report](./02_NOTES_MOVED_REPORT.md) | [Master Index](../MASTER_INDEX.md)*
