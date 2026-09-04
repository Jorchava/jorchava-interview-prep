# Session 20 — CSS Variables and Theming at Scale

> **Module 3 — CSS Mastery.** Session 6 of 7.
> **Chain:** CSS custom properties (syntax, cascade, inheritance, guaranteed-invalid value) → `@property` for typed and animatable custom properties → design token architecture (three-tier pattern, runtime theming, dark mode, `color-scheme`, `light-dark()`).
> Session 19 covered container queries and style queries, which depend on custom properties. Session 21 closes Module 3 with CSS architecture patterns.

<!-- Module 3 convention: CSS cascade, specificity, and rendering behavior is
observable in DevTools but not in a Node/jsdom unit-testing environment.
All CSS examples in this module are ILLUSTRATIVE — syntactically valid,
mentally traced, but not run against a browser harness in-session.
This convention applies to Sessions 15-21. -->

---

## Topic 1 — CSS Custom Properties

### Part 1: Theory

CSS custom properties — also called CSS variables — are properties that live on elements and inherit down the DOM tree just like `color` or `font-size`. The critical distinction from preprocessor variables like SCSS's `$color: red` is that custom properties resolve at runtime, not at compile time. A SCSS variable is replaced with its literal value during the build. A CSS custom property is a live property on an element: the cascade resolves it, inheritance propagates it, and JavaScript can change it without rebuilding anything.

Declaration syntax is `--name: value` on any element:

```css
:root {
  --color-primary: #3b82f6;
  --spacing-md: 1rem;
}

.card {
  background: var(--color-primary);
  padding: var(--spacing-md);
}
```

<!-- ILLUSTRATIVE: --color-primary is declared on :root (the <html> element)
and inherits down the DOM tree. .card references it via var(). The var()
function performs a substitution at computed-value time — the browser replaces
var(--color-primary) with #3b82f6 when computing .card's background. -->

**The `var()` function and fallbacks.** `var(--name, fallback)` provides a fallback when the custom property isn't set. The fallback can be any valid CSS value, including other `var()` references:

```css
.card {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-border, var(--color-primary, #ccc));
}
```

Here's where the guaranteed-invalid value matters. A custom property that has never been set has an initial value of a special empty token — not `""`, not `unset`, but a guaranteed-invalid value. When `var()` references an undefined property and no fallback is provided, the property declaration becomes invalid at computed-value time. For inherited properties, this means the element uses the inherited value from its parent. For non-inherited properties, it reverts to the property's initial value. Critically, `var(--undefined)` does not cause the declaration to be ignored the way an invalid literal like `color: 7px` would — the declaration is still processed, but the substitution fails and triggers the computed-value-time invalidation.

The practical consequence: `var(--undefined, red)` always gives you `red`. `var(--undefined)` without a fallback gives you either the inherited value or the property's initial value, depending on whether the property inherits. The junior answer says "it just uses the fallback" without knowing when the fallback fires versus when it doesn't.

**Cascade and inheritance.** Custom properties follow the same cascade rules established in Session 15 — origin, importance, layers, specificity, source order. They inherit by default (like `color`), and you can prevent inheritance with `inherits: false` in `@property`. This means a custom property set on `:root` propagates to every descendant unless overridden. A custom property set on a specific component only affects that component and its descendants.

**Runtime theming.** Because custom properties resolve at runtime, JavaScript can change them dynamically:

```typescript
document.documentElement.style.setProperty('--color-primary', '#10b981');
```

No CSS rebuild required. The browser recomputes every property that references `--color-primary` on every element that inherits it. This is the mechanism behind runtime theme switching — toggle a few custom properties on `:root` and the entire UI updates.

---

### Part 2: Interview Answer

CSS custom properties are cascade-participating runtime values — not compiled variables. That's the distinction that matters in an interview. A SCSS variable like `$color: red` gets replaced with `#ff0000` at build time. It's a text substitution — the output CSS has no concept of a "variable." A CSS custom property like `--color: red` is a live property on an element. The cascade resolves it, inheritance propagates it, and JavaScript can change it at runtime without a rebuild.

You declare them with `--name: value` on any element, and reference them with `var(--name, fallback)`. The fallback fires when the property isn't set on that element or any ancestor. But here's the subtlety most people miss: if you reference a custom property that doesn't exist and provide no fallback, the declaration becomes invalid at computed-value time. For inherited properties like `color`, that means the element uses the parent's value — not the property's initial value. For non-inherited properties, it reverts to the initial value. `var(--undefined)` and `var(--undefined, red)` behave differently, and that difference matters when you're debugging why a component's style suddenly reverted.

Custom properties inherit by default, just like `color` or `font-size`. Set `--color-primary: blue` on `:root` and every descendant sees it. Override it on a specific component and that component's subtree uses the override. The cascade determines which declaration wins — same origin, importance, layer, specificity, and source order rules from Session 15 apply identically. This is what makes them the correct mechanism for design tokens: the cascade propagates token values through the DOM tree without any JavaScript orchestration.

The runtime story is what makes them production-viable for theming. `document.documentElement.style.setProperty('--color-primary', '#10b981')` changes the property on the root, and every element that references it recomputes. No rebuild, no class toggling on every element, no stylesheet swap. The browser's style resolution does the work.

---

### Part 3: Whiteboard / Live Coding

**Scope overriding — three layers of the cascade:**

```css
/* Layer 1: root-level default */
:root {
  --color-primary: #3b82f6;
  --spacing-md: 1rem;
}

/* Layer 2: component-level override */
.card {
  --color-primary: #10b981;
  background: var(--color-primary);
  padding: var(--spacing-md);
}

/* Layer 3: element-level override */
.card--featured {
  --color-primary: #f59e0b;
  --spacing-md: 1.5rem;
  background: var(--color-primary);
  padding: var(--spacing-md);
}
```

<!-- ILLUSTRATIVE: .card overrides --color-primary at the component level,
so all .card elements get green. .card--featured overrides again at the
element level, so featured cards get amber. --spacing-md inherits from :root
in both cases because neither .card nor .card--featured redefines it.
Verify in DevTools: inspect a .card--featured and check the computed
--color-primary value — it shows #f59e0b, resolved from the most specific
rule that sets it. -->

**The guaranteed-invalid value in action:**

```css
/* --undefined is never set anywhere */
.unstyled {
  /* var(--undefined) with no fallback → invalid at computed-value time */
  color: var(--undefined);
  /* For inherited properties like color, this means:
     the element inherits color from its parent */
}

.unstyled-box {
  /* var(--undefined) with no fallback → invalid at computed-value time */
  background: var(--undefined);
  /* For non-inherited properties like background,
     this reverts to the initial value: transparent */
}
```

<!-- ILLUSTRATIVE: .unstyled inherits its parent's text color because color
is an inherited property. .unstyled-box gets a transparent background
because background is not inherited, so it reverts to the initial value.
Both declarations are still processed — they don't become ignored. The
var() substitution fails, which triggers computed-value-time invalidation,
which triggers the inherited/initial fallback path. -->

**Runtime theming via JavaScript:**

```typescript
// Toggle theme
function setTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.style.setProperty('--color-bg', '#1a1a2e');
    root.style.setProperty('--color-text', '#e0e0e0');
    root.style.setProperty('--color-primary', '#818cf8');
  } else {
    root.style.setProperty('--color-bg', '#ffffff');
    root.style.setProperty('--color-text', '#111827');
    root.style.setProperty('--color-primary', '#3b82f6');
  }
}

// Or use a data attribute for CSS-only switching
root.dataset.theme = 'dark';
```

<!-- ILLUSTRATIVE: setTheme() changes three custom properties on :root. Every
element that references these properties recomputes its styles. The CSS-only
alternative sets a data-theme attribute, which CSS rules can target:
[data-theme="dark"] { --color-bg: #1a1a2e; }. Both approaches use the same
mechanism — changing custom properties at the root level — but the JavaScript
approach doesn't require a stylesheet change. -->

---

### Part 4: Follow-Up Questions

**Q: When would you use `element.style.setProperty()` versus a `data-theme` attribute?**

The `data-theme` approach is better for most cases because it keeps the token values in CSS, where designers can find them. JavaScript toggles the attribute, CSS provides the values. `element.style.setProperty()` is better when the values are dynamic — a color picker that lets users set their own brand color, or a theme generator that reads configuration from an API. The rule: if the values are known at authoring time, use CSS with a data attribute. If they're determined at runtime from user input or external data, use `setProperty()`.

**Q: Can you use custom properties in media queries or selectors?**

Not in media queries — `@media (min-width: var(--breakpoint))` doesn't work because custom properties resolve at computed-value time, and media queries are evaluated before style computation. But you can use them in `@container style()` queries, which is the point of Session 19's style queries. Selectors also can't use custom properties — `[data-theme="dark"]` works, but `:root:has(var(--theme))` doesn't. Custom properties are values, not structural selectors.

**Q: What's the performance cost of many custom property overrides?**

The browser recomputes styles for every element that inherits a changed property. On `:root`, changing `--color-primary` triggers recomputation for every element that references it — potentially the entire page. In practice, this is fast for a handful of properties. The performance risk is changing hundreds of custom properties simultaneously or changing them on deeply nested containers that trigger broad recomputation. The practical guidance: use `:root` for theme-level tokens and limit runtime changes to a small number of properties.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"CSS variables are like SCSS variables but native — you declare them with `--` and use `var()` to reference them. The fallback value is used when the variable isn't defined."

**Why this misses the point:** It treats custom properties as a compile-time substitution ("like SCSS variables but native"), which is the exact opposite of how they work. It also conflates the guaranteed-invalid value path with the fallback path — `var(--undefined, red)` uses the fallback, but `var(--undefined)` with no fallback doesn't "use" anything; it triggers computed-value-time invalidation that either inherits or reverts to the initial value depending on whether the property inherits. The junior answer doesn't know the cascade resolves custom properties, doesn't know they inherit, and doesn't know JavaScript can change them at runtime.

**Senior answer:**
"Custom properties are cascade-participating runtime values. They're declared on elements, inherit down the DOM tree, and resolve at computed-value time — not at build time. The cascade determines which declaration wins using the same rules as any other CSS property: origin, importance, layers, specificity, source order. `var(--undefined, red)` gives you `red`. `var(--undefined)` without a fallback triggers computed-value-time invalidation — inherited properties use the parent's value, non-inherited properties revert to the initial value. JavaScript can change them with `setProperty()` and the browser recomputes affected styles. That's why they're the correct mechanism for design tokens."

**The tell:** The senior answer names cascade resolution, inheritance behavior, and the guaranteed-invalid value distinction. The junior answer says "like SCSS but native" and stops there.

---

### Part 6: Production Examples

A SaaS platform with a white-label product needed to support customer-branded themes. Each customer had brand colors, spacing, and typography that had to propagate through 200+ components. Before custom properties, theming meant maintaining 200+ SCSS variable files — one per customer — and rebuilding the entire stylesheet bundle for each brand. A single color change required a full deploy cycle.

The fix: a single CSS file with custom properties at `:root`. Each customer's theme was a JSON config that JavaScript read on load and applied via `document.documentElement.style.setProperty()`. The component CSS referenced `var(--color-primary)`, `var(--spacing-md)`, `var(--font-heading)` — never hard-coded values. Theme switching happened in-browser without a rebuild. A customer could update their brand color and see the change on next page load, not next deploy.

The specific incident that triggered the migration: a customer rebranded and needed their primary color changed from blue to green. The old system required a SCSS variable change, a full build, CDN cache invalidation, and a rolling deploy across 12 servers — four hours of engineering time for a hex code change. After the custom-property migration, the same change was a one-line JSON update that took effect on next page load. The engineering team estimated they spent 15% of their CSS maintenance time on theme-related rebuilds before the migration. After, it was zero.

---

## Topic 2 — `@property`

### Part 1: Theory

The `@property` at-rule registers a custom property with metadata: its type, whether it inherits, and its initial value. Without `@property`, custom properties are untyped strings — the browser has no idea whether `--color-primary` holds a color, a length, or a URL. That matters for animations because the browser can only interpolate between values it understands the type of.

Three required descriptors:

```css
@property --brand-hue {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}
```

**`syntax`** defines the type. Common values: `'<color>'`, `'<length>'`, `'<number>'`, `'<angle>'`, `'<percentage>'`, `'*'` (any value). The type tells the browser how to parse and interpolate the value.

**`inherits`** controls whether the property inherits — the same inheritance behavior as any other CSS property, but now declared explicitly. `inherits: true` means descendants see the value unless they override it. `inherits: false` means the property acts as a local token — it doesn't propagate to children.

**`initial-value`** sets the value when the property is unset on an element. Without `@property`, the initial value of a custom property is a special empty token (the guaranteed-invalid value from Topic 1). With `@property`, you define a concrete initial value.

**The animatability payoff.** Unregistered custom properties are strings — `--hue: 0deg` and `--hue: 180deg` are just strings to the browser. You can't transition between them because the browser doesn't know they're angles. Registered properties have types, so the browser knows exactly how to interpolate:

```css
@property --hue {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}

.element {
  --hue: 0deg;
  transition: --hue 0.3s ease;
}

.element:hover {
  --hue: 180deg;
}
```

<!-- ILLUSTRATIVE: The transition on --hue works because @property registered
it as an <angle>. Without @property, the transition would not interpolate —
the value would jump from 0deg to 180deg at the end of the duration. With
@property, the browser interpolates the angle value smoothly across the
transition. Verify in DevTools: watch the computed --hue value change frame
by frame during the transition. -->

The same applies to `@keyframes`:

```css
@property --hue {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}

@keyframes hue-shift {
  from { --hue: 0deg; }
  to { --hue: 360deg; }
}

.animated {
  animation: hue-shift 3s linear infinite;
  background: hsl(var(--hue) 80% 60%);
}
```

<!-- ILLUSTRATIVE: The @keyframes animation interpolates --hue from 0deg to
360deg because @property declared the syntax as <angle>. Without the
registration, the keyframes would hold two string values and jump at the
50% mark. The background uses hsl() with the custom property, which updates
each frame. -->

**`inherits: false` use case.** A component can declare a local token that doesn't bleed into descendants:

```css
@property --tooltip-bg {
  syntax: '<color>';
  inherits: false;
  initial-value: #1f2937;
}

.tooltip {
  --tooltip-bg: #111827;
  background: var(--tooltip-bg);
}
```

<!-- ILLUSTRATIVE: --tooltip-bg is registered with inherits: false, so a
tooltip's children don't inherit this value. If a child element references
var(--tooltip-bg), it gets the initial value (#1f2937) unless it sets its
own value. This prevents component-internal tokens from leaking into
descendant elements that shouldn't know about them. -->

---

### Part 2: Interview Answer

`@property` is the answer to "why don't CSS variable animations work?" Unregistered custom properties are strings — the browser sees `--hue: 0deg` and `--hue: 180deg` as two different text values, not two angles. It can't interpolate between strings, so transitions and keyframe animations either don't fire or jump at the midpoint.

`@property` registers a custom property with three required descriptors. `syntax` declares the type — `'<color>'`, `'<length>'`, `'<number>'`, `'<angle>'`, or `'*'` for any value. `inherits` controls whether the property propagates to descendants — `true` for theme-level tokens, `false` for component-internal tokens that shouldn't leak. `initial-value` sets the default when the property is unset.

Once registered, the browser knows the type and can interpolate. `transition: --hue 0.3s ease` works because the browser knows it's interpolating an angle. `@keyframes` that change a registered custom property produce smooth value transitions instead of string jumps. This is the production approach for animatable design tokens — a color that shifts on hover, a spacing that expands on focus, a hue that rotates continuously.

The `inherits: false` descriptor is the component-scoping tool. A tooltip component registers `--tooltip-bg` as a non-inheriting color with an initial value. The tooltip sets `--tooltip-bg: #111827` for its own background, but descendant elements don't see that value — they get the initial value instead. This prevents component-internal tokens from polluting the global design token namespace.

Browser support is solid as of 2024: Chrome 85+, Firefox 128+, Safari 16.4+. The feature has been stable across all major browsers for over a year. There's no reason not to use it for any custom property that needs animation or type safety.

---

### Part 3: Whiteboard / Live Coding

**Animating a custom property — before and after `@property`:**

```css
/* Without @property — animation doesn't interpolate */
.card-unregistered {
  --hue: 0deg;
  transition: --hue 0.3s ease;
  background: hsl(var(--hue) 80% 60%);
}

.card-unregistered:hover {
  --hue: 180deg;
  /* The background jumps from hsl(0 80% 60%) to hsl(180 80% 60%)
     at the end of 0.3s — no smooth transition */
}

/* With @property — animation interpolates */
@property --hue {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}

.card-registered {
  --hue: 0deg;
  transition: --hue 0.3s ease;
  background: hsl(var(--hue) 80% 60%);
}

.card-registered:hover {
  --hue: 180deg;
  /* The background smoothly transitions through
     intermediate hue values over 0.3s */
}
```

<!-- ILLUSTRATIVE: The unregistered property produces a discrete jump because
the browser treats both values as strings. The registered property produces
a smooth transition because the browser knows it's interpolating an <angle>.
Verify in DevTools: watch the computed background color change frame by
frame during the transition — the registered version shows intermediate
colors, the unregistered version jumps. -->

**Continuous rotation with `@keyframes`:**

```css
@property --spin {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes spin-hue {
  from { --spin: 0deg; }
  to { --spin: 360deg; }
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: hsl(var(--spin) 80% 50%);
  border-radius: 50%;
  animation: spin-hue 1s linear infinite;
}
```

<!-- ILLUSTRATIVE: --spin is registered as <angle> with inherits: false so
it doesn't leak into descendant elements. The @keyframes animation rotates
the hue value continuously, and the border-top-color updates each frame.
Without @property, this animation would not interpolate. -->

**Non-inheriting component token:**

```css
@property --badge-bg {
  syntax: '<color>';
  inherits: false;
  initial-value: #6b7280;
}

.badge {
  --badge-bg: #3b82f6;
  background: var(--badge-bg);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
}

/* A child element doesn't inherit --badge-bg */
.badge .badge-count {
  color: var(--badge-bg);
  /* Gets the initial value #6b7280, not the badge's #3b82f6,
     because inherits: false prevents propagation */
}
```

<!-- ILLUSTRATIVE: The badge sets --badge-bg for its own background. The
.badge-count child references var(--badge-bg) but gets the initial value
#6b7280 because inherits: false prevents the badge's value from
propagating. If inherits were true (the default), .badge-count would get
#3b82f6. -->

---

### Part 4: Follow-Up Questions

**Q: What happens if `syntax` and `initial-value` don't match?**

The property becomes invalid at registration time. If you declare `syntax: '<length>'` but `initial-value: red`, the browser ignores the `@property` rule entirely — the custom property is never registered, and any `var()` referencing it behaves as if the property doesn't exist (guaranteed-invalid value). The `syntax` and `initial-value` must be type-compatible.

**Q: Can I use `@property` with `*` syntax and still animate?**

No. The `*` syntax means "accept any value" — the browser treats it like an unregistered property for interpolation purposes. You can register a property with `syntax: '*'` to give it an explicit `initial-value` and `inherits` behavior, but you won't get animation interpolation. Use a specific type (`'<color>'`, `'<length>'`, etc.) when you need the property to animate.

**Q: How does `@property` interact with `@layer`?**

`@property` rules must appear outside of `@layer` blocks — they're at-rules that register properties, not declarations that sit in layers. The property itself can be used inside layered rules, and the cascade layers govern which declaration of the property wins. `@property` defines the type and initial value; `@layer` defines cascade priority. They solve different problems and don't conflict.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"`@property` lets you register custom properties so they can be animated. You define the type and initial value, and then you can use transitions on them."

**Why this misses the point:** It names the feature but doesn't explain why it exists or what problem it solves. The junior answer doesn't mention `inherits`, doesn't explain the untyped-string problem that `@property` fixes, and doesn't distinguish between `inherits: true` (theme tokens) and `inherits: false` (component tokens). It also doesn't mention that unregistered properties can't be interpolated — which is the entire reason `@property` exists.

**Senior answer:**
"Unregistered custom properties are strings — the browser can't interpolate between `--hue: 0deg` and `--hue: 180deg` because it doesn't know they're angles. `@property` registers a type with three descriptors: `syntax` (the type — `'<angle>'`, `'<color>'`, etc.), `inherits` (whether it propagates to descendants), and `initial-value` (the default when unset). Once registered, the browser can interpolate in transitions and keyframe animations. The `inherits: false` option is the component-scoping tool — a tooltip that registers `--tooltip-bg` as a non-inheriting color keeps its internal token from leaking into descendant elements that shouldn't know about it."

**The tell:** The senior answer names the untyped-string problem, all three descriptors with use cases, and the `inherits: false` scoping pattern. The junior answer says "it lets you animate custom properties" without explaining what was broken before.

---

### Part 6: Production Examples

A design system team built a color palette generator that let designers adjust brand hue interactively. The hue value needed to propagate to every component — buttons, badges, links, focus rings — and the transitions had to be smooth so designers could see the effect in real time.

Without `@property`, the hue transitions were discrete jumps. A button's background would snap from blue to green at the end of the transition duration instead of smoothly shifting. Engineers tried using CSS `filter: hue-rotate()` as a workaround, but that affected child elements differently and broke the design system's token model.

The fix: register every animatable token with `@property`. `--brand-hue` was registered as `<angle>`, `--brand-saturation` as `<number>`, and `--brand-lightness` as `<number>`. The transitions became smooth because the browser could interpolate the typed values. The designer's hue slider called `setProperty()` on `:root`, and the entire palette shifted smoothly across all components.

The specific incident: a designer spent 45 minutes trying to find a brand color that worked, but every adjustment produced a jarring snap instead of a smooth preview. They filed a design tooling bug. The engineer who investigated realized the custom properties were untyped and the transitions were discrete. Registering the three properties with `@property` fixed the bug in a single commit. The designer's feedback: "Now I can actually see what I'm doing."

---

## Topic 3 — Design Token Architecture and Theming

### Part 1: Theory

Design tokens are the named values that define a visual language — colors, spacing, typography, shadows, border radii. The three-tier architecture organizes them so that changes at the right level propagate correctly through the system.

**Tier 1: Primitive tokens.** The raw values. These are the palette — every color, every spacing unit, every font size the system uses, with no semantic meaning attached.

```css
:root {
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-gray-100: #f3f4f6;
  --color-gray-900: #111827;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
}
```

**Tier 2: Semantic tokens.** The intent — what the value means in context. These reference primitives, so changing a primitive updates every semantic token that references it.

```css
:root {
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-surface: var(--color-gray-100);
  --color-text: var(--color-gray-900);
  --spacing-component: var(--spacing-4);
}
```

**Tier 3: Component tokens.** The specific usage — how a component uses the semantic tokens.

```css
.button {
  --button-bg: var(--color-primary);
  --button-text: var(--color-surface);
  background: var(--button-bg);
  color: var(--button-text);
  padding: var(--spacing-component);
}
```

The cascade flows through the tiers via `var()` references. Changing `--color-blue-500` at the primitive level updates every semantic token that references it, which updates every component token that references the semantic token. This is the power of the architecture — you change one value and the entire system updates.

**Dark mode implementation.** The semantic tier is where theming happens. Override the semantic tokens at the right scope and every component updates automatically:

```css
/* Light theme (default) */
:root {
  --color-primary: var(--color-blue-500);
  --color-surface: var(--color-gray-100);
  --color-text: var(--color-gray-900);
  color-scheme: light;
}

/* Dark theme via data attribute */
[data-theme="dark"] {
  --color-primary: var(--color-blue-400);
  --color-surface: var(--color-gray-900);
  --color-text: var(--color-gray-100);
  color-scheme: dark;
}

/* Dark theme via media query — same tokens, same overrides */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-primary: var(--color-blue-400);
    --color-surface: var(--color-gray-900);
    --color-text: var(--color-gray-100);
    color-scheme: dark;
  }
}
```

<!-- ILLUSTRATIVE: Both data-attribute and media-query approaches override
the same semantic tokens. The :root:not([data-theme="light"]) selector
ensures the manual toggle takes precedence over the OS preference. The
component tokens (var(--button-bg), etc.) don't change because they
reference semantic tokens, which now resolve to dark values. -->

**`color-scheme`.** The `color-scheme` property tells the browser which color schemes the page supports. This affects UA-styled elements — form inputs, scrollbars, selects, the default `color` and `background-color` — without any custom CSS. Setting `color-scheme: light dark` tells the browser the page supports both schemes and should use the user's OS preference for UA defaults.

**`light-dark()`.** The modern alternative to maintaining two sets of semantic tokens. It takes two arguments — the light value and the dark value — and returns the appropriate one based on the computed `color-scheme`:

```css
:root {
  color-scheme: light dark;
}

.element {
  color: light-dark(#111827, #f3f4f6);
  background: light-dark(white, #1a1a2e);
  border-color: light-dark(#d1d5db, #374151);
}
```

`light-dark()` requires `color-scheme: light dark` on the element or an ancestor. It reads the computed `color-scheme` value — if it's `light`, the first argument wins; if `dark`, the second. This eliminates the need for `[data-theme="dark"]` overrides for individual properties — one declaration handles both modes. The semantic token layer can use `light-dark()` to collapse two theme sets into one:

```css
:root {
  color-scheme: light dark;
  --color-surface: light-dark(#f3f4f6, #111827);
  --color-text: light-dark(#111827, #f3f4f6);
  --color-primary: light-dark(#3b82f6, #60a5fa);
}
```

<!-- ILLUSTRATIVE: light-dark() is supported in Chrome 123+, Firefox 123+,
Safari 17.5+. It requires color-scheme: light dark on the element or an
ancestor. The function reads the computed color-scheme value at computed-value
time — not at parse time — so it responds to runtime changes in
color-scheme. Verify support at https://caniuse.com/css-types-color-light-dark. -->

---

### Part 2: Interview Answer

Design token architecture has three tiers, and the cascade flows through them via `var()` references. Primitives are the raw values — every color, spacing, and font size in the system. Semantics map intent to primitives — `--color-primary` references `--color-blue-500`. Components map usage to semantics — `--button-bg` references `--color-primary`. Changing a primitive at the root level updates every semantic and component token that references it, because the cascade resolves `var()` substitutions at computed-value time.

Dark mode implementation lives at the semantic tier. You override `--color-surface`, `--color-text`, and `--color-primary` under a `[data-theme="dark"]` attribute or a `@media (prefers-color-scheme: dark)` query. Component tokens don't change because they reference semantic tokens, which now resolve to dark values. The two approaches — manual toggle and OS preference — share the same token set because they override the same semantic layer.

`color-scheme: light dark` tells the browser the page supports both modes, which affects UA-styled elements like inputs, scrollbars, and selects. `light-dark()` is the modern alternative to maintaining two complete token sets — it takes a light value and a dark value and returns the appropriate one based on the computed `color-scheme`. You can define semantic tokens with `light-dark()` and collapse your entire theme into a single set of declarations: `--color-surface: light-dark(#f3f4f6, #111827)`.

The senior-level insight: junior engineers put all dark-mode overrides in a `.dark` class with duplicated token values. Senior engineers use the three-tier architecture so only the semantic tier needs overriding, and `prefers-color-scheme` and manual toggles share the same token definitions. The component tier never touches theme values directly — it always references semantic tokens.

---

### Part 3: Whiteboard / Live Coding

**Three-tier token architecture:**

```css
/* Tier 1: Primitives — raw values, no semantic meaning */
:root {
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}

/* Tier 2: Semantics — intent, references primitives */
:root {
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-surface: var(--color-gray-100);
  --color-surface-alt: white;
  --color-border: var(--color-gray-200);
  --color-text: var(--color-gray-900);
  --color-text-muted: var(--color-gray-800);
  --spacing-sm: var(--spacing-2);
  --spacing-md: var(--spacing-4);
  --spacing-lg: var(--spacing-6);
  --radius-component: var(--radius-md);
}

/* Tier 3: Components — usage, references semantics */
.button {
  background: var(--color-primary);
  color: var(--color-surface-alt);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-component);
  border: 1px solid var(--color-border);
}

.button:hover {
  background: var(--color-primary-hover);
}
```

<!-- ILLUSTRATIVE: The cascade flows: primitives define raw values, semantics
map intent to primitives, components reference semantics. Changing
--color-blue-500 at the primitive level updates --color-primary at the
semantic level, which updates .button's background at the component level.
Every var() reference resolves at computed-value time through the cascade. -->

**Dark mode override — same architecture, one layer changed:**

```css
/* Dark theme: only semantic tokens change */
[data-theme="dark"] {
  --color-primary: var(--color-blue-400);
  --color-primary-hover: var(--color-blue-500);
  --color-surface: var(--color-gray-900);
  --color-surface-alt: var(--color-gray-800);
  --color-border: var(--color-gray-800);
  --color-text: var(--color-gray-100);
  --color-text-muted: var(--color-gray-200);
}

/* Component tokens don't change — they reference semantics */
/* .button still uses var(--color-primary) — now resolves to blue-400 */
```

<!-- ILLUSTRATIVE: The .button CSS doesn't change for dark mode. Only the
semantic tier overrides. This is the key architectural advantage — components
never reference primitives directly, so they automatically adapt when semantic
tokens change. Verify in DevTools: inspect a .button in dark mode and check
the computed background — it shows #60a5fa (blue-400) because --color-primary
resolved through the semantic override. -->

**`light-dark()` — collapsing two token sets into one:**

```css
:root {
  color-scheme: light dark;

  /* Semantic tokens using light-dark() */
  --color-surface: light-dark(#f3f4f6, #111827);
  --color-surface-alt: light-dark(white, #1f2937);
  --color-text: light-dark(#111827, #f3f4f6);
  --color-text-muted: light-dark(#374151, #9ca3af);
  --color-border: light-dark(#e5e7eb, #374151);
  --color-primary: light-dark(#3b82f6, #60a5fa);
  --color-primary-hover: light-dark(#2563eb, #3b82f6);
}

/* Manual toggle overrides color-scheme */
[data-theme="light"] { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }

/* OS preference fallback */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
  }
}
```

<!-- ILLUSTRATIVE: light-dark() eliminates the need for separate
[data-theme="dark"] overrides for each semantic token. The function reads
the computed color-scheme at runtime. When color-scheme is light, the first
argument wins. When dark, the second. The manual toggle changes color-scheme,
which causes light-dark() to re-evaluate. One set of declarations handles
both modes. Verify in DevTools: change color-scheme between light and dark
and watch the computed --color-surface value change. -->

---

### Part 4: Follow-Up Questions

**Q: When should you use `light-dark()` versus separate `[data-theme="dark"]` overrides?**

Use `light-dark()` when the theme values are simple color swaps — surface, text, primary, border. It collapses two token sets into one and eliminates the duplicate overrides. Use `[data-theme="dark"]` overrides when the dark theme changes the token structure itself — different spacing, different typography, different component variants. `light-dark()` only handles value swapping; `data-theme` overrides can add or remove tokens entirely. In practice, most theme implementations use `light-dark()` for the 80% case (color swaps) and `data-theme` overrides for edge cases that need structural changes.

**Q: Can `light-dark()` reference custom properties inside it?**

Yes. `--color-primary: light-dark(var(--blue-500), var(--blue-400))` works because `light-dark()` accepts any valid color value, including `var()` substitutions. The `var()` references resolve first, then `light-dark()` selects between the resolved values based on `color-scheme`. This means you can use primitives inside `light-dark()` at the semantic tier.

**Q: How does `color-scheme` affect form inputs and scrollbars?**

Setting `color-scheme: dark` on the root tells the browser to render UA-styled elements with dark defaults — dark backgrounds on inputs, dark scrollbars, dark select dropdowns. Without this, a dark-themed page with light-themed form inputs looks broken. `color-scheme: light dark` tells the browser both modes are supported and to use the user's OS preference. This is separate from your custom-property theming — it's the browser's own UA stylesheet responding to the declared color scheme.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"For dark mode, you create a `.dark` class and override all the color variables. You duplicate every token value — one set for light, one set for dark."

**Why this misses the point:** Duplicating every token means every new token requires updating two places. The junior approach also doesn't distinguish between tiers — it overrides primitives and semantics together, which means a color change requires updating both the primitive and the semantic reference. And it doesn't account for `prefers-color-scheme` — a manual `.dark` class and an OS preference are separate implementations instead of sharing the same token set.

**Senior answer:**
"The three-tier architecture — primitives, semantics, components — means dark mode only overrides the semantic tier. Primitives stay the same. Components reference semantics, so they adapt automatically. I use `light-dark()` for the common case where dark mode is a color swap: `--color-surface: light-dark(#f3f4f6, #111827)`. For `prefers-color-scheme` and manual toggles, both change `color-scheme`, which `light-dark()` reads at computed-value time — so one set of declarations handles both the OS preference and the user toggle. `color-scheme: light dark` on the root also tells the browser to style form inputs and scrollbars in dark mode, which custom properties alone don't handle."

**The tell:** The senior answer names the three tiers, the cascade flow between them, and `light-dark()` as the collapse mechanism. The junior answer says "override all the variables in a `.dark` class" without mentioning tiers, inheritance, or `color-scheme`.

---

### Part 6: Production Examples

A design system at a large e-commerce company maintained 47 component tokens across 12 components. Each component had a light theme and a dark theme — 94 token definitions total. When the design team added a new accent color, an engineer had to update both the light and dark token sets, in the right component files, and verify that no component was missed. The process took half a day and produced bugs every time — three times in one quarter, a component was shipped with the old dark-mode accent color because the engineer forgot to update that specific file.

The migration to the three-tier architecture collapsed the token count from 94 to 47. Primitives defined the raw palette. Semantic tokens mapped intent to primitives using `light-dark()` — one declaration per token instead of two. Component tokens referenced semantics and never changed. When the accent color was updated, the engineer changed one primitive value, and every semantic and component token updated automatically through the `var()` cascade chain.

The specific incident: a product manager requested a "seasonal theme" for a holiday campaign — a temporary brand color change across the entire site. Before the migration, this would have required a new token set, a new CSS file, and a build configuration change. After the migration, the campaign team changed three primitive tokens via a JavaScript configuration object that called `setProperty()` on `:root`. The entire site shifted to the holiday palette in 200 milliseconds. The campaign ran for two weeks, and reverting was the same three `setProperty()` calls restoring the original values. No deploy, no build, no CSS changes.

---

## Tie the Chain Together

CSS custom properties are cascade-participating runtime values — not compiled variables. That distinction is what makes them the correct mechanism for design tokens and runtime theming. They inherit down the DOM tree, the cascade determines which declaration wins using the same rules Session 15 established, and JavaScript can change them at runtime without a rebuild. The guaranteed-invalid value — the empty token that unregistered properties hold when unset — is distinct from the initial value and triggers different fallback paths depending on whether the property inherits.

`@property` types custom properties so transitions and animations can interpolate between values. The three descriptors — `syntax`, `inherits`, `initial-value` — define the type, inheritance behavior, and default. Without registration, custom properties are strings and can't animate smoothly. With registration, they're first-class CSS values that the browser's animation engine understands.

The three-tier token architecture — primitives, semantics, components — uses the cascade's specificity and inheritance rules to propagate token changes from raw values through intent to component usage. Dark mode overrides the semantic tier; components adapt automatically. `color-scheme` tells the browser which modes the page supports, affecting UA-styled elements. `light-dark()` collapses two theme sets into one declaration by reading the computed `color-scheme` at runtime.

Session 19's style queries are the logical extension of this session's variable system — querying custom property values on containers to apply component variants. Session 21 closes Module 3 with CSS architecture patterns — the organizational layer that ties tokens, layers, and component styles into a maintainable system.

---

## Cross-References

- Session 15 (`book/03-css-mastery/15-cascade-specificity-inheritance.md`) — cascade, specificity, and inheritance. Custom properties follow these same rules for resolution and inheritance. The five cascade-wide keywords (`inherit`, `initial`, `unset`, `revert`, `revert-layer`) apply to custom properties identically.
- Session 19 (`book/03-css-mastery/19-container-queries-modern-css-logical-properties.md`) — style queries (`@container style(--var: value)`) query custom property values on containers, making the variable system from this session the foundation for component variants without JavaScript.
- Session 21 (`book/03-css-mastery/21-architecture-bem-scss-scalable-css.md`) — CSS architecture patterns, which build on the token system and cascade layer model from this session and Session 15.
