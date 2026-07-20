# Personal Agentic Dev Framework

A reusable governance and workflow system for building projects with
AI coding agents (Claude, DeepSeek, or any model via Open Code / similar
tools), refined across real projects rather than designed in the abstract.

This is not a code framework — it produces no runtime dependency. It's a
set of documents and templates that make an AI agent behave consistently,
safely, and transparently across sessions and across whichever model is
currently doing the work.

---

## Core Design Principle

Every governance file splits into two parts:

- **Core** — model-agnostic, stack-agnostic. Bug reproduction requirements,
  escalation protocol, accessibility baseline, testing methodology,
  anti-overengineering. Doesn't change per project.
- **Stack Appendix** — the one section allowed to be stack-specific
  (framework version constraints, file structure conventions, output
  contracts). Replaced entirely when the stack changes.

This split is what makes the system reusable rather than a one-off set of
notes for a single past project.

---

## Using This as a New Project

1. Click **Use this template** on GitHub (this repo is configured as a
   template repository), or copy the contents into a fresh repo.
2. Fill in, in this order:
   - `docs/product-brief.md` — what is this, who's it for, what does it
     demonstrate, smallest demonstrable version
   - `docs/architecture.md` — technical spec, layer model, testing strategy
   - `PROJECT_CONTEXT.md` — links back to both, plus stack decisions and
     the non-negotiables priority order
   - `AGENTS.md` — fill in Project Identity & Type, write the Stack Appendix
   - `SKILLS.md` — fill in the CLI Skills section and Stack Appendix
   - `.gitignore` — from `.gitignore.template`, adjust the local-data
     filename if your project's demo backend uses something other than
     `db.json`
   - `.github/workflows/ci.yml` — from the template, rename script commands
     if they differ from the defaults
   - `opencode.json` (or your agent tool's equivalent config) — from the
     template, fill in local machine paths, decide whether to enable any
     MCP servers you actually have set up
3. Write Session 1's prompt from `sessions/session-prompt-template.md`.
4. Begin.

---

## File Manifest

| File | Public or private by default | Purpose |
|------|------------------------------|---------|
| `README.md` | Public | The project's own README (not this framework's) |
| `LICENSE` | Public | |
| `CONTRIBUTING.md` | Public | |
| `docs/product-brief.md` | Public | The anti-"tutorial clone" defense — what this demonstrates and why |
| `docs/architecture.md` | Public | Technical spec, single source of truth |
| `docs/deployment-notes.md` | Public | Deploy targets, graceful degradation pattern |
| `AGENTS.md` | Private by default | Behavioral governance |
| `SKILLS.md` | Private by default | Approved commands and patterns |
| `PROJECT_CONTEXT.md` | Private by default | Living project state |
| `docs/lessons-learned.md` | Private by default, judgment call to publish | One-line-per-entry mistake/decision log |
| `docs/<stack>-patterns.md` | Private by default | Verified library patterns for this stack |
| `sessions/` | Private by default | Session prompts, one per development session |
| `opencode.json` | Private by default (commit `.example` instead) | MCP server configuration |
| `.github/workflows/ci.yml` | Public | CI pipeline |

---

## What This Framework Assumes

- You work solo across many personal/portfolio projects and want
  consistent behavior without re-deriving it each time.
- You use a model-switching agentic coding tool (sessions may run on
  different models over time — the governance files, not memory, carry
  continuity).
- Manual review checkpoints (PR review, session-boundary confirmation)
  are a feature, not friction to automate away.

If any of those stop being true for a given project, adjust accordingly —
this is a starting point, not a constraint.
