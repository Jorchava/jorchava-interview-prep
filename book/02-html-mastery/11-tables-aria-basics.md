# Tables, and ARIA Basics in HTML Context

> Two connected topics about the semantic layer of HTML beyond elements: tables are the most structured data markup in HTML, with explicit header-cell associations that assistive technology can traverse; ARIA is the bridge that fills the gaps native HTML can't cover — defining widget roles, communicating dynamic states, providing accessible names, and announcing live content changes.

---

## 1. Table Semantics

### Part 1 — Theory

HTML tables represent tabular data: information with a meaningful row-and-column structure. The key phrase is *meaningful* — a table where the data doesn't have row/column relationships shouldn't use `<table>`. The element carries semantic weight that assistive technology relies on.

The structural elements are `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`, `<td>`, and `<caption>`. Each does something for the accessibility tree:

- `<caption>` is the table's accessible name — the equivalent of a heading for the table. A screen reader encountering a `<table>` with a `<caption>` announces the caption before entering the table. This is the correct mechanism for labeling a table. Using `aria-label` on the `<table>` is an acceptable alternative when a visible caption isn't desired, but `<caption>` is preferred when a visible heading exists.

- `<thead>`, `<tbody>`, `<tfoot>` group rows structurally. They don't directly affect the accessibility tree as much as the heading/data cell distinction does, but they matter for rendering (repeating `<thead>` on printed pages, for instance).

- `<th>` defines a header cell. When no `scope` attribute is set, the browser infers the association based on the cell's position — but certain assistive technologies may fail to infer correctly. Explicitly setting `scope="col"` on column headers and `scope="row"` on row headers removes ambiguity and ensures consistent behavior across assistive technologies.

- `<td>` is a data cell. A data cell's relationship to headers is determined by its position relative to `<th>` elements, or explicitly by `id` and `headers` attributes for complex tables.

**Simple tables** — where every column has a header in `<thead>` and every row might have a header in the first column — work with `scope` alone. The browser and assistive technology infer the association from position. A `<th scope="col">` in `<thead>` headers all `<td>` cells below it. A `<th scope="row">` in the first `<td>` of a `<tr>` headers the remaining `<td>` cells in that row.

**Complex tables** — irregular headers, spanning cells, multiple header rows — need `id` on `<th>` elements and `headers` on `<td>` elements that reference those IDs. This is explicit cell-to-header association. It's more verbose but it's the only way to handle tables where `scope` can't express the relationship.

**Layout tables** — `<table>` used purely for visual positioning, not data — are a historical pattern from before CSS layout existed. They should be suppressed with `role="presentation"` (or the equivalent `role="none"`) to strip the table semantics from the accessibility tree. The key reason: a screen reader announcing "table with 3 columns and 15 rows" when the table is actually a page layout is disorienting. The existence of layout tables is worth knowing about — legacy codebases still contain them — but new code should never need them. CSS Grid and Flexbox exist for layout.

### Part 2 — Interview Answer

Tables in HTML are for tabular data — information with meaningful row and column relationships. The structural elements — `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`, `<td>`, `<caption>` — each contribute to the accessibility tree. The most important distinction is simple versus complex tables. A simple table is one where every column header is in `<thead>` and applies uniformly to the cells below it, and every row header is in the first cell of a row and applies to the remaining cells. For those, `scope="col"` and `scope="row"` on `<th>` elements tell assistive technology which cells a header governs — no `id` or `headers` needed.

A complex table has irregular headers — maybe cells span multiple columns, or there are multiple header rows, or headers don't apply uniformly. For those, `scope` can't express the relationships. You put `id` attributes on each `<th>` and `headers` attributes on each `<td>` that reference the applicable header IDs. It's more verbose, but it's explicit — the assistive technology doesn't have to infer anything from position.

`<caption>` is the table's accessible name. A screen reader encountering a table with a `<caption>` announces it before entering the table — it's the equivalent of a heading. Use `<caption>` for visible table titles. Use `aria-label` on the `<table>` when you need an accessible name but don't want visible text.

Layout tables — using `<table>` for visual positioning rather than data — were a common pattern before CSS Grid and Flexbox. If you encounter one, `role="presentation"` strips the table semantics from the accessibility tree so screen readers don't announce table structure that isn't meaningful. But you should never create new layout tables.

### Part 3 — Code

<!-- ILLUSTRATIVE: table semantics and scope are screen-reader-observable, not unit-testable -->

```html
<!-- Simple table: scope-based association -->
<table>
  <caption>Quarterly Revenue by Department</caption>
  <thead>
    <tr>
      <th scope="col">Department</th>
      <th scope="col">Q1</th>
      <th scope="col">Q2</th>
      <th scope="col">Q3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Engineering</th>
      <td>$2.4M</td>
      <td>$2.7M</td>
      <td>$3.1M</td>
    </tr>
    <tr>
      <th scope="row">Marketing</th>
      <td>$1.1M</td>
      <td>$1.3M</td>
      <td>$1.0M</td>
    </tr>
  </tbody>
</table>
<!-- Screen reader: "Quarterly Revenue by Department, table, 3 columns,
     3 rows. Engineering row: Q1 $2.4M, Q2 $2.7M, Q3 $3.1M" -->
<!-- The scope attributes let the AT know which header applies to
     which cell — no ids needed for this shape -->
```

```html
<!-- Complex table: id + headers association -->
<table>
  <caption>Employee Schedule</caption>
  <thead>
    <tr>
      <th id="name">Name</th>
      <th id="mon" colspan="2">Monday</th>
      <th id="tue" colspan="2">Tuesday</th>
    </tr>
    <tr>
      <th></th>
      <th id="mon-am">AM</th>
      <th id="mon-pm">PM</th>
      <th id="tue-am">AM</th>
      <th id="tue-pm">PM</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th id="alice" headers="name">Alice</th>
      <td headers="alice mon mon-am">Standup</td>
      <td headers="alice mon mon-pm">Deep work</td>
      <td headers="alice tue tue-am">Review</td>
      <td headers="alice tue tue-pm">Meeting</td>
    </tr>
    <tr>
      <th id="bob" headers="name">Bob</th>
      <td headers="bob mon mon-am">Deep work</td>
      <td headers="bob mon mon-pm">Standup</td>
      <td headers="bob tue tue-am">Design</td>
      <td headers="bob tue tue-pm">Deep work</td>
    </tr>
  </tbody>
</table>
<!-- The headers attribute lists all applicable header ids for each cell.
     "alice mon mon-am" means this cell is in Alice's row, Monday's
     column group, and the AM sub-column. scope can't express this
     because Monday spans two sub-columns and the header relationship
     is non-uniform. -->
```

```html
<!-- Layout table: suppression pattern (legacy code) -->
<table role="presentation">
  <tr>
    <td>Logo</td>
    <td>Navigation</td>
  </tr>
  <tr>
    <td colspan="2">Main content</td>
  </tr>
</table>
<!-- role="presentation" strips the table semantics from the
     accessibility tree — no "table" announcement, no row/column
     structure. The content is read linearly. -->
<!-- New code should use CSS Grid or Flexbox for layout, not tables. -->
```

### Part 4 — Project Example

A data dashboard rendering a comparison table — like quarterly revenue or feature usage metrics — would use `<caption>` for the table title, `<th scope="col">` for column headers in `<thead>`, and `<th scope="row">` for row labels. The dashboard might also contain a layout section for the filter controls above the table — that section should use semantic elements, not a `<table role="presentation">`. If the table has merged cells (e.g., a department spanning multiple sub-teams), the `id`/`headers` pattern becomes necessary.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Uses `<table>` for page layout | Knows that layout tables existed because CSS was limited, but modern layout uses Grid/Flexbox — and legacy layout tables need `role="presentation"` |
| Only uses `<th>` in `<thead>` without `scope` | Understands that `<th>` without `scope` or `headers` doesn't communicate the header-cell relationship to assistive technology |
| Uses `<td>` for header cells because "they're not in the first row" | Knows that `<th>` is the correct element for any cell that serves as a header, regardless of position |
| Adds `aria-label` to a `<table>` when a visible `<caption>` exists | Knows that `<caption>` provides both visible and accessible labeling — `aria-label` is for cases where no visible label is desired |
| Ignores `colspan`/`rowspan` effects on header associations | Understands that spanning cells require `id`/`headers` because `scope` can't express non-uniform relationships |

### Part 6 — Follow-Up Q&A

**Q: When would you actually need `id` and `headers` instead of just `scope`?**

When the table has irregular header structure. If every column header applies uniformly to all cells in that column — a flat table with one header row — `scope="col"` handles it. The moment you have merged cells, multiple header rows, or headers that only apply to certain sub-sections, `scope` can't express the relationship. The classic example is a schedule: columns grouped under day headers with AM/PM sub-columns. Monday's AM cell is in Monday's column and the AM sub-column. A `<th id="mon-am">` with `<td headers="alice mon mon-am">` explicitly connects the data cell to both its row header and its two-level column header. No amount of `scope` can do that.

**Q: What happens if a table has no `<caption>` or `aria-label`?**

The table has no accessible name. The screen reader announces "table" and the number of rows and columns, but not what the table is about. It's like reading a chapter of a book with no title — you can read the content, but you don't know what you're reading until you're deep into it. Always provide a `<caption>` for data tables. The only exception is a layout table that has `role="presentation"` — but that shouldn't exist in new code anyway.

---

## 2. ARIA Basics in HTML Context

### Part 1 — Theory

ARIA — Accessible Rich Internet Applications — is a set of attributes that define ways to make web content and web applications more accessible to people with disabilities. It has four capabilities that native HTML doesn't provide:

1. **Define roles for widgets with no native equivalent.** A tree view, a tab panel, a combobox, a toolbar — these don't have native HTML elements. ARIA's `role` attribute tells assistive technology what the widget *is*. `role="tablist"`, `role="tab"`, `role="tabpanel"` define the semantics of a tab interface that `<div>`s alone cannot communicate.

2. **Communicate states that native HTML can't express.** `aria-expanded` tells assistive technology whether a section is open or closed — there's no native HTML attribute for that on a generic container. `aria-selected` communicates which tab in a tablist is active. `aria-checked` communicates checkbox state on a custom toggle. `aria-disabled` communicates disabled state while keeping the element focusable (unlike the native `disabled` attribute, which removes it from the tab order).

3. **Provide accessible names when a visible label isn't possible.** `aria-label` provides a name directly as a string. `aria-labelledby` references another element's text content as the name. Both create an accessible name without visible text — useful for icon buttons, compact controls, or situations where visual space is constrained.

4. **Create live regions for dynamic content.** `aria-live` on a container tells assistive technology to monitor it for changes and announce them. This is the mechanism behind form error announcements, status messages, and real-time updates.

**The first rule of ARIA** is precise: "If you can use a native HTML element or attribute with the semantics and behavior you require already built in, instead of repurposing an element and adding an ARIA role, state, or property to make it accessible, then do so." This is not "don't use ARIA." It's "prefer native HTML over ARIA when native HTML provides the semantics." A `<button>` is always better than a `<div role="button">` because the native button gives you keyboard behavior, focus management, and form submission for free. ARIA fills gaps — it doesn't replace native semantics.

The key attributes that appear in reading real HTML:

- **`aria-hidden="true"`** removes the element and all its descendants from the accessibility tree entirely. It does not hide the element visually — CSS does that. It removes it from what assistive technology can perceive. Critical rule: never put `aria-hidden="true"` on an element that is or contains a focusable element. The result is a divergence where the user can tab to something that the screen reader says doesn't exist — a severe accessibility failure. `aria-hidden` is not the same as `display: none` (which removes from both visual rendering and the accessibility tree) or `visibility: hidden` (which hides visually and from assistive technology but retains layout space).

- **`aria-expanded`** communicates whether a collapsible section is open (`"true"`) or closed (`"false"`). It goes on the trigger element, not the collapsible content. Assistive technology announces it as part of the trigger's state — "button, collapsed" or "button, expanded."

- **`aria-selected`** indicates which element in a set is currently selected. Used in tab lists, list boxes, and grids. The value is `"true"` on the selected element, `"false"` on unselected elements.

- **`aria-checked`** communicates checked state. Used on checkboxes, radio buttons, and toggle buttons. Can be `"true"`, `"false"`, or `"mixed"` for indeterminate checkboxes.

- **`aria-disabled`** communicates that an element is disabled while keeping it in the tab order and focusable. Unlike native `disabled`, which removes the element from focus entirely, `aria-disabled` lets assistive technology announce "disabled" while the user can still reach the element. Useful for form controls that are conditionally disabled based on other input.

- **`aria-label`** provides an accessible name directly as a string value. Use when a visible label isn't possible — icon buttons, toolbar controls. Not a replacement for visible `<label>` elements on form fields.

- **`aria-labelledby`** references another element's `id` to use its text content as the accessible name. Useful when the label is already visible elsewhere in the DOM — you avoid duplicating text.

- **`aria-describedby`** references another element's `id` to use its text content as an accessible description. The description is announced after the label and role. Common for error messages, help text, and format hints. (This is the attribute used in Session 10's accessible form pattern.)

- **`aria-required`** tells assistive technology that a form field is required. Functionally equivalent to the native `required` attribute for accessibility purposes, but doesn't trigger the browser's constraint validation. Use `required` (which does both) unless you need the accessibility signal without the validation behavior.

- **`aria-invalid`** tells assistive technology that a form field has a validation error. No native HTML attribute does this — `aria-invalid="true"` is the mechanism for communicating error state to screen readers after failed validation.

### Part 2 — Interview Answer

ARIA is the semantic layer that fills gaps native HTML can't cover. It does four things: define roles for widgets that have no native equivalent, communicate states that native HTML can't express, provide accessible names when visible labels aren't possible, and create live regions for dynamic content updates. The first rule of ARIA says: if a native HTML element provides the semantics and behavior you need, use it. Don't add `role="button"` to a `<div>` when `<button>` exists. ARIA is for gaps, not replacements.

When you read HTML in the wild, the ARIA attributes you'll encounter most are `aria-hidden`, `aria-expanded`, `aria-selected`, `aria-checked`, `aria-disabled`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-required`, and `aria-invalid`. Each one does something specific to the accessibility tree.

`aria-hidden="true"` is the one to get exactly right. It removes the element and all descendants from the accessibility tree. It does not hide the element visually — that's CSS. The dangerous case is putting it on a focusable element or a container with focusable children. The user can still tab to it, but the screen reader says nothing exists there. That's a severe failure mode. `aria-hidden` is also not `display: none` — that removes from both visual rendering and the accessibility tree. And it's not `visibility: hidden` — that hides visually and from assistive technology but retains layout space.

`aria-expanded` goes on the trigger, not the collapsible content. `aria-selected` goes on the active element in a set. `aria-checked` supports three states: `"true"`, `"false"`, and `"mixed"` for indeterminate checkboxes. `aria-disabled` differs from native `disabled` in one important way: it keeps the element focusable. Native `disabled` removes the element from the tab order entirely, which can make it impossible for a keyboard user to even reach the control to understand why it's disabled.

For accessible names, `aria-label` provides a name directly, `aria-labelledby` references another element's text. Both work without visible text, but a visible `<label>` is almost always better for cognitive accessibility. `aria-describedby` provides a description that's announced after the label and role — this is where error messages and help text live. `aria-required` and `aria-invalid` communicate required state and error state to assistive technology, filling gaps that native HTML attributes don't fully cover.

### Part 3 — Code

<!-- ILLUSTRATIVE: ARIA attribute effects are screen-reader-observable, not unit-testable -->

```html
<!-- aria-hidden: removes from accessibility tree, not from visual rendering -->
<div class="icon-wrapper" aria-hidden="true">
  <!-- Icons, decorative images, redundant text -->
  <svg><!-- complex SVG icon --></svg>
</div>
<!-- Screen reader: skips this entirely -->
<!-- Visual user: sees the icon normally -->

<!-- DANGER: aria-hidden on a focusable element -->
<button aria-hidden="true">Click me</button>
<!-- User can tab to this, but screen reader says nothing exists -->
<!-- This is a severe accessibility failure -->

<!-- CORRECT: use display:none or remove from DOM instead -->
<button style="display: none;">Click me</button>
<!-- Not focusable, not visible, not in accessibility tree -->
```

```html
<!-- aria-expanded on a trigger, not on the collapsible content -->
<button aria-expanded="false" aria-controls="dropdown-menu">
  Options
</button>
<ul id="dropdown-menu" hidden>
  <li>Edit</li>
  <li>Delete</li>
  <li>Share</li>
</ul>

<script>
  const trigger = document.querySelector('[aria-expanded]');
  const menu = document.getElementById('dropdown-menu');

  trigger.addEventListener('click', () => {
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!isExpanded));
    menu.hidden = isExpanded;
  });
</script>
<!-- Screen reader on the button: "Options, button, collapsed"
     After click: "Options, button, expanded" -->
```

```html
<!-- aria-disabled keeps element focusable; native disabled does not -->
<!-- Native disabled: removed from tab order entirely -->
<button disabled>Cannot click</button>
<!-- User cannot tab to this -->

<!-- aria-disabled: still focusable, announced as disabled -->
<button aria-disabled="true">Processing...</button>
<!-- User can tab to this, hears "Processing, button, disabled" -->
<!-- Useful when the button will become enabled after an async operation -->
```

```html
<!-- aria-label provides accessible name without visible text -->
<button aria-label="Close dialog">
  <svg><!-- X icon --></svg>
</button>
<!-- Screen reader: "Close dialog, button" -->
<!-- Visual user: sees an X icon -->

<!-- aria-labelledby references another element's text -->
<section aria-labelledby="section-title">
  <h2 id="section-title">Account Settings</h2>
  <p>Content here...</p>
</section>
<!-- Screen reader: announces "Account Settings" as the section's name -->

<!-- aria-describedby provides a description (announced after label/role) -->
<label for="password">Password</label>
<input
  type="password"
  id="password"
  aria-describedby="password-help"
>
<span id="password-help">At least 8 characters with one number</span>
<!-- Screen reader: "Password, edit text, At least 8 characters
     with one number" — label, then description -->
```

### Part 4 — Project Example

A settings panel with collapsible sections would use `aria-expanded` on each section's toggle button, `aria-controls` pointing to the collapsible content's `id`, and `aria-hidden` on decorative icons. Form fields within the panel would use `aria-describedby` for help text and `aria-invalid` for validation errors — the same pattern from Session 10. A custom toggle switch that needs to remain focusable during loading would use `aria-disabled` rather than the native `disabled` attribute.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Uses `role="button"` on a `<div>` when `<button>` exists | Knows that the first rule of ARIA says to prefer native HTML when it provides the semantics — a `<button>` gives you keyboard activation, focus management, and form behavior for free |
| Puts `aria-hidden="true"` on a focusable element to "hide it" | Knows that `aria-hidden` on focusable elements creates a divergence where the user tabs to something AT says doesn't exist |
| Uses `aria-label` on form fields instead of visible `<label>` | Understands that `aria-label` provides no visible pairing for cognitive accessibility — use it only when a visible label genuinely can't be shown |
| Adds `aria-expanded` to the collapsible content | Knows that `aria-expanded` goes on the trigger element, not the content it controls |
| Uses `aria-disabled` when native `disabled` would work | Knows that `aria-disabled` is for cases where you need focusable-but-disabled — if you don't need the user to reach it, native `disabled` is simpler and also prevents form submission |

### Part 6 — Follow-Up Q&A

**Q: When would you use `aria-disabled` instead of native `disabled`?**

When the element needs to stay in the tab order while disabled. A submit button processing an async request is the classic case — the user should be able to tab to it to understand what it's doing, and the screen reader should announce "disabled" so they know it's not currently active. Native `disabled` removes the element from the tab order entirely, which means a keyboard user can't reach it. They tab past it and might not understand why they can't submit. `aria-disabled` keeps it focusable while communicating the disabled state. The tradeoff: you're responsible for preventing activation yourself — native `disabled` blocks form submission and click events automatically, `aria-disabled` does not.

**Q: What's the difference between `aria-labelledby` and `aria-describedby`?**

Both reference other elements by `id`. The difference is semantic priority. `aria-labelledby` provides the accessible *name* — the primary identification of the element. `aria-describedby` provides the accessible *description* — supplementary information announced after the name and role. A form field's label is its name. Its help text is its description. You can use both on the same element: `aria-labelledby` for the label, `aria-describedby` for the help text. The screen reader announces them in order: name, role, description.

---

## 3. Live Regions

### Part 1 — Theory

Live regions solve a specific problem: dynamic content changes in the DOM don't get announced to assistive technology by default. If you inject an error message into a `<span>` after a form validation fails, a screen reader won't announce it — the screen reader doesn't know the DOM changed. Live regions tell assistive technology to monitor a container for content changes and announce them when they occur.

The core attributes:

- **`aria-live`** sets the announcement timing. `"polite"` waits for the user to be idle before announcing — it won't interrupt what they're currently doing. `"assertive"` interrupts immediately — it stops whatever the screen reader is currently saying and announces the change right away.

- **`role="status"`** implies `aria-live="polite"` and `aria-atomic="true"`. It's the mechanism for non-urgent status updates: "Form saved," "3 results found," "Loading complete." The `aria-atomic="true"` means the entire content of the region is announced, not just the changed part.

- **`role="alert"`** implies `aria-live="assertive"` and `aria-atomic="true"`. It's for errors and critical messages that need immediate attention. "Invalid email address," "Payment failed," "Session expired in 2 minutes."

- **`aria-atomic`** controls whether the whole region is announced or just the changed text. `"true"` announces the entire content. `"false"` (the default) announces only the part that changed.

- **`aria-relevant`** controls which types of changes are announced. `"additions"` announces new nodes. `"removals"` announces removed nodes. `"text"` announces text content changes. The default is `"additions text"`.

**The empty-container-first rule:** the live region container must exist in the DOM *before* content is injected into it. If you dynamically create an element with `role="alert"` and content already in it in the same DOM mutation, the screen reader will not announce it. The container must be in the DOM first, empty, and then the content gets added in a separate mutation. This is a timing issue in the accessibility tree construction — assistive technology registers the live region when the node appears, and only monitors for *subsequent* changes.

This rule has a concrete implementation pattern. Create the element with the role but no content. Append it to the DOM. Then update its text content in a separate operation:

```typescript
// CORRECT: container exists first, content added after
const status = document.createElement('div');
status.setAttribute('role', 'status');
document.body.appendChild(status); // container is now in the DOM

// Later, in a separate operation:
status.textContent = 'Form saved successfully'; // announced by AT
```

```typescript
// WRONG: container and content created together
const status = document.createElement('div');
status.setAttribute('role', 'status');
status.textContent = 'Form saved successfully'; // may NOT be announced
document.body.appendChild(status);
```

**When to use each pattern:**

Use `role="status"` for non-urgent updates: form saved, search results count, loading complete, upload progress. These can wait for the user to pause.

Use `role="alert"` for errors and critical messages that need immediate attention: validation errors, payment failures, session timeouts. These interrupt the user — use them sparingly.

Use `aria-live="polite"` directly when you need fine-grained control that `role="status"` doesn't provide — for instance, when you want `aria-atomic="false"` to only announce the changed part.

Use `aria-live="assertive"` directly very rarely. It interrupts whatever the screen reader is currently saying. Reserve it for truly critical situations — a security warning, an irreversible action confirmation.

### Part 2 — Interview Answer

Live regions bridge the gap between dynamic DOM changes and assistive technology announcements. When content changes in the DOM, screen readers don't automatically announce it — you need `aria-live` or a role that implies it to tell assistive technology to monitor a container for changes.

The two patterns most developers need are `role="status"` and `role="alert"`. `role="status"` implies `aria-live="polite"` — it waits for the user to be idle before announcing. That's for non-urgent updates: form saved, search results loaded, upload complete. `role="alert"` implies `aria-live="assertive"` — it interrupts immediately. That's for errors and critical messages: validation failures, payment errors, session expiring.

The junior mistake is reaching for `role="alert"` for everything dynamic. That creates a noisy experience where the screen reader constantly interrupts the user with non-urgent updates. The senior distinction is urgency: non-urgent goes to `role="status"`, critical goes to `role="alert"`. `aria-live="assertive"` should be used sparingly — it's the loudest voice in the room.

The critical implementation detail is the empty-container-first rule. The live region container must exist in the DOM before you inject content into it. If you create a `<div role="alert">` and set its text content in the same DOM operation, assistive technology may not announce it. The container needs to be registered first, empty, and then the content update happens separately. This is the most common bug in live region implementations — the developer writes correct HTML and JavaScript, but the timing is wrong and the announcement never fires.

The other attributes — `aria-atomic` and `aria-relevant` — are fine-tuning. `aria-atomic="true"` means the whole region is announced, not just the changed text. `aria-relevant` controls whether additions, removals, or text changes trigger announcements. Most of the time, the defaults work.

### Part 3 — Code

<!-- ILLUSTRATIVE: live region announcements are screen-reader-observable, not unit-testable -->

```html
<!-- role="status" for non-urgent updates (polite) -->
<div id="search-results" role="status" aria-atomic="true">
  <!-- Empty on page load -->
</div>

<script>
  function updateResults(count) {
    const el = document.getElementById('search-results');
    el.textContent = `${count} results found`;
    // Screen reader (when idle): "3 results found"
  }
</script>
<!-- The container exists in the DOM first, empty.
     When updateResults() runs, the content changes and AT announces. -->
```

```html
<!-- role="alert" for errors (assertive, interrupts) -->
<span id="form-error" role="alert" aria-atomic="true">
  <!-- Empty on page load -->
</span>

<script>
  function showError(message) {
    const el = document.getElementById('form-error');
    el.textContent = message;
    // Screen reader (immediately): "Invalid email address"
  }
</script>
<!-- assertive interrupts whatever the user is currently doing.
     Reserve for actual errors, not status updates. -->
```

```typescript
// Empty-container-first rule: correct vs incorrect
// CORRECT
function announceSaved() {
  const status = document.getElementById('save-status')!;
  // Container already in DOM, just update text
  status.textContent = 'Form saved';
}
```

```html
<!-- CORRECT: container exists in DOM before content -->
<div id="save-status" role="status"></div>

<!-- WRONG: creating container and content in one operation -->
<script>
  // This may not be announced because AT didn't register
  // the live region before the content appeared
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = 'Form saved';
  document.body.appendChild(el);
</script>
```

```html
<!-- aria-atomic: announce the whole region vs just the change -->
<div role="status" aria-atomic="true">
  <span id="progress">50%</span> complete
</div>
<!-- With aria-atomic="true": "50% complete" (whole region) -->
<!-- Without aria-atomic: "50%" (just the changed text) -->

<!-- Combining status + describedby for richer announcements -->
<div role="status" aria-live="polite">
  <span id="status-text">Uploading...</span>
  <span id="status-detail" aria-describedby="status-text">
    3 of 7 files
  </span>
</div>
```

### Part 4 — Project Example

A file upload component would use `role="status"` for progress updates ("Uploading file 3 of 7"), `role="alert"` for errors ("Upload failed — file too large"), and `aria-live="polite"` on a results container that updates as files complete. The key implementation detail: all these containers exist in the DOM on page load, empty, and their text content gets updated as the upload progresses. A form with inline validation would use `role="alert"` on error message containers that start empty and get populated on validation failure — the same pattern from Session 10.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Uses `role="alert"` for every dynamic update | Distinguishes non-urgent status (`role="status"`) from critical errors (`role="alert"`) based on whether the update interrupts the user's task |
| Creates live region containers with content in the same DOM operation | Knows the empty-container-first rule: the container must exist in the DOM before content is injected for AT to register it |
| Uses `aria-live="assertive"` for form saved messages | Knows that assertive interrupts the user's current task and should be reserved for genuinely critical messages |
| Adds `aria-live` to a container with hundreds of lines of content | Understands that `aria-atomic="true"` announces the entire region — keep live regions small and focused |
| Omits `aria-atomic` and gets partial announcements | Knows that without `aria-atomic="true"`, only the changed text is announced, which may be meaningless out of context |

### Part 6 — Follow-Up Q&A

**Q: Why does the empty-container-first rule exist? What's actually happening in the accessibility tree?**

When assistive technology encounters a node with `aria-live` or an implied live region role, it registers that node as a live region and starts monitoring it for changes. If the node appears in the DOM with content already present, the screen reader treats that content as the initial state — not as a change worth announcing. It's only when the content changes *after* registration that the announcement fires. Creating the container and content in the same DOM mutation means AT may register the node and its initial content simultaneously, treating everything as baseline. The separate-mutation approach — append empty container, then update text — ensures AT registers the empty container first and sees the text injection as a change.

**Q: When would you use `aria-relevant` instead of the defaults?**

The default `aria-relevant` value is `"additions text"` — it announces new nodes and text changes, but not removals. You'd override this in a chat application where messages get deleted, or a notification list where items are dismissed. Setting `aria-relevant="additions removals text"` ensures the screen reader announces when a message is removed from the conversation. In most applications, the defaults are correct.

---

## 4. Tie the Chain Together

Tables are structured data presented with explicit header-cell associations that assistive technology can traverse. The `<th>` element with `scope` (simple tables) or `id`/`headers` (complex tables) creates the mapping between headers and data cells. `<caption>` provides the table's accessible name. Layout tables suppress these semantics with `role="presentation"`.

ARIA is the semantic layer that fills gaps native HTML can't cover. It defines widget roles for custom components, communicates dynamic states like expanded and selected, provides accessible names without visible text, and creates live regions for dynamic content. The first rule says: use native HTML when it provides the semantics — ARIA is for gaps.

Live regions are the bridge between dynamic DOM changes and assistive technology announcements. `role="status"` handles non-urgent updates. `role="alert"` handles critical errors. The empty-container-first rule ensures the container is registered before content triggers an announcement.

Session 12 (browser parsing → DOM construction) continues Module 2 by going under the HTML surface to how the browser actually processes it — the parser, the DOM tree, script loading, and why `defer` and `async` exist.

---

*End of Session 11. Tables give you structured data semantics with explicit header-cell associations. ARIA fills the gaps native HTML can't cover. Live regions bridge dynamic DOM changes and assistive technology announcements. Together, they form the semantic layer that makes HTML work for everyone — not just visual users.*
