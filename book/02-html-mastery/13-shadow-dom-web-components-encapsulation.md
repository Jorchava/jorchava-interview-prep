# Shadow DOM, Web Components, and Encapsulation

> How the browser manages a second DOM tree alongside the main document tree, how that tree isolates a component's internals from the outside world, how light DOM children distribute into shadow slots while remaining accessible, and how Custom Elements wire all of this into the HTML parser's lifecycle. Session 12 (`02-html-mastery/12-browser-parsing-dom-construction.md`) established the main document DOM tree — the parser's construction from bytes. The Shadow DOM is a second tree the browser manages alongside that one. Session 9 (`02-html-mastery/09-semantic-html-accessibility-seo.md`) established the accessibility tree and implicit ARIA roles — this session extends that into shadow boundaries where slot content and the shadow host interact with the main document's accessibility tree in specific, non-obvious ways.

---

## 1. The Shadow DOM

### Part 1 — Theory

The Shadow DOM is a browser-managed tree of nodes that attaches to a single element in the main document DOM — the **shadow host**. When you call `element.attachShadow({ mode: 'open' })`, the browser creates a **shadow root** and associates it with that element. Everything inside the shadow root becomes the **shadow tree**. The shadow tree renders in place of the host element's regular children, but the host element itself stays in the main document tree.

This matters because the shadow tree gives a component ownership of its DOM and styles without polluting or being polluted by the outer document. Session 12 described how the HTML parser builds a single document tree from bytes. The Shadow DOM extends that model: the browser still builds the main document tree from the parser's output, but individual elements can have their own private subtree that the browser renders as if it were part of the main tree.

Two modes exist: **open** and **closed**. In open mode, the shadow root is accessible from outside the component via `element.shadowRoot`. In closed mode, `element.shadowRoot` returns `null` — the only reference to the shadow root is held inside the component's own code. The distinction is not a security boundary. DevTools can still inspect closed shadow trees. A reference to the shadow root can be leaked by storing it during construction. Closed mode prevents casual outside access, not determined inspection. A junior answer says "closed means more private." A senior answer says "closed means the reference isn't publicly exposed, but it's not a security boundary."

The **composed DOM** is the flattened tree the browser actually renders. When a shadow tree contains `<slot>` elements and the host has light DOM children, those children distribute into the slots. The browser composes the shadow tree and the distributed light DOM children into a single rendered output. This composed tree is what gets painted. Events also traverse the composed tree — a click on a slotted element propagates through the shadow tree's ancestors before reaching the main document tree.

### Part 2 — Interview Answer

The Shadow DOM is a browser-managed tree attached to a shadow host element. When you call `element.attachShadow()`, the browser creates a shadow root — the root of a private subtree that renders in place of the host's regular children. The host element stays in the main document tree, but its rendered children come from the shadow tree instead.

There are two modes: open and closed. Open mode means `element.shadowRoot` returns the shadow root from outside the component. Closed mode returns null — the only reference lives inside the component's own code. The important nuance is that closed mode is not a security boundary. DevTools can still inspect the shadow tree, and any code that held a reference to the shadow root during construction can still access it. Closed mode prevents casual outside access, not determined inspection. If someone tells you "closed mode makes it secure," that's the junior answer. The senior answer is that it prevents the public API from exposing the internals, which is useful for enforcing an interface contract, but it does not hide anything from anyone with access to DevTools.

The composed DOM is the flattened tree the browser renders — the shadow tree combined with any light DOM children distributed into slots. This composed tree is what gets painted on screen, and it's the tree that events traverse. When you click a slotted element inside a shadow DOM, the event fires on the slotted element, propagates up through the shadow tree's ancestors, and then crosses the shadow boundary into the main document tree. The browser manages this composition automatically — you don't manually merge trees, you just attach a shadow root and define the internal structure.

### Part 3 — Whiteboard / Live Coding

```html
<!-- ILLUSTRATIVE — shadow DOM behavior observable in browser DevTools -->
<div id="host">
  <span>Light DOM child</span>
</div>

<script>
  const host = document.getElementById('host');

  // Open mode: shadowRoot is accessible from outside
  const openRoot = host.attachShadow({ mode: 'open' });
  openRoot.innerHTML = '<p>Shadow content</p>';

  console.log(host.shadowRoot);            // ShadowRoot (the open shadow root)
  console.log(host.shadowRoot.querySelector('p').textContent); // "Shadow content"
</script>
```

```html
<!-- ILLUSTRATIVE — closed mode, shadowRoot returns null -->
<div id="host2"></div>

<script>
  const host2 = document.getElementById('host2');

  // Closed mode: shadowRoot is null from outside
  const closedRoot = host2.attachShadow({ mode: 'closed' });
  closedRoot.innerHTML = '<p>Hidden content</p>';

  console.log(host2.shadowRoot);           // null
</script>
```

<!-- ILLUSTRATIVE — open vs closed mode observable in browser DevTools, not runnable in Node/jsdom -->

The composed DOM — how the browser renders what you actually see:

```
Main document tree (what the parser built):
  document
    html
      body
        div#host                    ← shadow host
          span → "Light DOM child"

Shadow tree (attached to div#host):
  #shadow-root (open)
    p → "Shadow content"

Composed/rendered tree (what the browser paints):
  div#host
    p → "Shadow content"            ← from shadow tree (light DOM child not rendered — no slot)
```

The `<span>` is a child of `div#host` in the main document tree. The `<p>` is a child of the shadow root. Because this shadow template has no `<slot>` element, the light DOM `<span>` has no rendering position in the shadow tree — it stays in the DOM but is not rendered. Section 2 (Slots and Light DOM Distribution) shows the complete picture: add a `<slot>` to the shadow template and the `<span>` distributes into it while remaining in the main document tree.

### Part 4 — Follow-Up Questions

**Q: What happens if you call `attachShadow()` on an element that already has a shadow root?**

The browser throws a `DOMException` with the name `"NotSupportedError"`. An element can only have one shadow root. You can't attach a second one without first removing the existing shadow root, and there's no public API to do that. This is intentional — it prevents one piece of code from silently replacing another's shadow tree.

**Q: Can you attach a shadow root to any HTML element?**

No. The spec defines specific elements that can be shadow hosts — primarily custom elements and certain HTML elements like `<div>`, `<span>`, `<article>`, `<header>`, `<footer>`, and most other non-void elements. You cannot attach a shadow root to `<input>`, `<textarea>`, `<img>`, or other replaced/void elements. The browser will throw `"NotSupportedError"` if you try. This restriction exists because those elements have specific rendering behavior defined by the spec that can't be overridden by a shadow tree.

**Q: How does `element.shadowRoot` differ from `getRootNode()`?**

`element.shadowRoot` returns the shadow root directly if the element is a shadow host with an open mode root, or null otherwise. `element.getRootNode()` traverses up the composed tree — it returns the shadow root if the element is inside a shadow tree, or the document if it's in the main document tree. For elements inside a shadow tree, `getRootNode()` gives you the shadow root even in closed mode, which is another reason closed mode is not a security boundary.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| "Closed mode makes the shadow tree private and secure" | Closed mode prevents public API access via `element.shadowRoot`; DevTools can still inspect it, and leaked references bypass it entirely |
| Treats shadow DOM as if it removes the element from the main document | The shadow host stays in the main document tree — only the rendered internals are encapsulated |
| Assumes the browser merges the shadow tree and light DOM tree into one tree | The browser composes them for rendering and events, but the two trees remain structurally separate |

### Part 6 — Production Examples

**Real incident — closed mode creating a false sense of security:** A design system team published a web component library with closed shadow roots, assuming third-party code couldn't access the component internals. A product team needed to override the internal button styling for an accessibility requirement. They reached into the shadow root via `element.shadowRoot`, which worked because the mode was actually open (a later refactor changed it), but the documentation still said closed. The confusion caused a two-week investigation into why "private" styles were being overridden. The lesson: document the mode accurately, and don't rely on closed mode as an interface contract — use explicit part attributes and CSS `::part()` for intentional external access.

**Real incident — shadow DOM breaking CSS frameworks:** A team migrated a component library from plain CSS to shadow DOM components. Their design system's global theme variables (CSS custom properties) continued to work because custom properties pierce the shadow boundary by inheritance. But their global utility classes (`text-center`, `p-4`, etc.) stopped applying inside shadow trees. The fix was choosing between CSS custom properties for theming (which worked) and re-applying utility styles inside each shadow tree via `adoptedStyleSheets` (which worked but doubled the style maintenance surface). The tradeoff was real: full encapsulation meant losing the convenience of global styles, and partial workarounds added complexity.

---

## 2. Slots and Light DOM Distribution

### Part 1 — Theory

A `<slot>` element inside a shadow tree is a distribution point — it tells the browser "render the host's light DOM children here." The host element's children that match a slot get rendered at that slot's position in the shadow tree. Critically, **those children remain in the main document DOM tree**. They are not moved into the shadow tree. The browser renders them in place, but it does not own them.

This is the most commonly misunderstood part of shadow DOM. When you write:

```html
<my-card>
  <h2>Title</h2>
  <p>Body</p>
</my-card>
```

The `<h2>` and `<p>` are children of `<my-card>` in the main document tree. If the shadow tree contains a `<slot>`, the browser renders the `<h2>` and `<p>` at that slot's position — but they are still children of `<my-card>` in the DOM. If you run `document.querySelector('my-card').children`, you get the `<h2>` and `<p>`. They are light DOM.

**Named slots** let you control which children go where. A shadow tree can contain `<slot name="header">` and `<slot name="body">`. Light DOM children with matching `slot` attributes distribute into the corresponding slots: `<h2 slot="header">` goes into the header slot, `<p slot="body">` goes into the body slot. Children without a `slot` attribute go into the default slot (the unnamed `<slot>`).

**`::slotted()`** is the CSS pseudo-element that lets shadow CSS target slotted light DOM content. A shadow tree can write `::slotted(h2) { color: red; }` to style the `<h2>` that's slotted into it. The limitation is that `::slotted()` only targets the direct slotted element — it doesn't penetrate into nested children. `::slotted(.wrapper p)` won't match the `<p>` inside a slotted `.wrapper`. You can only style the top-level slotted element and its direct properties.

**Accessibility implications** follow directly from the fact that slotted content is light DOM. Session 9 established that the accessibility tree is derived from the DOM and that every element has an implicit ARIA role. Slotted content's implicit roles come from the light DOM elements, not from the shadow tree. The `<h2>` inside a slot has `role="heading"` with `aria-level=2` — the same role it would have outside shadow DOM. The main document's accessibility tree sees it as part of the host element's subtree. Screen readers announce slotted content because it's in the main document tree and accessible to the main document's accessibility tree.

### Part 2 — Interview Answer

Slots are how shadow DOM renders the host's light DOM children inside the shadow tree. The children stay in the main document tree — the browser just renders them at the slot's position. This is the part most people get wrong. A `<my-card>` with a `<h2>` child means the `<h2>` is a child of the host element in the light DOM. The shadow tree's `<slot>` tells the browser where to render it, but the `<h2>` is never moved into the shadow tree. If you query the DOM from JavaScript, the `<h2>` is still a child of `<my-card>` in the main document.

Named slots give you explicit control over distribution. `<slot name="header">` matches children with `<element slot="header">`. The default slot — the unnamed `<slot>` — catches everything without a `slot` attribute. This means you can define a layout template in the shadow tree and let the consumer control which content goes where by setting `slot` attributes.

The style implication is important. Because slotted content is light DOM, it inherits styles from the light DOM context, not from the shadow DOM. If the main document sets `color: blue` on the host, slotted content inherits that. The shadow tree can use `::slotted()` to style slotted elements, but only the top-level slotted element — not its descendants. And because slotted content is in the main document tree, it's fully accessible to the main document's JavaScript. A `querySelector` from outside the shadow tree finds slotted content. A screen reader sees it as part of the host element's accessible subtree. The shadow DOM does not hide slotted content from anything.

### Part 3 — Whiteboard / Live Coding

```html
<!-- ILLUSTRATIVE — slot distribution, observable in browser DevTools -->
<my-card>
  <span slot="header">Card Title</span>
  <p>This is the default slot content.</p>
</my-card>

<script>
  class MyCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <div class="card">
          <header><slot name="header"></slot></header>
          <main><slot></slot></main>
        </div>
      `;
    }
  }
  customElements.define('my-card', MyCard);
</script>
```

<!-- ILLUSTRATIVE — slot distribution observable in browser DevTools, not runnable in Node/jsdom -->

The DOM structure and rendering:

```
Main document tree:
  my-card
    span[slot="header"] → "Card Title"
    p → "This is the default slot content."

Shadow tree (attached to my-card):
  #shadow-root (open)
    div.card
      header
        slot[name="header"]    ← receives the span
      main
        slot                   ← receives the p

Rendered output:
  div.card
    header
      span → "Card Title"      ← rendered at slot position, but stays in light DOM
    main
      p → "This is the default slot content."  ← rendered at slot position, stays in light DOM
```

From JavaScript, the light DOM children are still queryable:

```js
// ILLUSTRATIVE — querying slotted content from the main document
const card = document.querySelector('my-card');
console.log(card.children.length);              // 2 (span, p)
console.log(card.children[0].textContent);       // "Card Title"
console.log(card.getAttribute('slot'));           // null (host itself has no slot)
```

**`::slotted()` styling from within the shadow tree:**

```css
/* Inside the shadow tree's stylesheet */
::slotted([slot="header"]) {
  font-size: 1.5rem;
  font-weight: bold;
}

::slotted(p) {
  color: #333;
  line-height: 1.6;
}
```

<!-- ILLUSTRATIVE — ::slotted() styles applied by the shadow tree, not the main document -->

### Part 4 — Follow-Up Questions

**Q: What happens if no slot matches a light DOM child?**

Light DOM children that don't match any named slot and don't have a `slot` attribute go into the default slot — the unnamed `<slot>` element. If there is no default slot, the unmatched children are not rendered at all. They're still in the DOM (still children of the host in the light DOM), but they have no rendering position in the shadow tree. This is a real gotcha: a consumer puts content in a component, the component doesn't render it, and the consumer sees nothing with no error.

**Q: Can a shadow tree contain multiple default slots?**

No. If a shadow tree contains more than one unnamed `<slot>`, the browser uses the first one as the default slot and ignores the rest for distribution purposes. The spec defines this explicitly — multiple unnamed slots produce undefined distribution behavior for the extras. Use named slots if you need multiple distribution points.

**Q: How does slot content interact with `document.querySelector`?**

`document.querySelector` operates on the main document tree. Since slotted content stays in the light DOM, `document.querySelector` finds it on the host element's children. It does not find elements inside the shadow tree. To query inside a shadow tree, you need `shadowRoot.querySelector`. This is the encapsulation boundary at work: the outside can see slotted content, but not shadow tree internals.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Thinks slotted content is moved into the shadow tree | Slotted content stays in the light DOM — the browser renders it at the slot position but doesn't move it |
| Assumes `::slotted()` styles the slotted content's children | `::slotted()` only targets the direct slotted element; nested descendants are not reachable |
| Writes `document.querySelector` to find shadow tree internals | `document.querySelector` only queries the main document tree; shadow tree internals require `shadowRoot.querySelector` |

### Part 6 — Production Examples

**Real incident — slotted content inheritance surprise:** A component library shipped a `<data-table>` web component with a shadow tree that set `font-family: monospace` on the shadow root. Slotted cells (`<td slot="cell">`) were expected to inherit the monospace font. They didn't — because slotted content inherits from the light DOM, not the shadow DOM. The light DOM had `font-family: sans-serif` on the `<body>`. Cells rendered in sans-serif. The fix was either `::slotted(td) { font-family: monospace; }` inside the shadow tree, or (better for a design system) exposing the font as a CSS custom property on the host that consumers could override. The lesson: style encapsulation means slotted content doesn't automatically get the shadow tree's inherited styles.

**Real incident — accessibility tree with slotted headings:** A documentation platform used web components for callout boxes. The shadow tree defined the box structure, and consumers slotted `<h2>` elements into the callout. The accessibility tree showed the `<h2>` as a heading with level 2 — exactly the right role, because slotted content is light DOM and its implicit ARIA role is derived from the HTML element. No ARIA override was needed. The lesson: shadow DOM doesn't break accessibility for slotted content — the accessibility tree sees it as part of the host element's subtree, with the correct implicit roles from the light DOM elements.

---

## 3. Style Encapsulation and Its Limits

### Part 1 — Theory

Shadow DOM provides style encapsulation: styles defined inside a shadow tree don't leak out to the main document, and styles defined in the main document don't leak into the shadow tree. This is the primary reason teams adopt shadow DOM — it prevents style collisions in component-based architectures where multiple teams ship components to the same page.

But the encapsulation is not absolute. Three mechanisms are designed to cross the shadow boundary, and understanding them is more useful than memorizing the rule.

**CSS custom properties (variables)** pierce the shadow boundary by inheritance. If the main document defines `--primary-color: blue` on `<body>`, every shadow tree on the page inherits that value. This is the intended theming mechanism. A design system defines custom properties on the document root, and shadow components read them for theming. The components don't need to know about the specific theme — they just use the variable. The shadow boundary doesn't block inheritance of custom properties because CSS inheritance operates on the computed value tree, which spans shadow boundaries by design.

**`::part()`** lets outside CSS target specific elements inside the shadow tree that have been explicitly exposed with the `part` attribute. A shadow tree can declare `<button part="submit-button">` in its template, and the main document can style it with `my-component::part(submit-button) { ... }`. The `part` attribute is the opt-in mechanism — without it, the outside can't reach in. This exists because complete isolation is often too rigid. A button inside a shadow tree might need to match the page's focus ring style, or a card might need to match the page's spacing conventions. `::part()` gives the consumer controlled access.

**`::slotted()`** lets shadow CSS target slotted light DOM content. This was covered in Section 2, but it matters here as the reverse direction of `::part()`: where `::part()` lets the outside style shadow internals, `::slotted()` lets the shadow tree style the light DOM content that passes through it. Both are escape hatches, pointing in opposite directions.

What IS encapsulated: element selectors (`div`, `p`, `span`) in the shadow tree don't affect the main document, and vice versa. Class selectors (`.foo`) and ID selectors (`#bar`) in the shadow tree are scoped to that tree. The browser generates anonymous scope for shadow tree styles so that they don't collide with global selectors. This is the default behavior — the escape hatches are opt-in.

### Part 2 — Interview Answer

Shadow DOM provides style encapsulation that prevents style collisions between components and the page. Styles inside a shadow tree don't leak out. Styles in the main document don't leak in. If your shadow tree sets `p { color: red }`, only the `<p>` elements inside that shadow tree turn red — the page's `<p>` elements are unaffected. This is the primary value proposition of shadow DOM for design systems and component libraries.

But three mechanisms cross the shadow boundary by design. First, CSS custom properties pierce it — a `--primary-color` defined on `<body>` is inherited by every shadow tree on the page. This is the intended theming mechanism. A design system defines tokens as custom properties, and components consume them. Second, `::part()` lets outside CSS target elements inside the shadow tree that opt in via the `part` attribute. A shadow tree declares `<button part="submit">`, and the page styles it with `my-component::part(submit)`. This exists because complete isolation is often too rigid — focus rings, spacing conventions, and responsive overrides sometimes need external control. Third, `::slotted()` lets the shadow tree style light DOM content that passes through a slot. It only targets the direct slotted element, not its descendants.

The senior answer names these three escape hatches and explains why they exist. The junior answer says "Shadow DOM has complete CSS isolation" — which is wrong. The encapsulation is real but deliberately incomplete. The web platform designers recognized that total isolation would make components unusable in practice, so they built in three escape routes: inheritance for theming, part for explicit opt-in, and slotted for content distribution styling.

### Part 3 — Whiteboard / Live Coding

```html
<!-- ILLUSTRATIVE — style encapsulation and escape hatches -->
<style>
  :root {
    --primary-color: #0066cc;
    --card-bg: #f5f5f5;
  }
  p { color: black; }
</style>

<my-widget>
  <p>Slotted paragraph</p>
</my-widget>

<script>
  class MyWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          p { color: red; }         /* only affects <p> inside THIS shadow tree */
          .widget {
            background: var(--card-bg);  /* custom property pierces shadow boundary */
            padding: 1rem;
          }
          ::slotted(p) {
            border: 1px solid var(--primary-color);  /* slotted() targets light DOM <p> */
          }
        </style>
        <div class="widget">
          <slot></slot>
          <p>Shadow-only paragraph</p>
        </div>
      `;
    }
  }
  customElements.define('my-widget', MyWidget);
</script>
```

<!-- ILLUSTRATIVE — encapsulation behavior observable in browser DevTools -->

What the outside CSS sees vs. what the shadow tree sees:

```
Main document CSS (global scope):
  p { color: black; }              → applies to all <p> NOT inside shadow trees
  :root { --primary-color: ... }   → inherited INTO shadow trees (custom properties pierce)

Shadow tree CSS (encapsulated scope):
  p { color: red; }                → applies only to <p> inside THIS shadow tree
  ::slotted(p) { border: ... }    → targets the light DOM <p> slotted into this tree
  div.widget { background: var(--card-bg); }  → reads the custom property from light DOM inheritance
```

The rendered result:

```
my-widget (host element, in main document)
  ├─ div.widget (shadow tree)
  │    ├─ [slot]
  │    │    └─ p → "Slotted paragraph"     ← border from ::slotted(), color from LIGHT DOM (black)
  │    └─ p → "Shadow-only paragraph"      ← color from shadow tree (red)
  │
  Outside page: p { color: black; }         → does NOT reach into shadow tree
  Shadow tree: p { color: red; }            → does NOT leak to main document
```

**`::part()` — the explicit opt-in escape hatch:**

```html
<!-- ILLUSTRATIVE — ::part() for controlled external styling -->
<my-button>
  <span slot="label">Click me</span>
</my-button>

<script>
  class MyButton extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          button { padding: 0.5rem 1rem; border-radius: 4px; }
        </style>
        <button part="action-button">
          <slot name="label"></slot>
        </button>
      `;
    }
  }
  customElements.define('my-button', MyButton);
</script>

<style>
  /* Main document can target the button via its part attribute */
  my-button::part(action-button) {
    background: var(--primary-color);
    color: white;
    font-weight: bold;
  }
</style>
```

<!-- ILLUSTRATIVE — ::part() observable in browser DevTools -->

### Part 4 — Follow-Up Questions

**Q: Why do CSS custom properties pierce the shadow boundary but regular CSS properties don't?**

CSS custom properties are inherited properties. Inheritance in CSS operates on the computed value tree — when a property is inherited, it passes from parent to child regardless of shadow boundaries. The shadow boundary scopes *rule matching* (which selectors apply), not inheritance (which values are received). Regular CSS properties like `color` or `font-size` also inherit through shadow boundaries if they're set on the host — but the selectors that set them (`p { color: red }`) are scoped. The difference is that custom properties are designed to be consumed by name, not by element type, so the platform lets them cross boundaries intentionally.

**Q: Can you use `::part()` to style descendants of the part-annotated element?**

No. `::part()` targets only the element with the `part` attribute. It does not descend into that element's children. If you need multiple elements styled, each needs its own `part` attribute. This is the same limitation as `::slotted()` — both escape hatches target the boundary element, not its subtree.

**Q: What's the relationship between shadow DOM encapsulation and the CSS Cascade?**

Shadow DOM scoped styles don't participate in the global cascade the same way — they have their own scope. But custom properties, `::part()`, and `::slotted()` connect the shadow tree's styles to the outer cascade through inheritance and explicit selectors. The Cascade still applies within the shadow tree (specificity, source order), but the shadow boundary acts as a cascade boundary for regular selectors.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| "Shadow DOM gives you complete CSS isolation" | Names the three escape hatches (custom properties, `::part()`, `::slotted()`) and explains why each exists |
| Assumes `::slotted()` styles everything inside slotted content | `::slotted()` only targets the direct slotted element, not nested descendants — same limitation as `::part()` |
| Doesn't know why custom properties pierce the boundary | Understands that inheritance operates on computed values across shadow boundaries, and that this is the designed theming mechanism |

### Part 6 — Production Examples

**Real incident — theming a component library with custom properties:** A large design system shipped 40+ web components with shadow DOM. The theming strategy used CSS custom properties: `--ds-color-primary`, `--ds-color-surface`, `--ds-spacing-md`, defined on `:root`. Every component consumed these via `var(--ds-color-primary)`. When the team rebranded, they changed six custom property values on `:root`, and every component updated its appearance. The shadow boundary didn't block the custom properties because they're inherited. The lesson: designing the theming layer around custom properties before building components saves enormous effort later — and it only works because CSS inheritance crosses shadow boundaries by design.

**Real incident — `::part()` for focus management:** A modal dialog component used shadow DOM for encapsulation, but the page's accessibility requirements mandated a specific focus ring style. The shadow tree's internal `<button>` elements needed to match the page's focus ring. The team added `part="action-button"` to each interactive element inside the shadow tree, and the page used `my-modal::part(action-button):focus-visible { outline: 2px solid var(--focus-ring-color); }`. This gave the page controlled access to style the focus ring without breaking the component's encapsulation. The lesson: `::part()` is most valuable when you need to bridge specific styling concerns without opening the entire shadow tree to external styles.

---

## 4. Custom Elements

### Part 1 — Theory

Custom Elements are one of four specs that make up the web components model. The four specs are: **Custom Elements** (the element registry and lifecycle callbacks), **Shadow DOM** (encapsulated tree and styles), **HTML Templates** (`<template>` and `<slot>` for reusable markup), and **ES Modules** (how component code is packaged and distributed). An interviewer asking about "web components" may mean any or all of these. A senior answer acknowledges the four-spec model and can discuss each piece independently.

Custom Elements specifically provide the **element registry** — `customElements.define()` — and the **lifecycle callbacks** that the browser invokes at specific points in an element's existence. The registry maps a tag name (must contain a hyphen, like `my-card`) to a class that extends `HTMLElement`. When the parser encounters `<my-card>` in the HTML, it looks up the registry, finds the class, and instantiates it.

Two flavors exist: **autonomous** custom elements (extend `HTMLElement` directly, used for entirely new components) and **customized built-ins** (extend a specific HTML element like `HTMLButtonElement`, adding behavior to an existing element). Customized built-ins are less widely supported across browsers (Safari had delayed support) and less commonly used in practice. Most web component libraries use autonomous elements.

The **lifecycle callbacks** are the mechanism that connects the custom element to the browser's rendering lifecycle:

1. **`constructor()`** — Called when the element is created or upgraded. This runs before the element is connected to the document. Critically, **element children may not be available here** — the parser hasn't finished processing the element's children yet. Don't access children in the constructor. Don't set attributes that depend on children. Use the constructor only for initial setup that doesn't depend on the DOM.

2. **`connectedCallback()`** — Called when the element is inserted into the document (or a shadow tree that's connected to the document). This is where you set up DOM queries, attach event listeners, and do work that depends on the element being in the tree. Children are available here.

3. **`disconnectedCallback()`** — Called when the element is removed from the document. Clean up event listeners, cancel timers, and release resources here.

4. **`attributeChangedCallback(name, oldValue, newValue)`** — Called when an observed attribute changes. Only fires for attributes listed in the static `observedAttributes` getter. This is the mechanism for reactive attribute updates.

5. **`adoptedCallback()`** — Called when the element is moved to a different document (via `document.adoptNode()`). Rarely used in practice, but it exists.

The constructor/children gotcha is the most commonly missed detail. When the parser encounters `<my-card><p>Hello</p></my-card>`, the sequence is: the parser creates the `<my-card>` element (running `constructor()`), then parses the children (`<p>Hello</p>`), then inserts the closing tag (triggering `connectedCallback()`). Inside `constructor()`, the `<p>` doesn't exist yet — the parser hasn't reached it. If you try to `this.querySelector('p')` in the constructor, you get `null`.

### Part 2 — Interview Answer

Custom Elements are the spec that registers new HTML elements with the browser. You call `customElements.define('my-card', MyCardClass)` where `MyCardClass` extends `HTMLElement`. From that point, the browser treats `<my-card>` as a real HTML element — it instantiates your class, runs your lifecycle callbacks, and integrates it into the DOM like any built-in element. The tag name must contain a hyphen to distinguish it from built-in elements.

Web components are actually four specs working together: Custom Elements for the registry and lifecycle, Shadow DOM for encapsulation, HTML Templates for reusable markup, and ES Modules for code distribution. A senior answer names all four. The Custom Elements piece specifically gives you lifecycle callbacks that the browser invokes: `constructor()` when the element is created, `connectedCallback()` when it's added to the document, `disconnectedCallback()` when it's removed, and `attributeChangedCallback()` when an observed attribute changes.

The critical gotcha is the constructor. When the parser encounters `<my-card><p>Hello</p></my-card>`, it creates the element and runs `constructor()` before it parses the `<p>`. So inside `constructor()`, there are no children yet. You can't query the DOM, you can't read slotted content, you can't depend on children being present. The constructor is for lightweight setup only — attaching the shadow root, setting initial state. All DOM-dependent work goes in `connectedCallback()`, which runs after the element and its children are in the document. Getting this wrong is the most common Custom Elements bug: querying children in the constructor and getting null, then wondering why the component is empty.

### Part 3 — Whiteboard / Live Coding

```html
<!-- ILLUSTRATIVE — Custom Element lifecycle demonstration -->
<my-counter start="5"></my-counter>

<script>
  class MyCounter extends HTMLElement {
    static get observedAttributes() {
      return ['start'];
    }

    constructor() {
      super();
      console.log('1. constructor — element created');
      // Don't access children here — they don't exist yet
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          button { font-size: 1rem; padding: 0.5rem; }
          span { font-size: 1.5rem; margin: 0 1rem; }
        </style>
        <button part="decrement">-</button>
        <span part="count">0</span>
        <button part="increment">+</button>
      `;
      this._count = 0;
    }

    connectedCallback() {
      console.log('2. connectedCallback — element added to document');
      // Children are available now, DOM is live
      this._count = parseInt(this.getAttribute('start')) || 0;
      this._render();
      this.shadowRoot.querySelector('[part="increment"]')
        .addEventListener('click', () => { this._count++; this._render(); });
      this.shadowRoot.querySelector('[part="decrement"]')
        .addEventListener('click', () => { this._count--; this._render(); });
    }

    attributeChangedCallback(name, oldVal, newVal) {
      console.log(`3. attributeChangedCallback — ${name}: "${oldVal}" → "${newVal}"`);
      if (name === 'start') {
        this._count = parseInt(newVal) || 0;
        this._render();
      }
    }

    disconnectedCallback() {
      console.log('4. disconnectedCallback — element removed from document');
      // Clean up: remove event listeners, cancel timers
    }

    _render() {
      this.shadowRoot.querySelector('[part="count"]').textContent = this._count;
    }
  }

  customElements.define('my-counter', MyCounter);
</script>
```

<!-- ILLUSTRATIVE — lifecycle callbacks observable in browser console, not runnable in Node/jsdom -->

The logged order when the page loads:

```
1. constructor — element created
2. connectedCallback — element added to document
```

When the `start` attribute is present in the HTML, `attributeChangedCallback` fires between `constructor` and `connectedCallback`:

```
1. constructor — element created
3. attributeChangedCallback — start: "null" → "5"
2. connectedCallback — element added to document
```

<!-- ILLUSTRATIVE — callback order as observed in browser DevTools console -->

When the element is removed from the DOM:

```
4. disconnectedCallback — element removed from document
```

### Part 4 — Follow-Up Questions

**Q: Why does `attributeChangedCallback` only fire for attributes in `observedAttributes`?**

Performance. Without this restriction, every attribute change on every custom element would trigger a callback, even if the component doesn't care about most attributes. The static `observedAttributes` getter is a declaration of intent — you tell the browser which attributes you want to watch, and it only calls the callback for those. If you need to observe a new attribute, add it to the getter. The getter must return a static array of strings, not a dynamic computation.

**Q: What's the difference between autonomous elements and customized built-ins?**

Autonomous elements extend `HTMLElement` and define entirely new tags (like `<my-card>`). Customized built-ins extend a specific element — `class FancyButton extends HTMLButtonElement` — and are applied with the `is` attribute: `<button is="fancy-button">`. Customized built-ins let you add behavior to existing elements without replacing them. Safari was late to support customized built-ins, which limited adoption. Most production web components use autonomous elements for this reason.

**Q: Can a custom element have a shadow root?**

Yes, and most do. The shadow root provides style encapsulation for the component's internals. But a custom element doesn't require a shadow root — a custom element can render its content directly in the light DOM. The choice depends on whether you need encapsulation. A component that's purely behavioral (like a tooltip controller) might not need a shadow tree. A component with visual structure and styles usually does.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Accesses children or queries the DOM in `constructor()` | Knows children aren't parsed yet in the constructor; does DOM work in `connectedCallback()` |
| Lists all attributes in `observedAttributes` "just in case" | Declares only the attributes the component actually reacts to — performance-conscious declaration of intent |
| Treats custom elements as a framework replacement | Understands custom elements are a browser primitive for registering elements, not a component model with state management, routing, or reactivity |

### Part 6 — Production Examples

**Real incident — constructor/children gotcha in production:** A design system shipped a `<data-viz>` component that read its configuration from child `<param>` elements in the constructor. Users wrote `<data-viz><param name="type" value="bar"></data-viz>`. In the constructor, the component tried to `this.querySelectorAll('param')` and got an empty NodeList — the parser hadn't processed the children yet. The component rendered nothing. The fix was moving the query to `connectedCallback()`, where children were available. The bug shipped because the component worked in development (where the script tag loaded before the HTML, giving the parser time to build children before the constructor ran) but broke in production (where async loading changed the timing). The lesson: always test custom elements with different script loading strategies.

**Real incident — disconnectedCallback cleanup leak:** A dashboard application used custom elements for chart widgets. Each widget attached a `ResizeObserver` in `connectedCallback()` but didn't disconnect it in `disconnectedCallback()`. When users navigated between dashboard views, old widgets were removed from the DOM but their `ResizeObserver` callbacks continued firing. The observers held references to the removed elements, preventing garbage collection. Memory usage grew linearly with the number of view navigations. The fix was disconnecting the observer in `disconnectedCallback()`. The pattern: anything attached in `connectedCallback()` must be cleaned up in `disconnectedCallback()`.

---

## 5. Tie the Chain Together

The Shadow DOM is a second tree the browser manages alongside the main document tree that Session 12 established. Where Session 12 described how the HTML parser builds a single DOM from bytes, the Shadow DOM extends that model: the parser still builds the main document tree, but individual elements can have their own private subtree that the browser renders as part of the composed tree.

Slots distribute light DOM content into the shadow tree while keeping that content in the main document tree — the browser composes the two trees for rendering and events, but the structural separation is real. This means slotted content inherits styles from the light DOM, is accessible to the main document's JavaScript, and has the correct implicit ARIA roles in the accessibility tree that Session 9 established.

Style encapsulation is the primary value of shadow DOM, but it's deliberately incomplete — CSS custom properties, `::part()`, and `::slotted()` are designed escape hatches that cross the shadow boundary. A senior answer names all three and explains why they exist, rather than claiming encapsulation is total.

Custom Elements wire all of this to the HTML parser through the custom element registry. When the parser encounters `<my-card>`, it looks up the registry, instantiates the class, and runs the lifecycle callbacks in order: constructor, then connectedCallback. The constructor runs before children are parsed — a gotcha that affects every Custom Elements implementation.

Session 14 continues Module 2 with events and event delegation — covering how events propagate through composed shadow trees, which this session sets up. The composed tree is the flattened structure the browser renders and the tree that events traverse — understanding it now means the event propagation model in Session 14 builds directly on the composed DOM concept.
