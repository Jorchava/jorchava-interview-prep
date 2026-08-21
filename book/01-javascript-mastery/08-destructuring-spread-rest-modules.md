# Destructuring, Spread, Rest, and ES Modules

> Four constructs closing out Module 1 on one architectural line: destructuring and rest are two directions of the same unpacking machine, spread is its inverse, and three of the four run on Session 7's iterator protocol — while object destructuring and object spread are a separate, property-based mechanism that only shares their syntax. This session cashes in four deferred threads: Session 7's closing preview ("destructuring and rest are iterable consumers, spread is iterable consumption in its most compact form"), Session 1's module-scope claim (`01-execution-context-callstack-scope.md`), Session 2's module-pattern → ES-modules evolution (`02-closures-arc.md`), Session 3's Vue destructuring-reactivity gotcha (`03-currying-memoization-hooks-composables.md`), and Session 4's circular-import TDZ incident (`04-prototypes-classes-inheritance.md`). Every behavioral claim is verified in `examples/01-javascript-mastery/08-destructuring-spread-rest-modules.test.ts` — including the live-bindings claim across two real module files, the circular-import TDZ crash against spec-strict Node ESM (a spawned plain-`.mjs` pair, no bundler), and a documented deviation where this repo's own tooling (vitest's Vite-based module runner) resolves that same cycle without throwing. Vocabulary reused from Session 7 throughout: **iterable** (an object whose `[Symbol.iterator]()` returns an iterator), **iterator** (an object whose `next()` returns `{ value, done }`), and the **protocol** those two methods form.

---

## 1. Destructuring

### Part 1 — Theory

Two mechanisms share one syntax, and the interview distinction between them is the whole topic.

**The array form is a protocol consumer.** `const [a, b] = x` is Session 7's iterator protocol wearing pattern syntax: the engine calls `x[Symbol.iterator]()`, pulls `next()` values until the pattern is filled, and binds them. No array is required anywhere. A Set yields its members, a Map yields `[key, value]` pairs, a string yields characters, a generator yields its produced values, a hand-written iterable yields whatever its `next()` produces. Arrays are the everyday case simply because arrays are iterable — not because the syntax knows what an array is. A non-iterable throws a TypeError on the spot, the same rejection `for...of` gives, because the protocol is what refuses. Consumption is pull-driven: a pattern takes exactly the values it names, and the middle can be skipped with an elision (`const [first, , third] = x`).

**The object form is property access.** `const { a } = x` reads `x.a` and binds the local name. No iteration, no protocol, no `Symbol.iterator` — the engine performs ordinary `Get` operations against the keys in the pattern. It therefore works on anything property-carrying (plain objects, class instances, proxies) and quietly yields `undefined` for a missing property, but throws TypeError on `null`/`undefined` sources — you cannot read a property of null. The proof the two forms are unrelated: array-destructuring the same object that object-destructuring slices can throw, and vice versa — a Map object-destructures to nothing useful while array-destructuring it produces its pairs.

**Defaults** apply when the source value is `undefined` — and only then. `null` is a value and passes straight through; the default never fires. **Renaming** (`{ a: renamed }`) separates the source key from the local binding; **nesting** recurses the same rules.

**The swap idiom** is where the construct pays for itself: `[a, b] = [b, a]`. The right side evaluates fully first — a fresh array whose elements are the old values — then the pattern assigns both bindings. No temp variable, reads before writes, and the mechanism is the same protocol consumption this section defines.

**Destructuring never clones.** It binds references: the value pulled from a nested object is the same object, so mutation through the local name is visible to every other holder of that reference. The same shallow rule returns in Section 2, because both constructs share their copying model.

### Part 2 — Interview Answer

Let me start with why this construct earns its keep: swapping two variables without a temp. `[a, b] = [b, a]` — the right-hand side builds a fresh array, then the assignment writes both bindings. No third variable, and every read happens before any write. It's the small move that shows you think in values, not in mutation steps.

Then the part that separates answers: destructuring is not an array feature. The array form is Session 7's iterator protocol wearing pattern syntax — the engine calls `Symbol.iterator`, pulls `next()` values, and fills the pattern. It works on anything that satisfies the protocol: a Set, a generator, a string, a hand-written iterable with no length and no indexing. A plain array works because arrays are iterable, not because the syntax knows what an array is. Try to array-destructure a plain object and you get a TypeError — the same rejection `for...of` gives you, because the protocol is what's refusing.

Object destructuring is a completely different mechanism that shares the syntax: it's property access. `{ a } = obj` reads `obj.a`, full stop. No iteration anywhere. And the proof these aren't the same feature: object-destructure a Map and you get nothing useful, while array-destructuring the same Map gives you its key-value pairs. One object, two mechanisms, two answers.

Defaults are worth one precise sentence. A default applies when the source value is `undefined`, and only then. `null` is a value — it passes through and the default never fires. That's the detail interviewers use to check whether you've met the semantics instead of memorizing the shape. Renaming and nesting compose the same rules: the key selects the source property, the local binding is whatever you name it, and nested patterns recurse.

And the model that ties it down: destructuring never clones. It binds references. What you pull out of a nested object is the same object — mutate through your local name and every other holder of that reference sees it.

### Part 3 — Whiteboard / Live Coding

The classic ask: "pull the first two values out of a Set without any array in sight, swap two variables, then unpack a nested config with renames and defaults."

```typescript
// 1. Array destructuring on a NON-array iterable — the protocol under
//    pattern syntax. The Set is walked via [Symbol.iterator], exactly
//    like for...of would walk it (verified in the harness):
const [first, second] = new Set(['a', 'b', 'c']);
console.log(first, second); // 'a' 'b'

// A Map yields [key, value] pairs through the same protocol:
const position = new Map([['lat', 51.5], ['lng', -0.12]]);
const [[latKey, lat]] = position;
console.log(latKey, lat); // 'lat' 51.5

// 2. The swap idiom — right side fully evaluated before either write.
//    No temp variable exists anywhere:
let left = 'left';
let right = 'right';
[left, right] = [right, left];
console.log(left, right); // 'right' 'left'

// 3. Nested config, renamed and defaulted — the production pattern.
//    The key selects the source property; the local name is yours;
//    defaults fill in only undefined:
interface Config {
  server: { host: string; port?: number };
  retries?: number;
}
const raw: Partial<Config> = { server: { host: 'api.internal' } };
const {
  server: { host: hostname, port = 443 }, // nested + rename + default
  retries = 3,                            // default
} = raw;
console.log(hostname, port, retries); // 'api.internal' 443 3
```

Narrated while typing: the Set line is the point — there is no array, no `Array.from`, and the pattern pulls only the two values it names. Destructure a generator instead and it computes exactly those values — nothing else, which is Session 7's laziness showing up in a new consumer. The swap line works because `[right, left]` is a fresh array created from the old bindings before either assignment lands. The config line is property access holding its own: the nested pattern recursed into `raw.server`, renamed `host` to `hostname`, and neither default fired on a value that was present.

### Part 4 — Follow-Up Questions

**Q: What exactly throws when you array-destructure a non-iterable?**

A TypeError — "42 is not iterable (cannot read property Symbol(Symbol.iterator))". It is the protocol refusing, identical in mechanism to `for...of` over a plain object (Session 7). Object-destructuring `null`/`undefined` throws a TypeError too, but for a different reason: property access on null. Same error class, two mechanisms — a useful tell for naming which one you're in.

**Q: Do defaults cover `null`?**

No. `undefined` only, verified. `const { a = 1 } = { a: null }` gives `null` — the default never runs, because a value is present. If the domain uses `null` to mean "unset," normalize the source (`?? undefined`) or apply the fallback at the call site; the pattern itself will not save you.

**Q: Does destructuring copy?**

No — it binds references. Top-level values are copied into the fresh bindings, but a nested object or array is the same reference, so mutating through the local name mutates the source's data. Same rule as Section 2's spread: one level of protection, nothing deeper.

**Q: Can you destructure a generator twice?**

Not the same generator object. It is its own iterator (`gen[Symbol.iterator]() === gen`, Session 7), so consumption is single-pass: the first destructure exhausts what it pulled, the second gets the remainder — likely empty. If two consumers need the values, materialize once with `Array.from`.

**Q: Why can't object-destructuring pull values out of a Map?**

Because the object form is property access and a Map's entries are not properties — they are reachable only through iteration (Section 2 makes this same point about spread). Array-destructuring the Map works because the protocol yields the pairs. The same data structure answers both forms correctly, which is how you know the mechanisms are genuinely separate.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Destructuring is a feature for arrays and objects."

**Senior answer:** Flat wrong about the mechanism, and it shows in interviews the moment a Set is involved. The array form is a protocol consumer — it array-destructures a Set, a generator, a string, a hand-written iterable — and a plain object throws because plain objects are not iterable. The object form is property access and works on anything property-carrying. Failing to distinguish them predicts two real bugs: wrapping iterables in `Array.from` before destructuring (unneeded), and expecting object patterns to work on collection types (they can't).

**Another junior tell:** "A default kicks in whenever the value is missing — `null` included."

**Senior correction:** The default fires on `undefined`, and only that. `null` is a present value; the default is skipped and `null` flows through (verified). This is a genuine production bug shape — config systems commonly express "not set" as `null`, and `{ retries = 3 }` silently yields `null`, which then misbehaves downstream of the destructure.

**Another junior tell:** "Destructuring is a safe way to snapshot data before mutating it."

**Senior correction:** It binds references; nested structures are shared. The snapshot only holds one level. Relatedly, destructuring the same generator twice assumes re-iterability that a generator object doesn't have — the single-pass contract from Session 7.

**One more, framework-shaped (from Session 3):** destructuring a Vue `reactive()` proxy extracts raw values and plain arrays, losing reactivity — `const { x } = reactive(...)` — covered in full at `03-currying-memoization-hooks-composables.md`; the mechanic is exactly this section's: destructuring extracts, it does not wrap.

### Part 6 — Production Examples

**Real incident — config defaults silently skipped by an explicit `null`:** A platform feature-flag service serialized "not set" as `null` in its JSON config. Consumers destructured with defaults — `const { retries = 3 } = flags` — and because `null` is a value, the default never fired: retries became `null`, a retry loop treated `null < 3` as true, and a downstream job hammered an API. The team's fix normalized `null → undefined` at the service boundary so pattern defaults meant what they read like. The undefined-only rule was the production bug.

**Real incident — two components, one generator, one empty list:** A dashboard fed a table from a generator-backed data source and two components both destructured "the first few" values. Component A's destructure exhausted the single-pass generator; component B rendered an empty table with no error — the symptom that makes shared iterables dangerous (same contract as Session 7's mistakes section). The fix materialized the slice once with `Array.from` at the data layer and let both components destructure the array.

**Real incident — swap-without-temp inside a sort loop:** A leaderboard sort compared and then swapped adjacent score entries; the original version used a `temp` variable declared in the loop scope with `let`, which is fine, but code review caught a second mutation via the temp (`temp.nudge()` updated the wrong object) after a reference-sharing refactor. `[entries[i], entries[j]] = [entries[j], entries[i]]` removed the shared name entirely — reads before writes, no leftover alias to misuse. Small fix, but it is the idiom's actual job: fewer mutable names, fewer ways to touch the wrong object.

---

## 2. Spread

### Part 1 — Theory

Spread is two unrelated mechanisms that happen to share a syntax, and this section's load-bearing claim is that the two must never be conflated — the harness verifies the difference directly.

**Array literals and function calls consume the protocol.** `[...x]` walks `x` exactly the way `for...of` does — `[Symbol.iterator]()`, then `next()` until `done` — building an array from the results. `fn(...x)` hands the same walked values to a call as individual arguments. Any iterable works: a Set, a generator, a string (spread into characters), a hand-written iterable — verified for Set, generator, and string. A non-iterable throws a TypeError, the familiar protocol rejection, and so does spreading `null`/`undefined` into an array.

**Object spread copies properties — it does not iterate.** `{ ...x }` copies `x`'s own enumerable properties, string keys and symbol keys alike, skipping inherited ones and non-enumerable ones (verified individually). The proof it never iterates: object-spreading a Map or a Set yields an empty object — their entries/members are reachable only through the protocol, never as own enumerable properties (verified: `{ ...new Map([['a', 1]]) }` is `{}`). Unlike array spread, an object spread of `null`/`undefined` is a no-op rather than an error (verified) — the asymmetry itself identifies which mechanism you're in. The result always has the plain `Object.prototype`; a spread never preserves its source's prototype.

**The copy is shallow.** Own property values are copied as references, so a nested object or array is shared with the source. The harness demonstrates the leak: mutating `copy.nested.count` changes `original.nested.count`, because they are the same object. Order matters: later keys win, which is what makes `{ ...defaults, ...user }` the canonical merge. And because spread constructs a fresh object with data properties, it never triggers a setter — unlike `Object.assign`, which writes through a target's setter (verified with a probe: the assign path observed the setter invocation; the spread path produced a data property). Both forms do read getters on the source.

The price of the syntax is allocation: every spread builds a fresh array or object, and call spread pushes every element onto the argument list — a large enough iterable overflows the engine's argument limit with a RangeError, the production hazard in Part 6.

### Part 2 — Interview Answer

Spread is the construct where the whole answer is one sentence: it's two unrelated mechanisms that happen to share a syntax. Everything else is consequences.

In array literals and function calls, spread consumes the iterator protocol. `[...x]` walks `x` the same way `for...of` does — `Symbol.iterator`, `next()`, value and done — and `fn(...x)` hands those values to the call as individual arguments. Any iterable works: a Set, a generator, a string. A non-iterable throws the same TypeError `for...of` throws. That's why `Math.max(...scores)` works on a Set of scores with zero conversion.

Object spread does not iterate, and the proof is one line: `{ ...someMap }` is an empty object, every time, because a Map's entries are not own enumerable properties — they're only reachable through the iterator protocol. The two spreads share the three dots and nothing else. Object spread copies own enumerable properties, strings and symbols, skipping inherited and non-enumerable ones, and it is shallow.

Shallow is the word to say out loud. A spread copy is a new top-level object whose property values are the same references as the source. Change something nested in the copy — an element in an array, an object inside — and the original changes with you. The copy never protected you below one level. That's not a bug; it's the definition. If you need a deep copy, spread is the wrong tool; structuredClone or a real clone routine is the right one.

Two details a senior reaches for. Order matters: later keys win, so `{ ...defaults, ...user }` is the canonical merge. And unlike `Object.assign`, spread can't trigger a setter — the target doesn't exist yet; spread creates fresh data properties, it doesn't write through anything. Null and undefined sources are quietly skipped, where array-spreading null throws. Same syntax, opposite personalities — naming the mechanism you're in is the whole game.

### Part 3 — Whiteboard / Live Coding

The ask: "merge these three constructs — a Set, a generator, and an override layer — and prove the shallow-copy gotcha in front of me."

```typescript
// 1. Protocol consumption in array literals and calls. The Set and the
//    generator are iterables; no conversion exists anywhere:
function* extraScores(): Generator<number> {
  yield 9;
  yield 10;
}
const scores = new Set([3, 1, 2]);
console.log([...scores]);                 // [3, 1, 2]
console.log(Math.max(...scores, ...extraScores())); // 10

// 2. Object spread: own enumerable properties, later keys win.
//    The canonical merge shape:
const defaults = { host: 'localhost', port: 80, retries: 3 };
const overrides = { port: 443 };
const config = { ...defaults, ...overrides };
console.log(config); // { host: 'localhost', port: 443, retries: 3 }

// 3. THE shallow-copy gotcha, demonstrated: `copy` is a new object,
//    but `nested` is the same object as the source's one:
const original = { nested: { count: 1 }, list: [1, 2, 3] };
const copy = { ...original };

copy.nested.count = 99;
copy.list.push(4);

console.log(original.nested.count); // 99 — the "copy" shared this reference
console.log(original.list);         // [1, 2, 3, 4] — same array, same leak

// 4. The Map trap that separates the mechanisms:
const map = new Map([['a', 1]]);
console.log({ ...map });                       // {} — spread did NOT iterate
console.log({ ...Object.fromEntries(map) });   // { a: 1 } — the property route
```

Narrated while typing: line 1 is protocol — both spread sites walk the iterables, and the call spreads them as arguments, which is how `Math.max` sees ten. Line 2 is property copying — `port` from overrides wins because it comes later. Line 3 is where I slow down: the spread copied the top-level references, so `nested` is literally one object with two owners, and the mutation I made through the copy is visible through the original. The harness asserts both leak lines — they can fail if the spread behaved like a deep clone, which is the point. Line 4 is the mechanism's fingerprints: same three dots, opposite result.

### Part 4 — Follow-Up Questions

**Q: Why does `{ ...new Map() }` produce an empty object?**

Because object spread copies own enumerable properties and never iterates, while a Map's entries live only behind the iterator protocol. The empty object is not a bug — it's the mechanism being honest about what spread does. To convert a Map to a plain-object record, `Object.fromEntries(map)` is the tool, which is exactly the iteration route.

**Q: Object spread versus `Object.assign` — same thing?**

No, two differences that matter. `Object.assign` mutates its target and writes through setters — a target with a setter for `x` receives `assign`'s value through it (verified); spread builds a fresh object with data properties, so no setter can ever fire. Both read source getters, both copy symbol keys, and neither descends into nested structures; `assign` needs its first argument and spread doesn't.

**Q: How do you actually deep-copy then?**

`structuredClone` for data that survives the structured-clone algorithm (plain objects, arrays, Dates, typed arrays, Maps, Sets), or a purpose-built clone for anything with functions/classes/prototypes — spread is never the answer, because shallow is its definition rather than a limitation.

**Q: Can call spread overflow?**

Yes — a sufficiently large iterable overflows the engine's argument-count limit with a RangeError (the classic `Math.max(...hugeArray)` failure). The fix is chunked loops or explicit reduction over the iterable. The hazard is why call spread is fine for bounded collections and wrong for unbounded ones. (Part 6's metrics incident.)

**Q: Does spread read getters on the source?**

Yes, once per property, verified — a getter with a counter fired exactly once during a spread. The value read is the value copied; spread does not re-read. And because the result is a plain data property, the copy carries the value, not the getter.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Spread clones the object, so I can edit the copy safely."

**Senior answer:** Spread copies one level. The nested object is the same reference — the harness proves the leak (mutate `copy.nested`, watch `original.nested` change). Calling spread a clone is how immutable-state bugs start; the honest sentence is "a new top-level object over shared references."

**Another junior tell:** "You can build an object from a Map with `{ ...map }`."

**Senior correction:** That yields `{}` — object spread copies own enumerable properties, and a Map's entries aren't properties. The senior fix is `Object.fromEntries(map)`, which consumes the protocol. This exact trap is the mechanism question, wielded at production shape.

**Another junior tell:** "Array spread and object spread are the same feature, just with different brackets."

**Senior correction:** They share syntax and nothing else — protocol consumption versus own-enumerable property copying. The asymmetry is observable: `[...null]` throws, `{ ...null }` is `{}`; `{ ...map }` is `{}` while `[...map]` is the entries. Someone who says "same feature" has not met the Map test.

**One more:** "Spreading is free / cheap."

**Senior correction:** Every spread allocates — a fresh array or object per syntax site, and call spread stacks every element as an argument. In hot loops and on unbounded collections, both the garbage and the argument-limit RangeError are real production costs.

### Part 6 — Production Examples

**Real incident — a shallow state copy corrupted a reducer's history:** A client-state store updated a scene's nested settings with `{ ...state, settings: newSettings }` — then a later patch did `const s = { ...state }; s.settings.difficulty = 'hard';` and dispatched `s` as a finished action. Because `settings` was shared, the earlier snapshot's nested object mutated in place, and replay of action history replayed a corrupted difficulty state across "past" frames. The fix: never mutate through a spread copy — every nested write needs its own spread chain (`{ ...state, settings: { ...state.settings, difficulty: 'hard' } }`). The code review rule that came out of it: a spread copy is only safe to write at its own depth.

**Real incident — `Math.max(...series)` RangeError in a metrics aggregator:** A metrics service computed daily maxima by call-spreading an entire time-series array into `Math.max`. A backfill query pushed a series past the engine's argument limit and the job died with a RangeError in production, taking several hours of aggregations with it. The fix chunked the series (reduce over windows) — and the incident write-up's one-liner became: call spread is for bounded argument lists, never for data.

**Real incident — object-spreading a headers Map wiped a webhook payload:** A webhook sender stored headers in a `Map`, and a refactor "simplified" the payload-building line to `{ ...headers }` — the outgoing payload silently lost every header, because the Map's entries are not own enumerable properties. The team's debugging took a session precisely because nothing threw; the fix was `Object.fromEntries(headers)`. The empty object was the mechanism speaking, and everyone wanted a warning.

---

## 3. Rest

### Part 1 — Theory

Rest has one job — collect "everything else" — and it does it in three syntax sites with one rule and one notable contrast.

**Rest parameters** gather the arguments beyond the named ones into a real, genuine array — `Array.isArray` true, `.map`/`.filter`/`.reduce` present, and zero remainder yields an empty array (all verified). The collected array is a fresh copy of the remainder, not a view. Rest must be the last parameter; anything after it is rejected at parse time — indeed even the `Function` constructor, which compiles its parameter list at runtime, throws a SyntaxError for `('...rest', 'last', ...)` (verified). The constraint is the feature: a fixed parameter shape in front, an unambiguous remainder behind.

**The arguments object is the contrast, and the contrast is interview-grade.** It is array-like, not an array: it has `length` and indices, but no array methods (`typeof arguments.map` is `'undefined'` — verified). One subtlety that connects to Session 7: arguments IS iterable — it satisfies the iterator protocol — so `[...arguments]` and `Array.from(arguments)` work without `slice.call` tricks; iterable is simply not array, exactly the distinction from Session 7's follow-up. Then arrows: an arrow function has no `arguments` binding of its own — the identifier resolves to the *enclosing* function's arguments object if one exists (verified), and at module top level it is a ReferenceError (verified). Rest declares its parameter, so it works in every function shape. One more historical note: in sloppy mode, `arguments` aliases the parameters (mutating `arguments[0]` changes the first parameter); strict mode — and ESM, which is strict by default — removes the aliasing. Rest never has either problem, because it is its own array.

**Rest in destructuring patterns** is the same idea applied to unpacking. `const [first, ...others] = arr` collects the tail into an array — and because array-form destructuring runs on the protocol, this works on any iterable, a Set or generator included (Session 7's consumers again). `const { a, ...rest } = obj` collects the remaining own enumerable properties — string and symbol keys, inherited properties excluded, exactly mirroring object spread minus one key (all verified). Symbol keys do land in object rest, matching object spread's own-enumerable copying; the Babel-era folklore that rest drops them does not match the spec behavior this session measured.

**Rest is the inverse of spread**, the tie this session's closing section makes: one scatters values into a call or collection, the other gathers the remainder. Both are allocation points — rest copies the remainder into its array, O(n) in the tail size.

### Part 2 — Interview Answer

Rest exists to fix the arguments object, and the three differences are the answer.

First: rest gives you a real array. The remainder lands in a genuine Array — `Array.isArray` returns true, `map` and `filter` and `reduce` are all right there, and zero remainder gives you an empty array. The arguments object is array-like instead: it has length, it has indices, and it is iterable — satisfying the same protocol a Set satisfies. But iterable is not array. No map, no filter, no reduce. Before rest, you wrote `Array.prototype.slice.call(arguments)` to get an array; rest just hands you one.

Second: arrows. An arrow has no arguments binding of its own — never did, by design. Write `arguments` inside an arrow at module top level and you get a ReferenceError; inside another function, it resolves upward to that function's arguments object. Rest declares its parameter, so it works everywhere, arrows included.

Third: rest is constrained on purpose. It has to be the last parameter — the language rejects anything after it at parse time, a SyntaxError before the code ever runs. That constraint is the feature: the parameter list has a fixed shape, and the remainder is unambiguous.

The same idea shows up in destructuring. `const [first, ...others] = arr` collects the tail into an array — and because array destructuring runs on the protocol, it works on any iterable, not just arrays. Object rest is object spread minus one key: `const { password, ...safe } = user` strips one property and hands you everything else, copying own enumerable properties only — inherited properties never ride along. That exact line is how production code keeps secrets out of a webhook payload.

The sentence to remember: rest collects the remainder, always into a real array, always last, and it's the inverse of spread — one gathers, one scatters.

### Part 3 — Whiteboard / Live Coding

The ask: "write a variadic `sum` without touching `arguments`, then split a Set into head and tail, then strip a property off an object before it leaves the server."

```typescript
// 1. Rest parameters — the remainder arrives as a real array,
//    .reduce and friends included, zero work to convert:
function sum(...nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}
console.log(sum(1, 2, 3, 4)); // 10
console.log(sum());           // 0 — zero remainder is an empty array

// 2. Rest in array destructuring — protocol-driven, so a Set works:
const [head, ...tail] = new Set([10, 20, 30]);
console.log(head);       // 10
console.log(tail);       // [20, 30] — Array.isArray(tail) === true

// 3. Object rest — the payload-stripping pattern at a server boundary.
//    Own enumerable properties only; inherited ones never ride along:
interface User {
  id: string;
  password: string;
  email: string;
}
const user: User = { id: 'u1', password: 'hunter2', email: 'a@b.c' };
const { password, ...safePayload } = user;
console.log(Object.keys(safePayload)); // ['id', 'email'] — password gone
console.log(password);                 // 'hunter2' — still in scope, but off the wire

// 4. The contrast, for the record — arguments is iterable but not an
//    array; rest is both:
function probe(..._all: unknown[]): void {
  console.log(Array.isArray(arguments)); // false
  console.log(typeof arguments.map);     // 'undefined'
  console.log(Array.isArray(_all));      // true
}
probe(1, 2, 3);
```

Narrated while typing: line 1 is the whole pitch — the remainder is an array, so the reducer just works; the empty call is the edge case and rest handles it by being `[]`. Line 2 shows rest inheriting the protocol: the Set is walked, one value to `head`, the rest collected — no array anywhere in the source. Line 3 is the production pattern: `password` is stripped into its own binding, the payload carries only what the wire is allowed to see, and object rest's own-enumerable rule means a prototype-sitting field cannot sneak in. Line 4 is the interview contrast, asserted rather than claimed.

### Part 4 — Follow-Up Questions

**Q: `arguments` — what's the real story vs. rest?**

Array-like, not array: length and indices, no methods, and it does not exist in arrows. It IS iterable, so `[...arguments]` works — but iterable being not-array is the Session 7 distinction. One legacy wrinkle: in sloppy mode `arguments` aliases the parameters; strict mode and ESM remove the aliasing. Rest is a real array, exists in every function, and has no aliasing story — that is the entire argument for it.

**Q: Can rest coexist with defaults and named parameters?**

Yes — named parameters first, then the rest parameter last: `function f(a, b = 2, ...rest)`. The default rule is the destructuring rule (Section 1): the default applies to `undefined` only. `f(1)` with `b = 2` gives `b === 2`; `f(1, null)` gives `b === null`. The unknown may be anything, hence the identifier name.

**Q: What exactly does object rest copy?**

Own enumerable properties minus the destructured keys — string and symbol keys both (verified: a symbol-keyed property does land in rest), inherited properties never. It is object spread with the extracted keys subtracted, which is why it is the natural "strip before sending" tool and why prototype-amplified fields cannot leak through it.

**Q: Does rest cost anything?**

It is an O(n) copy of the remainder into a fresh array at every call — fine for bounded signatures, and it is also how variadic chains scale; extreme argument counts are exactly where spread's RangeError lives (Section 2). `arguments` was historically cheaper in V8 precisely because it was a view, not a copy — a legacy-performance footnote that occasionally surfaces in old interviews.

**Q: Rest in destructuring — any array-specific behavior?**

No — `const [head, ...tail] = iterable` runs on the protocol, so a Set or generator destructures the same as an array (verified). The one asymmetry: it consumes one pass, so the same generator cannot be split twice — Section 1's single-pass rule.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`arguments` is effectively an array, I just use it directly."

**Senior answer:** `arguments` has no `.map` — `typeof arguments.map` is `'undefined'` (verified). Calling a method on it throws, which is the classic production crash for a function that grew variadic. The conversion idiom (`Array.prototype.slice.call`) was the pre-ES6 answer; rest is the answer now. Saying "effectively an array" misses both the mechanism (array-like) and the fix (rest).

**Another junior tell:** "Arrow functions have `arguments` too — it's just discouraged."

**Senior correction:** Arrows have no `arguments` binding, full stop. The identifier resolves to the enclosing function's arguments object when one exists, and is a ReferenceError at module top level (both verified). There is no shadowed-arguments story to argue about — it is lexical resolution, the same rule Session 1 defined for every other identifier.

**Another junior tell:** "Rest can go anywhere in the parameter list."

**Senior correction:** Rest must be last — the language rejects a parameter after it at parse time, and even the `Function` constructor throws a SyntaxError for the shape (verified). The rule is not style; the remainder is only unambiguous at the end.

**One more:** "Rest and arguments are interchangeable, pick whichever."

**Senior correction:** Rest is a real array that exists in arrows and needs no conversion; arguments is a non-array view with lexical quirks. Choosing arguments for a new variadic signature carries every historical penalty for zero benefit.

### Part 6 — Production Examples

**Real incident — `arguments.map` killed a variadic analytics handler:** An event-ingestion handler had grown variadic ("event name, then any number of payload values") and inside it used `arguments.map(...)` to normalize each value — which never worked once more than the named parameter was passed, because `arguments` has no `map`. The crash was intermittent by construction: single-payload calls passed (the named parameter carried the work), multi-payload calls threw. The fix was `(...values: unknown[])` with a typed array — and TypeScript could then catch the misuse statically, which `arguments` had kept invisible.

**Real incident — `const { password, ...safe } = user` at the API boundary:** A webhook sender had been serializing the full user object; a field hygiene audit found credentials reaching third-party payloads. The boundary code switched to object rest — destructure the secret into a local binding, spread-send the remainder — and the same line became the enforced rule for every payload type in the module. The incident's lesson doubles as this section's Part 3: rest-in-object-form is the language's own "everything except this one key" operator.

**Real incident — head/tail destructure of a unique-token stream:** A rate-limiter fed by a Set-backed stream of issued tokens split each batch with `const [current, ...queue] = batch` — one token dequeued for service, the remainder requeued. Because rest-in-array-form runs on the protocol, the Set never needed materializing into an array first, and the single-pass rule was respected by only ever destructuring the same Set object once per batch. Rest plus Session 7's protocol in one production line.

---

## 4. ES Modules

### Part 1 — Theory

**Named and default exports.** A module exports *bindings*: named exports are individual bindings (`export let counter = 0; export function bump() {...}`), and the default export is the module's single binding named `default`, commonly the main function or component the module exists to provide. Import forms: `import { counter } from './m'`, `import { counter as c } from './m'` (rename at the import site), `import d from './m'` (default — the name is yours), `import * as ns from './m'` (namespace object), and re-exports (`export { x } from './m'`, `export * from './m'`). Both named and default are live bindings; the default is a binding like any other — an imported value updates when the exporting module's binding changes.

**Module scope, not global scope.** Session 1 settled this in its "module scope vs. script scope" follow-up (`01-execution-context-callstack-scope.md`): top-level declarations in a module live in module scope — they are not properties of the global object — and imports/exports are the only connections between files. Session 2's module-pattern history (`02-closures-arc.md`) is where the IIFE gave way to this: the file is the closure now. This section does not re-derive either claim; it assumes them.

**Live bindings.** The spec links import entries to the exporting module's exact bindings at instantiation time: an imported name is a *live reference*, not a snapshot taken at import. If the exporter mutates its binding, every importer sees the current value on the next read. And the direction is one-way: the importing module's binding is read-only — assigning `counter = 99` in an importer is a TypeError (verified), because the exporter owns the binding. Mutation flows through the exporter's own functions. The harness verifies both halves across two real files (`lib/live-binding-exporter.ts` + `lib/live-binding-reader.ts`): read 0, call the exporter's `bump()`, read again — 1. A snapshot semantics would have stayed 0.

**Phases and circular imports.** Module evaluation runs in ordered phases: parse, then *instantiate* (every binding in the whole dependency graph is created and linked — imports are static structure, hoisted above the module body), then *evaluate* (module bodies run in dependency order, initializers assigning their bindings). Two spec-guaranteed consequences: bindings exist and are live for the entire graph before any body runs, and circular imports are therefore legal whenever nothing reads before initialization. The crashing shape is a read at evaluation time of a binding whose initializer hasn't run — a TDZ ReferenceError, exactly Session 4's class-in-a-circular-import incident (`04-prototypes-classes-inheritance.md`). Both cases are verified this session: the working cycle (`lib/circular-a/b.ts`) evaluates fine because both modules only assign at evaluation time and read later; the crashing cycle (`lib/tdz-spec-a/b.mjs`) throws `Cannot access 'a' before initialization` under spec-strict Node ESM — spawned as plain `.mjs` files so no bundler is involved.

**Bundler taxonomy (this session's Critical Notes divergence).** The spec is the contract; tooling is a set of points in the same space, and this project's own tooling is one of them. Measured this session: vitest's Vite-based module runner resolves the same TDZ crash cycle without throwing — the in-flight read does not fail — which is a documented deviation from spec-strict Node ESM (asserted by the harness as a locked-in behavior, not hand-waved). Node's own ESM-CJS interop is a second point: named imports from a CommonJS module work only to the extent Node's static lexer (`cjs-module-lexer`) recognizes the export pattern — its detection patterns are deliberately frozen, and dynamically assigned exports collapse to the `default`. Bundlers go further in varying directions: Vite performs its own "smart import analysis" to make named CJS imports work, esbuild statically analyzes the module graph, and Vite 8's Rolldown switch even changed how a CJS module's `default` is resolved. Any claim about an import's behavior that depends on the module being CommonJS, or on a specific bundler's transform, is tooling behavior — say so, the way this paragraph does.

### Part 2 — Interview Answer

Two phrases carry this whole topic: live bindings, and module scope.

Module scope is Session 1's claim, and I won't re-derive it — top-level declarations in a module live in module scope, not on the global object, and exports and imports are the only connections between those scopes. Nothing else is shared.

Live bindings is the mechanism behind imports, and it means an imported name is a live reference to the exporting module's binding — not a snapshot taken at import time. If the exporter increments a counter, every importer sees the new value on the next read. This session verified that with an actual two-module test: I read the imported counter, called the exporter's own function to mutate it, and read again — the value moved. But the binding is one-directional, and this is spec-guaranteed: the importing side cannot assign through it. `counter = 99` in an importer is a TypeError, because the exporter owns the binding. If you want to change it, you call the exporter's function that changes it.

Named versus default is the simpler half. Named exports are individual bindings you import by identifier, optionally renamed at the import site. Default is a single binding per module — usually the one function or component the module exists to provide — and the import picks a name for it. Both are live bindings; the default is just a binding named default.

Circular imports deserve precision. What the spec guarantees: the whole graph's bindings are instantiated — hoisted and live — before any module body runs. What it does not guarantee: that a binding is initialized at any given moment. So a cycle is fine while nothing reads during evaluation, and it crashes with a ReferenceError the moment some module's top-level code reads a binding whose initializer hasn't run yet. That is exactly Session 4's production incident, mechanism complete. And the bundler caveat has to be said out loud: spec-strict Node ESM throws there — this session spawned a plain `.mjs` pair to verify it — while some bundler runtimes resolve the same cycle silently. The spec is the contract; your toolchain is a specific point in that space, and we measured one.

### Part 3 — Whiteboard / Live Coding

The ask: "show me two modules where an imported value changes after import, then explain when circular imports break."

```typescript
// ---------------------------------------------------------------------------
// Module A: lib/live-binding-exporter.ts (verbatim from the harness)
// ---------------------------------------------------------------------------
export let counter = 0;

export function bump(): void {
  counter += 1; // the EXPORTER mutates its own binding
}

export function read(): number {
  return counter;
}
```

```typescript
// ---------------------------------------------------------------------------
// Module B: lib/live-binding-reader.ts — imports across a real file boundary
// ---------------------------------------------------------------------------
import { counter } from './live-binding-exporter';

export function readCounterFromExporter(): number {
  return counter; // a live reference — reads the CURRENT value, not a snapshot
}
```

```typescript
// The importing test file (assertions from the harness):
import { bump } from './lib/live-binding-exporter';
import { readCounterFromExporter } from './lib/live-binding-reader';

const before = readCounterFromExporter();
console.log(before); // 0

bump(); // module A mutates its own binding

const after = readCounterFromExporter();
console.log(after); // 1 — module B's import reflected the new value
```

Narrated while typing: module B never touches `counter` — it only re-reads the imported name through its own function, which is how the observation crosses a real module boundary. Calling `bump()` updates module A's binding; the `after` read returning 1 is the live binding. A snapshot semantics would have stayed 0, and the harness will fail if someone regresses it to that. The same test file also asserts the read-only side: assigning to `counter` from the importer throws a TypeError, and the legal mutation path is always through `bump()`.

```typescript
// Now the circular pair. WORKING: both modules only assign at evaluation
// time and read later, so the cycle resolves legally (harness-verified):
//
//   lib/circular-a.ts:  import { b } from './circular-b';
//                       export let a = 'a-value';
//                       export function readB() { return b; }
//   lib/circular-b.ts:  import { a } from './circular-a';
//                       export let b = 'b-value';
//                       export function readA() { return a; }
//
// CRASHING: the same shape, one change — a read at EVALUATION time.
// Under spec-strict Node ESM (the harness's plain-`.mjs` twin,
// lib/tdz-spec-a/b.mjs, spawned as a subprocess):
//
//   lib/tdz-b.ts:  import { a } from './tdz-a';
//                  export const earlyRead = a;   // ← a's initializer hasn't run
//
//   → ReferenceError: Cannot access 'a' before initialization
//   (this repo's own vitest runner resolves the same cycle silently — the
//   bundler caveat below, verified and locked in by the harness)
```

The narration to close on: bindings are hoisted — instantiated and live — for the whole graph before any body executes; what is not guaranteed is initialization. The fix pattern for a genuine cycle is to defer the problematic read out of module scope — into a function call or an explicit lazy access — which is exactly the code change Session 4's incident shipped.

### Part 4 — Follow-Up Questions

**Q: Can an importing module reassign an imported binding?**

No — the imported binding is read-only by spec, and the harness verifies the TypeError on assignment. The exporter owns the binding; mutation flows through the exporter's own exported functions (or its methods). Design consequence: state that updates over time belongs behind functions, not bare exported `let`s.

**Q: What actually breaks live bindings?**

Anything that turns ESM into a copy at the boundary — the classic case is transpiling to CommonJS: `require` takes a snapshot, and live-linkage must be re-implemented (typically with getters) or it silently degrades. It is why tooling interop claims are bundler-claims, this session's caveat. Verified example of the same class: this repo's own module runner resolves an in-flight circular-read cycle that spec-strict Node ESM crashes on — tooling is a point in the space, never the space.

**Q: Is `import * as ns` different?**

Namespace import gives one frozen-looking object of all bindings; its properties are read-only but reflect the current values (the harness asserts the namespace counter tracks mutations). Named imports remain the everyday form; the namespace is for tooling and whole-module forwarding (`export * as ns from`).

**Q: Are circular imports always a bug?**

No — the working pair evaluates fine; the spec guarantees hoisted liveness, not initialized-ness. The rule of thumb: cycles are safe when evaluation-time code never reads the other module's still-initializing bindings (functions are safe — function declarations are initialized during instantiation — top-level `let`/`const`/class reads mid-cycle are the crash shape). Session 4's production incident was a class — exactly the crash binding kind.

**Q: ESM in the browser — what depends on tooling?**

Spec-bare imports require full specifiers (relative paths with extensions, absolute URLs) because browsers resolve nothing themselves; bundlers relax extensions, directory imports, and bare package names. Also, a `default` import from a CommonJS package is interop — Node's lexer or your bundler decides what `default` means (Vite's own docs call it "smart import analysis"; Vite 8's Rolldown change even altered CJS default resolution). Spec questions get spec answers; interop questions get "depends on the toolchain" answers, named as such.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Imports are snapshots — the value is copied at import time, so changing it later in the exporting module doesn't matter."

**Senior answer:** The opposite, and it is spec-guaranteed: the imported binding is live, mechanically linked at instantiation — the harness shows an importer observing an exporter's mutation across two real files. The snapshot mental model predicts the wrong value where production code depends on the right one, and it misses why mutation-through-the-exporter is the only legal path (imports are read-only; assignment throws).

**Another junior tell:** "Circular imports always crash, so never write them."

**Senior correction:** Also wrong in the other direction. Bindings are hoisted graph-wide before evaluation, so cycles are legal whenever nothing reads before initialization — verified by the working pair. The precise statement, for an interview: the spec guarantees bindings are hoisted and live; it doesn't guarantee initialized values, so the crash shape is a read during evaluation, a TDZ ReferenceError — Session 4's incident, capstone'd here.

**Another junior tell:** "ES module top-level variables are globals" / "imports are globals."

**Senior correction:** Session 1 settled it: module scope, not global scope — top-level module declarations never become properties of the global object. The module system is the file-scoped closure from Session 2 wearing an import/export header; confusing module scope with global scope predicts real collisions when third-party scripts enter the page.

**One more:** "I can import a named export from any npm package — CommonJS included — because it's ESM under the hood."

**Senior correction:** Coming from a CJS package, a named import works only as far as the toolchain's static analysis reaches: Node's `cjs-module-lexer` (frozen detection patterns) or the bundler's own analysis. Dynamically assigned CJS exports collapse into `default`. That is tooling behavior, and the honest interview line is "the spec has no CJS interop — every interop rule is Node's or the bundler's."

### Part 6 — Production Examples

**Real incident — the class in the circular import (Session 4, now mechanically complete):** Two modules imported each other; module A instantiated a class from module B at top-level, and after a refactor to `class` syntax the call hit `ReferenceError: Cannot access 'B' before initialization` under one import order — because class bindings (like `let`) are TDZ-uninitialized until their initializer runs, while the old constructor-function pattern's binding was initialized during instantiation (Session 4's incident, `04-prototypes-classes-inheritance.md`). The fix — deferring the instantiation out of module scope — is this section's rule: hoisted-live, initialized-later. The crash was never about "circular imports are evil"; it was a read-before-initialization precise as a clock.

**Real incident — live bindings through a CJS rewrite silently became snapshots:** A team shipping a shared metrics module to a legacy consumer compiled it with a bundler to CommonJS output. The ESM source's `export let status` updated at runtime; downstream `require()`-based consumers read a captured value — because the interop boundary was a snapshot, not a getter chain — and the dashboard showed stale status. The taxonomy mattered: the spec's live-binding guarantee held in ESM, and the CJS output's behavior was entirely tooling-defined (esbuild's own CJS output, for the record, emits getters for live bindings — but Node's frozen `cjs-module-lexer` patterns then may not recognize the emitted shape as named exports at all; Node issue #50981 documents the frozen-pattern friction). The fix ran the shared module as ESM end to end. The incident write-up's rule is this session's caveat: live bindings are the spec; interop is the tool.

**Real incident — the config module that hot-reloaded because of live bindings:** A build-flag module (`export let featureFlags = {...}`) was imported across dozens of files, and the dev-server HMR pipeline edited one module — the flag module — while every importer kept running. Live bindings are exactly what made the update propagate without reloading the world: the flags binding changed, and each importer's next read saw it. The flip side recorded in the same incident: the flags module must never be imported for its snapshot — only for its current state — which is the same one-directional read-only distinction this section asserts.

---

## 5. Putting It All Together — Unpack, Scatter, Gather, and the Module Boundary

Four constructs, one machine, two mechanisms.

**Destructuring and rest are the same operation in two directions.** Both *unpack*: array-form destructuring pulls named positions from a sequence; array rest collects the remainder of that sequence; object-form destructuring pulls named properties; object rest collects the remainder of the properties. Rest is destructuring's "and everything else" clause, and it inherits whichever mechanism its pattern form uses.

**Spread is the inverse of rest.** Rest gathers; spread scatters — rest collects the remainder into a real array, spread hands a sequence's values out into an array literal or a call. They are the same arrow pointing opposite ways, which is why variadic plumbing (call with `...`, receive with `...rest`) reads as one idea in both directions.

**Three of the four run on Session 7's protocol.** Array destructuring, array-literal spread, and call spread are all iteration consumers — they call `[Symbol.iterator]`, pull `next()` values, and stop at `done`. Whatever Session 7 established about iterables applies to them wholesale: non-iterables refuse with a TypeError, generators are single-pass and lazy, a Set is just as good as an array. **Two of the four do not.** Object destructuring and object spread are property mechanics — own-key reads and own-enumerable copies — that share the syntax and nothing else. The Map test separates them in one line: `{ ...map }` is `{}`, `[...map]` walks the pairs, `const { a } = map` reads a property. The same object, three answers, two mechanisms.

**ES modules sit one level up with the same DNA.** Live bindings connect module scopes the way closures connect function scopes (Session 2's module pattern was a closure at file scale; Session 1's module-scope claim — cited, not re-derived — is what imports are for). And the module system's edge cases are this session's edge cases rediscovered: import-time reading pitfall is the destructuring-reference rule, and the bundler-vs-spec distinction is the closing caveat of every part of this chain.

**Module 1 retrospective.** Eight sessions, one execution model — Session 1's execution context and call stack, Session 5's event loop and queues, Session 6's promises and async/await — and one memory model — Session 1's scope and hoisting, Session 2's closures and garbage collection, Session 4's prototypes and classes, Session 7's reachability threads through WeakMap/WeakSet. This session's syntax sits on top of both: destructuring and spread are protocol consumption built from Session 7's iterable contract; rest is the same unpacking machine in its gathering direction; and ES modules are scope mechanics at file scale, carrying Session 1's TDZ and hoisting rules across module boundaries. Module 1 is complete: the execution model, the memory model, and the syntax layer above both.

Module 2 picks up at Session 9 with HTML — semantic markup and its accessibility/SEO implications. The browser module boundary begins where the language module ends, and the language machinery now existing in this book is the vocabulary the HTML chain will lean on.

---

*Module 1's final session: destructuring, spread, and rest are one unpacking machine running on Session 7's protocol, ES modules are Session 1's scope rules at file scale with verified live bindings — and Module 1 closes its execution model, memory model, and syntax layer together.*