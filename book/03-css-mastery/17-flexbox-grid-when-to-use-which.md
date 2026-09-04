# Session 17 — Flexbox, Grid, and When to Use Which

> **Module 3 — CSS Mastery.** Session 3 of 7.
> **Chain:** Flexbox (axes, `flex` shorthand, alignment, wrapping, common patterns) → Grid (explicit vs. implicit grid, `fr` units, `minmax`, `auto-fill` vs. `auto-fit`, named areas, subgrid) → when to use which (macro vs. micro framing).
> Session 16 established that Flexbox and Grid create new formatting contexts where margin collapsing doesn't apply. Session 18 continues with animations, transforms, and transitions.

<!-- Module 3 convention: CSS cascade, specificity, and rendering behavior is
observable in DevTools but not in a Node/jsdom unit-testing environment.
All CSS examples in this module are ILLUSTRATIVE — syntactically valid,
mentally traced, but not run against a browser harness in-session.
This convention applies to Sessions 15-21. -->

---

## Topic 1 — Flexbox

### Part 1: Theory

Flexbox is a one-dimensional layout model. It lays out items along a single axis — either horizontal or vertical — and provides alignment controls on the perpendicular axis. The axis is set by `flex-direction`: `row` (default) makes the main axis horizontal, `column` makes it vertical.

**The main axis and cross axis.** Items flow along the main axis. `justify-content` distributes items along that axis. `align-items` distributes items along the cross axis. Swap `flex-direction` and the axes swap with it — `justify-content` always controls the main axis regardless of direction.

**The `flex` shorthand.** This is where most candidates get it wrong. `flex` is shorthand for three properties: `flex-grow`, `flex-shrink`, and `flex-basis`. The shorthand accepts one, two, or three values, and the semantics depend on which values you provide:

- `flex: 1` resolves to `flex: 1 1 0`. The basis is `0`, not `auto`. This means the item starts at zero size and all available space is distributed via `flex-grow`. Content size is ignored as a starting point.
- `flex: 1 1 auto` (or `flex: auto`) resolves to `flex: 1 1 auto`. The basis is the content size, and remaining space after content is distributed via `flex-grow`.
- `flex: initial` (`flex: 0 1 auto`) means don't grow, can shrink, basis is content size — the browser default for flex items.
- `flex: none` (`flex: 0 0 auto`) means don't grow, don't shrink — item stays exactly at its content size.

The distinction between `flex-basis: 0` and `flex-basis: auto` matters. With `flex-basis: 0`, a 200px-wide item inside a 600px container with `flex: 1` alongside two siblings gets 200px — equal shares from zero. With `flex-basis: auto`, that same item gets its 200px first, then shares remaining space. The result is visually identical only when all items have the same content size.

**Alignment.** `justify-content` distributes space along the main axis: `flex-start` (items packed to the start), `center` (centered), `space-between` (equal gaps between items, no gap at edges), `space-around` (equal gaps with half-gaps at edges), `space-evenly` (equal gaps including edges). `align-items` distributes along the cross axis: `stretch` (default, items fill the cross axis), `flex-start`, `center`, `flex-end`, `baseline`. `align-self` overrides `align-items` for a single item. `gap` adds uniform spacing between items without outer gaps.

**Wrapping.** By default, flex items don't wrap — they shrink to fit a single line (`flex-wrap: nowrap`). Setting `flex-wrap: wrap` lets items wrap to new lines when the container is too narrow. With wrapping, `align-content` controls how multiple lines are distributed along the cross axis, analogous to `justify-content` for items on the main axis.

**Common patterns.** Centering: `display: flex; justify-content: center; align-items: center` centers a child both horizontally and vertically. Equal-width columns: three items with `flex: 1` each get equal shares of the container, regardless of content width. Sticky footer: a wrapper with `display: flex; flex-direction: column; min-height: 100vh`, and the main content area gets `flex: 1` — it grows to push the footer to the bottom.

---

### Part 2: Interview Answer

Flexbox is a one-dimensional layout model — it arranges items along a single axis and aligns them on the perpendicular axis. The axis is controlled by `flex-direction`: `row` makes the main axis horizontal, `column` makes it vertical. `justify-content` distributes items along the main axis, `align-items` controls the cross axis, and `gap` adds spacing between items without outer gaps.

The part worth knowing cold is the `flex` shorthand. It's shorthand for `flex-grow`, `flex-shrink`, and `flex-basis`. When you write `flex: 1`, that resolves to `flex: 1 1 0` — the basis is zero, not auto. That means the item starts at zero size and all available space is distributed proportionally via `flex-grow`. If you write `flex: 1 1 auto` instead, the item starts at its content size and only the leftover space is distributed. In practice this matters when items have different content widths — `flex-basis: 0` gives you perfectly equal columns, while `flex-basis: auto` gives you columns that respect content size first.

`flex-wrap` controls whether items stay on one line or wrap to multiple lines. By default it's `nowrap` — items shrink to fit. With wrapping, `align-content` distributes space between lines, just like `justify-content` distributes items on the main axis.

Three patterns show up constantly. Centering: `display: flex; justify-content: center; align-items: center` — dead simple vertical and horizontal centering. Equal-width columns: three items with `flex: 1` each get equal shares. Sticky footer: a flex column container with `min-height: 100vh`, and the main content area gets `flex: 1` so it grows to push the footer to the bottom. These patterns are so common that interviewers expect you to produce them without thinking.

---

### Part 3: Whiteboard / Live Coding

**The `flex` shorthand — the three-value form and the shorthand expansions:**

```css
/* flex: 1 = flex: 1 1 0 */
.item-a {
  flex: 1;
  /* Starts at 0, grows to fill space */
  /* Three equal items: each gets 33.33% regardless of content */
}

/* flex: auto = flex: 1 1 auto */
.item-b {
  flex: auto;
  /* Starts at content size, then grows to fill remaining space */
  /* If content is 200px in a 600px container with 2 siblings:
     gets 200px first, then shares the 400px leftover equally */
}

/* flex: none = flex: 0 0 auto */
.item-c {
  flex: none;
  /* Stays at content size, doesn't grow or shrink */
}
```

<!-- ILLUSTRATIVE: The difference between flex: 1 and flex: auto is invisible
when all items have identical content sizes. It becomes visible when items
have different content — flex: 1 gives equal columns, flex: auto gives
content-aware sizing. Verify in browser DevTools: the Computed panel shows
the resolved flex-basis value. -->

**Alignment — all six properties:**

```css
.container {
  display: flex;
  gap: 16px;

  /* Main axis distribution */
  justify-content: space-between;

  /* Cross axis alignment */
  align-items: center;

  /* For wrapping — distributes space between lines */
  align-content: flex-start;
}

.item {
  /* Override align-items for one item */
  align-self: flex-end;
}
```

<!-- ILLUSTRATIVE: justify-content and align-items always control the main
axis and cross axis respectively, regardless of which direction flex-direction
sets. In a column layout, justify-content controls vertical distribution
and align-items controls horizontal. -->

**Sticky footer pattern:**

```css
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main {
  flex: 1; /* grows to fill remaining space */
}

footer {
  /* no flex needed — takes its natural height */
}
```

<!-- ILLUSTRATIVE: The main content area grows to push the footer to the
bottom of the viewport. When content overflows, the page scrolls and the
footer stays at the content's end, not the viewport's end. -->

---

### Part 4: Follow-Up Questions

**Q: When would you use `flex: 1` vs `flex: auto`?**

Use `flex: 1` when you want equal distribution regardless of content — three sidebar panels that should each take exactly one-third of the container. Use `flex: auto` when you want content to get its natural size first and only the leftover space is distributed — a navbar where the logo and nav links take their content width and a search bar fills the remaining space. The short version: `flex: 1` ignores content, `flex: auto` respects it.

**Q: What happens when flex items wrap?**

With `flex-wrap: wrap`, items that don't fit on one line move to the next. The container's cross axis now has multiple lines, and `align-content` distributes space between those lines — just like `justify-content` distributes items on the main axis. Individual items still respect `align-items` within their line. One gotcha: wrapped flex items don't maintain column alignment across lines. If you need items in different rows to align to the same columns, that's a job for Grid.

**Q: How do you handle alignment when flex items have different heights?**

By default, `align-items: stretch` makes all items fill the tallest item's height on the cross axis. If you want items to size to their content, set `align-items: flex-start`. For explicit control per item, use `align-self`. For equal-height columns in a card layout where each card has a different content length, `align-items: stretch` is the default and the correct approach — the cards stretch to match the tallest one.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Flexbox lays things out in a row or column. `justify-content` aligns items horizontally, `align-items` aligns them vertically. `flex: 1` makes items take equal space. You can center anything with `display: flex; justify-content: center; align-items: center`."

**Why this misses the point:** The junior answer hardcodes `justify-content` as "horizontal" — it's actually the main axis, which is vertical when `flex-direction: column`. It says `flex: 1` makes items "take equal space" without knowing why (it's `1 1 0` — basis of zero, equal growth). It doesn't distinguish `flex: 1` from `flex: auto`, doesn't mention `flex-shrink`, and doesn't know that wrapping breaks column alignment across lines.

**Senior answer:**
"Flexbox is one-dimensional — it lays out items along a single axis and aligns them on the perpendicular axis. The main axis is set by `flex-direction`. `justify-content` distributes along the main axis, `align-items` on the cross axis. The `flex` shorthand controls grow, shrink, and basis — `flex: 1` is `1 1 0`, which means basis of zero and equal growth from zero; `flex: auto` is `1 1 auto`, which means content size first, then growth. Use `flex: 1` for equal columns, `flex: auto` when content should dictate initial size. With `flex-wrap`, items wrap to new lines and `align-content` distributes space between lines, but items don't maintain column alignment across lines — that's Grid territory."

**The tell:** The junior answer treats `justify-content` as horizontal and doesn't know the `flex: 1` = `1 1 0` shorthand. The senior answer names the basis distinction and knows when wrapping breaks the model.

---

### Part 6: Production Examples

A component library team had a toolbar component with three groups: left-aligned buttons, a centered title, and right-aligned actions. The first attempt used three separate containers with `flex: 1` on each, trying to force equal-width columns. The title text varied in length, so the "centered" title was never actually centered — it was centered within its third of the toolbar, not within the toolbar itself. The fix was a single flex container with `justify-content: space-between` and the title wrapped in a centered group that had `flex: 1` — the title group grew to fill the middle space, and `text-align: center` centered the text within that space. The senior pattern: use `space-between` for edge groups and let the middle group grow, rather than forcing three equal columns.

A different team built a dashboard with five equal-width stat cards using `flex: 1` on each card. It worked until one card needed a longer label that wrapped to two lines, making that card taller than the others. The cards were in a `flex-wrap: wrap` container, so the taller card broke the alignment of cards on the same row — the second row started lower than expected. The fix was switching to CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, which kept column alignment across rows. The lesson: Flexbox is perfect for a single-row toolbar; when you need items in different rows to align to the same columns, Grid is the right tool.

---

## Topic 2 — Grid

### Part 1: Theory

CSS Grid is a two-dimensional layout model. It defines rows and columns simultaneously and places items at intersections. Where Flexbox distributes space along one axis, Grid distributes space in both dimensions at once.

**The explicit grid.** Defined by `grid-template-columns` and `grid-template-rows`. These properties create named tracks (rows and columns) with explicit sizes:

```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  grid-template-rows: auto 1fr auto;
}
```

This creates a three-column layout: a 200px sidebar, two flexible columns sharing remaining space, and three rows — auto-height header, flexible main content, auto-height footer.

**`fr` units.** The `fr` unit distributes remaining space after fixed sizes and content-based sizes are accounted for. `grid-template-columns: 200px 1fr 1fr` means: give the first column 200px, then split the remaining space equally between the second and third. If the container is 1000px, the first column is 200px and each of the other two is 400px. The `fr` unit is fundamentally different from percentages — percentages resolve before layout, `fr` distributes after fixed tracks are sized.

**`minmax()`.** Defines a track size as a range: `minmax(200px, 1fr)` means the track is at least 200px but at most `1fr`. This is the foundation of responsive grid layouts without media queries.

**`repeat()` with `auto-fill` vs. `auto-fit`.** Both create as many tracks as fit in the container. The difference is what happens to empty tracks:

- `repeat(auto-fill, minmax(200px, 1fr))` creates as many 200px-minimum columns as fit. If there are fewer items than columns, the empty columns remain as tracks — they take up space, creating gaps at the end.
- `repeat(auto-fit, minmax(200px, 1fr))` creates as many columns as fit, but empty columns collapse to zero width. Remaining items stretch to fill the container via `1fr`.

Concrete example: a 700px container with `auto-fill, minmax(200px, 1fr)` creates three columns (200px each minimum). Two items fill the first two columns; the third column remains empty but takes up space. With `auto-fit`, that empty third column collapses, and the two items stretch to fill the full 700px. This is the most-asked Grid-specific question in interviews.

**The implicit grid.** When items overflow the explicit grid, the browser creates implicit tracks. `grid-auto-rows` and `grid-auto-columns` control their size. Without these, implicit tracks default to `auto` (content-sized), which can produce uneven row heights. Setting `grid-auto-rows: minmax(100px, auto)` gives all implicit rows a minimum height.

`grid-auto-flow` controls how items are placed: `row` (default) fills row by row, `column` fills column by column. `grid-auto-flow: dense` attempts to fill earlier gaps in the grid — useful for masonry-like layouts, but it changes the DOM reading order, which can break screen reader navigation and keyboard tab order.

**Named lines and areas.** `grid-template-areas` lets you name regions of the grid and assign items to them by name:

```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.footer  { grid-area: footer; }
```

This reads like the actual layout. Each string is a row, each word is a cell. Periods (`.`) represent empty cells. Named areas make complex layouts readable and maintainable.

**Subgrid.** Before subgrid, a card component with a header, body, and footer couldn't align its footer across cards when the body had different content lengths — each card was its own grid, and the footers landed at different vertical positions. Subgrid solves this: a nested grid item inherits its parent's track definitions with `grid-template-columns: subgrid` or `grid-template-rows: subgrid`. The card becomes a grid item in the parent grid, and its internal rows align to the parent's rows. Subgrid is now widely supported across browsers (Chrome 117+, Firefox 71+, Safari 16+).

---

### Part 2: Interview Answer

CSS Grid is two-dimensional — it defines rows and columns simultaneously and places items at their intersections. The explicit grid is what you define with `grid-template-columns` and `grid-template-rows`. The `fr` unit distributes remaining space after fixed sizes are accounted for — `grid-template-columns: 200px 1fr 1fr` gives the first column 200px and splits the rest equally. `minmax()` defines a size range, so `minmax(200px, 1fr)` means at least 200px, at most one fraction of remaining space.

The most-asked Grid question is `auto-fill` vs. `auto-fit` in `repeat()`. Both create as many columns as fit. With `auto-fill`, empty columns stay as tracks — they take up space, leaving gaps. With `auto-fit`, empty columns collapse to zero and the existing items stretch to fill the container. Same number of tracks, different behavior when there are fewer items than columns.

When items overflow the explicit grid, the browser creates implicit tracks. `grid-auto-rows` controls their size — without it, implicit tracks default to content height, which can produce uneven rows. `grid-auto-flow: dense` fills holes in the grid, useful for photo galleries where items have different sizes, but it changes DOM reading order, which can break accessibility.

Named areas via `grid-template-areas` make complex layouts readable — you draw the layout with strings and assign items to regions by name. Subgrid is the answer to the card-footer alignment problem: a nested element inherits its parent's track definitions so that card footers in different rows align to the same grid lines, regardless of how tall each card's body content is. It's widely supported now and the right tool for that specific problem.

---

### Part 3: Whiteboard / Live Coding

**`auto-fill` vs. `auto-fit` — the concrete difference:**

```css
/* Container: 700px wide */

/* auto-fill: 3 columns, empty column takes space */
.auto-fill {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
/* 2 items: item1 | item2 | [empty 200px+ gap] */
/* 3 items: item1 | item2 | item3 — no gap */

/* auto-fit: 2 columns, empty column collapses */
.auto-fit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
/* 2 items: item1 | item2 — both stretch to fill 700px */
/* 3 items: item1 | item2 | item3 — same as auto-fill */
```

<!-- ILLUSTRATIVE: With auto-fill and 2 items, the third column exists as
a track (auto-fill) or collapses (auto-fit). The visual difference is
gaps at the end (auto-fill) vs. items stretching (auto-fit). With 3+
items filling all columns, both behave identically. Verify by resizing
the browser and observing how items resize. -->

**Implicit grid — `grid-auto-rows`:**

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* No grid-template-rows — all rows are implicit */
  grid-auto-rows: minmax(100px, auto);
  gap: 16px;
}
/* Every row is at least 100px tall, grows with content */
/* Without grid-auto-rows, rows would be content-sized only */
```

**Named areas — the readable layout:**

```css
.dashboard {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  grid-template-rows: 64px 1fr 48px;
  grid-template-areas:
    "sidebar header  header"
    "sidebar main    aside"
    "sidebar footer  footer";
  height: 100vh;
}

.sidebar { grid-area: sidebar; }
.header  { grid-area: header; }
.main    { grid-area: main; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }
```

**Subgrid — the card alignment fix:**

```css
/* Parent grid defines the columns */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

/* Each card inherits the parent's column tracks */
.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3; /* header, body, footer */
}
/* Now all card headers align, all footers align,
   regardless of body content length */
```

<!-- ILLUSTRATIVE: Without subgrid, each card is its own grid context
and the footer positions independently. With subgrid, the card's rows
are defined by the parent grid, so footers across all cards align to
the same horizontal lines. Verify in browser DevTools: the Computed
panel shows the resolved grid tracks. -->

---

### Part 4: Follow-Up Questions

**Q: When would you use `grid-auto-flow: dense`?**

Photo galleries and card layouts where items have different sizes and you want to fill gaps. With `grid-auto-flow: dense`, the algorithm scans backward to fill earlier holes — a tall item that would normally start a new row can slot into an earlier gap. The tradeoff: it changes DOM order. Item 5 might visually appear before item 3. For visual-only layouts (a gallery where the DOM order doesn't imply reading sequence), that's fine. For anything where reading order matters — a list of articles, a navigation menu — don't use `dense`.

**Q: Can Grid do everything Flexbox can?**

Technically yes — a single-axis Grid with `grid-template-columns: repeat(3, 1fr)` behaves identically to three `flex: 1` items. But Grid is overkill for one-dimensional component layout. Flexbox is purpose-built for distributing space along one axis with content-driven sizing. Grid is purpose-built for two-dimensional container-driven layout. Use the tool that matches the problem dimensionality.

**Q: What's the difference between `fr` and percentage units?**

Percentages resolve based on the container's computed size before layout. `fr` units distribute remaining space after fixed tracks are sized. In `grid-template-columns: 200px 1fr`, the `1fr` is the container width minus 200px minus gaps. In `grid-template-columns: 200px 80%`, the `80%` is 80% of the container width regardless of the 200px column — which could overflow. `fr` is safer for mixed fixed and flexible tracks.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Grid lets you define rows and columns with `grid-template-columns` and `grid-template-rows`. Use `fr` units for flexible sizing. `auto-fill` and `auto-fit` both create responsive columns. `grid-template-areas` lets you name sections. You can nest Grid inside Grid."

**Why this misses the point:** The junior answer says `auto-fill` and `auto-fit` "both create responsive columns" without knowing the difference — empty column behavior is the entire point. It doesn't mention the implicit grid, `grid-auto-rows`, or `grid-auto-flow: dense`. It doesn't know that subgrid exists or what problem it solves. It treats Grid as a nicer way to do what Flexbox already does, without understanding the two-dimensional vs. one-dimensional distinction.

**Senior answer:**
"Grid is two-dimensional — it defines rows and columns simultaneously. The explicit grid is what you define with `grid-template-columns`/`rows`; the implicit grid is what the browser creates when items overflow. `fr` distributes remaining space after fixed tracks; percentages resolve before layout, which can cause overflow with mixed fixed and flexible tracks. `auto-fill` creates as many columns as fit, keeping empty tracks as space; `auto-fit` collapses empty tracks and stretches items to fill. `grid-auto-rows` sizes implicit rows; without it, they default to content height and can be uneven. `grid-auto-flow: dense` fills gaps but changes DOM reading order. Subgrid lets a nested element inherit its parent's track definitions — it solves the card-footer alignment problem where footers in different rows need to line up across cards."

**The tell:** The junior answer can set up a basic grid but doesn't know the implicit grid, the `auto-fill`/`auto-fit` difference, or subgrid. The senior answer names all three and knows when each matters.

---

### Part 6: Production Examples

A media company's article listing page used `auto-fill` for a responsive card grid: `repeat(auto-fill, minmax(300px, 1fr))`. On a 1200px container, this created four columns. When there were only three articles, the fourth column remained as an empty track — a visible gap at the end of the row. Designers kept asking why the last row didn't fill the width. The fix was switching to `auto-fit`, which collapsed the empty column and stretched the three cards to fill the full 1200px. The team had assumed `auto-fill` and `auto-fit` were interchangeable because the docs described them similarly. The actual difference — empty tracks stay vs. collapse — is the kind of thing that only becomes obvious when you see it.

A different team built a dashboard with a sidebar, header, main content area, and footer. They initially used Flexbox for the entire page layout — a column flex container with `min-height: 100vh`, flex children for each section. The sidebar and main content needed to sit side-by-side, so they nested a row flex container inside. Three levels of nesting later, the layout was fragile: the footer's position depended on the sidebar height, which depended on the nav items, which depended on user permissions. The rewrite used Grid for the page-level layout: `grid-template-columns: 240px 1fr` and `grid-template-rows: 64px 1fr 48px` with `grid-template-areas`. The sidebar, header, main, and footer each occupied one area. Nested components inside each area still used Flexbox for their own internal layout — nav items in the sidebar, button groups in the header. The pattern: Grid for the macro structure, Flexbox for the micro layout inside each cell.

---

## Topic 3 — When to Use Which

### Part 1: Theory

The "Flexbox or Grid?" question isn't a choice between competing tools — it's a question about layout dimensionality and who drives the sizing.

**The dimensional rule.** Flexbox is one-dimensional. It lays out items along a single axis (row or column) and handles alignment on the perpendicular axis as a secondary concern. Grid is two-dimensional. It defines rows and columns simultaneously and places items at intersections. This isn't a preference — it's the spec-level distinction.

**Content-driven vs. container-driven sizing.** Flexbox is content-driven: items determine their own size based on their content, and the flex algorithm distributes remaining space. A navbar with a logo, three links, and a search input — each item has a natural size, and Flexbox handles the spacing. Grid is container-driven: the container defines track sizes, and items fill them. A page layout with a 240px sidebar, a flexible main area, and a 300px aside — the container dictates the structure.

**The composition pattern.** Grid for the macro layout, Flexbox for the micro layout inside each grid cell. A dashboard uses Grid for the page structure (sidebar, header, main, footer as named areas). Inside the header, a Flex row distributes logo, nav links, and user menu. Inside the main area, a Flex column stacks cards. Inside each card, a Flex row aligns the title and action button. This is the idiomatic production pattern — the two layout models composed at different levels of the hierarchy.

**When Grid is overkill.** A single row of buttons in a toolbar. A form with labels and inputs side by side. A card with a title and a subtitle. These are one-dimensional component layouts where Flexbox's content-driven model is the natural fit. Reaching for Grid here adds unnecessary complexity — track definitions, area names, and implicit grid management for something Flexbox handles with `display: flex; gap: 8px`.

**When Flexbox is insufficient.** A photo gallery where items need to align across rows. A page layout where the sidebar height must match the main content height. A form where labels and inputs across different rows must align to the same vertical line. These are two-dimensional problems where the container defines the structure and items must respect both row and column constraints simultaneously.

---

### Part 2: Interview Answer

Flexbox and Grid aren't competing tools — they're designed for different dimensions of layout. Flexbox is one-dimensional: it distributes items along a single axis and handles perpendicular alignment as a secondary concern. Grid is two-dimensional: it defines rows and columns simultaneously and places items at intersections.

The practical rule is about who drives the sizing. Flexbox is content-driven — items determine their own size, and the algorithm distributes remaining space. A toolbar with a logo, three links, and a search input: each item has a natural width, Flexbox handles the gaps. Grid is container-driven — the container defines track sizes, and items fill them. A page layout with a 240px sidebar and a flexible main area: the container dictates the structure.

The idiomatic production pattern is using both together. Grid for the page-level or region-level layout — the macro structure. Flexbox for the component-level layout inside each grid cell — the micro layout. A dashboard with a Grid-defined sidebar, header, main, and footer. Inside the header, a Flex row for logo, nav, and user menu. Inside the main area, Flex columns for stacked cards. Inside each card, Flex for title and action alignment. You're not choosing one — you're composing them at different levels of the layout hierarchy.

The mistake is treating them as interchangeable. Grid can technically do everything Flexbox does in one dimension — `grid-template-columns: repeat(3, 1fr)` behaves like three `flex: 1` items. But Grid's track management is overhead for component layout. Flexbox can technically do two dimensions with wrapping, but wrapped items don't maintain column alignment across lines. Use the tool that matches the problem's dimensionality.

---

### Part 3: Whiteboard / Live Coding

**Grid for macro layout, Flexbox for micro layout — the composition:**

```css
/* MACRO: Grid for page structure */
.page {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 64px 1fr 48px;
  grid-template-areas:
    "sidebar header"
    "sidebar main"
    "sidebar footer";
  height: 100vh;
}

/* MICRO: Flexbox inside the header */
.header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
}

.nav-links {
  display: flex;
  gap: 16px;
  margin-left: auto; /* pushes to the right */
}

/* MICRO: Flexbox inside a card */
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

<!-- ILLUSTRATIVE: The page uses Grid to define the overall structure —
sidebar, header, main, footer each occupy named areas. Inside each area,
Flexbox handles the component-level layout. This is the idiomatic
composition pattern: Grid for structure, Flexbox for flow. -->

**When Flexbox is sufficient — a toolbar:**

```css
/* One-dimensional: just a row of items */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-group {
  display: flex;
  gap: 8px;
}
```

**When Grid is necessary — alignment across rows:**

```css
/* Two-dimensional: items must align to columns across rows */
.form-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px 16px;
  align-items: baseline;
}

.form-grid label {
  text-align: right;
}

/* Labels and inputs align to the same columns
   regardless of how many rows there are */
```

---

### Part 4: Follow-Up Questions

**Q: Can I use Grid for a navbar?**

You can, but Flexbox is the better fit. A navbar is one-dimensional — items flow in a row, each has a natural size, and you're distributing space between them. Grid would require defining track sizes for an unknown number of items, managing implicit columns, and handling responsiveness with `auto-fill`/`auto-fit` — all overhead that Flexbox handles implicitly with `display: flex; gap: 16px`. The exception: if the navbar has a strict two-dimensional structure (fixed-width logo area, fixed-width search area, flexible nav links), Grid's explicit track definitions can be clearer.

**Q: What about responsive layouts — which is better?**

Both handle responsiveness, but differently. Flexbox wraps items with `flex-wrap: wrap` and lets them reflow naturally — items size to content and wrap when the container is too narrow. Grid uses `auto-fill`/`auto-fit` with `minmax()` to create responsive columns that adjust their count based on container width. Flexbox is better for component-level responsiveness (a tag list that wraps). Grid is better for page-level responsiveness (a card grid that shows 2, 3, or 4 columns depending on viewport width).

**Q: How do you decide in practice?**

Ask two questions. First: is this one-dimensional or two-dimensional? One axis — Flexbox. Two axes — Grid. Second: who drives the sizing? Content determines size — Flexbox. Container determines size — Grid. If both answers point the same way, the choice is clear. If they conflict (one-dimensional but container-driven, or two-dimensional but content-driven), pick the one that matches the harder constraint and adjust the other with properties.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use Flexbox for simple layouts and Grid for complex ones. Flexbox is easier to learn, so start there. Grid is overkill for components — use it for page layouts. They do similar things, so it doesn't matter much which one you pick."

**Why this misses the point:** The junior answer frames the choice as "simple vs. complex" and "easy vs. hard" — neither is the actual criterion. It says Grid is "overkill for components" without knowing that some component layouts (a form with aligned labels, a dashboard widget with cross-row alignment) are two-dimensional problems where Grid is the correct tool. It says "they do similar things" without understanding the one-dimensional vs. two-dimensional distinction, and it doesn't know the composition pattern.

**Senior answer:**
"Flexbox and Grid aren't competitors — they're composed at different levels of the layout hierarchy. Flexbox is one-dimensional and content-driven: items size to their content, space distributes along one axis. Grid is two-dimensional and container-driven: the container defines rows and columns, items fill them. I use Grid for page-level or region-level structure — the macro layout. I use Flexbox for component-level layout inside each grid cell — the micro layout. The decision rule: one axis and content-driven sizing points to Flexbox; two axes and container-driven sizing points to Grid. In practice, most pages use both — Grid for the overall structure, Flexbox for the components inside."

**The tell:** The junior answer treats them as competing tools and picks based on complexity. The senior answer composes them at different levels of the hierarchy and names the dimensionality and sizing models as the decision criteria.

---

### Part 6: Production Examples

A design system team documented their layout guidelines after engineers kept reaching for Grid in component code and Flexbox in page layout. The problem: Grid in components meant defining track structures for simple rows of buttons and form fields — unnecessary overhead that made components rigid and harder to responsive. Flexbox in page layout meant nesting multiple levels of flex containers to approximate grid alignment, producing fragile code that broke when content changed. The guideline they adopted: Grid for anything that defines the page or region structure (sidebar + main, card grid, dashboard panels). Flexbox for anything inside a single component or region (toolbar, form row, card internals, nav items). The rule eliminated a category of PR feedback and made layout decisions predictable across the codebase.

A different team had a Kanban board where each column contained cards of different heights. They initially used Flexbox for the column layout — each column was a flex container with `flex-direction: column`. The problem: cards in different columns needed to align horizontally across columns (card 1 in column A should be at the same vertical position as card 1 in column B). Flexbox couldn't maintain that alignment because each column was an independent flex context. The fix was making the Kanban board a single Grid container with `grid-template-columns: repeat(4, 1fr)` and each column a grid item — the cards inside each column used Flexbox for vertical stacking, but the horizontal alignment across columns was handled by the parent Grid. Again: Grid for the macro alignment, Flexbox for the micro flow inside each cell.

---

## Tie the Chain Together

Flexbox and Grid both create new formatting contexts — margin collapsing doesn't apply inside either one, as Session 16 established. That's the shared foundation. What differs is the layout model: Flexbox distributes space along a single axis (main-axis distribution with cross-axis alignment as a secondary concern), while Grid defines rows and columns simultaneously and distributes space in both dimensions at once.

The practical takeaway is that these models are designed to be composed, not chosen between. Grid for the macro structure — page layout, region definitions, content grids where items must align across rows. Flexbox for the micro flow inside each grid cell — nav bars, button groups, card internals where items determine their own size and distribute remaining space along one axis. The two-level composition is the idiomatic production pattern, and the sign of a senior answer is knowing which tool fits which level of the layout hierarchy.

Session 18 continues with animations, transforms, and transitions — the motion and rendering performance side of CSS.

---

## Cross-References

- Session 16 (`book/03-css-mastery/16-box-model-positioning.md`) — box model, positioning schemes, and the formatting context rules that Flexbox and Grid build on.
- Session 18 (`book/03-css-mastery/18-animations-transforms-transitions.md`) — animations, transforms, and transitions.
