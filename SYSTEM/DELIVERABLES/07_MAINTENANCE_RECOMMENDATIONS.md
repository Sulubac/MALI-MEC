# MAINTENANCE RECOMMENDATIONS

> How to keep the MALI-MEC knowledge system clean, current, and useful.

---

## Daily Habits (5 minutes)

| Habit | Action |
|-------|--------|
| **Capture** | Drop all new notes, links, ideas into `01_INBOX/` |
| **Name correctly** | Use `YYYY-MM-DD Context Subject.md` naming |
| **Add basic tags** | At minimum: one domain tag + one status tag |

---

## Weekly Review (30 minutes — every Friday)

**Step 1 — Clear Inbox**
- Open `01_INBOX/`
- Classify every note: move to correct folder, add full metadata
- Target: Inbox = 0 at end of review

**Step 2 — Process `33_NEEDS_REVIEW/`**
- Attempt to classify held notes
- If still unclear after 3 weeks → archive with `#NeedsReview` tag

**Step 3 — Update Dashboards**
- Update `SYSTEM/DASHBOARDS/PROJECTS_DASHBOARD.md`
- Check upcoming deadlines
- Close completed action items

**Step 4 — Check Action Items**
- Review all open `- [ ]` items in meeting notes
- Transfer to project files if still open
- Close completed items

**Step 5 — Commit & Push**
```bash
git add .
git commit -m "Weekly review $(date +%Y-%m-%d)"
git push
```

---

## Monthly Review (1 hour — first Monday of month)

| Task | Action |
|------|--------|
| **Archive old notes** | Move completed project notes to `32_ARCHIVE/` |
| **Update indexes** | Add new entries to `SYSTEM/MASTER_INDEX.md` |
| **Duplicate scan** | Check for near-duplicate notes in active folders |
| **Update maps** | Add new companies/clients/projects to maps |
| **Training progress** | Update `SYSTEM/DASHBOARDS/TRAINING_DASHBOARD.md` |
| **Business review** | Update `SYSTEM/DASHBOARDS/BUSINESS_DASHBOARD.md` |

---

## Quarterly Review (2 hours)

| Task | Action |
|------|--------|
| **Audit metadata** | Run missing metadata scan, fill gaps |
| **Purge empty folders** | Remove folders that are truly never going to be used |
| **Update tag taxonomy** | Add new tags to `SYSTEM/TAGS_TAXONOMY.md` |
| **Review folder structure** | Consider splitting folders with 100+ notes |
| **Update knowledge graph** | Add new relationships to `SYSTEM/KNOWLEDGE_GRAPH.md` |
| **Generate reports** | Create quarterly summary in `29_REPORTS/Quarterly/` |

---

## Annual Review (4 hours)

| Task | Action |
|------|--------|
| **Archive previous year** | Move 2026 content → `32_ARCHIVE/2026/` |
| **Create year folder** | Create `18_MEETINGS/2027/`, `28_PRESENTATIONS/2027/` etc. |
| **Update system** | Review and update this entire SYSTEM/ folder |
| **Tag cleanup** | Remove unused tags from taxonomy |
| **System improvement** | Implement top items from `05_SUGGESTED_IMPROVEMENTS.md` |

---

## File Naming Rules — Quick Reference

| Type | Pattern | Example |
|------|---------|---------|
| Note | `YYYY-MM-DD Context Subject.md` | `2026-07-25 OLA Fuel Loading KPIs.md` |
| Meeting | `YYYY-MM-DD Company Topic.md` | `2026-07-25 OLA Energy Q3 Review.md` |
| Report | `YYYY-MM-DD Company Report Type.md` | `2026-07-25 MEC Monthly Report July.md` |
| Contract | `YYYY-MM-DD Client Contract Name.md` | `2026-07-25 OLA Energy Fuel Supply Contract.md` |
| Idea | `YYYY-MM-DD Idea Title.md` | `2026-07-25 Idea AI Chatbot for School.md` |

---

## Backup Strategy

1. **Primary**: GitHub repository (this repo)
2. **Secondary**: Local disk backup (weekly)
3. **Tertiary**: Cloud storage (attachments folder)

---

## Warning Signs — System Health

| Warning | Action |
|---------|--------|
| Inbox > 20 notes | Emergency review session needed |
| `33_NEEDS_REVIEW/` > 10 notes | Schedule extra review time |
| Last commit > 2 weeks ago | System is being neglected |
| Archive > 50% of total notes | Normal — archive is healthy |
| Orphan notes (no folder) | Run git status, classify immediately |

---

*→ [Suggested Improvements](./05_SUGGESTED_IMPROVEMENTS.md) | [Executive Summary](./06_EXECUTIVE_SUMMARY.md) | [Master Index](../MASTER_INDEX.md)*
