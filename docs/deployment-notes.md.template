# Deployment Notes

> How this project deploys, and how it behaves when a backend dependency
> isn't available (static-only hosting). Generalized from a pattern that
> worked well: a service interface with graceful, honest degradation rather
> than a broken UI or a raw error.

---

## Deploy Targets

| Environment | What it needs | What's affected if the backend is absent |
|-------------|---------------|-------------------------------------------|
| Local dev | Full backend running locally | Nothing — everything works |
| Static-only production (e.g. Netlify/Vercel with no backend deployed) | Nothing extra | [Name the specific feature(s) that degrade] |
| Static + deployed backend | One environment variable pointing at the backend URL | Nothing — full functionality |

---

## The Graceful Degradation Pattern

Any feature depending on a backend should:

1. Be built behind a service interface (see `docs/architecture.md` §7),
   so a local/demo implementation and a production implementation are
   interchangeable without touching calling code.
2. Detect at runtime whether a backend is actually configured — typically,
   whether an environment variable pointing at the backend's URL is set.
3. If not configured, **skip the network call entirely** and show an
   honest, intentional "this needs a backend" notice with a link to setup
   instructions — never a raw network error, and never a silently broken
   UI element that looks like it should have worked.
4. Everything else in the app continues to function normally.

This is a stronger signal in a portfolio review than pretending a demo
backend is a production one, or than the feature simply not existing on
the live deploy with no explanation.

---

## Environment Variables

| Variable | Purpose | Set where |
|----------|---------|-----------|
| `[VITE_API_BASE_URL or equivalent]` | [Points the frontend at a real backend] | Hosting provider's dashboard, never committed |

Add a matching entry to `.env.example` (committed, no real value) for every
real environment variable (gitignored, real value) the project uses.

---

## Deploy Checklist

```
[ ] Production build runs clean locally (build + preview commands)
[ ] Environment variables set in hosting provider dashboard, not committed
[ ] Backend-dependent feature shows the graceful offline notice when no
    backend URL is configured — verify this, don't assume it
[ ] No console errors on a fresh load of the deployed URL
[ ] README updated with the live URL, in the top badges/links and in
    Getting Started
```
