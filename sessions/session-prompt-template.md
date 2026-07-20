# Open Code — Session N Prompt Template
## [Project Name]: [One-line session focus]

> HOW TO USE THIS TEMPLATE:
> Copy this file to sessions/prompts/session-N-<short-name>.md, fill in every
> [bracketed] placeholder, delete this instruction block, then paste the
> result as the first message in a fresh Open Code session.
>
> Each [bracket] below has an inline comment explaining WHY it exists and
> WHAT decides its content — read those before filling in blindly.

---

## Mandatory Context — Read Before Any Action

[List every governance/spec file relevant to THIS session only — not the
full project doc set. Reading unnecessary files wastes context budget
(see AGENTS.md "Governance File Economy" section). A typical session needs:]

1. `AGENTS.md`                — Always. Behavioral rules never change per-session.
2. `SKILLS.md`                — Always. Approved commands and output contracts.
3. `PROJECT_CONTEXT.md`       — Always. Current dev state; update it in Task 1.
4. `docs/architecture.md`     — [Which SPECIFIC section(s) this session touches —
                                 name them, don't say "read it all" if only one
                                 section is relevant]
5. [`docs/<stack>-patterns.md`] — [Only if this session touches that stack layer]

[Then list existing files from PRIOR sessions the agent must read to
understand what already exists before extending it. Be specific — file
paths, not "the codebase so far."]

Confirm all files read. State [what specific thing from the prior session's
output] before beginning Task 1. This forces genuine reading, not skimming.

---

## Critical Notes for This Session

[Optional section — only include if there's something session-specific
that would otherwise cause a repeat of a known mistake. Examples from past
sessions: "PixiJS rendering code cannot be unit tested — the testing table
below defines what IS and ISN'T testable this session." Delete this section
if nothing applies.]

---

## Bug Reproduction Requirement

[Include this block ONLY for bugfix-type sessions, not feature sessions.]

Before modifying any file to address a reported bug:
1. Reproduce the bug yourself first. State the exact steps taken and what
   you observed — do not proceed on the assumption a description is accurate.
2. If reproduction requires browser access, console output, or running the
   app, use the available MCP tooling (Firefox DevTools MCP) or ask the
   human to run the exact repro steps and paste console/network output.
3. Only after the bug is confirmed reproduced and its root cause is
   understood — state the root cause in one sentence — should any file
   be edited.
4. If the bug cannot be reproduced, say so explicitly and stop. Do not
   guess-fix based on the report alone.

---

## Session Goal

[One paragraph. What exists at the end of this session that didn't exist
at the start. Should be achievable in one focused session — if it isn't,
this is two sessions, split it.]

---

## Session Success Criteria

```
[ ] pnpm vitest run    → all green, count [same as / higher than] Session N-1 ([count])
[ ] pnpm tsc --noEmit  → zero TypeScript errors
[ ] pnpm lint          → zero errors, zero warnings
[ ] [pnpm dev / manual verification specific to this session's deliverable]
[ ] [Any session-specific structural requirement — e.g. "no imports from X in Y"]
```

---

## Tasks — Execute in This Order

[Number each task. For logic-layer tasks (state, pure functions, services),
require TDD: write the failing test first, confirm it fails for the right
reason, then implement. For rendering/UI-layer tasks that can't be unit
tested, use Spec-Driven implementation instead: build directly against the
architecture doc section named in the task, and verify via the Manual
Verification Script below — do not invent tests to hit a coverage number.]

### TASK 1 — [Task name]

[What to build, referencing exact interfaces/types/sections from
docs/architecture.md rather than re-describing them inline.]

**Verify:** [exact command] passes/shows [exact expected result].

### TASK 2 — [Task name]

...

---

## Manual Verification Script

[This section is mandatory for any session with user-facing or visual
output. It exists because green tests and clean lint do not guarantee the
feature actually works when a human opens a browser — this has bitten
this project before. Be concrete: exact ports, exact tabs, exact clicks,
exact expected outcomes, and which console messages are safe to ignore
(browser extensions, known framework warnings) vs. which indicate a
real problem.]

**Setup:**
```bash
[Exact commands, exact order, exact terminals needed]
```

**Steps:**
```
1. [Exact action] → [exact expected visual/console/network result]
2. [Exact action] → [exact expected result]
...
```

**Known-safe console noise (ignore these):**
```
[List anything expected from browser extensions, WebGL/Firefox quirks, etc.
 specific to this project — update this list as new false positives are found.]
```

**If something doesn't match:** stop, do not proceed to the next task,
report the exact discrepancy.

---

## End of Session — Final Checklist

```
[ ] All Session Success Criteria above pass
[ ] Manual Verification Script completed with no unexpected console/network errors
[ ] PROJECT_CONTEXT.md dev state updated
[ ] docs/lessons-learned.md updated if any non-trivial bug, deviation, or
    decision was made this session (one line — see file for format)
[ ] No console.log statements left in committed code (grep before finishing)
[ ] No @ts-expect-error / @ts-ignore without an inline comment explaining why
```

**Report format:**
- Files created / modified
- Test count: Session N-1 ([count]) → Session N total
- Manual verification result (what was actually observed, not assumed)
- Deviations from docs/architecture.md, with reasoning
- Any new lessons-learned.md entries added
- Blockers or open questions for Session N+1

---

## Next Session Preview

[Brief — what Session N+1 will cover, so context carries forward even
before that prompt is written.]
