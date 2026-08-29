# Architecture: Senior Frontend Interview Master Course

> Single source of truth for the content spec. Update this when the
> structure changes — never let `book/` content and this doc drift apart.

---

## 1. Project Overview

A private interview-prep reference, generated session by session, where
each session produces one chain of connected concepts at full six-part
depth. See `docs/product-brief.md` for the full pitch.

---

## 2. Goals

- Cover all 17 modules (see `docs/roadmap.md`) at senior/staff depth
- Every topic follows the six-part structure (Section 4), or the named
  exception format for Modules 14/15/17
- Content stays internally consistent — cross-references resolve to real
  files, no contradicting explanations of the same concept across chains

---

## 3. Non-Goals

See `docs/product-brief.md` Non-Goals. Additionally: no attempt to be
framework-exhaustive outside Vue/Nuxt (React is interview-sufficient
only), and no assumption of hardcore-studio-specific game context
(networking/netcode, platform certification, etc.) — Module 13 targets
general frontend roles where PixiJS is a differentiator.

---

## 4. Specification

### The Six-Part Structure

Applies to Modules 1-13 and 16. Every topic (or chain of topics, for a
single session) covers:

**Part 1 — Theory.** What it is, why it exists, how it works, the
tradeoffs, where it shows up in real production code. A senior engineer's
mental model, not a dictionary definition.

**Part 2 — Interview Answer.** Exactly what to say out loud. 200-450
words (roughly 1-3 minutes at natural speaking pace), written to be read
aloud — contractions fine, no bullet points, ends on a concrete detail
rather than a vague summary sentence.

**Part 3 — Whiteboard / Live Coding.** A realistic example an interviewer
would actually ask, solved, with the reasoning narrated the way you'd
narrate it live. Every code sample must be syntactically valid and
mentally traced (or actually run) before being included.

**Part 4 — Follow-Up Questions.** The deeper questions a real interviewer
asks next — because they always do. Real questions with real answers, not
"be ready for follow-ups."

**Part 5 — Common Mistakes.** What a junior/mid answer sounds like for
this exact question, directly contrasted with what a senior answer sounds
like. See `AGENTS.md` Content Appendix for the general junior-vs-senior
tell table this section draws from.

**Part 6 — Production Examples.** How this shows up in a large-scale
frontend or web-game codebase working across multiple teams. Specific —
name the kind of system, the kind of constraint, the kind of tradeoff a
team actually hit. Not "imagine an e-commerce site."

### Exceptions to the Six-Part Structure

**Module 14 (System Design):** clarify requirements → high-level design
→ deep dive on 2-3 components → tradeoffs/scaling → follow-ups. The
whiteboard section *is* the entire format — there's no separate theory
phase.

**Module 15 (Live Coding):** problem statement → constraints → solution
walkthrough → complexity analysis → edge cases/variations → common
mistakes. More atomic than a concept chain — effectively Parts 3-5 alone,
without Parts 1/2/6.

**Module 17 (Behavioral):** STAR (Situation/Task/Action/Result), with
senior-specific framing — ownership language, cross-team stakes, judgment
under ambiguity — instead of generic STAR coaching.

### The Chain Concept

A session covers one chain: 1-3 core topics that get full six-part
treatment, plus supporting concepts that connect them (explained in
service of the core topics, not independently re-derived). Some
supporting concepts also stand alone elsewhere in the roadmap as their
own core topic — when that happens, cross-reference the other session's
file path rather than duplicating the explanation.

---

## 5. Content Architecture

### 5.1 Content Model

Three layers, mirroring the framework's usual logic/state/rendering
split:

```
docs/          → governance + spec (this file, product-brief, roadmap)
sessions/      → prompts that produce content — the "how it gets built"
book/          → the actual output — the "what got built"
```

`book/` content should never need to reference `sessions/` to be
understood standalone — a session prompt is a build instruction, not
part of the finished chapter.

### 5.2 Directory Structure

```
senior-fantastic-goggles/
├── docs/
│   ├── product-brief.md
│   ├── architecture.md          ← this file
│   ├── roadmap.md               ← full session backlog, tracked
│   └── lessons-learned.md       ← one line per non-trivial format/voice
│                                    decision (unchanged from template)
├── sessions/
│   ├── session-prompt-template.md
│   └── prompts/
│       ├── session-01-execution-context-callstack-scope.md
│       └── ...
├── book/
│   ├── 01-javascript-mastery/
│   │   ├── 01-execution-context-callstack-scope.md
│   │   ├── 02-closures-arc.md
│   │   └── ...                  ← locally numbered within the module
│   ├── 02-html-mastery/
│   ├── ...
│   ├── 14-system-design/
│   ├── 15-live-coding/
│   ├── 16-ai-assisted-development/
│   └── 17-behavioral/
├── AGENTS.md
├── PROJECT_CONTEXT.md
├── SKILLS.md
└── README.md
```

**Numbering convention:** `book/` files are numbered locally within their
module folder (01, 02, 03...). `sessions/prompts/` files use the global
session number from `docs/roadmap.md` (Session 1 through 97). The two
numbers only coincide for Module 1.

`.gitignore`, `.github/workflows/`, `config/`, `mcp/`, and
`scripts/start-session.sh` are unchanged from the template — the
branch-per-session workflow applies identically to a content session as
to a code session.

---

## 6. Quality Verification Strategy

No automated test suite applies to written content, so verification
splits differently than the template's TDD/spec-driven split:

| What | How |
|---|---|
| Structural compliance (all six parts present, or correct exception format) | Pre-Completion Checks in `SKILLS.md`, checked every session |
| Technical accuracy | Verify framework/API claims against current docs before stating them as fact — see `SKILLS.md` Documentation Verification |
| Voice/depth (senior, not junior) | Checked against the junior-vs-senior tell table in `AGENTS.md` Content Appendix |
| Cross-session consistency | Cross-references must resolve to real file paths; no two chains may define the same concept differently |
| Human review | Branch-per-session + PR review, unchanged from the template — this is the actual quality gate, not automation |
| Sessions run in batches via `scripts/run-module.sh`, one git branch and one PR per module rather than per session — the mechanism behind the module-level checkpoint | It hard-stops on failing examples/ tests, an unresolved VERIFY flag, or a roadmap checkbox that wasn't flipped.

---

## 7. Quality Targets

| Target | Value |
|---|---|
| Part 2 (Interview Answer) length | 200-450 words |
| Session scope | 1-3 core topics at full depth per session — if it needs more, split into two sessions |
| Total sessions | 97 (see `docs/roadmap.md`) |
| Unresolved `<!-- VERIFY -->` flags at session end | 0 — resolve or explicitly carry forward in Known Issues |

---

## 8. Assets and Credits

No third-party assets currently in use. If diagrams, sprite/game assets,
or figures are added later, list sources and licenses here.
