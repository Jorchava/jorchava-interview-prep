# Session 28 — Lazy Loading, Images, Fonts, and Resource Hints

> **Module 5 — Performance.** Session 2 of 5.
> **Chain:** lazy loading (native `loading="lazy"`) → image optimization (formats, `<picture>`, `srcset`/`sizes`) → font loading (`font-display`, metric-matched fallbacks) → resource hints (`preload` / `prefetch` / `preconnect` / `dns-prefetch`).
> This session implements the improvement levers Session 27 named after it decomposed LCP into time to first byte + resource load delay + resource load duration + element render delay (`book/05-performance/27-core-web-vitals.md`). Its resource-hints topic is built on Session 26's critical rendering path — the preload scanner and the `rel=preload` pattern are introduced there and differentiated here (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`). Where each technique lands in the LCP budget is stated below, before Topic 1.

<!-- Module 5 convention (established Session 27): spec-verifiable claims are
verified before they are stated; browser-observable behavior is marked
ILLUSTRATIVE. Verified this session: the loading attribute's eager/lazy values,
deferral semantics, and LCP-image caution against MDN and web.dev's
browser-level lazy loading guide; Chromium's distance-from-viewport thresholds
(images: 4G 1250px / 3G 2500px / 2G 6000px / slow-2G 8000px) against Chromium's
settings.json5 on the main branch, plus lazy_load_image_observer.cc showing the
threshold is implemented as an IntersectionObserver root margin; browser support
versions (Chrome 77, Edge 79, Firefox 75, Safari 15.4) from web.dev's support
badges and MDN Baseline; the fetchpriority attribute's high/low/auto values and
img/link/script targets against MDN and the HTML Standard's attribute anchors;
picture/srcset/sizes/decoding semantics against MDN's img, picture, and
responsive-images references; font-display's five values and their block/swap
periods (auto: user-agent; block: 2-3s/infinite; swap: 0ms/infinite; fallback:
100ms/3s; optional: 100ms/none) against MDN's font-display docs and web.dev's
font best practices; all four resource hints — dns-prefetch, preconnect,
prefetch, preload — against the HTML Standard's link types section (all four are
defined there, section 4.6.8), with preload's mandatory-as rule, as-driven
priority/CSP/Accept behavior, and crossorigin font-matching against MDN and
web.dev, and preconnect's DNS+TCP+TLS scope against MDN. Browser- or
tool-observable only, therefore ILLUSTRATIVE: exact request-priority queue
behavior (which resource wins bandwidth under contention), DevTools and
Lighthouse observations, rendered FOIT/FOUT behavior, and the image format size
percentages (typical published ranges, not a benchmark run in-session). No
<!-- VERIFY --> flags remain in this file. This convention applies to Sessions
27-31. -->

---

## Where Each Technique Lands in the LCP Budget

Session 27 Topic 1 named the four subparts. Before the topics, the mapping:

| Technique | LCP subpart it targets | Direction |
|---|---|---|
| Lazy loading | Resource load duration, indirectly | Removes below-the-fold images from the initial request set so they stop competing with the LCP image for bandwidth. Misapplied it *adds* resource load delay to the LCP image itself — the anti-pattern Topic 1 covers. No effect on TTFB. |
| Image optimization | Resource load duration, directly | Fewer bytes at equal quality (formats), the right number of bytes for the viewport (resolution), paint not waiting on decode (`decoding="async"`). |
| Font loading | Element render delay | A font still in its block period holds text rendering; when a text block is the LCP candidate, that hold *is* the element render delay. `font-display` and font `preload` decide how much of it lands. Swap reflow is CLS, not LCP. No effect on TTFB. |
| Resource hints | Resource load delay (discovery) | `preload` closes the gap between when the browser would find a resource and when it fetches it; `preconnect` removes DNS + TCP + TLS from the front of a cross-origin fetch; `dns-prefetch` removes the DNS step only. `prefetch` targets the *next* navigation's LCP, not this page's. |

TTFB stays where Session 27 left it — CDN and origin speed, not this session's levers.

---

## Topic 1 — Lazy Loading

### Part 1: Theory

Images are the largest asset class most pages ship: web.dev cites HTTP Archive data showing sites sending over 5MB of images at the 90th percentile, on both desktop and mobile. Lazy loading is the answer to "don't fetch what the user hasn't scrolled to yet" — and the native answer is one attribute on one element.

**The attribute.** `loading` on `<img>` (and `<iframe>`) takes two values: `lazy`, which defers the fetch, and `eager`, which is the default and identical to omitting the attribute entirely. Graceful degradation: browsers that don't support it ignore it, so there's no negative in shipping it. Support is effectively universal now — Chrome 77 and Edge 79 (2019), Firefox 75 (2020), Safari 15.4 (March 2022).

**The threshold is distance-based, not visibility-based.** This is the precision point of the whole topic. `loading="lazy"` does *not* mean "load when the element enters the viewport." The browser starts fetching when the image comes within a *calculated distance* of the viewport — sized so the download will have finished by the time the user scrolls to it. Chromium's defaults scale with the effective connection type, and they scale in the direction people find counterintuitive: the *slower* the connection, the *larger* the margin, because the bytes take longer to arrive.

| Effective connection type | Image distance threshold |
|---|---|
| 4G | 1250px |
| 3G | 2500px |
| 2G | 6000px |
| Slow-2G / offline | 8000px |

(Chromium `settings.json5`, `lazyLoadingImageMarginPx*` values; iframe thresholds are separate and larger.) Images immediately viewable without scrolling always load normally, outside any threshold. The thresholds are hardcoded — there's no API to change them. Under the hood, Chromium implements the check as an IntersectionObserver with that distance as its root margin (`lazy_load_image_observer.cc`), which explains two more facts: the deferral only happens when JavaScript is enabled, and from Chrome 121 the same thresholds apply to horizontally scrolling images such as carousels.

**The LCP anti-pattern.** Never put `loading="lazy"` on the LCP image or on any image visible at load. An eager image is found by the preload scanner during parse and fetched immediately; a lazy one can't be fetched until the document is parsed, laid out, and the proximity check passes — you have deliberately added discovery delay to the one element LCP measures. web.dev's caution is explicit: don't lazy-load images likely to be in-viewport at load, especially LCP images. The LCP image gets `fetchpriority="high"` instead (Topic 2), and `loading="eager"` is the explicit opt-out when your tooling or linter adds `lazy` by default. Combining `lazy` with `fetchpriority="high"` is pointless — the image stays deferred while off-screen, then loads at high priority it would likely have had anyway.

**The two companion attributes.** `decoding="async"` is a hint that the image may be decoded asynchronously, so painting of other content isn't held up waiting for it (`sync` forces atomic presentation with surrounding content; `auto` is the default). And dimensions: lazy images without `width`/`height` are laid out at 0×0, which can make the browser believe every image in a gallery fits in the viewport — loading them all at once — while also re-exposing the CLS problem Session 27 Topic 3 fixed.

**The JavaScript predecessor.** Before the attribute, teams wrote it: scroll/resize/orientationchange handlers first, then Intersection Observer (which added a non-janky way to watch proximity), then libraries like lazysizes wrapping all of it. Native lazy loading supersedes that for the standard case — no JS payload, works with the browser's own layout knowledge. Intersection Observer remains the tool when the trigger isn't "near viewport": infinite-scroll fetches, impression tracking, carousel advancement. It's also, quietly, the primitive the native attribute itself is built on.

---

### Part 2: Interview Answer

Lazy loading means the browser doesn't fetch an image until it needs it, and the native version is one attribute: `loading="lazy"`, with `loading="eager"` as the explicit default. It's supported everywhere now — Chrome and Edge in 2019, Firefox in 2020, Safari 15.4 in March 2022 — so the lazy-loading libraries most teams still ship are solving a problem the platform solved years ago.

The part people get wrong is *when* the fetch starts. It's not "when the image enters the viewport." It's a distance-from-viewport threshold: the browser fetches when the image is within a calculated distance of the viewport, sized so the download finishes before you scroll to it. Chrome's numbers scale with connection speed, and they scale in the counterintuitive direction — slower connections get a *bigger* margin, because the bytes take longer: 1250 pixels on 4G, 2500 on 3G, up to 8000 on slow 2G. Those are hardcoded; there's no API to tune them. Images visible without scrolling always load normally.

That threshold leads straight to the biggest lazy-loading mistake there is: putting `loading="lazy"` on the LCP image. An eager image is discovered by the preload scanner during parse and fetched immediately. A lazy one can't fetch until the document has been parsed, laid out, and run its proximity check — so you've added resource load delay to the exact element LCP measures, which is the opposite of the optimization. Never lazy-load the LCP image or anything above the fold. The LCP image gets `fetchpriority="high"` instead; only genuinely off-screen images get `loading="lazy"`.

Two companions round it out. `decoding="async"` lets the browser decode the image without holding up painting of everything else. And `width`/`height` matter more under lazy loading, not less — a lazy image with no dimensions lays out at 0×0, which can make the browser think a whole gallery fits on screen and fetch it all at once. The JavaScript predecessor — scroll handlers, then Intersection Observer — is worth knowing mainly so you can say why native exists: the browser makes the decision with layout knowledge you never have, for free.

---

### Part 3: Whiteboard / Live Coding

**The correct pattern for a mixed image list — three tiers, three configurations:**

```html
<!-- Tier 1: the LCP image. Eager (default), boosted, dimensions reserved. -->
<section class="hero">
  <h1>Track every shipment</h1>
  <img
    src="hero-960.avif"
    srcset="hero-640.avif 640w, hero-960.avif 960w, hero-1280.avif 1280w"
    sizes="(max-width: 700px) 100vw, 960px"
    width="960"
    height="720"
    fetchpriority="high"
    decoding="async"
    alt="Map view of active routes"
  />
</section>

<!-- Tier 2: other above-the-fold images. No loading attribute at all —
     eager is the default, and adding it explicitly changes nothing. -->
<img src="summary-320.avif" width="320" height="240" decoding="async" alt="Shipment summary" />

<!-- Tier 3: genuinely off-screen images. Deferred, decode-hinted, dimensioned. -->
<img src="gallery-12.avif" width="320" height="240" loading="lazy" decoding="async" alt="Route history" />
<img src="gallery-13.avif" width="320" height="240" loading="lazy" decoding="async" alt="Carrier detail" />
```

<!-- ILLUSTRATIVE: The three-tier configuration is web.dev's documented
guidance (eager-load first-viewport and LCP images; lazy only outside the
initial viewport). fetchpriority's exact ranking effect inside the browser's
priority queue is browser-observable — MDN notes both internal priority and the
attribute's impact are browser-dependent. Lazy + fetchpriority="high" on the
same image is deliberately absent: while off-screen it stays deferred, so the
combination buys nothing (web.dev). -->

**The JavaScript predecessor, for the "what did this look like before?" follow-up:**

```typescript
const observer = new IntersectionObserver((entries, obs) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target as HTMLImageElement;
    img.src = img.dataset.src ?? "";
    obs.unobserve(img);
  }
}, { rootMargin: "400px" }); // the hand-rolled version of the browser's threshold

document.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
  observer.observe(img);
});
```

<!-- ILLUSTRATIVE: This is the pre-2020 pattern — Intersection Observer with a
root margin standing in for a distance threshold, data-src swapped at
intersection. Note the structural parallel to the native implementation: the
browser's lazy loading is this exact shape (IntersectionObserver with a
connection-dependent root margin), which is why deferral requires JavaScript.
Native replaces it for the standard case; keep IO for non-proximity triggers
(infinite scroll, impression tracking). -->

---

### Part 4: Follow-Up Questions

**Q: Does lazy loading improve my LCP score?**

Not by itself, and never by touching the LCP image. Lazy loading's LCP effect is indirect: by deferring below-the-fold images it removes them from the initial request set, so they stop competing with the LCP image for bandwidth — which shortens the LCP image's resource load duration. Applied to the LCP image it does the opposite, adding resource load delay (discovery now waits for layout instead of running during parse). The honest framing: lazy loading protects LCP from *other* images; `fetchpriority`, format, and preload are what actively improve it. If your field LCP regressed after a "lazy-load everything" PR, that's the failure mode in one sentence.

**Q: Why did an image with `loading="lazy"` load before I scrolled anywhere?**

Because it was within the distance threshold, not because it was visible. On 4G Chrome starts fetching images up to 1250px outside the viewport — and the threshold grows to 8000px on slow 2G, on purpose, so a slow download still finishes before you reach it. Images above the fold are inside every threshold, which is exactly why the attribute belongs only below it. If the number seems too eager, remember it's a connection-class-based heuristic, not a per-site policy: the browser is optimizing for "loaded by the time it's seen," not for "minimize requests."

**Q: Can I lazy-load CSS background images, or images hidden behind `display: none`?**

CSS background images can't use `loading` at all — the attribute exists on `<img>` and `<iframe>` only, because backgrounds aren't elements. If a background is content (your LCP candidate), make it a real `<img>`: then dimensions, preload scanning, and lazy semantics all apply. Hidden-image behavior is its own trap: images styled `display: none` (on the image or a parent) don't load in Chrome, Firefox, or Safari, while `opacity: 0` images *do* load — so a lazy carousel's slides behave differently depending on how the hiding is implemented. Test the mechanism you actually use.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"I add `loading="lazy"` to all the images on the page — it's a one-line performance win, everything below the fold stops loading until you scroll to it, and Lighthouse likes it."

**Why this misses the point:** The junior answer applies one rule uniformly, which means it silently hits the LCP image too. That's not a neutral choice — it adds discovery delay to the element LCP measures, so the "performance win" can *raise* field LCP. There's no model of the threshold, so they can't explain why an off-screen image loaded early (distance-based, connection-scaled) or why a hidden carousel's images behaved unexpectedly. `fetchpriority` is absent, so the LCP image has no positive treatment — only the wrong one. Above-the-fold images aren't distinguished from below-the-fold ones, dimensions aren't mentioned (the 0×0 gallery-load-everything failure and the CLS risk), and the JS predecessor is unknown — so when asked *why* native lazy loading works, they can't connect it to Intersection Observer or to the JavaScript-required caveat.

**Senior answer:**
"`loading="lazy"` defers the fetch until the image is within a *distance* of the viewport — Chromium uses 1250px on 4G and scales up to 8000px on slow 2G, so slower connections start earlier, not later — and it's implemented as an IntersectionObserver, which is why deferral needs JavaScript. The rule I apply: never on the LCP image, never on anything visible at load, because those images can't fetch until after parse and layout, which is added load delay on the one element LCP scores. The LCP image gets `fetchpriority="high"` and eager loading instead; above-the-fold images get no `loading` attribute at all; `loading="lazy"` goes only on genuinely off-screen images, always with `width`/`height` so they don't lay out at 0×0 and `decoding="async"` so decode doesn't hold up other painting."

**The tell:** The junior answer optimizes by attribute count and Lighthouse feedback. The senior answer states the threshold model with its direction, names the LCP anti-pattern explicitly, and splits images into three tiers with a different configuration for each — the correct answer is a *policy*, not a grep-and-replace.

---

### Part 6: Production Examples

A subscription billing product's marketing relaunch moved to a component library that stamped `loading="lazy"` on every `<img>` through one shared `Image.vue` default. Field LCP on the pricing page went *up* from 2.4s to 3.1s p75 — the hero image was inside the shared default, so its fetch now waited for first layout plus the proximity check instead of starting during preload scan, adding roughly 600ms of resource load delay to the exact element CrUX attributed as LCP. The fix was two lines in the shared component: hero-class images (passed a `priority` prop from the template that renders above the fold) get `fetchpriority="high"` and no loading attribute; everything else keeps `lazy`. The team's rule after the incident: lazy loading is a *below-the-fold* policy owned by the template, never a default owned by the image component.

A photo-journalism site's article pages shipped 40 gallery images per story with native lazy loading but no `width`/`height` — each image's slot collapsed to 0×0 until loaded, so on a fast connection the browser's proximity check concluded all 40 fit in the viewport and fetched them simultaneously, defeating the deferral and pulling 18MB into the initial view. Two changes: intrinsic dimensions from the CMS on every gallery image (the slot was correct before bytes arrived, which also killed the scroll-time layout shifts Session 27 covered) and a CSS `aspect-ratio` guard for images where the CMS couldn't supply them. Initial-request image count dropped to the handful actually near the viewport; the CLS that support tickets had described as "the page jumping while I read" disappeared with it.

---

## Topic 2 — Image Optimization

### Part 1: Theory

Lazy loading decides *when* an image fetches; this topic decides *what* is fetched. Three independent axes, each with its own attribute or element: format (what encoding), resolution (how many pixels), and priority/decoding (how the fetch and paint are treated).

**Format hierarchy — stated with the numbers.** For photographic content: **AVIF > WebP > JPEG** in compression efficiency. AVIF typically lands around **50% smaller than JPEG at equivalent quality**; WebP typically lands **25–35% smaller**. Those are typical published ranges for photographic imagery, not a benchmark — measure your own content (ILLUSTRATIVE). For non-photographic content — diagrams, screenshots, UI, anything with text — the hierarchy changes: **PNG (with transparency) > WebP (lossless) > JPEG**. JPEG is lossy-only with chroma subsampling, and its artifacts are visible on sharp text edges and flat color; PNG is lossless and supports alpha; WebP offers lossless mode and alpha too, so it's a middle option when you want modern compression without the artifacts. The senior rule: pick the hierarchy by *content type*, then let the browser choose which of your candidates it can actually decode.

**`<picture>` — format negotiation in production.** `<source type="image/avif">`, then `<source type="image/webp">`, then an `<img>` fallback (JPEG for photos, PNG for graphics). The browser walks the sources in order and uses the first whose `type` it supports; the `<img>` is mandatory — it's both the fallback for browsers that don't support `<picture>` and the element that actually occupies the box. `<picture>` also does art direction (`media` conditions swapping a wide crop for a tall one), which is a different job from format selection but rides the same element.

**`srcset` + `sizes` — resolution selection, a separate axis.** `<picture>`/`type` answers *which encoding*; `srcset` answers *how many pixels*. With width descriptors (`640w, 960w, 1280w`), `sizes` tells the browser how wide the slot will be for a given viewport (`(max-width: 700px) 100vw, 960px`); the browser multiplies the slot by the device pixel ratio and picks the closest candidate that's at least that large. With density descriptors (`640w` replaced by `1x, 2x, 3x`), no `sizes` is needed — use that when the layout size is fixed and only DPR varies. The spec requires `sizes` to appear only when `srcset` uses width descriptors. The two axes compose: `type` on the `<source>` picks the encoding, `srcset`/`sizes` inside it pick the resolution.

**The two fetch attributes.** `decoding="async"` (Topic 1) keeps decode from blocking other painting. `fetchpriority="high"` on the LCP image raises its priority relative to other resources at the same priority level — it does not invent priority where the browser wouldn't have any, and MDN's guidance is to use it sparingly, because mis-prioritization degrades performance for everyone sharing the queue. It's complementary to `preload` (Topic 4): preload fixes *discovery*, fetchpriority fixes *ordering*.

---

### Part 2: Interview Answer

Image optimization runs on three independent axes — format, resolution, and priority — and confusing them is the usual mess.

Format first, with the actual numbers. For photos: AVIF beats WebP beats JPEG. AVIF typically gets you around 50% smaller files than JPEG at equivalent quality, WebP around 25 to 35% — typical ranges, so you measure your own images. For diagrams, screenshots, anything with text, the order flips: PNG with transparency first, then lossless WebP, JPEG last, because JPEG has no lossless mode and its artifacts are plainly visible on text edges. Production mechanism for choosing between them is `<picture>`: an AVIF `<source type>`, a WebP `<source type>`, and an `<img>` fallback — the browser takes the first type it supports, and the `<img>` is required, both as the fallback and as the element that holds the box.

Resolution is a *separate* axis handled by `srcset` and `sizes`. `srcset` lists candidates with width descriptors — 640w, 960w, 1280w — and `sizes` declares how wide the slot will be at a given viewport, so the browser picks the right pixel count for both viewport width and device pixel ratio. When only DPR varies and the layout size is fixed, density descriptors like `2x` do the same job with no `sizes` at all. `<picture>` answers which encoding; `srcset` answers how many pixels; they compose.

Then the fetch attributes. `decoding="async"` lets decode happen without holding up painting of other content. `fetchpriority="high"` on the LCP image lifts it above other images competing at the same priority level — it doesn't override lazy loading, and it doesn't replace preload: preload closes the discovery gap, fetchpriority fixes the order in the queue. The senior version of this answer ends with a checklist, not a single tip: modern format via `<picture>`, responsive candidates via `srcset`/`sizes`, `fetchpriority="high"` on the LCP image, dimensions on everything, and no lazy loading above the fold.

---

### Part 3: Whiteboard / Live Coding

**Format negotiation and resolution switching combined — the production pattern:**

```html
<figure>
  <picture>
    <!-- Axis 1: format. First supported type wins. Widths resolved per source. -->
    <source
      type="image/avif"
      srcset="chart-640.avif 640w, chart-1280.avif 1280w"
      sizes="(max-width: 700px) 100vw, 640px"
    />
    <source
      type="image/webp"
      srcset="chart-640.webp 640w, chart-1280.webp 1280w"
      sizes="(max-width: 700px) 100vw, 640px"
    />
    <!-- Axis 2: resolution, in the mandatory <img> fallback (PNG: lossless, text/diagram) -->
    <img
      src="chart-640.png"
      srcset="chart-640.png 640w, chart-1280.png 1280w"
      sizes="(max-width: 700px) 100vw, 640px"
      width="640"
      height="360"
      decoding="async"
      alt="Weekly throughput by carrier"
    />
  </picture>
</figure>
```

<!-- ILLUSTRATIVE: picture/source type-selection, srcset width descriptors,
sizes-only-with-w-descriptors, and the mandatory <img> child are HTML Standard
semantics (verified via MDN this session). The AVIF/WebP/PNG size relationships
are typical published ranges — content-dependent, measure your own. Width/height
reserve the box (CLS, Session 27 Topic 3). -->

**The LCP image — priority, no lazy loading:**

```html
<!-- In <head>: discovery fix (Topic 4), scoped to the format most users decode -->
<link rel="preload" as="image" type="image/avif" href="hero-960.avif" fetchpriority="high" />

<!-- In <body>: ordering fix — same image, boosted relative to other images -->
<img
  src="hero-960.avif"
  width="960"
  height="720"
  fetchpriority="high"
  decoding="async"
  alt="Map view of active routes"
/>
```

<!-- ILLUSTRATIVE: preload (discovery) and fetchpriority (ordering) are
complementary, per MDN's fetchpriority docs and web.dev's fetch-priority
guidance; priority-queue behavior itself is browser-observable. If the LCP image
lives inside a <picture>, preload it with imagesrcset/imagesizes on the link
(Topic 4), and preload only one format — MDN discourages preloading multiple
types of the same resource. -->

**Density descriptors, when the slot is fixed:**

```html
<!-- Fixed 64px slot (toolbar icon): only DPR varies, no sizes needed -->
<img src="icon-64.png" srcset="icon-64.png 1x, icon-128.png 2x" width="64" height="64" alt="" />
```

<!-- ILLUSTRATIVE: x-descriptors omit sizes by design (MDN responsive images;
the missing descriptor implies 1x). Empty alt is correct for decorative icons
— Session 9's alt-text rules. -->

---

### Part 4: Follow-Up Questions

**Q: WebP is nearly universal now — why bother with `<picture>` at all?**

Two reasons. First, format coverage isn't uniform: AVIF support still has gaps by browser and by version where WebP doesn't, and `<picture>` is how you offer AVIF without breaking the browsers that can't decode it — the `<img>` fallback catches them automatically. Second, `<picture>` is also the only place you can do art direction: a wide crop on desktop and a tall crop on mobile are *different images*, and `media` conditions on `<source>` select between them, while `srcset` alone only selects resolutions of the same composition. If all you need is resolution switching on one layout, plain `srcset` on `<img>` is simpler and `<picture>` is unnecessary — reach for it when encoding or composition must change.

**Q: Should I preload the LCP image, set `fetchpriority="high"`, or both?**

Both, because they fix different subparts. Preload closes *resource load delay*: without it, discovery waits for the parser (or worse, a stylesheet, as Session 27's background-image incident showed). `fetchpriority` closes *ordering*: once several images are in flight, it raises this one above them within its priority class. Preloading without the priority hint still leaves the LCP image competing in the queue; the priority hint without preload still leaves it waiting to be found. One caveat from web.dev: for images sitting in plain HTML, the preload scanner finds them immediately — there, preload is redundant and the priority hint alone is the right tool. Preload earns its place when discovery is genuinely late.

**Q: `2x` vs `480w 960w` — when is each correct?**

Density descriptors (`2x`) when the element's layout size is fixed and only device pixel ratio varies: the browser just picks by DPR, no `sizes` needed. Width descriptors plus `sizes` when the slot width changes with the viewport — full-width heroes, grid images, anything fluid — because the browser must know the slot to compute how many pixels to fetch across both viewport width *and* DPR. Width descriptors are also the more robust default for responsive layouts: with `2x` alone, a phone in a fluid grid still gets a desktop-sized file if you guessed the slot wrong. The spec only permits `sizes` alongside width descriptors, so mixing the two styles in one `srcset` is invalid.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"I export one JPEG per image, maybe 1200px wide, and drop it in with `<img src>`. If Lighthouse complains about image optimization I'll run the file through a compressor."

**Why this misses the point:** One JPEG at one resolution fails on all three axes at once. On format: JPEG is the bottom of the photographic hierarchy (AVIF ~50%, WebP ~25–35% smaller) and the worst possible choice for diagrams and screenshots, where its lossy artifacts land directly on text edges — the student has no content-type rule, just a habit. On resolution: a single 1200px file over-serves every phone in a fluid grid and under-serves every 3× display, with no `srcset`/`sizes` model to explain what the browser would need to choose correctly. On priority: the LCP image has no `fetchpriority="high"`, no preload, no dimensions — so discovery, ordering, and CLS are all unaddressed. `<picture>` is absent entirely, meaning no format negotiation mechanism exists to degrade safely, and lazy loading is either applied everywhere or nowhere because the above-fold/below-fold distinction was never made.

**Senior answer:**
"I treat format, resolution, and priority as three separate decisions. Format by content: AVIF then WebP then JPEG for photos — roughly 50% and 25–35% smaller than JPEG at equivalent quality — and PNG/lossless WebP for screenshots and diagrams, because JPEG's artifacts show on text. Negotiated with `<picture>`: `type` on each `<source>`, mandatory `<img>` fallback. Resolution with `srcset` plus `sizes` for fluid slots, density descriptors when the slot is fixed — distinct from format selection, and combinable with it in the same element. Then priority: `fetchpriority="high"` on the LCP image, preload only if discovery is genuinely late, `decoding="async"` everywhere, `width`/`height` on everything to reserve the box. Above the fold never gets lazy loading; below the fold always does."

**The tell:** The junior answer is one file, one format, one size, reactive to a Lighthouse complaint. The senior answer runs a per-content format policy, a viewport-aware resolution policy, and a priority policy — and can name the number each format choice is expected to save before measuring it.

---

### Part 6: Production Examples

A logistics dashboard's route-map view shipped its hero map as a 1400px JPEG at 780KB — a screenshot-like image with route labels and thin connector lines, precisely the content JPEG handles worst. Field LCP for the map-candidate cohort was 3.4s. The rebuild touched all three axes: AVIF via `<picture>` (JPEG fallback for the two browser families lacking support), `srcset` at 640/960/1400 with `sizes` matching the panel's actual slot (the map sits in a resizable side panel, so width descriptors were the only correct choice), `fetchpriority="high"` plus a preload scoped with `type="image/avif"`, and `width`/`height` lifted from the map export pipeline. The AVIF came in at 310KB and the 640w variant, which phones actually fetched, at 94KB — a 3.3× reduction on the bytes LCP waited for, with the label text *sharper* than the JPEG it replaced, because the artifacts had been a format problem, not a quality-setting problem.

A SaaS onboarding funnel had a four-step wizard whose illustrations were vector-style PNGs and, in the old build, JPEGs — every screenshot had halos around its text and every flat-color illustration showed banding. The team's first pass "fixed" it with quality settings on JPEG, which can't fix what's structurally wrong: JPEG is lossy-only. The correct move per content type: PNG (then lossless WebP) for the illustration set and screenshots, AVIF only for the two photographic images on the marketing header. A build step routed each asset by an `is-photographic` flag from the CMS into the right encoder, and `<picture>` emitted the matching `<source>` list. Screenshot-critical pages dropped 38% of image bytes despite switching to *lossless* encodings — because the PNG path replaced over-compressed JPEGs at sane dimensions rather than smaller-and-mushier ones.

---

## Topic 3 — Font Loading

### Part 1: Theory

Fonts are the one resource on the page that can hold text hostage. Images without their bytes leave an empty box; text whose font hasn't arrived is a rendering decision the browser has to make — show the fallback now, or hide the text and wait. `font-display` is that decision, stated per `@font-face`.

**The timeline model.** The font display timeline starts when the browser first tries to use a font face and splits into three periods: a **block period** (font not available → text rendered with an *invisible* fallback, or not rendered), a **swap period** (fallback is visible; the real font swaps in when it arrives), and a **failure period** (time's up; the fallback sticks for this page view). FOIT — Flash of Invisible Text — is a block period doing its job too long. FOUT — Flash of Unstyled Text — is the swap happening after the user is already reading. Each `font-display` value is a different position on that tradeoff.

**The five values, with their exact timings** (CSS Fonts via MDN and web.dev, verified this session):

| Value | Block period | Swap period | Result |
|---|---|---|---|
| `auto` | Varies by UA | Varies by UA | Chromium and Firefox block up to 3s by default; Safari blocks indefinitely without `font-display` |
| `block` | 2–3 seconds | Infinite | FOIT up to 3s, then fallback; the font still swaps in whenever it finally lands |
| `swap` | 0ms | Infinite | Fallback immediately (FOUT); font swaps in whenever it arrives |
| `fallback` | 100ms | 3 seconds | Brief invisible text, then fallback; swaps only if the font arrives within ~3s |
| `optional` | 100ms | None | Font used only if ready within ~100ms; otherwise the fallback sticks for that page view |

Omitting `font-display` means `auto`, which means "the browser decides" — for a performance-critical decision, that's not a decision.

**What each value costs.** `block` causes FOIT — up to three seconds of invisible text, which is why it's near-universal advice to avoid it, with one exception: icon fonts, where the fallback glyph isn't a different look, it's a *wrong character* (and even there, replacing the icon font with inline SVG is the better answer). `swap` causes FOUT — visible text always, with a possible reflow when the real font lands. `fallback` is the middle: a 100ms block so fast reflows don't happen for fonts that would arrive a moment later, and a 3s swap deadline so a late font doesn't reflow text the user is already reading. `optional` avoids both — no swap ever happens after the block window, so it's zero-CLS by construction, at the cost that this page view may render in the fallback entirely. A cached font file loads fast enough to make `optional`'s window on subsequent visits, which is why it behaves better in practice than the pessimistic reading suggests.

**The two techniques that make `swap` safe.** Session 27 Topic 3's metric-matched fallback: define a fallback `@font-face` aliased to `local()` with `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` set from *both fonts' real metrics*, so the swap moves zero pixels — FOUT with no CLS. And font `preload`: a `@font-face` declaration doesn't trigger a download; the font is fetched only once styles that *use* it are applied, which means discovery waits for CSS. Preloading the first variant needed above the fold closes that gap. Three cautions: preload only that one variant (web.dev: preload bypasses `unicode-range` negotiation, so preloading every subset is a net loss), match `crossorigin` exactly — font requests are always CORS-mode, and a preload without `crossorigin` fetches in the wrong mode, misses the cache, and downloads twice — and for third-party font hosts, preconnect the *stylesheet* origin and the *font-file* origin separately (for Google Fonts: `fonts.googleapis.com` plain, `fonts.gstatic.com` with `crossorigin`).

**The production decision: `optional` or `swap`.** `optional` for fonts where the fallback is fine — decorative, secondary, body text on a system-font-tolerant design: no CLS, no FOIT, no FOUT, and the brand font on cache-warm visits. `swap` plus a metric-matched fallback for brand-critical fonts where rendering in Arial for a network hiccup is unacceptable: text is always visible, and the overrides make the swap invisible. That split — not one value everywhere — is the answer to "what should `font-display` be?"

---

### Part 2: Interview Answer

`font-display` decides what happens to text while its web font is still downloading, and there are five values with precise timings. `block` gives a 2-to-3-second block period — invisible text — then an infinite swap period, so the font still swaps in whenever it lands. `swap` has a 0ms block period and an infinite swap period: fallback visible immediately, real font swapped in whenever it arrives. `fallback` splits the difference: 100ms of invisible text, then the fallback, and the font may still swap — but only if it arrives within about three seconds. `optional` gives a 100ms block and no swap period: if the font isn't ready in that window, the fallback sticks for that page view, which makes it zero-CLS by construction. `auto` is browser-defined, and since omitting the descriptor means `auto`, the default is a decision you didn't make.

The tradeoff underneath is FOIT versus FOUT — invisible text versus unstyled text. `block` gives you FOIT for up to three seconds, which is why it's almost never right, with one exception: icon fonts, where the fallback glyph is a wrong character rather than a different look. `swap` gives you FOUT, and that's acceptable only if the swap doesn't move anything — which is where Session 27's metric-matched fallback comes in: a fallback `@font-face` with `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` set from both fonts' real metrics, so the swap shifts zero pixels.

Two supporting moves. Preload the *first* variant needed above the fold, because `@font-face` doesn't trigger a download — fonts are discovered only after CSS loads — but only that one variant, since preload bypasses `unicode-range` negotiation, and with `crossorigin` matching the CORS-mode font request or you'll download it twice. And preconnect the two separate origins a third-party font host uses.

The decision: `optional` for decorative and secondary fonts where the fallback is fine; `swap` with a metric-matched fallback for brand-critical fonts where the fallback is never acceptable. Nothing about this is one-value-fits-all.

---

### Part 3: Whiteboard / Live Coding

**The full font strategy — connection, discovery, and a zero-CLS swap:**

```html
<head>
  <!-- Two origins for third-party fonts: stylesheet origin, then file origin (CORS) -->
  <link rel="preconnect" href="https://fonts.example-host.com" />
  <link rel="preconnect" href="https://fonts.example-host.com" crossorigin />

  <!-- Only the first variant needed above the fold. crossorigin MUST match:
       font requests are CORS-mode, so this preload is too, or it downloads twice. -->
  <link
    rel="preload"
    as="font"
    type="font/woff2"
    href="/fonts/brand-400-latin.woff2"
    crossorigin
  />
</head>
```

```css
/* Brand-critical: swap is safe because the fallback is metric-matched */
@font-face {
  font-family: "Brand";
  src: url("/fonts/brand-400-latin.woff2") format("woff2");
  font-display: swap;
}

@font-face {
  font-family: "Brand Fallback";
  src: local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

body {
  font-family: "Brand", "Brand Fallback", system-ui, sans-serif;
}

/* Decorative/secondary: never swaps late, never shifts */
@font-face {
  font-family: "Brand Mono";
  src: url("/fonts/brand-mono.woff2") format("woff2");
  font-display: optional;
}
```

<!-- ILLUSTRATIVE: font-display's five values and their block/swap periods
verified against MDN and web.dev this session; the preload-as-font +
crossorigin pattern and the two-origin preconnect shape are MDN/web.dev
documented. The override percentages are illustrative — real values are
measured per font pair with a tool (Fontaine and similar), never guessed;
Session 27 Topic 3 makes the same point. -->

**The decision table, as it gets asked in interviews:**

```
Value       Block    Swap      You see...                  Use when
─────────────────────────────────────────────────────────────────────────────────
auto        UA       UA        whatever the browser does    never ship deliberately
block       2-3s     infinite  invisible, then real font    icon fonts only (fallback glyph
                                                                is actively wrong)
swap        0ms      infinite  fallback, then real font     brand-critical + metric-matched
                                                                fallback (zero-CLS swap)
fallback    100ms    3s        brief invisible, fallback;   middle ground: kill fast-swap
                               swap only if < ~3s           reflows, allow late-but-quick
                                                              fonts to land
optional    100ms    none      fallback unless instant      decorative/secondary fonts;
                               (cached on later visits)     zero CLS by construction
```

<!-- ILLUSTRATIVE: Timing values verified (MDN font-display, web.dev's
font-display table); the "use when" column is the production guidance this
session argues for, not spec text. -->

---

### Part 4: Follow-Up Questions

**Q: Isn't `font-display: swap` just correct — it's what every guide says?**

It's the right default only when the swap is invisible. `swap` guarantees text is never hidden, which fixes FOIT — but it guarantees the swap *happens*, which means layout reflows when metrics differ. Session 27's KPI-grid incident was exactly `swap` plus a bare `sans-serif` fallback: every card re-wrapped, 0.14 CLS from font shifts alone. `swap` is correct *paired with a metric-matched fallback* (`size-adjust`/`ascent-override` etc.), so the swap moves nothing. If you don't have measured override values and can't tolerate any shift, `optional` is the safer single answer: it may show the fallback, but it will never move the page. "Swap everywhere" without overrides is a CLS strategy disguised as a loading strategy.

**Q: I preloaded my font and now it downloads twice. Why?**

Because the preload and the actual font request went in different modes. Font files are always fetched CORS-mode; a `<link rel="preload" as="font">` without `crossorigin` is fetched in no-CORS mode — a different cache key, so when `@font-face` then requests the same URL CORS-mode, it misses and fetches again. The fix is one attribute: `crossorigin` on the preload, *even for a same-origin font*. The same mismatch is the reason a preconnect for the font file needs its own `crossorigin` entry alongside the plain one for the stylesheet origin: connection pools are keyed by CORS mode, and the font's pool is the CORS pool.

**Q: If I preload one variant, what happens to `unicode-range` subsets?**

Preload bypasses that negotiation. `unicode-range` lets the browser fetch only the subset files the page's characters need — Latin here, Cyrillic there — and a preload fetches the exact URL you named regardless. That's why web.dev's guidance is to preload a single font format for the first needed variant only: use it for the above-the-fold body face, and let `unicode-range` do its job for everything below the fold and every other script. If you preload every subset of every weight, you've traded a late-discovered font for a guaranteed multi-file download the page may never use.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use `font-display: swap` — text shows up immediately instead of invisible, so it's better for users. Put it on every `@font-face`."

**Why this misses the point:** The junior answer knows one value and treats the other four as noise. `swap` fixes FOIT but *guarantees* FOUT — and without metric-matched fallbacks the swap reflows text, which is a CLS bug they can't explain (Session 27's font-shift cause is half the CLS work on content-heavy sites). `block` is unknown, so they can't say why it's wrong generally or right for icon fonts; `fallback`'s 100ms/3s split is unknown, so they have no middle-ground option; `optional` — the zero-CLS value — is unknown, so they'd never choose it for decorative fonts. `auto` being the *default when omitted* means their "strategy" may already be unspecified on some faces. The loading side is absent too: no preload of the first variant, no `crossorigin` matching (the classic double-download), no preconnect to the third-party font origins — so the font arrives late for reasons that have nothing to do with the descriptor they did set.

**Senior answer:**
"All five values, with their timings: `auto` (UA-defined — Chromium and Firefox block up to 3s, Safari indefinitely), `block` (2–3s block, infinite swap), `swap` (0ms block, infinite swap), `fallback` (100ms block, 3s swap), `optional` (100ms block, no swap). The tradeoff is FOIT vs FOUT, and the answer is per-face, not universal: `optional` for decorative and secondary fonts — zero CLS by construction; `swap` for brand-critical fonts *paired with a metric-matched fallback* — `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` from measured metrics — so the swap moves nothing; `block` only for icon fonts where the fallback glyph is wrong, and inline SVG instead if I have the choice. I preload exactly the first variant needed above the fold, with `crossorigin` matching the CORS-mode font request, and preconnect the two origins a third-party font host exposes."

**The tell:** The junior answer is one value applied uniformly, justified by "text shows up." The senior answer knows all five with their periods, splits the choice by font role, pairs `swap` with the override technique that neutralizes its only cost, and covers the discovery side — preload scope and CORS mode — that actually determines whether the font arrives in time for any of it to matter.

---

### Part 6: Production Examples

A design-system documentation platform served four weights of the brand face across three scripts. Their original build preloaded all twelve files with `crossorigin` — correct mode, wrong scope — and instrumented the network tab during an audit: every visitor downloaded a 400-weight Latin file they might use plus three weights of a CJK subset that fewer than 2% of sessions had characters for, and because preload ignores `unicode-range`, the browser had no way to skip them. Preload was cut to one file (the 400-weight Latin body face, the only one needed above the fold), the remaining eleven went back to `unicode-range`-gated discovery, and `font-display` was split by role: `swap` with metric-matched overrides for the body and heading faces, `optional` for the icon font and the monospace code face. Initial-view font bytes fell by roughly 70%, and the CLS that had been attributed to code-block reflow disappeared with the `optional` move.

A logistics company's customer-facing tracking page used `font-display: block` on its brand face because an engineer had read that it "guarantees the brand font." On a cold cache over a congested mobile connection the font arrived at 3.4s — so every tracking number on the page was invisible for 3.4 seconds, and support tickets described the page as "blank but loaded." The fix went the other direction from what the ticket suggested: the numbers were content, not branding, so the face moved to `swap` with a metric-matched fallback (the numeric widths had to be measured — a proportional fallback shifted the columns), and the single above-the-fold variant got `preload` with `crossorigin`. Text was visible on first paint in every case; the brand face landed a moment later without moving a column. The postmortem line the front-end lead kept: `block` doesn't guarantee your font — it guarantees your *users wait for it*.

---

## Topic 4 — Resource Hints

### Part 1: Theory

Everything before this topic assumed the browser discovers resources in its own time — preload scanner during parse, stylesheets for CSS-referenced assets, layout for fonts. Resource hints are declarations that change *when* work starts: before the parser reaches the tag, before the request is needed, before the connection exists. All four are `rel` values on `<link>`, and all four are defined in the HTML Standard's link types section (4.6.8) — what separates them is scope (resource vs. origin), timing (this page vs. next), and priority (mandatory vs. advisory).

**`preload` — mandatory, high priority, this page.** Declares a resource the current page definitely needs and starts fetching it immediately at high priority, before discovery would find it. It's not advisory: web.dev is explicit that preload is *mandatory for the browser* while the other hints are executed as the browser sees fit — which is exactly why it can hurt. The `as` attribute is required and load-bearing: it sets the fetch's priority queue, `Accept` headers, CSP checks, and cache matching; without it the resource isn't fetched at all (MDN's `HTMLLinkElement.as`). Related details that show up in real bugs: `type` lets the browser skip formats it can't use (preload AVIF only where supported); `crossorigin` must match the eventual request — fonts are always CORS-mode, so preload without `crossorigin` fetches in the wrong mode and double-downloads; `imagesrcset`/`imagesizes` extend the same selection logic to responsive images; and preloading multiple types of the same resource is discouraged — pick the format most users decode. A preloaded-but-unused resource is wasted bandwidth (it may land in the HTTP cache if headers allow, which is a maybe, not a plan).

**`prefetch` — advisory, low priority, next page.** The HTML Standard's phrasing: preemptively fetching and caching a resource likely to be required for a *followup navigation*. It's a bet on the future, not a need of the present — so it runs at low priority, in time the browser considers idle, and it's entirely the browser's discretion whether to honor it. Right uses: the next page in a known flow (checkout step 2, the article a "continue reading" link points at), route chunks for an SPA's predictable next view. Wrong use: anything the current page needs — that's `preload`'s job, and doing both to the same URL wastes the preload's high-priority bandwidth on a resource also being fetched at prefetch priority.

**`preconnect` — connection setup ahead of the request.** Establishes DNS + TCP (and TLS for HTTPS origins) before any resource from that origin is needed, so the eventual fetch starts with the handshake already behind it (Session 22's full cost stack, paid early). Scope is the origin, not the resource — it benefits every future request to that origin on this page. Two constraints: it only helps *cross-origin* (same-origin connections are already open — MDN is explicit on this), and `crossorigin` must match the mode the eventual requests will use — for font files, a separate `crossorigin` preconnect, because connection pools are keyed by CORS mode. And it doesn't scale: MDN's guidance is that preconnecting every third-party origin is counterproductive; reserve it for the critical one or two.

**`dns-prefetch` — DNS only, the cheap one.** Resolves the hostname and stops there: no socket, no TLS. Cheaper to set up and cheaper to waste, which makes it the right hint for third parties you *might* contact — analytics, an embed, a pixel — where a full preconnect for an origin that never gets used would have paid TCP and TLS for nothing. Classic pairing: preconnect the origin serving this page's critical resources, dns-prefetch the rest.

**Priority semantics in one table:**

```
Hint           Touches              Mandatory?    Priority          Scope
────────────────────────────────────────────────────────────────────────────────
preload        resource fetch        Yes           High (by type)    one URL, this page
prefetch       resource fetch        No (advisory) Low               one URL, next page
preconnect     connection only       No (advisory) n/a (warm-up)     whole origin
dns-prefetch   DNS only              No (advisory) n/a (warm-up)     whole origin
```

**The over-preloading anti-pattern.** Every `rel=preload` is a high-priority fetch inserted into a queue the browser already optimizes — HTML, CSS, scripts, and the LCP image are queued by the scanner, and each extra preload competes with them for bandwidth. web.dev's rule matches the failure pattern: modern browsers are already good at prioritization, so use preload *sparingly*, only for the most critical resources. The sound test is two questions, both of which must pass: does this page definitely need it, and would the browser not discover it early enough on its own? Fonts behind a stylesheet pass both. A `<script>` or `<link>` in `<head>` fails the second — the preload scanner already found it during parse (Session 26), so the preload only adds competition. A plain `<img>` in HTML is the borderline case: the scanner finds it too, so web.dev's guidance there is to reach for `fetchpriority` and reserve preload for discovery that is genuinely late — inside CSS, behind `<picture>` format selection, or injected by JavaScript. Lighthouse's late-discovered-resource audit exists because genuine late discovery is the exception, not the rule.

**Placement.** Hints work only as early as they appear: a preconnect at the bottom of `<head>` has already lost most of the handshake it was meant to front. Put connection hints first, before anything that consumes the connection. The server-side siblings exist too — the HTTP `Link` header and `103 Early Hints` (Session 23's replacement for server push) deliver the same declarations before the HTML body arrives, with one documented limit: responsive-image preloads (`imagesrcset`/`imagesizes`) don't work in headers or Early Hints, because there's no document yet to define a viewport.

---

### Part 2: Interview Answer

Resource hints are four `rel` values on `<link>`, and the way to keep them straight is by what each one touches, when, and whether the browser has to obey.

`preload` is the only mandatory one: a high-priority fetch of a resource this page definitely needs, started before the parser would find it. It's load-bearing on `as` — `as` sets the priority queue, the `Accept` headers, the CSP check, and the cache key; without it the resource isn't fetched at all. `prefetch` is the opposite bet: advisory, low priority, for a resource a *future* navigation will likely need, run in whatever idle time the browser chooses. `preconnect` doesn't fetch anything — it does DNS, TCP, and TLS ahead of time for a whole origin, and only helps cross-origin, with `crossorigin` when the eventual requests are CORS-mode, like fonts. `dns-prefetch` is the cheaper half of that: DNS only, no socket, no TLS — right for third parties you might contact, wrong as a substitute for an origin you're about to hit hard.

The mistake that matters is over-preloading. Each preload is a high-priority, non-negotiable fetch competing with the resources the browser already prioritized — HTML, CSS, and the LCP image. So the rule I apply has two gates, both required: the page must definitely need it, *and* the browser must not discover it early enough on its own. A font referenced from a stylesheet passes both. A script in `<head>` fails the second — the preload scanner already found it, and the preload only adds a competitor.

Placement closes it: connection hints go at the very top of `<head>`, because a preconnect that runs after the resource was already needed has done nothing. And `fetchpriority` composes rather than duplicates — preload fixes *when the fetch starts*, `fetchpriority` fixes *where it sits in the queue*, and the LCP image with both is the concrete case worth memorizing.

---

### Part 3: Whiteboard / Live Coding

**A head where each hint has a justification:**

```html
<head>
  <meta charset="utf-8" />
  <title>Product Page</title>

  <!-- Connection hints FIRST: they must run before anything uses the connection.
       Two entries for the font host: stylesheet origin (no-CORS), file origin (CORS). -->
  <link rel="preconnect" href="https://cdn.shop.example" />
  <link rel="preconnect" href="https://fonts.example-host.com" />
  <link rel="preconnect" href="https://fonts.example-host.com" crossorigin />
  <!-- A third party we may or may not contact: DNS only, nothing warmer. -->
  <link rel="dns-prefetch" href="https://analytics.thirdparty.example" />

  <!-- Preload: the font passes both gates — needed now, discovered only after
       CSS loads. The hero is the LCP image: imagesrcset pins the exact
       candidate before layout and fetchpriority boosts it — web.dev's
       preload + fetch priority pairing (MDN's picture/type preload pattern;
       for a bare <img> the scanner finds it anyway, per Topic 2's Q2).
       as= sets priority/headers/CSP/cache; type= skips formats the UA can't
       use; crossorigin matches the CORS-mode request the font will make. -->
  <link rel="preload" as="font" type="font/woff2" href="/fonts/brand-400.woff2" crossorigin />
  <link
    rel="preload"
    as="image"
    type="image/avif"
    imagesrcset="hero-640.avif 640w, hero-1280.avif 1280w"
    imagesizes="(max-width: 700px) 100vw, 1280px"
    fetchpriority="high"
  />

  <!-- Prefetch: the NEXT navigation's bytes, at low priority, in idle time.
       Deliberately no as= — MDN: as should not be set on rel=prefetch. -->
  <link rel="prefetch" href="/checkout" />

  <style>
    /* critical above-the-fold CSS inlined — Session 26's pattern */
  </style>
  <script src="app.js" defer></script>
</head>
```

<!-- ILLUSTRATIVE: Hint semantics (mandatory preload, advisory prefetch,
DNS+TCP+TLS vs DNS-only, preconnect cross-origin-only) verified against the
HTML Standard link types, MDN, and web.dev this session. The exact priority
each request receives in the browser's queue is browser-observable. The
imagesrcset/imagesizes pair works on link[rel=preload] only — it is not
supported in HTTP Link headers or 103 Early Hints, because those arrive before
a document (and therefore a viewport) exists (web.dev). -->

**The over-preloading anti-pattern, before and after:**

```html
<!-- ANTI-PATTERN: nine preloads, all mandatory, all high priority.
     Every one competes with the HTML, CSS, and LCP image the browser
     already queued correctly. -->
<!--
<link rel="preload" as="script" href="/js/vendor.js" />
<link rel="preload" as="script" href="/js/analytics.js" />
<link rel="preload" as="style" href="/css/app.css" />
<link rel="preload" as="image" href="/img/hero.jpg" />
<link rel="preload" as="image" href="/img/logo.png" />
<link rel="preload" as="image" href="/img/banner-a.jpg" />
<link rel="preload" as="image" href="/img/banner-b.jpg" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/bold.woff2" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/italic.woff2" />
-->

<!-- AFTER: each survivor answers "needed now?" AND "discovered late?"
     vendor.js and app.css are in <head> — the preload scanner already found
     them. logo/banner images are below the fold — lazy, not preload. The
     fonts live in CSS (late discovery) and the hero is the LCP image pinned
     with imagesrcset + fetchpriority: those two are the survivors. -->
```

<!-- ILLUSTRATIVE: The audit shape is web.dev's preload guidance (preload
sparingly; the scanner already handles head resources — Session 26). Which
specific resources are "late-discovered" on a given page is measurable in the
Network panel's initiator column, not assumed. -->

---

### Part 4: Follow-Up Questions

**Q: Should I preload my main JavaScript bundle?**

Almost never. If the `<script>` is in `<head>` or `<body>`, the preload scanner found it during parse — it's already among the first requests, and your preload just inserts a duplicate high-priority competitor (with `as="script"` at least the URLs match and it deduplicates, but you've gained nothing and spent a queue slot). Preload earns its place when discovery is genuinely late: a chunk imported only after other JS executes, a resource referenced solely from a CSS file that itself must arrive first, an image behind `<picture>` format selection or a CSS `url()`. The diagnostic isn't intuition — it's the initiator column in the Network panel: an initiator of a stylesheet or another script means discovery was genuinely late and the preload earned its slot; an initiator of the document or parser means the scanner already had it, and the preload is dead weight.

**Q: `preload` or `prefetch` for the checkout page I know users are going to?**

`prefetch`, because the question was "the *next* navigation" — this page doesn't need checkout's bytes, and prefetch is defined exactly for a resource a followup navigation will likely require: advisory, low priority, in idle time, so it can't hurt this page's LCP by competing for bandwidth. Use `preload` when the resource is needed by the page currently loading — its whole design point is that the fetch is mandatory and high-priority, which is precisely wrong for a speculative bet. And never both on the same URL: you'd pay for the high-priority fetch and then watch the browser make the same request again at prefetch priority.

**Q: preconnect or dns-prefetch for a third-party origin?**

Depends on certainty and mode. `preconnect` pays DNS + TCP + TLS — full handshake skipped — but only for cross-origin, and with `crossorigin` when the eventual requests are CORS-mode (font files always are, which is why a font host usually needs two preconnects: one plain for the stylesheet, one with `crossorigin` for the files; connection pools are keyed by mode). Reserve it for the origin you're *certain* this page will hit, early. `dns-prefetch` pays only the DNS lookup: cheaper, harmless if the origin is never contacted, and MDN's explicit guidance for everything else — when a page would otherwise preconnect many third parties, the count itself becomes counterproductive, so preconnect the critical one and dns-prefetch the rest.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"I put `rel=preload` on everything important in the head — the CSS, the JS, the images, the fonts — so the browser starts them right away. More preloads means more things loading early."

**Why this misses the point:** The junior answer treats preload as "make it fast" rather than "insert a mandatory high-priority fetch," and the quantity *is* the bug. Each preload competes with HTML, CSS, and the LCP image in a queue browsers already order well — nine preloads can raise LCP while every individual one seemed defensible. There's no discovery test: preloading a `<script>` or `<link>` in `<head>` duplicates what the preload scanner (Session 26) already found, so the hint buys nothing. The other three hints are missing entirely — no preconnect for cross-origin origins (so DNS+TCP+TLS still sits in front of the first font or API call), no dns-prefetch fallback for uncertain third parties, no prefetch for predictable next navigations — so the answer can't distinguish this page's needs from the next page's. And the `as`/`crossorigin` mechanics are absent: without `as` the preload isn't fetched at all, and without `crossorigin` fonts download twice.

**Senior answer:**
"I use all four with their priority semantics: `preload` — mandatory, high priority, `as` required for queue placement and cache matching — only when both gates pass: needed by *this* page, and not discovered early enough on its own. LCP image when it's behind `<picture>` or CSS, the first font variant behind the stylesheet; never a script already in the head. `prefetch` — advisory, low priority — for the predictable *next* navigation only. `preconnect` — DNS+TCP+TLS, cross-origin only, `crossorigin` matching CORS-mode font requests — for the one or two origins this page is certain to hit, placed at the top of `<head>` before anything uses the connection. `dns-prefetch` — DNS only, cheapest — for the rest. Over-preloading is the anti-pattern I audit for specifically: every preload line has to justify both gates, because a preload that fails them doesn't add speed, it adds contention."

**The tell:** The junior answer optimizes by count — more hints, more early — with no model of what a mandatory high-priority fetch costs the resources already queued correctly. The senior answer carries the four-way distinction (mandatory vs. advisory, resource vs. origin, this page vs. next), the two-gate preload test, the `as`/`crossorigin` mechanics that decide whether the hint even works, and names over-preloading as the thing to audit for.

---

### Part 6: Production Examples

A marketplace's homepage relaunch added eleven `rel=preload` entries after a "performance checklist" — every hero candidate, three vendor chunks, the icon font, and both stylesheets. Lab Lighthouse dropped six points and field LCP for mobile rose from 2.6s to 3.0s p75: the preloads were all mandatory high-priority fetches, so on a mid-tier Android over 4G the eleven of them were interleaving with the document, the render-blocking stylesheet, and the actual LCP image, pushing the image's bytes later in the queue rather than earlier. The audit kept two: the AVIF hero — pinned early with `imagesrcset` and boosted with `fetchpriority`, the preload-plus-priority pairing web.dev documents for LCP images — and the 400-weight Latin font (referenced only from CSS, the canonical late-discovery case). Everything else was either already in the head (scanner-found), below the fold (lazy), or belonging to a later navigation (prefetch). Field LCP returned to 2.5s — better than the original, because the two survivors were real discovery gaps. The engineer's note on the PR: the checklist that produced the eleven preloads never asked which resources were actually discovered late, which is the only question preload answers.

A travel booking site's search results page preconnected its image CDN and map tile origin — correct — but left the payment and session-API origins cold, so first interaction on a results page paid DNS + TCP + TLS on a fresh connection before the session call went out, adding handshake time to what felt like a slow app. The fix was a `preconnect` for the API origin at the top of `<head>`, plus `dns-prefetch` for two analytics domains they couldn't guarantee would be contacted. The subtle half of the fix: the font provider needed *two* preconnects — plain for the stylesheet origin and `crossorigin` for the file origin — because font files are always requested CORS-mode, and only the no-CORS pool had ever been warmed; a preconnected origin whose right pool is cold still handshakes on first use. Connection hints work per origin *and* per mode, and ignoring the mode half-warms the wrong pool.

---

## Tie the Chain Together

Four techniques, one budget. Lazy loading defers off-screen images, which shrinks the initial request set — those images stop competing with the LCP image's bytes, so LCP's resource load duration improves by subtraction, and the discipline it enforces (never on the LCP image, never above the fold) is what keeps the technique from *adding* resource load delay to the element being measured. Image optimization attacks duration directly: modern formats cut the bytes at equal quality, `srcset`/`sizes` cut them to what the viewport actually needs, and `decoding="async"` keeps the paint from waiting on decode — Session 27's "compress and size it correctly, serve efficient formats" lever, now with the mechanism. Font loading strategy attacks element render delay — the block period is literally time text rendering waits — and CLS, via `optional`'s no-swap guarantee or `swap` plus metric-matched overrides; the honest scope note is that fonts land on loading and stability (FCP/LCP when text is the candidate, CLS on swap) rather than INP, whose budget is long tasks and handlers (Session 27 Topic 2). Resource hints close the discovery gap itself: preload starts a needed-late fetch now, preconnect pays the handshake before the request exists, dns-prefetch pays the DNS step alone, and prefetch moves this work into idle time for the *next* page's LCP instead of this one's. TTFB stays where Session 27 left it — origin and CDN, untouched by any of these.

Session 29 is the same playbook in a different medium: code splitting, bundle strategy, and tree shaking are the JavaScript equivalent of format negotiation, resolution switching, and deferral — deciding which bytes this view needs, which are for a later view, and which should never ship at all.

---

## Cross-References

- Session 12 (`book/02-html-mastery/12-browser-parsing-dom-construction.md`) — the preload scanner and `defer`/`async` semantics; why head scripts and stylesheets need no preload, and what "late-discovered" actually means.
- Session 22 (`book/04-browser/22-dns-tcp-tls-https.md`) — DNS, TCP, and TLS handshake costs; the exact stack `preconnect` pays early and `dns-prefetch` halves.
- Session 23 (`book/04-browser/23-http-versions.md`) — `103 Early Hints` as the server-side sibling of these hints, and the replacement for HTTP/2 server push.
- Session 24 (`book/04-browser/24-caching-cookies-storage.md`) — HTTP cache semantics; whether an unused preload or a prefetched resource is ever seen again depends on the response headers governing that cache.
- Session 26 (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`) — the CRP's two blocking points, the preload scanner, and the `rel=preload` pattern; this session differentiates preload against prefetch/preconnect/dns-prefetch rather than re-deriving it.
- Session 27 (`book/05-performance/27-core-web-vitals.md`) — LCP's four subparts (the budget table at the top of this session), the CLS font cause and metric-matched fallback technique reused in Topic 3, and the field/lab measurement workflow used to judge every technique here.
