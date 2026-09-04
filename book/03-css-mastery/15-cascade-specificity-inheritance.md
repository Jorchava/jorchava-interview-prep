# Session 15 — Cascade, Specificity, and Inheritance

> **Module 3 — CSS Mastery.** Session 1 of 7.
> **Chain:** Cascade algorithm → specificity calculation → inheritance keywords.
> Session 16 continues with box model and positioning — the rules this
> session establishes govern how those styles are resolved.

<!-- Module 3 convention: CSS cascade, specificity, and rendering behavior is
observable in DevTools but not in a Node/jsdom unit-testing environment.
All CSS examples in this module are ILLUSTRATIVE — syntactically valid,
mentally traced, but not run against a browser harness in-session.
This convention applies to Sessions 15-21. -->

---

## Topic 1 — The Cascade

### Part 1: Theory

The cascade is the algorithm browsers use to decide which CSS declaration wins when multiple rules target the same element. It's not a single comparison — it's a priority chain, and you need to know the exact order.

**Priority 1: Origin and importance.** There are three origins — user-agent (browser defaults), user (reader stylesheets), and author (your stylesheets). By normal precedence, author beats user beats user-agent. When `!important` is declared, the order reverses — user-agent-important beats user-important beats author-important. The rationale: `!important` is meant to let readers override author styles for accessibility (large text, high contrast), and browser defaults are the last resort.

**Priority 2: Cascade layers.** Introduced in 2022, `@layer` lets you name and order groups of styles. Rules in a later layer beat rules in an earlier layer regardless of specificity. Unlayered styles beat all layered styles, also regardless of specificity — the assumption being that unlayered code is either a reset or a deliberate override. Inside layers, `!important` reverses the order again: `!important` in an earlier layer beats `!important` in a later layer, because `!important` is meant to be an escape hatch, and the original layer order should be honored in reverse when the escape hatch is pulled.

**Priority 3: Specificity.** When two rules are in the same layer (or both unlayered) and have the same importance, specificity breaks the tie. Specificity is a three-part comparison (A, B, C) — covered in Topic 2.

**Priority 4: Source order.** When everything else is equal — same origin, same importance, same layer, same specificity — the last rule in source order wins.

The mistake junior engineers make is thinking specificity is the first or only tiebreaker. It's actually the third. Origin and importance always come first, and `@layer` now sits between them.

---

### Part 2: Interview Answer

The cascade is the process a browser uses when multiple CSS rules target the same element and conflict — it decides which declaration actually applies. There are four priority levels, and they're evaluated in a strict order that most developers get wrong.

First is origin and importance. There are three origins: user-agent (the browser's defaults), user (reader stylesheets), and author (your stylesheets). Normal precedence goes author over user over user-agent. But when you add `!important`, that order flips — user-agent-important beats user-important beats author-important. The design reason is accessibility: readers should be able to force their own styles over yours, and browser defaults are the ultimate fallback.

Second is cascade layers, introduced in 2022 with `@layer`. When you declare layers, a later layer wins over an earlier one regardless of specificity. Unlayered styles beat all layered styles, also regardless of specificity. This is the big shift — before `@layer`, controlling cascade order meant specificity hacks or `!important` abuse. And inside layers, `!important` reverses the order again: an `!important` in an earlier layer beats an `!important` in a later layer, because the escape hatch should honor the original layer priority in reverse.

Third is specificity, which is a three-part comparison — IDs, classes, and elements in that order. I'll cover the calculation in detail in a moment, but the key point is that specificity only breaks ties within the same origin, importance, and layer.

Fourth is source order. When everything else is equal, the last rule wins. That's it — four steps, in order. Most people stop at specificity and source order, but origin and layers come first.

---

### Part 3: Whiteboard / Live Coding

Demonstrate that `@layer` can override specificity without hacks:

```css
/* Declare layer order — overrides comes after base, so overrides wins */
@layer base, overrides;

/* Earlier layer: high specificity */
@layer base {
  #sidebar .widget h2.title {
    color: red; /* (1, 2, 1) — high specificity, but in an earlier layer */
  }
}

/* Later layer: low specificity — WINS because layer order beats specificity */
@layer overrides {
  h2 {
    color: blue; /* (0, 0, 1) — lower specificity, but later layer wins */
  }
}
```

<!-- ILLUSTRATIVE: @layer overrides wins because it's declared later than
@layer base, regardless of specificity. The (0,0,1) selector in overrides
beats the (1,2,1) selector in base because cascade layers resolve before
specificity in the cascade algorithm. The @layer base, overrides;
declaration order establishes that overrides > base. Verify in browser
DevTools — the Styles panel shows which rule wins and which is crossed out. -->

```css
/* Unlayered styles beat ALL layered styles — regardless of specificity */
@layer components {
  #sidebar .widget h2.title {
    color: red; /* (1, 2, 1) — high specificity, but inside a layer */
  }
}

/* Unlayered: low specificity, but WINS because unlayered beats layered */
h2 {
  color: blue; /* (0, 0, 1) — lower specificity, but unlayered */
}
```

<!-- ILLUSTRATIVE: The unlayered h2 rule wins over the high-specificity
layered rule in @layer components, because unlayered styles are treated
as belonging to a final anonymous layer that comes after all declared
layers. This is why putting third-party styles in a @layer and keeping
your own styles unlayered is a common pattern — your styles always win. -->

The rules at play:

```
Priority order:
1. Origin + importance
2. @layer (later wins; unlayered beats all)
3. Specificity
4. Source order
```

Now show the `!important` reversal inside layers:

```css
@layer base {
  button {
    background: gray;        /* normal */
    background: green !important;  /* earlier layer !important */
  }
}

@layer overrides {
  button {
    background: blue;             /* normal — wins over base normal */
    background: red !important;   /* LOSES — earlier layer !important wins */
  }
}
```

<!-- ILLUSTRATIVE: In normal mode, overrides.base (later layer) wins. In
!important mode, base's !important wins because the order reverses inside
layers when !important is involved. -->

Key takeaway: `@layer` gives you explicit cascade control without specificity wars. You declare a layer order once, and every rule in a later layer automatically wins — no need to inflate selectors or reach for `!important`.

---

### Part 4: Follow-Up Questions

**Q: When would you actually use `@layer` in a production codebase?**

Three common scenarios. First, third-party CSS: you put vendor styles (a component library, a date picker) in a lower layer so your overrides always win without specificity battles. Second, design system scales: base tokens in a `tokens` layer, component styles in a `components` layer, page-specific overrides in an `overrides` layer — the order is declared once and every rule automatically sits in the right priority tier. Third, CSS resets: `reset.css` or `normalize.css` goes in a `reset` layer, and since unlayered styles beat layered styles, your main stylesheet doesn't need any specificity boost to override the reset.

**Q: What happens if I mix `@layer` with inline styles?**

Inline styles have higher specificity than any selector, but origin and importance still come first. An inline style without `!important` beats any layered or unlayered rule at the specificity level. But an `!important` in a user-agent stylesheet still beats an author inline style without `!important`, because importance and origin override specificity entirely.

**Q: Can I nest layers?**

Yes. `@layer base { @layer tokens { ... } }` creates a nested layer. The outer layer order still governs priority, and the inner layers are resolved within their parent. This is useful for organizing a large codebase without flattening everything into a single layer list.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"The cascade is specificity — IDs beat classes, classes beat elements. If you need to override something, use a more specific selector or add `!important`."

**Why this misses the point:** It skips origin and importance (the first priority), ignores cascade layers entirely (the 2022 addition that changed how senior engineers structure CSS), and treats `!important` as a tool rather than a last resort. The junior mental model is specificity all the way down — but specificity is only the third tiebreaker.

**Senior answer:**
"The cascade has four priority levels: origin and importance first, then `@layer` ordering, then specificity, then source order. In practice, that means I structure CSS into named layers — reset, tokens, components, overrides — and let the layer order handle priority. Specificity stays low throughout because the layer order already does the work. I reach for `!important` maybe once or twice a year, and when I do, I know it reverses within layers."

**The tell:** The senior answer names `@layer` as the primary tool for cascade control. The junior answer doesn't know it exists.

---

### Part 6: Production Examples

A design system team at a mid-size SaaS company had three CSS sources colliding: their own component styles, a third-party UI library (styled with high-specificity selectors like `.ant-btn-primary`), and per-page overrides. The cascade was a mess — engineers were writing `!important` overrides to beat the library, then more `!important` to beat those, and specificity was climbing with every sprint.

The fix was `@layer`. They put the third-party library in a `vendor` layer, their design system in a `system` layer, and page overrides in an `overrides` layer. The layer order was declared once in the HTML: `@layer vendor, system, overrides;` — and suddenly every override automatically won without specificity inflation. The `!important` count dropped from dozens per file to zero. When a library update changed some selectors, nothing broke because the layer order governed priority, not the selectors themselves.

The lesson: `@layer` is not a niche feature for CSS academics. It's the practical solution to the cascade wars that every large codebase eventually hits. Before `@layer`, the answer was "be more specific" or "use `!important`" — both of which scale badly. After `@layer`, the answer is "declare your layer order once and let the cascade do the work."

---

## Topic 2 — Specificity

### Part 1: Theory

Specificity is the tiebreaker the cascade uses when two rules share the same origin, importance, and layer. It's calculated as a three-part comparison: (A, B, C) where A counts ID selectors, B counts class selectors, attribute selectors, and pseudo-classes, and C counts type selectors, element names, and pseudo-elements.

The comparison is lexicographic, not arithmetic. A wins over any B or C value. B wins over any C value regardless of C's magnitude. This is the critical distinction, and it's where the common "three-digit number" mental model breaks.

**The breaking case:** Consider a selector with eleven element selectors versus a selector with one class. The eleven-element selector has specificity (0, 0, 11). The one-class selector has specificity (0, 1, 0). If you treat these as three-digit numbers, (0, 0, 11) looks bigger than (0, 1, 0). But in lexicographic comparison, (0, 1, 0) wins because B (1) beats C (11). The three-digit model works until a column exceeds 9 — then it gives the wrong answer. Use the (A, B, C) tuple and lexicographic comparison, not a single number.

**Universal selector and combinators:** `*` has specificity (0, 0, 0). Combinators (`>`, `+`, `~`, `||`) have no specificity at all — they don't contribute to any column.

**Modern pseudo-class specificity:** `:not()`, `:is()`, and `:has()` take the specificity of their most specific argument. So `:is(#id, .class)` has specificity (1, 0, 0) — the ID inside `:is()` contributes fully. But `:where()` has specificity (0, 0, 0) regardless of what's inside it. That's the practical distinction: `:where()` is the tool for zero-specificity selectors (resets, utility layers), while `:is()` and `:has()` participate in specificity normally.

**Examples of (A, B, C):**
- `h1` → (0, 0, 1)
- `.title` → (0, 1, 0)
- `#main .title h1` → (1, 1, 1)
- `[data-type="heading"]` → (0, 1, 0)
- `:nth-child(2n)` → (0, 1, 0)
- `#sidebar :has(h2.title)` → (1, 1, 1) — `#sidebar` contributes (1, 0, 0), and `:has(h2.title)` takes the specificity of its most specific argument, `h2.title` = (0, 1, 1). Total: (1, 1, 1).

---

### Part 2: Interview Answer

Specificity is how the cascade breaks ties when two rules share the same origin, importance, and layer. It's a three-part comparison — (A, B, C) — where A counts IDs, B counts classes and attributes and pseudo-classes, and C counts elements and pseudo-elements. The comparison is lexicographic: A always beats B, B always beats C, regardless of the values. That's the part most people get wrong.

Here's the concrete example that trips people up. You have a selector with eleven type selectors — something like `div div div div div div div div div div div` — and it has specificity (0, 0, 11). You also have a single class selector, `.widget`, with specificity (0, 1, 0). If you treat specificity as a three-digit number, 0-0-11 looks bigger than 0-1-0. But in lexicographic comparison, (0, 1, 0) wins because the B column is checked before the C column. Eleven elements never add up to one class.

The universal selector `*` and combinators like `>` or `~` contribute zero specificity — they don't count in any column. And modern pseudo-classes have specific rules: `:not()`, `:is()`, and `:has()` take the specificity of their most specific argument. So `:is(.a, .b, .c)` has specificity (0, 1, 0), while `:is(#id, .class)` has specificity (1, 0, 0) — the ID inside `:is()` contributes fully. But `:where()` always contributes (0, 0, 0), no matter what's inside it. That's the practical distinction: use `:where()` when you want a selector to never win a specificity fight — reset stylesheets, utility layers, anything that should always yield to more specific rules.

---

### Part 3: Whiteboard / Live Coding

Specificity comparison table — five selector types at minimum:

| Selector | A (IDs) | B (classes/attrs/pseudo-classes) | C (elements/pseudo-elements) | Specificity |
|---|---|---|---|---|
| `h1` | 0 | 0 | 1 | (0, 0, 1) |
| `.title` | 0 | 1 | 0 | (0, 1, 0) |
| `#main .title h2` | 1 | 1 | 1 | (1, 1, 1) |
| `[data-role="header"]` | 0 | 1 | 0 | (0, 1, 0) |
| `#sidebar :has(h2.title)` | 1 | 1 | 1 | (1, 1, 1) |
| `:where(.reset) h1` | 0 | 0 | 1 | (0, 0, 1) — `:where()` contributes 0 |
| `div#main` | 1 | 0 | 1 | (1, 0, 1) |

<!-- ILLUSTRATIVE: These specificity values follow the CSS Selectors Level 4
spec. :where() is always (0,0,0) regardless of arguments. :is() and :has()
take the specificity of their most specific argument. Verify against
https://drafts.csswg.org/selectors-4/ if a claim seems surprising. -->

**Worked example — the column-exceeds-9 case:**

```css
/* Specificity: (0, 0, 11) */
div > div > div > div > div > div > div > div > div > div > div {
  color: red;
}

/* Specificity: (0, 1, 0) — WINS */
.widget {
  color: blue;
}
```

<!-- ILLUSTRATIVE: The class selector wins because B (1) > C (11) in
lexicographic comparison. A "three-digit number" model would incorrectly
predict the eleven-element selector wins. -->

The universal selector:

```css
/* Specificity: (0, 0, 0) */
* {
  margin: 0;
  padding: 0;
}
```

Combinators contribute nothing:

```css
/* Specificity: (0, 1, 1) — the > and + don't count */
div > .title + p {
  line-height: 1.4;
}
```

---

### Part 4: Follow-Up Questions

**Q: Why does `:where()` exist if `:not()` already handles negation?**

`:not()` takes the specificity of its most specific argument, so `:not(#id)` has specificity (1, 0, 0) — it contributes the ID. That's problematic for reset stylesheets where you want every rule to have zero specificity so author styles always win. `:where(#id)` has specificity (0, 0, 0) regardless of what's inside it. So you write `:where(#sidebar) .widget` and it behaves as if `.widget` alone — the `:where()` wrapper makes the ID invisible to specificity. This is the tool for building utility layers and resets that never fight with your actual styles.

**Q: Can I use `@layer` and `:where()` together?**

Yes, and they solve complementary problems. `:where()` eliminates specificity within a layer; `@layer` eliminates specificity across layers. In practice, you often see both: `:where()` inside a reset layer to keep every reset rule at zero specificity, and `@layer` to order the reset below your component styles. They don't conflict — they reinforce each other.

**Q: What about `!important` and specificity — does `!important` bypass specificity?**

`!important` doesn't bypass specificity — it creates a parallel specificity hierarchy. Normal declarations and `!important` declarations are compared separately. Within the `!important` group, specificity still applies, and that's where things get weird: an `!important` rule with lower specificity can still lose to an `!important` rule with higher specificity, even though both have `!important`. The full order is: normal author < normal user < normal user-agent < important user-agent < important user < important author — and specificity is the tiebreaker within each tier.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Specificity is a three-digit number — IDs are 100, classes are 10, elements are 1. So `#sidebar` always beats `.widget`."

**Why this breaks:** It works until a column exceeds 9. Eleven element selectors give you "0011" in this model, which looks like it should beat "010" (a class). But CSS specificity is lexicographic, not arithmetic. (0, 1, 0) always beats (0, 0, 11). And this model doesn't account for `:where()` (zero specificity regardless of content) or `:is()`/`:has()` (most-specific-argument rule). A senior engineer who uses the "three-digit number" model will be surprised when `.a.b.c.d.e.f.g.h.i.j.k` beats `#id` — and that surprise means they don't actually understand the algorithm.

**Senior answer:**
"Specificity is (A, B, C) — IDs, then classes and attributes, then elements. Lexicographic comparison: A wins over any B or C, B wins over any C. The universal selector and combinators contribute zero. Modern pseudo-classes have special rules: `:not()`, `:is()`, and `:has()` take the specificity of their most specific argument, but `:where()` always contributes (0, 0, 0). I use `:where()` deliberately in resets and utility layers so they never accumulate specificity."

**The tell:** The senior answer names the column-exceeds-9 breaking case and uses `:where()` as a specificity-management tool. The junior answer uses a shortcut model that breaks in edge cases.

---

### Part 6: Production Examples

A component library team had a CSS architecture where every component's styles were written as `.ComponentName-property`, giving every rule (0, 2, 0) specificity. Their reset stylesheet used element selectors (0, 0, 1) — and the reset always lost, even when it shouldn't. Engineers started adding `!important` to reset rules, which cascaded into specificity wars.

The fix had two parts. First, they wrapped the reset in `:where()` — `:where(html) { box-sizing: border-box; }` — so the reset had zero specificity and always yielded to component styles. Second, they used `@layer` to declare a clear priority order: `@layer reset, tokens, components, overrides;`. Now the reset sits in the lowest layer with zero specificity, component styles sit in a middle layer with moderate specificity, and page overrides sit in the highest layer and always win. No `!important` needed.

The specific incident that triggered the migration: a designer changed a button's hover state by adding a `.btn--active` class, but the library's own `.Button-root:hover` had higher specificity and won. The designer filed a bug saying the override "didn't work." Three engineers spent two days debugging the cascade before realizing the specificity math was working as designed — the library's selectors were just more specific. After the `@layer` migration, the same override worked immediately because the layer order handled priority.

---

## Topic 3 — Inheritance

### Part 1: Theory

Inheritance is how CSS values propagate down the DOM tree when no explicit rule applies. Some properties inherit naturally — text and typography properties mostly. Others don't — box model, positioning, background, and border properties mostly. Understanding which is which, and when to override that behavior, is the practical skill.

**Properties that inherit:** `font-family`, `font-size`, `line-height`, `color`, `visibility`, `cursor`, `text-align`, `letter-spacing`, `word-spacing`, `white-space`, `direction`, `text-transform`, `text-decoration`, `quotes`, `list-style`, `border-collapse`, `border-spacing`, `caption-side`, `empty-cells`. The pattern: text styling and visual presentation of content.

**Properties that don't inherit:** `width`, `height`, `margin`, `padding`, `border`, `background`, `display`, `position`, `float`, `overflow`, `z-index`, `opacity`, `transform`, `transition`, `animation`. The pattern: structural layout and box model.

The practical consequence: when you set `color: red` on a `<div>`, all its children inherit that color. But when you set `border: 1px solid black` on a `<div>`, its children don't get borders. If you want borders to propagate, you have to use `border-color: inherit` explicitly.

**The five cascade-wide keywords:**

1. `inherit` — forces the property to take the computed value from the parent, even for properties that don't inherit naturally. Use case: `border-color: inherit` pulls in the parent's text color, avoiding duplication.

2. `initial` — sets the property to the CSS-spec-defined initial value, regardless of what the browser's default stylesheet would do. Use case: `display: initial` on an element resets it to `inline` (the spec initial value), not `block` (the browser default for `<div>`).

3. `unset` — behaves as `inherit` for inherited properties and `initial` for non-inherited properties. Use case: `all: unset` strips every property back to either inherited or initial values, useful for a "clean slate" approach to component styling.

4. `revert` — restores the property to the browser's user-agent stylesheet value. Use case: `revert` on a `<button>` restores the browser's default button styling (borders, padding, background) without needing to know what those values are. Different from `initial` because the browser default may not match the spec initial value.

5. `revert-layer` — rolls back to the previous cascade layer's value for the property. Use case: in a `@layer overrides { button { all: revert-layer; } }` block, the button gets back whatever the previous layer defined, not the initial or inherited value. This is the keyword that makes `@layer` composable — you can undo one layer's changes without affecting the others.

---

### Part 2: Interview Answer

Inheritance is how CSS values propagate down the DOM tree when no rule explicitly targets an element. Text properties like `font-family`, `color`, `line-height`, and `visibility` inherit by default. Structural properties like `width`, `margin`, `border`, and `background` don't. That split matters because it determines what you need to explicitly set on child elements versus what they'll pick up from their parents.

There are five cascade-wide keywords that control this behavior, and most developers only know two of them.

`inherit` forces the property to take the parent's computed value, even for properties that don't inherit naturally. `border-color: inherit` is the classic example — it pulls in the parent's text color without duplicating the value.

`initial` sets the property to the CSS-spec-defined initial value, not the browser default. That distinction matters: `display: initial` gives you `inline` (the spec value), not `block` (the browser's default for `<div>`).

`unset` is a shortcut — it behaves as `inherit` for inherited properties and `initial` for non-inherited ones. `all: unset` strips everything back to either inherited or initial values.

`revert` restores the browser's user-agent stylesheet value. You don't need to know what the default button styling is — just write `revert` and the browser puts it back. This is different from `initial` because browser defaults often differ from spec initial values.

`revert-layer` rolls back to the previous cascade layer's value. This is the keyword that makes `@layer` composable — you can undo one layer's changes without affecting others. It's new to most developers, but it's essential for any codebase using cascade layers.

The senior-level pattern: reach for `revert` when un-styling elements for accessibility (restoring native controls), reach for `revert-layer` when composing cascade layers, and use `inherit` deliberately to extend inheritance to non-inheriting properties.

---

### Part 3: Whiteboard / Live Coding

Concrete use cases for each keyword:

```css
/* inherit: pull in parent's value */
.child {
  border-color: inherit;  /* gets parent's color, not black */
}

/* initial: reset to spec-defined default */
.error-banner {
  display: initial;  /* becomes inline, not block */
}

/* unset: inherit for inherited, initial for non-inherited */
.custom-element {
  all: unset;  /* clean slate — inherits what's inheritable, resets the rest */
}

/* revert: restore browser user-agent default */
button.styled {
  appearance: revert;  /* gets back native button appearance */
}

/* revert-layer: roll back to previous @layer value */
@layer reset {
  a { text-decoration: none; }
}

@layer overrides {
  a { text-decoration: underline; }
}

@layer undo {
  a { text-decoration: revert-layer;  /* back to underline from overrides */ }
}
```

<!-- ILLUSTRATIVE: These examples demonstrate the five cascade-wide keywords.
revert-layer requires @layer to be in use — without layers, it behaves like
revert. The all: unset example strips all inherited and non-inherited
properties. Verify behavior against browser DevTools for specific properties. -->

**Which properties inherit — quick reference:**

| Inherit | Don't inherit |
|---|---|
| `color` | `background` |
| `font-family` | `border` |
| `font-size` | `width`, `height` |
| `line-height` | `margin`, `padding` |
| `text-align` | `display` |
| `visibility` | `position` |
| `cursor` | `overflow` |
| `letter-spacing` | `z-index` |
| `white-space` | `opacity` |
| `direction` | `transform` |

The pattern: text and typography inherit. Layout and box model don't.

---

### Part 4: Follow-Up Questions

**Q: When would you use `all: unset` in practice?**

Component libraries use it to create a "clean slate" for custom elements. When you build a `<my-button>` web component, you want it to start from the browser's base styles for a generic inline element, not inherit whatever the host page has set on `<button>`. `all: unset` on the component's shadow root styles gives you that reset. The tradeoff is that you have to re-specify every property you actually want — it's a clean slate, not a free one.

**Q: What's the difference between `initial` and `revert`?**

`initial` follows the CSS spec's defined initial value for each property. `revert` follows the browser's user-agent stylesheet. These often differ: the spec initial value for `display` is `inline`, but the browser default for `<div>` is `block`. If you write `display: revert` on a `<div>`, you get `block` back. If you write `display: initial`, you get `inline`. `revert` is more useful for "un-styling" because it restores what the browser would normally do, not what the spec says the default should be.

**Q: Does `revert-layer` work outside of `@layer`?**

No. Outside of cascade layers, `revert-layer` behaves as `revert` — it falls back to the user-agent stylesheet value. The keyword is specifically designed for use within `@layer` blocks to undo a previous layer's contribution without affecting other layers.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Inheritance means child elements get parent styles. You can use `inherit` to force it, or `initial` to reset. For resets, use `all: initial` to start fresh."

**Why this misses the point:** It only names two of the five keywords, treats `initial` and `revert` as interchangeable (they're not), and doesn't acknowledge that `all: initial` gives you spec initial values, not browser defaults — which is almost never what you want for "starting fresh." The junior answer doesn't know `revert` exists, doesn't know `revert-layer` exists, and conflates `initial` with `revert`.

**Senior answer:**
"There are five keywords. `inherit` forces inheritance on non-inheriting properties — `border-color: inherit` is the classic use. `initial` resets to the CSS-spec default, which is different from the browser default. `unset` is a shortcut: `inherit` for inherited properties, `initial` for non-inherited. `revert` restores the user-agent stylesheet value — that's what you actually want when un-styling an element. And `revert-layer` rolls back to the previous cascade layer's value, which makes `@layer` composable. I reach for `revert` for accessibility work, `revert-layer` when composing layers, and `inherit` to avoid duplicating values."

**The tell:** The senior answer names all five keywords with concrete use cases. The junior answer names two and conflates `initial` with `revert`.

---

### Part 6: Production Examples

A team building a component library for a design system needed every component to work inside shadow DOM, inside regular DOM, and inside cascade layers — three different encapsulation contexts. The problem: `all: initial` on their base component class stripped browser defaults and gave them spec initial values (everything became `inline`, all margins collapsed to 0, all borders vanished). The components looked broken in every context except the one the author happened to be testing in.

The fix: they replaced `all: initial` with a carefully curated set of `revert` declarations on the properties they actually wanted to reset, plus `inherit` on properties that should propagate from the host context. `border-color: inherit` pulled in the design system's token color. `appearance: revert` restored native browser controls where needed. And inside their `@layer`-based architecture, `revert-layer` let them undo component-level overrides in specific contexts without affecting the rest of the cascade.

The specific incident: a form component inside a modal had its inputs reset by `all: initial`, which removed the browser's default `border-radius` and `padding` on `<input>`. The inputs looked like unstyled text fields. Two designers filed separate bugs about "broken inputs" before anyone traced it to the `all: initial` declaration. After switching to targeted `revert` and `inherit`, the components respected both the browser defaults and the design system tokens — and the `@layer` composition meant the form worked correctly whether it was in the modal, in a sidebar, or standalone.

---

## Tie the Chain Together

The cascade determines which rule wins when multiple rules target the same element. Origin and importance come first — author beats user beats user-agent, reversed for `!important`. Cascade layers come second — later layers beat earlier layers, unlayered beats all, `!important` reverses within layers. Specificity is the third tiebreaker — (A, B, C), lexicographic comparison. Source order is last — the last rule wins when everything else is equal.

Within a layer, specificity is your tool. Across layers, `@layer` is your tool — and it eliminates most of the specificity battles that used to plague CSS architecture. When no rule applies at all, inheritance determines how values propagate down the DOM tree, and the five cascade-wide keywords (`inherit`, `initial`, `unset`, `revert`, `revert-layer`) let you override inheritance when needed.

Session 16 continues with the box model and positioning schemes. The cascade rules established here — origin, importance, layers, specificity, source order — are the foundation those sessions build on. Every layout decision starts with "which rule wins," and now you know the answer.

---

## Cross-References

- Session 14 (`book/02-html-mastery/14-events-event-delegation-bubbling-capturing.md`) — event traversal through the composed DOM tree, which connects to how shadow DOM encapsulation affects style resolution.
- Session 16 (`book/03-css-mastery/16-box-model-positioning.md`) — the box model and positioning schemes, governed by the cascade rules established in this session.
