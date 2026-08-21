# Symbols, the Iterator Protocol, Generators, and Map/WeakMap/Set

> Three connected topics tracing one line: symbols are the language's collision-proof key mechanism, the iterator protocol is the contract that lets `for...of`, spread, and the promise combinators all walk the same shape, generators are the ergonomic way to *be* that contract, and Map/Set — with their weak siblings — are the collections that take keys and members a plain object can't. This session cashes in three deferred claims: Session 2's `WeakMap` mention in its garbage-collection section (`02-closures-arc.md`), Session 4's module-scoped `WeakMap` pattern and its `instanceof` follow-up naming `Symbol.hasInstance` (`04-prototypes-classes-inheritance.md`), and Session 6's note that the combinators accept an iterable, not specifically an array (`06-promises-async-await-error-handling.md`). All behavioral claims are verified in `examples/01-javascript-mastery/07-symbols-iterators-generators-map-weakmap-set.test.ts` — including the generator two-way-communication claim flagged in this session's Critical Notes as the most commonly misstated one, and a computation counter that proves an infinite generator computes only what it is asked for.

---

## 1. Symbols and the Iterator Protocol

### Part 1 — Theory

A symbol is a primitive type — `typeof Symbol('x') === 'symbol'` — whose entire reason to exist is identity without collision. Every call to `Symbol()` creates a brand-new value: `Symbol('x') !== Symbol('x')` is `true` even when both were constructed with the same string. That string is a *description*, a label for logging and error messages, not an identity. Strings and numbers are equal when they look alike; symbols are equal only to themselves, object-style identity semantics attached to a primitive.

There is one deliberate exception, and it is load-bearing. `Symbol.for('name')` consults a global registry keyed by string, so `Symbol.for('shared') === Symbol.for('shared')` across any two calls — including across modules and even realms (iframes, VM contexts), because the registry lives at the language level. `Symbol.keyFor(sym)` returns the registered string, or `undefined` for a symbol that was never registered. Local symbols are private by default; shared identity is something you opt into.

Symbols as property keys — written as computed keys `[sym]` — are the original motivation: attach metadata to an object under a key no other code can guess. String keys and symbol keys live in separate namespaces, so a symbol-keyed property never collides with a third-party library's string keys, never shows up in `for...in` or `Object.keys` or `JSON.stringify`, and is reachable only through `Object.getOwnPropertySymbols` and `Reflect.ownKeys`. The same mechanism scales up to the *well-known symbols*: a set of predefined symbols the language itself uses as hook points for extending core behavior. Two matter for this session.

`Symbol.hasInstance` customizes what `instanceof` reports — the mechanism behind Session 4's deferral, where `instanceof` was described as a prototype-chain walk. The walk is the *default* implementation, inherited from `Function.prototype[Symbol.hasInstance]`; any object or class that defines its own `[Symbol.hasInstance]` method replaces it. A class with `static [Symbol.hasInstance](value)` intercepts `value instanceof ThatClass` and returns whatever that method returns. Session 4 footnoted this; here it gets its real treatment.

`Symbol.iterator` is the contract the rest of the session hangs on. An object is **iterable** if it has a `[Symbol.iterator]()` method that returns an **iterator** — an object whose `next()` method returns `{ value, done }`, with `done: true` signaling the walk is over. Arrays, strings, Sets, Maps, and generator objects are iterable; plain objects are not, by design — `for...of` over one throws a TypeError.

The protocol is silent but pervasive. `for...of`, spread, `Array.from`, array destructuring, `new Set(iterable)`, `new Map(pairs)` — and, the Session 6 point, `Promise.all`/`allSettled`/`race`/`any` and the `AggregateError` constructor — all consume an *iterable*, not specifically an array. Satisfy two tiny methods and every one of those APIs accepts your object.

### Part 2 — Interview Answer

Symbols are the counterintuitive primitive: unique by construction, equal to nothing but themselves, which makes them the language's answer to "I need a key that nothing else can possibly collide with." That's two different jobs, and the senior answer separates them. The first is your own metadata: symbol-keyed properties sit in a separate namespace from string keys, so they can't collide with a library's properties, don't show up in `for...in` or `Object.keys`, don't get serialized by `JSON.stringify`. The second job is the interesting one — the language itself uses predefined symbols as its extension hooks.

`Symbol.hasInstance` is the cleanest example, and it's the mechanism behind Session 4's `instanceof` work. The prototype-chain walk that `instanceof` does is a default implementation, living on `Function.prototype`. Any type that defines its own `Symbol.hasInstance` replaces the walk with its own predicate — the type says what counts as an instance of it. That's how a class can recognize instances from a *different copy* of itself, via a shared brand marker. I've shipped exactly that as a real bug fix, when two copies of an SDK ended up in one bundle and `err instanceof SdkError` stopped working.

The iterator protocol is the same shape of thinking applied to consumption. Iterable means: an object has a `Symbol.iterator` method that returns an iterator, and an iterator is an object whose `next` returns value-and-done pairs. That's the whole contract — two methods. And every consumer that walks a sequence leans on it: `for...of`, spread, destructuring, `Array.from`, and the promise combinators from Session 6, which all accept an *iterable*, not specifically an array. They'll happily consume a Set, a generator, or a hand-written object that satisfies the contract. The interface demands almost nothing, and in exchange every walk-capable API participates.

So when an interviewer asks what a symbol is, they're not checking whether you know the identity rule. They're checking whether you know where the language itself reaches for symbols to define contracts — and that the well-known symbols are the engine's own plug points. That's the senior plane: symbols aren't trivia, they're the mechanism behind `instanceof`, and one of them is the foundation of the entire iterable ecosystem.

### Part 3 — Whiteboard / Live Coding

The classic ask: "make a Range iterable by hand, no arrays, then use it everywhere the protocol is silently assumed." The reasoning to narrate: I implement exactly two things — `[Symbol.iterator]` on the object, `next` on the iterator it returns — and every consumer below is driven by those two methods internally.

```typescript
// Iterable: has [Symbol.iterator](). Iterator: has next() → { value, done }.
// Each call to [Symbol.iterator]() must return a FRESH iterator with its own
// position. The shared-counter variant is the classic bug: the second for...of
// silently yields nothing (the harness in examples/ asserts the fix).
function range(start: number, end: number): Iterable<number> {
  return {
    [Symbol.iterator](): { next: () => { value: number; done: boolean } } {
      let i = start;
      return {
        next() {
          if (i > end) return { value: 0, done: true }; // done: true — walk over
          return { value: i++, done: false };
        },
      };
    },
  };
}

const r = range(1, 4);

for (const n of r) console.log(n);      // 1 2 3 4 — for...of
console.log([...r]);                     // [1, 2, 3, 4] — spread
console.log(Array.from(r));              // [1, 2, 3, 4] — Array.from
const [a, b] = r;                        // destructuring — a=1, b=2
console.log(a, b);
```

Narrated while typing: this object has no `length`, no `push`, no indexing — it is not array-like at all. Yet every consumer works, because each one is defined in terms of the protocol, not in terms of arrays. That's the "not specifically an array" proof from Session 6 wearing its real clothes.

The `Symbol.hasInstance` interceptor, solved:

```typescript
const BRAND = Symbol.for('sdk-error-brand'); // shared identity across copies

class SdkError {
  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { brand?: symbol }).brand === BRAND
    );
  }
}

// An error born in a DIFFERENT copy of the library — no shared prototype:
const fromAnotherBundle = { message: 'boom', brand: BRAND };
console.log(fromAnotherBundle instanceof SdkError); // true — brand check, not chain walk
```

The typed takeaway: symbols are collision-proof keys, and the well-known symbols are the collision-proof keys the engine reserved for hooks. `Symbol.hasInstance` hooks `instanceof`; `Symbol.iterator` hooks every walking API in the language.

### Part 4 — Follow-Up Questions

**Q: Is a symbol a string? Can you concatenate one?**

No, and the confusion is exactly the misconception this topic corrects. Symbol is its own primitive type — `typeof` returns `'symbol'`. Strings are value-equal; symbols are identity-equal. Implicitly converting a symbol to a string throws, and the only reverse lookup for a registered symbol is `Symbol.keyFor`. They're different axes of "what can a key be": strings are readable and comparable, symbols are opaque and unguessable.

**Q: When do you reach for the global registry (`Symbol.for`) instead of a local `Symbol()`?**

The tradeoff is identity scope. A local symbol is private-by-construction: collision-proof without any coordination. `Symbol.for` makes the identity *shared* — the same string in any module or realm returns the same symbol, which is what you want for a cross-bundle brand marker or a plugin-API key that host and plugin must agree on. The risk is registry pollution: the namespace is global, so two unrelated libraries choosing the same key collide. Local by default; registered only when the identity genuinely has to be shared across boundaries.

**Q: Do symbol keys interact with `Object.create(null)`?**

No — symbol-keyed properties work identically on null-prototype objects. That's worth saying because it completes the collision story from Session 4: `Object.create(null)` kills string-key collisions with prototype properties; symbol keys kill collisions with *any* known string. Both defenses compose, and neither changes the other's behavior.

**Q: `for...in` vs. `for...of` — how are they different?**

`for...in` walks enumerable *string* keys, inherited ones included — the mechanism Session 4 showed skipping class methods. `for...of` walks *values* through the iterator protocol, with no prototype-chain involvement. Key enumeration versus protocol-driven value consumption. They share a name and nothing else.

**Q: Why is a plain object not iterable by default?**

Because object-as-dictionary is the more common contract: making every object iterable would make every object answer the question "what does walking it mean," and the answer is ambiguous for a dictionary (keys? values? both?). The language's choice is opt-in: you implement `[Symbol.iterator]` only where "walk this" has a definite meaning. That's also why iterables and array-likes are different things — `length`-having array-likes don't satisfy the iterator protocol, which is a separate mechanism (`Array.from` handles both, but through different code paths).

### Part 5 — Common Mistakes

**Junior/mid answer:** "A symbol is just a string with a different syntax, used to prevent duplicate property names."

**Senior answer:** Duplicate prevention between what? The description is not the identity — `Symbol('x') !== Symbol('x')` — and the real point is collision-proofing you never have to coordinate, in a namespace that can't collide with string keys. But the deeper miss is where symbols matter at all: the well-known symbols are the language's hooks. `Symbol.hasInstance` decides what `instanceof` reports (Session 4's deferral, now mechanical), `Symbol.iterator` decides what enters the iterable ecosystem. The junior framing stops at "unique keys"; the senior framing continues to "the engine's own extension mechanism."

**Another junior tell:** "`for...of` is for arrays."

**Senior correction:** `for...of` is for *iterables*, and arrays are one iterable among many — strings, Sets, Maps, generators. The protocol is `[Symbol.iterator]` plus `next()` returning `{ value, done }`; array-ness is irrelevant. This misconception is expensive in exactly one place: it hides why Session 6's `Promise.all` and friends accept a Set or a generator without conversion, and it leads people to `Array.from`-wrap things that are already iterable.

**Another junior tell:** "Anything with a `length` property is iterable."

**Senior correction:** `length` means array-like, which is a different mechanism from the iterator protocol — `Array.from` supports both, but `for...of` only speaks protocol. An object with `length: 3` and no `[Symbol.iterator]` throws a TypeError when `for...of` meets it. Conflating the two is a reliable junior tell precisely because both are "walkable" in the abstract.

### Part 6 — Production Examples

**Real incident — cross-bundle `instanceof` broke, and `Symbol.hasInstance` fixed it:** A monorepo app ended up with two copies of an SDK in one browser bundle — a legacy UMD copy and the hoisted package. Error-handling code caught SDK failures with `err instanceof SdkError`, and every check returned false, because the error object's prototype chain lived under the *other* copy's `SdkError`. The fix shipped exactly this session's mechanism: both copies share a brand symbol registered with `Symbol.for('sdk-error-brand')`, and a static `[Symbol.hasInstance]` on the error base checks the brand instead of the prototype chain. Session 4's `instanceof` follow-up became a production incident, and the answer to "why would you ever override `Symbol.hasInstance`" is: when the prototype chain is the wrong identity test.

**Real incident — an iterable API broke array-style consumers:** A data layer exposed an events API that consumers walked with `for...of`. Internally it returned arrays, so some consumers also indexed directly with `events[0]`. The team switched the internal producer to a lazy iterable (yielding events on demand, never materializing the full list), and the index consumers broke overnight — the first symptom in production was `events[0] is undefined` with no error. The fix was mechanical: snapshot consumers switched to `Array.from(events)` where a materialized list was genuinely needed; stream consumers stayed lazy and cheap. The lesson is the protocol's promise from the other side: array and iterable are interchangeable at the consumption site, which is power — and code that assumed "array" without saying so paid for the assumption.

---

## 2. Generators

### Part 1 — Theory

A generator function — `function*` — is a function whose body is a sequence of pause points. Calling it does not run the body; it returns a generator object. Each `next()` call runs the body up to the next `yield`, hands the yielded value to the caller, and suspends the function in place — local variables, loop position, everything. The next `next()` resumes exactly after that yield. That is pause/resume, and it is the entire difference from a normal function (runs to completion) and from a collection (fully materialized before anyone asks).

Pausing is also why generators get their dual nature. A generator object is both the **iterator** — it has `.next()` — and the **iterable** — `gen[Symbol.iterator]()` returns `gen` itself. That's why `for...of` and spread consume a generator call's result directly, no wrapping: it's Section 1's protocol, implemented by the same object in both roles. Verified in the harness: `gen[Symbol.iterator]() === gen`.

`yield*` is delegation: inside a generator, `yield* other` — where `other` is any iterable or generator — hands the walk over to it, each of its values flowing out through the delegating generator. When the delegated generator completes, its return value becomes the *value of the `yield*` expression*, so a generator can capture an inner result mid-sequence.

The claim this session's Critical Notes flag as the most commonly misstated: **yield is not one-directional.** The value passed to `.next(value)` becomes the *result of the yield expression the generator is currently paused at*. If the generator has `const a = yield 'X'`, then `gen.next(9)` makes `a === 9` inside the generator — the sent value lands where the generator left off, it is not an argument to the next yield, and it is not ignored. The harness verifies this by having the generator *read* what it receives and assert on the read value, not just on what it produces. This is the two-way communication channel: values out through `yield`, values in through `next`.

The practical payoff is **laziness**: the generator body is a *specification* of a sequence, never the sequence itself. An infinite loop inside a generator is not a hang — each `next()` computes one term and stops. An infinite Fibonacci yields its tenth term on the tenth call and never computes the eleventh. The harness proves this with a counter: after consuming ten terms, exactly ten terms have been computed. What you didn't ask for is never computed; that is the whole point, and it is why infinite sequences are the generator's canonical payoff.

Two extensions, named briefly per this session's scope: `generator.return(value)` and `generator.throw(err)` resume a paused generator with an early exit or an injected exception. And `async function*` — consumed by `for await...of` — applies the same pause/resume model to promises: each `next()` returns a promise, the generator body awaits before the next yield. Same shape, Session 6's mechanics underneath.

### Part 2 — Interview Answer

A generator is the answer to "I want to define a sequence as code, but produce it lazily, one piece at a time, and let the outside world drive the timing." You write a `function*` whose body runs until a `yield`, hands a value out, and suspends; the caller's `next()` resumes it in place. Local variables, loop position — everything about the function's state survives the pause.

The senior part is the two-way channel, because it's the claim people get backwards. Yield is not a one-way door. When the caller resumes with `next(value)`, that value becomes the *result of the yield expression* the generator is paused at. So if the generator has `const a = yield 'first thing'`, calling `gen.next(9)` makes that `a` equal to nine inside the generator. The value flows into the generator at the exact spot it left off — it is not passed to the next yield, and it is not ignored. I'd state that precisely, because interviewers follow up on exactly this line: the sent value is the answer to the question the generator asked.

Then the structure that makes generators shareable: a generator object is both iterator and iterable. It has `next()`, and its `Symbol.iterator` method returns itself — so `for...of`, spread, and `Array.from` consume it directly, no adapter, because Section 1's protocol is satisfied by the same object in both roles. And `yield*` composes: it hands the walk to another generator or iterable, and when that inner generator finishes, its return value becomes the value of the `yield*` expression in the outer one.

The payoff people actually remember is laziness, and it's worth saying correctly. An infinite generator is not a hang — the body is an infinite loop, but each `next()` computes exactly one term, so consuming ten terms computes ten terms. The tenth Fibonacci costs the same as the first; the millionth simply never happens unless you ask. That's the whole difference from an array: an array of a million terms must exist before you can read element ten, and a generator only ever holds the current step.

So in an interview: pause and resume, two-way communication, delegation, laziness. Each one is a mechanism with a name and a payoff, and none of them is "a function that yields values."

### Part 3 — Whiteboard / Live Coding

The canonical ask: "generate Fibonacci lazily and consume a bounded prefix — prove nothing beyond the prefix was ever computed."

```typescript
// An infinite generator: the body never ends, and that is the point.
// Each next() call computes exactly one term and suspends.
function* fibonacci(): Generator<number, void, void> {
  let [previous, current] = [0, 1];
  while (true) {
    yield previous;
    [previous, current] = [current, previous + current];
  }
}

const sequence = fibonacci();
const firstTen: number[] = [];
for (let n = 0; n < 10; n++) {
  const step = sequence.next(); // ask for exactly one term at a time
  if (!step.done) firstTen.push(step.value);
}
console.log(firstTen); // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

Narrated live: the `while (true)` looks like a hang, but every `next()` executes exactly one loop step — it yields, then suspends *on the yield*. Unless I keep calling, the eleventh term never gets computed even though the function "never returns." That is what laziness is: the infinite sequence is fully real in code and costs exactly what I consume. (The harness asserts this with a computation counter: consuming ten terms leaves the counter at ten; pulling five more moves it to fifteen — nothing runs ahead of the requests.)

Now the two-way channel, verified by *reading* the sent values:

```typescript
function* query(): Generator<string, string, void> {
  const first = yield 'paused-at-1'; // offer; suspend
  const second = yield `first-was:${first}`; // resume: first = sent value
  return `second-was:${second}`;
}

const gen = query();
console.log(gen.next());            // { value: 'paused-at-1',    done: false }
console.log(gen.next('injected'));  // { value: 'first-was:injected', done: false }
console.log(gen.next('also-injected')); // { value: 'second-was:also-injected', done: true }
```

The middle line is the claim: `gen.next('injected')` did not skip ahead and did not target the next yield. It resumed the generator at the yield it was paused on, made that yield's value `'injected'`, and the generator's own next line read it — `first` became `'injected'`, and the generator's next yield *shows the read value*. Caller data flows in; asserted in the harness, not just claimed.

Delegation, one block:

```typescript
function* inner(): Generator<number, number, void> {
  yield 1;
  return 42;
}
function* outer(): Generator<number, void, void> {
  const t = yield* inner(); // 1, then t === 42 — the inner generator's return value
  yield t;
  yield 99;
}
console.log([...outer()]); // [1, 42, 99]
```

### Part 4 — Follow-Up Questions

**Q: Is a generator an iterator or an iterable?**

Both, and that's deliberate. It has `next()` — the iterator role, so you can drive it manually — and `[Symbol.iterator]()` returns the generator itself — the iterable role, so `for...of`, spread, and `Array.from` consume it directly. The identity is verified: `gen[Symbol.iterator]() === gen`. That's why generators are the ergonomic way to implement the Section 1 protocol: you write the body, the engine builds both halves.

**Q: What happens when a generator finishes?**

The `next()` call that runs past the final statement returns `{ value: <return value>, done: true }`. A generator's `return` is data — the sequence's final value — not just a control-flow marker. After that, every further `next()` returns the same `done: true` result forever. Generators are single-pass: no rewinding, no restarting. If you want the sequence again, you call the generator function again.

**Q: What is `yield*` for?**

Composition. When a sequence is "a few items, then another generator's whole run, then more," the naive alternative is `for (const x of inner) yield x` — a manual pump. `yield* inner` is that in one expression, with the bonus that it captures the *inner* generator's return value, which is otherwise unreachable from outside. Recursive generators — tree walks, nested structures — are typically `yield*` compositions.

**Q: Does `for...of` over an infinite generator hang?**

Only if you let it run to completion — and it never completes. `for...of` stops when it sees `done: true`, which an infinite body never produces, so a bare `for (const x of fib())` runs forever. The correct bounded patterns: a `for` loop calling `next()` N times (Part 3), or `for...of` with an explicit `break` at the consumption site. Infinite generators pair with breaking consumers, never with open-ended loops.

**Q: When would you use an async generator?**

When each element costs an `await` — paginated API results, chunked file reads, a message stream — and you want laziness to extend across the network: don't fetch page two until the consumer reaches the end of page one. `for await...of` over an `async function*` gives the same pause/resume with promises as the resume point, reusing Session 6's mechanics. `next()` returns a promise; the generator body awaits before each yield; consumer-driven, exactly like the sync version.

### Part 5 — Common Mistakes

**Junior/mid answer:** "The value you pass to `.next(value)` is passed as the argument to the next `yield`." — some variants say "it just restarts the generator."

**Senior answer:** Both are wrong, and this is the claim the session flags as the most commonly misstated in the topic. The sent value is the *result of the yield expression the generator is currently paused at*. `const a = yield 'X'` followed by `gen.next(9)` makes `a === 9` — the value was read by the generator's next line. It is not the argument to the next yield (the next yield's *offer* is fixed when the generator reaches it) and it is not ignored. The way to be sure: write a generator that reads what it receives and assert on the read value — which is exactly what the harness does, because a generator that only yields outward never exposes the direction of the channel.

**Another junior tell:** "Generators compute their whole sequence up front, and `next()` just indexes into it."

**Senior correction:** Generation is not materialization. The body runs one step per `next()` call and stops at the yield; `next()` is not array indexing, it's *resuming paused code*. This misconception makes laziness incomprehensible — infinite sequences only work because nothing is computed ahead of the request, and the harness's counter proves it: ten consumed, ten computed, period.

**Another junior tell:** "A generator is basically an array you can iterate."

**Senior correction:** Arrays are re-iterable (each `for...of` gets a fresh iterator), fully materialized, indexable, and sized. A generator is single-pass, lazily computed, resumable, and possibly infinite. `arr[1]` is meaningful; `gen[1]` is not. The array-like instinct hides the one property that matters: an array holds what it holds, a generator is a specification of what it could hold.

**One more:** "Generators are what async/await is built from, so they're the same thing."

**Senior correction:** The same shape, different drivers. `async` functions resume when awaited promises settle; generators resume when the caller calls `next()` — a manual, synchronous gate. They compose (async generators), but calling them interchangeable confuses the resume trigger, which is the actual mechanism in both.

### Part 6 — Production Examples

**Real incident — the paginated analytics stream:** A client consuming a cursor-paginated analytics endpoint wrapped the pages in an `async function*`: each step awaited the next page and yielded its records one by one. Consumers walked it with `for await...of`, processing records as they arrived. The lazy payoff was concrete: rendering the first fifty records never fetched the page that held records fifty-one through two hundred — the generator is lazy the same way the sync one is, so the network and memory cost follows the consumer's actual progress, not the API's theoretical total. Same Session 6 promise mechanics, same Section 2 laziness, one mechanism.

**Real incident — frame-by-frame entity computation in a web game:** A canvas game needed per-frame entity state for a long sequence of frames — positions, animations, effect timings — and computing the whole timeline up front was both wasteful and wrong (input changes the future). The team modeled it as a generator: each `next()` returned the next frame's entity state, computed from the previous frame's output, and nothing past the current frame existed in memory. An endless mode consumed it with a bounded loop — twelve spawns meant twelve `next()` calls on an infinite engine, exactly the Part 3 pattern. The tradeoff made explicit: a generator trades away indexing and random access for the ability to be infinite, and a game timeline is a case where the trade is right.

---

## 3. Map, WeakMap, WeakSet, and Set

### Part 1 — Theory

**Map.** A `Map` is a key-value store that takes *any value as a key* — an object, a function, `NaN`, a number, a string — keeps entries in insertion order, reports a live `.size`, and iterates directly. Every one of those phrases is a contrast to the plain object you'd otherwise reach for, and the contrast is the guideline.

A plain object as a dictionary is weak in four ways. Keys are coerced to strings — `obj[1]` and `obj['1']` are the same slot, and an object key becomes `"[object Object]"` — so distinct identities collide before your code ever sees them. The prototype chain can intercept lookups (Session 4's `__proto__`/`constructor` collisions, the pollution incident). There's no reliable count without `Object.keys`, and no defined iteration order the way Map has it. And under frequent add/delete, the property machinery deoptimizes. When the key space is dynamic and arbitrary — object identities, numbers, `NaN` — Map is the container of record. (Session 3's memoization was string-keyed because that session's keys were strings; this is the general case.)

**WeakMap.** A `WeakMap` associates data with an object key *without making that object immortal*. Keys must be objects — a primitive key throws a TypeError. The reachability claim, stated precisely: **a WeakMap entry does not count as a GC root for its key.** If nothing else in the program references the key, the key — and with it the map entry — can be garbage collected. That is the mechanical truth behind Session 2's assertion (a closure can attach metadata without preventing collection) and Session 4's usage (hierarchy-wide private state that dies with its entity). What WeakMap does *not* promise is timing: when collection happens is the engine's business, and this session's harness deliberately asserts none of it — the structural API is verified, the GC schedule is not.

The design consequence: **a WeakMap cannot be iterated and has no `.size`.** Enumerating keys would require the map to know what's currently alive — to hold a live list of its keys, which means keeping strong references, which defeats the weak semantics. Even a `.size` would be a snapshot of liveness, leaking GC timing into observable program state. So the API is the design: `.get`, `.set`, `.has`, `.delete`, and nothing that asks "how many" or "which ones."

**Set and WeakSet.** A `Set` is uniqueness plus membership: it keeps exactly one of each value (SameValueZero — `NaN` counts as itself, `+0` and `-0` as one), and `.has(x)` is O(1) where an array's `.includes(x)` is O(n) — the answer to "how do I test membership without a scan." `WeakSet` is the same weak idea with the value removed: membership only, object-only, not iterable, no `.size` — "this object is in the set" without keeping the object alive. Set for tracking and dedupe; WeakSet for tracking that must not become retention.

### Part 2 — Interview Answer

The plain object feels like the default key-value store, so the senior answer starts by saying when it isn't. A Map keys anything — object identity, a function, NaN, a number — without coercion, preserves insertion order, has a real size, and iterates directly. The contrasts all point one way: when the keys are dynamic values rather than predetermined property names, Map is the container of record. A plain object is for records — a fixed, known shape with domain-name keys — not for a growing collection of arbitrary keys.

WeakMap is where seniority gets measured. It associates data with an object key without making that object uncollectable: the key does not count as a garbage-collection root. If nothing else references the key, the key and its entry can be collected. That's the reachability claim from Session 2 and the pattern Session 4 used for hierarchy-wide private state, now stated mechanically. Two things follow, and I'd say both. First, keys must be objects — a primitive key throws a TypeError, and that's structural, not a style preference. Second, the API shape follows from the semantics: no iteration, no size, no enumeration, because counting and enumerating would require the map to know what's currently alive — which means holding keys strongly, which defeats the entire point. The absent API is the design.

Set is the shorter story: uniqueness plus constant-time membership. Adding the same value twice keeps one copy, `.has` is O(1) against an array's linear `.includes`, and the size is always current. WeakSet is the same idea without the value: membership tracking for objects that must not keep them alive.

And the line that ties the family together: Map and Set are iterable by design, with size and order, because they hold their contents strongly and can afford to show them. WeakMap and WeakSet deliberately aren't — the inability to enumerate is the same property as their existence. An iterable WeakMap wouldn't be a WeakMap; it would be a Map that lies about its keys.

### Part 3 — Whiteboard / Live Coding

Three contrasts, each asserted in the harness.

**1. Map vs. plain object — key coercion is the collision:**

```typescript
const plain: Record<string, unknown> = {};
plain[1] = 'number-one';
plain['1'] = 'string-one';       // SAME slot — both keys coerced to the string "1"
console.log(Object.keys(plain)); // ['1'] — one key survived; one value was silently lost

const map = new Map<number | string, string>();
map.set(1, 'number-one');
map.set('1', 'string-one');
console.log(map.size);                       // 2 — identical-looking keys, distinct entries
console.log(map.get(1), map.get('1'));       // 'number-one' 'string-one'
```

Narrated: a plain object's keys are their string forms — that's the collision. Map keys are the values themselves, type and identity included.

**2. WeakMap — the structural API, asserted in the test file:**

```typescript
const weakMap = new WeakMap<object, string>();
const entity = {};
weakMap.set(entity, 'state');

console.log(weakMap.get(entity));   // 'state'
console.log((weakMap as any).size); // undefined — no .size at all
console.log(typeof (weakMap as any)[Symbol.iterator]); // 'undefined' — not iterable
console.log(typeof (weakMap as any).keys);             // 'undefined' — no enumeration
// @ts-expect-error — primitive keys are a TypeError (asserted in the harness):
// weakMap.set('primitive', 'x') throws TypeError
```

Narrated: the shape *is* the point. The APIs that would answer "how many keys" or "which keys" don't exist, on purpose — answering them would require knowing what's alive right now. WeakMap only answers per-key questions.

**3. Set and WeakSet:**

```typescript
const seen = new Set<number>();
seen.add(1);
seen.add(NaN);
seen.add(NaN); // SameValueZero: NaN equals NaN here — no duplicate
seen.add(0);
seen.add(-0);  // +0 and -0 are the same member
console.log(seen.size);      // 3 — {1, NaN, 0}
console.log(seen.has(NaN));  // true — O(1) membership, no scan

const seenWeak = new WeakSet<object>();
const obj = {};
seenWeak.add(obj);
console.log(seenWeak.has(obj));       // true
console.log((seenWeak as any).size);  // undefined — no size, not iterable, like WeakMap
```

### Part 4 — Follow-Up Questions

**Q: When do you use a plain object instead of a Map?**

When the object is a *record* — a fixed, known shape with domain-name keys ("name", "price", "status") that you'll read by name, pass to `JSON.stringify`, or hand to code that expects a plain object. The moment the key is not a predetermined property name — a number, an object identity, a dynamic set of arbitrary strings — Map is the better container. Record versus associative store; the distinction is the answer.

**Q: Will a WeakMap's key be collected immediately once nothing references it?**

No — and "no" is the correct answer, not an evasion. WeakMap guarantees reachability, never timing: the entry doesn't *prevent* collection, and when the engine actually collects is its own business, driven by GC cycles and memory pressure. This is why the harness asserts the structural API and not a collection schedule — a synchronous test cannot and should not observe when the GC runs. Anyone who promises "immediately" is stating a timing claim the language never made.

**Q: Can a WeakMap value cause retention?**

The value is held strongly while its entry lives — only the *key* is weak. If your code reads `weakMap.get(key)` and stores the result in a long-lived variable, that value stays alive as long as your variable does, because that's an ordinary reference now. So yes: a value hoisted out of the WeakMap into a module-level cache becomes ordinary retention. The WeakMap's guarantee is about the key's lifetime, not the value's.

**Q: Why exactly can't you iterate a WeakMap?**

Enumeration requires either a strong list of keys (defeating the weak semantics — the map would be keeping them alive just to list them) or asking the GC "which keys are alive at this instant," which leaks liveness and GC timing into observable program behavior. Both fight the transparency the weak reference exists to provide. The missing `.size` and iteration are therefore not API gaps; they're the same design decision as the weak semantics, expressed in the API shape.

**Q: How is Set's `.has` O(1)?**

Hashing: the engine stores members in a hash-based structure, so membership is a hash lookup (average constant time) rather than a scan. Arrays' `.includes` is a linear probe — worst case it walks every element. The count of members doesn't change the cost of `.has`; it changes the cost of `.includes`. That's the entire argument for Set when "have I seen this?" is a hot question.

### Part 5 — Common Mistakes

**Junior/mid answer:** "WeakMap is just a Map that cleans up after itself — use it when you want automatic deletion."

**Senior answer:** The direction of the guarantee is the opposite. Map holds strong references: entries live until you delete them, period. WeakMap holds keys weakly: entries may vanish whenever the key becomes otherwise unreachable, whether or not you ever call `.delete`. "Automatic cleanup" is an effect, not the contract — the contract is reachability. If the lifetime you need is "until my code says delete," that's a Map plus explicit `.delete`; if the lifetime is "as long as the key is alive elsewhere," that's a WeakMap. Choosing by "it's like Map but automatic" inverts the decision rule.

**Another junior tell:** "WeakMap values are weakly held too."

**Senior correction:** Only keys are weak. The value is an ordinary strong reference while the entry lives, so holding the value externally keeps it alive. (The subtle case: a value that references its own key creates a cycle the engine can still collect as a unit — but the practical rule to state is one-sided: keys weak, values not.)

**Another junior tell:** "Set is just an array that dedupes — `includes` is fine."

**Senior correction:** Dedupe is one feature; the other half is the membership cost. `includes` is a linear scan — O(n) per check, which is exactly the shape of "have I seen this?" loops that grow. Set's `.has` is O(1), and the size is current without bookkeeping. For a handful of items the difference is noise; for "have I already processed this event" at any real volume, it's the difference between a loop that degrades quadratically and one that doesn't.

**One more:** "WeakMap can't be used for memoization because it's not iterable."

**Senior correction:** Not being iterable is the point, not the obstacle — memoization keys the cache by input identity and needs no enumeration; and if the inputs are objects whose lifetime shouldn't be extended by the cache, WeakMap is exactly right (Session 3's memoization used string keys; object-keyed caches are the WeakMap-shaped case). Reaching for a Map "so I can clear it" conflates retention you want with retention you're trying to avoid.

### Part 6 — Production Examples

**Real incident — DOM-scoped state kept elements alive:** A team's visibility analytics recorded per-element observation state — first-seen time, session count — keyed by the DOM node. The first version used a `Map`, and because the Map held the node strongly, an element that had scrolled out and been removed from the DOM stayed alive, along with its heap-resident metadata, for the entire SPA session. Under heavy scrolling the growth was visible in heap snapshots as "elements that no longer exist, still referenced by a map." The fix was switching the keying to `WeakMap`: the state lives exactly as long as the element does, and when nothing references the element, the entry goes with it. That's Session 2's closure-metadata claim and this section's reachability semantics, in production.

**Real incident — the entity-hierarchy WeakMap (building on Session 4):** A game reused Session 4's module-scoped `WeakMap<object, number>` pattern for entity state across the `Entity → Unit → Player` hierarchy — hitpoints and combat timers keyed by the entity object. When a level was unloaded and the entity graph became unreachable, the state died with it; there was no parallel Map to sweep and no cleanup pass to forget. The Session 4 section covered the pattern's shape; what this section adds is why it stays leak-free: the map is not a GC root for its keys, so unload is automatic. The two sessions are the same decision at two levels of explanation.

**Real incident — request-object-keyed cache with a Set guard:** An API layer memoized in-flight requests in a `Map` keyed by the *request object itself* — `get(config)` returned the same pending promise for the same config identity, with no stringified-key collisions and no prototype-chain interference (the Session 4 pollution failure mode). Alongside it, a rendering pipeline used a `Set` to dedupe "already processed this frame" events, keeping the per-frame check O(1). The Map carried identity-keyed state; the Set carried uniqueness. Both are this section's "collections that do what objects can't" in one system.

---

## 4. Putting It All Together — The Full Walkthrough

One contract, three payloads.

**`Symbol.iterator` is the contract.** Symbols are the language's collision-proof keys, and the well-known symbols are the hook points the engine reserves: `Symbol.hasInstance` decides what `instanceof` reports — Session 4's deferral, now mechanical — and `Symbol.iterator` decides what is walkable. An object with `[Symbol.iterator]()` returning an iterator whose `next()` gives `{ value, done }` is iterable, and iterable is what every walking API demands: `for...of`, spread, destructuring, `Array.from`, and the Session 6 combinators and `AggregateError` constructor, which accept an iterable rather than an array.

**Generators are the ergonomic way to implement that contract.** `function*` plus `yield` is pause/resume: each `next()` runs one step and suspends on the yield, `yield*` delegates to other generators, and a generator is simultaneously its own iterator and its own iterable — `for...of` consumes it directly. Communication is two-way: `next(value)` resumes the paused yield with that value as its result, verified by a test that reads the sent value. And because nothing computes until pulled, a generator can be infinite.

**Map and Set are iterable by design; WeakMap and WeakSet deliberately are not.** The family splits on exactly one axis: strong references can afford size, order, and enumeration, and Map and Set have all three; weak references can afford none of them, because counting or enumerating would require knowing what's alive — the very transparency the weak semantics exist to avoid. The missing API is the same design decision as the existence.

Closing the loop to Session 6: `Promise.all`, `allSettled`, `race`, and `any` were quietly accepting anything that satisfied the iterable contract — an array by default, but a Set or a generator just as well. This session defined that contract, verified it, and showed the combinators were never array-specific: they were iterable-specific all along.

Session 8 closes Module 1 with destructuring, spread, rest, and ES modules — and the protocol shows up there immediately: destructuring and rest are iterable consumers, spread is iterable consumption in its most compact form, and the import/export machinery is the module system this session's vocabulary finally makes precise.
