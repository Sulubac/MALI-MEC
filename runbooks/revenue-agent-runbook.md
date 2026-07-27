# Revenue Agent Runbook

## Purpose

This runbook defines the exact sequence, responsibilities, and rules for running the MALI-MEC 4-Agent Revenue System. Follow it every time you launch the coordinator for a new idea, offer, campaign, or video concept.

---

## The System at a Glance

```
COORDINATOR (Claude Code main context)
        │
        ▼
business-brief.md   ← Replace this for each new project
        │
        ├─→ [1] market-signal-researcher   → outputs/01-market-signal-brief.md
        │
        ├─→ [2] offer-architect            → outputs/02-offer-architecture.md
        │
        ├─→ [3] content-angle-strategist   → outputs/03-content-strategy.md
        │
        ├─→ [4] conversion-system-builder  → outputs/04-conversion-system.md
        │
        └─→ COORDINATOR SYNTHESIS         → outputs/05-revenue-agent-demo.md
```

---

## Phase 1 — Preparation

Before running any agent:

1. Open `business-brief.md`
2. Update or confirm the following fields are accurate:
   - Target audience (specific, not generic)
   - Current idea or campaign concept
   - Existing offers and value ladder
   - Tone and language preferences
   - Constraints
3. Clear the `outputs/` folder if re-running for a new project:
   ```
   rm outputs/*.md
   ```
   Keep `outputs/.gitkeep`
4. Confirm all four agent files exist in `.claude/agents/`:
   - `market-signal-researcher.md`
   - `offer-architect.md`
   - `content-angle-strategist.md`
   - `conversion-system-builder.md`

---

## Phase 2 — Agent Execution Sequence

### Agent 1 — market-signal-researcher

**Invoke:** First, before any other agent.

**Input:** `business-brief.md`

**Task:**
- Analyze seven demand dimensions
- Score the opportunity (1–5 per dimension)
- Profile the audience psychology
- Return strategic recommendation

**Output:** `outputs/01-market-signal-brief.md`

**Gate:**
- If opportunity score < 2.5: STOP. Revise the brief or pivot the idea before proceeding.
- If opportunity score 2.5–3.4: Proceed with caution. Flag the weak dimensions.
- If opportunity score ≥ 3.5: Proceed to Agent 2.

**Rule:** This agent does NOT write files. Its output is a structured text response. The coordinator saves it.

---

### Agent 2 — offer-architect

**Invoke:** Second, after reviewing Agent 1's output.

**Input:**
- `business-brief.md`
- Agent 1's Market Signal Brief

**Task:**
- Write the positioning statement
- Design the core offer
- Name the unique mechanism
- Build the value ladder
- Map proof requirements
- Map buyer objections
- Estimate 90-day revenue scenario (illustrative)

**Output:** `outputs/02-offer-architecture.md`

**Gate:**
- If the positioning statement scores below 3/5 on any criterion: rewrite before proceeding.
- If no unique mechanism can be identified: flag to the coordinator before proceeding.

---

### Agent 3 — content-angle-strategist

**Invoke:** Third, after reviewing Agent 2's output.

**Input:**
- `business-brief.md`
- `outputs/01-market-signal-brief.md`
- `outputs/02-offer-architecture.md`

**Task:**
- Generate and score five title candidates
- Select the best title with justification
- Generate five backup titles
- Generate five thumbnail text options
- Write the hook (first 20 seconds, word for word)
- Build the full retention map with timestamps
- Define screen recording beats

**Output:** `outputs/03-content-strategy.md`

**Gate:**
- Titles must score ≥ 4/5 on clickability and offer alignment.
- Hook must not begin with a greeting or self-introduction.

---

### Agent 4 — conversion-system-builder

**Invoke:** Fourth, after reviewing Agent 3's output.

**Input:**
- `business-brief.md`
- `outputs/02-offer-architecture.md`
- `outputs/03-content-strategy.md`

**Task:**
- Design the lead magnet with full contents list
- Write two in-video CTAs (mid-video + end)
- Write five follow-up emails (full body in French)
- Map the complete sales path from viewer to premium client
- Conduct friction audit (minimum five friction points)
- Define five credibility signals

**Output:** `outputs/04-conversion-system.md`

**Gate:**
- CTA must reference something demonstrated in the video.
- Lead magnet must be directly usable from the template pack.
- Friction audit must identify at least five specific risks.

---

## Phase 3 — Coordinator Synthesis

After all four agents have completed their outputs, the coordinator:

1. Reads all four output files
2. Identifies contradictions or gaps across the four documents
3. Resolves contradictions using the business brief as the final authority
4. Produces `outputs/05-revenue-agent-demo.md`

### Required sections in `outputs/05-revenue-agent-demo.md`:

```markdown
## Executive Summary
## Final Recommended Title
## Why the Topic Should Work (market rationale)
## The Offer Behind the Video
## The Unique Mechanism
## 14-Minute Screen Recording Structure (with timestamps)
## Lead Magnet
## In-Video CTA (end version)
## Five-Email Follow-Up Sequence (subject lines + first paragraph each)
## Credibility Requirements
## Generic Elements to Remove
## Next Steps (ordered action list)
```

---

## Phase 4 — Strategic Second Pass (Quality Gate)

After `outputs/05-revenue-agent-demo.md` exists:

Re-invoke `offer-architect` and `conversion-system-builder` for a second pass.

**Task for second pass:**

Score the complete brief on these seven criteria (1–5 each):

| Criterion | Score | Notes |
|-----------|-------|-------|
| Audience precision | | |
| Problem urgency | | |
| Promise credibility | | |
| Mechanism strength | | |
| Lead magnet attractiveness | | |
| Sales path fluidity | | |
| 15-minute video feasibility | | |

**Rule:** Any section scoring below 4 must be rewritten.

**Output:** `outputs/06-final-video-brief.md`

This is the final, production-ready document.

---

## Operating Rules

### Rule 1 — No single agent does everything

Each agent has one job. The coordinator connects them. Never collapse multiple roles into one agent.

### Rule 2 — Research is separate from offer

The market-signal-researcher observes and scores. The offer-architect decides and builds. These are different cognitive modes and must be separated.

### Rule 3 — Content is separate from conversion

The content-angle-strategist captures attention and builds retention. The conversion-system-builder captures action and builds revenue. Mixing them produces weak content and weak funnels.

### Rule 4 — Evidence and inference must be labeled

Every factual claim must identify its source. Every extrapolation must be labeled `**Inference:**`. No fabricated data.

### Rule 5 — Every output connects to revenue

Ask of every section: does this directly support attention, offers, leads, credibility, or leverage? If not, remove it.

### Rule 6 — The brief is the authority

When agents produce conflicting outputs, the business brief wins. All agents read the same brief. All agents serve the same commercial goal.

### Rule 7 — Reusability is the point

This system is not for one video. Replace `business-brief.md` for each new project. The agents remain. The runbook remains. The structure remains.

---

## Reuse Checklist (For Each New Project)

- [ ] `business-brief.md` updated with new audience, concept, and offer
- [ ] `outputs/` folder cleared (keep `.gitkeep`)
- [ ] Agent 1 run and output reviewed
- [ ] Opportunity gate passed (score ≥ 3.5)
- [ ] Agent 2 run and output reviewed
- [ ] Positioning statement scored and approved
- [ ] Agent 3 run and output reviewed
- [ ] Title scored ≥ 4 on clickability and offer alignment
- [ ] Hook reviewed — no greeting at start
- [ ] Agent 4 run and output reviewed
- [ ] Friction audit contains ≥ 5 specific risks
- [ ] Coordinator synthesis complete (`05-revenue-agent-demo.md`)
- [ ] Strategic second pass complete (`06-final-video-brief.md`)
- [ ] All sections scored ≥ 4 or rewritten

---

## Quick Start Command

Paste this into Claude Code to run the full system:

```
Read business-brief.md first. Then follow the revenue-agent-runbook.md exactly.

Step 1: Use the market-signal-researcher subagent to analyze business-brief.md. Save its output to outputs/01-market-signal-brief.md. Review the opportunity score. If below 3.5, stop and tell me.

Step 2: Use the offer-architect subagent, passing it business-brief.md and outputs/01-market-signal-brief.md. Save its output to outputs/02-offer-architecture.md.

Step 3: Use the content-angle-strategist subagent, passing it business-brief.md, outputs/01-market-signal-brief.md, and outputs/02-offer-architecture.md. Save its output to outputs/03-content-strategy.md.

Step 4: Use the conversion-system-builder subagent, passing it business-brief.md, outputs/02-offer-architecture.md, and outputs/03-content-strategy.md. Save its output to outputs/04-conversion-system.md.

Step 5: Synthesize all four outputs into outputs/05-revenue-agent-demo.md following the required sections in the runbook.

Step 6: Run the strategic second pass and save the result to outputs/06-final-video-brief.md.
```
