# Session 16 — Box Model and Positioning Schemes

> **Module 3 — CSS Mastery.** Session 2 of 7.
> **Chain:** Box model (content, padding, border, margin) → `box-sizing` modes → margin collapsing → positioning schemes (static, relative, absolute, fixed, sticky) → containing block vs. stacking context.
> Session 15 established the cascade rules that govern how these values are resolved. Session 17 continues with Flexbox and Grid.

<!-- Module 3 convention: CSS cascade, specificity, and rendering behavior is
observable in DevTools but not in a Node/jsdom unit-testing environment.
All CSS examples in this module are ILLUSTRATIVE — syntactically valid,
mentally traced, but not run against a browser harness in-session.
This convention applies to Sessions 15-21. -->

---

## Topic 1 — The Box Model

### Part 1: Theory

Every element in CSS generates a rectangular box. The box model defines how that rectangle is built — four concentric layers, from inside out: content, padding, border, and margin.

**Content area.** The inner rectangle that holds the element's actual content — text, images, child elements. Its dimensions are set by `width` and `height`.

**Padding.** The space between the content and the border. Padding has the same background as the element, so it visually extends the element's surface. Padding is never negative.

**Border.** The visible edge of the element. Borders have width, style, and color. They sit between padding and margin and count toward the element's rendered size.

**Margin.** The space outside the border, pushing adjacent elements away. Margin can be negative — negative margin pulls elements closer or even overlaps them. Margin is the only box model layer that can collapse.

The critical distinction is `box-sizing`. The default is `content-box`: `width` and `height` apply only to the content area. Padding and border are added on top. The alternative is `border-box`: `width` and `height` include content, padding, and border. The arithmetic is exact.

A `content-box` element with `width: 200px; padding: 20px; border: 2px solid` renders as 244px wide: 200 (content) + 40 (padding) + 4 (border). The same declarations in `border-box` render as exactly 200px — the content area shrinks to 156px to make room for the padding and border inside the declared width — 200 minus 40px of horizontal padding (20px × 2) minus 4px of horizontal border (2px × 2).

The universal `box-sizing` reset applies `border-box` to every element. The most common form is `*, *::before, *::after { box-sizing: border-box; }`. A more robust version uses `inherit`: `html { box-sizing: border-box; }` followed by `*, *::before, *::after { box-sizing: inherit; }`. The `inherit` version lets a component opt out by overriding `box-sizing` on a parent — the children follow the parent's choice, not the global reset.

**Margin collapsing** is the behavior where vertical margins between elements merge into a single margin, rather than stacking. Three cases:

1. **Adjacent siblings.** The bottom margin of one element and the top margin of the next sibling collapse to the larger of the two values. Two paragraphs with `margin-bottom: 20px` and `margin-top: 30px` produce 30px of space between them, not 50px.

2. **Parent and first/last child.** A parent's top margin collapses with its first child's top margin, and its bottom margin collapses with its last child's last margin — if no border, padding, BFC (block formatting context), or clearance separates them.

3. **Empty block.** A block with no content, padding, border, or children has its own top and bottom margins collapse into a single margin.

Margin collapsing is vertical-only in normal flow. Horizontal margins never collapse. Margins inside a flex container, grid container, or table cell don't collapse either — the formatting context changes.

---

### Part 2: Interview Answer

The box model defines how much space an element occupies. Four layers, from inside out: content, padding, border, margin. Content holds the actual stuff — text, images, children. Padding is space inside the border, same background as the element. Border is the visible edge. Margin is space outside, pushing neighbors away, and it's the only layer that can be negative.

The part that trips people up is `box-sizing`. The default is `content-box` — `width` and `height` set the content area only. A `content-box` element with `width: 200px; padding: 20px; border: 2px solid` is 244px wide. Switch to `border-box` and the same element is exactly 200px — the content shrinks to make room for padding and border inside the declared width. That's why the universal `*, *::before, *::after { box-sizing: border-box; }` reset exists — it makes width and height mean what most developers expect. The more robust version uses `inherit`: set `border-box` on `html`, then `box-sizing: inherit` on the universal selector, so children follow their parent's choice instead of a global override.

Margin collapsing is the other major gotcha. Vertical margins between adjacent siblings merge to the larger value — not the sum. Two elements with 20px and 30px margins produce 30px between them, not 50px. A parent's margin collapses with its first or last child's margin if no border, padding, or block formatting context separates them. And a completely empty block — no content, no padding, no border, no children — collapses its own top and bottom margins into one.

The key constraint: margin collapsing is vertical-only in normal flow. Horizontal margins never collapse. And they don't collapse inside flex containers, grid containers, or table cells — those create new formatting contexts that prevent it.

---

### Part 3: Whiteboard / Live Coding

**Box-sizing arithmetic — the exact calculation:**

```css
/* content-box (default) */
.box-content {
  box-sizing: content-box;
  width: 200px;
  padding: 20px;
  border: 2px solid black;
}
/* Rendered width: 200 + (20 * 2) + (2 * 2) = 244px */
/* Content area: 200px */

/* border-box */
.box-border {
  box-sizing: border-box;
  width: 200px;
  padding: 20px;
  border: 2px solid black;
}
/* Rendered width: 200px */
/* Content area: 200 - (20 * 2) - (2 * 2) = 156px */
```

<!-- ILLUSTRATIVE: The content-box element renders wider than its declared
width because padding and border are added outside. The border-box element
renders at exactly its declared width — the content area shrinks to fit.
Verify in browser DevTools: the Computed panel shows the actual rendered
dimensions. -->

**Universal box-sizing reset:**

```css
/* Simple form */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* Robust form with inherit */
html {
  box-sizing: border-box;
}

*,
*::before,
*::after {
  box-sizing: inherit;
}
```

<!-- ILLUSTRATIVE: The inherit version lets a component opt out by setting
box-sizing: content-box on a parent — all descendants inherit content-box
instead of border-box. The simple form applies border-box globally with
no override path. -->

**Margin collapsing — adjacent siblings:**

```css
.paragraph-a {
  margin-bottom: 20px;
}

.paragraph-b {
  margin-top: 30px;
}
/* Space between: 30px (not 50px) — the larger of the two collapses */
```

**Margin collapsing — parent and first child:**

```css
.parent {
  margin-top: 10px;
  padding: 0; /* no padding — collapsing is NOT prevented */
}

.parent .first-child {
  margin-top: 25px;
}
/* Space above the parent-content boundary: 25px (not 35px) */
```

<!-- ILLUSTRATIVE: Parent-child collapsing is prevented by any of:
border (non-transparent), padding, BFC creation (overflow: hidden,
display: flow-root, etc.), or clearance. Without those, the margins
collapse through the parent's boundary. -->

**Margin collapsing — empty block:**

```css
.empty-box {
  margin-top: 15px;
  margin-bottom: 30px;
  /* no content, no padding, no border, no children */
}
/* Rendered margin: 30px (the larger of the two) */
```

---

### Part 4: Follow-Up Questions

**Q: Why does `inherit` matter in the box-sizing reset? Can't I just use the simple form?**

The simple form works until a third-party component or a component library declares `box-sizing: content-box` on one of its elements. With the simple `*` selector, that declaration loses the specificity fight — `*` has (0, 0, 0) specificity, so any component-level rule wins. The `inherit` version solves this differently: `html` sets `border-box`, and children inherit it. If a component sets `box-sizing: content-box` on its own root, its children inherit from that root — the component gets `content-box`, the rest of the page stays `border-box`. It gives you global default with local opt-out.

**Q: Can margins collapse horizontally?**

No. Horizontal margins never collapse in normal flow — they add. A `margin-left: 20px` on one element and `margin-right: 30px` on its neighbor produce 50px of horizontal space. Collapsing is exclusively a vertical phenomenon in block layout. This is why flexbox and grid layouts don't have margin collapsing — they use different formatting contexts that always add margins.

**Q: How do I prevent margin collapsing?**

Four things prevent it: a non-transparent border, padding, creating a block formatting context (BFC) with `overflow: hidden`, `display: flow-root`, or `display: flex`/`grid` on the parent, or clearance for floated elements. The most common production pattern is `display: flow-root` on a container — it creates a BFC without the side effects of `overflow: hidden` (which clips content).

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"The box model has content, padding, border, and margin. Width sets the content width. If you want width to include padding and border, use `box-sizing: border-box`. Margins add up — if two elements have 20px margins, you get 40px between them."

**Why this misses the point:** The junior answer doesn't know margin collapsing — it says margins "add up," which is wrong for vertical margins in normal flow. It doesn't know the exact arithmetic (content-box is 244px, border-box is 200px for the same declarations), and it doesn't know the three collapsing cases or when collapsing doesn't apply. A senior engineer can calculate the rendered size of any element from its CSS declarations and name the exact conditions where margins collapse.

**Senior answer:**
"The box model has four layers: content, padding, border, margin. `box-sizing` determines what `width` and `height` mean — `content-box` sets only the content area, so padding and border are added on top; `border-box` includes everything, so a `width: 200px; padding: 20px; border: 2px` element is exactly 200px. I use the universal `border-box` reset with `inherit` so components can opt out. Margin collapsing is vertical-only — adjacent siblings collapse to the larger value, parent-child collapses if no border, padding, or BFC separates them, and empty blocks collapse their own top and bottom margins. It doesn't happen in flex or grid containers, and it never happens horizontally."

**The tell:** The junior answer says margins "add up" without knowing collapsing. The senior answer names all three collapsing cases, the conditions that prevent them, and the exact arithmetic for both `box-sizing` modes.

---

### Part 6: Production Examples

A design team at a B2B SaaS company had a recurring layout bug: sidebars were 20px wider than their allocated space, breaking the grid on every page. The sidebar CSS declared `width: 250px; padding: 10px` — in `content-box`, that's 270px rendered width, but the layout assumed 250px. Engineers kept tweaking the `width` value to compensate, which broke when the padding changed. The fix was switching to `border-box` globally via the universal reset. After the change, `width: 250px; padding: 10px` rendered as exactly 250px — the content area shrank to 230px, and the sidebar fit its grid slot. The migration took twenty minutes and eliminated a class of layout bugs that had been filed monthly.

A different team hit a margin collapsing issue in their marketing pages. A `<section>` had `margin-top: 60px` for spacing from the hero, and its first child `<h2>` had `margin-top: 40px` for internal spacing. The actual space above the heading was 60px — the parent-child collapse, not 100px. Designers kept increasing the child's margin, which worked until the parent's margin also changed, then the spacing broke again. The fix was adding `padding-top: 1px` to the parent — a minimal BFC-creating intervention that stopped the collapse without visually affecting the layout. The real lesson: margin collapsing is invisible until someone measures the spacing and discovers the math doesn't add up.

---

## Topic 2 — Positioning Schemes

### Part 1: Theory

CSS has five positioning values: `static`, `relative`, `absolute`, `fixed`, and `sticky`. Each one determines how an element is placed in the layout and what coordinate system it uses.

**`static` (default).** The element sits in normal flow — block elements stack vertically, inline elements flow left to right. `top`, `right`, `bottom`, `left`, and `z-index` have no effect on static elements.

**`relative`.** The element stays in normal flow, but its visual position is offset by `top`, `right`, `bottom`, and `left`. The space it originally occupied remains — other elements don't reflow to fill the gap. A `position: relative` element also establishes a containing block for its `absolute`-positioned descendants.

**`absolute`.** The element is removed from normal flow entirely. It's positioned relative to its nearest non-`static` ancestor — its containing block. If no positioned ancestor exists, it's positioned relative to the initial containing block (the viewport). `absolute` elements don't affect the layout of surrounding elements and vice versa.

**`fixed`.** The element is removed from normal flow and positioned relative to the viewport — it stays in the same screen position when the page scrolls. There's a critical exception: if any ancestor has `transform`, `filter`, `perspective`, or `will-change: transform` applied, `fixed` elements behave like `absolute` elements relative to that ancestor instead of the viewport. This is because those properties create a new containing block, and `fixed` positioning respects containing blocks.

**`sticky`.** The element acts as `relative` until its scroll position reaches a defined threshold (set by `top`, `right`, `bottom`, or `left`), then it acts as `fixed` — but only within its nearest scrollable ancestor's bounds. Two common gotchas: first, a sticky element only sticks inside its parent — when the parent scrolls out of view, the sticky element goes with it, because it can't escape its parent's box. Second, `overflow: hidden` or `overflow: auto` on an ancestor breaks sticky positioning, because it changes which element is the "scrollable ancestor."

**Containing block vs. stacking context.** These are distinct concepts that candidates often conflate. A containing block is the reference box for `top`, `right`, `bottom`, `left`, and percentage-based sizes. For `absolute` descendants, it's the nearest non-`static` ancestor. For `fixed` descendants, it's the viewport — unless an ancestor creates a new containing block via `transform`, `filter`, etc. A stacking context is a three-dimensional layer for rendering order — it determines how `z-index` values compete. A stacking context is created by `position: relative/absolute/fixed/sticky` with a non-auto `z-index`, but also by `opacity < 1`, `transform`, `filter`, `will-change`, and other properties. A positioned element can be a containing block without being a stacking context, and vice versa.

---

### Part 2: Interview Answer

CSS has five position values, and each one changes how an element is placed and what coordinate system it uses.

`static` is the default — the element sits in normal flow and `top`, `right`, `bottom`, `left`, and `z-index` do nothing.

`relative` keeps the element in normal flow but offsets its visual position. The key detail: the original space is preserved. Other elements don't reflow. `relative` is mostly used to establish a positioning context for `absolute` children, not for visual offsets in production.

`absolute` pulls the element out of normal flow entirely. It's positioned relative to its nearest positioned ancestor — the closest ancestor with `position` other than `static`. If nothing is positioned, it uses the viewport. Absolute elements are invisible to the layout — siblings don't know they exist.

`fixed` also pulls the element out of flow, but positions it relative to the viewport. It stays pinned when you scroll. The gotcha: if any ancestor has `transform`, `filter`, `perspective`, or `will-change: transform`, fixed behaves like absolute relative to that ancestor. This is a real production bug — a modal with a `filter: drop-shadow(0 0 4px rgba(0,0,0,0.2))` on its container suddenly makes the modal scroll with the page instead of staying pinned.

`sticky` is genuinely different from the other four. It acts as relative until you scroll past a threshold, then it sticks like fixed — but only within its parent's bounds. When the parent scrolls off screen, the sticky element goes with it. The other gotcha: `overflow: hidden` or `overflow: auto` on an ancestor breaks sticky because it redefines the scrollable ancestor. Both of these are real bugs that teams discover in production and spend hours debugging.

The distinction that trips most candidates: a containing block determines where positioned elements are placed, while a stacking context determines how `z-index` values compete. They're different concepts with different creation rules, and a positioned element can serve one role without serving the other.

---

### Part 3: Whiteboard / Live Coding

**All five position values — side by side:**

```css
/* static — default, no effect */
.static {
  position: static;
  top: 10px; /* ignored */
}

/* relative — offset from normal flow position */
.relative {
  position: relative;
  top: 10px; /* moves 10px down from where it would be */
  left: 20px; /* moves 20px right */
  /* original space is preserved */
}

/* absolute — removed from flow, positioned relative to nearest positioned ancestor */
.absolute {
  position: absolute;
  top: 0;
  right: 0;
  /* positioned relative to nearest non-static ancestor */
  /* if no positioned ancestor: relative to the viewport */
}

/* fixed — removed from flow, positioned relative to viewport */
.fixed {
  position: fixed;
  top: 20px;
  right: 20px;
  /* stays pinned when scrolling */
  /* UNLESS an ancestor has transform/filter/perspective/will-change */
}

/* sticky — relative until threshold, then fixed within parent */
.sticky {
  position: sticky;
  top: 0;
  /* sticks to top of scroll container when scrolled past */
  /* goes with parent when parent scrolls out of view */
}
```

<!-- ILLUSTRATIVE: The sticky element's behavior depends on its parent's
dimensions and the scroll container's bounds. Verify in browser DevTools
by scrolling the page and observing the element's position. -->

**Containing block vs. stacking context — distinct concepts:**

```css
/* This creates a containing block for absolute children, but NOT a stacking context */
.parent {
  position: relative;
  /* no z-index — not a stacking context */
}

/* This creates BOTH a containing block AND a stacking context */
.parent-with-z {
  position: relative;
  z-index: 1; /* non-auto z-index + positioned = stacking context */
}

/* These also create stacking contexts (without being positioning contexts) */
.opacity-context {
  opacity: 0.9; /* opacity < 1 creates a stacking context */
}

.transform-context {
  transform: translateX(10px); /* transform creates a stacking context */
}

.filter-context {
  filter: blur(2px); /* filter creates a stacking context */
}
```

<!-- ILLUSTRATIVE: A z-index on a child inside .parent competes with the
entire page's z-axis. A z-index on a child inside .parent-with-z only
competes with siblings in the same stacking context. Verify by inspecting
the Layers panel in browser DevTools. -->

**Sticky gotcha — parent bounds:**

```css
/* The sticky header only sticks within its parent section */
header {
  position: sticky;
  top: 0;
}

section {
  /* When this section scrolls past the viewport top, the header goes with it */
  /* The header cannot escape the section's box */
}
```

**Sticky gotcha — overflow ancestor breaks it:**

```css
/* BROKEN: overflow: hidden on ancestor defeats sticky */
.ancestor {
  overflow: hidden; /* this creates a new scroll container */
}

.ancestor .sticky-element {
  position: sticky;
  top: 0;
  /* This will NOT stick — the scrollable ancestor is now .ancestor,
     not the viewport, and .ancestor doesn't scroll */
}
```

---

### Part 4: Follow-Up Questions

**Q: When would you use `position: relative` in production?**

Almost never for visual offsets. The main use case is establishing a positioning context — setting `position: relative` on a container so an `absolute`-positioned child anchors to it instead of the viewport. Tooltips, dropdowns, and popovers use this pattern: the trigger element gets `position: relative`, and the dropdown gets `position: absolute` with `top: 100%` to sit below the trigger. Using `relative` for visual nudges ("let me move this 5px to the right") is a code smell — it means the layout should handle the spacing, not a positional offset.

**Q: How do you fix a sticky element that isn't sticking?**

Two things to check. First, does any ancestor have `overflow: hidden`, `overflow: auto`, or `overflow: scroll`? Those create scroll containers that break sticky positioning. Remove the overflow or restructure the DOM. Second, does the sticky element have a defined threshold? `position: sticky` without `top`, `right`, `bottom`, or `left` does nothing — the element needs a threshold to know when to "stick." The most common production fix is removing an `overflow: hidden` that was added for a different purpose (clearing floats, containing a background) and replacing it with `overflow: clip` — which doesn't create a scroll container.

**Q: What creates a stacking context besides `position` + `z-index`?**

Several properties: `opacity` less than 1, `transform`, `filter`, `will-change`, `isolation: isolate`, and `mix-blend-mode`. The practical impact: when you apply `opacity: 0.99` to a container to animate opacity, you've also created a new stacking context for all its children. That child `z-index: 9999` inside the container doesn't compete with elements outside it — it only competes with siblings in the same stacking context. This is the #1 cause of "z-index isn't working" bugs in production.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"`position: relative` moves an element from its normal position. `absolute` removes it from flow and positions it relative to the viewport. `fixed` is like absolute but stays in place when you scroll. `sticky` is a mix of relative and fixed. Use `z-index` to control stacking."

**Why this misses the point:** The junior answer says `absolute` is positioned relative to the viewport — wrong, it's relative to the nearest positioned ancestor. It doesn't mention the `fixed` exception (transforms creating a containing block), doesn't mention sticky's two gotchas (parent bounds, overflow breaking it), and treats `z-index` as a universal stacking tool without knowing that stacking contexts are also created by `opacity`, `transform`, `filter`, and `will-change`. The junior answer doesn't know the difference between a containing block and a stacking context.

**Senior answer:**
"`static` is default — no positioning. `relative` stays in flow but offsets visually; I use it mainly to establish a positioning context for absolute children. `absolute` pulls the element out of flow and positions it relative to the nearest non-static ancestor, or the viewport if nothing is positioned. `fixed` pulls it out of flow and pins it to the viewport — but transforms, filters, or `will-change` on an ancestor create a new containing block, making fixed behave like absolute. `sticky` acts as relative until a scroll threshold, then sticks like fixed within its parent's bounds — but `overflow: hidden` on an ancestor breaks it. The containing block is where positioned elements anchor; the stacking context is where `z-index` values compete. They're different concepts with different creation rules, and most z-index bugs come from not knowing which properties create stacking contexts."

**The tell:** The junior answer says absolute positions to the viewport and doesn't know the fixed/transform exception or the sticky gotchas. The senior answer names both sticky gotchas, the fixed exception, and distinguishes containing blocks from stacking contexts.

---

### Part 6: Production Examples

A team building a marketing site had a fixed cookie-consent banner that stopped working after a designer added a frosted-glass effect to the page hero. The banner used `position: fixed; bottom: 0; left: 0; right: 0` and stayed pinned to the bottom of the viewport during scrolling — until `filter: blur(12px) saturate(180%)` was added to the hero wrapper for the glass effect. After that, the banner scrolled with the page instead of staying pinned.

The mechanism: per the CSS Positioned Layout spec, an ancestor with a non-`none` `filter` property creates a new containing block for fixed-positioned descendants. The banner's `position: fixed` was now relative to the hero wrapper (its new containing block), not the viewport — and since the hero wrapper scrolls, the banner scrolled with it.

The fix was moving the hero's filter to a pseudo-element instead of the wrapper itself. The `::after` pseudo-element got `filter: blur(12px) saturate(180%)` and was positioned absolutely to cover the hero area, keeping the visual effect while leaving the wrapper filter-free. Fixed elements below the hero continued to position relative to the viewport as expected.

The same rule applies to `transform`, `perspective`, and `will-change: transform` on ancestors — any of them creates a new containing block, and `position: fixed` becomes relative to that ancestor instead of the viewport. When a fixed element stops sticking, checking ancestors for these properties is the first debugging step.

A different team had a z-index war in their modal system. A tooltip inside a modal was supposed to appear above the modal overlay, but no `z-index` value worked — they tried 9999, 99999, even 2147483647. The problem: the modal container had `opacity: 0.99` (used for a CSS transition), which created a new stacking context. The tooltip's `z-index` only competed with siblings inside the modal's stacking context, not with the overlay outside it. The fix was removing the `opacity` hack and using `visibility` and `transition` for the same animation effect without creating a stacking context. The lesson: when `z-index` isn't working, check which stacking contexts exist — the Layers panel in DevTools shows the full hierarchy.

---

## Tie the Chain Together

The box model defines how much space an element occupies: content area plus padding plus border is the element's box; margin is the space it demands from its neighbors. The `box-sizing` mode determines what `width` and `height` mean — `content-box` sets the content area, `border-box` includes everything. Margin collapsing determines how vertical margins between elements resolve in normal flow.

Positioning defines where that box goes. In normal flow, block elements stack vertically and inline elements flow horizontally. `Relative` offsets from normal flow without removing the element. `Absolute` removes the element and positions it relative to a containing block. `Fixed` removes the element and pins it to the viewport — unless an ancestor creates a new containing block. `Sticky` hybridizes relative and fixed behavior within scroll bounds.

Session 17 continues with Flexbox and Grid, which replace normal flow's block and inline stacking model with explicit two-dimensional layout control. The box model and positioning schemes covered here are the foundation — Flexbox and Grid create their own formatting contexts where margin collapsing doesn't apply and positioning works differently.

---

## Cross-References

- Session 15 (`book/03-css-mastery/15-cascade-specificity-inheritance.md`) — cascade rules, specificity, and the five cascade-wide keywords that govern how box model and positioning values are resolved.
- Session 17 (`book/03-css-mastery/17-flexbox-grid-when-to-use-which.md`) — Flexbox and Grid layout, which create new formatting contexts where margin collapsing doesn't apply.
