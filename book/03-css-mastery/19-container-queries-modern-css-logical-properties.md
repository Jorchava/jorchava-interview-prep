# Session 19 — Container Queries, Modern CSS, and Logical Properties

> **Module 3 — CSS Mastery.** Session 5 of 7.
> **Chain:** Container queries (size queries, `container-type`, `container-name`, style queries) → Logical properties (block/inline axes, naming pattern, `writing-mode` interaction) → `:has()` as a layout tool → CSS nesting (`&`).
> Session 18 covered animations and transforms. Session 20 continues with CSS variables and theming at scale.

<!-- Module 3 convention: CSS cascade, specificity, and rendering behavior is
observable in DevTools but not in a Node/jsdom unit-testing environment.
All CSS examples in this module are ILLUSTRATIVE — syntactically valid,
mentally traced, but not run against a browser harness in-session.
This convention applies to Sessions 15-21. -->

---

## Topic 1 — Container Queries

### Part 1: Theory

Media queries respond to the viewport. Container queries respond to the size of a specific ancestor element — the query container. That distinction is the entire reason container queries exist, and it's the point most explanations gloss over.

Here's the practical problem. You build a card component. It works beautifully in the main content area — three columns, plenty of room. Then someone puts the same card in a narrow sidebar. At the same viewport width, the sidebar card is 280 pixels wide while the main-area card is 600 pixels wide. Media queries can't distinguish between these two contexts because the viewport is the same for both. You'd need JavaScript to detect the card's actual width and apply different styles — which is exactly what container queries replace.

A container query works by first declaring a query container on a parent element, then writing a `@container` rule that applies styles to descendants based on the container's size. The syntax mirrors `@media`:

```css
/* Step 1: declare the container */
.card-wrapper {
  container-type: inline-size;
}

/* Step 2: query it from children */
@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}
```

<!-- ILLUSTRATIVE: container-type: inline-size makes .card-wrapper a query
container that can be queried by its inline dimension (width in horizontal
writing modes). The @container rule applies .card styles only when the
container is at least 400px wide. Verify in browser DevTools by resizing
the .card-wrapper element — the card layout changes based on the
container's width, not the viewport's. -->

**`container-type` has three values.** `inline-size` makes the element a container queryable by its inline dimension — width in horizontal writing modes. This is the default choice for most use cases. `size` makes it queryable by both inline and block dimensions (width and height), but requires the container to have a definite block size — a stronger constraint that affects layout. `normal` establishes a naming context without making the element a query container — useful for `container-name` without the layout implications of containment. Use `inline-size` by default, `size` only when you need to query the container's height.

**`container-name` targets specific containers** when containers are nested. Without a name, `@container` targets the nearest ancestor container. With a name, you can target a specific one:

```css
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

@container sidebar (max-width: 300px) {
  .card { font-size: 0.875rem; }
}
```

**Size queries** are the main use case — querying `min-width`, `max-width`, `width`, `height`, `min-height`, or `max-height` of the container. They work identically to media query conditions but scoped to the container.

**Style queries** are the natural extension. Instead of querying a dimension, you query a CSS custom property value. Unlike size queries, style queries don't require a `container-type` declaration — any element is a style container by default.

```css
/* No container-type declaration needed for style queries —
   any element is a style container by default */
.theme-wrapper {
  --theme: dark;
}

@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #e0e0e0;
  }
}
```

<!-- ILLUSTRATIVE: Style queries for custom properties are supported in
Chrome 111+, Firefox 151+, and Safari 18+ (partial — custom properties
only). Style queries on standard CSS properties remain experimental.
Verify against https://caniuse.com/css-container-queries-style for current
support. -->

Style queries enable true component variants without JavaScript — a card inside a container with `--theme: dark` gets dark styles automatically. This is the CSS equivalent of passing a "variant" prop in a component framework.

---

### Part 2: Interview Answer

Container queries solve a problem that media queries fundamentally cannot: component-level responsiveness. Media queries respond to the viewport width, but a card component doesn't know or care about the viewport — the same card might live in a narrow sidebar and a wide main area at the same viewport width. Media queries can't distinguish between those two contexts. Container queries can, because they respond to the size of a specific ancestor element, the query container.

You set up a container query in two steps. First, declare a query container on a parent element with `container-type`. The most common value is `inline-size`, which makes the container queryable by its width in horizontal writing modes. There's also `size`, which adds height querying but requires a definite block size on the container — a stronger layout constraint. And `normal`, which establishes a naming context without containment. Then you write a `@container` rule that applies styles to descendants based on the container's dimensions, using the same condition syntax as media queries.

When containers are nested, `container-name` lets you target a specific one instead of always hitting the nearest ancestor container. And style queries extend the concept beyond dimensions — `@container style(--variant: compact)` applies styles when a custom property has a specific value. That's component variants without JavaScript.

The practical shift: media queries handle page-level layout — sidebar versus main column, header breakpoints. Container queries handle component-level layout — a card that reflows when its container is narrow. In a design system where components are reused across multiple contexts, container queries eliminate the per-context breakpoint overrides that used to require JavaScript or duplicate CSS.

---

### Part 3: Whiteboard / Live Coding

A card component that adapts to narrow and wide containers:

```css
/* Declare the container */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Default: stacked layout (narrow container) */
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-image {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

/* Wide container: side-by-side layout */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
    align-items: start;
  }

  .card-image {
    width: 200px;
    flex-shrink: 0;
  }
}

/* Extra-wide container: more image space */
@container card (min-width: 600px) {
  .card-image {
    width: 280px;
  }

  .card-body {
    font-size: 1.125rem;
  }
}
```

<!-- ILLUSTRATIVE: The card stacks vertically when its container is narrow,
goes side-by-side at 400px, and gets a larger image at 600px. The
breakpoints respond to the .card-container width, not the viewport. A
sidebar containing .card-container at 300px shows the stacked layout; the
main content area containing .card-container at 700px shows the extra-wide
layout — both at the same viewport width. Verify in DevTools by resizing
the container element. -->

**Nested containers with `container-name`:**

```css
.dashboard {
  container-type: inline-size;
  container-name: dashboard;
}

.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

@container dashboard (min-width: 1200px) {
  .layout { grid-template-columns: 250px 1fr; }
}

@container sidebar (max-width: 280px) {
  .nav-item { font-size: 0.8rem; }
}
```

**Style query for theme variants:**

```css
/* No container-type needed — any element is a style container.
   Set the custom property on the container and query it. */
.theme-wrapper {
  --theme: dark;
}

@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #333;
  }
}

@container style(--theme: high-contrast) {
  .card {
    border: 2px solid currentColor;
    background: black;
    color: white;
  }
}
```

<!-- ILLUSTRATIVE: Style queries query custom property values on the
container. The card inherits the theme from its container without
JavaScript. Supported in Chrome 111+, Firefox 151+, Safari 18+ (partial).
Verify current support at https://caniuse.com/css-container-queries-style. -->

---

### Part 4: Follow-Up Questions

**Q: What's the difference between `container-type: inline-size` and `container-type: size`?**

`inline-size` creates containment on the inline axis only — the container's width is the queryable dimension in horizontal writing modes. `size` creates containment on both axes, meaning both width and height are queryable. The tradeoff: `size` requires the container to have a definite block size (a computed height), which affects layout. If you set `container-type: size` on an element whose height depends on its content, the browser can't resolve the height until after containment is applied — leading to layout issues or unexpected behavior. Use `inline-size` unless you genuinely need to query the container's height.

**Q: Can a container query target itself, or only its descendants?**

Only descendants. A `@container` rule never matches the container element itself — it targets children, grandchildren, and deeper descendants. This is a deliberate design choice: if a container could query itself, it would create circular dependencies where the container's own styles depend on its own size. The one-directional flow (container defines the query context, descendants respond to it) keeps the model predictable.

**Q: How do container queries interact with `@layer`?**

Container queries and cascade layers are orthogonal — a `@container` block can contain rules in any layer, and the cascade rules from Session 15 apply inside the container query just as they would inside a media query. The container query determines which styles are eligible; the cascade (origin, layer, specificity, source order) determines which eligible style wins.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Container queries are like media queries but for components. You use them when you want a component to respond to its parent's size instead of the viewport."

**Why this misses the point:** It restates the definition without explaining why the distinction matters. The junior answer doesn't explain the actual problem — that media queries can't distinguish between the same component in different layout contexts at the same viewport width — and doesn't mention `container-type`, `container-name`, or style queries.

**Senior answer:**
"The fundamental problem is that media queries respond to the viewport, but a component's layout should depend on its actual container, not the viewport. A card in a sidebar and a card in the main content area are the same component at the same viewport width, but they need different layouts. Container queries fix this by letting you declare a query container with `container-type: inline-size` and then write `@container` rules that respond to the container's dimensions. Style queries extend this further — `@container style(--theme: dark)` applies styles based on a custom property value, giving you component variants without JavaScript."

**The tell:** The senior answer names the specific problem (same component, different contexts, same viewport) and covers the full `container-type` surface. The junior answer gives a definition without the "why."

---

### Part 6: Production Examples

A design system team at a large fintech company had a notification component used in three contexts: a narrow sidebar alert (280px), a main-content banner (700px), and a full-width system alert (1200px). Before container queries, they maintained three separate CSS files — `notification-sidebar.css`, `notification-main.css`, `notification-banner.css` — each with its own media query breakpoints. Every time the component's layout changed, they updated three files. Engineers forgot which file applied to which context, and the sidebar version silently diverged from the main version for two sprints before anyone noticed.

The fix: one `notification.css` with container queries. The notification component declared `container-type: inline-size` on its wrapper, and the styles adapted to the container width — stacked in narrow containers, side-by-side in medium, full-width with metadata in wide. The three separate CSS files were deleted. When the design team changed the notification's padding, one file update propagated to all three contexts automatically.

The specific incident that triggered the migration: a regulatory compliance update changed the notification's text to include a legal disclaimer. The sidebar version was updated, but the main-content version still had the old text because an engineer updated the wrong file. The discrepancy was caught by a compliance audit two weeks later. After the container query migration, there was one file, one source of truth, and the compliance update applied everywhere simultaneously.

---

## Topic 2 — Logical Properties

### Part 1: Theory

Logical properties are the internationalization layer of CSS layout. They replace physical direction names (left, right, top, bottom) with axis-based names (block, inline) that adapt to the document's writing mode.

Here's the core idea. In a left-to-right (LTR) writing mode, `margin-left` pushes an element away from the left edge. In a right-to-left (RTL) writing mode — Arabic, Hebrew — `margin-left` still pushes from the left edge, but that's now the *end* of the text flow, not the start. The property describes a physical direction that doesn't change regardless of reading direction. Logical properties describe intent instead: `margin-inline-start` means "the start of the inline axis" — which is left in LTR and right in RTL.

The naming convention follows two axes:

- **Block axis** — the direction text blocks stack (top-to-bottom in horizontal writing modes). Properties: `-block-start` (was top), `-block-end` (was bottom).
- **Inline axis** — the direction text flows (left-to-right in LTR). Properties: `-inline-start` (was left in LTR), `-inline-end` (was right in LTR).

The pattern applies to margin, padding, border, inset, and sizing:

| Physical | Logical | Meaning |
|---|---|---|
| `margin-top` | `margin-block-start` | Space before the block axis |
| `margin-bottom` | `margin-block-end` | Space after the block axis |
| `margin-left` | `margin-inline-start` | Space at the inline start |
| `margin-right` | `margin-inline-end` | Space at the inline end |
| `padding-top` | `padding-block-start` | Padding at block start |
| `border-left` | `border-inline-start` | Border at inline start |
| `width` | `inline-size` | Size along the inline axis |
| `height` | `block-size` | Size along the block axis |
| `top` | `inset-block-start` | Positioning from block start |
| `left` | `inset-inline-start` | Positioning from inline start |

Shorthands work too: `margin-block` sets both `margin-block-start` and `margin-block-end`. `margin-inline` sets both inline start and end. `inset` sets all four positioning offsets.

`text-align` also has logical values: `start` and `end` instead of `left` and `right`. `text-align: start` aligns to the inline start — left in LTR, right in RTL.

The inheritance behavior is identical to physical properties. `margin-block-start` inherits exactly the same way `margin-top` does — logical properties sit on top of the cascade infrastructure Session 15 established, not outside it.

---

### Part 2: Interview Answer

Logical properties are CSS's answer to internationalization — they replace physical direction names with axis-based names that adapt to the writing mode. The point isn't that `margin-inline-start` is a fancier name for `margin-left`. The point is that in a right-to-right writing mode, `margin-inline-start` maps to `margin-right`, and in a vertical writing mode, it maps to `margin-top`. The property describes intent — "space at the start of the inline axis" — rather than a fixed physical direction.

The naming convention follows two axes. The block axis is the direction text blocks stack — top-to-bottom in horizontal writing modes. Properties use `-block-start` and `-block-end`. The inline axis is the direction text flows — left-to-right in LTR. Properties use `-inline-start` and `-inline-end`. The same pattern applies to margin, padding, border-width, inset, and sizing: `width` becomes `inline-size`, `height` becomes `block-size`, `top` becomes `inset-block-start`, `left` becomes `inset-inline-start`.

When should you use logical properties versus physical? For text-adjacent spacing and components that should work in any writing direction, logical properties are correct. For explicitly directional UI — a left sidebar in a western-style layout, a specific arrow pointing right — physical properties are sometimes clearer because the direction is intentional, not incidental. The practical rule: default to logical properties for anything text-related, and use physical properties only when the physical direction is the actual design intent.

The inheritance and cascade behavior is identical to physical properties. `margin-block-start` follows the same specificity, cascade layer, and inheritance rules as `margin-top`. Logical properties don't introduce a new system — they sit on top of the cascade infrastructure that already exists.

---

### Part 3: Whiteboard / Live Coding

**Physical vs. logical mapping — the naming pattern in action:**

```css
/* Physical directions — fixed regardless of writing mode */
.card-physical {
  margin-top: 1rem;
  margin-left: 1.5rem;
  padding-bottom: 0.75rem;
  border-right: 2px solid #ccc;
  width: 300px;
}

/* Logical directions — adapt to writing mode */
.card-logical {
  margin-block-start: 1rem;
  margin-inline-start: 1.5rem;
  padding-block-end: 0.75rem;
  border-inline-end: 2px solid #ccc;
  inline-size: 300px;
}
```

<!-- ILLUSTRATIVE: In LTR, margin-inline-start maps to margin-left and
border-inline-end maps to border-right. In RTL, margin-inline-start maps
to margin-right and border-inline-end maps to border-left. The logical
properties automatically flip when the writing mode changes. Verify by
inspecting computed styles in DevTools with direction: rtl applied. -->

**Writing mode interaction:**

```css
/* Default horizontal LTR */
.container {
  writing-mode: horizontal-tb;
  direction: ltr;
}

/* margin-inline-start = margin-left (1rem from the left) */

/* Switch to RTL */
.container-rtl {
  writing-mode: horizontal-tb;
  direction: rtl;
}

/* margin-inline-start = margin-right (1rem from the right) */

/* Vertical writing mode (Japanese, for example) */
.container-vertical {
  writing-mode: vertical-rl;
}

/* margin-inline-start = margin-top (1rem from the top) */
/* margin-block-start = margin-right (1rem from the right — block flow starts on the right in vertical-rl) */
```

<!-- ILLUSTRATIVE: The same logical property maps to different physical
directions depending on writing-mode and direction. In horizontal-tb + ltr,
inline-start is left. In horizontal-tb + rtl, inline-start is right. In
vertical-rl, inline-start is top. This is the entire purpose of logical
properties — one declaration that works correctly in any writing mode. -->

**Text-align with logical values:**

```css
/* Physical */
.text-left { text-align: left; }

/* Logical — adapts to writing direction */
.text-start { text-align: start; }
.text-end { text-align: end; }
```

**Shorthand logical properties:**

```css
.card {
  /* Both block start and end */
  margin-block: 1rem;
  padding-block: 0.5rem 1rem; /* start end */
  border-block: 1px solid #ccc;

  /* Both inline start and end */
  margin-inline: 1.5rem;
  padding-inline: 1rem 2rem; /* start end */
  border-inline: 2px solid #333;

  /* All four positioning offsets */
  inset: 0; /* same as top/right/bottom/left: 0 */
  inset-block: 1rem;
  inset-inline: 2rem;
}
```

---

### Part 4: Follow-Up Questions

**Q: When would you deliberately use physical properties instead of logical?**

When the physical direction is the actual design intent, not an incidental default. A close button that should always be in the top-right corner of a modal — that's `position: absolute; top: 0.5rem; right: 0.5rem;` because the button belongs in that corner regardless of writing mode. A shadow on the right side of a card that should always be on the right — `box-shadow: 4px 0 8px rgba(0,0,0,0.1)` is physical because the shadow direction is a visual design choice. The rule: if the physical direction is part of the design (an arrow pointing right, a specific corner), use physical. If the direction is incidental to text flow, use logical.

**Q: Do logical properties work with `calc()`?**

Yes. `margin-inline-start: calc(1rem + 2vw)` works identically to `margin-left: calc(1rem + 2vw)`. The logical property is resolved to a physical property at computed-value time, so any CSS function that works with physical properties works with logical properties. The same applies to custom properties: `margin-inline-start: var(--spacing)` resolves correctly.

**Q: What about `float`? Does it have logical equivalents?**

Yes — `float: inline-start` and `float: inline-end` replace `float: left` and `float: right`. `clear` has the same pattern: `clear: inline-start` and `clear: inline-end`. These are part of the same logical property system, though they're less commonly used than margin/padding/border logical properties because `float` itself is increasingly replaced by Flexbox and Grid.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Logical properties are just new names for the same things — `margin-inline-start` is the same as `margin-left`. It's mostly useful for RTL support."

**Why this misses the point:** Calling them "new names for the same things" misses that the naming convention follows a consistent axis model (block/inline, start/end) that applies to margin, padding, border, inset, sizing, and text-align uniformly. And framing it as "mostly useful for RTL" undersells the scope — vertical writing modes (Japanese, Chinese, Korean) use the same system, and the axis model means you write one declaration that works correctly in every writing mode, not just LTR and RTL.

**Senior answer:**
"Logical properties replace physical direction names with an axis model. Block axis is where text blocks stack — `-block-start` and `-block-end`. Inline axis is where text flows — `-inline-start` and `-inline-end`. The same pattern applies to margin, padding, border, inset, and sizing — `width` becomes `inline-size`, `height` becomes `block-size`. In LTR, `margin-inline-start` maps to `margin-left`. In RTL, it maps to `margin-right`. In vertical writing modes, it maps to `margin-top`. I default to logical properties for anything text-adjacent, and use physical properties only when the physical direction is the actual design intent — a close button in the top-right corner, for instance."

**The tell:** The senior answer states the axis model and pattern explicitly, not just a list of individual equivalences. The junior answer treats it as a naming preference rather than a layout system.

---

### Part 6: Production Examples

A SaaS company expanding into the Japanese market discovered that their entire UI broke in vertical writing mode. Their CSS used physical properties everywhere — `margin-top` for spacing between sections, `padding-left` for content indent, `border-right` for dividers. When Japanese users set their browser to vertical writing mode (common for long-form reading), the margins appeared on the wrong axis, the padding pushed content in the wrong direction, and the borders ran vertically instead of horizontally along the text flow.

The fix was a systematic migration to logical properties. `margin-top` became `margin-block-start`, `padding-left` became `padding-inline-start`, `border-right` became `border-inline-end`. The migration took two sprints — not because the changes were complex, but because every physical property needed to be evaluated for whether the physical direction was intentional or incidental.

The specific incident: a Japanese customer reported that their invoice preview was "completely unreadable." The invoice used `text-align: left` for all text, which in vertical writing mode aligned text to the top of the column instead of the start of the line. Changing to `text-align: start` fixed the alignment. After the migration, the same CSS worked correctly in LTR, RTL, and vertical writing modes without any writing-mode-specific overrides. The design system now ships with logical properties as the default, and physical properties require an explicit comment justifying why the physical direction is intentional.

---

## Topic 3 — `:has()` as a Layout Tool and CSS Nesting

### Part 1: Theory

Session 15 covered `:has()` in the context of specificity — it takes the specificity of its most specific argument. This session covers `:has()` as a layout and selection tool: the ability to style a parent based on what it contains.

Before `:has()`, selecting a parent based on its children required JavaScript. A form fieldset that should get a red border when any input inside it is invalid? JavaScript. A card that should change layout when it contains an image? JavaScript. `:has()` makes these patterns pure CSS:

```css
/* Fieldset gets a red border when it contains an invalid input */
fieldset:has(:invalid) {
  border-color: red;
}

/* Card with an image gets a different layout */
.card:has(> img) {
  display: grid;
  grid-template-columns: 200px 1fr;
}

/* Form group highlights when a required field is empty */
.form-group:has(input:placeholder-shown) {
  opacity: 0.6;
}
```

<!-- ILLUSTRATIVE: :has() selects the parent based on the presence of a
specific descendant. .card:has(> img) uses the direct child combinator to
match only cards where an img is an immediate child — not a nested image
inside a deeper descendant. Verify in browser DevTools by adding/removing
an <img> inside a .card element. -->

The composability with other selectors is what makes `:has()` powerful for layout. `.card:has(> img)` only matches cards where an `img` is a direct child — not a nested image. `.sidebar:has(.active)` matches a sidebar containing any element with the `.active` class. `.page:not(:has(main))` matches pages that don't have a `<main>` element — useful for layout fallbacks.

**CSS nesting** brings structural organization to stylesheets without a preprocessor. The `&` selector references the parent rule, and nested rules live inside the parent's declaration block:

```css
/* Native CSS nesting */
.card {
  padding: 1.5rem;
  border-radius: 0.75rem;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .card-body {
    line-height: 1.6;
  }

  @media (min-width: 600px) {
    padding: 2rem;

    .card-header {
      font-size: 1.25rem;
    }
  }
}
```

<!-- ILLUSTRATIVE: Native CSS nesting is supported in Chrome 120+,
Firefox 117+, Safari 17.2+. The & selector is required before
pseudo-classes (:hover), pseudo-elements (::before), and chained
class selectors (.card--modifier). Bare element and class selectors
can omit & in the relaxed syntax (Chrome 120+, Firefox 117+,
Safari 17.2+). Verify current support at https://caniuse.com/css-nesting. -->

The key difference from SCSS: CSS native nesting requires `&` in more places. SCSS lets you write `&__element` for BEM concatenation — CSS native nesting does not support string concatenation. You write the full selector: `.card__element` or `& .card__element`. Media queries can be nested inside rules, which keeps responsive styles co-located with the component they affect.

---

### Part 2: Interview Answer

`:has()` is the parent selector CSS always needed but never had. It lets you style an element based on what it contains — not just what it is. Before `:has()`, a fieldset that needed a red border when any child input was invalid required JavaScript to walk the DOM and add a class. Now it's one line: `fieldset:has(:invalid) { border-color: red; }`.

The composability is what makes it practical for layout decisions. `.card:has(> img)` matches only cards where an image is a direct child — so a card with an image gets a grid layout while a text-only card stays stacked. `.page:not(:has(main))` applies a fallback layout when there's no `<main>` element. These are parent-based selection patterns that were impossible in pure CSS before `:has()`.

CSS nesting brings the structural organization that preprocessors like SCSS provided, now natively. The `&` selector references the parent rule — `&:hover` inside `.card` becomes `.card:hover`. Nested class selectors, nested media queries, nested pseudo-classes — they all live inside the parent's declaration block, keeping component styles co-located. The main difference from SCSS: CSS nesting doesn't support string concatenation, so BEM patterns like `&__element` don't work. You write the full selector name instead. And the relaxed syntax in modern browsers lets you nest bare element and class selectors without `&` — `.card { h2 { ... } }` works directly in Chrome 120+, Firefox 117+, Safari 17.2+.

---

### Part 3: Whiteboard / Live Coding

**`:has()` for layout decisions:**

```css
/* Card with image: side-by-side layout */
.card:has(> img) {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 1rem;
}

/* Card without image: full-width stacked */
.card:not(:has(> img)) {
  display: flex;
  flex-direction: column;
}

/* Form fieldset highlights on error */
fieldset:has(:invalid) {
  border-color: #dc2626;
  background: #fef2f2;
}

/* Navigation highlights the section containing the active link */
nav:has(.active) {
  background: #f0f0f0;
}
```

<!-- ILLUSTRATIVE: .card:has(> img) uses the direct child combinator,
so it only matches cards where <img> is an immediate child — not cards
with images nested inside other elements. The fieldset example uses
:invalid, which matches any input that fails constraint validation
(required, pattern, min/max, etc.). Verify by adding/removing elements
in DevTools. -->

**CSS nesting — component-scoped styles:**

```css
.dialog {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.2s ease;

  &[data-open="true"] {
    opacity: 1;
  }

  .dialog-panel {
    background: white;
    border-radius: 1rem;
    width: min(90vw, 500px);
    padding: 2rem;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);

    .dialog-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .dialog-body {
      line-height: 1.6;
      color: #374151;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .dialog-panel {
      width: 95vw;
      padding: 1.5rem;
    }
  }
}
```

<!-- ILLUSTRATIVE: Native CSS nesting puts the dialog's children
(.dialog-panel, .dialog-title, etc.) inside the parent rule. The &[data-open]
attribute selector is nested with &. Media queries nest inside the rule,
keeping responsive styles co-located. Verify in browser DevTools that the
nested selectors compile to flat CSS rules. -->

**Combining `:has()` and nesting:**

```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  label {
    font-weight: 500;
    font-size: 0.875rem;
  }

  input {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
  }

  &:has(:invalid:not(:placeholder-shown)) {
    label {
      color: #dc2626;
    }

    input {
      border-color: #dc2626;
      background: #fef2f2;
    }
  }
}
```

<!-- ILLUSTRATIVE: :has(:invalid:not(:placeholder-shown)) targets the
form-field when it contains an invalid input that the user has started
filling in (not just the initial empty state). The nesting puts the
label and input error styles inside the &:has() block, keeping the
error state co-located with the base styles. -->

---

### Part 4: Follow-Up Questions

**Q: What's the performance implication of `:has()`?**

The specification notes that `:has()` can't be guaranteeed to be performant in all cases because the selector may need to evaluate descendants before determining if the parent matches. In practice, browsers optimize common patterns — `:has(> img)` (direct child) is fast because it only checks one level. Deep descendant selectors like `.page:has(.deeply-nested .child)` are slower because the browser may need to walk the full subtree. The practical guidance: use `:has()` with direct child or shallow descendant selectors for component layout, and avoid deeply nested `:has()` selectors in performance-critical rendering paths.

**Q: Does `:has()` work with `:not()`?**

Yes, and the combination is powerful. `.card:not(:has(> img))` selects cards that don't have a direct child image — the complement of `.card:has(> img)`. `.form:not(:has(:invalid))` selects forms with no invalid fields — useful for enabling a submit button only when the form is valid: `button:disabled { ... }` paired with `.form:has(:invalid) button { ... }`.

**Q: Can CSS nesting go infinitely deep?**

Technically yes, but practically no. Deeply nested CSS becomes hard to read and maintain — the same problem that plagued deeply nested SCSS. The practical limit is 2-3 levels. Beyond that, the specificity stacking makes overrides harder, and the visual indentation obscures the selector relationships. Nesting media queries inside rules is the one exception — that's a readability win at any depth because it keeps responsive styles co-located with the component.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"`:has()` is like jQuery's parent selector. It lets you select a parent element based on its children. CSS nesting is like Sass — you put child selectors inside the parent rule."

**Why this misses the point:** Calling `:has()` "like jQuery's parent selector" undersells the composability — `.card:has(> img)` with direct child combinators, `:not(:has(...))` for negation, combining with attribute selectors and pseudo-classes. And describing CSS nesting as "like Sass" ignores the key difference: CSS native nesting doesn't support BEM string concatenation (`&__element`), requires `&` before pseudo-classes and chained selectors, and has different specificity implications than SCSS compilation.

**Senior answer:**
"`:has()` enables parent-based layout decisions — a card that contains an image gets a grid layout, a fieldset with an invalid input gets a red border. The composability is what makes it practical: direct child combinators, negation with `:not()`, and combining with attribute selectors. CSS nesting brings component-scoped styles natively, with the `&` selector referencing the parent rule. The main difference from SCSS: no string concatenation for BEM patterns, and the relaxed syntax in modern browsers lets you omit `&` before bare element and class selectors. I use nesting to keep component styles co-located and `:has()` for layout decisions that previously required JavaScript."

**The tell:** The senior answer names specific composability patterns (direct child, negation, attribute selectors) and the concrete SCSS difference (no string concatenation). The junior answer gives surface-level definitions.

---

### Part 6: Production Examples

A component library team used `:has()` to eliminate conditional CSS classes from their React components. Previously, every card component accepted an `hasImage` boolean prop that added a `.card--with-image` class, triggering a different layout. The class had to be computed in JavaScript, passed through props, and applied in the template — three layers of code for a layout decision that was purely visual.

After adopting `:has()`, the card's CSS detected the presence of an image automatically: `.card:has(> img) { display: grid; ... }`. The `hasImage` prop was removed from the component API. The JavaScript team deleted 40 lines of conditional logic per card usage. The CSS team deleted the `.card--with-image` class entirely.

The specific incident: a designer added a new card variant with an icon instead of an image. The icon was an `<svg>`, not an `<img>`, so `:has(> img)` didn't match and the card got the wrong layout. The fix was `.card:has(> img, > svg)` — a one-line CSS change that would have required a new prop, a new class, and a new template conditional in the old system. The team now uses `:has()` as their first choice for layout conditionals, and reserves JavaScript class toggling for cases that genuinely need runtime logic — animations, focus management, or state that isn't reflected in the DOM structure.

---

## Tie the Chain Together

Container queries let components respond to their layout context instead of the viewport — completing the component-first responsive design model that media queries started but couldn't finish. Media queries handle page-level layout; container queries handle component-level layout. Style queries extend this to custom property values, enabling component variants without JavaScript.

Logical properties let the same component layout work correctly in any writing mode. The block/inline axis model is writing-mode-agnostic by design — one declaration that maps to the correct physical direction in LTR, RTL, and vertical writing modes. Physical properties remain the right choice only when the physical direction is the actual design intent.

`:has()` extends selectors from "descendants of X" to "X that contains Y," enabling parent-based layout decisions that previously required JavaScript. CSS nesting brings structural organization to stylesheets without a preprocessor, keeping component styles co-located and responsive rules inline with the component they affect.

Session 20 continues with CSS variables and theming at scale — the mechanism behind design tokens and runtime-switchable themes, and the foundation that makes style queries practical in real design systems.

---

## Cross-References

- Session 15 (`book/03-css-mastery/15-cascade-specificity-inheritance.md`) — cascade, specificity, and inheritance. Logical properties inherit identically to physical properties and follow the same cascade rules. `:has()` specificity was covered in Topic 2 of that session.
- Session 16 (`book/03-css-mastery/16-box-model-positioning.md`) — box model and positioning. Logical properties extend the box model with axis-based directions. `inset` logical properties replace physical `top`/`right`/`bottom`/`left`.
- Session 17 (`book/03-css-mastery/17-flexbox-grid-when-to-use-which.md`) — Flexbox and Grid layout. Container queries often trigger different Flexbox or Grid configurations based on container size.
- Session 20 (`book/03-css-mastery/20-css-variables-theming.md`) — CSS variables and theming. Style queries depend on custom properties, making the variable system the foundation for theme-aware component variants.
