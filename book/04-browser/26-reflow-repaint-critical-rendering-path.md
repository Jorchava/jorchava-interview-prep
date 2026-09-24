# Session 26 — Reflow, Repaint, and the Critical Rendering Path

> **Module 4 — Browser.** Session 5 of 5 — final session of Module 4.
> **Chain:** Reflow triggers and propagation scope → layout thrashing → CSS containment → repaint and the cost spectrum → critical rendering path sequence → render-blocking CSS and parser-blocking JS → CRP optimizations.
> This session focuses on Session 25's Stage 6 (Layout) and Stage 7 (Paint) — when each is triggered, how far a reflow propagates, and how to avoid unnecessary triggers. It does not re-derive Stages 1-5 (HTML/CSS parsing, DOM and CSSOM construction, Render Tree construction) or the compositor-thread mechanics of Stages 8-9 — those belong to Session 25 (`book/04-browser/25-rendering-pipeline.md`) and are referenced here, not restated. The critical rendering path sequence reaches back before Stage 1 to the network fetch (Session 22) and forward to First Meaningful Paint, using Session 25's pipeline as its back half. Session 12 (`book/02-html-mastery/12-browser-parsing-dom-construction.md`) covered parser-blocking script mechanics and the `defer`/`async` semantics — this session places that blocking point inside the CRP sequence without re-deriving it. Session 18 (`book/03-css-mastery/18-animations-transforms-transitions.md`) established the compositor-only properties used in the repaint cost spectrum. Module 4 closes after this session; Module 5 (Performance) begins next.

<!-- Module 4 convention: This module covers browser internals and networking
protocols. Pipeline diagrams, timing sequences, invalidation scopes, and stage
descriptions are ILLUSTRATIVE — based on Chrome's "Inside look at modern web
browser" series, MDN, and the CSS Containment spec, but not executed
in-session. CSS containment and critical-rendering-path claims were verified
against current MDN documentation via Context7 this session. Where a claim
couldn't be verified inline, it's marked with <!-- VERIFY -->. This convention
applies to Sessions 22-26. -->

---

## Topic 1 — Reflow: Triggers, Propagation, Layout Thrashing, and Containment

### Part 1: Theory

Reflow is Session 25's Stage 6 — layout recalculation — and the goal of this topic is not just a list of triggers. It's the scope of the damage: how far one style change spreads through the tree, how JavaScript accidentally multiplies the cost, and the CSS mechanism that puts a fence around it.

**What triggers layout.** Anything that changes geometry. The core property list: `width`, `height`, `margin`, `padding`, `border` (the width, not the color), `font-size`, `line-height`, `display`, `position`, `float`, `top`, `left`, `right`, `bottom`. Beyond direct property writes: inserting or removing DOM nodes, changing text content, an image finishing load and contributing its intrinsic size, a web font swapping and re-measuring text, toggling a class whose matched rules include any of the above, and resizing the viewport. All of these invalidate layout, and the browser schedules Stage 6 to re-run before the next paint.

**Propagation scope — the part most answers skip.** The browser does not blindly re-lay out the whole page on every change. It uses invalidation: the style change marks affected nodes as dirty, and layout runs over what needs to recompute. But layout *propagates*. Change a child's `width` and, if the child is in normal flow with auto-sized ancestors, the parent's content box may resize; the parent's parent may resize if its width was content-derived; siblings after the parent shift down or across; percentage-based descendants recompute against new containing-block dimensions; anything downstream that positions relative to those boxes re-lays out. In the worst case — an in-flow element high in a tree of auto-sized ancestors — one property change cascades into a full-page layout. In the best case, the change cannot affect ancestor or sibling sizing: an absolutely positioned element inside a fixed-size containing block, or an element explicitly fenced with `contain: layout`. "Changing margin triggers reflow" is the incomplete version. The accurate version: changing margin triggers layout recalculation for the element and potentially its ancestors and siblings — the scope depends on flow, containing blocks, and containment.

One misconception to kill now: a stacking context does not scope reflow. `z-index` on a positioned element changes paint order and layerization (Sessions 16 and 25) — layout still propagates straight through it. Stacking contexts fence paint; they don't fence layout.

**Layout thrashing.** The anti-pattern is JavaScript alternating reads and writes of layout-affecting properties in a tight loop: read `offsetWidth`, write `style.width`, read `offsetWidth` again, write `style.width` again. The browser batches style changes and runs layout lazily — once, before the next paint — *unless* JavaScript asks for layout-dependent information while invalidations are pending. The reads that force that flush, a "forced synchronous layout": `offsetWidth`, `offsetHeight`, `offsetTop`, `offsetLeft`, `clientWidth`, `clientHeight`, `scrollTop`, `scrollHeight`, `getBoundingClientRect()`, and `getComputedStyle()` (which forces style recalculation, and forces layout too when the value being asked for depends on geometry). Each read-after-write in the loop triggers its own synchronous layout. A hundred-iteration loop that interleaves reads and writes can run layout a hundred times in one frame, against a ~16.7ms budget (Session 25's frame timing). The fix is batching: read every layout metric first, while the tree is clean, then write every style change. Schedule the write batch in `requestAnimationFrame` so it lands at the start of the frame, before layout and paint — Session 25's frame-start guarantee.

**CSS containment — the production tool for scope.** The `contain` property puts an explicit fence around propagation (verified against MDN this session):

- `contain: layout` — internal layout is isolated from the rest of the page, in both directions: nothing outside affects the element's internals, and nothing inside escapes to ancestors or siblings. This is the reflow fence.
- `contain: size` — the element's own dimensions are computed in isolation, ignoring children. Children changing size no longer resize the element, so their changes never propagate outward. Because children don't contribute, the element needs explicit dimensions (or `contain-intrinsic-size` when paired with `content-visibility`).
- `contain: paint` — descendants can't paint outside the element's box; overflow is clipped at the padding-box edge. Off-screen contained boxes can skip painting their contents entirely.
- `contain: style` — effects that normally escape an element, like style counters and quotes, are scoped to it.
- `contain: strict` — shorthand for all four: `size layout paint style`. `contain: content` is the same without `size`: `layout paint style`.

`content-visibility: auto` is the long-page variant. It applies layout, style, and paint containment always, and when the element is not relevant to the user — scrolled off-screen — it skips the contents' rendering entirely: no layout, no paint, until the element approaches the viewport again. Skipped content stays in the DOM, stays focusable and selectable, remains in the accessibility tree, and stays findable via find-in-page — which is why it's safe for real pages in a way that manual `display: none` juggling is not. `contain-intrinsic-size` supplies the placeholder size while contents are skipped, so scrollbar geometry doesn't jump.

Containment is the scalable answer to propagation: not "change fewer properties," but "declare where changes are allowed to reach."

---

### Part 2: Interview Answer

Reflow is layout recalculation, and the thing worth understanding isn't just what triggers it — it's how far it spreads. Anything that changes geometry triggers layout: width, height, margin, padding, border width, font-size, display, position, float, top, left, plus DOM insertion and removal, text changes, images loading, and viewport resize. But the browser doesn't re-lay-out the whole page every time. It marks affected nodes as dirty and recalculates what changed. The catch is that layout propagates. Change an in-flow child's width and its parent may resize, which shifts siblings, which can cascade up through auto-sized ancestors and back down to percentage-based descendants. Worst case, one property change becomes a full-page layout. Best case — an absolutely positioned element in a fixed containing block, or an element fenced with `contain: layout` — the work stays inside the subtree. A stacking context does not help here; that fences paint order, not layout.

Layout thrashing is the JavaScript pattern that multiplies the cost. Alternating reads and writes in a loop — read `offsetWidth`, write `style.width`, read `offsetWidth` again — forces the browser to flush pending style changes and recompute layout synchronously on every read. The properties that force that flush: `offsetWidth`, `offsetHeight`, `offsetTop`, `offsetLeft`, `clientWidth`, `clientHeight`, `scrollTop`, `scrollHeight`, `getBoundingClientRect()`, and `getComputedStyle()`. A hundred-iteration loop can run layout a hundred times against a 16.7ms frame budget. The fix is batching: read all layout metrics first, then write all style changes, and schedule the writes in `requestAnimationFrame` so they land at the start of the frame.

For controlling propagation at scale, CSS containment is the tool. `contain: layout` stops layout changes inside an element from escaping it. `contain: size` computes the element's own dimensions in isolation, so children changing size never resize it. `contain: paint` clips painting to the box, `contain: style` scopes counters and quotes, and `contain: strict` is shorthand for all four. `content-visibility: auto` goes further on long pages: off-screen sections skip layout and paint entirely until they're about to scroll into view, while staying in the accessibility tree and find-in-page index.

---

### Part 3: Whiteboard / Live Coding

**Layout thrashing — the anti-pattern and the batched fix, side by side:**

```typescript
// ANTI-PATTERN: read-write-read-write forces a synchronous layout per iteration
function stackItems(items: HTMLElement[], gap: number): void {
  let nextTop = 0;
  for (const item of items) {
    item.style.top = `${nextTop}px`;  // WRITE — schedules style/layout invalidation
    const h = item.offsetHeight;      // READ  — flushes pending layout: FORCED SYNC LAYOUT
    nextTop += h + gap;               //        one full layout run, right here, per item
  }
}
// 50 items → up to 50 synchronous layouts in a single frame.

// FIX: batch every read while the tree is clean, then batch every write
function stackItemsBatched(items: HTMLElement[], gap: number): void {
  const heights = items.map((item) => item.offsetHeight); // ALL reads first — tree is clean,
                                                          // no invalidations pending: no forced layout
  let nextTop = 0;
  for (let i = 0; i < items.length; i++) {
    items[i].style.top = `${nextTop}px`;                  // ALL writes after — invalidations
    nextTop += heights[i] + gap;                           // batched, flushed once before paint
  }
}
// One layout flush for the whole batch, instead of one per item.
// Heights don't depend on `top`, so reading them before writing is safe here —
// always check that your batched reads aren't supposed to observe your writes.

// Schedule the write batch at the start of the next frame (Session 25)
function stackItemsNextFrame(items: HTMLElement[], gap: number): void {
  requestAnimationFrame(() => {
    stackItemsBatched(items, gap);
  });
}
```

<!-- ILLUSTRATIVE: The forced-layout property set this example depends on —
offsetHeight, offsetWidth, offsetTop, offsetLeft, clientWidth, clientHeight,
scrollTop, scrollHeight, getBoundingClientRect(), getComputedStyle() — was
listed in theory and demonstrated here. The key insight: a read only forces
synchronous layout when invalidations are pending; reads on a clean tree are
free. Batching works because all reads happen before any write invalidates
anything. -->

**Propagation scope — worst case vs. fenced:**

```
WORST CASE — in-flow child, auto-sized ancestors:

  .row-cell { width: 400px }   ← the change
       |
       +--> .row resizes (width was content-derived / flex)
       +--> .table resizes
       +--> toolbar above .table shifts down (margin collapse / flow)
       +--> every percentage-width column header recomputes
       +--> full-page layout possible from ONE property write


BEST CASE — change fenced inside a subtree:

  .widget { contain: layout; width: 320px; height: 200px }
       |
       .widget-child { width: 90% }   ← the change
            |
            +--> child re-lays out inside .widget
            +--> siblings INSIDE .widget may shift
            +--> ancestors and outside siblings: UNTOUCHED

  Also fenced: absolutely positioned element whose containing block
  is fixed-size — out of normal flow, so nothing around it can shift.
```

<!-- ILLUSTRATIVE: Propagation paths depend on the actual layout mode
(normal flow, flex, grid, absolute positioning) — the diagram shows the
common auto-width block case. A stacking context (z-index) is NOT a fence
on this diagram: layout passes through stacking contexts; only paint order
is scoped by them. -->

**CSS containment — the production configuration:**

```css
/* Reflow fence: widget internals can't resize the dashboard grid */
.widget {
  contain: layout;
  width: 320px;   /* explicit size: recommended whenever size may be contained */
}

/* Size containment: children contribute nothing to this box's dimensions */
.card {
  contain: size layout paint;   /* size + layout + paint, individually listed */
  width: 300px;                 /* required — with size containment, children
                                   don't determine height either */
  height: 180px;
}

/* Long-page sections: skip layout + paint off-screen entirely */
.feed-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 480px;  /* placeholder size while skipped;
                                          `auto` remembers the last real size */
}

/* Full isolation — equivalent to: size layout paint style */
.modal-root {
  contain: strict;
}
```

<!-- ILLUSTRATIVE: contain: strict = size layout paint style, and
content-visibility: auto = layout/style/paint containment plus skipping
contents' rendering when off-screen — both verified against MDN this
session. Skipped content remains focusable, selectable, in tab order,
in the accessibility tree, and available to find-in-page. Pair every
content-visibility: auto with contain-intrinsic-size so scroll height
doesn't jump as sections skip and unskip. -->

---

### Part 4: Follow-Up Questions

**Q: Does reading `offsetWidth` always force a synchronous layout?**

No — only when invalidations are pending. The browser keeps layout lazy: style writes mark nodes dirty, and layout runs once before the next paint. A read of `offsetWidth` on a clean tree answers from the last computed layout — it's free. The cost appears exactly when you write, then read, then write, then read: each read finds pending invalidations and forces layout to run *now* so it can return a correct value. This is why "never read layout properties" is the wrong rule — the right rule is never *interleave* reads with writes. Read everything first, write everything second, and layout runs at most once.

**Q: Can I use a stacking context or `will-change: transform` to isolate reflow?**

No. Stacking contexts scope paint order and compositor layerization — Session 16 and Session 25's territory — but layout propagates through them unchanged. `will-change: transform` is in the same category: it promotes a layer, and as a side effect creates a containing block for fixed-position descendants, but it doesn't stop a child's width change from resizing an auto-sized ancestor. The tools that actually fence layout are `contain: layout` (explicit two-way isolation) and positioning an element out of normal flow inside a fixed-size containing block (its changes have nothing in flow to push against). If an interviewer offers "stacking context" as a reflow boundary, that's the moment to correct it.

**Q: You said batch reads before writes — what if my write changes what I need to read?**

Then batching as a single pass doesn't work, and you need a different structure. Options, in order of preference: derive the value you'd have read from data you already have (measure once up front, compute in JS — most layout reads in loops are re-measuring something you already knew); split the work across frames so each frame does one read-then-write cycle without interleaving (rAF from Session 25); or restructure the DOM so measurement doesn't depend on the writes — measure a template/prototype row once and extrapolate, which is how virtualized lists avoid per-item measurement at all. What you never do is interleave inside one loop and hope the browser coalesces it — it can't coalesce across your reads; your read demands an answer now.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Don't change styles in loops — that causes reflow. Batch your DOM writes together, and use `transform` for animations instead of `top` or `left`."

**Why this misses the point:** The junior answer has the right slogans but no mechanism. "Don't change styles in loops" doesn't say which *reads* are dangerous — the student still doesn't know that `offsetWidth` after `style.width` forces a synchronous layout while `textContent` doesn't. It never names the forced-layout properties, so the developer can't audit real code for them. There's no model of propagation: the answer treats reflow as something that happens *to* the element you touched, not something that can cascade through ancestors and siblings to the whole page. And containment — the CSS mechanism that scopes reflow by declaration — is absent entirely.

**Senior answer:**
"Reflow is layout recalculation, triggered by geometry changes, and it propagates: an in-flow child's width change can resize auto-sized ancestors and shift siblings, up to a full-page layout — unless the subtree is fenced with `contain: layout` or the element is out of flow in a fixed containing block. JavaScript makes this worse through layout thrashing: reads of `offsetWidth`, `offsetHeight`, `offsetTop`, `clientWidth`, `scrollTop`, `getBoundingClientRect()`, or `getComputedStyle()` after a style write force the browser to run layout synchronously instead of waiting for the pre-paint flush. The fix is batching — all reads first, all writes second — with the write batch scheduled in `requestAnimationFrame` so it lands at frame start. And for structural isolation at scale, `contain: layout` confines reflow to a widget's subtree so a data update inside one card can't reflow the dashboard around it."

**The tell:** The junior answer recites rules without naming a single forced-layout property or the propagation model. The senior answer names the specific reads that force layout, explains *why* they force it (pending invalidations flushed on demand), gives the batching fix with its rAF scheduling detail, and reaches for `contain: layout` when the scope problem is structural rather than loop-local.

---

### Part 6: Production Examples

A team building a logistics operations console had a live-updating shipment table — 300 rows, status cells refreshing every few seconds as GPS pings arrived. The update routine, for each changed row, set `cell.style.width = "140px"` and then read `cell.offsetWidth` to decide whether to truncate the tracking number, then set `cell.style.width = "180px"` for long numbers and read `offsetLeft` to align a badge. The Performance panel showed 300+ forced synchronous layouts per refresh cycle — the loop interleaved writes and reads exactly the way the anti-pattern describes. On a mid-range laptop the table alone consumed 40-60ms of main-thread layout per refresh, and scroll input queued behind it. The fix was structural batching: one pass reading every row's text length and current metrics into an array, then one pass writing the final widths and badge positions, scheduled in `requestAnimationFrame`. Layout runs once per refresh instead of once per row. The table went from visibly janky updates to imperceptible ones — same data, same visual result, one-tenth the layout work.

A different team ran a fleet-monitoring dashboard where every panel was a self-contained widget — map, alert list, throughput chart, each fed by independent WebSocket streams. Before containment, a chart data point changing a label's text could resize the label, resize its panel header, push the chart canvas down, and reflow the dashboard grid — one websocket message, page-wide layout. They applied `contain: layout` plus explicit dimensions on each widget root. Layout changes from one widget's data stream stopped at its border; the grid re-laid-out only when widgets were actually added or removed. The long alert history below the fold got `content-visibility: auto` with `contain-intrinsic-size` set to the panel's measured height — off-screen entries skipped layout and paint entirely while the list grew to thousands of rows, and find-in-page still located alerts inside skipped sections.

---

## Topic 2 — Repaint, and the Cost Spectrum

### Part 1: Theory

Repaint is Session 25's Stage 7, and Topic 1 covered when Stage 6 re-runs. This topic covers the change class that skips Stage 6 entirely, and the three-tier cost model that separates candidates who memorize "use transform" from candidates who can reason about *why* any given property change is expensive.

**What repaints without reflowing.** A change repaints without reflow when it affects how pixels are drawn but not where boxes are. The canonical list: `color` (text color), `background-color`, `box-shadow`, `outline`, `border-color` — color only, not `border-width` — and toggling `visibility` between `hidden` and `visible`. None of these alter an element's measured size or position, so the Render Tree's geometry is already correct; the browser recalculates style, skips layout, and re-runs paint on the affected layers. `visibility` deserves the emphasis Session 25 set up: a `visibility: hidden` element still occupies layout space — it's in the Render Tree, siblings sit around it as if it were shown — so flipping it to `visible` paints pixels into a box that was already laid out. Flipping `display` instead is a reflow operation: it adds or removes the element and its subtree from layout, and everything downstream repositions.

**The distinction, stated as pipeline movement.** Reflow: style change → layout → paint → composite. Repaint: style change → paint → composite — layout is skipped because geometry didn't change. The scope of a repaint is layer-level, not page-level: Session 25 established that paint produces draw calls per layer, so only layers whose pixels changed get new draw calls. A `background-color` change on one card repaints the card's layer, not the document.

**The full cost spectrum.** Three tiers, most to least expensive:

1. **Reflow** (geometry: `width`, `margin`, `top`, `display`, `font-size`) — style, layout, paint, composite. Layout is the tree-wide propagation risk from Topic 1; paint and composite follow it.
2. **Repaint** (visual-only: `color`, `box-shadow`, `visibility`, `border-color`) — style, paint, composite. Skips layout entirely; cost scales with the paint area and layer count touched.
3. **Composite-only** (`transform`, `opacity`, `filter`, `clip-path` on a promoted layer — Session 18's list, Session 25's mechanism) — style calculation, then composite on the compositor thread. Skips layout *and* paint; runs off the main thread so JavaScript keeps executing.

A senior answer treats that hierarchy as the decision procedure: when choosing how to implement a visual effect, pick the cheapest tier that produces the required visual result. Hover lift that only needs vertical movement → `transform: translateY`, not `top` (tier 3, not tier 1). Status dot appearing → `visibility`, not `display` (tier 2, not tier 1). Color-theme swap → repaint is inherent, and repaint is acceptable — you can't composite a new `background-color`, and pretending every style change is a layout disaster is its own kind of wrong. The junior failure mode is treating all three tiers as one undifferentiated "style changes are slow"; the senior failure mode — rarer, but real — is refusing to use a tier-1 or tier-2 change when the visual genuinely requires one. Measure, know which stage you're paying for, and spend it deliberately.

---

### Part 2: Interview Answer

Not every style change costs the same, and the reflow-versus-repaint distinction is where that cost hierarchy starts. Reflow is geometry — anything that changes size or position, like width, margin, top, or display, runs layout, and layout propagates through ancestors and siblings. Repaint is visual-only: if a change doesn't affect geometry, the browser skips layout entirely and goes from style recalculation straight to paint, then composite.

The properties that repaint without reflowing are colors and effects: `color`, `background-color`, `box-shadow`, `outline`, `border-color`, and toggling `visibility` between hidden and visible. Visibility is the instructive one. A hidden element still holds its layout space — it's in the Render Tree, siblings are positioned around it — so showing it paints into a box that was already laid out and moves nothing. Toggle `display` instead and you're back in reflow, because display changes add or remove elements from layout.

Paint isn't free, but it's cheaper than layout, and it's scoped to the affected layers — only layers whose pixels changed get new draw calls.

Then there's the cheapest tier. `transform`, `opacity`, `filter`, and `clip-path`, animated on a promoted layer, skip layout and paint both, and the compositor thread handles them off the main thread — Session 18's compositor-only properties, running on Session 25's separate thread.

So the spectrum, most to least expensive: reflow runs layout, then paint, then composite; repaint skips layout; composite-only skips both. Treating a color change like a width change over-worries in the cheap direction — the color change was fine. Treating a width change like a color change under-worries in the expensive direction, and that's the mistake that causes jank. The senior habit is knowing which stage a property forces before you write it.

---

### Part 3: Whiteboard / Live Coding

**The cost spectrum — which stages each change class re-runs:**

```
Change class          Example properties          Stages re-run              Thread path
──────────────────────────────────────────────────────────────────────────────────────────
1. REFLOW             width, height, margin,      Style → Layout →           Main thread →
   (geometry)         padding, border-width,      Paint → Composite          Compositor
                      font-size, display,
                      position, float, top, left

2. REPAINT            color, background-color,    Style → Paint →            Main thread →
   (visual-only)      box-shadow, outline,        Composite                  Compositor
                      border-color,
                      visibility: hidden/visible

3. COMPOSITE-ONLY     transform, opacity,         Style → Composite          Main thread (style
   (promoted layer)   filter, clip-path                                      only) → Compositor
                                                                        thread handles rest
```

<!-- ILLUSTRATIVE: Tier 3 assumes the element has its own compositor layer
(active animation, will-change, or 3D transform — Session 25's promotion
list). Without promotion, an opacity change is painted into the shared layer
and costs tier 2. Tiers are relative: a paint across a full-screen layer can
cost more than layout on three small boxes — the ranking is about what stages
run, not a guarantee about wall-clock time. -->

**Property-to-stage decision table — the classification drill:**

```
Statement in code                     Geometry changed?  Stage(s) re-run   Tier
────────────────────────────────────────────────────────────────────────────────
el.style.color = "#333"               No                 Paint             2
el.style.backgroundColor = "#eee"     No                 Paint             2
el.style.boxShadow = "0 2px 4px #000" No                 Paint             2
el.style.borderColor = "#f00"         No                 Paint             2
el.style.visibility = "hidden"        No (still occupies) Paint            2
el.style.display = "none"             Yes (out of flow)  Layout+Paint      1
el.style.width = "400px"              Yes                Layout+Paint      1
el.style.marginTop = "16px"           Yes                Layout+Paint      1
el.style.fontSize = "20px"            Yes (text metrics) Layout+Paint      1
el.style.transform = "translateX(4px)" No (own layer)    Composite         3
el.style.opacity = "0.9"              No (own layer)     Composite         3
```

<!-- ILLUSTRATIVE: "No geometry changed" skips layout only when no OTHER
pending invalidation exists — tiers assume a clean tree, one change, measured
in isolation. visibility: hidden listed as tier 2: Session 25 established it
stays in the Render Tree, so toggling it never touches layout. -->

**Choosing the cheapest tier that delivers the effect:**

```typescript
// Tier 1 by accident — "lift on hover" implemented with geometry
// CSS: .card { transition: top 150ms; } .card:hover { top: -4px; }
// → layout every animation frame (top is geometry), then paint, then composite

// Tier 3 — same visual result, compositor-thread only
// CSS: .card { transition: transform 150ms; } .card:hover { transform: translateY(-4px); }
// → style calculation, then composite on the compositor thread (Session 25)

// Tier 2 vs tier 1 — status dot appears in a table cell
// dot.hidden = false;              // where CSS is .hidden { visibility: hidden; }
// → paints into already-laid-out space: no reflow
// cell.appendChild(dot);           // alternative if the node wasn't in the DOM
// → insertion re-flows the row and everything after it: tier 1
```

<!-- ILLUSTRATIVE: The three pairings show the decision procedure, not a
benchmark. Same visual outcome, different stages — the senior question is
always "which tier am I paying for, and is it the cheapest one that works?"
Note visibility vs DOM insertion: a pre-existing hidden node toggling to
visible is repaint; adding a new node is reflow regardless of its styling. -->

---

### Part 4: Follow-Up Questions

**Q: Why is repaint cheaper than reflow if both touch pixels?**

Because repaint skips layout — and layout is the expensive part. Layout is a tree-wide geometry pass with propagation: one dirty node can pull ancestors, siblings, and descendants into recomputation. Repaint starts from already-correct boxes; it only generates new draw calls for the layers whose pixels changed. Paint cost then scales with *area* — repainting a full-screen gradient layer costs more than repainting a 12px status icon — but it never has the propagation risk layout has. Composite, below both, assembles existing painted layers without regenerating any of their pixels.

**Q: Is `opacity: 0.8` a repaint or composite-only?**

Depends entirely on layer promotion — Session 25's model decides. If the element has its own compositor layer — active opacity animation, `will-change: opacity`, a 3D transform — the compositor applies the new alpha when assembling layers: composite-only, tier 3, main thread does style calculation and stops. If the element is painted into a shared layer, changing its opacity changes that layer's pixels: the layer repaints, then composites — tier 2. This is why promotion heuristics matter for animation but a static `opacity: 0.8` sitting on an unpromoted inline element is just a paint-time constant folded into the existing draw calls — no separate "opacity pass" at all. The property name alone never tells you the tier; property plus promotion state does.

**Q: Can hover effects be made composite-only, and should they be?**

Where the visual allows it, yes: hover states built on `transform` and `opacity` run in tier 3 — the compositor handles them without touching layout or the main thread's paint step. A `translateY(-2px)` lift or an `opacity` fade is the standard move. `box-shadow` on hover is tier 2 — repaint of the hovered layer — and that's usually fine at the size of one button; the cost only becomes a problem when the repaint area is huge (a full-width card with a large blur radius) or the hover fires across many elements at once (`:hover` cascading through a nested tree and repainting dozens of layers). Should you always push to tier 3? No — a hover that changes border-color to match a design-system token is a legitimate tier-2 change; forcing it into `transform` hacks would be optimizing for the metric instead of the design. Use the DevTools paint-flashing overlay (Session 25's Layers/Paint tooling) to see what you're actually paying for, then move a tier only when the payment shows up in a profile.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Any style change causes reflow, so minimize how many styles you change. Use `transform` and `opacity` for animations because they're GPU-accelerated, and try not to touch styles on hot paths."

**Why this misses the point:** The junior answer collapses three distinct costs into one. "Any style change causes reflow" is false — `color`, `box-shadow`, and `visibility` never run layout — and the falseness cuts both ways: it makes a cheap repaint look dangerous, and it hides the fact that some changes are *cheaper* than the answer implies. "GPU-accelerated" is a magic-phrase substitute for mechanism; the senior reason `transform` is cheap is that it skips layout and paint and runs on the compositor thread, not that it uses some vague accelerator. There's no named spectrum, no examples sorted into tiers, and no guidance for when a reflow is the *correct* choice because the effect genuinely changes geometry.

**Senior answer:**
"There's a three-tier cost spectrum. Reflow — geometry changes like width, margin, top, display — runs style, layout, paint, and composite; layout is expensive and propagates. Repaint — visual-only changes like color, background-color, box-shadow, border-color, and visibility toggles — skips layout and runs style, paint, composite, scoped to the affected layers. Composite-only — transform, opacity, filter, clip-path on a promoted layer — skips layout and paint both and runs on the compositor thread while JavaScript keeps going. The decision procedure is: pick the cheapest tier that produces the required visual. Hover lift → transform, not top: tier 3 instead of tier 1. Status dot → visibility on a pre-existing node, not display: tier 2 instead of tier 1. Theme colors → repaint, because you can't composite a new background-color, and that's a price worth paying. Knowing the tiers means you stop treating all style changes as one undifferentiated cost — and you stop paying tier-1 prices for tier-3 visuals, which is where jank actually comes from."

**The tell:** The junior answer asserts that all style changes are expensive and offers "GPU-accelerated" as the mechanism. The senior answer names all three tiers with the stages each one runs and the properties that land in each, frames optimization as a spectrum decision rather than a prohibition, and accepts tier-1 and tier-2 costs when the visual requires them.

---

### Part 6: Production Examples

A team shipping a dark-mode feature spent two sprints convinced the theme toggle would be a performance problem — they'd internalized "style changes cause reflow" and scoped the work as a full-page optimization project. When they actually profiled the toggle in the Performance panel, it was repaint-only: the swap changed `color`, `background-color`, `border-color`, and `box-shadow` tokens through CSS custom properties (Session 20's theming pattern), all visual-only properties. No layout stage ran. The remaining cost was paint area — the whole viewport's layers repainting — which came in at 8-12ms on a mid-range device: acceptable, and not where the jank they'd remembered was coming from. The actual slow path, found in the same session, was a modal that toggled `display` on open and reflowed a 2,000-row table underneath. The team fixed the modal (pre-rendered, `visibility`-toggled — tier 2) and shipped dark mode without touching the token system. The lesson the staff engineer wrote into the team wiki: profile the stage before optimizing the stage.

A design system's component gallery had a card grid where cards lifted on hover using `top: -4px` with a CSS transition — inherited from an older implementation that predates the team's transform conventions. On pages with 40+ cards, moving the mouse across the grid caused visible stutter: every frame of every hover transition re-ran layout (geometry change), then paint, then composite, and the cards below each shifted in the layout pass even though the visual design never asked them to move. The fix was one line per component: `transform: translateY(-4px)` instead of `top: -4px`, same 150ms transition, same visual result. Hover animations dropped to tier 3 — style calculation plus compositor-thread work — and the stutter disappeared on the same hardware. A follow-up audit found three other components making the same tier mistake (`left` on a sliding tooltip, `height` on an expanding accordion) and moved them to `transform`/`opacity` where the visual allowed it; the accordion's height animation stayed a deliberate tier-1 choice, because its visual *is* geometry, and the team accepted that cost with explicit dimensions instead of fighting it.

---

## Topic 3 — The Critical Rendering Path

### Part 1: Theory

The critical rendering path is the sequence from HTML byte to First Meaningful Paint — and unlike the pipeline Session 25 documented from the inside, the CRP is the *latency* view: which steps must complete before the user sees anything, and which resources block them. Every first-load optimization worth doing maps to a blocking point in this sequence.

**The sequence, in order:**

1. **Request HTML** — the URL goes through DNS, TCP, TLS (Session 22's chain).
2. **Receive HTML** — response bytes arrive; caching (Session 24) decides cache vs. network, but either way bytes land.
3. **Parse HTML** — tokenizing and tree construction begin incrementally (Session 25, Stage 1-2).
4. **Discover critical resources** — while parsing, the browser finds `<link rel="stylesheet">` tags and `<script>` tags; the preload scanner runs ahead of the main parser to start fetches early (Session 12).
5. **Fetch CSS and JS** — those resources download; HTTP/2 multiplexing (Session 23) determines how they share connections.
6. **Build DOM + CSSOM** — HTML tokens → DOM (Stage 2); CSS bytes → CSSOM (Stages 3-4).
7. **Render Tree** — DOM + CSSOM combined, visible nodes only (Stage 5).
8. **Layout** — geometry computed (Stage 6, Topic 1).
9. **Paint** — draw calls generated (Stage 7, Topic 2).
10. **First Meaningful Paint** — the first frame with meaningful content on screen.

Steps 1-5 are the front half — network and discovery — and steps 6-9 are Session 25's pipeline. The CRP's blocking points live in the seams.

**Blocking point 1: CSS blocks rendering.** The browser will not paint until the CSSOM is built from *every* discovered stylesheet. The reason is cascade correctness — a later rule could override an earlier one, so painting before the cascade resolves risks showing wrong styles (Session 15's rules executing to their conclusion). Practical consequence: a `<link rel="stylesheet">` at the top of `<head>` delays first paint by the full fetch time of every byte of that CSS. Not a chunk of it. All of it. A 200KB stylesheet on a 200ms connection pushes first paint out by that download, every cold visit. Session 24's cache headers determine whether that cost repeats or is paid once.

**Blocking point 2: parser-blocking JavaScript blocks HTML parsing.** A `<script>` without `defer` or `async` stops the HTML parser until the script downloads and executes — Session 12 covered the mechanics (`document.write()` compatibility is the historical reason) and the `defer`/`async` semantics; this session only places the block in the sequence: parser halted → DOM construction halted → every resource and node *after* the script in document order waits → Render Tree, layout, and paint for that content wait. Scripts are not render-blocking in themselves — they're parse-blocking, and parse-blocking delays render indirectly by delaying the DOM the Render Tree needs.

**Optimizations as responses to the two blockers:**

- **Inline critical CSS** — put above-the-fold rules directly in a `<style>` block in `head`. The bytes arrive inside the HTML response: no separate fetch, no round trip, CSSOM can start building immediately. This removes the CSS fetch from the CRP. Tradeoff: those bytes can't be cached separately from the HTML, and HTML grows — inline the *critical subset*, not the whole bundle.
- **`defer` / `async` for JavaScript** — removes the script from the rendering path: the parser keeps going, DOM construction isn't gated, paint isn't waiting on the script's download. `defer` executes after parsing, in order, before `DOMContentLoaded`; `async` executes whenever the download finishes, order not guaranteed (Session 12 — use `defer` when the script needs the DOM or peers, `async` when it's independent). The script still matters for *interactivity* — that's a different critical path, which Module 5 picks up.
- **Preload critical resources** — `<link rel="preload">` starts a fetch before the parser would discover the resource naturally, saving the discovery gap. Useful for fonts and LCP images referenced late or only from CSS, where discovery is otherwise delayed.
- **Minimize render-blocking size** — minify, enable compression (gzip/brotli — Session 23's territory), and split CSS so only above-the-fold rules are render-blocking; defer the rest via non-blocking load. This shrinks what each remaining blocker has to deliver.

The unifying model: find the blockers in *your* sequence — the CSS fetches that gate paint, the scripts that gate parsing — and remove or shrink each one. The optimization list follows from the blocking model; it isn't a separate list to memorize.

---

### Part 2: Interview Answer

The critical rendering path is the sequence from HTML bytes to First Meaningful Paint, and almost every first-load performance problem traces back to one of its two blocking points. The sequence: the browser requests HTML — DNS, TCP, TLS — receives it, starts parsing incrementally, and while parsing discovers the critical resources: stylesheets and scripts. It fetches those, builds the DOM from the HTML and the CSSOM from the CSS, combines them into the Render Tree, runs layout, paints, and the first meaningful frame appears. Steps six through nine are Session 25's pipeline; the CRP is the latency view of the whole thing.

The first blocking point is CSS. The browser won't paint until the CSSOM is complete from every discovered stylesheet — later rules can override earlier ones, so painting before the cascade resolves would flash wrong styles. The consequence: a stylesheet link at the top of head delays first paint by the full download time of every byte it references.

The second blocking point is JavaScript. A script tag without `defer` or `async` stops HTML parsing until the script downloads and executes — Session 12 covered why — so DOM construction halts, and everything after the script waits, including the Render Tree for that content.

Every optimization is a response to one of those blockers. Inline critical CSS puts above-the-fold rules in the HTML itself, removing the stylesheet fetch and its round trip from the path entirely — tradeoff: those bytes can't be cached separately, so inline the critical subset, not the bundle. `defer` and `async` take JavaScript off the rendering path: the parser keeps going, so the script no longer gates paint — `defer` for scripts that need the DOM, `async` for independent ones. Preload starts a known-critical fetch before the parser discovers it, saving the discovery delay. And shrinking what remains — minify, compress, split the CSS bundle so only above-the-fold rules block — shortens each blocker's hold. The senior framing: don't memorize the optimization list. Walk your own sequence, find what blocks paint and what blocks parsing, and remove those.

---

### Part 3: Whiteboard / Live Coding

**The CRP sequence with blocking points marked:**

```
[1] Request HTML ──► [2] HTML bytes arrive ──► [3] Parse HTML
                                                      |
                              discover critical resources (preload scanner ahead of parser)
                                                      |
                        ┌─────────────────────────────┼─────────────────────────────┐
                        ▼                             ▼                             ▼
                 [4a] Fetch CSS                [4b] Fetch JS                [4c] Images/fonts
                        │                       no defer/async:               do not block
                        │                       BLOCKS PARSER ──┐             first paint
                        ▼                                      │             unless LCP
                  BLOCKS RENDERING                             ▼
                  (no paint until                       Parser halted:
                   every stylesheet                     DOM for content after
                   is in the CSSOM)                     the script waits
                        │                                      │
                        └──────────────┬───────────────────────┘
                                       ▼
                        [5] DOM + CSSOM complete
                                       ▼
                        [6] Render Tree ──► [7] Layout ──► [8] Paint
                                       ▼
                        [9] FIRST MEANINGFUL PAINT
                                       ▲
                                       │
              Blockers delay THIS point: CSS fetch time sits on the path;
              parser-blocking JS sits on the path for everything below it.
```

<!-- ILLUSTRATIVE: Simplified — in practice HTML parsing, CSS fetching,
and DOM building overlap (Session 25's note about concurrent stages), and
the preload scanner starts resource fetches before the main parser reaches
their tags. The blocking relationships are the load-bearing part: render-
blocking CSS gates step [8] for the whole page; parser-blocking JS gates
step [5] for everything after the script in document order. -->

**Before / after — the same page with the blockers removed:**

```html
<!-- BEFORE: both blockers on the critical path -->
<head>
  <meta charset="utf-8" />
  <title>Ops Console</title>
  <link rel="stylesheet" href="app.css" />   <!-- 240KB: blocks first paint in full -->
  <script src="vendor.js"></script>          <!-- no defer: blocks the parser -->
  <script src="gateway.js"></script>         <!-- no defer: blocks the parser again -->
</head>

<!-- AFTER: each optimization mapped to the blocker it removes -->
<head>
  <meta charset="utf-8" />
  <title>Ops Console</title>

  <!-- Inline critical CSS: removes the critical stylesheet FETCH from the CRP.
       Only above-the-fold rules — shell, header, hero. Not the whole bundle. -->
  <style>
    .app-shell { display: grid; grid-template-rows: 56px 1fr; min-height: 100vh; }
    .app-header { display: flex; align-items: center; gap: 16px; background: #fff; }
    .hero-title { font-size: 28px; line-height: 1.2; margin: 24px; }
    /* ...above-the-fold rules only... */
  </style>

  <!-- Full stylesheet: loaded WITHOUT blocking paint (preload + swap pattern).
       noscript fallback keeps no-JS clients styled. -->
  <link rel="preload" href="app-full.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'" />
  <noscript><link rel="stylesheet" href="app-full.css" /></noscript>

  <!-- LCP image: discovered and fetched before the parser reaches it -->
  <link rel="preload" href="hero.webp" as="image" />

  <!-- Scripts: OFF the rendering path — parser never stops.
       defer = needs DOM/order (runs after parse, before DOMContentLoaded)
       async = independent (runs whenever ready, no order)  (Session 12) -->
  <script src="vendor.js" defer></script>
  <script src="app.js" defer></script>
  <script src="analytics.js" async></script>
</head>
```

<!-- ILLUSTRATIVE: The preload+onload swap is the standard non-blocking
stylesheet pattern; the noscript fallback is required because the onload
attribute never runs without JS. defer/async semantics are NOT re-derived
here — Session 12 (book/02-html-mastery/12-browser-parsing-dom-construction.md)
is the source. Inline critical CSS bytes count toward HTML size and can't
cache separately: the tradeoff is deliberate, scoped to above-the-fold rules. -->

**Timeline — what each optimization removes:**

```
BEFORE (cold cache):
HTML ──parse──► discover app.css ──► wait 240KB download ──► CSSOM ──┐
          └──► discover vendor.js ──► parser HALTED ──► execute ─────┤
                                                                     ▼
                                                    Render Tree ──► Layout ──► Paint (FMP)
                                                    ◄──── 2 network round trips +
                                                           240KB + script exec on the
                                                           critical path ────►


AFTER (inline critical CSS + defer):
HTML (critical CSS already in the bytes)
   ├──► CSSOM for critical rules starts IMMEDIATELY (no fetch)
   ├──► parser runs to completion — vendor.js/app.js download in parallel, execute later
   ├──► Render Tree ──► Layout ──► Paint (FMP)   ← no CSS-wait, no script-wait
   └──► app-full.css + hero.webp load in background (non-blocking);
        defer scripts execute before DOMContentLoaded (interactivity path, not paint path)
```

<!-- ILLUSTRATIVE: Timings are schematic, not measured. The structural
claim: FMP waits on (critical CSS bytes inside HTML) + (HTML itself) — one
fetch instead of two-plus — and nothing waits on script execution.
app-full.css applies whenever it lands (progressive enhancement of styles);
below-the-fold restyle may repaint after it arrives — accepted tradeoff of
splitting CSS off the critical path. -->

---

### Part 4: Follow-Up Questions

**Q: Does `defer`/`async` remove JavaScript from the critical rendering path entirely?**

From the *rendering* path, yes — that's the point. Neither attribute blocks HTML parsing, so DOM construction isn't gated on the script, and paint doesn't wait for its execution. But the script often remains on the *interactivity* path: a deferred framework bundle still has to execute before the page responds to input, before `DOMContentLoaded` fires, before hydration or widget init completes. So the accurate statement is: `defer`/`async` moves JavaScript off the critical *rendering* path and onto the critical *interaction* path (or, for `async` independent scripts, onto no ordered path at all). Module 5's sessions on Core Web Vitals and code splitting pick up that distinction — INP and TTI care about the interaction path; FCP and LCP care about the rendering path the CRP describes.

**Q: Why not just inline all the CSS and eliminate the stylesheet blocker completely?**

Because you'd trade a network problem for a caching and payload problem. Inlined bytes live inside the HTML document: they can't be cached and reused independently — every HTML response carries the full stylesheet, even to returning visitors whose CSS hasn't changed in months. The HTML itself grows, delaying its own parse. And every CSS change busts the HTML cache entry for a document whose markup didn't change. The senior move is the split: inline the critical above-the-fold subset — a few KB that unblocks first paint inside the HTML fetch itself — and load the full stylesheet non-blocking (the preload-swap pattern in Part 3), so its cost lands after FMP and its cache entry stands alone. The blocker you remove is the critical-path fetch; the stylesheet still arrives, just off the path.

**Q: First Meaningful Paint — is that still the metric?**

The sequence keeps the name because it names a real moment: the first frame with meaningful content. As a *metric*, FMP has largely given way to First Contentful Paint (first any content painted) and Largest Contentful Paint (largest visible element painted) — the numbers teams report and budgets teams set are FCP/LCP now, and Module 5's Core Web Vitals session covers measuring and improving them. What didn't change is the blocking model underneath: LCP elements are painted through the same CRP, delayed by the same render-blocking CSS and the same parse-blocking scripts. Optimizing FMP by removing blockers optimizes LCP by the same mechanism — you're shortening the same sequence, just measuring a different point at the end of it.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Put your JavaScript at the bottom of the body so it doesn't block rendering, minify your CSS, and use gzip. Also add `async` to scripts — it's faster than `defer`."

**Why this misses the point:** The junior answer is a list of tricks detached from the model. "Bottom of body" is the pre-`defer` era workaround — Session 12 established this — and it still blocks parsing once the parser reaches the scripts; it just moves the block later. The answer can't say *what* is being blocked (parsing? rendering? both?) or *why* CSS delays paint (cascade completeness — any later rule could override). "`async` is faster than `defer`" repeats the Session 12 mistake of optimizing for execution timing instead of dependencies. And there's no sequence — without walking HTML → discovery → fetch → DOM+CSSOM → Render Tree → Layout → Paint, the optimizations can't be derived; they can only be recalled, which fails the moment the interviewer changes the scenario.

**Senior answer:**
"The critical rendering path runs: HTML request, response, incremental parsing with resource discovery, CSS/JS fetch, DOM and CSSOM construction, Render Tree, layout, paint, First Meaningful Paint. Two things block it. CSS blocks rendering — the browser won't paint until every discovered stylesheet is in the CSSOM, because a later rule could override an earlier one, so a stylesheet link at the top of head delays first paint by that file's full download. Parser-blocking JavaScript blocks parsing — no `defer` or `async` halts the parser, so everything after the script waits for the DOM, which waits for paint. Every optimization maps to one of those blockers: inline critical CSS removes the critical stylesheet fetch from the path — at the cost of those bytes living in uncached HTML; `defer`/`async` removes scripts from the rendering path — `defer` when the script needs the DOM or order, `async` when it's independent; preload closes the discovery gap for late-discovered critical resources; and minify, compress, and split the CSS bundle to shrink whatever still blocks. I don't memorize that list — I walk the sequence, find what's blocking paint and what's blocking parsing, and remove those."

**The tell:** The junior answer offers "bottom of body" and "async is faster" with no blocking model underneath. The senior answer names the sequence in order, names both blocking points with the *reason* each blocks (cascade correctness for CSS, parser semantics for JS), and derives every optimization as the direct response to a specific blocker — including the tradeoff each one costs.

---

### Part 6: Production Examples

A news organization's article template shipped with a single 310KB stylesheet — five years of accumulated component CSS, unminified in the repo pipeline after a build-config regression, linked at the top of `head`. First Contentful Paint on a mid-tier mobile connection sat at 4.1 seconds: the CRP diagram from a Performance-panel trace showed a 1.8-second flat line where the browser sat waiting on that one fetch before painting a single glyph, with the article text fully present in the parsed DOM the whole time. The fix worked in two moves: a build step extracted above-the-fold rules — shell, header, article typography — into 6KB of critical CSS inlined in `head`, and the full (now minified and brotli-compressed) bundle loaded via the non-blocking preload-swap pattern. FCP dropped to 1.3 seconds on the same connection. The LCP image got a `rel=preload` in the same pass, because trace inspection showed the hero was still discovering late. The team's note in the PR: the 1.8-second gap wasn't "the site was slow" — it was one blocking point doing exactly what the spec says, waiting out the full CSSOM before paint.

A B2B analytics dashboard had a different blocker. The page shell was tiny and cached, but three synchronous scripts — a config gateway, a charting library loader, and a feature-flag client — sat in `head` ahead of the main bundle, each roughly 80-150KB, none with `defer` or `async`. The parser reached the first one and halted; DOM construction for the entire dashboard body below waited on download plus execution, times three, sequentially. Cold-load traces showed HTML parse stalling for 2.3 seconds with the shell's own markup unprocessed — the loading spinner the team had added *below* the scripts was itself blocked from appearing. The fix: the gateway and feature-flag client went `async` (independent, no DOM dependency — Session 12's decision rule), the charting loader went `defer` (needs the DOM to mount into), and the scripts' order-dependent handshake moved behind a small deferred bootstrap. Parser-blocking time on the critical path went to zero; the scripts still executed before the dashboard became interactive, on the interaction path where they belonged.

---

## Tie the Chain Together

The three topics are one story at three scales. Reflow is what happens when geometry changes: layout recalculates, and the recalculation propagates — through ancestors, through siblings, potentially to the whole page — unless the scope is fenced, with `contain: layout` for structural isolation or out-of-flow positioning inside a fixed containing block, and unless JavaScript multiplies the cost by interleaving layout-forcing reads (`offsetWidth`, `getBoundingClientRect()`, `getComputedStyle()`, the rest of the list) with style writes. Repaint is what happens when only pixels change: `color`, `box-shadow`, `visibility` toggles skip layout entirely and pay only the paint-and-composite tier. Composite-only changes — `transform`, `opacity`, `filter`, `clip-path` on a promoted layer — are the cheapest tier of all, skipping layout and paint and running on Session 25's compositor thread. Pick the cheapest tier the visual allows; that decision procedure is the cost spectrum.

The critical rendering path is where the first of those stages ever runs. Its sequence — HTML request through parse, discovery, fetch, DOM and CSSOM, Render Tree, layout, paint — is gated by exactly two blocking points: render-blocking CSS, because the cascade can't be trusted until the CSSOM is complete, and parser-blocking JavaScript, because a bare `<script>` stops DOM construction. Every CRP optimization is that gate's removal or reduction: inline critical CSS takes the stylesheet fetch off the path, `defer`/`async` take scripts off the rendering path, preload closes discovery gaps, and minification, compression, and CSS splitting shrink whatever still blocks. First paint gets faster not by making layout or paint cheaper, but by arriving at them sooner.

### Module 4 Retrospective

Module 4 ran five sessions from network to pixels. Sessions 22-23 covered the round trips a byte takes to the browser — DNS, TCP, TLS, and the HTTP versions that reshaped how those bytes share connections. Session 24 covered what the browser already has, so the round trip doesn't happen at all: caching, cookies, storage. Sessions 25-26 covered what happens after the bytes land — the nine-stage rendering pipeline, then the two questions that make the pipeline actionable: when layout and paint re-run (reflow propagation, thrashing, containment, the repaint tier), and what delays the first run (the critical rendering path and its blocking points).

The pattern that recurs across all five: the browser's defaults are spec-correct, and spec-correct is often expensive. CSS blocks rendering because the cascade could override anything not yet loaded. Scripts block parsing because `document.write()` semantics required it. Layout propagates because geometry genuinely is interdependent — a parent's height really does depend on its children. A cache key really does need Vary. Each session's senior answer named the default, explained the correctness reason it exists, and named the override with its tradeoff — `defer`/`async` for scripts, inlined critical CSS for paint, `contain: layout` for propagation, explicit cache-busting for reuse. That's the through-line into Module 5: performance work is mostly choosing which correct-but-expensive defaults to override, and paying the stated price for each override.

*End of Module 4. DNS/TCP/TLS and HTTP versions get the bytes to the browser; caching decides whether the trip happens; the rendering pipeline turns the bytes into pixels; reflow and repaint govern which stages re-run; and the critical rendering path governs how long the first frame takes to appear. Module 5 (Performance) begins next — check `docs/roadmap.md` for the first session: Core Web Vitals.*

---

## Cross-References

- Session 12 (`book/02-html-mastery/12-browser-parsing-dom-construction.md`) — parser-blocking script mechanics, `defer`/`async`/module semantics, preload scanner, `DOMContentLoaded` ordering. Referenced for the CRP's second blocking point; not re-derived here.
- Session 15 (`book/03-css-mastery/15-cascade-specificity-inheritance.md`) — cascade rules; the reason render-blocking CSS exists (the CSSOM must be complete before paint).
- Session 16 (`book/03-css-mastery/16-box-model-positioning.md`) — stacking contexts and containing blocks; the containing-block scoping used in reflow's best case, and the stacking-context misconception killed in Topic 1.
- Session 18 (`book/03-css-mastery/18-animations-transforms-transitions.md`) — compositor-only properties (`transform`, `opacity`, `filter`, `clip-path`); tier 3 of this session's cost spectrum.
- Session 19 (`book/03-css-mastery/19-container-queries-modern-css-logical-properties.md`) — container queries (`container-type`, `@container`) — a *different* feature from CSS containment (`contain`); this session's containment coverage does not apply to `container-type`.
- Session 22 (`book/04-browser/22-dns-tcp-tls-https.md`) — steps 1-2 of the CRP: how HTML bytes get requested and received.
- Session 23 (`book/04-browser/23-http-versions.md`) — connection multiplexing and compression; how step 5 (CSS/JS fetch) and the "minimize render-blocking size" optimization behave over the wire.
- Session 24 (`book/04-browser/24-caching-cookies-storage.md`) — decides whether CRP resources come from cache or network; the caching side of render-blocking CSS cost.
- Session 25 (`book/04-browser/25-rendering-pipeline.md`) — the nine-stage pipeline; Stages 6-7 (layout, paint) are this session's Topics 1-2, and the layer/compositor model underlies Topic 2's tier 3.
