# Event Loop, Microtasks, and Macrotasks

> Four connected topics that turn one paragraph from Session 1 into the full execution model: the event loop decides what runs on the single call stack, macrotasks are the queue it pulls from, microtasks get to cut in front of every macrotask, and async/await is just sugar over that same microtask queue. This session is where Session 1's "if the call stack is empty, take the next task from the queue" line gets its complete treatment. Every ordering claim here is verified by a logged sequence in `examples/01-javascript-mastery/05-event-loop-microtasks-macrotasks.test.ts` — not asserted from a mental model.

---

## 1. The Event Loop

### Part 1 — Theory

JavaScript is single-threaded by design: exactly one call stack per thread, as established in Session 1 (`01-execution-context-callstack-scope.md`). The stack runs synchronous code, and only synchronous code. When a `setTimeout`, Promise, or DOM event fires, its callback doesn't go directly onto the stack — it goes into a queue, and the event loop decides when to lift it onto the empty stack.

Why single-threaded at all? Because the script and the UI share state. If a click handler could run while a render pass was mid-mutation, every piece of browser state would need locking, and JavaScript chose the other road: one thread, no locks, and any asynchronous work must schedule itself around that thread. The price is the risk of blocking — a long synchronous task freezes everything — and the payoff is that no two pieces of JavaScript ever interleave mid-function.

The "but then how does I/O work?" answer is the second half of the model: **the I/O doesn't happen on the JavaScript thread.** The runtime — the browser or Node — owns the sockets, timers, and files. When `fetch()` is called, the network work happens on browser-internal threads and processes; when the response arrives, the browser queues a callback so JavaScript can react. The JS thread never waits. It finishes its current synchronous work, and the event loop's only job is deciding what runs next on the now-empty stack.

The loop, precisely: run synchronous code to completion → when the stack is empty, process the **entire microtask queue** → take exactly **one macrotask** from the task queue → in a browser, possibly render → repeat. The loop is hosted by the runtime, not by the engine: V8 provides the stack and the microtask machinery, but the task queues and the loop itself belong to the browser or to Node. That's why the same JavaScript behaves identically in both, while the loop underneath them has different-shaped gears.

Where this shows up in production: every interaction latency problem is a story about this loop. A long task blocks the drain; a microtask flood starves the tasks; a timer storm delays rendering. All three are this section's follow-ups.

### Part 2 — Interview Answer

The mental model that gets you through every question in this topic: JavaScript has one call stack, and the event loop is the traffic cop that decides what runs on it next. The stack only runs synchronous code — that's from Session 1. When a setTimeout, a promise callback, or a DOM event fires, its handler doesn't go straight onto the stack. It goes into a queue, and the event loop continuously checks: if the call stack is empty, take the next thing from the queue and push it onto the stack.

The reason a single-threaded language can handle a network request without freezing is that the actual I/O never happens on that thread. The browser owns the sockets and the timers. JavaScript just gets a callback queued when the work is done. So the thread never blocks on I/O — it blocks only on synchronous CPU work, which is a completely different failure mode.

The loop itself is simple, and the ordering is the part people get wrong: the stack runs the current synchronous code to completion. When it's empty, the event loop drains the microtask queue — and I mean the entire queue, including microtasks that other microtasks queue while it's draining. Then it takes exactly one macrotask from the task queue. Then in a browser it may render a frame. Then it repeats. Two queues, two priorities, one rule: microtasks always cut in front of macrotasks, no matter which was scheduled first.

What makes this answer senior is knowing what the loop is for. It doesn't execute I/O — it decides what runs next on the one stack. And that's why a long synchronous function is so expensive: nothing gets dequeued until the stack is empty. A three-second synchronous computation freezes the click handler, the animation frame, everything — because the loop has no chance to lift anything off the queues.

If I'm walking out of the room with one sentence: synchronous code runs, then the entire microtask queue, then one task, then repeat — and most async ordering bugs are people forgetting which queue their callback is sitting in.

### Part 3 — Whiteboard / Live Coding

The classic ordering question, solved by tracing the loop rather than by pattern-matching:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/05-event-loop-microtasks-macrotasks.test.ts
console.log("a");
setTimeout(() => console.log("b"), 0);
Promise.resolve().then(() => console.log("c"));
console.log("d");
```

Predicted output, using only the rules from Part 1: `a, d, c, b`.

The trace, narrated the way you'd say it live:

1. **`a`** — synchronous code runs to completion. `console.log("a")` executes on the stack.
2. `setTimeout(..., 0)` — the callback does not run now. It is queued as a macrotask. Note it was scheduled *before* the promise was — scheduling order is irrelevant; queue class is what matters.
3. `Promise.resolve().then(...)` — the reaction is queued as a microtask.
4. **`d`** — still the same synchronous block, so it runs before either callback. The stack is now empty.
5. **`c`** — the event loop checks the microtask queue first, and it must be drained entirely. It contains exactly one microtask, so `c` runs.
6. **`b`** — with the microtask queue empty, the loop takes the oldest macrotask from the task queue: the timer callback. `b` runs.

The interviewer's follow-up is usually "what if there were two timers?" — answer: the task queue is FIFO, so the timer scheduled first runs first, still after every microtask. The whole prediction is asserted as a sequence array in the harness, including the two-queue version where a second timer must wait for microtasks queued mid-task.

### Part 4 — Follow-Up Questions

**Q: Is JavaScript really single-threaded?**

The language's execution model is: one call stack per thread. But the platform is not single-threaded — the browser's main thread, compositor, GPU process, and network processes run in parallel, and Web Workers give you additional JS threads, each with its own stack and its own event loop. Workers just can't touch the DOM — they communicate by message passing. SharedArrayBuffer is the one escape hatch for true shared memory, and it ships with the memory-safety constraints to prove it. The correct sentence is "JavaScript execution is single-threaded," not "the browser is single-threaded."

**Q: Where does the event loop live?**

In the host runtime, not the engine. V8 implements the stack, the heap, and the microtask machinery; the browser (or Node) hosts the task queues and the loop that services them. This is why the same JS spec behavior plays out in two different-looking loops: the browser's rendering-and-input model versus Node's phase-based loop (timers, poll, check, and its own Node-only additions like `process.nextTick`). The language spec defines queues and ordering; each host implements them.

**Q: What actually blocks the loop?**

Only synchronous CPU work on the stack: a huge loop, `JSON.parse` of a giant payload, pathological regex backtracking, a synchronous `atob` on megabytes. I/O never blocks the thread — that's the entire point of the design. When you profile a frozen page, you're looking for a long task; when you see it, the fix is chunking the work across tasks, moving it to a Worker, or both.

### Part 5 — Common Mistakes

**Junior/mid answer:** "JavaScript is single-threaded, so it can't do real I/O — that's why callbacks exist."

**Senior answer:** Wrong mechanism. The thread doesn't wait on I/O because the I/O happens elsewhere — browser-internal threads own the sockets, and the JS thread is only handed a queued callback when work completes. Callbacks exist to hand work to the loop, not because the thread is weak. The thread blocks only on synchronous CPU work, and that's a bug to be hunted, not a design feature.

**Another junior tell:** "The event loop is part of the JavaScript engine."

**Senior correction:** The engine provides the stack and microtask support; the event loop is hosted by the embedder — the browser or Node. That's why you can run the same V8 in a browser, in Node, and in a Chrome extension's service worker, and get the same language semantics under three different loop implementations. When an interviewer asks "who owns the event loop?", the answer "the runtime, not the engine" is the senior signal.

### Part 6 — Production Examples

**Real incident — Long task freezing a metrics dashboard:** A monitoring dashboard recomputed its aggregate charts synchronously whenever new data arrived. With one particular tenant's dataset, the aggregation took roughly two seconds of pure CPU time on the main thread. The symptom was a page that accepted clicks but appeared dead — every click handler was queued behind the running task, and Interaction to Next Paint metrics were in the red. The fix was chunking the aggregation into slices scheduled as tasks, so the loop could service input and rendering between chunks, and moving the heavy path to a Web Worker entirely. The diagnostic that found it was the Performance panel's long-task markers — a synchronous block spanning thousands of milliseconds with nothing else running in between. (Core Web Vitals and profiling get their own treatment in Sessions 27 and 31.)

**Real incident — Sync XHR era thought-stopper:** An older internal tool made synchronous `XMLHttpRequest` calls on the main thread to keep its data flow simple. Each request pinned the thread for the full round trip — the event loop starved for hundreds of milliseconds, and clicks during that window were queued or lost. The modernization effort's first change wasn't the framework upgrade; it was converting those calls to `fetch`, which is asynchronous by design, and letting the loop breathe again. The lesson codified for the team: if a line of code makes the thread wait on I/O, the fix is to stop the thread from being involved in the waiting.

---

## 2. Macrotasks

### Part 1 — Theory

A **macrotask** (usually just "task") is a unit of work from the task queue: `setTimeout`/`setInterval` callbacks, I/O completion callbacks (the arrival of `fetch` response data, for instance), and user-interaction events like `click` or `keydown`. The browser groups tasks by **task source** — timers, user interaction, networking, and a few others — so it can prioritize one source over another (a click handler outranks a background timer). Within a source, the queue is strictly FIFO.

The load-bearing rule is **one macrotask per loop iteration**: the event loop runs the oldest task from the queue, then drains the entire microtask queue, then (in a browser) may render a frame, then picks the next task. Two consequences follow directly. First, microtasks scheduled *while a task is running* run before the *next* task — a timer callback that queues a promise reaction will see that reaction execute before the next timer fires. Second, the loop never "catches up" a burst of expired timers mid-iteration; they run one per iteration, in order.

Timer accuracy is a myth worth killing in the interview room. `setTimeout(fn, 0)` does not run in 0ms — the delay is a *minimum* wait before the callback is queued as a task, and then it still waits for the stack to empty and the microtask queue to drain. On top of that, browsers enforce a **4ms clamp**: once a chain of nested timers reaches a nesting level of about five, delays under 4ms are raised to 4ms (specified in the HTML standard, verified against it for this session). Background tabs get hit harder — Chrome clamps timers to roughly once per second and Firefox to once per ten seconds. And `setInterval` is not a metronome: it re-queues on schedule regardless of whether the previous callback finished, so a slow callback makes interval callbacks pile up. That's the standard case for recursive `setTimeout` instead.

Two things that are *not* macrotasks, because they get asked: `requestAnimationFrame` callbacks are not queued from the task queue at all — they run in the rendering step, before style, layout, and paint, only when the browser has a rendering opportunity. And a promise reaction is not a task — it's a microtask, the subject of Section 3.

### Part 2 — Interview Answer

A macrotask is a unit of work from the task queue — a timer callback, an I/O completion, a click handler. And the rule that governs them all is: the event loop runs one macrotask, then drains the entire microtask queue, then in a browser it may render, then it takes the next macrotask. One task per iteration. That's the sentence to remember.

What that means in practice: a timer callback that queues a promise sees that promise's callback run before the next timer fires — the microtask drain happens between tasks, not after them all. And a promise scheduled before a timer still loses to... no, wait — a promise scheduled before a timer always runs first, because microtasks outrank tasks entirely. The scheduling moment doesn't matter. Queue class does.

The details worth knowing: setTimeout's delay is a minimum, not a promise. Zero doesn't mean zero — the callback still waits for the current synchronous code, the microtask drain, and its place in the FIFO. And browsers clamp: nested timers past about five levels deep get a 4ms floor, and background tabs get throttled to about once a second or worse. So a polling loop built on setInterval keeps firing in a background tab, burning battery, and the browser eventually stops caring how urgent you think your update is.

Which is why recursive setTimeout is the senior default for anything recurring: it gives you a per-invocation delay, it never piles up callbacks when one runs long, and you can change the delay between calls — exponential backoff, jitter, pause on tab visibility. setInterval just keeps re-queuing on a fixed schedule and lets slow callbacks stack on top of each other.

One more boundary to state clearly: requestAnimationFrame callbacks are not macrotasks. They don't come from the task queue at all — they run in the rendering step, before paint, only when there's a rendering opportunity. Timers are the task queue; animation frames are the render pipeline. The moment you animate with timers instead of rAF, you've chosen the wrong queue for the job.

### Part 3 — Whiteboard / Live Coding

Demonstrate the one-task-per-iteration rule and the between-tasks drain:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/05-event-loop-microtasks-macrotasks.test.ts
const order: string[] = [];

setTimeout(() => {
  order.push("t1");
  // queued while t1 is running — still beats t2, because the drain
  // happens after EVERY task, not after every "batch" of tasks
  queueMicrotask(() => order.push("t1-micro"));
}, 0);
setTimeout(() => order.push("t2"), 0);
queueMicrotask(() => order.push("pre-micro"));
Promise.resolve().then(() => order.push("pre-promise"));
```

Predicted order: `pre-micro, pre-promise, t1, t1-micro, t2`. The trace:

1. `pre-micro` and `pre-promise` are queued as microtasks before any timer has fired. When the synchronous block ends, the microtask queue drains first — both run before the first timer.
2. `t1` is the oldest task in the queue, so it runs next — one macrotask for this iteration.
3. While `t1` runs, `t1-micro` is queued. The microtask drain runs it *before the loop takes another task*.
4. `t2` runs last, even though it was scheduled at the same moment as `t1`.

The sharp edge this test is guarding: microtasks created *during* a task's execution still outrank the next task. The full sequence is asserted verbatim in the harness — if an implementation ever interleaved `t2` before `t1-micro`, the assertion fails.

### Part 4 — Follow-Up Questions

**Q: How accurate is `setTimeout(fn, 0)`?**

Not at all accurate, and the inaccuracy is spec, not jitter. The delay is a minimum before the callback is queued as a task — then it waits for the running synchronous code, the full microtask drain, and its FIFO position. Beyond that, browsers clamp nested timers to 4ms after roughly five nesting levels, and background tabs get throttled to about once a second (Chrome) or once per ten seconds (Firefox). The practical lesson: never use timer delays as a synchronization mechanism, and never measure time with a timer — use `performance.now()`.

**Q: `setInterval` versus recursive `setTimeout` — which one, and why?**

Recursive `setTimeout` in production. `setInterval` re-queues on schedule even if the previous callback is still running, so a slow callback means overlapping executions — a polling interval that backs up into itself. Recursive `setTimeout` waits for the callback to finish before scheduling the next one, gives you a fresh delay value per call (backoff, jitter, pause), and never piles up. The one legit `setInterval` use is a hard heartbeat where overlap is tolerable.

**Q: Are DOM event handlers macrotasks?**

Yes. User-interaction events like `click` and `keydown` are queued on the user-interaction task source. That's why a handler attached with `addEventListener` runs after the current synchronous code and the microtask drain — and why a long task makes clicks feel dead: the click is queued as a task behind the running work. It's also why the browser can prioritize input over background timers — separate task sources are deliberately reorderable.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`setTimeout(fn, 0)` runs the callback as soon as possible — basically immediately after the current line."

**Senior answer:** It runs after the entire synchronous block *and* after every pending microtask — and "zero" isn't zero anyway. The callback is queued as a task after a minimum delay, then waits for the stack to empty, then waits behind the microtask queue, then behind earlier tasks in the FIFO. If you've ever seen `setTimeout(0)` lose to a promise scheduled later, that's not a bug — that's the priority model working exactly as specified.

**Another junior tell:** "`setInterval(fn, 1000)` fires every second, guaranteed."

**Senior correction:** It fires *at least* 1000ms apart, measured from when each callback was queued, not when it finished. If the callback takes 900ms, intervals back up. And in a background tab the browser unilaterally rewrites your interval to something much slower. The senior move is recursive `setTimeout`, which keeps every invocation self-contained.

### Part 6 — Production Examples

**Real incident — Battery drain from background polling:** A chat application polled its message endpoint with `setInterval(fn, 5000)` from page load until page close. In the foreground that's fine; in a background tab it kept firing for hours, keeping the network and the JS engine busy on a page nobody was looking at, and the tab's throttled-but-still-firing timers showed up as a constant background CPU burn in the energy panel. The fix was a combination the team would later codify: recursive `setTimeout` instead of `setInterval`, a `visibilitychange` listener that pauses the loop when the tab hides, and an immediate sync on `visibilitychange` when it returns. The lesson: timers are a visibility-sensitive resource, not a free metronome. (Realtime transport gets its own chain in Session 62.)

**Real incident — Timer-based animation stutter:** A web-game HUD animated a progress bar with a `setInterval(fn, 16)` loop. In a background tab, throttling turned the animation into a slideshow; in the foreground, timer jitter occasionally doubled a frame's wait. Replacing the interval with `requestAnimationFrame` fixed both: rAF runs in the rendering step with a fresh timestamp, synchronizes with the display refresh, and the browser simply stops calling it when the tab is hidden instead of calling it slowly. The HUD needed the render pipeline's clock, not the timer queue's.

---

## 3. Microtasks and Their Priority

### Part 1 — Theory

A **microtask** is a smaller unit of work that runs in the gap between macrotasks. The three sources: promise reaction callbacks (`.then`, `.catch`, `.finally`), `queueMicrotask()` directly, and in browsers, `MutationObserver` notifications. What unites them is the scheduling rule — the strongest rule in this entire session, and the most commonly misstated:

**When the event loop drains the microtask queue, it drains it to empty — including microtasks that are queued by microtasks while the drain is in progress.** The loop takes one macrotask, then processes microtasks until the queue is empty, then takes the next macrotask. There is no fairness round-robin between the two queues. A microtask can be queued from inside a microtask, which queues another, and every one of them runs before the next macrotask gets a turn — verified for this session by a test that nests three levels of microtask queueing behind a timer that was scheduled first (see Part 3).

Within the queue itself, ordering is FIFO: `queueMicrotask` callbacks and promise reactions are just items in the same queue, in scheduling order. A promise reaction scheduled after a `queueMicrotask` callback runs after it. This is also why the full-drain rule is easy to understate: people accept "microtasks run before the next task" and then imagine a single round — "one microtask per task" — which is precisely wrong, and precisely what the nested test catches.

The rule exists because microtasks are the engine's way of letting a chain of promises complete without handing control back to the host's task machinery between links. A `Promise.all` of five fetches, each resolving through several `.then`s, settles as one uninterrupted burst. The cost of that priority is starvation: a microtask that unconditionally queues another microtask runs forever and the event loop never reaches a macrotask — timers, input, and rendering all wait. A task loop, by contrast, yields between iterations by construction. Microtask loops do not.

Practically, the queue is where you put work that must run after the current synchronous block but before the next task — and critically, before rendering. That "before rendering" property is why `queueMicrotask` is the right tool for read-then-write batching in the browser: batch the reads and writes so they land before the next paint, not after it.

### Part 2 — Interview Answer

Microtasks are the queue that cuts in line. Promise callbacks, queueMicrotask, and in browsers MutationObserver notifications all land there, and the rule is absolute: when the event loop drains the microtask queue, it drains it completely, including microtasks that other microtasks queue while the drain is happening. Then — and only then — does the next macrotask run. There is no interleaving, no fairness between the two queues. Microtasks always win.

The detail that separates a strong answer from a weak one is the "including ones queued during the drain" part. Most people accept that a promise runs before a timer. Fewer realize that a microtask queued from inside a microtask still beats a timer that was scheduled long before either of them. I verify claims like this by writing a test that logs the sequence and asserts on the array — the timer queued first, the microtask chain queued after it, and the timer still runs last. That's the difference between repeating a mental model and knowing the behavior.

The cost of this priority is starvation. A microtask that queues another microtask is an infinite loop that never yields — the event loop never gets to a task, so input and rendering wait forever. Task loops yield between iterations; microtask loops don't. If you ever see a page where a promise chain spins and the timers never fire, that's the shape of the bug.

There's one Node-only wrinkle worth naming: process.nextTick is a separate queue with its own precedence, and it's not portable — it doesn't exist in browsers. This book is browser-focused, so nextTick is an aside, but the honest version of the claim is: in Node, nextTick callbacks can run before promise microtasks or after them depending on whether the current module context is CJS or ESM. It's platform-specific enough that I wouldn't put it on the main thread of an interview answer.

The senior closing note: microtasks are where you put work that must run after the current synchronous block and before the next task — and before paint. That ordering is what frameworks lean on for their post-batch flushes — Vue's `nextTick` is literally a promise-based microtask flush — and React's scheduler drives its work through the same task-queue machinery this session describes.

### Part 3 — Whiteboard / Live Coding

The test the prompt for this session flags as the most commonly misstated claim — the timer is queued *first*, the microtasks are queued *after* it, and the timer still runs last:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/05-event-loop-microtasks-macrotasks.test.ts
const order: string[] = [];

setTimeout(() => order.push("timer"), 0); // queued first — the "winner" by scheduling order

queueMicrotask(() => {
  order.push("mt-1");
  queueMicrotask(() => {
    order.push("mt-1.1");
    queueMicrotask(() => order.push("mt-1.1.1")); // queued during the drain, at depth 2
  });
});
Promise.resolve().then(() => order.push("promise-1"));
```

Predicted order: `mt-1, promise-1, mt-1.1, mt-1.1.1, timer`. Narrated:

1. The timer is queued as a task. Nothing else is queued yet — by any "fairness" model, it's first in line.
2. `queueMicrotask` and the promise reaction are queued. The microtask queue now holds `mt-1` then `promise-1` (FIFO).
3. The synchronous block ends. The loop drains the microtask queue: `mt-1` runs, and while running it queues `mt-1.1`.
4. The drain continues — `promise-1` runs (queued before `mt-1.1`), then `mt-1.1` runs and queues `mt-1.1.1`.
5. `mt-1.1.1` runs. The drain is *finally* empty. Only now does the loop lift the timer task onto the stack.

The harness asserts the exact array `["mt-1", "promise-1", "mt-1.1", "mt-1.1.1", "timer"]` — plus a companion test asserting FIFO between `queueMicrotask` and promise reactions, and one showing the starvation shape: a self-queuing microtask that postpones the timer indefinitely.

### Part 4 — Follow-Up Questions

**Q: Can microtasks starve the event loop?**

Yes, and it's the sharpest consequence of the full-drain rule. A microtask that queues another microtask unconditionally means the drain never ends — timers, input, and rendering never get a turn, and the page freezes exactly as if a synchronous infinite loop were running. The difference from a task loop is structural: a recursive `setTimeout` loop yields between iterations because each iteration is a task; a recursive `queueMicrotask` loop never yields at all. If you're building a long-running loop, structure it as tasks, not as a self-feeding microtask chain.

**Q: `queueMicrotask(cb)` versus `Promise.resolve().then(cb)` — what's the difference?**

Scheduling-wise, nothing meaningful: both enqueue a microtask on the same queue, in scheduling order, with identical priority — verified in this session's harness. Implementation-wise, `queueMicrotask` is the direct API with less machinery, while `.then` creates and returns a promise you can chain. Use `queueMicrotask` when you only want the deferred callback; use `.then` when the result feeds a chain. Also note `MutationObserver` callbacks in browsers are delivered as microtasks — which is why they observe and flush between tasks, not mid-task.

**Q: Node has `process.nextTick` — is that a microtask? (The honest, browser-scoped answer)**

This book is browser-focused, so this is the one-sentence aside, stated with its caveats: `process.nextTick` is Node-only, it is a *separate* queue from the promise microtask queue, and its precedence is not a universal "nextTick first" rule — the current Node documentation records that in CJS modules nextTick callbacks run before promise microtasks, while in ESM modules the promise microtasks already being drained run first. This session's harness verifies the behavior in this repo's own runtime (ESM, vitest on Node): promise microtasks queued during the drain complete before nextTick callbacks. The lesson is that "Node queue precedence" is context-dependent enough that the interview-safe version is "it's Node-specific, it's not portable, and I'd verify it in the exact runtime before depending on it" — which is itself the senior answer.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Microtasks and macrotasks alternate — a `setTimeout(0)` scheduled early can run between two promise callbacks."

**Senior answer:** No. The microtask queue is drained to emptiness before the next macrotask is even considered — including microtasks queued by microtasks during the drain. A timer scheduled *before* any promise still loses to a promise queued *inside another microtask*. This session's Part 3 test exists precisely because this is the most commonly misstated claim in the topic; the assertion is a logged sequence array, not a reasoned-through prediction.

**Another junior tell:** "Promises are async, so they're slower than timers — the timer callback should run first."

**Senior correction:** Scheduling priority and wall-clock latency are different things. A promise reaction is a microtask and outranks every macrotask regardless of when either was scheduled; the timer's wall-clock delay only sets *when the task is queued*, not its priority once queued. "Slower" confuses the queue class with the timer delay.

### Part 6 — Production Examples

**Real incident — Microtask starvation freezing a tab:** A data-sync library drained a queue of pending mutations by chaining `.then()` — each mutation's completion handler pulled the next item from the queue and chained another `.then`. Under a burst of mutations the chain kept the microtask queue non-empty indefinitely, and the tab's timers stopped firing: the retry-backoff timer, the idle heartbeat, and the tab's own render scheduling all starved. The page froze while the CPU burned. The fix was re-architecting the drain as tasks — one item per task via `setTimeout`-scheduled steps — so the loop could render and service input between items. The signature of this bug class: a promise chain that never returns to the task queue.

**Real incident — Microtask-batched DOM writes:** A component set hundreds of row styles in response to a data change, each write forcing a layout read-back to compute the next one. The team batched the work with `queueMicrotask`: collect all pending reads and writes during the current synchronous block, then flush the batch in one microtask — running after the block and, critically, before the next paint, so the browser never saw the intermediate states. This is the read-then-write pattern Session 26 will cover in depth; the scheduling half of it lives here, in the choice of a microtask that beats the render. It's the same queue Vue's `nextTick` flushes through for its post-update work — and the task-queue machinery React's scheduler drives — those frameworks will get their own treatment in Modules 7 and 8; the queues underneath them are this session's.

---

## 4. async/await as Promise Sugar

### Part 1 — Theory

`async`/`await` adds no new scheduling mechanism. It is syntax over the promise machinery of Section 3: an `async` function returns a promise, and `await` is a promise reaction wearing a disguise. Everything in this section is scoped to that scheduling equivalence — the promise state machine, chaining, and error handling get their full treatment in Session 6 (promises, async/await, and error handling).

Mechanically: an `async` function's body runs **synchronously until the first `await`**. When execution reaches `await x`, the value is normalized through the same resolution machinery a `.then()` chain would use, and the function suspends — control returns to the caller, and the call stack unwinds. Resumption happens as a microtask: the continuation after the `await` is queued on the same microtask queue that `.then` callbacks use, with the same FIFO position and the same priority over macrotasks. The verified consequence is that an `async` function's `await` resumptions interleave with plain `.then()` chains in strict scheduling order — neither kind gets priority over the other, because they're the same queue. The harness for this session asserts exactly that interleaving.

Two properties follow from this that people routinely get wrong. First, **`await` always yields, even when the awaited value is not a promise.** `await 1` is still a boundary: the function suspends and resumes as a microtask. There is no synchronous fast path. Second, **each `await` is one microtask hop** — so `await` in a loop is inherently sequential: each iteration suspends until the previous awaited operation's microtask resumes it. Parallel work requires `Promise.all` (which Session 82 covers as a utility pattern) or explicit batching, not a loop of `await`s.

The design rationale: `async`/`await` gives promise chains the readability of synchronous code — linear source, linear trace — while keeping the exact execution model of promises underneath. The stack unwinds at each boundary; the continuation runs later, on the queue. That is why "await makes this synchronous" is wrong in a way that matters: code after an `await` does not run in the same stack frame, and its position in the queue is governed by Section 3's rules, not by the source order you wrote.

### Part 2 — Interview Answer

Async and await is sugar over promises — and the sugar is purely syntactic, not scheduling. An async function returns a promise, and its body runs synchronously until the first await. At that point it suspends, the stack unwinds, and the continuation resumes as a microtask on the same queue that promise callbacks use. There is no second mechanism, no separate async queue, nothing new under the hood. Session 5's whole ordering model applies to it unchanged.

The proof I'd give live: interleave an async function with a raw .then chain. The async function runs its first line synchronously, then awaits; the .then chain runs its first line synchronously, then queues a reaction. Both boundaries land on the same microtask queue, so the resumptions alternate in strict scheduling order — async's second line, then the chain's second line, and so on, and a timer scheduled before any of it still runs last. I verified that exact interleaving with a test that asserts the logged sequence, and it matches what pure-promise reasoning predicts — because that's all it is.

The subtlety worth naming: await always yields, even when the value is already available. Awaiting a plain number is still a microtask boundary. There is no synchronous fast path, so code after an await never runs in the same stack frame as the code before it. And because each await is one microtask hop, an await inside a loop makes the loop sequential — each iteration waits for the previous one. If you want the requests in parallel, that's Promise.all, not a for-await loop.

Where this bites in production is the one-frame lag and the race. A state update written after an await isn't part of the gesture that triggered it — it's a separate microtask, possibly after other microtasks and even after a render opportunity. So you don't sprinkle awaits into event handlers and click paths without thinking about what they reorder.

The senior summary is short: async and await changed how promise code reads, not how it runs. Same queue, same priority, same drain rules. Session 6 picks up from here with the promise state machine and error handling — this section is only the scheduling half.

### Part 3 — Whiteboard / Live Coding

Prediction first, then verification — the interleaving that proves `await` is a `.then()` with better syntax:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/05-event-loop-microtasks-macrotasks.test.ts
const order: string[] = [];

async function asyncChain(): Promise<void> {
  order.push("async-1");
  await Promise.resolve();
  order.push("async-2");
  await Promise.resolve();
  order.push("async-3");
}

function thenChain(): Promise<void> {
  order.push("then-1");
  return Promise.resolve()
    .then(() => {
      order.push("then-2");
    })
    .then(() => {
      order.push("then-3");
    });
}

asyncChain();               // sync until its first await: "async-1"
thenChain();                // sync until its first .then: "then-1"
setTimeout(() => order.push("timer"), 0);
```

Predicted order, from Sections 2-3's rules only: `async-1, then-1, async-2, then-2, async-3, then-3, timer`.

1. Both bodies run synchronously in call order: `async-1`, then `then-1`.
2. The `await` in `asyncChain` queues its continuation as a microtask; the `.then` in `thenChain` queues its reaction as a microtask. Same queue, FIFO.
3. The drain alternates: `async-2` (queued first), `then-2`, then `async-3`, then `then-3` — each step re-queuing its own next step in the same order.
4. The timer — scheduled before any of the microtask steps — runs last, because it's a macrotask and the drain completed before it got a turn.

The companion verified case: `await 1` on a plain value still suspends — `f-start`, `sync-after-call`, `f-after-await`, `timer`. Both sequences are asserted as full arrays in the harness.

### Part 4 — Follow-Up Questions

**Q: Does `await` always defer, even when the value is already resolved?**

Yes — and this is the one most candidates answer wrong. `await` on a plain value, on an already-resolved promise, on anything, is still a microtask boundary. The spec performs the same resolution and reaction steps regardless of whether the value is ready, so the continuation is always queued, never run synchronously. Consequence: you cannot use `await` to "check if something is already done and skip the async part" — there is no sync fast path to skip into.

**Q: An `async` function with no `await` — does it run synchronously?**

The body runs synchronously to its return, exactly like a normal function; the `async` wrapper's only effect is that the return value is wrapped in a resolved promise. But that wrapper still matters for the caller: the caller must `.then`/`await` to observe completion or catch a rejection, and an unawaited call is a floating promise whose rejection becomes an unhandled rejection. That's error-handling territory, which is Session 6's chain; the scheduling point here is that no microtask is involved until the caller consumes the returned promise.

**Q: `await` inside a loop — parallel or sequential?**

Sequential, by construction. Each `await` suspends the loop iteration, and the loop body can't proceed until that iteration's continuation microtask resumes it. If you fire ten requests in a loop with `await fetch(...)` per iteration, you've serialized them — each one waits for the previous response. Parallelism needs `Promise.all` over a pre-built array of promises, or a batching strategy; "await in a loop" is a classic source of accidentally-sequential production loads.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`await` makes the code run synchronously — it just waits until the promise resolves."

**Senior answer:** It makes the code *read* synchronously, and that's the entire point of the sugar. The execution is still asynchronous: the stack unwinds at every `await`, and the continuation runs later as a microtask. "Waits" implies the thread pauses — it doesn't; the caller keeps running, and the continuation's place in the microtask queue follows Section 3's rules, not the source order. If code after an `await` seems to run "too late," the queue ordering is the explanation, not the syntax.

**Another junior tell:** "`async`/`await` is a different kind of scheduling than promises — it's cleaner, so it's a separate system."

**Senior correction:** Identical scheduling. `await` resumptions and `.then` callbacks share one queue, one priority, and one drain — verified in this session's interleaving test, where an async function and a raw chain alternate FIFO because they are literally the same queue. Cleaner syntax, same engine.

### Part 6 — Production Examples

**Real incident — Serial asset loading in a web game:** An HTML5 game's asset loader used `for (const asset of manifest) { const tex = await load(asset); register(tex); }` — the natural reading, and wrong for performance: every texture loaded over the network one at a time, each `await` suspending the loop until the previous fetch resolved. On a slow connection the manifest of ~120 small textures took minutes instead of seconds. The fix was `Promise.all` over the manifest with a progress callback, reserving `await`-in-loop for the genuinely sequential steps (initialize → load → start). The game loop and asset pipeline get their own treatment in Module 13; the scheduling half of the bug is this session's `await`-in-loop rule.

**Real incident — One-frame flicker from an awaited toggle:** A component's click handler awaited a fetch before toggling a loading state: `await fetch(...)` then `showSpinner = true`. The await boundary deferred the toggle by a microtask hop plus the network — and because the continuation lands in the queue, the frame that painted right after the click showed the pre-toggle UI, then the spinner appeared a frame (or more) later, reading as a flicker on high-refresh displays. The fix was setting the loading state *before* the await — synchronous, part of the click task — and letting the async part only apply its results. The lesson is the general shape of this section's warning: state written after an `await` is scheduled work, not part of the gesture.

---

## 5. Putting It All Together — The Complete Execution Model

Session 1 promised the shape of this model in one paragraph; here is the whole thing, assembled from this session's four sections.

**The call stack** (Session 1) runs synchronous code, and only synchronous code. A function returns, the frame pops, and the stack continues — nothing asynchronous ever executes "inside" the stack's current work.

**When the stack empties**, the event loop takes over and its decision rule is fixed: drain the *entire* microtask queue first — promise reactions, `queueMicrotask` callbacks, everything queued during the drain included — then take exactly *one* macrotask from the task queue (`setTimeout`/`setInterval` callbacks, I/O completions, UI events), then, in a browser, possibly render a frame. Then repeat. Two queues, two priorities, one rule: the drain always wins, and the tasks come one at a time.

**Macrotasks** are the units of work that arrive from the outside world — timers that expired, bytes that arrived, clicks that happened. Each one is an island: its microtask fallout runs before the next island, and its wall-clock accuracy is a minimum, not a promise (4ms clamping after ~5 nested levels, hard throttling in background tabs).

**Microtasks** are the units of work that promise chains and `queueMicrotask` generate internally. Their full-drain rule is what makes promise chains settle as one uninterrupted burst — and what makes a self-queuing microtask loop a page-freezing starvation bug.

**`async`/`await`** adds nothing to this model. An `await` is a microtask boundary with nicer syntax; an `async` function is a promise producer whose body runs synchronously up to its first boundary. Same queue, same FIFO, same priority. Session 6 (promises, async/await, and error handling) builds directly on the mechanics established here: the promise state machine and rejection propagation are the promise side of this same microtask-queue model.

The one-sentence summary worth walking into the interview with: **synchronous code runs to completion, then the entire microtask queue drains, then one task runs, then repeat — and every ordering bug in async JavaScript is someone misplacing which queue their callback is sitting in.**
