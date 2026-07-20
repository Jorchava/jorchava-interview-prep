# Lessons Learned

> One line per entry. Append only — never delete or rewrite history here.
> Filter for signal: technical decisions, bugs whose root cause wasn't
> obvious, and mistakes worth not repeating. Not a changelog — skip routine
> feature additions with no surprise attached.
>
> Format: `[session] — [what happened] → [decision/fix] (commit: <hash-or-ref>)`
>
> Update this at the end of any session where something non-trivial broke,
> was fixed, or changed direction. This is required, not optional — see
> "End of Session — Final Checklist" in the session prompt template.

---

## Format Reference

Good entry (specific, actionable, has the "why"):
```
Session 3 — Vue watcher fired before async spin() set lastResult, silently
skipping startSpin() → fixed by watching [phase, lastResult] tuple with a
spinStarted flag; tests couldn't catch this because pixi.js mock made the
async timing invisible to Vitest. (commit: a3f9c21)
```

Bad entry (too vague to prevent a repeat):
```
Session 3 — Fixed a bug in GameCanvas.
```

---

## Entries

<!-- Add new entries below this line, newest at the bottom -->
