# Session 18 — Animations, Transforms, Transitions, and GPU Performance

> **Module 3 — CSS Mastery.** Session 4 of 7.
> **Chain:** Transforms (coordinate system, functions, individual properties) → Transitions (shorthand, timing functions, `transition-behavior`) → CSS Animations (`@keyframes`, shorthand, `fill-mode`, direction) → GPU Performance (compositor-only properties, `will-change`, rendering pipeline).
> Session 17 covered Flexbox and Grid layout. Session 16 established that `transform` and `will-change` create stacking contexts — this session explains why: those properties trigger GPU compositing, which is what makes transform-based animations smooth. Session 19 continues with container queries and modern CSS.

<!-- Module 3 convention: CSS cascade, specificity, and rendering behavior is
observable in DevTools but not in a Node/jsdom unit-testing environment.
All CSS examples in this module are ILLUSTRATIVE — syntactically valid,
mentally traced, but not run against a browser harness in-session.
This convention applies to Sessions 15-21. -->

---

## Topic 1 — Transforms

### Part 1: Theory

CSS transforms move, rotate, scale, or skew an element visually without changing its layout position. The element still occupies its original space in the document flow — other elements don't reflow when a transform is applied. This is the fundamental difference between transforms and layout properties like `width`, `top`, or `margin`: transforms are visual-only.

**The coordinate system.** Transforms apply relative to the element's own coordinate system, established by `transform-origin`. The default origin is `50% 50%` — the center of the element. When you rotate 45 degrees, you rotate around that center point. Moving the origin changes what point the transform operates around: `transform-origin: 0 0` rotates around the top-left corner. The origin is specified in the element's local coordinate space, which means percentage values resolve against the element's own dimensions, not its parent's.

**Core transform functions.** `translate(x, y)` moves the element horizontally and vertically. `rotate(angle)` rotates around the transform origin. `scale(x, y)` resizes the element. `skew(x, y)` shears the element. `matrix(a, b, c, d, tx, ty)` defines all six parameters of a 2D affine transformation directly — the other functions are syntactic sugar for common matrix configurations. A 3D variant exists: `translate3d`, `rotate3d`, `scale3d`, `matrix3d`, and `perspective`.

**Why transforms don't affect layout.** When you apply `transform: translateX(100px)` to an element, the element visually moves 100 pixels to the right, but its original position still occupies layout space. A sibling below it doesn't shift up. This is because transforms operate in a separate rendering pass — the compositor layer — after layout and paint are complete. The element's layout box stays where it was; only its visual representation moves.

**Individual transform properties.** CSS introduced `translate`, `rotate`, and `scale` as standalone properties (not functions inside `transform`). These apply in a fixed order — translate first, then rotate, then scale, then any `transform` property value — regardless of the order you write them in CSS. The key advantage: you can animate or transition one property independently without overwriting the others. With `transform: translateX(10px) rotate(45deg)`, animating `rotate` in a `@keyframes` rule requires repeating `translateX` in every keyframe or it gets overwritten. With individual properties, `rotate: 45deg` animates independently from `translate: 10px`.

---

### Part 2: Interview Answer

Transforms let you move, rotate, scale, or skew an element without affecting layout. That's the key distinction from properties like `width`, `top`, or `margin` — transforms change how an element looks, not where it sits in the document flow. Other elements don't reflow when you apply a transform.

Transforms apply relative to the element's own coordinate system, established by `transform-origin`. The default is `50% 50%` — the center. So `rotate(45deg)` spins around the center. Change the origin to `0 0` and you rotate around the top-left corner. The origin resolves against the element's own dimensions, not its parent's.

The core functions are `translate`, `rotate`, `scale`, `skew`, and `matrix` — which is the underlying six-parameter affine transform that the others are shorthand for. There are 3D variants too: `translate3d`, `rotate3d`, `perspective`.

The reason transforms don't cause layout reflow is that they operate in a separate rendering pass — the compositor layer. The element's layout box stays put; only the visual representation moves. That's also why transforms are the correct tool for animation: you can move an element at 60fps without triggering layout recalculation on every frame.

The modern approach is individual transform properties — `translate`, `rotate`, and `scale` as CSS properties, not functions inside `transform`. They apply in a fixed order: translate, then rotate, then scale. The advantage is independence. If you animate `rotate` in a keyframe, it doesn't overwrite `translate`. With the `transform` shorthand, you have to repeat every function in every keyframe or it gets lost. Individual properties eliminate that composition conflict entirely.

---

### Part 3: Whiteboard / Live Coding

**Transform functions — side by side:**

```css
/* translate — moves without affecting layout */
.translate-example {
  transform: translateX(50px) translateY(-20px);
}

/* rotate — spins around transform-origin */
.rotate-example {
  transform: rotate(45deg);
}

/* scale — resizes visually, layout box unchanged */
.scale-example {
  transform: scale(1.5);
}

/* skew — shears the element */
.skew-example {
  transform: skewX(10deg);
}

/* matrix — the underlying affine transform */
.matrix-example {
  /* equivalent to translateX(50px) rotate(45deg) */
  transform: matrix(0.707, 0.707, -0.707, 0.707, 50, 0);
}
```

<!-- ILLUSTRATIVE: The matrix values for a combined translate+rotate are
computed from the 2D affine transform matrix. Verify by inspecting the
Computed panel in DevTools — the browser resolves all transform functions
to a single matrix. -->

**Transform-origin changes the pivot point:**

```css
/* Default — rotates around center */
.center-rotate {
  transform-origin: 50% 50%;
  transform: rotate(45deg);
}

/* Rotates around top-left corner */
.corner-rotate {
  transform-origin: 0 0;
  transform: rotate(45deg);
}

/* Rotates around a specific point */
.custom-origin {
  transform-origin: 20px 80px;
  transform: rotate(30deg);
}
```

**Transform composition conflict — the problem individual properties solve:**

```css
/* The problem: transform shorthand overwrites entirely */
.card {
  transform: translateX(0) rotate(0deg);
}

.card:hover {
  /* This overwrites the entire transform — translateX is gone */
  transform: rotate(10deg);
}

/* Workaround: repeat everything in every state */
.card:hover {
  transform: translateX(0) rotate(10deg);
}

/* The solution: individual transform properties */
.card-modern {
  translate: 0;
  rotate: 0deg;
}

.card-modern:hover {
  /* Only rotate changes — translate is untouched */
  rotate: 10deg;
}
```

<!-- ILLUSTRATIVE: Individual transform properties compose with the
transform property, not replace it. An element can have both
`translate: 10px` and `transform: scale(1.5)` — they combine in the
fixed order: translate, rotate, scale, then transform. -->

**Individual transform properties — independent animation:**

```css
/* Animate rotate without affecting translate or scale */
.animated-card {
  translate: 0;
  rotate: 0deg;
  scale: 1;
  transition: rotate 0.3s ease;
}

.animated-card:hover {
  rotate: 15deg;
  /* translate and scale are unaffected — no composition conflict */
}

/* This would be impossible with transform shorthand
   without repeating translate and scale in every keyframe */
@keyframes wobble {
  0%, 100% { rotate: 0deg; }
  25% { rotate: 5deg; }
  75% { rotate: -5deg; }
}
```

---

### Part 4: Follow-Up Questions

**Q: Why doesn't `transform` trigger layout reflow?**

The browser's rendering pipeline has three main stages: layout (calculate positions and sizes), paint (draw pixels onto layers), and composite (assemble layers for display). Layout properties like `width`, `top`, and `margin` require the browser to recalculate positions — that's layout reflow. Transforms skip layout and paint entirely. They operate on an already-painted compositor layer, just repositioning it visually. The compositor runs on a separate thread from the main thread, so transform animations don't block JavaScript execution or layout calculations. This is why `transform: translateX(100px)` is smooth at 60fps while `left: 100px` causes jank — the left property triggers layout on every frame.

**Q: Can I combine individual transform properties with the `transform` shorthand?**

Yes. They compose, not compete. Individual properties (`translate`, `rotate`, `scale`) are applied first in their fixed order, then the `transform` property value is applied on top. So `translate: 10px; transform: scale(2)` scales the element by 2x and also translates it 10px. They don't override each other — they stack. The fixed application order (translate → rotate → scale → transform) means you can't reorder them, but you can freely use both on the same element.

**Q: When would I use `matrix()` directly?**

Almost never by hand. The `matrix()` function is what the browser computes internally — the `Computed` panel in DevTools shows the resolved matrix. You'd use it when generating transforms programmatically (JavaScript calculating a dynamic transformation) or when you need a specific affine transformation that doesn't map cleanly to the shorthand functions. For hand-written CSS, `translate`, `rotate`, and `scale` are always clearer.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Transforms move elements around. You can translate, rotate, scale, and skew. Use `transform-origin` to change the pivot point. Transforms don't affect other elements' layout."

**Why this misses the point:** The junior answer lists features without explaining the performance implication — transforms don't trigger layout reflow because they operate in the compositor layer. It doesn't mention individual transform properties as the modern approach, doesn't explain the composition conflict with the shorthand, and doesn't connect transforms to animation performance.

**Senior answer:**
"Transforms let you visually move, rotate, scale, or skew an element without affecting layout — the element's layout box stays put, only the visual representation changes. That's what makes them the correct tool for animation: transforms operate in the compositor layer, so they don't trigger layout reflow on every frame. The core functions are `translate`, `rotate`, `scale`, `skew`, and `matrix`, all relative to `transform-origin`. The modern approach is individual transform properties — `translate`, `rotate`, `scale` as CSS properties — which apply in a fixed order and can be animated independently. With the `transform` shorthand, animating `rotate` in a keyframe means repeating `translate` and `scale` in every keyframe or they get overwritten. Individual properties eliminate that composition conflict."

**The tell:** The junior answer lists features. The senior answer explains why transforms are the performance-correct choice for animation and knows the composition conflict that individual properties solve.

---

### Part 6: Production Examples

A team building a data visualization dashboard had animated tooltips that appeared on hover. The original implementation used `position: absolute` with `top` and `left` transitions to slide the tooltip into position. On complex pages with dozens of visible charts, the tooltips caused noticeable jank — each animation triggered layout recalculation for the tooltip and its siblings. The fix was replacing the `top`/`left` transitions with `transform: translate()`. The tooltip animation went from 15fps to 60fps because transforms skip layout and paint, operating directly on the compositor layer. The layout cost dropped to zero for the animation frames.

A different team had a card component with both a hover lift effect and a rotation animation. The original CSS used `transform: translateY(-4px) rotate(0deg)` in the base state and `transform: translateY(-4px) rotate(3deg)` on hover. When they added a keyframe animation for a subtle wobble on page load, the hover state broke — the animation's `@keyframes` had to repeat `translateY(-4px)` in every frame because the `transform` shorthand overwrites entirely. They migrated to individual transform properties: `translate: 0; rotate: 0deg` in the base state, `rotate: 3deg` on hover, and the wobble animation only keyframed `rotate`. The hover and animation stopped conflicting because they operated on independent properties.

---

## Topic 2 — Transitions

### Part 1: Theory

CSS transitions animate the change between two states over a duration. When a property value changes — on hover, class toggle, or any state change — the browser interpolates from the old value to the new value over the specified time. Transitions are reactive: they happen in response to a state change, not on page load.

**The transition shorthand.** `transition: property duration timing-function delay`. `property` is which CSS property to animate (or `all`). `duration` is how long the transition takes. `timing-function` controls the acceleration curve. `delay` is how long to wait before starting. Example: `transition: transform 0.3s ease-in-out 0.1s` — transition the transform property over 300ms with ease-in-out timing, starting after a 100ms delay.

**Timing functions.** `ease` (default) — slow start, fast middle, slow end. `linear` — constant speed. `ease-in` — slow start, fast end. `ease-out` — fast start, slow end. `ease-in-out` — slow start and end. `cubic-bezier(x1, y1, x2, y2)` — custom curve defined by two control points. The `steps()` function creates discrete jumps instead of smooth interpolation. The timing function is the most underused part of transitions — most developers use the default `ease` without thinking about whether the animation should accelerate or decelerate.

**`transition: all` — why it's usually a bad idea.** Transitioning `all` means every animatable property on the element will transition when any property changes. This includes properties you don't want to animate — `display`, `visibility`, `box-shadow`, `outline`, even `z-index`. A class toggle that changes `background-color` also transitions `box-shadow`, `border-color`, and any other property that differs between states. This wastes compositor resources and can cause unexpected visual artifacts. The fix: specify the exact property. `transition: transform 0.3s ease` instead of `transition: all 0.3s ease`.

**`transition-behavior: allow-discrete`.** Some properties — `display`, `visibility` — are discrete: they jump from one value to another, they don't interpolate. A transition on `display: none` to `display: block` would normally snap because there's no intermediate value. `transition-behavior: allow-discrete` tells the browser to apply the discrete change at the end of the transition duration, enabling exit animations where the element fades out before `display: none` is applied. This property can be included in the shorthand: `transition: opacity 0.3s ease, display 0.3s allow-discrete`. Available in modern browsers — Chrome 117+, Firefox 129+, Safari 17.4+.

---

### Part 2: Interview Answer

Transitions animate the change between two CSS states. When a property value changes — hover, class toggle, whatever — the browser interpolates from the old value to the new over a duration. The shorthand is `transition: property duration timing-function delay`.

The part most developers skip is the timing function. The default is `ease` — slow start, fast middle, slow end. But different animations need different curves. A dropdown sliding in feels natural with `ease-out` — it starts fast and decelerates as it arrives. A loading spinner should use `linear` for constant speed. A modal appearing might use `ease-in-out` for a smooth entrance and exit. The `cubic-bezier()` function gives you full control over the curve.

`transition: all` is usually a mistake. It transitions every animatable property on the element, including ones you don't want to animate. A class toggle that changes `background-color` also transitions `box-shadow`, `border-color`, and whatever else differs between states. This wastes compositor resources and causes unexpected visual artifacts. Specify the exact property: `transition: transform 0.3s ease`.

The newer piece is `transition-behavior: allow-discrete`. Properties like `display` and `visibility` are discrete — they jump, they don't interpolate. You can't fade from `display: none` to `display: block` because there's no intermediate state. `allow-discrete` tells the browser to apply the discrete swap at the end of the transition duration. So you can fade an element's opacity to 0 over 300ms, and at the 300ms mark, `display: none` is applied. That's an exit animation with pure CSS — no JavaScript timeout needed. It's supported in all modern browsers since 2024.

---

### Part 3: Whiteboard / Live Coding

**Transition shorthand — the four parts:**

```css
/* Basic transition */
.button {
  background-color: blue;
  transition: background-color 0.3s ease 0s;
}

.button:hover {
  background-color: darkblue;
}

/* Multiple properties — comma-separated */
.card {
  transition:
    transform 0.3s ease-out,
    box-shadow 0.3s ease-out;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

<!-- ILLUSTRATIVE: Each transition entry is independent — transform and
box-shadow animate on separate timelines. If one is faster than the
other, they finish at different times. -->

**Timing functions — the curves:**

```css
/* ease (default) — slow start, fast middle, slow end */
.ease-default {
  transition: transform 0.3s ease;
}

/* linear — constant speed */
.linear {
  transition: transform 0.3s linear;
}

/* ease-in — slow start, fast end (accelerating) */
.ease-in {
  transition: transform 0.3s ease-in;
}

/* ease-out — fast start, slow end (decelerating) */
.ease-out {
  transition: transform 0.3s ease-out;
}

/* ease-in-out — slow start and end */
.ease-in-out {
  transition: transform 0.3s ease-in-out;
}

/* cubic-bezier — custom curve */
.custom-curve {
  /* overshoot curve — goes past the target, then settles */
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

<!-- ILLUSTRATIVE: The cubic-bezier overshoot curve (0.34, 1.56, 0.64, 1)
causes the element to translate past its target position and bounce back.
This is a common pattern for playful UI animations. Verify by observing
the element's position in DevTools during the transition. -->

**`transition: all` — the problem:**

```css
/* Bad — transitions everything */
.bad {
  transition: all 0.3s ease;
}

.bad.active {
  background-color: red;
  /* Also transitions box-shadow, border-color, outline,
     color, and any other property that differs */
}

/* Good — specify the property */
.good {
  transition: background-color 0.3s ease;
}

.good.active {
  background-color: red;
  /* Only background-color transitions */
}
```

**`transition-behavior: allow-discrete` — exit animations:**

```css
/* Fade out, then hide */
.tooltip {
  opacity: 1;
  transition: opacity 0.3s ease, display 0.3s allow-discrete;
}

.tooltip.hidden {
  opacity: 0;
  display: none;
  /* display: none is applied at the end of the 0.3s transition */
}

/* With @starting-style for entry animation */
.tooltip {
  opacity: 1;
  transition:
    opacity 0.3s ease,
    display 0.3s allow-discrete;
}

.tooltip.hidden {
  opacity: 0;
  display: none;
}

@starting-style {
  .tooltip {
    opacity: 0;
  }
}
```

<!-- ILLUSTRATIVE: @starting-style defines the initial state for entry
transitions — the element starts at opacity 0 when first rendered, then
transitions to opacity 1. Without @starting-style, the element would
appear immediately at full opacity and only transition on exit. Both
transition-behavior and @starting-style are needed for full enter/exit
animation with display changes. -->

---

### Part 4: Follow-Up Questions

**Q: How does `cubic-bezier()` work? What do the four numbers mean?**

The four numbers are two control points: `(x1, y1)` and `(x2, y2)`. The x-axis represents time (0 at the start, 1 at the end), and the y-axis represents progress (0 at the start value, 1 at the end value). The default `ease` is `cubic-bezier(0.25, 0.1, 0.25, 1)`. A common overshoot curve like `cubic-bezier(0.34, 1.56, 0.64, 1)` has a y-value above 1, which means the element goes past its target before settling back. Tools like cubic-bezier.com let you visually design the curve and copy the values.

**Q: Can you transition `display` without `transition-behavior`?**

Not with smooth interpolation. `display` is a discrete property — it jumps from `none` to `block` (or `flex`, `grid`, etc.) with no intermediate values. Without `allow-discrete`, a transition on `display` snaps at the 50% mark of the duration — it's `display: none` for the first half and `display: block` for the second half, with no visual change during the first half. With `allow-discrete`, the discrete swap happens at the end of the transition, so you can pair it with `opacity` for a fade-out-then-hide effect.

**Q: What's the difference between `transition` and `animation`?**

Transitions are reactive — they animate from state A to state B in response to a property change. You define the start and end states in your CSS rules, and the browser interpolates between them. Animations are self-contained — you define the full motion in `@keyframes`, and the animation runs on page load (or when triggered) without needing a state change. Transitions are simpler for hover effects and toggles. Animations are necessary for multi-step sequences, looping, or complex motion that can't be expressed as a two-state change.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use `transition: all 0.3s ease` for smooth effects. It animates everything when you hover or toggle a class."

**Why this misses the point:** The junior answer uses `transition: all` — the most common performance mistake in CSS transitions. It transitions every animatable property, including ones that shouldn't animate (`display`, `z-index`, `box-shadow`). A senior engineer specifies the exact property, uses a timing function deliberately based on the animation's character, and knows that `transition: all` causes unexpected performance issues and visual artifacts.

**Senior answer:**
"I specify the exact property, duration, and timing function. `transition: transform 0.3s ease-out` for a hover lift, not `transition: all 0.3s ease`. The timing function matters — `ease-out` for elements arriving from off-screen (fast start, decelerating stop), `ease-in` for elements leaving, `linear` for continuous motion. For exit animations, I use `transition-behavior: allow-discrete` to transition `display: none` — the element fades out over the duration, then `display: none` is applied at the end. That's pure CSS, no JavaScript timeout needed. And I never use `transition: all` because it transitions properties like `box-shadow` and `z-index` that shouldn't animate, wasting compositor resources."

**The tell:** The junior answer reaches for `transition: all` as the default. The senior answer specifies properties deliberately, knows timing functions matter, and uses `allow-discrete` for discrete property transitions.

---

### Part 6: Production Examples

A component library team had a performance regression after a developer added `transition: all 0.2s ease` to a button component for hover effects. The button had `box-shadow`, `border-color`, `outline`, and `background-color` all changing between states. With `transition: all`, every one of those properties animated simultaneously — four property transitions composited per frame instead of one. On pages with many buttons (data tables, toolbars), the transition overhead caused visible jank during rapid interactions. The fix was replacing `all` with `background-color 0.2s ease` — the only property that actually needed animation. The compositor load dropped by 75% for those interactions.

A different team built a notification system where toasts slide in from the right, stay for 5 seconds, then slide out. The original implementation used `transition: transform 0.3s ease` with a JavaScript `setTimeout` to add a `hidden` class after 5 seconds. The problem: the timeout and the CSS transition weren't synchronized — sometimes the class was added before the exit transition finished, causing a jarring snap. They replaced the JavaScript timeout with `transition-behavior: allow-discrete` on `display`: the toast's opacity transition and `display: none` swap happened in a single CSS transition. No JavaScript timer needed, and the exit animation was guaranteed to complete before the element was hidden. The implementation was simpler and the timing was always correct.

---

## Topic 3 — CSS Animations

### Part 1: Theory

CSS animations define multi-step visual changes using `@keyframes` rules. Unlike transitions — which animate between two states in response to a property change — animations are self-contained. You define the full motion in `@keyframes`, and the animation runs when the animation name is applied to an element.

**`@keyframes` rules.** A `@keyframes` rule defines the intermediate states of an animation. Each step is a percentage (0% to 100%) or the keywords `from` (0%) and `to` (100%). You can have any number of stops. The browser interpolates between them.

```css
@keyframes slide-in {
  0% { transform: translateX(-100%); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateX(0); opacity: 1; }
}
```

**The animation shorthand.** `animation: name duration timing-function delay iteration-count direction fill-mode play-state`. Most properties have defaults — `animation: spin 1s linear` is valid. The key properties beyond name and duration:

- `iteration-count`: how many times to run (default `1`, can be `infinite`).
- `direction`: `normal` (0% → 100%), `reverse` (100% → 0%), `alternate` (0% → 100% → 0%, switching each iteration), `alternate-reverse` (100% → 0% → 100%).
- `fill-mode`: what happens before the animation starts and after it ends.
- `play-state`: `running` or `paused`.

**`animation-fill-mode` — the four values.** This is the most misunderstood animation property.

- `none` (default): the animation applies only during its duration. The element snaps back to its original styles before and after. A fade-in animation without `fill-mode: forwards` leaves the element at `opacity: 0` when the animation ends — because the element's original style is `opacity: 0`, and the animation no longer applies.
- `forwards`: the element retains the styles from the last keyframe after the animation ends. A fade-in from `opacity: 0` to `opacity: 1` with `fill-mode: forwards` stays at `opacity: 1` after completion.
- `backwards`: the element gets the styles from the first keyframe during the delay period. Without `backwards`, the element shows its original styles during the delay, then jumps to the first keyframe when the animation starts.
- `both`: combines `forwards` and `backwards`. The element gets the first keyframe's styles during the delay and retains the last keyframe's styles after completion.

**`animation-direction` for ping-pong loops.** `alternate` makes the animation play forward on odd iterations and reverse on even iterations. Combined with `iteration-count: infinite`, this creates a seamless back-and-forth motion without needing to define the reverse path in `@keyframes`. A loading spinner that oscillates between two positions uses `animation: oscillate 1s ease-in-out infinite alternate`.

---

### Part 2: Interview Answer

CSS animations are defined with `@keyframes` rules. You specify percentage stops — 0% to 100% — and the browser interpolates between them. The animation shorthand packs a lot: name, duration, timing function, delay, iteration count, direction, fill mode, and play state.

The property that trips people up is `animation-fill-mode`. The default is `none` — the animation only applies during its duration. Before and after, the element shows its original styles. So a fade-in animation from `opacity: 0` to `opacity: 1` without `fill-mode: forwards` leaves the element at `opacity: 0` after the animation ends — it snaps back. `forwards` retains the last keyframe's styles. `backwards` applies the first keyframe's styles during the delay period — so if your first keyframe has `opacity: 0` and you have a 500ms delay, the element is invisible during the delay instead of showing at full opacity and then jumping to zero. `both` combines them. In practice, I use `forwards` for one-shot animations that should stay at their end state, and `both` when there's a delay.

`animation-direction` is useful for ping-pong loops. `alternate` plays forward on odd iterations and reverse on even ones. Combined with `iteration-count: infinite`, you get a seamless back-and-forth without writing the reverse path in `@keyframes`. A breathing animation — scale up, scale down, repeat — is two keyframes with `alternate` and `infinite`.

The performance rule from transforms carries through: animate `transform` and `opacity` inside your keyframes, not `width`, `top`, or `left`. The same compositor-only property advantage applies — animations on compositor-friendly properties avoid layout and paint, running on the compositor thread at 60fps.

---

### Part 3: Whiteboard / Live Coding

**Basic animation — a fade-in with fill-mode:**

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Without fill-mode — snaps back to opacity: 0 after animation ends */
.bad-fade {
  animation: fade-in 0.5s ease-out;
  /* Element starts at opacity: 0 (original style),
     animates to opacity: 1, then snaps back to opacity: 0 */
}

/* With fill-mode: forwards — stays at opacity: 1 */
.good-fade {
  animation: fade-in 0.5s ease-out forwards;
  /* Element starts at opacity: 0, animates to opacity: 1,
     and stays at opacity: 1 after completion */
}
```

<!-- ILLUSTRATIVE: Without forwards, the element's computed opacity after
the animation ends is its original value (0). With forwards, the
animation's last keyframe value (1) persists. Verify by inspecting the
element's computed styles in DevTools after the animation completes. -->

**`fill-mode: backwards` — the delay gotcha:**

```css
@keyframes appear {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Without backwards — element visible during delay, then jumps to from state */
.no-backwards {
  animation: appear 0.5s ease-out 1s;
  /* For 1 second (the delay), the element shows at opacity: 1, translateY: 0
     Then at the 1s mark, it jumps to opacity: 0, translateY: 20px
     Then it animates to the end state over 0.5s */
}

/* With backwards — element starts at from state during delay */
.with-backwards {
  animation: appear 0.5s ease-out 1s backwards;
  /* For 1 second (the delay), the element shows at opacity: 0, translateY: 20px
     Then at the 1s mark, it animates to the end state over 0.5s */
}
```

**Ping-pong loop with `alternate`:**

```css
@keyframes breathe {
  0% { scale: 1; }
  100% { scale: 1.1; }
}

.breathing {
  animation: breathe 2s ease-in-out infinite alternate;
  /* Scales up to 1.1, then back to 1, then up, then back...
     Smooth oscillation without defining the reverse path */
}
```

**Complete animation — a loading spinner:**

```css
@keyframes spin {
  from { rotate: 0deg; }
  to { rotate: 360deg; }
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  /* linear timing — constant speed for a spinner */
}

/* Pause/play control */
.paused {
  animation-play-state: paused;
}
```

<!-- ILLUSTRATIVE: The spinner uses border-top-color to create a visible
arc. The rotate animation spins the entire border, making the colored
arc orbit the circle. The linear timing function ensures constant
rotational speed. -->

**Multi-step keyframe — a bouncing dot:**

```css
@keyframes bounce {
  0%, 100% {
    translate: 0 0;
    scale: 1;
  }
  50% {
    translate: 0 -20px;
    scale: 1.1;
  }
}

.dot {
  width: 12px;
  height: 12px;
  background: #333;
  border-radius: 50%;
  animation: bounce 0.6s ease-in-out infinite;
  /* ease-in-out — slow at the top of the bounce, fast in the middle */
}
```

---

### Part 4: Follow-Up Questions

**Q: When would you use `animation` instead of `transition`?**

When the motion can't be expressed as a two-state change. Transitions work between a start and end state — hover on, hover off. Animations handle multi-step sequences: a loading spinner that rotates continuously, a pulsing effect that oscillates, a entrance that slides in then bounces. Animations also loop (`iteration-count: infinite`), play on page load without a state change, and have `direction: alternate` for ping-pong motion. If you find yourself adding a class just to trigger a transition and then removing it after a timeout, you probably want an animation instead.

**Q: What's the difference between `animation-fill-mode: both` and `forwards`?**

`forwards` retains the last keyframe's styles after the animation ends. `backwards` applies the first keyframe's styles during the delay period. `both` does both. The practical difference: if you have a delay, `forwards` alone shows the element's original styles during the delay, then the animation starts. `both` shows the first keyframe's styles during the delay. For a fade-in with a 500ms delay, `forwards` means the element is visible for 500ms then starts fading in. `both` means the element is invisible for 500ms then fades in. I use `both` when the first keyframe defines the pre-animation state.

**Q: Can CSS animations replace JavaScript animation libraries?**

For simple cases, yes — a spinner, a hover effect, a slide-in. CSS animations run on the compositor thread when targeting `transform` and `opacity`, so they're inherently smoother than JavaScript-driven animations on the main thread. But JavaScript animation libraries (GSAP, Framer Motion, Motion One) give you fine-grained control: timeline sequencing, scroll-triggered animations, physics-based easing, spring dynamics, and the ability to interrupt and reverse mid-animation with precise control. CSS animations are declarative — you define what happens, not how. JavaScript libraries are imperative — you define the exact behavior at each moment. For complex interaction design, JavaScript gives you control CSS can't match.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use `@keyframes` to define the animation and `animation-name` and `animation-duration` to apply it. Set `animation-iteration-count: infinite` for looping."

**Why this misses the point:** The junior answer knows `@keyframes` and the basic properties but doesn't know `fill-mode` — without `forwards`, one-shot animations snap back to their original state. It doesn't mention `direction: alternate` for ping-pong loops, doesn't know individual transform properties prevent composition conflicts in multi-property keyframes, and doesn't connect animation performance to compositor-friendly properties.

**Senior answer:**
"I define the keyframes with percentage stops and apply the animation via the shorthand. For one-shot animations that should stay at their end state, I use `fill-mode: forwards` — without it, the element snaps back to its original styles when the animation ends. For a delay where the element should be hidden before the animation starts, I use `backwards` or `both`. For ping-pong loops, `direction: alternate` plays forward on odd iterations and reverse on even ones — seamless oscillation without duplicating the reverse path in keyframes. Inside the keyframes, I animate `transform` and `opacity` for compositor-only performance. And I use individual transform properties (`translate`, `rotate`, `scale`) so animating one doesn't overwrite the others across keyframes."

**The tell:** The junior answer lists `@keyframes` and `animation-name`/`duration`. The senior answer knows `fill-mode` is required to keep the final state, `direction: alternate` for ping-pong, and individual transform properties for composition conflicts.

---

### Part 6: Production Examples

A team building an onboarding flow had a multi-step animation sequence: a tooltip slides in from the right, pauses for 2 seconds, then fades out. The original implementation used three separate animations chained with JavaScript timeouts. The problem: the timeouts drifted on slow devices, causing the fade-out to start before the slide-in finished, or the pause to be shorter than intended. They consolidated into a single `@keyframes` rule with percentage stops: 0-40% slide in, 40-70% pause (holding the final position), 70-100% fade out. One `animation` declaration, zero JavaScript timers, and the timing was always correct because the browser controlled the entire sequence.

A design system team had an icon animation library where icons rotate, pulse, and bounce. The original keyframes used `transform: rotate(360deg)` in `@keyframes spin`. But some icons also had `transform: scale(1.5)` in their base CSS. When the spin animation applied, it overwrote the scale — the icon shrunk to its original size during the animation. The fix was migrating to individual transform properties: the base CSS set `scale: 1.5` and the animation only keyframed `rotate: 360deg`. The scale was preserved throughout the animation because individual properties compose independently. The migration required updating every keyframe rule in the library, but eliminated an entire class of "icon shrinks during animation" bugs.

---

## Topic 4 — GPU Performance

### Part 1: Theory

The browser renders each frame through a pipeline: **layout** (calculate positions and sizes) → **paint** (draw pixels onto layers) → **composite** (assemble layers for display on screen). Each stage is more expensive to trigger than the previous one. Layout triggers are the worst — they force the browser to recalculate positions for the entire affected subtree. Paint triggers are less expensive but still consume main-thread time. Composite-only changes are the cheapest — they skip layout and paint entirely.

**The four compositor-only properties.** `transform`, `opacity`, `filter`, and `clip-path` can be animated without involving layout or paint. The browser's compositor thread handles these properties on a separate layer, independent of the main thread. Here's why it's specifically these four:

- `transform` repositions the visual representation of an already-painted layer. The layout box stays put.
- `opacity` changes how a layer is blended with the layers beneath it. The layer's pixels are already painted; only the blending changes.
- `filter` applies a visual effect (blur, brightness, etc.) to an already-painted layer. The pixels are recalculated, but only within that single layer — no layout.
- `clip-path` changes the visible region of an already-painted layer. The pixels outside the clip path are hidden, not repainted.

Every other CSS property — `width`, `height`, `margin`, `padding`, `top`, `left`, `background-color`, `box-shadow`, `border-color`, `font-size` — triggers layout or paint. Animating `top` from `0` to `100px` forces layout recalculation on every frame. Animating `transform: translateY(100px)` doesn't.

**`will-change` — a hint with a real cost.** `will-change: transform` tells the browser "this element will be animated, promote it to its own compositor layer now." This avoids the flash of unstyled content (FOUC) when an animation starts — without `will-change`, the browser promotes the element to a compositor layer when the animation begins, which can cause a brief layout shift. But every compositor layer consumes GPU memory. If you add `will-change` to every element on the page, you create dozens or hundreds of layers, each consuming memory. On memory-constrained devices (mobile, older laptops), this can cause the browser to run out of compositor layers and fall back to main-thread rendering — the opposite of the intended performance improvement. The rule: add `will-change` only to elements you've profiled and confirmed need it. A navigation menu that slides in/out frequently? Yes. A static paragraph? No.

**GPU promotion hacks.** Before `will-change` existed, developers used `transform: translateZ(0)` or `transform: translate3d(0, 0, 0)` to force GPU layer promotion. These work because any 3D transform function creates a compositor layer. `will-change: transform` is the semantically correct modern approach — it communicates intent rather than abusing a transform function. The hacks still work but should be replaced with `will-change` in new code. If you see `translateZ(0)` in a codebase, it's either legacy code or a developer who hasn't learned about `will-change`.

---

### Part 2: Interview Answer

The browser renders frames through a three-stage pipeline: layout calculates positions and sizes, paint draws pixels onto layers, and composite assembles those layers for display. The key performance insight is that not all CSS properties trigger all three stages. Animating layout properties — `width`, `top`, `margin` — forces the browser to recalculate layout on every frame, which is expensive and blocks the main thread. That's what causes jank.

Four properties bypass layout and paint entirely: `transform`, `opacity`, `filter`, and `clip-path`. The compositor thread handles them on a separate layer, independent of the main thread. `transform` repositions an already-painted layer. `opacity` changes blending. `filter` applies visual effects to existing pixels. `clip-path` changes the visible region. None of them require the browser to recalculate positions or repaint pixels. That's why `transform: translateY(100px)` is smooth at 60fps while `top: 100px` causes jank — the same visual result, completely different rendering cost.

`will-change` is a hint that tells the browser to promote an element to its own compositor layer before the animation starts. It's useful for frequently animated elements — a sliding navigation menu, a modal that fades in. But every compositor layer consumes GPU memory. Add `will-change` to every element and you create so many layers that the browser runs out of memory and falls back to main-thread rendering. The correct approach: profile first, add `will-change` only to elements that actually need it, and remove it when the animation is no longer relevant.

The old hack was `transform: translateZ(0)` — it forced GPU promotion by triggering a 3D transform. It works, but `will-change: transform` is semantically correct and should be preferred in modern code.

---

### Part 3: Whiteboard / Live Coding

**The rendering pipeline — which properties trigger which stage:**

```css
/* Triggers LAYOUT — positions and sizes must be recalculated */
.layout-trigger {
  width: 200px;        /* layout */
  height: 100px;       /* layout */
  margin: 20px;        /* layout */
  padding: 10px;       /* layout */
  top: 50px;           /* layout */
  left: 30px;          /* layout */
  font-size: 16px;     /* layout (text reflow) */
}

/* Triggers PAINT — pixels must be redrawn */
.paint-trigger {
  background-color: red;   /* paint */
  box-shadow: 0 4px 8px;   /* paint */
  border-color: blue;      /* paint */
  color: white;            /* paint */
}

/* COMPOSITOR ONLY — no layout, no paint */
.compositor-only {
  transform: translateX(100px);  /* composite only */
  opacity: 0.5;                 /* composite only */
  filter: blur(4px);            /* composite only */
  clip-path: circle(50%);       /* composite only */
}
```

<!-- ILLUSTRATIVE: In DevTools Performance panel, animating `left` shows
Layout and Paint events on every frame. Animating `transform` shows only
Composite events — no Layout or Paint. This is the empirical proof that
compositor-only properties are cheaper. -->

**`will-change` — the correct and incorrect usage:**

```css
/* Correct — frequently animated element */
.nav-menu {
  will-change: transform;
  /* Promoted to compositor layer in anticipation of animation */
}

/* Incorrect — adding to every element */
* {
  will-change: transform;
  /* Creates a compositor layer for every element on the page */
  /* Consumes GPU memory, can hurt performance */
}

/* Correct pattern — add dynamically, remove after */
.card {
  /* No will-change by default */
}

.card.will-animate {
  will-change: transform;
  /* Add before animation starts */
}

.card.animated {
  transform: translateY(-10px);
  /* Animation runs on compositor layer */
}

/* Remove will-change after animation completes to free GPU memory */
```

<!-- ILLUSTRATIVE: The dynamic pattern (add will-change before animation,
remove after) gives you the performance benefit without the memory cost
of permanent layers. In practice, this means adding will-change via
JavaScript class toggling, not in the static CSS. -->

**GPU promotion hacks — legacy vs modern:**

```css
/* Legacy hack — forces GPU promotion via 3D transform */
.force-gpu {
  transform: translateZ(0);
  /* or: transform: translate3d(0, 0, 0); */
  /* Works, but semantically misleading — you're not actually
     doing a 3D transform, you're forcing a compositor layer */
}

/* Modern approach — same result, correct semantics */
.force-gpu-modern {
  will-change: transform;
  /* Communicates intent: "this element will be animated" */
}

/* If you see this in a codebase, it's either legacy or
   a developer who hasn't learned about will-change */
```

**Performance comparison — left vs transform:**

```css
/* BAD — triggers layout on every frame */
.slide-left-bad {
  position: relative;
  transition: left 0.3s ease;
}

.slide-left-bad:hover {
  left: 100px;
  /* Browser recalculates layout every frame */
  /* Other elements may reflow */
  /* Main thread blocked */
}

/* GOOD — compositor only, no layout */
.slide-right-good {
  transition: transform 0.3s ease;
}

.slide-right-good:hover {
  transform: translateX(100px);
  /* No layout recalculation */
  /* No paint */
  /* Compositor thread handles it */
  /* Main thread free for JavaScript */
}
```

<!-- ILLUSTRATIVE: The visual result is identical — the element moves
100px to the right. The rendering cost is completely different. In the
Performance panel, the left animation shows yellow (Layout) and green
(Paint) events on every frame. The transform animation shows only
blue (Composite) events. -->

---

### Part 4: Follow-Up Questions

**Q: How do you identify paint storms in DevTools?**

Open the Performance panel, record a session while interacting with the animation, and look at the main thread timeline. Layout events are yellow, paint events are green, composite events are blue. If you see yellow and green bars on every frame during an animation, you're triggering layout and paint. Switch the animated property to `transform` or `opacity` and the yellow/green bars disappear — only blue composite events remain. The Layers panel (in the Rendering tab) also shows the number of compositor layers. If the layer count spikes during animation, you may need `will-change` — or you may have too many layers already.

**Q: When should you remove `will-change`?**

When the animation is no longer relevant. If a modal fades in once and stays visible, remove `will-change` after the entrance animation completes — the compositor layer is no longer needed. If a hover effect animates on mouseenter and reverses on mouseleave, you could add `will-change` on mouseenter and remove it on mouseleave. The pattern: `will-change` is a temporary promotion, not a permanent state. Leaving it on permanently wastes GPU memory. In practice, the cost of a few permanent `will-change` declarations is negligible — it becomes a problem at scale, when dozens of elements all have permanent layers.

**Q: Does `filter: blur()` perform well?**

`filter` is compositor-only, so it doesn't trigger layout or paint. But blur is more expensive than opacity or transform because it reads and modifies every pixel in the layer. A full-screen blur is significantly more expensive than a small-element blur. The performance impact depends on the size of the layer being blurred — a 10px blur on a small icon is cheap; a 20px blur on a full-screen overlay is expensive. If you're blurring large areas, test on low-end devices. The compositor handles it off the main thread, so it won't cause JavaScript jank, but it can cause frame drops on weak GPUs.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Use `transform` for animations because it's faster. Add `will-change: transform` to every element that might animate to force GPU acceleration."

**Why this misses the point:** The junior answer knows `transform` is faster but doesn't explain why — it skips layout and paint, running on the compositor thread. It recommends `will-change` universally, which creates too many compositor layers and consumes GPU memory. A senior engineer knows the rendering pipeline, names all four compositor-only properties, uses `will-change` only after profiling, and can identify paint storms in DevTools.

**Senior answer:**
"The browser renders through layout → paint → composite. Animating `width`, `top`, or `margin` triggers layout on every frame — that's what causes jank. Four properties bypass layout and paint entirely: `transform`, `opacity`, `filter`, and `clip-path`. They run on the compositor thread, which is separate from the main thread, so they don't block JavaScript. `will-change: transform` promotes an element to its own compositor layer — useful for frequently animated elements like a sliding nav menu, but every layer consumes GPU memory. Add it to every element and you create so many layers the browser falls back to main-thread rendering. Profile first, add `will-change` only to elements that need it, and remove it when the animation is done. The old `transform: translateZ(0)` hack works for the same reason, but `will-change` is semantically correct and should be preferred."

**The tell:** The junior answer recommends `will-change` universally. The senior answer names the four compositor-only properties, explains the rendering pipeline, and knows `will-change` has a real memory cost.

---

### Part 6: Production Examples

A team building a scroll-heavy marketing site had a parallax effect where background images moved at different speeds as the user scrolled. The original implementation animated `background-position` on scroll events. On mid-range devices, the scroll performance was terrible — the background position change triggered paint on every frame, and with multiple parallax sections visible, the paint cost multiplied. The fix was switching to `transform: translateY()` on the image elements themselves, removing them from the scroll-triggered paint path. The compositor handled the transforms off the main thread, and scroll performance went from 20fps to 60fps on the same devices. The visual result was identical — images moved at different speeds — but the rendering path was completely different.

A different team had an e-commerce product page with a zoom-on-hover effect. The product image had `will-change: transform` permanently declared because "it might animate." On mobile devices with limited GPU memory, the permanent compositor layer for the large product image consumed memory that was needed for other layers. When the user scrolled quickly, the browser hit its layer limit and fell back to software rendering — the entire page became janky, not just the image. The fix was adding `will-change: transform` dynamically on `mouseenter` and removing it on `mouseleave`. The image only occupied a compositor layer during the actual hover interaction, freeing GPU memory the rest of the time.

---

## Tie the Chain Together

Transforms move elements without affecting layout — that's why they're the correct tool for animation and the reason `position: fixed` gotchas arise when transforms create new containing blocks. Session 16 established that `transform`, `filter`, and `will-change` create stacking contexts; this session explains the underlying mechanism: those properties promote elements to compositor layers, which is a side effect of GPU compositing. The stacking context creation is a rendering behavior, not an intentional design — it's a consequence of how the compositor works.

Transitions and animations are both mechanisms for changing CSS values over time, but they serve different purposes. Transitions are reactive — they animate between two states in response to a property change, ideal for hover effects and toggles. Animations are self-contained — `@keyframes` defines the full motion, ideal for looping, multi-step sequences, and animations that play on page load without a state change. The `transition-behavior: allow-discrete` property bridges the gap, enabling transitions on discrete properties like `display` for exit animations.

GPU compositing is what makes smooth animation possible — but it requires animating the right properties (`transform`, `opacity`, `filter`, `clip-path`) and using `will-change` deliberately rather than preemptively. The rendering pipeline is layout → paint → composite. Compositor-only properties skip the first two stages, running on a separate thread at 60fps. Every other property triggers layout or paint, blocking the main thread and causing jank. The practical rule: animate `transform` instead of `top`/`left`/`width`/`height`. Animate `opacity` instead of `visibility` or `display`. This is not a preference — it's the difference between smooth and janky.

Session 19 continues with container queries and modern CSS, covering the newer features that change how responsive design and internationalization work.

---

## Cross-References

- Session 15 (`book/03-css-mastery/15-cascade-specificity-inheritance.md`) — cascade rules and specificity governing how animation and transition values resolve.
- Session 16 (`book/03-css-mastery/16-box-model-positioning.md`) — stacking context creation by `transform`, `filter`, and `will-change`; the `position: fixed` exception when transforms create containing blocks.
- Session 17 (`book/03-css-mastery/17-flexbox-grid-when-to-use-which.md`) — Flexbox and Grid layout, which create formatting contexts where transform behavior differs from normal flow.
