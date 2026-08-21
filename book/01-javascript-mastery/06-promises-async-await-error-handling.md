# Promises, Async/Await Error Handling, and Error Propagation

> Four connected topics that cash in Session 5's deferred promises: the promise state machine and what the microtask queue actually reacts against, chaining and the combinators as ways of composing state machines, async/await as the control-flow interface that turns rejections into throws, and error propagation — what happens when a link in the chain never gets a handler, and how operational vs. programmer errors decide where handlers belong. This session builds on two things established earlier: Session 5's microtask/await mechanics (`05-event-loop-microtasks-macrotasks.md`), cited rather than re-derived, and Session 4's `class MyError extends Error` mention (`04-prototypes-classes-inheritance.md`), which this session turns into the full error-handling story. Every ordering and rejection claim is verified in `examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts` with full logged sequence arrays — the same standard Session 5 applied to the resolution side, applied here to the rejection side. The combinators are covered at interview depth only; implementing them from scratch is Session 82's live-coding job.

---

## 1. The Promise State Machine

### Part 1 — Theory

A promise is a state machine with three states and one rule: it starts `pending`, it settles exactly once, into either `fulfilled` (with a value) or `rejected` (with a reason), and after that it never changes again. The resolve/reject functions handed to a `new Promise` executor are the only way to settle it, and the second call is a no-op — a promise that already settled ignores everything that tries to unsettle it.

That immutability is the load-bearing property, and it's the reason promises compose safely: any code that holds the promise — attached now or attached much later — observes the same settlement. Ten different modules can share one promise and none of them can corrupt what the others see. The harness verifies this directly: a handler attached after settlement sees exactly the same value as one attached at creation.

The second half of the model is how reactions are scheduled, and it's Session 5's rule wearing a different hat. `.then()`, `.catch()`, and `.finally()` don't run anything synchronously — they attach a reaction. When the promise settles, the reaction is queued as a microtask and runs in the drain, exactly like an `await` continuation. The crucial consequence, verified: **attaching `.then()` to an already-settled promise still queues the reaction — it does not run immediately.** There is no synchronous fast path, the same rule as Session 5's "await always yields." The promise state machine is the thing the microtask queue reacts against; the queue mechanics are unchanged.

`.then()` returns a new promise, and its settlement is decided by what the callback returns. Return a plain value, and the new promise fulfills with it. Return a promise — or any object with a callable `then` method — and the new promise's settlement is *adopted* from it: the chain flattens rather than nesting. The mechanism matters, and it's verified: the adoption protocol reads and calls the returned object's `.then` with the resolution functions, and this is true for native promises too, not just hand-written thenables — the harness instruments a native promise's `then` property and proves it gets called. Throw, and the new promise rejects with the thrown value, routing straight to the nearest rejection handler further down the chain.

`.finally()` sits on both paths: its callback runs whether the promise fulfilled or rejected, and it passes the value or reason through untouched — unless the callback itself throws, which becomes the new outcome. Cleanup, not recovery.

### Part 2 — Interview Answer

The part that makes promises compose safely isn't the syntax, it's the state machine underneath. A promise starts pending, and it settles exactly once — into fulfilled or rejected, and then it's frozen. You can't re-reject a resolved promise; the resolve and reject functions are the only way to settle, and the second call is a no-op. And because settlement is immutable, any handler attached at any time sees the same result. That's what makes it safe to hand one promise to ten different pieces of code — nobody can corrupt what the others observe.

The second half is scheduling, and it's the exact rule from Session 5 in a different hat. Then, catch, and finally never run anything synchronously. They attach a reaction, and when the promise settles, the reaction is queued as a microtask and runs in the drain. The claim people get wrong: attaching a then to a promise that settled long ago still queues the reaction. It does not run immediately — there is no synchronous fast path, exactly like await always yielding even on a plain value. I verify that with a logged sequence: two synchronous lines around the then call, a timer scheduled after it, and the then runs after both sync lines but before the timer.

Then there's the chaining rule, which is where most interview answers go vague. Then returns a new promise whose fate is decided by what the callback returns. Return a plain value, the chain fulfills with it. Return a promise — or any object with a callable then — and the chain adopts its settlement; it flattens, it doesn't nest. The mechanism is worth knowing precisely because it's verified: the adoption machinery reads the returned object's then method and calls it with the resolution functions, and that happens for native promises too, not just hand-written thenables. I've proven it by replacing the then property on a native promise and watching the chain call it. Throw, and the new promise rejects with the thrown value, straight to the nearest rejection handler down the chain.

And finally is the both-paths cleanup: it runs whether the promise fulfilled or rejected, and it passes the value or reason through untouched — unless the finally callback itself throws, and then that becomes the outcome. Cleanup, not recovery.

### Part 3 — Whiteboard / Live Coding

Two demos, both asserted as full sequences in the harness. First, the already-settled rule:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
const order: string[] = [];

const p = Promise.resolve('ready');   // settled before any reaction is attached
order.push('sync-before');
p.then((v) => order.push(`then:${v}`));
order.push('sync-after');
setTimeout(() => order.push('timer'), 0);
```

Predicted output: `sync-before, sync-after, then:ready, timer`.

1. The promise settled on line 1 — long before the `.then` was attached.
2. The `.then` still only queues a reaction: `sync-after` runs before it, because no reaction ever runs synchronously.
3. The queued reaction is a microtask, so it outranks the timer even though the timer was scheduled after it.

The trace is the same one Session 5 used for `await 1` — this is that rule on the plain-promise side: settled state, queued reaction, drain ordering.

Second, the flattening chain — the full adoption story in one sequence:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
const order: string[] = [];

const thenable = {
  then(resolve: (value: string) => void): void {
    order.push('thenable-then-called');
    resolve('thenable-flattened');
  },
} as unknown as PromiseLike<string>;

await Promise.resolve('start')
  .then((v) => {
    order.push(v);
    return Promise.resolve('promise-flattened');   // promise return — adopted
  })
  .then((v) => {
    order.push(v);
    return thenable;                               // thenable return — adopted via its .then
  })
  .then((v) => {
    order.push(v);
    throw new Error('routed');                     // throw — rejects the chain
  })
  .then(undefined, (e: unknown) => {
    order.push(`caught:${(e as Error).message}`);  // .catch is sugar for this call shape
    return 'recovered';                            // a recovery value continues the chain
  })
  .then((v) => {
    order.push(`final:${v}`);
  });
```

Predicted output: `start, promise-flattened, thenable-then-called, thenable-flattened, caught:routed, final:recovered`.

1. The first `.then` returns a native promise; the chain adopts it — the next link sees `promise-flattened`, not a nested promise.
2. The second `.then` returns a plain object with a `then` method; the resolution machinery calls that method — visible in the sequence between the two links — and adopts what it resolves with.
3. The third link throws; the chain rejects and the `then(undefined, onRejected)` — the exact shape `.catch` is sugar for — receives the error.
4. The rejection handler returns a value, which recovers the chain: `final:recovered`.

The narrated claim that keeps the demo honest: native promises and thenables are adopted through the *same* protocol. The harness proves it by overriding `then` on a native promise — the override is called, and the value flows through it.

### Part 4 — Follow-Up Questions

**Q: What happens if the `onFulfilled` callback throws after the promise already resolved?**

The original promise is untouched — settlement is immutable, remember. The `.then`'s *returned* promise rejects with the thrown value, and that rejection flows down the chain to the nearest rejection handler. This is the entire error-routing design: a throw anywhere in a callback becomes a rejection of the chain's next promise, never a crash of the process.

**Q: Can you settle a promise twice?**

The executor's resolve and reject are the only settlers, and only the first call counts — the second is silently ignored. That's enforced by the same mechanism that makes settlement immutable: the resolving functions hand off their authority to the promise's first settlement. The spec models it as an empty-out flag — once the resolve function has run, later calls return without doing anything. (Verified behavior in every runtime; the harness's immutability test relies on it.)

**Q: Returning a promise vs. returning a thenable — is there a difference?**

At the adoption level, none: both are objects with a callable `then`, and both go through the same protocol — the resolution machinery calls `then` with the resolution functions and adopts whatever it produces. The spec performs `Get(resolution, "then")` and enqueues a thenable-resolution job for *any* object, native promise included — I verified this against the current ECMAScript spec, and behaviorally by overriding `then` on a native promise and watching the chain call it. The distinction that matters is callable-`then` vs. not: an object without a callable `then` simply fulfills the chain with the object itself.

**Q: Why does the chain flatten instead of nesting?**

Because `.then` doesn't wrap the callback's return value — it runs the return through the resolution machinery, which adopts promise-valued returns rather than wrapping them in another layer. The promise you return is the state the chain continues from; there is no `Promise<Promise<T>>` in the chain's observable model. If flattening didn't exist, every async function that returned a promise would need manual unwrapping at each link, and the combinators would be unusable.

**Q: What does `.finally` do to the settled value?**

Nothing, on the happy path — the value or reason passes through to the next link unchanged. The one exception: if the `.finally` callback itself throws, the new promise rejects with that throw, replacing the prior outcome. So `.finally` is the both-paths cleanup hook: it observes, it cleans up, it does not transform.

### Part 5 — Common Mistakes

**Junior/mid answer:** "If the promise is already resolved, the `.then` callback runs immediately — it only defers when the promise is still pending."

**Senior answer:** It never runs synchronously, settled or not — verified by sequence. The `.then` attaches a reaction, and the reaction is queued as a microtask; an already-settled promise just means the reaction gets queued at attachment time instead of at settlement time. The distinction is invisible from inside the callback — both cases run in the drain. This is Session 5's "await always yields" rule on the plain-promise side, and the junior version usually comes from assuming a fast path exists because it would be convenient.

**Another junior tell:** "Returning a promise from `.then` makes the next callback wait for it — the callbacks run at the same time as the promise's own work."

**Senior correction:** Nothing runs in parallel — there's one thread and one queue. The returned promise's settlement is *adopted*: the chain's next promise gets its state from the returned promise, and the next link runs when that adoption completes, as a microtask in the drain. "Adoption" and "waiting" sound similar, but adoption is the mechanism — the chain doesn't poll or wait, it attaches and is resolved.

**Another junior tell:** "Throwing inside a `.then` crashes the program."

**Senior correction:** It rejects the `.then`'s returned promise, and the nearest rejection handler down the chain receives it — the throw is the rejection path of the chain, not an uncaught exception. An uncaught exception only happens when the *whole chain* ends without a handler, which is exactly the unhandled-rejection problem Section 4 covers.

### Part 6 — Production Examples

**Real incident — the forgot-to-return promise:** A team's event pipeline did `events$().then(() => { ingestBatch(batch) })` — the inner `ingestBatch` returned a promise, but the arrow body didn't return it. The chain adopted `undefined` and resolved immediately, so the next batch's processing started while the previous batch's ingestion was still mid-flight. The symptom was ordering bugs that only appeared under load. The flattening rule makes the bug's shape obvious in review: whatever a `.then` callback returns *is* the chain's state, so a body that calls an async function without returning it is a silent fast-forward. The fix was a lint rule against `.then` callbacks with expression bodies that don't return.

**Real incident — the cache-hit race:** A caching layer returned already-settled promises from a shared map, and a feature read them with `.then` expecting the value "immediately, since it's cached." The `.then` ran one microtask later — after the current synchronous block, after other queued microtasks — and a UI state update that assumed sync visibility raced with it. Same root cause as Session 5's one-frame flicker, mirrored on the plain-promise side: a settled promise is not a synchronous value, and code that treats it like one has built its ordering on a fast path that doesn't exist.

**Texture prefetching in a web game:** An asset loader prefetched textures into a shared promise cache keyed by URL. Every entity that needed a texture received the *same* settled promise, and because settlement is immutable, the first load's outcome was safely shared by every consumer — a late-attached `.then` sees the texture, an entity that subscribes after a failure sees the failure. The immutability that makes this safe is Section 1's state machine; the loader itself is the Session 13 asset-pipeline's job.

---

## 2. Chaining and the Combinators

### Part 1 — Theory

Section 1's flattening rule is what chaining is built on: `.then` returns a new promise, each link adopts or routes, and a chain is a sequence of state machines handing their outcomes forward. `.catch` is sugar — `.then(undefined, onRejected)` with a friendlier name — and `.finally` is the both-paths hook from Section 1.

The combinators are the vocabulary for composing *multiple* state machines at once, and the axis that separates them is settle semantics: what happens to the group when individual members fulfill or reject.

**`Promise.all`** is all-or-nothing. It fulfills with an array of values in input order only if every input fulfills; the first rejection rejects the whole thing — it fails fast, settling as soon as any member rejects, without waiting to see whether the rest would have succeeded. Verified: with a fast-rejecting input and a slow-fulfilling one, `all` settles on the rejection at 10ms while the slow promise is still 50ms from fulfilling.

**`Promise.allSettled`** never rejects. Every input's outcome becomes a status record — `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }` — in input order. It's the combinator for independent work where partial results are still valuable: the failure of one member doesn't invalidate the others.

**`Promise.race`** settles with the first *settlement*, fulfilled or rejected — whichever member settles first decides the outcome. It's about latency, not success. Verified: a rejection that arrives first wins the race, and a slower fulfillment is ignored.

**`Promise.any`** resolves with the first *fulfillment* and ignores rejections; only if every input rejects does it reject, with an `AggregateError` whose `errors` array carries every reason. It's the fallback combinator — "try these sources, give me whichever works."

One subtlety all four share, verified directly: **none of them cancel the losers.** The members keep running after the combinator settles. `race` in particular attaches reactions to *every* participant, so a late-rejecting loser is handled by the race machinery — it does not surface as an unhandled rejection. The harness asserts this: a loser that rejects after the race settled produces no unhandled-rejection event.

Scope note, per the roadmap: implementing these combinators from scratch is Session 82's live-coding exercise; this session's job is the semantic map and the decision rule.

### Part 2 — Interview Answer

The interview question is never "what does Promise.all do" — it's "which one do you reach for, and why." So I'd start from the scenario, not the feature list. The axis that decides everything: do I need every result, or is a partial result still useful? And: is failure expected or exceptional?

Promise.all is all-or-nothing. It fulfills with an array in input order only if every input fulfills, and the moment any one rejects, the whole thing rejects with that first reason. You use it when the results are interdependent — one failed part of a batch makes the batch unusable. The senior detail is fails-fast: it settles on the first rejection; it doesn't wait to see whether the rest might succeed. I've verified the ordering — a fast rejection at ten milliseconds settles the all before a slow success at sixty even shows up.

Promise.allSettled never rejects. Every outcome becomes a status record — fulfilled with a value, or rejected with a reason — in input order. When is that the call? When the work is independent and partial success is still a win: five dashboard widgets, render the ones that loaded, show an error card for the rest. Promise.all would blank the whole dashboard because one widget's endpoint 500'd.

Promise.race settles with the first settlement, fulfilled or rejected — it's about latency, not success. Promise.any is the one people misname: it resolves with the first fulfillment and ignores rejections, and only if everything rejects does it reject, with an AggregateError carrying every reason. That's your fallback pattern — three CDN URLs for the same asset, give me whichever loads first.

The senior footnote on all four: none of them cancel the losers. Race picks a winner, but the other promises keep running — their work isn't aborted. And race does attach handlers to every participant, so a loser that rejects later is still handled, not an unhandled rejection — I've verified that one, because it's the claim people get wrong when they assume race only watches the winner.

### Part 3 — Whiteboard / Live Coding

The scenario that separates the combinators, solved as a decision:

> A dashboard mounts five independent widgets. Each has its own API call. One widget failing must not blank the page — show an error card for it, render the rest.

```typescript
// VERIFIED (status shape) — tested in examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
interface Widget {
  id: string;
  data: unknown;
}

async function loadWidget(id: string): Promise<Widget> {
  const res = await fetch(`/api/widgets/${id}`);
  if (!res.ok) throw new Error(`widget ${id} failed with ${res.status}`);
  return { id, data: await res.json() };
}

const ids = ['revenue', 'users', 'latency', 'errors', 'uptime'];

// The decision: partial success is valuable, so allSettled, not all.
const outcomes = await Promise.allSettled(ids.map(loadWidget));

const widgets: Widget[] = [];
for (const outcome of outcomes) {
  if (outcome.status === 'fulfilled') {
    widgets.push(outcome.value);
  } else {
    // one failed widget renders as an error card; the others are untouched
    console.log(`error card for: ${(outcome.reason as Error).message}`);
  }
}
```

The narrated reasoning: `all` would be the wrong call even though it's the "obvious" parallel tool — one 500 on the `errors` widget would blank `revenue`, `users`, and the rest. `allSettled` turns every failure into a *status*, so the failure is data, not an interruption. The status shape (`fulfilled` with `value` / `rejected` with `reason`, input order preserved) is asserted in the harness.

The other three in one line each, with the scenario that picks them:

```typescript
// all — the results are interdependent: a batch upload where one failed file
// means the batch is invalid. Fail fast and surface the first reason.
const batch = await Promise.all(files.map(upload));

// race — first settlement wins, rejection included: "cache vs. network,
// show whichever responds first." Verified: a rejection arriving first wins.
const first = await Promise.race([cacheLookup(key), fetchFromNetwork(key)]);

// any — first FULFILLMENT wins, rejections ignored until all fail: "three
// CDNs, give me whichever one is up." Verified: rejects with AggregateError
// only when everything rejects.
const asset = await Promise.any(cdnUrls.map((u) => fetchAsset(u)));
```

Each of these is asserted in the harness on its settle semantics — including the race case where the first settlement is a rejection, and the `any` case where the error is an `AggregateError` carrying both reasons.

### Part 4 — Follow-Up Questions

**Q: `all` vs. `allSettled` — give me the production decision rule.**

Ask one question: is a partial result still useful? If the members' results are interdependent — a transaction, a batch that must all commit, a render that needs every piece — `all`, so one failure stops the process early instead of producing half-work. If the members are independent contributions — widgets, tiles, sources — `allSettled`, so failures become statuses you render rather than a blanket failure. The rule of thumb that reverses junior intuition: `allSettled` is the default for independent UI work, and `all` is the stricter contract you opt into.

**Q: Does `race` cancel the losing promises?**

No — and this is the claim to state precisely. `race` attaches reactions to every participant (verified: a late-rejecting loser is handled, not unhandled), but "handled" means the rejection is consumed, not that the work stops. The losing fetch still transfers its bytes; the losing timer still fires its callback. Cancellation is a separate mechanism — `AbortController` for network work, which Session 62's realtime chain covers — and `race` is not it. If you reach for `race` as a timeout, the timed-out work keeps running underneath.

**Q: Why does `any` reject with an `AggregateError` instead of just the first reason?**

Because the contract is "tell me about all the failures" — when three CDNs all failed, the reasons are different failures: one timed out, one returned 503, one was a DNS error. A single reason would throw away the diagnosis. `AggregateError` exists exactly for this: one rejection carrying every member reason in `.errors`, so the fallback path can distinguish "all sources down" from "sources misconfigured."

**Q: When would you actually use `race` given that it doesn't cancel?**

Whenever the first response wins and the rest are safe to discard — cache-vs-network where the cache wins if it beats the network round trip, the fastest of several equivalent sources, a health check across mirrors. The constraint to design around: the losers' side effects still happen, so race is for *reads* that are idempotent or discardable, not for anything where the loser's completion matters.

**Q: Does `allSettled` preserve input order?**

Yes — the result array is in input order regardless of settlement order, which is what makes `outcomes[i]` correspond to `inputs[i]`. The status records are positional, not temporal. `all` has the same property. It's why the widget loop in Part 3 can index safely.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`Promise.race` returns the value of the fastest promise."

**Senior answer:** It returns the outcome of the first promise to *settle* — fulfilled or rejected — and a rejection that arrives first wins the race. "Fastest" implies a winner among successes; `race` doesn't care about success, it cares about settlement. The verified sequence is the answer: first-settled (a rejection), then the race result, then the slow fulfillment arriving later and being ignored.

**Another junior tell:** "I use `Promise.all` for anything parallel; `allSettled` is for edge cases."

**Senior correction:** That's backwards for independent work. `all`'s all-or-nothing behavior is a strict contract you should opt into only when partial results are unusable — otherwise one member's failure takes down work that had nothing to do with it. The dashboard example is the tell: five independent widgets, one 500, whole page blank — that's `all` doing exactly what it was told and the wrong tool for the job.

**Another junior tell:** "`any` and `race` are basically the same — first one done wins."

**Senior correction:** They differ exactly where failures are involved. `race` settles on the first settlement, so an early rejection ends it. `any` ignores rejections and waits for the first fulfillment — it only rejects (with `AggregateError`, not the first reason) when every input has rejected. "First done wins" is true for `race` only; `any` is "first success wins."

**One more:** "`all` waits for every promise to settle, then rejects if any failed."

**Senior correction:** No — `all` rejects as soon as the first member rejects, without waiting for the rest. The verified sequence shows it: a rejection at 10ms settles the `all` before a success at 60ms. The members keep running in the background — `all` doesn't cancel them — but the *settlement* is fast. That's the "fails fast" half of all-or-nothing.

### Part 6 — Production Examples

**Real incident — one widget's 500 blanked the operations dashboard:** An internal ops dashboard loaded its five metric widgets with `Promise.all` over the widget fetches. One widget's backend — an older service with flaky uptime — returned 500 for ten minutes, and for those ten minutes the entire dashboard rendered as a single error screen, including the four widgets whose data was fine. The incident postmortem's root cause was the combinator choice, not the failing service: the team wanted "show what you have," and `all`'s all-or-nothing contract delivered the opposite. The fix was `allSettled` with per-widget error cards, and the guideline written into the team's review checklist: independent UI components load with `allSettled` unless a partial render is genuinely worse than none.

**Real incident — cache-vs-network race on a content site:** A content site served the home feed from a stale-while-revalidate cache, racing the network fetch with `Promise.race` so a cache hit painted immediately and the network result updated silently behind it. The losing network fetch kept running — that was intentional, it repopulated the cache — and because `race` handles every participant, the loser's rejection (a network error after the cache already won) was consumed by the race machinery, verified behavior, no unhandled rejection noise in their error telemetry. The team's written lesson was exactly this section's footnote: race for reads with discardable losers, never for work with side effects.

**Real incident — `Promise.any` for asset CDN fallback in a game:** A web game loaded its leaderboard data from a primary CDN with two mirror origins. Fetching from all three with `Promise.any` gave the player whichever mirror responded first, and when all three failed, the `AggregateError` carried three different reasons — primary timeout, mirror A 503, mirror B DNS failure — which let the team distinguish "CDN provider down" from "our cache key is bad" in one error report. The `errors` array was the diagnostic; a single-reason failure would have needed three separate code paths to produce the same insight.

---

## 3. async/await Error Handling

### Part 1 — Theory

Session 5 established the mechanics: an `async` function runs synchronously to its first `await`, suspends, and resumes as a microtask on the same queue `.then` uses. Nothing in this section changes any of that. What's new is the interface between the promise machinery and control flow: **a rejected awaited promise throws at the `await` expression.** The async function's continuation — the code after the `await` — is resumed inside machinery that turns the rejection into a throw, so a `try/catch` around the `await` catches it exactly like a synchronous throw. The harness verifies the full sequence: the synchronous lines, the `await` boundary, the throw at resumption, the catch, the continuation after the catch.

Two properties follow. First, the try/catch also catches synchronous throws in the same block — a `JSON.parse` failure before any `await` lands in the same `catch` as a later rejection. One scope, uniform handling. Second, the scheduling is unchanged: the throw happens during the microtask resumption, not at the call site — which is why "await makes errors synchronous" is wrong in a way that matters. It makes them *read* synchronously; they still travel the queue.

If the async function doesn't catch, its returned promise rejects — the error propagates to the caller, who either awaits it (and gets a throw there) or attaches `.catch`, or handles it nowhere, in which case it's an unhandled rejection (Section 4's territory).

The value proposition versus nested `.catch` chains is structural: a single `try/catch` scopes a *region* of code — three awaits, one catch, linear error flow — while chain-based error handling is per-link, with a `.catch` after every step that could fail. The catch placement becomes the design decision: it sits at the level where recovery is possible, and everything below it that throws lands there.

### Part 2 — Interview Answer

The value proposition of async and await for error handling is that a rejection becomes a throw at the await expression. When you await a promise that rejects, the function's continuation — the code after the await — throws, and a try and catch around that await handles it exactly like a synchronous throw. Nothing about the scheduling changed from Session 5: the await still suspends, the continuation still resumes as a microtask, and the throw happens in that microtask, inside the try. But the interface changed completely — it reads and behaves like synchronous control flow, and that's the entire point of the sugar.

The senior part is what this does to error-handling structure. With then chains, error handling is per-link: every step that can fail needs its own catch, or the chain grows a fork at each step. With try and catch around awaits, one block scopes a whole sequence — three awaits, one catch, linear. The catch sits at the level where you can actually do something about the failure, and everything below it that throws, whether it's a rejected promise or a synchronous bug in the same block, lands in that same catch.

The nuance to state carefully: this is not "await makes errors synchronous." The rejection crosses a microtask boundary before it throws, and the catch handles a throw that happened during resumption, not during the original call. I verify the ordering the way Session 5 verified the resolution side — log the sequence, assert the whole array: the sync lines, the await boundary, the throw, the catch, the continuation. The interleaving is the evidence; if the claim were wrong, the array would show it.

And the boundary rule that makes the whole thing compose: whatever the async function doesn't catch, its returned promise rejects with. So an unhandled rejection somewhere in a codebase is a promise nobody consumed — usually a forgotten await. That's the bridge from error handling to error propagation, which is the next topic.

### Part 3 — Whiteboard / Live Coding

The rejection-to-throw path, verified with the full sequence rather than a bare `toThrow`:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
const order: string[] = [];

async function fetchUser(): Promise<string> {
  order.push('fetch-start');
  return Promise.reject(new Error('network down'));
}

async function loadProfile(): Promise<void> {
  order.push('load-start');
  try {
    const user = await fetchUser();
    order.push(`user:${user}`);   // never runs — the await throws
  } catch (e: unknown) {
    order.push(`thrown-at-await:${(e as Error).message}`);
  }
  order.push('load-continues');   // control flow resumes past the catch
}

await loadProfile();
order.push('test-continues');
```

Predicted output: `load-start, fetch-start, thrown-at-await:network down, load-continues, test-continues`.

1. `load-start` and `fetch-start` both run synchronously — the async body executes up to the boundary.
2. The `await` suspends; the rejected promise's throw happens at resumption, as a microtask, *inside* the try.
3. The catch handles it; `load-continues` runs in the same resumed block — the control flow after the catch is linear, exactly as if the throw had been synchronous source.
4. `loadProfile` fulfills, and the caller's `await` resumes.

The ordering is the point: the throw is one microtask hop after the rejection, and the try/catch works because the continuation lives inside it. The harness asserts the exact array — not just "a rejection was caught."

The contrast that motivates the whole section:

```typescript
// Chain style: per-link handling. Every step that can fail forks the chain.
fetchUser()
  .then(loadPosts)
  .catch(handleUserFailure)
  .then(renderProfile)
  .catch(handleRenderFailure);

// await style: one region, one catch, linear flow. Which catch a failure
// lands in is decided by WHERE the block sits, not by the chain's shape.
async function showProfile(): Promise<void> {
  try {
    const user = await fetchUser();
    const posts = await loadPosts(user);
    renderProfile(user, posts);
  } catch (e) {
    // user fetch, post load, and render all land here — one recovery point
  }
}
```

### Part 4 — Follow-Up Questions

**Q: If the promise rejected before the `await` — say it was already settled — does try/catch still catch it?**

Yes, always. The rejection is stored in the settled promise; the `await` boundary still suspends (Session 5's rule — there's no synchronous fast path even for settled promises); and at resumption the stored reason throws inside the try. When the promise settled is irrelevant — before the call, during the call, after — the throw always happens at the `await` expression, inside the catchable scope. This is the same "settled promise, queued reaction" rule from Section 1 wearing the await hat.

**Q: Does try/catch around await also catch synchronous throws?**

Yes — that's the uniform-scope property, verified in the harness: a `JSON.parse` on bad input in the same try, before any await, lands in the same catch as a later rejection. The catch can't tell the two apart, and doesn't need to. This is one of the quiet wins of await-style error handling: the boundary between "thrown synchronously" and "rejected asynchronously" stops mattering inside the block.

**Q: What happens if you don't catch in an async function?**

The function's returned promise rejects with the error — the rejection becomes the promise's state. The caller's `await` on it throws in turn, or a `.catch` handles it, or nobody handles it, and it becomes an unhandled rejection: the Section 4 case. The important part: an async function never lets an error disappear — it converts "throw in a callback" into "rejected promise," which is the mechanism that lets the error keep propagating until a handler exists.

**Q: try/catch around await vs. `.catch` on the promise — when does the choice matter?**

When the failure should stop a *region* of code, try/catch: multiple awaits, one recovery point, linear flow. When the failure is part of a *chain's* continuation — a fallback value that feeds the next link — `.catch`, because a rejection handler's return value resumes the chain, while a catch block's completion ends the block. The honest senior answer: they're the same machinery with different ergonomics, and the choice is about where recovery belongs, not about capability.

**Q: Does `finally` in a try work with await?**

Yes — and it has the same both-paths semantics as `.finally` on a promise: it runs whether the block completed or threw, and it doesn't swallow the outcome unless it throws itself. It's the same cleanup guarantee, expressed as control flow. The harness verifies both spellings on both paths.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`await` makes the code synchronous, so try/catch just works — that's the trick."

**Senior answer:** Wrong mechanism, and it matters under follow-up. Nothing runs synchronously: the await suspends, the continuation resumes as a microtask, and the catch handles a throw that happened during resumption. Session 5's scheduling model is unchanged — "reads synchronously" is the sugar, "runs synchronously" is the misconception. The verified sequence shows the throw landing a microtask after the rejection, inside the try. The interview tell: the junior version can't explain *why* the catch works; the senior version points at the resumption.

**Another junior tell:** "I wrap every await in its own try/catch to be safe."

**Senior correction:** That's the per-link habit imported into await code, and it obscures the entire point — one try/catch scopes a region. Three awaits in one block, one catch: the error lands at the recovery point, and the code between the awaits reads linearly. Wrapping each await separately means every error stops the region at its exact line and forces a decision at each step, which is the nested-`.catch`-pyramid problem the await style exists to eliminate.

**Another junior tell:** "`catch (e) { console.log(e) }` — at least we log it."

**Senior correction:** A catch that logs and swallows converts a loud failure into a silent one: the UI proceeds in a half-failed state and the only evidence is a console line nobody watches. The senior version is a deliberate decision at every catch: recover (fallback value, retry, user-visible state) or rethrow — and if it's a programmer error, it shouldn't be caught at all, which is Section 4's operational-vs-programmer framing.

### Part 6 — Production Examples

**Real incident — the nested-catch checkout flow:** A checkout flow built as promise chains had accreted a `.catch` at every step — create order, authorize payment, charge, confirm — each one mapping failures to user messages. A new error path (card declined *after* authorization) needed handling in three of those catches, and the team shipped it inconsistently: two steps recovered, one silently failed. The refactor was to a single async function with one try/catch around the four awaited steps, and the recovery logic in one place. The failure mode that motivated it wasn't the API — it was that per-link handling had made "where does this error get handled" a question with four answers.

**Real incident — the swallowed error:** A feature's `loadFeed` had `.catch((e) => { console.error(e); return [] })` — the UI showed an empty feed on every failure, and production errors existed only as console lines. When a schema change broke the feed parser, the empty-feed state masked it for a week — the "failure" was indistinguishable from "no data." The fix was the operational/programmer split, applied for the first time: expected failures (network, 500s) got a retry with a visible error state; unexpected ones (parse failures on the client) were rethrown so the error telemetry actually fired. The incident's written lesson: a catch that swallows is a decision that the failure is expected — make that decision consciously, with a recover path attached.

---

## 4. Error Propagation and Custom Errors

### Part 1 — Theory

Session 4's follow-up on extending built-ins established the starting point: `class MyError extends Error` is the standard way to get correct `name`/`stack` semantics on custom errors. This section builds the actual error-handling design around that.

Why subclass at all? Two reasons. First, `instanceof` becomes the catch logic: `catch (e) { if (e instanceof ApiError) { ... } }` lets recovery code distinguish error *kinds* — a `ValidationError` needs one response, a `TimeoutError` another — without parsing messages. Second, subclasses carry structured fields: an `ApiError` knows its status code, a `ValidationError` knows the field that failed. One detail that surprises people, verified: the inherited `name` is `"Error"` — a subclass must set `this.name` itself, or its stack traces and tooling read as plain errors.

**The `cause` option** — `new ApiError('user fetch failed', { cause: e })` — is the wrapping mechanism that doesn't lose the original. Specified in ES2022, supported across modern engines. It turns error wrapping into a chain: the top error is the decision ("this call failed"), the `cause` trail is the root cause ("the socket hung up"). Verified in the harness: wrap, rethrow, and the caught error's `cause` is the original `Error`, message intact. Node's stack-trace formatting walks the chain; monitoring tools read `err.cause` natively. The design rule that keeps it useful: wrap at meaningful boundaries — service boundaries, API layers — not at every function. Balloon wrapping, where every layer adds a new error on top, destroys the signal.

**Unhandled rejections** are what happens when nothing catches: a rejected promise with no handler attached — the floating-promise shape, usually a forgotten await. The runtime's reaction is observable, and this session verifies it directly rather than asserting it:

- **Node** fires `unhandledRejection` on `process`, with the reason as the argument — verified with a registered listener and an unawaited async failure. Node's default (since v15) is to throw on it, terminating the process — verified: an unhandled rejection with no listener exits non-zero. A handler attached *after* the event fired doesn't unsend it — Node fires `rejectionHandled` instead, verified in sequence.
- **Browsers** fire `unhandledrejection` on `window` (and Workers), a `PromiseRejectionEvent` carrying the `reason` and the `promise`. Calling `preventDefault()` on it suppresses the default console error. Cross-origin rejections don't fire it — a data-leak guard. Verified against current MDN documentation.

The **operational vs. programmer error** distinction is the senior lens for "should this be caught here or allowed to propagate." Operational errors are expected failure modes — a failed fetch, invalid user input, a declined payment, a timeout. They're part of the system's spec, and they should be caught and recovered: fallback data, retry, a message. Programmer errors are bugs — a property read off `undefined`, an invariant violation, an impossible state. They should surface loudly: caught, they become mysteries ("why is this feature missing?"), propagated, they become call-site crashes with stack traces. The deciding question isn't how uncomfortable the failure makes the UI — it's whether the failure is a tested, expected outcome of the code, or a violation of what the code assumed.

### Part 2 — Interview Answer

Error propagation is where the promise machinery meets a design decision: what should be caught here, and what should keep propagating. The senior framing for that decision is operational errors versus programmer errors.

Operational errors are the expected failure modes of a system — a fetch that fails, invalid user input, a payment declined, a timeout. They're part of the spec of what you built, and they should be caught and recovered: fallback data, retry, a message to the user. Programmer errors are bugs — reading a property of undefined, violating an invariant, an impossible state. Those should surface loudly. If you catch a programmer error and log it, you've converted a bug into a mystery, and you'll debug it in production at three in the morning instead of at the call site.

The tooling that makes this work starts with custom error classes, building on Session 4's point that class MyError extends Error is the standard way to get correct name and stack semantics. You subclass so you can catch by type — instanceof-driven catch logic — and carry structured fields: an ApiError knows its status code, a ValidationError knows the field that failed. The one gotcha, verified: the inherited name is literally "Error," so the subclass has to set this.name itself, or every trace reads as a plain error.

Then there's the cause option, ES2022, so modern: new ApiError('user fetch failed', { cause: e }). It wraps a low-level error without losing it. The chain becomes traversable — the top error is the decision, the cause trail is the root cause. Node's stack traces walk it, monitoring tools read it, and you stop doing log archaeology to find the real failure. The design rule: wrap at meaningful boundaries, not at every function, or you get balloon wrapping that buries the signal.

And the case where nothing catches anything — the unhandled rejection. That's a floating promise: a rejected promise with no handler, usually a forgotten await. Node fires an unhandledRejection event on process — I've verified it directly — and browsers fire unhandledrejection on window, carrying the reason. Node's default since version fifteen is to throw, which terminates the process. That's a gift: the failure can't be silently ignored, and the event handler is where production reports it instead.

### Part 3 — Whiteboard / Live Coding

The custom-error-plus-cause pattern, verified end to end in the harness:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
class ApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiError'; // the inherited name is "Error" — set it explicitly
  }
}

async function fetchFromGateway(): Promise<string> {
  throw new Error('socket hang up');
}

async function loadUser(): Promise<string> {
  try {
    return await fetchFromGateway();
  } catch (e: unknown) {
    // Wrap at the boundary with cause — the original error is not lost.
    throw new ApiError('user fetch failed', { cause: e });
  }
}

const caught = await loadUser().catch((e: unknown) => e);

console.log(caught instanceof ApiError);              // true — catch-by-type works
console.log((caught as Error).message);               // "user fetch failed"
console.log((caught as Error).cause instanceof Error); // true — the original survives
```

Narrated: the boundary is the API layer, so the wrap happens once; the message is the decision, `cause` is the archaeology-free path to the root; and `instanceof ApiError` in a caller's catch gives targeted recovery — handle `ApiError` with a retry, let everything else propagate.

The unhandled-rejection observation, with the discipline that makes it safe to run in a test suite:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
const order: string[] = [];

const onUnhandled = (reason: unknown): void => {
  order.push(`unhandled:${(reason as Error).message}`);
};
process.on('unhandledRejection', onUnhandled);   // register
try {
  async function failsAfterTurn(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    throw new Error('forgotten await');
  }
  void failsAfterTurn();                          // NOT awaited, NOT caught — the bug shape

  await new Promise((resolve) => setTimeout(resolve, 50));
} finally {
  process.off('unhandledRejection', onUnhandled); // remove in the same test — no leakage
}

// order === ['unhandled:forgotten await'] — the event fired with the reason
```

The production lesson in the demo: the event is the observability hook — attach it in production to report floating promises, never to "fix" them by swallowing; the fix for a forgotten await is the await.

### Part 4 — Follow-Up Questions

**Q: Why subclass `Error` instead of throwing plain objects or strings?**

Two reasons, one technical and one operational. Technical: `instanceof Error` is true, so catch-all error handling (`throw` values that are `Error` instances) works, and the stack is captured and walked by every toolchain. Operational: `name` + `message` + structured fields give you a typed surface — catch logic keys off `instanceof`, diagnostics key off the fields. Throwing strings or bare objects loses the stack entirely, and "throwing strings is a code smell" is the most reliable junior tell in the topic.

**Q: What does `cause` give you that a hand-rolled wrapper field wouldn't?**

Standardization: it's the language's own mechanism, so Node's stack-trace formatting walks the chain, error-reporting services read `err.cause` without bespoke parsing, and nested `cause` chains (cause of a cause) compose without custom plumbing. A custom `original` field works only where your own code remembers to read it. `cause` is also the honest answer to "wrap or rethrow?" — you keep the public error shape (typed, catchable) and the full root-cause trail.

**Q: Should every layer wrap and rethrow with its own error type?**

No — the senior version is wrap at meaningful boundaries only. The API layer wraps downstream failures (it owns the contract); the UI layer doesn't wrap the API layer's errors again, it catches and recovers. Every extra wrap is a layer of indirection in the cause trail, and balloon wrapping — each function adding `new Error('failed at X', { cause })` — buries the root cause under ceremony. The rule of thumb: wrap when the new error carries genuinely new context (a status code, a field name, a boundary name); pass through otherwise.

**Q: What actually happens when an unhandled rejection occurs in a browser?**

The `unhandledrejection` event fires on `window` — a `PromiseRejectionEvent` whose `reason` and `promise` properties carry the rejection — and the console logs an error by default; `preventDefault()` on the event suppresses the console output, which is the production telemetry pattern (log it to your error service instead of the console). One guard worth knowing: rejections originating from cross-origin scripts don't fire the event, to avoid leaking data across origins. Verified against current MDN documentation. And `rejectionhandled` fires if a handler is attached after the fact — the "handled too late" event, verified in Node's harness.

**Q: How do you decide, at a boundary, whether an error is operational or programmer?**

Ask whether the failure is an expected outcome of the contract: can the system meaningfully recover here? is this failure covered by a test as a possible path (network down, bad input, declined)? If yes, it's operational — catch, recover, report. If the failure violates an assumption the code is built on — a field that should exist doesn't, a state that should be impossible occurs — it's a programmer error, and catching it only postpones the fix. The pragmatic heuristic: if you can't write the recovery path in three lines, you're probably catching the wrong kind of error.

**Q: What's the difference between `unhandledRejection` and `rejectionHandled`?**

`unhandledRejection` fires when a promise rejects and no handler is attached within the event-loop turn — the rejection is permanently observable as unhandled at that moment. `rejectionHandled` fires later, when a handler is finally attached to a promise that already fired `unhandledRejection` — the "too late" signal. Verified as a sequence in the harness: an event fired for a rejection whose catch was attached in a later macrotask, then the handled event. The pair matters for telemetry: `unhandledRejection` says "something went unhandled," `rejectionHandled` says "something only caught it after the fact."

### Part 5 — Common Mistakes

**Junior/mid answer:** "I catch everything at the top level so the user never sees an error — better safe than sorry."

**Senior answer:** A catch-all that swallows is how programmer errors become mysteries. The senior position: catch what's operational — expected, recoverable failures — and let programmer errors propagate and crash loudly. The distinction is the design, not the destination: a top-level handler for reporting (telemetry, user messaging) is correct; a top-level handler for *swallowing* is how a week-long production mystery starts. Node's default — terminate on an unhandled rejection — is the language agreeing: loud beats silent.

**Another junior tell:** "`class MyError extends Error {}` is all you need."

**Senior correction:** The class is the start, and the name is the trap — the inherited `name` property reads `"Error"`, so unless the constructor sets `this.name`, every stack trace and monitoring report shows a plain Error. The senior version is name set, structured fields for diagnostics, and `instanceof`-based catch logic that makes the subclass actually load-bearing: catching by type, not by message parsing.

**Another junior tell:** "Unhandled rejections are a dev-time warning; the browser handles them."

**Senior correction:** They're a production failure mode — the floating-promise shape (forgotten await, uncaught event handler promise, fire-and-forget validation) is how background features silently stop working. Node's default since v15 terminates the process on one — verified here — and browsers fire `unhandledrejection` on window carrying the reason. The senior version instruments the event in production and treats a floating promise as a bug to find, not a warning to ignore.

### Part 6 — Production Examples

**Real incident — the cause-less gateway:** A team's gateway wrapped every downstream failure in `new Error('upstream failed')` — no subclass, no cause, string context appended to the message. When a checkout flow failed, on-call debugging meant correlating three services' logs by timestamp and message fragment to find which of five downstream calls died and why. The fix was typed errors with `cause` at the gateway boundary: the top error named the failing call, the cause carried the downstream status and body, and the error monitoring tool surfaced the chain without a single log query. The incident's written lesson became this section's wrap-at-boundaries rule.

**Real incident — the forgotten await that blanked a dashboard section:** A dashboard feature's async init ran as `initFeature()` with the promise neither awaited nor caught — inside a startup path that also didn't await it. When the init failed (a config fetch returned 400), Node's `unhandledRejection` fired, the dashboard section stayed blank, and the UI showed no error state — because the code that would have set one was the code nobody awaited. The tests passed because the test harness also never awaited the init. The fix was the discipline this section is built on: every floating promise got an await, every init got a catch, and the section got a visible failure state — the unhandled-rejection event had been the only signal, and nobody was listening to it.

**Real incident — crash loudly at boot:** A service's boot sequence wrapped its entire initialization in `catch (e) { log(e); continue }` — "the service should start even if a feature fails." An undefined-access bug in one feature's init tripped it, the service started, and the feature was silently absent for a week until a user reported it missing. The fix applied the operational/programmer split to boot: recoverable failures (a feature's upstream being down — operational) got a start-skip with an explicit degraded mode; violations of invariants (an undefined access — programmer) propagated and crashed the boot loudly. The team's rule after the incident: at boot, the failure mode that hides is worse than the failure mode that halts.

---

## 5. Putting It All Together — One Model, Four Layers

The four sections of this chain are one model seen at four levels.

**The state machine** (Section 1) is what Session 5's microtask queue actually schedules reactions against: a promise starts pending, settles once into fulfilled or rejected, and is frozen after — and every reaction to it, even against an already-settled promise, runs as a queued microtask. Session 5's "await always yields" and Section 1's "then on a settled promise still defers" are the same rule with different faces.

**Chaining and the combinators** (Section 2) are how you compose multiple state machines: `.then` hands one state machine's outcome to the next, adoption flattens nested promises into the chain, and `all`/`allSettled`/`race`/`any` group many state machines under one settle policy — all-or-nothing, all-results-as-statuses, first-settlement, first-fulfillment. None of them cancel the losers; the group policy is about settlement, not control.

**async/await** (Section 3) turns that composition into control flow that reads synchronously: a rejection becomes a throw at the `await` expression, catchable in the same try/catch as a synchronous error, while the scheduling underneath is unchanged from Session 5. The interface changed; the machinery didn't.

**Error propagation** (Section 4) is what happens when a link in the chain never gets a handler: the rejection floats, Node fires `unhandledRejection`, browsers fire `unhandledrejection`, and the process or the console makes the silence loud. Custom error classes and `cause` are how you shape the errors that do propagate — typed, catchable, with the root cause attached. And operational vs. programmer is the lens that decides where a handler belongs: expected failures get caught and recovered where recovery is possible; bugs get allowed to propagate and crash loudly, because a swallowed programmer error is a mystery with a future production incident attached.

The one-sentence summary for the interview: promises are immutable state machines whose reactions run on the microtask queue, chaining and the combinators compose those machines, async/await makes the composition read like synchronous code, and knowing the difference between operational and programmer errors is what decides which link of the chain gets a handler — and which one is supposed to break.

Next in the arc: Session 7 returns to language mechanics — iterators, generators, symbols, and the Map/WeakMap/Set family — a new sub-chain, where the `AggregateError` from Section 2's `any` and the iterator protocol under the combinators' hood both get their deeper treatment.
