# Session 25 — The Rendering Pipeline

> **Module 4 — Browser.** Session 4 of 5.
> **Chain:** HTML parsing → DOM construction → CSSOM construction → Render Tree → Layout (Reflow) → Paint → Composite → Layers and the compositor thread → `requestAnimationFrame` and frame timing.
> This session builds on Sessions 22 and 24: the resources fetched over the network (Session 22: DNS, TCP, TLS) are what the rendering pipeline processes. The caching and storage mechanisms (Session 24) determine whether those resources arrive from cache or network. Session 18 (`book/03-css-mastery/18-animations-transforms-transitions.md`) established that `transform`, `opacity`, `filter`, and `clip-path` are "compositor-only" properties — this session places that claim in its full pipeline context, explaining why those properties skip layout and paint entirely. Session 26 continues with reflow and repaint — when layout and paint are triggered and how to minimize them on the critical rendering path.

<!-- Module 4 convention: This module covers browser internals and networking
protocols. Pipeline diagrams, timing sequences, and stage descriptions are
ILLUSTRATIVE — based on Chrome's "Inside look at modern web browser" series
and MDN, but not executed in-session. Where a claim couldn't be verified
inline, it's marked with <!-- VERIFY -->. This convention applies to
Sessions 22-26. -->

---

## Topic 1 — The Full Rendering Pipeline

### Part 1: Theory

The rendering pipeline is the sequence of stages the browser performs to convert HTML and CSS bytes into pixels on screen. Most candidates describe three stages — layout, paint, composite. The actual pipeline has nine stages, and each one matters for understanding performance.

**Stage 1: HTML parsing.** The browser receives HTML bytes over the network (established in Session 22's TCP/TLS flow) and begins parsing them into tokens — doctype, tags, attributes, text nodes. Parsing is incremental: the browser doesn't wait for the full document to arrive. As soon as it has enough tokens to construct a node, it does. This is why progressive rendering works — users see content before the full page loads.

**Stage 2: DOM construction.** Parsed HTML tokens are converted into a tree of nodes — the Document Object Model. Each HTML element becomes an element node; text becomes text nodes; comments become comment nodes. The DOM is a live data structure: JavaScript can read and modify it, and changes trigger re-rendering. The `<head>` element and its children (`<script>`, `<meta>`, `<style>`, `<link>`) are parsed and added to the DOM, but they are not visually rendered — they don't appear on screen.

**Stage 3: CSS parsing.** While HTML is being parsed, the browser discovers CSS — inline `<style>` blocks, `<link rel="stylesheet">` tags, and `@import` rules within stylesheets. CSS bytes are parsed into tokens and then into CSS rules. Like HTML parsing, CSS parsing is incremental.

**Stage 4: CSSOM construction.** Parsed CSS rules are organized into the CSS Object Model — a tree structure where each node represents a style rule, and styles are inherited from parent nodes. The CSSOM resolves which styles apply to each element, accounting for specificity, cascade, and inheritance (covered in Session 15). The CSSOM is separate from the DOM — they're built independently and combined in the next stage.

**Stage 5: Render Tree construction.** The browser combines the DOM and the CSSOM into the Render Tree. This is not the DOM. The Render Tree contains only nodes that are visually rendered — the intersection of the DOM tree and the computed styles. Nodes are excluded from the Render Tree when:

- The element has `display: none` — removed entirely. The element occupies no space, affects no layout, and is not painted. It's in the DOM but not in the Render Tree.
- The element is `<head>`, `<meta>`, `<script>`, or `<style>` — these are not visual elements. They're in the DOM but never rendered.
- The element is a descendant of a `display: none` ancestor — the entire subtree is excluded.
- The element is outside the viewport and clipped — in some cases, off-screen elements are excluded from the Render Tree for optimization.

Elements with `visibility: hidden` ARE in the Render Tree. They affect layout — they take up space, push other elements around — but they are not painted. The distinction matters: `display: none` removes the element from layout entirely; `visibility: hidden` keeps it in layout but hides the paint.

**Stage 6: Layout (Reflow).** The layout stage computes the exact position and size of every Render Tree node — where each element sits on the page, how wide and tall it is, its margins, padding, and border. Layout is triggered by anything that changes an element's geometry: `width`, `height`, `top`, `left`, `margin`, `padding`, `border`, `font-size`, even `window.resize`. The output of layout is a tree of layout boxes — each node has a rectangle (or set of rectangles) in viewport coordinates. Session 26 covers when layout is triggered and how to minimize reflow.

**Stage 7: Paint.** Paint converts layout boxes into a list of draw calls — visual operations that paint pixels onto layers. Paint operations include fills (background colors, gradients), strokes (borders, outlines), text rendering, images, shadows, and filters. The browser doesn't paint the entire page every frame — it paints each layer independently, and only layers that changed need repainting. The paint order follows stacking context rules from Session 16: backgrounds and borders first, then floats, then positioned elements in z-index order, then foreground content.

**Stage 8: Composite.** The compositor takes all the painted layers and assembles them into the final image that appears on screen. The compositor determines which layers overlap, handles opacity and blending between layers, applies clip paths, and produces the final frame. The compositor runs on its own thread — the compositor thread — separate from the main thread where JavaScript, style calculation, layout, and paint execute. This separation is the foundation for smooth animations.

**Stage 9: Display.** The composited frame is displayed on screen — written to the display buffer and presented at the next vsync (vertical synchronization) signal, which happens approximately every 16.7ms at 60fps.

---

### Part 2: Interview Answer

The rendering pipeline is how the browser converts HTML and CSS into pixels on screen, and it has more stages than most candidates name. The pipeline runs in nine stages: HTML parsing, DOM construction, CSS parsing, CSSOM construction, Render Tree construction, layout, paint, composite, and display.

HTML parsing is incremental — the browser builds the DOM as bytes arrive, not after the full document downloads. CSS parsing happens in parallel, building the CSSOM from stylesheets. The Render Tree combines the DOM and CSSOM, but it's not the DOM — it excludes elements that aren't visually rendered. The `<head>` and its children (`<script>`, `<meta>`, `<style>`) are in the DOM but not the Render Tree. Elements with `display: none` are removed entirely — they don't take up space and aren't painted. Elements with `visibility: hidden` are included — they take up layout space but aren't painted.

Layout computes positions and sizes for every Render Tree node — where each element sits, how wide and tall it is. Anything that changes geometry — `width`, `top`, `margin`, `font-size` — triggers layout. Paint converts layout boxes into draw calls per layer: fills, strokes, text, images. Composite assembles those layers into the final frame. The compositor runs on its own thread, separate from the main thread — that's the key insight for animation performance. When only a layer's transform or opacity changes, only that layer needs compositing — the rest of the page is untouched.

The performance hierarchy is layout is most expensive, paint is less expensive, and composite is cheapest. The ideal animation targets composite-only properties — `transform`, `opacity`, `filter`, `clip-path` — because they skip layout and paint entirely. Session 18 covered these as "compositor-only"; this pipeline is the full context for why they're cheaper.

---

### Part 3: Whiteboard / Live Coding

**The full rendering pipeline — nine stages:**

```
HTML bytes (from network, per Session 22)
    |
    v
[1] HTML Parsing (tokenize bytes into tags, attributes, text)
    |
    v
[2] DOM Construction (tokens → DOM tree)
    |
    v
    +-----> [3] CSS Parsing (stylesheet bytes → CSS tokens)
    |           |
    |           v
    |       [4] CSSOM Construction (CSS tokens → style rules, specificity resolution)
    |           |
    v           v
[5] Render Tree Construction (DOM + CSSOM → visible nodes only)
    |
    v
[6] Layout (compute positions and sizes for every Render Tree node)
    |
    v
[7] Paint (layout boxes → draw calls per layer: fills, strokes, images, text)
    |
    v
[8] Composite (assemble layers into final frame, compositor thread)
    |
    v
[9] Display (write to screen buffer, present at next vsync ~16.7ms)
```

<!-- ILLUSTRATIVE: The pipeline is shown linearly, but in practice, stages
overlap — HTML and CSS parsing happen concurrently, and the browser may
begin layout for earlier parts of the DOM while later parts are still being
parsed. The browser doesn't wait for the full document before rendering. -->

**Render Tree — what's included and what's excluded:**

```
DOM Tree                          CSSOM
    |                               |
    +-----------> Render Tree <------+
                  (visible nodes only)

DOM Node                   Render Tree?     Reason
─────────────────────────────────────────────────
<html>                     ✓               Root element
<head>                     ✗               Non-visual
<script>                   ✗               Non-visual
<style>                    ✗               Non-visual
<meta>                     ✗               Non-visual
<body>                     ✓               Visual element
<div style="display:none"> ✗               display:none removes from layout
<div> (child of above)     ✗               Subtree excluded
<p style="visibility:hidden"> ✓            visibility:hidden affects layout
<span>                     ✓               Visible descendant
```

<!-- ILLUSTRATIVE: The key distinction is display:none vs visibility:hidden.
display:none removes the element and its subtree from the Render Tree entirely.
visibility:hidden keeps the element in the Render Tree (it takes up space in
layout) but excludes it from the paint stage. The head element and its children
are never rendered — they're parsed into the DOM for the browser to process
(meta information, scripts, styles) but they don't generate layout boxes. -->

**The pipeline stages and what triggers each:**

```
Stage          Output                    What triggers recomputation
───────────────────────────────────────────────────────────────────
Layout         Positions + sizes         Geometry changes (width, top, margin...)
Paint          Draw calls per layer      Visual changes (color, shadow, border...)
Composite      Final frame               Compositor-only property changes
               (on compositor thread)    (transform, opacity, filter, clip-path)
```

<!-- ILLUSTRATIVE: The "what triggers" column is the foundation for
Session 26's coverage of reflow and repaint. Layout changes propagate
through the subtree — changing a parent's width forces layout for all
children. Paint changes are layer-scoped — only the affected layer is
repainted. Composite changes are the cheapest — they skip layout and
paint entirely, running on the compositor thread. -->

---

### Part 4: Follow-Up Questions

**Q: Why does the browser build the DOM and CSSOM separately instead of together?**

Because they're discovered from different sources and parsed incrementally. HTML bytes arrive and are parsed as they come — the browser can't wait for CSS before starting the DOM. CSS comes from `<link>` tags, `<style>` blocks, and inline styles — each parsed independently. Building them separately lets both parsers work in parallel. The Render Tree is where they merge: each DOM node is matched against CSSOM rules to compute final styles. The separation also means JavaScript can modify the DOM without rebuilding the CSSOM, and vice versa — though modifying either triggers a Render Tree rebuild.

**Q: How does `visibility: hidden` differ from `display: none` at the pipeline level?**

`display: none` removes the element from the Render Tree entirely. The element doesn't occupy layout space — siblings reflow as if it doesn't exist. No layout computation, no paint, no composite for that element. `visibility: hidden` keeps the element in the Render Tree — it occupies layout space (pushing siblings to their correct positions) but is not painted. The browser still computes layout for it; it just skips the paint step. This is why `visibility: hidden` is more expensive than `display: none` for hiding elements — the layout cost remains.

**Q: Can JavaScript read layout metrics before paint is complete?**

Yes — and this is where performance problems start. JavaScript can call `getBoundingClientRect()`, `offsetWidth`, `clientHeight`, or any property that reads layout information at any time. If JavaScript writes a style change and then immediately reads a layout property, the browser must perform a synchronous layout to return the correct value — even if a layout was already scheduled. This is a "forced synchronous layout" (or "layout thrashing"), and it's the subject of Session 26's reflow coverage. The short version: read first, write second, never interleave reads and writes in a loop.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"The browser parses HTML into a DOM, then applies CSS, does layout to figure out where everything goes, paints the pixels, and composites the layers onto the screen."

**Why this misses the point:** The junior answer names five stages and collapses the CSS side into "applies CSS." It doesn't distinguish CSSOM construction from Render Tree construction, doesn't mention that the Render Tree excludes non-rendered nodes, doesn't name the compositor thread as a separate thread, and doesn't connect any stage to performance implications. The answer is a summary of what happens, not a framework for understanding why some operations are expensive.

**Senior answer:**
"The rendering pipeline has nine stages: HTML parsing builds the DOM, CSS parsing builds the CSSOM, and those two are combined into the Render Tree — which is not the DOM. The Render Tree excludes elements with `display: none`, excludes `<head>` and its children, and excludes entire subtrees under a `display: none` ancestor. Elements with `visibility: hidden` are in the Render Tree because they affect layout, but they're not painted. Layout computes positions and sizes for every Render Tree node — anything that changes geometry triggers layout. Paint converts layout boxes into draw calls per layer. Composite assembles layers into the final frame on the compositor thread, which is separate from the main thread. The performance hierarchy matters: layout is most expensive, paint is less expensive, composite is cheapest. That's why `transform` and `opacity` animations are smooth — they skip layout and paint entirely, handled by the compositor thread without blocking JavaScript."

**The tell:** The junior answer names five stages and doesn't distinguish Render Tree from DOM. The senior answer names all nine, explains what the Render Tree excludes and why, and connects the pipeline stages to performance.

---

### Part 6: Production Examples

A team building a data-heavy dashboard had a page with 500+ table rows. Each row contained status badges that toggled between `display: none` and `display: block` based on filter state. When the user applied a filter, the page froze for 200ms. The investigation revealed that toggling `display: none` on 200+ rows forced a full Render Tree rebuild followed by layout for the entire table — every row's position had to be recalculated because removing elements from the Render Tree shifts the layout of all subsequent siblings. The fix was replacing `display: none` with `visibility: hidden` combined with `height: 0; overflow: hidden` on the filtered rows. The elements stayed in the Render Tree but occupied no layout space. The Render Tree didn't change on filter — only visual properties changed — and the browser could skip layout entirely for the filter operation.

A different team had a modal dialog that appeared on page load. The modal's HTML was in the DOM from the start but hidden with `display: none`. When the user triggered it, the browser had to: remove `display: none` from the modal, rebuild the Render Tree (adding the modal's subtree), compute layout for the entire page (the modal's presence shifts other elements), and then paint and composite. On complex pages, this sequence caused a visible 100-200ms delay. The fix was moving the modal's HTML out of the initial DOM and injecting it via JavaScript only when needed. This kept the Render Tree smaller during initial page load, and the modal's layout cost was deferred to when it was actually needed.

---

## Topic 2 — Layers and the Compositor Thread

### Part 1: Theory

The browser doesn't paint the entire page into a single image. It divides the page into compositor layers — separate painted images that the compositor assembles into the final frame. Understanding layers is the bridge between the rendering pipeline (Session 18's "compositor-only" claim) and practical animation performance.

**What a compositor layer is.** A compositor layer is a painted image of a portion of the page, stored in GPU memory. The browser divides the page into layers based on stacking context boundaries: elements that create a new stacking context (via `position: z-index`, `opacity < 1`, `transform`, `filter`, `will-change`, etc.) get their own layer. Each layer is painted independently, and the compositor assembles them in z-order to produce the final frame.

**Layer promotion — which elements get their own layer.** The browser promotes elements to their own compositor layer when:

- The element has an active CSS animation or transition on `transform`, `opacity`, `filter`, or `clip-path`.
- The element has `will-change: transform` (or `will-change: opacity`, `will-change: filter`, etc.).
- The element has a 3D transform (`translate3d`, `rotate3d`, `scale3d`, `perspective`).
- The element is a `<video>` element with a decoded video frame.
- The element is a `<canvas>` element (2D or WebGL).
- The element is a child of an element with `overflow: scroll` or `overflow: auto` (in some browsers, scrolling containers get their own layer for smooth scrolling).

**The compositor thread is separate from the main thread.** This is the critical architectural insight. The main thread handles JavaScript execution, style calculation, layout, and paint. The compositor thread handles layer assembly and display. When you animate `transform` or `opacity`, the compositor thread can update the layer's position or blending without involving the main thread at all — JavaScript keeps running, layout doesn't re-run, paint doesn't re-run. This is why compositor-only animations are "smooth" — they don't compete with JavaScript or layout for the main thread's time.

**Layer promotion and GPU memory.** Every compositor layer consumes GPU memory — the painted bitmap for that layer is stored on the GPU. A small element might use a few kilobytes; a full-screen element might use several megabytes. On a page with many promoted elements, GPU memory adds up. If the browser runs out of GPU memory, it may fall back to software compositing — rendering on the CPU — which is slower than GPU compositing. On mobile devices with limited GPU memory (typically 256MB-1GB shared with the OS), this is a real constraint.

**The `will-change` tradeoff.** `will-change: transform` tells the browser to promote the element to its own layer before an animation starts. This avoids the flash of unstyled content (FOUC) that occurs when the browser promotes an element mid-animation — the promotion causes a brief layout shift as the element is extracted from its shared layer. But `will-change` on every element creates so many layers that GPU memory fills up, degrading performance for the whole page. The correct pattern: add `will-change` only to elements you've profiled and confirmed need it, and remove it after the animation completes.

**Promoted vs. non-promoted elements.** A promoted element has its own compositor layer — a separate painted image in GPU memory. The compositor can move, scale, or blend that layer independently. A non-promoted element is painted into its parent's or nearest stacking context's layer — its pixels are part of a larger image. If a non-promoted element's opacity changes, the entire layer it belongs to must be re-composited, not just that element. Promotion trades memory for compositor independence — the element's layer can be updated without touching any other layer.

---

### Part 2: Interview Answer

The browser doesn't paint the page into one image. It creates compositor layers — separate painted images stored in GPU memory — and the compositor thread assembles them into the final frame. Understanding layers is what makes the "use transform for animations" advice actually make sense.

Elements get promoted to their own compositor layer when they have active animations on `transform`, `opacity`, `filter`, or `clip-path`, when they have `will-change` for one of those properties, when they use a 3D transform, or when they're `<video>` or `<canvas>` elements. Everything else is painted into a shared layer.

The compositor thread is separate from the main thread. The main thread handles JavaScript, style calculation, layout, and paint. The compositor thread handles layer assembly. When you animate `transform`, the compositor thread repositions the layer without touching the main thread — JavaScript keeps running, layout doesn't re-run. That's why `transform: translateX(100px)` is smooth while `left: 100px` causes jank. The visual result is identical; the rendering path is completely different.

Every compositor layer consumes GPU memory. A promoted element's painted bitmap lives on the GPU. On mobile devices with limited GPU memory, too many layers cause the browser to fall back to software compositing — slower than GPU compositing. `will-change: transform` promotes an element before an animation starts, avoiding a flash when the browser promotes it mid-animation. But `will-change` on every element fills GPU memory and degrades performance for the whole page. The pattern: add `will-change` only to frequently animated elements, remove it when the animation is done. Session 18 covered the compositor-only properties; this is the mechanism behind them — the compositor thread handles them on separate layers, independent of the main thread.

---

### Part 3: Whiteboard / Live Coding

**Layer promotion — which elements get their own layer:**

```
Element                           Gets own layer?    Reason
──────────────────────────────────────────────────────────────
<div style="transform: ...">      ✓                  Active transform animation
<div style="opacity: 0.5">        ✓                  Active opacity animation
<div style="will-change: transform"> ✓               Explicit promotion hint
<div style="filter: blur(4px)">   ✓                  Active filter animation
<video>                           ✓                  Decoded video frame
<canvas>                          ✓                  Native canvas element
<div style="left: 100px">         ✗                  Painted into parent layer
<div style="width: 200px">        ✗                  Painted into parent layer
<div style="background: red">     ✗                  Painted into parent layer
<div> (static)                    ✗                  No promotion trigger
```

<!-- ILLUSTRATIVE: The browser's layer promotion heuristics are not
fully specified — they vary across browser engines. The list above
reflects common Chrome behavior. The key principle: compositor-only
property animations and explicit will-change hints trigger promotion.
Layout and paint property changes do not. -->

**Main thread vs compositor thread — what runs where:**

```
Main Thread                              Compositor Thread
─────────────────────────                ─────────────────────────
JavaScript execution                    Layer assembly
Style calculation                       Layer blending
Layout (position/size computation)      Layer positioning (transform, opacity)
Paint (draw calls per layer)            Display (vsync handoff)

When you animate `left`:                When you animate `transform`:
  1. JavaScript writes style              1. JavaScript writes style
  2. Style recalculation                   2. Style recalculation
  3. Layout recomputation                  3. Layer promoted (if not already)
  4. Repaint affected layer                4. Compositor thread moves layer
  5. Composite all layers                  5. Composite (compositor thread only)
                                          
  → Main thread blocked for steps 2-4     → Main thread free after step 2
  → JavaScript can't run during layout    → JavaScript runs concurrently
  → ~16.7ms budget often exceeded         → Well within 16.7ms budget
```

<!-- ILLUSTRATIVE: The left animation triggers layout on every frame —
the browser must recompute positions and repaint. The transform animation
is handled by the compositor thread after the initial style calculation.
The compositor thread runs independently, so JavaScript executes
concurrently with the animation. This is the mechanism behind Session 18's
"compositor-only properties don't block JavaScript" claim. -->

**`will-change` — the promotion lifecycle:**

```css
/* Static state — no compositor layer */
.card {
  /* No will-change: painted into parent layer */
}

/* Before animation — promote to compositor layer */
.card.will-animate {
  will-change: transform;
  /* Browser creates a new compositor layer for this element */
  /* GPU memory allocated for the layer's painted bitmap */
}

/* During animation — compositor thread handles it */
.card.animating {
  transform: translateY(-10px);
  /* Compositor thread repositions the layer — no main thread involvement */
}

/* After animation — remove promotion to free GPU memory */
.card {
  will-change: auto;
  /* Layer merged back into parent layer */
  /* GPU memory freed */
}
```

<!-- ILLUSTRATIVE: The dynamic will-change pattern (add before animation,
remove after) gives performance benefits without permanent GPU memory
cost. In practice, this means toggling will-change via JavaScript class
manipulation rather than declaring it statically in CSS. -->

**GPU memory cost — why `will-change` on every element is harmful:**

```
Page with 100 visible elements:

Without will-change:
  Layers: ~5-10 (stacking context boundaries)
  GPU memory: ~2-5 MB
  Performance: Optimal

With will-change on every element:
  Layers: ~100 (one per element)
  GPU memory: ~20-50 MB
  Performance: Degrades — GPU memory pressure,
  possible software compositing fallback on mobile
```

<!-- ILLUSTRATIVE: The numbers are approximate — actual memory usage
depends on layer dimensions and device pixel ratio. A full-screen element
at 2x DPR uses 4x the memory of a small element. The point is relative
scale: too many layers consume GPU memory that should be used for other
compositor work. On mobile devices with 256MB-1GB of GPU memory shared
with the OS, this is a real constraint, not an theoretical one. -->

---

### Part 4: Follow-Up Questions

**Q: How do you know how many compositor layers a page has?**

Chrome DevTools has a Layers panel (under the three-dot menu in the Performance panel, or via `chrome://tracing`). It shows every compositor layer, its dimensions, its memory cost, and the reason it was promoted. The Paint flashing overlay (in the Rendering tab) highlights painted regions in green — if you see green flashing during an animation, paint is being triggered on that layer. The Layers panel is the definitive way to diagnose layer count issues.

**Q: What's the difference between a stacking context and a compositor layer?**

Every compositor layer creates a stacking context, but not every stacking context gets its own compositor layer. `z-index` on a `position: relative` element creates a stacking context — but it doesn't necessarily promote to a compositor layer. `will-change: transform` creates both a stacking context AND promotes to a compositor layer. The distinction: stacking context affects paint order (which elements paint on top of which), while compositor layer affects rendering thread (which elements are handled by the compositor thread vs. the main thread).

**Q: Can you force layer promotion without `will-change`?**

The legacy hack is `transform: translateZ(0)` or `transform: translate3d(0, 0, 0)` — any 3D transform function forces the browser to create a compositor layer. This works because 3D transforms require a separate layer for depth compositing. `will-change: transform` is the semantically correct approach — it communicates intent. The hacks still work but should be replaced in new code. If you see `translateZ(0)` in a codebase, it's either legacy code or someone who hasn't learned about `will-change`.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use `transform` for animations because it's faster. The browser promotes elements to GPU layers when you use transforms. Add `will-change: transform` to elements that animate."

**Why this misses the point:** The junior answer knows the rule but doesn't explain the mechanism. "Faster" is vague — faster because the compositor thread handles it, separate from the main thread. The answer recommends `will-change` without mentioning the GPU memory cost or the need to remove it after animation. A senior answer names the compositor thread as separate from the main thread, explains why that separation matters (JavaScript keeps running), and knows that `will-change` on every element causes GPU memory pressure.

**Senior answer:**
"The browser creates compositor layers — separate painted images stored in GPU memory — and the compositor thread assembles them into the final frame. Elements are promoted to their own layer when they have active animations on `transform`, `opacity`, `filter`, or `clip-path`, when they have `will-change` for those properties, or when they use 3D transforms. The compositor thread is separate from the main thread, so compositor-only animations don't block JavaScript or trigger layout. That's why `transform: translateX(100px)` is smooth while `left: 100px` causes jank — same visual result, completely different rendering path. Every compositor layer consumes GPU memory. `will-change: transform` promotes an element before animation, but if you add it to every element, GPU memory fills up and the browser may fall back to software compositing. The pattern: add `will-change` to frequently animated elements, remove it when the animation completes."

**The tell:** The junior answer says "use transform because it's faster." The senior answer names the compositor thread, explains the separation from the main thread, and knows the GPU memory tradeoff of `will-change`.

---

### Part 6: Production Examples

A team building an interactive data visualization had a page with 200+ SVG elements — nodes and edges in a graph layout. The user could drag nodes to rearrange the graph. The original implementation used `top` and `left` transitions on each SVG element to animate position changes. On mid-range devices, dragging a node caused 100-200ms of jank per frame — the layout cost of repositioning 200+ elements on the main thread exceeded the 16.7ms frame budget. The fix was switching to `transform: translate()` on each element. The compositor thread handled the transform updates off the main thread, and drag performance went from 15fps to 60fps. The visual result was identical; the rendering path was completely different.

A different team added `will-change: transform` to every interactive element on a marketing page — buttons, cards, navigation items, images — "just in case they might animate." On desktop, performance was fine. On mobile devices with limited GPU memory, the page became janky during scroll — the 50+ compositor layers consumed enough GPU memory that the browser fell back to software compositing for some layers. The Layers panel showed 52 layers where 8 would have been sufficient. The fix was removing `will-change` from all but the three elements that actually animated (a sliding nav, a modal overlay, and a scroll-triggered hero image). Mobile scroll performance returned to 60fps.

---

## Topic 3 — requestAnimationFrame and Frame Timing

### Part 1: Theory

The browser renders frames at approximately 60fps — one frame every ~16.7ms. Each frame goes through the same pipeline: JavaScript → Style → Layout → Paint → Composite → Display. Understanding frame timing is what separates someone who writes `setTimeout(fn, 16)` for animations from someone who uses `requestAnimationFrame` and knows why.

**The frame budget.** At 60fps, each frame has ~16.7ms. This budget includes everything: JavaScript execution, style calculation, layout, paint, and composite. If any stage exceeds the budget, the frame is dropped — the browser displays the previous frame for another 16.7ms, causing visible jank. At 30fps, the budget doubles to ~33.3ms. On a 120Hz display, it halves to ~8.3ms.

**`requestAnimationFrame` timing.** `requestAnimationFrame` (rAF) schedules a callback to run at the beginning of the next frame — after the previous frame has been composited and before the current frame's layout and paint. The callback runs during the "JavaScript" phase of the frame lifecycle:

```
Frame lifecycle:
  [Previous frame composited] → rAF callbacks → Style → Layout → Paint → Composite → Display
```

This guarantee is what makes rAF the correct API for visual updates. The callback runs before layout and paint, so any DOM changes made in the callback are included in the current frame's layout and paint. The callback also runs after the previous frame has been composited, so the browser has a confirmed display time for the previous frame — this is how rAF-based animations synchronize with the display's refresh rate.

**`requestAnimationFrame` cancellation.** `cancelAnimationFrame(id)` cancels a pending rAF callback. This is essential for cleanup — when an animation ends, when a component unmounts, when a user navigates away. Without cancellation, orphaned rAF callbacks continue firing, consuming frame budget for animations that no longer have visual effect. A common pattern is storing the rAF ID and canceling it in a cleanup function.

**`setTimeout(fn, 0)` — why it's wrong for visual updates.** `setTimeout` does not place callbacks at the start of a frame. It schedules a macrotask (covered in Session 5) that runs whenever the task queue is processed — potentially in the middle of a frame, after layout and paint have already run. If a `setTimeout` callback writes a style change and then reads a layout property (like `offsetWidth`), the browser must perform a synchronous layout to return the correct value — this is a "forced synchronous layout." Worse, the callback may fire between layout and paint, causing layout to run twice in one frame: once during the normal pipeline, and once forced by the JavaScript callback. The visual result is the same; the performance cost is doubled.

The practical difference:

```
requestAnimationFrame:
  Frame N:   [rAF callback] → Style → Layout → Paint → Composite
  Frame N+1: [rAF callback] → Style → Layout → Paint → Composite
  → Callback runs once per frame, before layout and paint
  → DOM changes are included in the current frame's render

setTimeout(fn, 16):
  Frame N:   ... Layout → Paint → Composite → [timeout fires mid-frame] → ???
  Frame N+1: ... Layout (forced!) → Paint → Composite
  → Callback may fire in the middle of a frame
  → Reading layout metrics forces a second synchronous layout
  → Timing drifts — setTimeout doesn't sync with vsync
```

**`requestAnimationFrame` as a throttle, not a timer.** rAF doesn't guarantee 60fps — it guarantees at most one callback per frame. On a 30fps device (or when the browser is under load and dropping frames), rAF fires at 30fps, not 60. This is correct behavior: the animation adapts to the device's actual frame rate instead of running ahead of the display. `setTimeout(fn, 16)` fires every 16ms regardless of frame rate — on a 30fps device, it fires twice per frame, wasting computation on frames that will be dropped anyway.

---

### Part 2: Interview Answer

`requestAnimationFrame` is the correct API for visual updates because it places callbacks at the start of the next frame — before layout and paint. The frame lifecycle runs: JavaScript, then style calculation, then layout, then paint, then composite. rAF callbacks execute during the JavaScript phase, so any DOM changes made in the callback are included in that frame's layout and paint. This guarantees the callback runs once per frame, synchronized with the display's refresh rate.

`setTimeout(fn, 16)` is the wrong API for animations. It doesn't sync with frames — the callback fires whenever the macrotask queue is processed, potentially in the middle of a frame after layout and paint have already run. If the callback writes a style change and then reads a layout property like `offsetWidth`, the browser must perform a forced synchronous layout — an expensive reflow that wouldn't have been necessary if the read happened before the write. Worse, `setTimeout` doesn't adapt to frame rate. On a 30fps device, `setTimeout(fn, 16)` fires every 16ms but the display only updates every 33ms — you're doing twice the work for half the visual result.

rAF also provides cleanup through `cancelAnimationFrame`. When an animation ends or a component unmounts, you cancel the pending rAF to stop the loop. Without cancellation, orphaned callbacks keep firing, consuming frame budget for animations that have no visual effect.

The frame budget is ~16.7ms at 60fps. Everything — JavaScript, style, layout, paint, composite — must fit within that window. If any stage exceeds it, the frame drops. rAF helps by ensuring your visual updates happen at the right moment in the pipeline, not randomly in the middle of it. The practical rule: if the code updates the visual state of the page, use rAF. If it does non-visual work (data processing, API calls, logging), setTimeout or setImmediate is fine.

---

### Part 3: Whiteboard / Live Coding

**Frame lifecycle — where rAF and setTimeout fit:**

```
60fps frame budget: ~16.7ms per frame

Frame N:
  ┌─────────────────────────────────────────────────────────┐
  │ rAF callbacks    │ Style │ Layout │ Paint │ Composite  │
  │ (JS phase)       │       │        │       │            │
  │ ◄── ~16.7ms ────►│       │        │       │            │
  └─────────────────────────────────────────────────────────┘
                                          │
                                          v
                                    Display (vsync)

requestAnimationFrame:
  Callback runs HERE — before layout and paint, after previous composite
  DOM changes are included in this frame's render pipeline

setTimeout(fn, 16):
  Callback fires WHENEVER — possibly here:
  ┌─────────────────────────────────────────────────────────┐
  │ rAF     │ Style │ Layout │ Paint │ [timeout fires] │ ?? │
  │         │       │        │       │  (too late!)    │    │
  └─────────────────────────────────────────────────────────┘
  Layout already ran — reading layout metrics forces a second layout
```

<!-- ILLUSTRATIVE: The frame lifecycle diagram shows the ideal case.
In practice, the browser may skip style/layout/paint if nothing changed.
The key insight: rAF runs at the START of the frame pipeline, before
layout and paint. setTimeout may fire at ANY point — including between
layout and paint, which forces a redundant synchronous layout if JavaScript
reads layout metrics after writing styles. -->

**rAF-based animation loop:**

```typescript
function animate(currentTime: number): void {
  // Update visual state
  element.style.transform = `translateX(${offset}px)`;

  // Schedule next frame
  animationId = requestAnimationFrame(animate);
}

// Start animation
let animationId = requestAnimationFrame(animate);

// Cancel when done — component unmount, animation end, etc.
function cleanup(): void {
  cancelAnimationFrame(animationId);
}
```

<!-- ILLUSTRATIVE: The animation loop schedules one rAF per frame.
The callback runs before layout and paint, so the transform change
is included in the current frame. cancelAnimationFrame stops the loop
when the animation is no longer needed — critical for cleanup in
component lifecycle management. -->

**Forced synchronous layout — the anti-pattern:**

```typescript
// BAD — forces synchronous layout
function moveElement(): void {
  for (let i = 0; i < 100; i++) {
    // Write: changes style
    elements[i].style.transform = `translateX(${i * 10}px)`;
    // Read: forces synchronous layout to get current position
    const width = elements[i].offsetWidth; // FORCE!
    // The browser must recompute layout to return the correct width
    // This layout was not needed — it's forced by the read-after-write
  }
}

// GOOD — batch reads and writes
function moveElementOptimized(): void {
  // Read first
  const widths = elements.map(el => el.offsetWidth);
  // Write second
  elements.forEach((el, i) => {
    el.style.transform = `translateX(${widths[i] + i * 10}px)`;
  });
}
```

<!-- ILLUSTRATIVE: The forced synchronous layout pattern (read after
write in a loop) causes the browser to recompute layout on every
iteration. The optimized pattern batches all reads before all writes,
so layout is computed once (if at all) instead of 100 times. This is
the "read first, write second" rule that prevents layout thrashing. -->

**setTimeout vs rAF — timing comparison:**

```
setTimeout(fn, 16) — fires every 16ms, regardless of frame rate:

Time (ms):    0    16    32    48    64    80    96   112
              │     │     │     │     │     │     │     │
setTimeout:   ●─────●─────●─────●─────●─────●─────●─────●
Display:      ●───────────●───────────●───────────●───────
              │  60fps    │  30fps    │  30fps    │
              
rAF — fires once per frame, synchronized with display:

Time (ms):    0    16    32    48    64    80    96   112
              │     │     │     │     │     │     │     │
rAF:          ●───────────●───────────●───────────●───────
Display:      ●───────────●───────────●───────────●───────
              │  30fps    │  30fps    │  30fps    │
```

<!-- ILLUSTRATIVE: On a 30fps device, setTimeout fires 6 times but the
display updates only 3 times — 3 callback results are wasted. rAF fires
3 times, once per display update — no wasted computation. rAF adapts to
the device's actual frame rate; setTimeout does not. -->

---

### Part 4: Follow-Up Questions

**Q: Can you use `requestAnimationFrame` for non-visual work?**

You can, but it's wrong. rAF is designed for visual updates — its callback is guaranteed to run before layout and paint. Using it for non-visual work (data processing, API calls, logging) wastes that guarantee. A non-visual task doesn't need to run before layout — it just needs to run eventually. `setTimeout(fn, 0)` or `queueMicrotask()` is more appropriate for non-visual work. The rule: rAF for visual updates, anything else for everything else.

**Q: What happens if a rAF callback takes longer than 16.7ms?**

The frame drops. The browser can't composite until the callback finishes, style/layout/paint complete, and the compositor assembles the frame. If the total time exceeds 16.7ms, the browser displays the previous frame for another cycle. On a 60fps display, this means one dropped frame — visible as a brief stutter. If the callback consistently takes longer than 16.7ms, frames drop continuously and the animation appears janky. The fix is to reduce the work per frame: break long computations into chunks spread across multiple frames, or move heavy work to a Web Worker.

**Q: How does `requestAnimationFrame` interact with background tabs?**

When a tab is backgrounded, the browser typically throttles rAF callbacks — they may stop firing entirely or fire at a much lower rate (once per second in some browsers). This is correct behavior: the user can't see the background tab, so rendering frames is wasted work. When the tab comes to the foreground, rAF resumes at the normal frame rate. This means animations that rely on rAF automatically pause when backgrounded and resume when focused, without any explicit handling.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use `requestAnimationFrame` instead of `setTimeout` for animations. `setTimeout(fn, 16)` gives you 60fps because 1000ms / 60 = 16.7ms."

**Why this misses the point:** The junior answer uses the right API but gives the wrong reason. `setTimeout(fn, 16)` does NOT give 60fps — it fires every 16ms regardless of frame rate, doesn't sync with the display, and can fire in the middle of a frame causing forced synchronous layouts. The junior answer doesn't explain WHERE rAF places the callback (start of frame, before layout and paint), doesn't mention `cancelAnimationFrame` for cleanup, and doesn't know that rAF is a throttle (one callback per frame) not a timer.

**Senior answer:**
"`requestAnimationFrame` places callbacks at the start of the next frame — before layout and paint — guaranteeing your DOM changes are included in the current frame's render. It synchronizes with the display's refresh rate and adapts to the device: on a 30fps device, rAF fires at 30fps, not 60. `setTimeout(fn, 16)` fires every 16ms regardless of frame rate, may fire in the middle of a frame, and reading layout metrics after writing styles forces a synchronous layout — a redundant reflow that wastes the frame budget. rAF also provides `cancelAnimationFrame` for cleanup when the animation ends. The frame budget is ~16.7ms at 60fps — everything must fit. rAF helps by putting your visual updates at the right moment in the pipeline, not randomly in the middle of it."

**The tell:** The junior answer says "setTimeout(fn, 16) gives you 60fps." The senior answer names the frame-start guarantee, the forced-synchronous-layout risk, and the adaptability to device frame rate.

---

### Part 6: Production Examples

A team building a scroll-driven animation library used `setTimeout(fn, 16)` for their animation loop because "it's simpler than rAF." On desktop, the animations were smooth. On mobile devices running at 30fps (under thermal throttling), the animations were visibly janky — `setTimeout` fired twice per frame, doing double the work for half the visible frames. The callbacks also fired between layout and paint on some frames, forcing synchronous layouts that added 10-20ms of overhead per frame. Switching to `requestAnimationFrame` eliminated the double-fire issue and the forced layouts. On the 30fps devices, the animation dropped to 30fps automatically — same visual smoothness as desktop at 60fps, because the animation adapted to the device's actual frame rate.

A different team had a dashboard with real-time charts that updated every second. The chart rendering was triggered by `setTimeout(fn, 1000)` — draw a new data point every second. The problem: the `setTimeout` callback sometimes fired in the middle of a frame, reading `chart.offsetWidth` to size the new data point. This forced a synchronous layout, which caused a visible layout shift in the chart area. The fix was switching to `requestAnimationFrame` with a timestamp check — the rAF callback checked if 1000ms had elapsed since the last draw, and only rendered if so. The callback always ran before layout and paint, so the `offsetWidth` read was part of the normal pipeline — no forced layout, no visual shift.

---

## Tie the Chain Together

The rendering pipeline converts HTML and CSS into pixels through nine stages: HTML parsing builds the DOM, CSS parsing builds the CSSOM, those combine into the Render Tree (excluding non-rendered nodes), layout computes geometry, paint generates draw calls per layer, and the compositor assembles layers into frames. The compositor thread runs separately from the main thread — this separation is the foundation for animation performance.

Layers are the optimization mechanism. Elements promoted to compositor layers can be animated without touching layout or paint. `transform`, `opacity`, `filter`, and `clip-path` animate on the compositor thread, which is why Session 18's "compositor-only" properties are smooth at 60fps while layout properties cause jank. `will-change` is the explicit promotion hint, but it has a real GPU memory cost — too many layers degrade performance for the whole page.

`requestAnimationFrame` hooks into the frame lifecycle at the right moment: the start of the frame, before layout and paint. This guarantees visual updates are included in the current frame's render. `setTimeout(fn, 0)` does not provide this guarantee and risks forced synchronous layouts. Session 26 continues with reflow and repaint — when layout and paint are triggered and how to minimize them on the critical rendering path.

---

## Cross-References

- Session 15 (`book/03-css-mastery/15-cascade-specificity-inheritance.md`) — cascade rules governing which CSSOM rules apply to each DOM node during Render Tree construction.
- Session 16 (`book/03-css-mastery/16-box-model-positioning.md`) — stacking context rules that determine paint order and compositor layer boundaries.
- Session 18 (`book/03-css-mastery/18-animations-transforms-transitions.md`) — compositor-only properties (`transform`, `opacity`, `filter`, `clip-path`) and `will-change` as GPU promotion hints. This session provides the full pipeline context for why those properties are cheaper.
- Session 22 (`book/04-browser/22-dns-tcp-tls-https.md`) — the network fetch that provides the HTML and CSS bytes the rendering pipeline processes.
- Session 24 (`book/04-browser/24-caching-cookies-storage.md`) — caching determines whether resources arrive from cache or network before the pipeline begins.
- Session 26 (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`) — continues with when layout and paint are triggered and how to minimize them.
