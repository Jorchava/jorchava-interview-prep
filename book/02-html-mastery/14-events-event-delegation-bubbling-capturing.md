# Events, Event Delegation, and Bubbling/Capturing

> How events traverse the composed DOM that Session 13 established —
> capture phase down through the tree, target phase at the element, bubble
> phase back up — and how developers use that traversal for delegation,
> interception, and shadow boundary management. Session 13
> (`02-html-mastery/13-shadow-dom-web-components-encapsulation.md`)
> described the composed DOM: the flattened tree the browser renders when
> shadow trees and light DOM compose for painting. Events traverse that
> same composed tree. Session 5
> (`01-javascript-mastery/05-event-loop-microtasks-macrotasks.md`)
> established that event handlers are macrotask callbacks — they run when
> the event loop lifts them from the task queue onto the empty stack. This
> session is the DOM side of that story: how the browser decides which
> handlers to call, in what order, and across which tree boundaries.

---

## 1. The Event Propagation Model

### Part 1 — Theory

When an event fires on an element, it doesn't just run the handler on
that element. It travels through the DOM in three phases: capture, target,
and bubble. The phases exist because the DOM is a tree, and the browser
needs a deterministic way to decide which ancestors get to see the event,
in what order, and whether they can intercept it before it reaches the
target.

**Capture phase** runs first. The browser walks from the `document` root
down to the target element, calling capture-phase handlers along the way.
A capture handler registered on `document` fires before a capture handler
on `div`, which fires before one on `li`. The purpose: intercept the
event before it reaches the target. The real use cases are narrow but
genuine — modal focus trapping (a capture handler on the modal container
intercepts every click before it reaches any button inside), centralized
event logging (a capture handler on `document` sees every click on the
page), and global keyboard shortcuts (a capture handler on `window` for
`keydown` before any input field sees it). Capture is not the default
because most handlers don't need to fire before the target — they need to
fire on the target or in response to something the target did.

**Target phase** runs when the event reaches the element it was
dispatched on. Both capture and bubble handlers on the target element
fire, in registration order. There is no phase distinction on the target
itself — the browser calls all handlers for that element regardless of
which phase they registered for.

**Bubble phase** runs last. The event travels back up from the target to
the `document` root, calling bubble-phase handlers along the way. This is
the default phase — the one `addEventListener` registers for when you
don't pass a third argument. Bubbling is what makes event delegation
possible: a handler on a parent sees events from every descendant, because
those events bubble up through the ancestor chain.

The registration API is simple: `addEventListener(type, handler)` or
`addEventListener(type, handler, false)` registers for the bubble phase.
`addEventListener(type, handler, true)` or `addEventListener(type,
handler, { capture: true })` registers for the capture phase. The
`{ capture: false }` form is identical to the no-argument form. The
boolean form (`true`/`false`) is the legacy syntax; the object form is
the modern one.

### Part 2 — Interview Answer

When an event fires, it doesn't just run the handler on the target element.
It travels through the DOM in three phases: capture, target, and bubble.
Capture runs first — the event walks from the document root down to the
target, and every capture-phase handler it passes gets called. This is the
phase where you intercept events before they reach the target: modal focus
trapping, global keyboard shortcuts, centralized event logging. Then the
target phase fires all handlers on the target element itself, in
registration order, regardless of which phase they registered for. Then
bubble runs — the event travels back up to the document root, calling
bubble-phase handlers on each ancestor along the way.

The default is bubble. `addEventListener('click', handler)` registers a
bubble-phase handler. You register for capture with the third argument:
`addEventListener('click', handler, true)` or `{ capture: true }`. Most
handlers are bubble-phase because they care about what happened on a
descendant, not about intercepting the event on its way down. Capture is
for the cases where you need to see the event before the target does.

The practical mental model: capture is the trip down, bubble is the trip
back up, and the target is the destination. Events don't skip phases — a
click on a `<span>` inside a `<div>` inside the `<body>` fires capture
handlers on `document`, `body`, and `div` in that order, then the target
handlers on `span`, then bubble handlers on `div`, `body`, and `document`.
The full traversal is part of the event's lifecycle, not an optional
behavior — and it applies to every DOM event, not just clicks.

### Part 3 — Whiteboard / Live Coding

Demonstrate capture and bubble on the same hierarchy, showing the exact
firing order:

```html
<!-- ILLUSTRATIVE — event propagation observable in browser DevTools -->
<ol id="list">
  <li><a href="#">Item 1</a></li>
  <li><a href="#">Item 2</a></li>
</ol>
```

```javascript
// ILLUSTRATIVE — not runnable in Node/jsdom
const list  = document.getElementById('list');
const first = list.querySelector('li');
const link  = first.querySelector('a');

// Capture phase handlers (third argument: true)
document.addEventListener('click', () => {
  console.log('1. document — capture');
}, true);

list.addEventListener('click', () => {
  console.log('2. ol — capture');
}, true);

// Bubble phase handlers (default)
list.addEventListener('click', () => {
  console.log('3. ol — bubble');
});

document.addEventListener('click', () => {
  console.log('4. document — bubble');
});

// Click on the <a> inside the first <li>
```

The console output when clicking "Item 1":

```
1. document — capture
2. ol — capture
3. ol — bubble
4. document — bubble
```

The `<li>` and `<a>` have no handlers in this example, but if they did,
the capture handlers on `<li>` and `<a>` would fire between steps 2 and
3, and the bubble handlers on `<a>` and `<li>` would fire between steps
3 and 4 — the event visits every ancestor in both directions.

Now add a capture handler on the link to show how it intercepts before
the bubble handlers on ancestors:

```javascript
// ILLUSTRATIVE — capture handler on the target intercepts first
link.addEventListener('click', (e) => {
  console.log('link — capture (target phase, but registered for capture)');
}, true);

link.addEventListener('click', (e) => {
  console.log('link — bubble (target phase, registered for bubble)');
});
```

Updated output:

```
1. document — capture
2. ol — capture
3. link — capture        ← target phase, capture-registered
4. link — bubble         ← target phase, bubble-registered
5. ol — bubble
6. document — bubble
```

On the target element itself, both capture and bubble handlers fire in
registration order. The phase distinction is meaningless on the target —
the browser calls them all.

### Part 4 — Follow-Up Questions

**Q: Does every DOM event propagate through all three phases?**

No. Events dispatched with `event.stopPropagation()` during the capture
phase never reach the bubble phase. And events dispatched with
`event.stopPropagation()` during the bubble phase never reach ancestors
above the current handler. But events that propagate normally go through
all three phases: capture, target, bubble. The one exception is events
that don't compose — some events dispatched inside shadow DOMs (like
`focus` and `blur`) don't bubble and don't cross shadow boundaries, so
their traversal is limited. Composed events (`click`, `keydown`, `input`)
do traverse all three phases across the composed DOM.

**Q: Can you have both capture and bubble handlers on the same element?**

Yes, and that's exactly what the Part 3 example demonstrated. Both
handlers fire during the target phase, in the order they were registered.
The phase distinction only matters for ancestor elements — on the target
itself, the browser calls all handlers for that event type, regardless of
phase.

**Q: Why would you ever use capture?**

Three real cases. First, modal focus trapping: a capture handler on the
modal container intercepts every click and checks whether focus should
stay trapped inside the modal — before any button handler fires. Second,
centralized event logging: a capture handler on `document` sees every
click on the page, which is useful for analytics and debugging. Third,
global keyboard shortcuts: a capture handler on `window` for `keydown`
fires before any input field consumes the event. In each case, the
handler needs to run before the target sees the event — which is
exactly what capture is for.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| "Events bubble up from the target to the root" — describes only bubble | Names all three phases: capture (root → target), target, bubble (target → root) |
| "Capture is the same as bubble but in reverse" — vague | Capture is for interception before the target; bubble is for reacting after. Different use cases, not just different directions |
| Never uses capture | Knows the three cases where capture is the right tool: focus trapping, event logging, global shortcuts |

### Part 6 — Production Examples

**Real incident — focus trap missing capture phase:** A modal dialog
implemented focus trapping with a bubble-phase `click` handler on the
modal container. When a user clicked a link outside the modal, the link's
default navigation action fired before the bubble handler on the modal
could prevent it — the user navigated away from the page instead of the
modal catching the click. The fix was switching to a capture-phase
handler on the modal container that called `event.preventDefault()` and
`event.stopPropagation()` before the click reached the link. The lesson:
focus traps need capture because they must intercept the event before the
target element's handler runs.

**Real incident — analytics missing delegated clicks:** An analytics
library attached capture-phase handlers on `document` to log every click
on the page. A product team added `event.stopPropagation()` to a tooltip
component's bubble-phase handler to prevent clicks from reaching
ancestors after the tooltip opened. The analytics library stopped seeing
clicks on tooltip-triggered elements because `stopPropagation()` in the
bubble phase also prevented the event from reaching ancestors that the
capture handler on `document` would have seen — but the capture handler
on `document` fires *before* the bubble handler on the tooltip, so it
should have caught them. The actual problem was that the tooltip called
`event.stopPropagation()` during the *capture* phase on `document`,
blocking its own analytics handler. The fix was moving the tooltip's
propagation control to the bubble phase. The lesson: capture handlers see
the event first, and `stopPropagation` in capture blocks everything
downstream.

---

## 2. stopPropagation, stopImmediatePropagation, and preventDefault

### Part 1 — Theory

Three distinct methods control event behavior, and the junior answer
conflates them. They do different things, they affect different parts of
the event lifecycle, and they can be combined.

**`event.stopPropagation()`** stops the event from propagating further
in the current direction. In the capture phase, it prevents the event
from reaching deeper ancestors (and eventually the target). In the bubble
phase, it prevents the event from reaching ancestors above the current
handler. Critically, **other handlers on the same element still fire**. If
an `<li>` has two bubble-phase click handlers, and the first one calls
`stopPropagation()`, the second one still runs. The event just doesn't
continue up to the `<ul>`. This is the most commonly misused of the three
— developers think it stops all handlers, but it only stops propagation to
ancestors/siblings, not handlers on the same element.

**`event.stopImmediatePropagation()`** does everything `stopPropagation()`
does — stops the event from traveling further — **and** prevents other
handlers on the same element from firing. If an `<li>` has three
bubble-phase click handlers, and the first one calls
`stopImmediatePropagation()`, the second and third never run. Handlers
fire in registration order, so the first handler gets to decide whether
any subsequent handler on the same element runs. This is the nuclear
option: it silences every handler downstream, including same-element
handlers. Use it for priority handlers that must run first and must be
able to veto subsequent handlers on the same element.

**`event.preventDefault()`** cancels the browser's default action for the
event. It does **not** stop propagation — the event continues through all
three phases and all handlers still fire. A click on a link calls
`preventDefault()` to stop navigation, but every handler on every ancestor
still runs. A form submit calls `preventDefault()` to stop the HTTP
request, but the event still propagates. The default action is
browser-specific: for `click` on `<a>`, it's navigation; for `submit` on
`<form>`, it's form submission; for `keydown` on an input, it's character
insertion. `preventDefault()` cancels that specific action. The event
itself continues unaffected.

The key distinction: `stopPropagation` and `stopImmediatePropagation`
control whether other handlers see the event. `preventDefault` controls
whether the browser performs its default behavior. They are orthogonal —
you can use any combination.

### Part 2 — Interview Answer

Three methods control event behavior, and they do three different things.
`stopPropagation()` stops the event from traveling further up (or down)
the DOM — but other handlers on the same element still fire. If two
handlers are on the same `<li>` and the first calls `stopPropagation()`,
the second still runs. The event just doesn't reach the `<ul>`. This is
the most commonly misused of the three — people think it stops all
handlers, but it only stops propagation.

`stopImmediatePropagation()` goes further. It stops propagation like the
first method, and it also prevents other handlers on the same element
from firing. If three handlers are on the same `<li>` and the first calls
`stopImmediatePropagation()`, the other two never run. Handlers execute in
registration order, so the first handler gets to veto everything that
follows on the same element. This is the priority mechanism — use it when
one handler must run before others and must be able to silence them.

`preventDefault()` does something entirely different. It cancels the
browser's default action — following a link, submitting a form, inserting
a character — but it does not stop propagation. The event still travels
through all three phases, and every handler on every ancestor still fires.
You can call `preventDefault()` and `stopPropagation()` together or
separately — they're orthogonal controls.

The senior answer names the three as distinct tools and knows what each
one actually blocks. The junior answer says "I use `stopPropagation` to
prevent the default action" — which is wrong; `preventDefault` does that.
Or "I use `stopImmediatePropagation` to stop the event from bubbling" —
which is technically true but misses the same-element silencing that
distinguishes it from plain `stopPropagation`.

### Part 3 — Whiteboard / Live Coding

Demonstrate each method's effect as separate cases:

```html
<!-- ILLUSTRATIVE — three distinct methods, observable in browser DevTools -->
<ol id="controls-demo">
  <li><a href="https://example.com">Navigate</a></li>
  <li><button type="submit">Submit</button></li>
</ol>
```

**Case 1: `stopPropagation` — event stops traveling, same-element
handlers still fire:**

```javascript
// ILLUSTRATIVE — not runnable in Node/jsdom
const list = document.getElementById('controls-demo');
const link = list.querySelector('a');

link.addEventListener('click', () => {
  console.log('link handler 1');
});

link.addEventListener('click', (e) => {
  console.log('link handler 2 — calling stopPropagation');
  e.stopPropagation();
});

list.addEventListener('click', () => {
  console.log('ol handler — this never runs');
});
```

Output when clicking the link:

```
link handler 1
link handler 2 — calling stopPropagation
```

Handler 2 stops propagation — the `ol` handler never fires. But handler
1 already ran because `stopPropagation` doesn't affect same-element
handlers that registered before it.

**Case 2: `stopImmediatePropagation` — same-element handlers silenced:**

```javascript
// ILLUSTRATIVE
link.addEventListener('click', (e) => {
  console.log('handler 1 — calling stopImmediatePropagation');
  e.stopImmediatePropagation();
});

link.addEventListener('click', () => {
  console.log('handler 2 — never runs');
});

list.addEventListener('click', () => {
  console.log('ol handler — never runs');
});
```

Output:

```
handler 1 — calling stopImmediatePropagation
```

Handler 2 on the same element and the `ol` handler are both silenced.
The event stops propagating *and* subsequent same-element handlers are
blocked.

**Case 3: `preventDefault` — default action cancelled, propagation
continues:**

```javascript
// ILLUSTRATIVE
link.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('link clicked, navigation prevented');
});

list.addEventListener('click', () => {
  console.log('ol handler — still fires');
});

document.addEventListener('click', () => {
  console.log('document handler — still fires');
});
```

Output:

```
link clicked, navigation prevented
ol handler — still fires
document handler — still fires
```

The navigation is cancelled but the event propagates through every
ancestor. `preventDefault` and propagation are orthogonal.

### Part 4 — Follow-Up Questions

**Q: Can you call `stopPropagation()` and `preventDefault()` on the same
event?**

Yes, and they do independent things. `stopPropagation()` prevents the
event from reaching ancestors; `preventDefault()` prevents the browser's
default action. A common pattern: a link inside a modal calls
`preventDefault()` (don't navigate) and `stopPropagation()` (don't close
the modal via a document-level click handler that interprets any click as
a close action). Both controls apply, each blocking its own concern.

**Q: Does `stopPropagation` in the capture phase prevent bubble handlers
from firing?**

Yes — if you call `stopPropagation()` on a capture handler on `document`,
the event never reaches the target, so no bubble handlers on any ancestor
fire. The event's journey is cut short during the capture phase. If you
call it on a capture handler on `div` (between `document` and the
target), the event never reaches the target from `div`'s children — but
`div` itself has already seen the capture handler, and if `div` has bubble
handlers, they won't fire because the event never reached the target and
bubbled back.

**Q: What is the default action for each common event type?**

`click` on `<a href>`: navigation to the URL. `submit` on `<form>`: form
submission via HTTP. `keydown`/`keypress` on editable elements: character
insertion. `contextmenu`: the browser's context menu appearing. `mousedown`
on a link in some browsers: link activation. The default action is
browser-specific and event-specific — `preventDefault()` cancels whatever
the browser would have done for that event type on that element.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Uses `stopPropagation` to prevent the browser's default action | Uses `preventDefault` for default actions; `stopPropagation` only controls handler visibility |
| Thinks `stopPropagation` silences all handlers on the element | Other handlers on the same element still fire — only `stopImmediatePropagation` silences same-element handlers |
| Never uses `stopImmediatePropagation` | Knows when a priority handler needs to veto subsequent same-element handlers |
| Uses `stopImmediatePropagation` to prevent navigation | Overkill — `preventDefault` is the right tool; `stopImmediatePropagation` also silences same-element handlers unnecessarily |

### Part 6 — Production Examples

**Real incident — `stopPropagation` breaking a delegated close handler:** A
dropdown component used a document-level click handler to close any open
dropdown when the user clicked outside. The dropdown button's own click
handler called `event.stopPropagation()` to prevent the click from
reaching the document — which worked for closing, but also prevented
other document-level handlers from seeing the event, including a
global analytics handler. The fix was removing `stopPropagation()` and
instead checking `event.target.closest('.dropdown')` in the document
handler to decide whether to close. The lesson: `stopPropagation` has
blast radius beyond your component — it affects every handler above you
in the DOM.

**Real incident — `preventDefault` not stopping event propagation:** A
form component called `event.preventDefault()` in the submit handler to
stop the HTTP request, but another handler higher in the DOM called
`event.stopPropagation()` only when the event had *not* been default-
prevented — a logic inversion that let the submit event propagate to a
reset handler on the form's parent, which cleared all the fields. The
team expected `preventDefault` to stop the event's journey; it doesn't.
The fix was checking `event.defaultPrevented` in the parent handler and
bailing out. The lesson: `preventDefault` and propagation are orthogonal —
knowing that distinction prevents this exact class of bug.

---

## 3. Event Delegation

### Part 1 — Theory

Event delegation is a memory optimization that uses bubbling as a feature.
Instead of attaching one event handler to each of N child elements, you
attach a single handler to a parent. When any child fires the event, it
bubbles up to the parent, and the handler identifies which child
dispatched it using `event.target`.

The pattern: a `<ul>` with 1000 `<li>` items. Instead of 1000 click
handlers, one handler on the `<ul>`. When a user clicks an `<li>`, the
click event fires on the `<li>`, bubbles up to the `<ul>`, and the
handler checks `event.target` to determine which item was clicked. Memory
usage drops from O(N) handlers to O(1), and new items added to the list
automatically work without wiring up new handlers.

Two properties matter and they're not interchangeable. **`event.target`**
is the element that actually dispatched the event — the element the user
clicked on. If you click a `<span>` inside an `<li>`, `event.target` is
the `<span>`, not the `<li>`. **`event.currentTarget`** is the element
the handler is attached to — the `<ul>` in this example. Delegation
relies on `event.target`, not `event.currentTarget`, because you need to
identify which child was clicked.

The defensive idiom is **`.closest()`**. A click on a `<span>` inside an
`<li>` gives you `event.target` = `<span>`, but you want the `<li>`.
`event.target.closest('li')` traverses up from the `<span>` until it
finds the nearest `<li>` ancestor — or returns `null` if none exists.
`.closest()` is the idiomatic tool for delegation because it handles
nested markup gracefully: the user might wrap content in `<span>` or
`<em>` tags for styling, and `.closest()` finds the delegated item
regardless of the inner markup.

**The tradeoff**: `stopPropagation()` called on a child event prevents
the delegated handler from ever seeing it. If a button inside your
delegated list calls `stopPropagation()`, the parent's handler never
fires for that click. This is the real downside of delegation — you
depend on the event reaching the parent, and any child handler that stops
propagation silently breaks your delegation. You also need defensive
checking: `event.target` might be a nested element, so you always use
`.closest()` rather than assuming `event.target` is the delegated item.

### Part 2 — Interview Answer

Event delegation uses bubbling as a feature. Instead of attaching N
handlers to N children, you attach one handler to a parent. When any child
fires the event, it bubbles up to the parent, and you use `event.target`
to identify which child dispatched it. A `<ul>` with 1000 items gets one
click handler instead of 1000 — and new items added after page load
automatically work because the event bubbles through them to the parent
regardless of when they were inserted.

Two properties matter and they're not the same. `event.target` is the
element that actually dispatched the event — the element the user clicked
on. `event.currentTarget` is the element the handler is attached to. If
you click a `<span>` inside an `<li>`, `event.target` is the `<span>`,
not the `<li>`. Delegation relies on `event.target` to figure out which
item was clicked, and the idiomatic way to do that is `.closest()`.
`event.target.closest('li')` walks up from the clicked element until it
finds the nearest `<li>` — which handles nested markup gracefully, because
the user might wrap content in `<span>` or `<em>` for styling.

The tradeoff is the part the junior answer misses: delegation depends on
the event reaching the parent. If any handler between the child and the
parent calls `stopPropagation()`, the delegated handler never fires. A
button inside your list that stops propagation silently breaks your
delegation. The senior answer names both the pattern and this constraint,
because delegation isn't a pure win — it's a tradeoff between memory
efficiency and propagation dependency.

### Part 3 — Whiteboard / Live Coding

A realistic delegation pattern — a toolbar where buttons have nested
markup:

```html
<!-- ILLUSTRATIVE — delegation pattern observable in browser DevTools -->
<div id="toolbar">
  <button type="button"><span class="icon">+</span> Add Item</button>
  <button type="button"><span class="icon">-</span> Remove Item</button>
  <button type="button"><span class="icon">*</span> Edit Item</button>
</div>
```

```javascript
// ILLUSTRATIVE — not runnable in Node/jsdom
const toolbar = document.getElementById('toolbar');

// One handler instead of one per button
toolbar.addEventListener('click', (e) => {
  // .closest() finds the <button> even if the click landed on the <span>
  const button = e.target.closest('button');
  if (!button) return; // clicked the toolbar background, not a button

  const action = button.textContent.trim();
  console.log(`Action: ${action}`);
  // e.target: <span> or <button> depending on where the click landed
  // e.currentTarget: always <div#toolbar>
});
```

```javascript
// ILLUSTRATIVE — the .closest() idiom handling nested markup
// Click on <span class="icon"> inside the first button:
//   e.target = <span class="icon">
//   e.target.closest('button') = <button>        ← finds the right button
//   e.currentTarget = <div#toolbar>              ← where the handler lives
```

**The `.closest()` defensive pattern with data attributes:**

```html
<!-- ILLUSTRATIVE — delegation with data attributes for identification -->
<ul id="item-list">
  <li data-id="42"><span class="label">Item 42</span></li>
  <li data-id="87"><span class="label">Item 87</span></li>
</ul>
```

```javascript
// ILLUSTRATIVE — data-attribute delegation
const list = document.getElementById('item-list');

list.addEventListener('click', (e) => {
  const item = e.target.closest('li[data-id]');
  if (!item) return;

  const id = item.dataset.id;
  console.log(`Clicked item ${id}`);
});
```

The `closest('li[data-id]')` ensures you only match items that have the
`data-id` attribute — not the `<ul>` itself or an unrelated ancestor. This
is the idiomatic defensive delegation pattern.

### Part 4 — Follow-Up Questions

**Q: What happens if `event.target` is the parent element itself, not a
child?**

If the user clicks the `<ul>` background (not a child), `event.target` is
the `<ul>`. `.closest('li')` returns `null` because the `<ul>` is not a
descendant of any `<li>`. The `if (!item) return` guard handles this
gracefully — the handler does nothing for clicks on the parent itself.
This is why `.closest()` is superior to checking `event.target.tagName`
— `.closest()` naturally handles the "clicked the parent" case.

**Q: Can delegation work with `focus` and `blur` events?**

Not directly, because `focus` and `blur` don't bubble. They're the
exception to the bubbling rule. But `focusin` and `focusout` are the
bubbling equivalents — they fire on the same elements and bubble up the
tree. Use `focusin`/`focusout` for delegation of focus-related events.
This is one of the less-known event pairs, and it exists precisely
because `focus`/`blur` don't participate in the delegation model.

**Q: How does delegation interact with dynamically added elements?**

Delegation handles dynamic elements naturally — the handler is on the
parent, which exists before any children are added. When a new `<li>` is
inserted into the `<ul>`, clicks on it bubble to the `<ul>` and the
handler sees them. No re-binding needed. This is one of delegation's
primary advantages over direct binding.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Delegation as pure win with no downsides | Names the `stopPropagation` tradeoff: any child handler that stops propagation silently breaks delegation |
| Uses `event.target.tagName` for identification | Uses `.closest()` for defensive targeting that handles nested markup |
| Never checks if `.closest()` returned null | Guards against clicks on the parent element or unrelated ancestors |
| Delegates `focus`/`blur` events | Knows those don't bubble — uses `focusin`/`focusout` instead |

### Part 6 — Production Examples

**Real incident — `stopPropagation` silently breaking a delegated table
handler:** A data table used delegation on the `<table>` element to handle
row selection. Click any cell, the handler found the `<tr>` via
`.closest('tr')`, and toggled selection. A product team added an inline
edit feature to cells — clicking a cell opened an editor. The edit
feature's click handler called `event.stopPropagation()` to prevent the
selection handler from also firing. The selection handler stopped working
for editable cells. The team spent a day debugging why the delegation
pattern "suddenly broke" before tracing it to the propagation-stopping
handler. The fix was using `event.defaultPrevented` as a signal: if the
edit handler called `preventDefault()`, the selection handler bailed out.
But `preventDefault()` is semantically wrong for "I handled this event" —
the correct pattern is a custom event or a shared state flag. The lesson:
delegation's propagation dependency is a real constraint, and teams hit it
in production.

**Real incident — delegation and shadow DOM boundaries:** A component
library used web components with shadow DOM for its data grid. Each cell
was a shadow host with its own event handling. A delegation handler on the
grid container never fired for clicks inside cells because the click
crossed a shadow boundary and `event.target` was retargeted to the shadow
host — not the internal element that was actually clicked. The `.closest()`
call inside the delegation handler returned `null` because the retargeted
target had no matching ancestor. The fix was listening for events on each
shadow host individually, or using `event.composedPath()` to identify the
real target. This is the bridge to Section 4.

---

## 4. Shadow DOM Event Retargeting

### Part 1 — Theory

Session 13 established the composed DOM: the flattened tree the browser
renders when shadow trees and light DOM compose for painting. Events
traverse that same composed tree. But when an event originates inside a
shadow tree and crosses the shadow boundary into the main document, the
browser retargets it — and this is where most developers get confused.

**`event.target` retargeting at the shadow boundary.** When a click
fires on a `<button>` inside a shadow tree, the event propagates up
through the shadow tree's ancestors normally. When it crosses the shadow
boundary — the point where the shadow tree meets the main document — the
browser sets `event.target` to the **shadow host** (the element the shadow
root is attached to), not the internal `<button>` that was actually
clicked. From the perspective of handlers in the main document, the event
came from the shadow host, not from its internals. This is encapsulation
working as designed: the outside world sees the host, not the shadow tree's
internals.

**`event.composedPath()`** returns the full propagation path, including
shadow-internal elements — but only if the shadow root is open. For open
shadow roots, `composedPath()` returns an array like `[button, div.shadow,
#shadow-root(host), div#host, body, document]`, giving you the real target
and every ancestor through the shadow boundary. For closed shadow roots,
`composedPath()` returns the path up to the shadow host only — the
internal elements are not exposed. The path includes the shadow root
itself, the host, and all ancestors in the main document.

**`event.composed`** is a boolean that tells you whether the event crosses
shadow boundaries at all. Most UI events are composed: `click`, `dblclick`,
`keydown`, `keyup`, `input`, `mousedown`, `mouseup`. These events fire
inside a shadow tree and propagate through the shadow boundary into the
main document. Some events are not composed: `focus` and `blur` historically
did not cross shadow boundaries (though this has evolved — `focusin` and
`focusout` are composed). The `composed` property lets you check
programmatically whether an event will cross boundaries, which matters
when you're building event handlers that need to know whether shadow DOM
is in play.

The practical impact: if you're building a delegated event handler on the
main document, and a web component's shadow tree fires a click, your
handler sees `event.target` as the shadow host — not the button inside
the shadow tree. To identify the actual clicked element, you need
`event.composedPath()[0]` (the real target) for open shadow roots, or you
need to accept that closed shadow roots don't expose internals. This is
genuinely senior content — most candidates don't know retargeting exists,
let alone how to work around it.

### Part 2 — Interview Answer

When an event originates inside a shadow tree and crosses the shadow
boundary, the browser retargets `event.target` to the shadow host. The
main document's handlers see the host element as the event's source, not
the internal element that actually fired it. This is encapsulation working
by design — the outside world sees the host, not the shadow tree's
internals.

`event.composedPath()` gives you the full path, including shadow-internal
elements — but only for open shadow roots. For closed shadow roots, the
path stops at the host. The first element in the array is the real target,
the element that actually dispatched the event. If you need to identify
what was clicked inside a shadow component, `composedPath()[0]` is the way.

`event.composed` tells you whether the event crosses shadow boundaries at
all. Most UI events are composed — `click`, `keydown`, `input`, `mousedown`
all cross shadow boundaries. Some events are not — `focus` and `blur` are
the notable exceptions, though `focusin` and `focusout` are composed. The
`composed` property is a boolean check for "will this event cross the
shadow boundary?"

The senior answer knows that `event.target` lies at shadow boundaries and
reaches for `composedPath()` when they need the real element. The junior
answer doesn't know retargeting exists — they assume `event.target` always
points to the element that was clicked, which is wrong inside shadow DOM.
If you're building a delegated handler and shadow components are on the
page, retargeting is a bug you will hit if you don't know it's there.

### Part 3 — Whiteboard / Live Coding

Demonstrate retargeting and `composedPath()`:

```html
<!-- ILLUSTRATIVE — shadow DOM event retargeting -->
<div id="outer-container">
  <my-widget></my-widget>
</div>

<script>
  // ILLUSTRATIVE — not runnable in Node/jsdom

  // Define a web component with an open shadow root
  class MyWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <button part="action">Click me</button>
      `;
    }
  }
  customElements.define('my-widget', MyWidget);
</script>
```

```javascript
// ILLUSTRATIVE — retargeting demonstration
const container = document.getElementById('outer-container');

// Handler on the main document — this is the "outside world"
document.addEventListener('click', (e) => {
  console.log('event.target:', e.target);
  // → <my-widget> (the shadow host), NOT <button>

  console.log('event.composedPath()[0]:', e.composedPath()[0]);
  // → <button> (the actual element that was clicked)

  console.log('event.composed:', e.composed);
  // → true (click crosses shadow boundaries)
});
```

**Open vs closed shadow roots — `composedPath()` difference:**

```javascript
// ILLUSTRATIVE
class OpenWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = '<button>Open</button>';
  }
}
customElements.define('open-widget', OpenWidget);

class ClosedWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'closed' });
    this.shadowRoot.innerHTML = '<button>Closed</button>';
  }
}
customElements.define('closed-widget', ClosedWidget);
```

```javascript
// ILLUSTRATIVE
document.addEventListener('click', (e) => {
  const path = e.composedPath();

  if (e.target.tagName === 'OPEN-WIDGET') {
    console.log('Open path:', path);
    // → [button, shadow-root, open-widget, body, html, document]
    // Internal <button> is visible in the path
  }

  if (e.target.tagName === 'CLOSED-WIDGET') {
    console.log('Closed path:', path);
    // → [closed-widget, body, html, document]
    // Internal elements are NOT in the path
  }
});
```

**Non-composed events — `focus` and `blur`:**

```javascript
// ILLUSTRATIVE
const shadowButton = document.querySelector('open-widget')
  .shadowRoot.querySelector('button');

shadowButton.focus();

document.addEventListener('focus', (e) => {
  console.log('focus event.target:', e.target);
  // → <open-widget> (retargeted)
  console.log('focus event.composed:', e.composed);
  // → false — focus does NOT cross shadow boundaries (historically)
}, true);

document.addEventListener('focusin', (e) => {
  console.log('focusin event.target:', e.target);
  // → <open-widget> (still retargeted)
  console.log('focusin event.composed:', e.composed);
  // → true — focusin DOES cross shadow boundaries
}, true);
```

<!-- ILLUSTRATIVE — retargeting behavior observable in browser DevTools, not runnable in Node/jsdom -->

### Part 4 — Follow-Up Questions

**Q: How do you handle events from shadow DOM components in a delegated
handler?**

Two approaches. First, use `event.composedPath()` to get the real target.
If the shadow root is open, `composedPath()[0]` gives you the internal
element that dispatched the event. This is the cleanest approach — you get
the exact element, regardless of shadow boundaries. Second, if the shadow
root is closed (or you don't need the exact internal element), treat the
retargeted `event.target` (the shadow host) as the item and use
`closest()` on it. The tradeoff: `composedPath()` gives you the real
element but only works for open shadow roots; working with the retargeted
target works universally but loses internal detail.

**Q: Does `stopPropagation()` inside a shadow tree prevent handlers in
the main document from seeing the event?**

Yes, if the event hasn't crossed the shadow boundary yet. A
`stopPropagation()` call in a bubble-phase handler inside the shadow tree
stops the event from reaching the shadow boundary — the main document
never sees it. But if the event has already crossed the boundary and is
bubbling in the main document, `stopPropagation()` there stops it from
reaching ancestors in the main document. Propagation is continuous
through the composed tree — `stopPropagation` stops it wherever you call
it, regardless of which tree the handler lives in.

**Q: Are `click` events always composed?**

Yes. `click`, `dblclick`, `mousedown`, `mouseup`, `keydown`, `keyup`,
`input`, and `change` are all composed events — they cross shadow
boundaries. The `composed` property is `true` for all of them. The
exception is `focus` and `blur`, which historically were not composed,
though the platform has evolved: `focusin` and `focusout` are composed
alternatives. When in doubt, check `event.composed` rather than assuming.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Assumes `event.target` always points to the clicked element | Knows `event.target` is retargeted to the shadow host at shadow boundaries |
| Doesn't know `composedPath()` exists | Reaches for `composedPath()[0]` to get the real target inside open shadow roots |
| Assumes `focus`/`blur` cross shadow boundaries | Knows they historically don't — uses `focusin`/`focusout` for composed alternatives |
| Treats shadow DOM as transparent to events | Understands events traverse the composed tree with retargeting at boundaries |

### Part 6 — Production Examples

**Real incident — delegated click handler broken by shadow DOM:** A
component library migrated its list component from plain DOM to shadow DOM
for style encapsulation. The application's document-level click handler
used delegation to handle item selection — `event.target.closest('li')`
worked before the migration. After migration, `event.target` was the list
component's shadow host, not the `<li>` inside the shadow tree.
`.closest('li')` returned `null` because the shadow host is not a
descendant of any `<li>`. Every click on a list item was silently ignored
by the delegation handler. The fix was checking `event.composedPath()[0]`
for open shadow roots, or adding event listeners to each shadow host
individually. The migration broke the delegation pattern because the
developers didn't account for retargeting — and the bug was invisible
until users reported that item selection stopped working.

**Real incident — `composedPath()` on closed shadow roots leaking
internals:** A third-party analytics library used `event.composedPath()` to
identify which button was clicked on the page, including inside web
components. A security-sensitive component used a closed shadow root to
hide its internal structure. The analytics library still received the
component's shadow host as `event.target` (retargeted correctly), but
`composedPath()` for the closed shadow root returned the host and
ancestors — not the internal button. The team had assumed closed mode
would hide everything from `composedPath()`, but the path includes the
host itself, which is enough to identify the component. The lesson: closed
shadow roots prevent casual inspection, not all programmatic identification
— the host element is always visible in the event path.

---

## 5. Tie the Chain Together and Close Module 2

Events propagate through the composed DOM that Session 13 established.
Capture travels down from the document root through the composed tree to
the target. Bubble travels back up. At shadow boundaries, `event.target`
retargets to the shadow host — the outside world sees the host, not the
internals — and `event.composedPath()` recovers the real path for open
shadow roots.

`stopPropagation` controls propagation — it decides whether the event
reaches ancestors or descendants. `stopImmediatePropagation` goes further,
silencing same-element handlers too. `preventDefault` controls browser
behavior — navigation, form submission, character insertion — and is
orthogonal to propagation. Event delegation uses bubbling as a feature:
one parent handler replaces N child handlers, with `.closest()` as the
defensive idiom for identifying the real target. The tradeoff is
real: `stopPropagation` anywhere in the chain silently breaks delegation.

Module 2 covered six sessions. Sessions 9-11 established HTML structure:
semantic elements and their accessibility implications (Session 9),
forms and validation patterns (Session 10), and tables with ARIA in
HTML context (Session 11). Sessions 12-13 covered how browsers process
that structure: the HTML parser's state machine and error recovery
(Session 12), and the Shadow DOM's second tree and its composition with
the main document (Session 13). This session — Session 14 — completed
the picture: events flow through the composed tree that the browser
built, traversing shadow boundaries with retargeting and giving
developers the propagation controls and delegation patterns to work with
that flow.

Module 3 (CSS Mastery) begins with Session 15 — cascade, specificity,
and inheritance — the three rules that decide which CSS declaration wins
when multiple rules target the same element.

---

*End of Session 14. Events traverse the composed DOM in three phases:
capture down, target, bubble up. `stopPropagation` controls the event's
journey, `preventDefault` controls the browser's action, and delegation
uses bubbling as a feature. At shadow boundaries, `event.target`
retargets to the host and `composedPath()` recovers the real path. Module
2 is complete.*
