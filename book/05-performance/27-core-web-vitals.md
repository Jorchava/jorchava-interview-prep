# Session 27 — Core Web Vitals: LCP, INP, and CLS

> **Module 5 — Performance.** Session 1 of 5 — first session of Module 5.
> **Chain:** LCP (loading) → INP (responsiveness) → CLS (visual stability) → measurement (field / lab / programmatic).
> This session stands on Module 4's back half. Session 26's critical rendering path ends at First Meaningful Paint, and its follow-up already named what replaced FMP as a reported metric: LCP is measured through that exact path, delayed by the same render-blocking CSS and parse-blocking scripts (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`). CLS scores unintended re-runs of Session 25's Stage 6 (Layout), with Session 26's propagation model determining how much of the viewport a shift impacts. INP is Session 25's compositor/main-thread separation made measurable: long tasks blocking the main thread are the input delay and presentation delay INP observes (`book/04-browser/25-rendering-pipeline.md`). No prior Module 5 file exists — this session establishes the module's verification convention, below.

<!-- Module 5 convention (established this session): unlike Modules 2-4, some
claims in this module ARE spec- or runtime-verifiable, and those are verified
before they are stated. Verified this session: the three metric threshold
sets against Google's public threshold definition (web.dev); the CLS score
formula and the 500ms hadRecentInput exclusion window against the WICG Layout
Instability spec; the LCP candidate element list and the candidate-stops-at-
input rule against the W3C Largest Contentful Paint spec; INP's three phases
and the March 12, 2024 FID replacement against web.dev's INP documentation;
PerformanceObserver.observe({type, buffered}) against the W3C Performance
Timeline spec and exercised against a Node runtime (mark entries replayed);
PerformanceEventTiming duration/processingStart/processingEnd semantics
against the W3C Event Timing spec (duration = input to next paint, 8ms
granularity; default buffering threshold 104ms, durationThreshold minimum
16ms); scheduler.yield() behavior against the Chrome team's documentation
and MDN; web-vitals onLCP/onINP/onCLS usage against the library's own
documentation via Context7. Browser- or tool-observable only, therefore
ILLUSTRATIVE: DevTools panel behavior, Lighthouse scoring, CrUX / PageSpeed
Insights / Search Console dashboards, and any rendered metric value. No
<!-- VERIFY --> flags remain in this file. This convention applies to
Sessions 27-31. -->

---

## Topic 1 — Largest Contentful Paint (LCP)

### Part 1: Theory

LCP measures loading performance: the render time of the largest image or text block visible in the viewport, measured from when the user first navigates to the page (navigation start / time origin). Where First Contentful Paint asks "did anything appear," LCP asks "did the main thing appear" — and it's one of the three Core Web Vitals, the current set being LCP, INP, and CLS (FID is retired — Topic 2 covers the replacement).

**What counts as an LCP candidate** (per the W3C Largest Contentful Paint spec, verified this session):

- `<img>` elements — the first painted frame for animated formats like GIF.
- `<image>` elements inside an `<svg>` element.
- `<video>` elements via the poster image (poster load time or first frame, whichever is earlier); as of August 2023, the first painted frame of an autoplaying video also counts.
- Elements with a background image loaded through CSS `url()` — not a gradient.
- Block-level elements containing text nodes or inline-level text children — the smallest rectangle containing the text, no margins, padding, or border.

What does **not** count: an `<svg>` element itself (inline SVG graphics are not candidates — the Instagram-logo case web.dev documents), a `<canvas>` element, CSS gradients, and — in Chromium's contentful heuristics — elements at `opacity: 0`, elements covering the full viewport (treated as background), and low-entropy placeholder images. A background image is only a candidate if it came from `url()`; a gradient painted in its place never is.

**The candidate changes while the page loads.** The browser tracks the largest element painted so far and queues a new `largest-contentful-paint` entry every time a bigger one appears. It stops accepting new candidates once the user scrolls or interacts — input likely introduces content the page didn't choose — so the final LCP value is the last entry the observer saw. A hero heading may win at 400ms, then lose to a product image that finishes decoding at 1.8s; that image is the reported LCP.

**The thresholds are exact** (75th percentile of real-user field data): good ≤ 2.5s, needs improvement 2.5s–4s, poor > 4s.

**Improvement levers follow the metric's anatomy.** LCP time decomposes into time to first byte, resource load delay (discovery to fetch start), resource load duration, and element render delay. TTFB: serve the document from a CDN close to the user. Discovery and duration: `rel=preload` the LCP image so the parser doesn't find it late, compress and size it correctly, serve efficient formats (WebP/AVIF). Render delay: remove the render-blocking CSS and parse-blocking scripts — Session 26's two blocking points, sitting directly in front of the paint LCP measures.

---

### Part 2: Interview Answer

Largest Contentful Paint measures how fast the main content shows up — the render time of the largest image or text block visible in the viewport, from the moment the user navigates to the page. The thresholds are exact: good is 2.5 seconds or less, needs improvement is 2.5 to 4 seconds, poor is over 4, judged at the 75th percentile of real users.

What counts as the LCP element matters more than people expect. An `<img>`, an `<image>` inside an SVG, a video's poster frame, a block-level element full of text, and a background image loaded through CSS `url()` — those are the candidates. An inline `<svg>` graphic is not, a `<canvas>` is not, and a CSS gradient is not. The candidate can also change while the page loads: the browser tracks the largest element painted so far and emits a new entry each time a bigger one wins, then stops updating once the user scrolls or interacts. The final LCP value is that last entry.

The levers follow the metric's anatomy. LCP time breaks into time to first byte, resource discovery delay, resource download, and element render delay. For TTFB, put the origin behind a CDN. For discovery, preload the LCP image so the parser doesn't find it under a pile of CSS, and serve it compressed in WebP or AVIF at the right size. For render delay, remove what blocks paint — render-blocking stylesheets and parse-blocking scripts — which is exactly the critical rendering path model from Session 26. The senior framing: LCP isn't "loading speed," it's one identified element completing one identified path, and every lever targets a named segment of it.

---

### Part 3: Whiteboard / Live Coding

**Observing LCP — the last candidate before input wins:**

```typescript
let lcpEntry: PerformanceEntry | null = null;

const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  // Candidates arrive in ascending size order; the last one is current.
  lcpEntry = entries[entries.length - 1] ?? lcpEntry;
});
// buffered: true replays candidates queued before this script ran.
lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

function sendToAnalytics(metric: { lcp: number }): void {
  console.log(metric); // replace with your RUM transport
}

// LCP finalizes on first interaction (scroll/input stops new candidates)
// or when the page is hidden — report at one of those points, then stop.
function reportLCP(): void {
  if (lcpEntry !== null) {
    sendToAnalytics({ lcp: lcpEntry.startTime });
  }
  lcpObserver.disconnect();
}
window.addEventListener("pointerdown", reportLCP, { once: true });
window.addEventListener("pagehide", reportLCP);
```

<!-- ILLUSTRATIVE: The observe({type, buffered}) signature is W3C Performance
Timeline and was exercised against a Node runtime this session (buffered mark
entries replay correctly); the largest-contentful-paint entry type itself is
browser-only (Chromium), so this snippet runs in a browser, not in-session.
entry.startTime is relative to time origin — the LCP value candidates report
against navigation start. Reporting on pointerdown (or scroll/keydown/pagehide)
mirrors when the spec stops accepting candidates. -->

**The four LCP levers mapped to subparts:**

```
LCP = TTFB + resource load delay + resource load duration + element render delay
      ────    ────────────────────   ─────────────────────   ────────────────────
Slow origin   Late discovery of      Slow/huge LCP bytes     Render-blocking CSS,
server; no    the LCP resource      (no preload; PNG         parse-blocking JS
redirects;    (found late in CSS    instead of WebP/AVIF)    before the element
CDN edge      or deep in HTML)                               (Session 26 blockers)

Fix: CDN,    Fix: rel=preload      Fix: compress, resize,   Fix: inline critical
fast TTFB     in <head>             modern formats           CSS, defer/async JS
```

<!-- ILLUSTRATIVE: Subpart names (timeToFirstByte, resourceLoadDelay,
resourceLoadDuration, elementRenderDelay) match the web-vitals attribution
build's LCP breakdown, verified against the library docs via Context7. The
four-way mapping is diagnostic, not a benchmark — measure your own trace
before optimizing any segment. -->

**The fix in markup — preload + dimensions + off-blocking scripts:**

```html
<head>
  <meta charset="utf-8" />
  <title>Product Page</title>

  <!-- Critical CSS inlined: removes the stylesheet fetch from the path -->
  <style>
    .hero { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .hero-title { font-size: 32px; line-height: 1.15; }
    /* above-the-fold rules only... */
  </style>

  <!-- LCP image: fetched before the parser reaches its tag or its CSS -->
  <link rel="preload" href="hero.avif" as="image" type="image/avif" />

  <!-- Scripts off the rendering path (Session 12's defer/async) -->
  <script src="app.js" defer></script>
</head>
<body>
  <section class="hero">
    <h1 class="hero-title">Track every shipment</h1>
    <!-- Intrinsic size reserves the box: no late-image layout shift (Topic 3) -->
    <img src="hero.avif" width="960" height="720" alt="Map view of active routes" />
  </section>
</body>
```

<!-- ILLUSTRATIVE: The preload+dimensions+defer pattern is the standard LCP
markup configuration, consistent with Session 26's CRP optimizations — not
re-derived here, placed in service of the LCP metric. type="image/avif" tells
the browser the format so the preloader doesn't double-fetch a decode fallback;
pair with a <picture> fallback in real builds when AVIF support is a concern. -->

---

### Part 4: Follow-Up Questions

**Q: How is LCP different from First Contentful Paint — and is FMP still a thing?**

FCP is when the first content of *any* kind paints — a header, a spinner's sibling text, anything contentful. LCP is when the *largest* contentful element paints, which is much closer to when a user would say "the page loaded." First Meaningful Paint, the name Session 26's CRP sequence ends on, has largely retired as a reported metric — teams budget FCP and LCP now — but the sequence underneath didn't change: LCP elements paint through the same critical rendering path, delayed by the same two blocking points. FCP is the floor (something appeared); LCP is the ceiling of the load (the main thing appeared). A page can pass FCP and fail LCP easily — tiny text in the header paints early while a 2MB hero image drags the LCP out past 4 seconds.

**Q: My LCP element keeps changing between runs. Is the metric unstable?**

The metric is stable; your page's content order is what varies. The browser picks the largest viewport-visible candidate at each point in time and stops updating on scroll or input — so which element wins depends on paint order: what loaded from cache, what decoded first, whether the user scrolled early. In the lab you'll usually see the same winner every run; in the field, different visitors legitimately have different LCP elements (a returning user with a cached hero image may LCP on text instead). This is one of the documented reasons lab and field diverge (Topic 4) — and why diagnosing LCP means checking *which* element field data points at, not assuming the one your local run picked.

**Q: Does a CSS background-image count as LCP? What about a gradient?**

A background image loaded via `url()` counts; a gradient does not — gradients aren't fetched resources and aren't in the candidate list. Opacity-0, full-viewport-covering, and low-entropy placeholder images are also filtered out by Chromium's contentful heuristics. The practical bite: background images are referenced from CSS, so the browser can't discover them until the stylesheet has arrived and been parsed — the discovery gap Session 26's preload optimization exists to close. If your LCP candidate is a CSS background, `rel=preload` it in the HTML head; better still, if it's genuinely content, make it a real `<img>` so dimensions, preload scanning, and lazy-loading semantics all apply.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"LCP is basically how fast the page loads — get the hero image on a CDN, minify everything, and aim for under 2.5 seconds in Lighthouse."

**Why this misses the point:** The junior answer treats LCP as an atmosphere ("basically how fast the page loads") instead of a measurement of one identified element through one identified path. It never names what qualifies as a candidate — the student can't audit which element on their page the browser is actually scoring, and doesn't know that an inline `<svg>` or canvas won't count while a `url()` background will. The candidate-changes-over-time behavior is absent, so they can't explain why field runs disagree or when the value freezes. There's no threshold precision (the needs-improvement band matters for triage), and no model of *which part of the critical rendering path* governs the number — "minify everything" is a guess, not a response to TTFB vs. discovery vs. render-delay segments.

**Senior answer:**
"LCP is the render time of the largest viewport-visible content element — `<img>`, SVG `<image>`, video poster, block-level text, or a `url()` background — from navigation start. Inline SVG, canvas, and gradients don't count. The browser emits a new candidate each time a bigger one paints and freezes the value once the user scrolls or interacts, so the last entry is the score. Thresholds: good ≤2.5s, needs improvement 2.5–4s, poor >4s at field p75. The levers map to the metric's four subparts: CDN for TTFB, `rel=preload` for discovery, compressed right-sized WebP/AVIF for download duration, and removing Session 26's render-blocking CSS and parse-blocking scripts for element render delay. I diagnose with the attribution breakdown — whichever segment is fat is the lever I pull."

**The tell:** The junior answer is a tip list keyed to a vague "loading speed" notion. The senior answer names the candidate element types and exclusions, the freeze-at-input rule, the exact three thresholds, and ties the improvement work to the CRP's specific blocking points rather than to generic minification.

---

### Part 6: Production Examples

A logistics marketplace's product detail page had a field LCP of 4.3s on mobile p75 while Lighthouse reported 1.9s. The CrUX-attributed LCP element was a CSS background image on the hero container — referenced only from a 180KB stylesheet that itself waited behind two parser-blocking scripts, so discovery couldn't even begin until roughly 1.6s in, and the image then downloaded unoptimized PNG at 900KB. The fix had three parts matching three subparts: the hero moved into a real `<img>` with width/height and a `srcset` in AVIF, the new image got `rel=preload` in the head, and the two scripts went `async`/`defer` per Session 12's decision rule so the stylesheet fetch wasn't queued behind parse stalls. Field LCP (image candidate) fell to 2.2s once the 28-day CrUX window rolled over — same content, same design, four seconds of stacked discovery-and-blocking removed from one element's path.

A subscription analytics dashboard reported LCP on the marketing homepage that stayed flat at 3.1s even after the team optimized every image — because the LCP candidate wasn't an image at all: it was the H1 plus hero paragraph block, delayed by element render delay, not resource load. The trace showed 900ms of render-blocking CSS (a 240KB monolith) and a synchronous config-gateway script halting the parser before the hero's DOM node existed. Inlining 8KB of critical above-the-fold CSS and deferring the gateway (which needed the DOM anyway, so `defer`, not `async`) cut render delay by 700ms; text LCP landed at 2.3s. The team's note in the postmortem: they'd spent two weeks optimizing the wrong subpart because they'd assumed LCP was an image problem — the attribution breakdown would have told them in one trace.

---

## Topic 2 — Interaction to Next Paint (INP)

### Part 1: Theory

INP measures responsiveness, and it is the youngest of the three Core Web Vitals: it replaced First Input Delay on March 12, 2024 (verified against web.dev's launch posts this session). FID is retired — historical context only, never a current metric. The replacement happened because FID had two structural gaps: it measured only the *first* interaction on the page, and it measured only the *input delay* portion of that interaction — the time before the event handler even started. A page could ace FID (fast first tap on an empty button) and feel terrible on every subsequent interaction.

**What INP measures:** the latency of qualifying interactions — taps, clicks, key presses (pointerdown/pointerdown-to-click sequences and keydown, per the Event Timing API's `interactionId` grouping) — across the entire page lifetime, reporting the longest observed interaction, sometimes ignoring outliers (web.dev's exact phrasing; field aggregation trims extremes). Scroll and zoom don't qualify. The metric is built on the Event Timing API: `PerformanceEventTiming.duration` runs from the input's `timeStamp` to the next rendering update after dispatch — input through next paint, at 8ms granularity (W3C Event Timing spec, verified this session). Default buffering only surfaces entries with duration ≥104ms; `durationThreshold` can go down to 16ms.

**The three phases** (web.dev's model, verified): *input delay* — physical input to event-handler start, usually caused by the main thread already running something else; *processing time* — your handlers executing (`processingStart` → `processingEnd`); *presentation delay* — style, layout, and paint running so the browser can present the next frame. Sum them and you have interaction-to-next-paint. FID measured only phase one, only once.

**The thresholds are exact** (field p75): good ≤ 200ms, needs improvement 200–500ms, poor > 500ms.

**The main-thread connection is the mechanism** — Session 25's architecture made measurable. JavaScript execution, style calculation, layout, and paint preparation all run on the main thread; the compositor thread assembles layers afterward but cannot present a frame the main thread hasn't prepared. A task over 50ms is a long task by spec: while it runs, input queues (input delay inflates), and after handlers finish, rendering queues behind whatever else is pending (presentation delay inflates). Non-preemptible JS is the whole story — run-to-completion means the browser waits.

**The levers:** break long tasks so input and rendering can interleave — `await scheduler.yield()`, the Prioritized Task Scheduling API's dedicated yielding function (Chrome 129+): it pauses your function and schedules the continuation *ahead of* other queued tasks, unlike `setTimeout(0)` which sends your work to the back of the queue (verified against Chrome's documentation and MDN this session; Chromium-only today, so feature-detect with a `setTimeout` fallback). Defer non-urgent work off the interaction path. Move pure computation to a Web Worker — it never touches the main thread, so it can't add input delay or processing time at all.

---

### Part 2: Interview Answer

INP is the responsiveness Core Web Vital, and it replaced First Input Delay in March 2024 — FID is retired, worth knowing only as history. FID had two blind spots: it looked at just the first interaction, and only at the input delay — the gap before your handler even started. A page could pass FID and still feel like mud on the tenth click. INP observes every tap, click, and key press across the page's lifetime and reports the longest one, outliers trimmed. Scroll and zoom don't count.

Every interaction it scores has three phases. Input delay: physical input to handler start — usually long because the main thread was busy. Processing time: your handlers running. Presentation delay: style, layout, and paint finishing so the browser can show the next frame. Good is 200 milliseconds or less, needs improvement is 200 to 500, poor is over 500 — at the 75th percentile of real users.

The lever that matters is main-thread availability, and it's Session 25's architecture showing up in a metric. JavaScript, style calculation, and layout all run on the main thread — a task over 50 milliseconds is a long task, and while it runs, input sits in the queue and the next frame can't be presented. So the fixes are about yielding: `await scheduler.yield()` to break long work into chunks, with the continuation prioritized ahead of new tasks — unlike `setTimeout(0)`, which throws your work to the back of the queue; defer anything non-urgent off the interaction path; push pure computation into a Web Worker where it never competes for the main thread at all. INP isn't "make clicks fast" — it's keep the main thread free, because all three phases pay for it.

---

### Part 3: Whiteboard / Live Coding

**The three phases decomposed from one Event Timing entry:**

```typescript
const eventObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceEventTiming[]) {
    const inputDelay = entry.processingStart - entry.startTime;
    const processing = entry.processingEnd - entry.processingStart;
    // duration = input to next rendering update (8ms granularity):
    // inputDelay + processing + presentation delay.
    const presentation = entry.duration - inputDelay - processing;
    // One interaction can span several entries (pointerdown, click...):
    // group by entry.interactionId before computing the interaction total.
    if (entry.interactionId !== 0) {
      console.log({ inputDelay, processing, presentation, duration: entry.duration });
    }
  }
});
// Default buffering only queues entries >=104ms; 16 is the minimum threshold.
eventObserver.observe({ type: "event", durationThreshold: 16, buffered: true });
```

<!-- ILLUSTRATIVE: PerformanceEventTiming field semantics verified against
the W3C Event Timing spec this session (duration = startTime to next
rendering update, rounded to 8ms — so `presentation` can be slightly off from
rounding; interactionId groups the events of one interaction, and is 0 for
non-qualifying events). The entry type itself is browser-only; this runs in
Chromium, not in-session. INP as *reported* takes the worst interaction
(outliers trimmed) — this snippet shows one entry's decomposition, not the
aggregation; the web-vitals library does the full aggregation (Topic 4). -->

**Breaking a long task — `scheduler.yield()` with fallback:**

```typescript
const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } })
  .scheduler;

async function yieldToMain(): Promise<void> {
  if (sched?.yield) {
    await sched.yield(); // prioritized continuation (Chromium 129+)
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // fallback
  }
}

function handleItem(item: string): void {
  // synchronous, CPU-bound work on one unit
  void item;
}

// 50ms = the long-task boundary; yield at least that often
async function processQueue(items: string[]): Promise<void> {
  let deadline = performance.now() + 50;
  for (const item of items) {
    handleItem(item);
    if (performance.now() >= deadline) {
      await yieldToMain(); // input handlers + rendering run during the gap
      deadline = performance.now() + 50;
    }
  }
}
```

<!-- ILLUSTRATIVE: The 50ms deadline matches the long-task definition; the
yield-with-fallback shape matches web.dev's optimize-long-tasks guidance.
scheduler.yield() is Chromium-only as of this writing (MDN: not Baseline) —
the feature-detect is mandatory, not stylistic. The continuation after
scheduler.yield() is prioritized ahead of newly queued similar tasks, which is
the documented difference from the setTimeout(0) fallback (verified against
Chrome's scheduler.yield post). Heavy *pure computation* that doesn't need
DOM access belongs in a Web Worker instead — no yield needed, main thread
untouched; yielding is for work that must run on the main thread. -->

**The INP fix shape — before and after on one handler:**

```typescript
// BEFORE: click handler runs a 280ms synchronous filter — INP pays
// input delay (queued) + 280ms processing + presentation. Field INP ~340ms.
button.addEventListener("click", () => {
  const rows = filterRows(allRows, query); // 50k rows, blocking
  renderTable(rows);
});

// AFTER: yield during the filter so input/rendering interleave;
// offload the pure filtering to a Worker where possible.
button.addEventListener("click", async () => {
  const rows = await filterRowsChunked(allRows, query); // yields every 50ms
  renderTable(rows); // one render at the end — no thrash
});
```

<!-- ILLUSTRATIVE: Timings are schematic. The structural claim: processing
time inside the handler counts directly toward the interaction; chunking with
yield lets the browser paint between chunks (shortening presentation wait for
other input) and keeps the *next* input from queueing behind one monolithic
task. renderTable at the end (single write batch) avoids Session 26's layout
thrashing inside the processing phase. -->

---

### Part 4: Follow-Up Questions

**Q: Why did INP replace FID — what was actually wrong with FID?**

Two things, both structural. First, scope: FID measured only the first input on the page — a single data point that says nothing about the dropdown you open on visit three or the button you press after a route change. Second, depth: FID measured only input delay — time before the handler started — and ignored how long your handlers ran and how long rendering took afterward. A page whose handlers were 400ms of synchronous work could pass FID (input delay was 10ms) while every interaction felt broken. INP fixes both: all interactions, full input-to-next-paint duration, worst case reported. That's also why INP's "good" bar is 200ms rather than FID's 100ms — it's measuring more of the pipeline, so the number is legitimately larger for the same perceived speed.

**Q: Does a slow `fetch()` inside a click handler make INP worse?**

Not directly, and this is a common misread. The handler that *starts* the fetch returns; the fetch completion runs later in its own task — it isn't part of this interaction's processing time. What hurts is (a) the fetch's *input delay* effect if responses clog the main thread with work, and (b) any *await* you put inside the handler: `await fetch(...)` inside the click callback doesn't block processing time the way synchronous work does, but the UI update you make after the await still has to be processed and presented, and if you chained heavy synchronous work on both sides, both phases grow. MDN's guidance matches this: async operations usually don't delay INP; long synchronous handlers and long tasks queueing ahead of input do.

**Q: `scheduler.yield()` vs `setTimeout(fn, 0)` — why does the API exist if setTimeout yields too?**

Both break the task; they differ in what happens to your continuation. `setTimeout(0)` enqueues your remaining work at the *back* of the task queue — after anything else already queued, so unrelated timers and scripts can jump ahead of your own completion, stretching total latency. `scheduler.yield()` schedules the continuation *ahead of* other similar tasks (still behind genuine user input) — you yield the main thread without losing your place in line. That prioritization is the API's reason for existing, and it's why web.dev recommends it over ad-hoc yielding for INP work. Caveat from MDN: it's not Baseline — feature-detect, fall back to the setTimeout promise, or ship the `scheduler-polyfill`; the fallback still yields (responsiveness preserved), it just loses the prioritization.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"INP is the interaction metric — it replaced FID. Keep your event handlers under 200ms and don't do heavy work on click. Use `debounce` on inputs."

**Why this misses the point:** The junior answer knows the metric's name and its replacement story but none of its anatomy. "Keep handlers under 200ms" collapses three independently-optimizable phases into one number — the student can't tell whether a bad INP is input delay (main thread busy *before* the event), processing time (their handler), or presentation delay (render the response), so they can't pick the right fix. Long tasks — the mechanism that inflates input delay for *every* interaction, not just the slow handler's — never appear. Debounce advice targets input events but INP's qualifying set is taps/clicks/keypresses, and debouncing a click handler is usually wrong. And `scheduler.yield()`, the current standard yielding mechanism, is absent, so the answer has no tool for the most common cause: one big synchronous task.

**Senior answer:**
"INP replaced FID in March 2024 and measures the worst interaction's full latency — input delay plus processing time plus presentation delay — across the page lifetime, at ≤200ms good / 200–500ms needs improvement / >500ms poor. Because all three phases contend for the main thread, the dominant lever is long-task control: anything over 50ms blocks input handling and frame presentation while it runs, straight out of Session 25's run-to-completion model. I break long work with `await scheduler.yield()` — feature-detected, `setTimeout` fallback — because its continuation is prioritized ahead of new tasks, unlike `setTimeout(0)`; I defer non-urgent work off the interaction path; and I move pure computation to a Web Worker so it never touches the main thread. Then I read the phase breakdown from Event Timing entries to confirm which of the three I actually fixed."

**The tell:** The junior answer gives a duration rule of thumb with no phase model and no mechanism. The senior answer names the three phases with what inflates each, states the exact thresholds, identifies the main thread as the shared bottleneck, and reaches for `scheduler.yield()` and Web Workers as the concrete tools — with the feature-detect caveat included.

---

### Part 6: Production Examples

A freight booking console had a filter input whose click-to-refresh interaction measured 340ms field INP. Event Timing decomposition showed input delay at 40ms (analytics tag work queued ahead), processing at 260ms (one synchronous pass filtering 50,000 rows and diffing the DOM), presentation at 40ms. Two moves: the filter moved into a Web Worker — it was pure array work, no DOM access — returning only the visible page of rows, and the residual main-thread diff was chunked with `await scheduler.yield()` every 50ms of measured work, feature-detected with a promise-wrapped `setTimeout` fallback for Safari. Input delay also dropped because the analytics tag's long task was split the same way; it no longer sat in front of the click. Field INP settled at 90ms p75. The team's takeaway in the PR: the fix wasn't "make the handler faster" in the abstract — the phase breakdown said processing was 260ms of the 340, so processing is what got restructured.

A collaborative whiteboard tool shipped a text-annotation feature where double-click-to-edit cost 600ms+ on field INP — but only for users with more than ~300 annotations on the board. The handler synchronously re-laid-out every annotation's connector lines (Session 26's layout propagation: one geometry change near the top re-flowed the subtree) before focusing the input. Lab runs on an empty test board never reproduced it — a field-only bug, visible only in CrUX and their own RUM. The fix split responsibilities: connector geometry computation went to a Web Worker as pure math, the main thread applied results in one batched write inside `requestAnimationFrame`, and `contain: layout` fenced each annotation card so connector updates couldn't propagate past it. INP for the heavy-board cohort fell under 150ms; the empty-board cohort never knew there was a problem. The lesson the staff engineer wrote up: INP's worst-case nature means you profile your *heaviest real* page state, not your clean test fixture.

---

## Topic 3 — Cumulative Layout Shift (CLS)

### Part 1: Theory

CLS measures visual stability: how much visible content moves around unexpectedly. It's the only Core Web Vital that isn't a time — it's a unitless score, and understanding the score is the whole topic.

**One shift's score** (WICG Layout Instability spec, verified this session):

```
layout shift score = impact fraction × distance fraction
```

*Impact fraction* — the union of the unstable elements' visible area across the previous and current frames, as a fraction of the total viewport. An element that moved contributes both where it was and where it is. *Distance fraction* — the largest single distance any unstable element moved (horizontal or vertical), divided by the largest viewport dimension (width or height, whichever is greater), capped at 1.0. Multiply: a shift covering 75% of the viewport whose worst element moved a quarter of the viewport height scores 0.75 × 0.25 = 0.1875 (web.dev's worked example).

**Only unexpected shifts count.** Shifts within 500 milliseconds of qualifying input — click, tap, key press; the spec's excluding inputs are mousedown, pointerdown, keydown, and change events — get `hadRecentInput: true` and are excluded from the score. Opening an accordion is supposed to move content below it; scoring that would punish correct UI. Scrolling and dragging don't arm the exclusion (they're continuous gestures, not discrete inputs).

**Aggregation — the part that's often misstated.** CLS is *not* an unbounded lifetime sum. Shifts group into session windows: a window opens at a shift and keeps absorbing shifts less than one second apart, capped at five seconds total; a gap ≥1s starts a new window. The reported CLS is the **largest session window's total** — the worst burst, not the page's lifetime accumulation (web.dev's "Evolving the CLS metric" decision, verified this session; the lifetime-sum definition predates the 2021 windowing change). A long-lived page with occasional small shifts across minutes doesn't grow without bound; a violent burst during load dominates the score.

**The thresholds are exact** (field p75): good < 0.1, needs improvement 0.1–0.25, poor > 0.25.

**The causes are a short list, each with a specific fix:**

- *Images without dimensions* — the browser reserves no box, the image's arrival re-flows everything below. Fix: `width`/`height` attributes (which modern browsers translate into an internal `aspect-ratio` even before load) or CSS `aspect-ratio` on the container.
- *Late content above the fold* — banners, recommendations, cookie bars injected higher than existing content push it down. Fix: skeleton at the final height, or reserve the slot's min-height before the data or ad creative arrives.
- *Web fonts reflowing text* — fallback metrics differ from the web font's, so the swap re-wraps lines. Fix: `font-display: optional` (no swap period — the font is used only if it arrives within the ~100ms block window, otherwise the fallback sticks for that page view), or keep `swap` and neutralize the delta with a metric-matched fallback — `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` — so the swap moves zero pixels (verified against web.dev and MDN's font-display docs this session).
- *Injected ads and banners* — same as late content, but revenue-bearing: reserve the creative's slot even before the ad request resolves.

---

### Part 2: Interview Answer

Cumulative Layout Shift scores visual stability — how much unexpected movement the visible page makes. Each individual shift gets a score: impact fraction times distance fraction. Impact fraction is how much of the viewport the unstable elements covered across the two frames in question, counting both their old and new positions. Distance fraction is the farthest any one of them moved, divided by the largest viewport dimension. Multiply them, and you have that shift's severity — the worked example in the docs: 0.75 impact times 0.25 distance is 0.1875.

Only unexpected shifts count. Anything within 500 milliseconds of a click, tap, or key press is flagged with `hadRecentInput` and excluded — an accordion expanding is supposed to move the content below it. Scrolling doesn't arm that exclusion. Then aggregation: shifts group into session windows — less than a second between shifts, windows capped at five seconds — and CLS is the largest window's total, the worst burst rather than a lifetime sum. Good is under 0.1, needs improvement is 0.1 to 0.25, poor is over 0.25.

The causes are a short list with exact fixes. Images missing `width` and `height` — add them, or reserve the box with CSS `aspect-ratio`. Late content landing above the fold — render a skeleton at the final height first. Web fonts re-flowing text on swap — either `font-display: optional`, which never swaps late, or keep `swap` and match the fallback's metrics with `size-adjust` and `ascent-override` so the swap moves nothing. Ads injected without a reserved slot — hold the space before the creative loads. Every one of those fixes is the same idea: the box exists before the content arrives.

---

### Part 3: Whiteboard / Live Coding

**The score, computed per the spec:**

```typescript
// Per-frame shift score (WICG Layout Instability spec):
//   score = impact fraction x distance fraction
const impactFraction = 0.75; // unstable elements cover 75% of the viewport
const distanceFraction = 0.25; // furthest element moved 25% of viewport height
const shiftScore = impactFraction * distanceFraction; // 0.1875
```

**Accumulating CLS the way the metric is actually reported:**

```typescript
type LayoutShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};

let clsValue = 0; // largest session window seen so far
let windowValue = 0;
let windowStart = 0;
let lastShiftTime = 0;

const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const shift = entry as LayoutShiftEntry;
    if (shift.hadRecentInput) continue; // expected: within 500ms of input

    const continuesWindow =
      windowValue !== 0 &&
      shift.startTime - lastShiftTime < 1000 && // gap < 1s
      shift.startTime - windowStart < 5000; // window cap 5s

    if (continuesWindow) {
      windowValue += shift.value;
    } else {
      windowValue = shift.value;
      windowStart = shift.startTime;
    }
    lastShiftTime = shift.startTime;
    if (windowValue > clsValue) clsValue = windowValue; // report the worst window
  }
});
clsObserver.observe({ type: "layout-shift", buffered: true });
```

<!-- ILLUSTRATIVE: Session-window constants (1s gap, 5s cap) and the
hadRecentInput exclusion verified against web.dev and the WICG spec this
session; the layout-shift entry type is browser-only (Chromium). Simplified
from the reference implementation — real reporters also flush the current
window on visibilitychange/pagehide, since CLS finalizes only when the page
is hidden (field measurement best practice, web.dev). -->

**The four fixes, in markup:**

```html
<!-- 1. Images: intrinsic dimensions reserve the box before bytes arrive -->
<img src="chart.webp" width="640" height="360" alt="Weekly throughput" />

<!-- 2. Reserved slot for late/injected content: skeleton at final height -->
<div class="ad-slot" aria-hidden="true"><!-- creative mounts here --></div>
```

```css
/* aspect-ratio when markup attributes aren't available (framework images) */
.photo { aspect-ratio: 16 / 9; object-fit: cover; }

/* reserved slot: no shift when the ad or banner finally renders */
.ad-slot { min-height: 250px; }

/* 3. Fonts — option A: never swap late (fallback sticks if font misses ~100ms) */
@font-face {
  font-family: "Brand";
  src: url("brand.woff2") format("woff2");
  font-display: optional;
}

/* 3. Fonts — option B: keep swap, make the fallback the same shape
      so the swap moves zero pixels */
@font-face {
  font-family: "Brand Fallback";
  src: local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

<!-- ILLUSTRATIVE: width/height attributes map to a default aspect-ratio in
modern browsers (the CSS sizing-algorithm spec behavior web.dev recommends);
font-display: optional gives a ~100ms block period and zero swap period, so a
font that misses the window never swaps (MDN/CSS Fonts, verified). The
override percentages are illustrative — real values are measured per
font-pair (tools like Fontaine generate them), never guessed. -->

---

### Part 4: Follow-Up Questions

**Q: Why are shifts after a user click excluded? Wouldn't a page just shift on every click and game the metric?**

The 500ms exclusion exists because correct UI *does* move content in response to input — accordions, expandable rows, toasts appearing after submit, tabs swapping panels. Counting those would make CLS punish working software, and worse, would perversely reward pages that shift *before* the user acts. The gaming concern is bounded by the window: only discrete inputs (click, tap, key press) arm the flag, only for 500ms, and continuous gestures like scrolling don't count — so a page can't keep shifting "because scroll" (scroll-linked shifts are explicitly not excluded). If your UI legitimately takes longer than 500ms to settle after an interaction — a slow fetch re-rendering a list — that late shift *does* count, which is the correct incentive: respond within the grace period or reserve the space instead.

**Q: Why session windows instead of just summing every shift forever?**

Because a pure lifetime sum grows with time-on-page, which made the metric unfair to pages users *stay* on — an infinite-scroll feed accumulating three tiny shifts over ten minutes would outscore a page that violently rearranged itself once during load, even though the violent page is the one users complain about. The 2021 change grouped shifts into windows (shifts less than a second apart, window capped at five seconds) and reports the worst window: it captures bursts — which is what users actually perceive as instability — while bounding the score. It also fixed a demoralizing side effect: fixing a small shift could *raise* your score if it happened to split a window; the max-window design mostly eliminated that inversion.

**Q: Do CSS `transform` animations cause layout shift?**

No — and this connects to Session 25's pipeline. Layout shift entries fire when an element's *layout* start position changes between frames — geometry recomputed by Stage 6. `transform` moves pixels at composite time without touching layout: the element's layout box never moves, so no `layout-shift` entry is generated. That's the same compositor-only tier from Session 26's cost spectrum, now with a metric consequence: animating `top`/`left`/`margin` re-runs layout and *can* create real shifts (and costs tier-1 render work), while `transform`/`opacity` animations are CLS-free by construction. The practical rule lands in the same place as the animation guidance: if it moves, move it with `transform`.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"CLS is about layout shifts — make sure images have dimensions and don't inject ads above the content. Aim for under 0.1."

**Why this misses the point:** The junior answer recites two of the four causes and one threshold, with no model underneath. Without the score formula, they can't reason about *severity* — a tiny element flying across the screen and a huge block nudging slightly are different problems, and only impact × distance tells you which matters; they also can't explain why a "small" shift score can still fail the threshold. The 500ms `hadRecentInput` exclusion is missing entirely, so they'd either count legitimate accordion motion as a bug or not understand why their debug total doesn't match the field number. And the aggregation is absent — no session windows means no explanation of why CLS isn't a running total, why one bad burst dominates, or why a long-lived page's occasional shifts don't accumulate forever. The font cause is skipped too — `font-display` and metric-matched fallbacks are half the CLS work on content-heavy sites.

**Senior answer:**
"CLS scores each unexpected shift as impact fraction × distance fraction — viewport area affected by the moving elements times the largest movement relative to the viewport. Shifts within 500ms of a click, tap, or key press are excluded via `hadRecentInput`; the rest group into session windows (under-1s gaps, 5s cap) and CLS reports the largest window's total. Thresholds: good <0.1, needs improvement 0.1–0.25, poor >0.25. The four causes each have a precise fix: images without `width`/`height` get dimensions or `aspect-ratio`; late above-the-fold content gets a skeleton at final height; font swap reflow gets `font-display: optional` or a metric-matched fallback via `size-adjust`/`ascent-override` so the swap moves nothing; ad slots get reserved before the creative loads. One principle under all four: the box exists before the content arrives — layout never has to guess, so nothing the user didn't ask for ever moves."

**The tell:** The junior answer is a causes checklist with no formula, no exclusion window, and no aggregation model. The senior answer computes the score from its two fractions, states the 500ms rule and session-window reporting, gives all four causes with their named fixes, and unifies them under one principle instead of leaving them as unrelated tips.

---

### Part 6: Production Examples

A breaking-news site ran field CLS at 0.31 on article pages, driven by two bursts the session-window view isolated: a font-swap reflow of the headline block during load (0.08) and — the dominant one — a sponsored banner injected above the article body whenever the ad response returned late, typically 1–3s in, shoving the entire article down (0.22). Lighthouse kept reporting 0.04 because the lab run's ad stub resolved before measurement and never scrolled. Three fixes: the ad slot got a reserved `min-height: 280px` container present in the initial HTML, so the creative landing later filled an existing box; the headline font moved to `font-display: optional` (brand font on a news site degrades acceptably to the metric-matched system fallback, and optional guarantees no late swap); article images — which had been framework-rendered without attributes — got width/height from the CMS. Field CLS dropped to 0.06 after the CrUX window rolled. The junior-vs-senior lesson the performance lead noted: the lab score was *fine* the whole time — only field data, read with session windows, showed which burst to fix first.

A SaaS dashboard's KPI cards sat under a company-branded web font with `font-display: swap` and a bare `sans-serif` fallback — Arial's advance widths differed enough that every KPI re-wrapped on swap, shifting the entire grid (measured 0.14 CLS from font-attributable shifts alone, confirmed via `layout-shift` entry `sources` pointing at the card text nodes). The fix didn't touch `swap` — the font was a brand requirement for body and KPI text — it attacked the metric delta: a `Brand Fallback` `@font-face` aliasing `local("Arial")` with `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` values generated from both fonts' actual metrics (Fontaine at build time), plus a unitless `line-height` so vertical box height couldn't drift either. The swap still happened; it moved zero pixels. Decorative icon fonts on the same pages went to `font-display: optional` outright — missing an icon font for one view is invisible; reflowing a KPI grid is not.

---

## Topic 4 — Measurement: Field, Lab, and Programmatic

### Part 1: Theory

You can't improve what you can't measure, and Core Web Vitals are measured three different ways that answer three different questions. Conflating them is the most common measurement mistake in performance work.

**Field data — what actually happened.** The Chrome UX Report (CrUX) aggregates real Chrome user sessions over a rolling 28-day window, updated daily, reported at the 75th percentile, split by mobile and desktop, at origin and URL granularity (verified against Chrome's CrUX methodology docs this session). It surfaces in PageSpeed Insights (field section on top) and Search Console's Core Web Vitals report (page-group level) — and CrUX is the dataset Google uses for the page-experience ranking signal in Search. The p75 framing matters: field data is a *distribution*, not a number; "good" means 75% of experiences are at or under the threshold. Coverage caveats a senior answer states: only eligible Chrome users on supported platforms, only pages with enough traffic, URL-level data falls back to origin when samples are thin, and the 28-day window means a deploy's effect takes up to ~30 days to fully reflect.

**Lab data — controlled diagnosis.** Lighthouse (and WebPageTest) run synthetic loads: fixed emulated device, throttled network, cold cache, one run, no real user behavior — no scrolling before load finishes, no clicks timed by a human, no interaction latency to speak of (which is why lab can't directly measure INP; Total Blocking Time is its diagnostic stand-in). Lab's job is reproducibility: bisect a regression, compare before/after under identical conditions, get a trace you can step through. Lab's failure mode is being read as a field score — a 95 Lighthouse number on a fast desktop profile says nothing about your p75 users on mid-tier Android over 4G.

**Programmatic — your own field data (RUM).** The PerformanceObserver API reads the same platform primitives CrUX is built on — `largest-contentful-paint`, `layout-shift`, and `event` entries with `buffered: true` to replay what happened before your script loaded (spec verified against W3C Performance Timeline; the `observe({type, buffered})` shape was exercised against a Node runtime this session). The `web-vitals` library wraps that plumbing — `onLCP`, `onINP`, `onCLS` — implementing the aggregation rules correctly (LCP freeze-at-input, CLS session windows, INP interaction grouping and outlier trimming) so you don't reimplement them wrong. Real user monitoring in production gives you the distribution CrUX gives Google, plus the context CrUX lacks: which URL, which LCP element, which long tasks, correlated with device and connection.

**Why field and lab diverge** — same page, different populations: lab's fixed profile vs. field's variance (old devices, slow networks, geography, warm caches and bfcache, AMP/SXG preloads from Search, real scroll timing changing which element wins LCP and which shifts count). Field and lab answer different questions: field asks "are users okay" (ranking ground truth); lab asks "what is this code doing" (diagnosis). The senior workflow uses both without confusing them: CrUX/RUM to detect and prioritize, Lighthouse to reproduce and verify a fix in controlled conditions.

---

### Part 2: Interview Answer

There are three measurement layers, and mixing them up is the classic mistake. Field data is real users — the Chrome UX Report aggregates Chrome sessions over a rolling 28-day window, refreshed daily, reported at the 75th percentile, visible in PageSpeed Insights and Search Console. That's the dataset Google uses for the page-experience ranking signal, which makes it ground truth for "are we okay in Search." It has real caveats: only eligible Chrome users, only pages with enough traffic, URL data falls back to origin when samples are thin, and a deploy can take nearly a month to fully show.

Lab data is synthetic — Lighthouse and WebPageTest run one controlled load on a fixed device profile with a throttled network and a cold cache. That reproducibility is exactly what makes lab good for diagnosis and before/after comparison, and exactly what makes it wrong as a field score: no real device variance, no real user timing, and interaction latency basically isn't measurable because nobody's clicking.

Programmatic is your own code in production — PerformanceObserver reading the same platform entries CrUX is built on, or the `web-vitals` library wrapping `onLCP`, `onINP`, `onCLS` with the aggregation rules already correct, shipped to your analytics as real user monitoring. That gives you the full distribution with context CrUX doesn't expose: which element was LCP, which task blocked input, which URL and device.

They diverge because they measure different populations — one emulated profile versus everyone. So the workflow: CrUX field data is the ranking ground truth and the prioritization signal, RUM adds the diagnostic context at field scale, and Lighthouse reproduces a specific regression under controlled conditions. Shipping on a green Lighthouse score alone is shipping on a sample of one.

---

### Part 3: Whiteboard / Live Coding

**Field vs. lab vs. programmatic — the decision table:**

```
Layer          Source                    Window        Reported        Best for
─────────────────────────────────────────────────────────────────────────────────
Field (CrUX)   Real Chrome sessions      28-day roll   p75, origin+URL Ranking truth,
                                    (daily refresh)   (mobile/desktop) prioritization

Lab            Lighthouse/WebPageTest    Single run    One value       Reproduce &
               (fixed device/network,                  per run         diagnose;
               cold cache, no user)                    (score)         before/after

Programmatic   Your PerformanceObserver  Per session   Full            RUM: context
               /web-vitals in prod       distribution  distribution    at field scale
                                                                    (element, task, URL)
```

<!-- ILLUSTRATIVE: Table summarizes the verified properties above; Lighthouse
scores and PSI/Search Console layouts are tool-observable, not executed
in-session. "No user" in the lab row means no human interaction timing —
scripted scroll exists in some lab tools but interaction latency still isn't
representative (web.dev's lab-vs-field guidance). -->

**Production RUM with the web-vitals library:**

```typescript
import { onCLS, onINP, onLCP, type Metric } from "web-vitals";

function transport(metric: Metric): void {
  const payload = JSON.stringify({
    name: metric.name, // "LCP" | "INP" | "CLS" | ...
    value: metric.value,
    rating: metric.rating, // "good" | "needs-improvement" | "bad"
    id: metric.id, // groups updates of the same metric instance
  });
  // sendBeacon survives page unload — required for CLS, which finalizes on hide
  navigator.sendBeacon("/rum", payload);
}

onLCP(transport);
onINP(transport);
onCLS(transport);
```

<!-- ILLUSTRATIVE: The onCLS/onINP/onLCP + sendBeacon shape is the web-vitals
README's documented usage (verified via Context7 this session); /rum is a
placeholder endpoint. The library handles the hard parts this session's raw
snippets only sketched: LCP's freeze-at-input finalization, CLS's session
windows, INP's interactionId grouping and outlier trimming, and the
visibilitychange flush. Analytics must load async/non-blocking — a blocking
reporter hurts the very metrics it reports (web.dev field best practices). -->

**Raw platform entries — when you need the primitives yourself:**

```typescript
// Same platform layer CrUX is built on; buffered: true replays early entries.
const types = ["largest-contentful-paint", "layout-shift", "event"] as const;

for (const type of types) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(type, entry.startTime, entry.duration, entry);
    }
  });
  observer.observe({ type, buffered: true });
}
```

<!-- ILLUSTRATIVE: The three entry types map 1:1 to LCP, CLS, and INP's raw
inputs; signature verified against the Performance Timeline spec and the
Node runtime check this session, but the entry types themselves emit only in
browsers (Chromium for layout-shift and largest-contentful-paint). Use raw
entries for custom attribution; use web-vitals for correct standard
aggregation — reimplementing CLS windowing or INP grouping by hand is where
RUM numbers drift from CrUX. -->

---

### Part 4: Follow-Up Questions

**Q: My Lighthouse score is 95 but Search Console says Poor. Who's lying?**

Neither — you're comparing a sample of one against a population. Lighthouse is one synthetic run on a fixed profile with cold cache and no real interaction; Search Console is the 28-day p75 of your actual users — mid-tier Androids, congested networks, returning visitors with warm caches, people scrolling before load finishes. web.dev documents concrete mechanics behind the gap: lab always waits for load and never scrolls (so below-the-fold CLS and post-load shifts are invisible to it), the lab's LCP element may differ from field's because field freezes candidates at first input, and bfcache/AMP/SXG effects show up in field but not in a cold lab run. Read the Lighthouse score as a diagnosis surface — *what* is slow, which resource, which blocking point — and the field p75 as the verdict on whether users are actually suffering.

**Q: Why p75? Why not average or median?**

Because performance experience is a skewed distribution and the tail *is* the product for a quarter of your users. The median hides the 25% on bad devices or bad networks; the mean gets dragged around by extreme outliers in both directions and isn't a experience anyone has. p75 is chosen so "good" explicitly means "at least three quarters of experiences pass" — you can't green-light a page where one in four users waits four seconds. It's also consistent: CrUX, PSI, Search Console, and Google's ranking assessment all use p75, segmented by form factor, so your internal RUM reported the same way is directly comparable to what Google sees.

**Q: CrUX says good everywhere — is RUM still worth it?**

If all you need is the ranking verdict, no — CrUX answers that. RUM earns its cost when you need *why* and *for whom*. CrUX gives you a p75 number per URL; it doesn't tell you which element was LCP, which long task sat in front of the click, which third-party tag regressed, or whether the problem is one device class or everyone. It also can't see low-traffic URLs (they fall back to origin or vanish), can't slice by your own dimensions (user plan, template variant), and moves slowly — 28-day window plus lag. The standard split: CrUX as the external scoreboard and ranking signal, RUM as the debuggable internal distribution, Lighthouse as the local reproduction tool. Teams that only watch CrUX know *that* they regressed about a month late, with no trace attached.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"I run Lighthouse, get everything above 90, and check PageSpeed Insights occasionally. If the score's green we ship."

**Why this misses the point:** The junior answer collapses three layers into one number and treats lab as the scoreboard. A Lighthouse score is one synthetic run on a profile that may not resemble anyone your product actually serves — it has no real interaction timing (INP's entire subject), no below-the-fold or post-load CLS, and a possibly different LCP element than field reports. "Above 90" isn't a threshold Google uses; the ranking signal is field p75 from CrUX. There's no RUM, so when Search Console flips red the team has a verdict with no trace — which URL, which element, which device — and no way to reproduce what real users hit. And "check PSI occasionally" misses that field is a 28-day rolling window: regressions surface late if you aren't continuously watching a distribution segmented by device.

**Senior answer:**
"I treat the three layers as answering different questions. CrUX field data — 28-day rolling p75 in PSI and Search Console — is ground truth for ranking and my prioritization signal; I check coverage caveats (origin fallback, Chrome-only, thin-traffic URLs) before declaring anything. I instrument production RUM with the `web-vitals` library so I have the same distribution plus diagnostic context — LCP element, long tasks, URL, device — because CrUX tells me *that* I regressed and RUM tells me *why*, without the month of lag on my own data. Lighthouse stays in the workflow as a lab tool: reproduce a specific regression, verify a fix under identical conditions, read the trace — never as the ship gate. When lab and field disagree, field wins for prioritization; when field is green but lab shows waste, I still optimize if the trace shows a real blocker for the slow cohort the lab profile happens to simulate."

**The tell:** The junior answer has one layer, one threshold that doesn't exist in Google's system, and a green-score ship gate. The senior answer assigns each layer its question — field for verdict, RUM for diagnosis at scale, lab for controlled reproduction — names p75 and the 28-day window explicitly, and states the conflict-resolution rule (field wins prioritization) instead of hoping the numbers agree.

---

### Part 6: Production Examples

A retail team celebrated a Lighthouse 96 after a redesign while Search Console's Core Web Vitals report slid from Good to Poor on mobile product pages over the following month — the 28-day window had been absorbing the regression the whole time. Field p75 LCP was 3.8s; the lab profile (fast 4G emulation, desktop-class CPU throttle) never reproduced it because the redesign's hero AVIF, while well-compressed, was discovered late in a CSS `url()` and their largest cohort was mid-tier Androids where decode plus a 600ms TTFB to a single-region origin compounded. They stood up RUM with `web-vitals` in a sprint — not to replace CrUX (which stayed the scoreboard) but to get per-URL, per-element attribution immediately instead of waiting another monthly window for each experiment's verdict. RUM showed the LCP element was the hero image for 71% of mobile sessions and the H1 text for most desktop; they preloaded the hero, moved static assets to a CDN, and watched field p75 fall to 2.4s in RUM within days, confirmed in CrUX six weeks later. The director's note after the incident: Lighthouse had been green through the entire regression — the score was never the signal.

A B2B document-signing product had a "green across the board" Lighthouse run on their editor page while support tickets piled up about freezes on the "Approve" click. Lab couldn't see the problem at all: Lighthouse doesn't click Approve, and INP's worst interactions happened after users had pasted large contract text — a state no synthetic run reaches. Their own RUM, reporting INP via `web-vitals` at p75 segmented by document size, showed the split instantly: under 10 pages, INP 80ms; over 50 pages, INP 620ms — poor — because approval synchronously ran validation plus PDF-render prep across every page on the main thread. They moved PDF prep to a Web Worker, chunked validation with `scheduler.yield()` (feature-detected, setTimeout fallback for the Safari cohort), and added a long-task observer to the RUM pipeline as a leading indicator so regressions would show up in task time *before* they crossed the 200ms INP line. Field INP for the heavy cohort settled at 140ms. The workflow that stuck: CrUX for the ranking verdict, RUM for the cohort split that found the bug, lab for verifying each fix against the same reproducible fixture.

---

## Tie the Chain Together

The three metrics are Session 25's pipeline and Session 26's critical rendering path, each measured at the point a different user concern lands. LCP measures how fast the largest visible element finishes the CRP — HTML through parse, discovery, fetch, DOM+CSSOM, Render Tree, layout, paint — so render-blocking CSS and parse-blocking scripts delay LCP by exactly the mechanism Session 26 documented; optimizing FMP by removing blockers optimizes LCP by the same cuts, just scoring a different point at the end. INP measures whether the browser can respond to input and present the next frame — Session 25's main-thread availability made observable: run-to-completion means a long task inflates input delay, handler time inflates processing, and blocked style/layout/paint inflates presentation, with the compositor waiting on work the main thread hasn't finished. CLS measures what happens when Session 25's Stage 6 runs when the user didn't ask it to — layout propagation (Session 26 Topic 1) is the mechanism that turns one late-loading box into a viewport-wide impact fraction, and reserving space is how you stop the re-run from being triggered at all.

Together — loading, responsiveness, visual stability — they form the page experience signal Google uses for Search ranking, read as field p75 over a 28-day CrUX window. Thresholds to hold: LCP ≤2.5s / 2.5–4s / >4s, INP ≤200ms / 200–500ms / >500ms (INP replaced FID on March 12, 2024), CLS <0.1 / 0.1–0.25 / >0.25. Measurement splits three ways: field (CrUX — ranking ground truth), lab (Lighthouse — controlled diagnosis), programmatic (`web-vitals` / PerformanceObserver — RUM with context), and the senior habit is never confusing which question each layer answers. Session 28 continues on the implementation side — lazy loading, image optimization, fonts, and resource hints — the techniques that move the LCP number this session defined how to read.

---

## Cross-References

- Session 12 (`book/02-html-mastery/12-browser-parsing-dom-construction.md`) — parser-blocking script mechanics and `defer`/`async` semantics; the parse-blocking lever behind LCP's element render delay.
- Session 22 (`book/04-browser/22-dns-tcp-tls-https.md`) — DNS/TCP/TLS round trips; the network floor under LCP's time-to-first-byte subpart.
- Session 24 (`book/04-browser/24-caching-cookies-storage.md`) — cache headers determine whether returning-user field experiences (warm cache, lower CLS/LCP) differ from the cold lab run — one of the documented field/lab divergence mechanics.
- Session 25 (`book/04-browser/25-rendering-pipeline.md`) — the nine-stage pipeline and the main-thread/compositor split; INP's three phases are that architecture measured from the input's point of view, and CLS scores unintended Stage 6 runs.
- Session 26 (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`) — the CRP sequence and its two blocking points; LCP is measured through that path, its follow-up explicitly handed FCP/LCP to Module 5, and reflow propagation underlies CLS's impact fraction.
