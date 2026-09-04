# Roadmap

> The full session backlog. Check off sessions as `book/` content is
> completed and reviewed (PR merged, not just drafted). Update
> `PROJECT_CONTEXT.md` Current Development State to point here rather
> than duplicating this list.
>
> This is a first pass. Chains can be re-split if a session turns out
> bigger or smaller than expected — see `AGENTS.md` Escalation Protocol
> ("always ask before reordering/renumbering once content exists").

## Summary

| # | Module | Sessions | Count |
|---|---|---|---|
| 1 | JavaScript Mastery | 1-8 | 8 |
| 2 | HTML Mastery | 9-14 | 6 |
| 3 | CSS Mastery | 15-21 | 7 |
| 4 | Browser | 22-26 | 5 |
| 5 | Performance | 27-31 | 5 |
| 6 | Accessibility | 32-37 | 6 |
| 7 | Vue | 38-43 | 6 |
| 8 | React | 44-47 | 4 |
| 9 | TypeScript | 48-51 | 4 |
| 10 | Testing | 52-56 | 5 |
| 11 | Architecture | 57-63 | 7 |
| 12 | Security | 64-67 | 4 |
| 13 | Games | 68-74 | 7 |
| 14 | System Design | 75-80 | 6 |
| 15 | Live Coding | 81-89 | 9 |
| 16 | AI-Assisted Development | 90-91 | 2 |
| 17 | Behavioral | 92-97 | 6 |
| | **Total** | | **97** |

Pilot recommendation: run **Session 2** (the closures arc) first — it's
`docs/product-brief.md`'s Smallest Demonstrable Version and the clearest
test of whether the six-part format actually reads as senior.

---

## Module 1 — JavaScript Mastery (Sessions 1-8)

- [x] **Session 1** — Execution context, call stack, hoisting, scope, `this`
- [x] **Session 2** — Closures → lexical environment → GC → private state → module pattern *(pilot candidate)*
- [x] **Session 3** — Currying → memoization → closures in practice → React hooks / Vue composables
- [x] **Session 4** — Prototypes → classes → inheritance
- [x] **Session 5** — Event loop → microtasks → macrotasks
- [x] **Session 6** — Promises → async/await → error handling
- [x] **Session 7** — Iterators → generators → symbols → Map/WeakMap/Set
- [x] **Session 8** — Destructuring/spread/rest → ES modules

## Module 2 — HTML Mastery (Sessions 9-14)

- [x] **Session 9** — Semantic HTML → accessibility/SEO implications
- [x] **Session 10** — Forms → validation patterns → accessible forms
- [x] **Session 11** — Tables → ARIA basics in HTML context
- [x] **Session 12** — Browser parsing → DOM construction
- [x] **Session 13** — Shadow DOM → web components → encapsulation
- [x] **Session 14** — Events → event delegation → bubbling/capturing

## Module 3 — CSS Mastery (Sessions 15-21)

- [x] **Session 15** — Cascade → specificity → inheritance
- [x] **Session 16** — Box model → positioning schemes
- [x] **Session 17** — Flexbox → Grid → when to use which
- [x] **Session 18** — Animations → transforms → transitions → GPU/performance
- [x] **Session 19** — Container queries → modern CSS → logical properties
- [x] **Session 20** — CSS variables → theming at scale
- [x] **Session 21** — Architecture: BEM → SCSS → scalable CSS in large codebases

## Module 4 — Browser (Sessions 22-26)

- [ ] **Session 22** — DNS → TCP → TLS handshake → HTTPS
- [ ] **Session 23** — HTTP/1.1 → HTTP/2 → HTTP/3 → why they changed
- [ ] **Session 24** — Caching → cookies → storage (local/session/IndexedDB)
- [ ] **Session 25** — Rendering pipeline: layout → paint → composite → GPU
- [ ] **Session 26** — Reflow → repaint → critical rendering path

## Module 5 — Performance (Sessions 27-31)

- [ ] **Session 27** — Core Web Vitals (LCP/INP/CLS) → measurement → improvement levers
- [ ] **Session 28** — Lazy loading → images → fonts → resource hints
- [ ] **Session 29** — Code splitting → bundles → tree shaking
- [ ] **Session 30** — Compression → caching strategies (HTTP + app-level)
- [ ] **Session 31** — Memory leaks → profiling → Chrome DevTools workflow

## Module 6 — Accessibility (Sessions 32-37)

- [ ] **Session 32** — WCAG levels → ARIA roles/states/properties → when not to use ARIA
- [ ] **Session 33** — Screen readers: JAWS/NVDA/VoiceOver/TalkBack → real differences
- [ ] **Session 34** — Keyboard navigation → focus management → focus traps
- [ ] **Session 35** — Dialogs/modals → complex widget overview
- [ ] **Session 36** — Complex ARIA widget patterns (combobox, tabs, accordion) per APG
- [ ] **Session 37** — Testing: Axe → Lighthouse → accessibility tree → manual audit process

## Module 7 — Vue (Sessions 38-43)

- [ ] **Session 38** — Composition API → reactivity system internals (proxies, refs)
- [ ] **Session 39** — Computed → watch → watchEffect → when to use which
- [ ] **Session 40** — Pinia → state management patterns at scale
- [ ] **Session 41** — Nuxt → SSR → hydration → rendering modes
- [ ] **Session 42** — Lifecycle hooks → component design patterns
- [ ] **Session 43** — Vue performance: reactivity overhead, v-memo, async components

## Module 8 — React (Sessions 44-47)

> Kept lean — interview-sufficient, not exhaustive.

- [ ] **Session 44** — Hooks fundamentals → rules of hooks → common mistakes
- [ ] **Session 45** — Fiber → reconciliation → rendering model
- [ ] **Session 46** — State/refs/context → when to use which
- [ ] **Session 47** — memo/effects → concurrent rendering → Suspense

## Module 9 — TypeScript (Sessions 48-51)

- [ ] **Session 48** — Generics → utility types (Partial, Pick, Omit, etc.)
- [ ] **Session 49** — Mapped types → conditional types → `infer` keyword
- [ ] **Session 50** — Type inference → narrowing → discriminated unions
- [ ] **Session 51** — Interfaces vs type aliases → module/namespace patterns

## Module 10 — Testing (Sessions 52-56)

- [ ] **Session 52** — Test pyramid → unit vs integration vs E2E → where to invest
- [ ] **Session 53** — Jest/Vitest → mocking strategies → test doubles
- [ ] **Session 54** — Testing Library philosophy → testing behavior, not implementation
- [ ] **Session 55** — Playwright/Cypress → E2E strategy at scale
- [ ] **Session 56** — TDD in practice → when it helps, when it doesn't

## Module 11 — Architecture (Sessions 57-63)

- [ ] **Session 57** — Component design → composition vs inheritance → folder structure at scale
- [ ] **Session 58** — SOLID → dependency inversion → design patterns in frontend
- [ ] **Session 59** — State management philosophy → local vs global vs server state
- [ ] **Session 60** — Microfrontends → module federation → team boundaries
- [ ] **Session 61** — Design systems → component APIs → Storybook → design tokens
- [ ] **Session 62** — Data fetching/real-time: REST vs GraphQL → caching (React Query/TanStack) → WebSockets/SSE
- [ ] **Session 63** — Build tooling: Vite/Webpack/esbuild → monorepos (Nx/Turborepo) → CI/CD for frontend

## Module 12 — Security (Sessions 64-67)

- [ ] **Session 64** — XSS → CSP → sanitization
- [ ] **Session 65** — CSRF → CORS → same-origin policy
- [ ] **Session 66** — Auth flows → cookies vs localStorage/sessionStorage for tokens
- [ ] **Session 67** — Client-side validation → why it's never sufficient

## Module 13 — Games (Sessions 68-74)

> Calibrated to general frontend roles where PixiJS/game skills are a
> differentiator, not hardcore-studio-specific context.

- [ ] **Session 68** — Canvas vs WebGL vs PixiJS → rendering fundamentals
- [ ] **Session 69** — Game loop → delta time → fixed vs variable timestep
- [ ] **Session 70** — Sprites → animation → texture atlases
- [ ] **Session 71** — Object pooling → memory management for real-time rendering
- [ ] **Session 72** — Collision detection → spatial partitioning basics
- [ ] **Session 73** — WebGL/shaders → when PixiJS abstracts vs when you drop to raw WebGL
- [ ] **Session 74** — Performance optimization → profiling a canvas/WebGL app

## Module 14 — System Design for Frontend (Sessions 75-80)

> Exception format — see `docs/architecture.md` Section 4.

- [ ] **Session 75** — Design an image editor
- [ ] **Session 76** — Design a chat application
- [ ] **Session 77** — Design YouTube (video platform)
- [ ] **Session 78** — Design Figma (collaborative canvas)
- [ ] **Session 79** — Design Google Maps
- [ ] **Session 80** — Design Trello (drag-and-drop board)

## Module 15 — Live Coding (Sessions 81-89)

> Exception format — see `docs/architecture.md` Section 4.

- [ ] **Session 81** — Debounce → throttle → rate-limiting patterns
- [ ] **Session 82** — Promise.all → Promise.race → custom promise utilities
- [ ] **Session 83** — Deep clone → flatten array → data structure manipulation
- [ ] **Session 84** — Virtual DOM (simplified implementation)
- [ ] **Session 85** — Carousel → tabs (UI component implementation)
- [ ] **Session 86** — Infinite scroll → autocomplete (async UI patterns)
- [ ] **Session 87** — Chess board → Kanban (grid/drag-drop logic)
- [ ] **Session 88** — Memory game → Snake (game logic in vanilla JS/canvas)
- [ ] **Session 89** — Mini Pixi engine (capstone — ties to Module 13)

## Module 16 — AI-Assisted Development (Sessions 90-91)

- [ ] **Session 90** — Your actual workflow — what you always review, what you never blindly accept
- [ ] **Session 91** — Where AI genuinely helps (docs, refactoring, test scaffolding, prototyping) vs. where it doesn't (architecture decisions, security-sensitive code)

## Module 17 — Behavioral (Sessions 92-97)

> Exception format — see `docs/architecture.md` Section 4.

- [ ] **Session 92** — STAR framework → senior-specific framing (ownership > task completion)
- [ ] **Session 93** — Leadership → mentoring stories
- [ ] **Session 94** — Conflict → cross-team/cross-discipline disagreement
- [ ] **Session 95** — Failure → hardest bugs → production outages
- [ ] **Session 96** — Architecture decisions → tradeoffs you owned
- [ ] **Session 97** — Accessibility wins — a genuine differentiator story
