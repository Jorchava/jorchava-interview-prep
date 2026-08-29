# Currying, Memoization, and Closures in Practice — React Hooks and Vue Composables

> Three connected topics showing closures as a production mechanism, not just an interview puzzle. Uses Session 2's vocabulary (retained lexical environment, live reference) without redefining it. Currying and memoization are direct applications of closure persistence; React hooks and Vue composables are the same mechanism at work in the frameworks you actually write.

---

## 1. Currying

### Part 1 — Theory

Currying transforms a function that takes multiple arguments into a sequence of nested functions, each taking a single argument: `f(a, b, c)` becomes `f(a)(b)(c)`. The name comes from Haskell Curry, but the concept predates him — it's a technique from lambda calculus where every function is unary.

The practical value of currying is **partial application**: you supply arguments one at a time, and each step returns a more specialized function. This matters most when:

1. **You have a generic function you want to specialize.** A logger that takes `(level, message)` can be curried so `const info = curry(logger)('INFO')` gives you a function that always logs at INFO level. You never repeat the level argument.

2. **You're composing functions.** If every function takes exactly one argument, composition `(f ∘ g)(x) = f(g(x))` is mechanical. Currying makes multi-argument functions composable with single-argument ones.

3. **You want point-free style.** You can define a new function by specializing an existing one without naming the argument: `const double = curry(multiply)(2)` instead of `const double = (x) => multiply(x, 2)`.

The mechanism behind currying is closure persistence as defined in Session 2 (`02-closures-arc.md`). Each call in the curried chain returns a new function whose `[[Environment]]` retains the arguments supplied so far. When the final argument arrives, the closure has collected all the pieces and calls the original function. No special runtime support is needed — just closures capturing live references to the accumulated arguments array, kept alive as long as the intermediate function exists.

The tradeoff: currying adds a small allocation cost (one function object per partially-applied argument) and a readability cost in languages where it's not idiomatic. JavaScript doesn't have automatic currying or partial application syntax like Haskell or Elm — you either implement a `curry` utility or use `.bind()` for partial application. Currying is most useful in JavaScript when you're building a composable utility library (like Ramda, lodash/fp) or when a specific API design calls for it. For one-off partial application, `.bind()` or an arrow function wrapper is simpler and more readable.

### Part 2 — Interview Answer

Currying is a transformation: you take a function that expects three arguments and turn it into a function that expects one, returns a function that expects the second, returns a function that expects the third. The practical use is partial application — you pre-fill some arguments and get back a more specific function.

Here's why a senior engineer cares about currying: it's not about writing `f(a)(b)(c)` instead of `f(a, b, c)`. It's about reusing a general function without repeating arguments. Your logger takes a level and a message. You curry it. Now you have `info`, `warn`, and `error` functions derived from the same logger. You didn't write three functions — you wrote one and specialized it.

And here's the connection that most mid-level answers miss: currying works because of closures. Each returned function closes over the arguments that have already been supplied. Those arguments stay alive in the retained lexical environment. When the last argument arrives, the closure calls the original function with everything it collected. The mechanism is exactly Session 2's counter — a closure retaining a live reference to a variable in its outer scope.

The follow-up I'd expect an interviewer to ask is about the tradeoff. Currying allocates a function per partially-applied argument. In a hot loop, that cost adds up. Ramda and lodash/fp handle this with internal optimizations (placeholder arguments, lazy evaluation), but a hand-rolled curry doesn't. Know when to use it — utility library design, event handler specialization, configuration helpers — and when to just write an arrow function.

### Part 3 — Whiteboard / Live Coding

The standard interview question: implement a generic `curry` function that transforms `f(a, b, c)` into `f(a)(b)(c)` or `f(a, b)(c)` (partial application).

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/03-currying-memoization-hooks-composables.test.ts
function curry<T extends (...args: any[]) => any>(fn: T) {
  const arity = fn.length;
  return function curried(...args: any[]) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  };
}
```

The approach: check whether enough arguments have been supplied. If yes, call the original function. If no, return a new function that, when called, concatenates its arguments with the ones already collected and checks again. The returned function closes over both `fn`, `arity`, and the partial `args` array — each returned function has its own `[[Environment]]` retaining the arguments accumulated so far.

Demonstrating it against a concrete function:

```typescript
function multiply(a: number, b: number, c: number): number {
  return a * b * c;
}

const curriedMultiply = curry(multiply);

// Full application all at once
console.log(curriedMultiply(2, 3, 4)); // 24

// Partial application — one arg at a time
const step1 = curriedMultiply(2);   // (b, c) => multiply(2, b, c)
const step2 = step1(3);             // (c) => multiply(2, 3, c)
console.log(step2(4));              // 24

// Partial application — two args at once
const double = curriedMultiply(2);  // (b, c) => multiply(2, b, c)
console.log(double(3, 4));          // 24
```

Function composition via currying:

```typescript
function add(a: number, b: number): number {
  return a + b;
}

function multiplyBy(a: number, b: number): number {
  return a * b;
}

const curriedAdd = curry(add);
const curriedMultiplyBy = curry(multiplyBy);

// Compose: double then add 1
const add1 = curriedAdd(1);
const double2 = curriedMultiplyBy(2);

// Using a simple compose helper
// VERIFIED — tested in examples/01-javascript-mastery/03-currying-memoization-hooks-composables.test.ts
function compose<T>(f: (x: T) => T, g: (x: T) => T): (x: T) => T {
  return (x: T) => f(g(x));
}

const doubleThenAdd1 = compose(add1, double2);
console.log(doubleThenAdd1(5)); // 11 — (5 * 2) + 1
```

### Part 4 — Follow-Up Questions

**Q: What happens if I pass more arguments than the function expects?**

The implementation above passes all arguments through regardless. That might be fine — JavaScript functions ignore extra arguments — or it might cause subtle bugs. A more robust implementation could use `fn.call(this, ...args)` and let the function handle extras, or explicitly guard against oversupply. In practice, this is a design choice: Ramda's curry is flexible, lodash's curry allows placeholders. Your implementation's behavior should match your use case.

**Q: How does currying differ from partial application?**

Partial application fixes some arguments and returns a function expecting the rest — like `.bind(null, arg1, arg2)`. Currying transforms an n-argument function into a chain of unary functions. Currying enables partial application, but not all partial application is currying — `.bind()` gives you partial application without transforming the function into a chain. The two concepts are related but not identical; an interviewer who conflates them is either testing whether you know the difference or doesn't know it themselves.

**Q: What about placeholder arguments in curried functions?**

Libraries like Ramda and lodash/fp support placeholders — a sentinel value that means "skip this argument, fill it later." `curry(f)(_, value2)(value1)` treats the first call's argument as the second parameter. Implementing placeholders requires tracking which positions are filled versus unfilled, which adds significant complexity. The implementation in Part 3 doesn't support placeholders; the standard interview question usually doesn't require them either, but mentioning them shows you've used real curry implementations.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Currying is when you call a function like `f(a)(b)` instead of `f(a, b)`."

**Senior answer:** That's the shape, not the point. The point is partial application and function composition. A senior engineer explains *why* you'd curry — to specialize a generic function without repeating arguments, to enable point-free composition, to build a composable API — not just what the syntax looks like. The interview follow-up is about the tradeoff: currying allocates per-partial-application functions, so using it in a hot render loop or an animation frame handler needs a cost-benefit check.

**Another junior tell:** "Currying is the same as `.bind()`."

**Senior correction:** `.bind()` gives you partial application by fixing `this` and some arguments, creating a bound function. Currying transforms the function's calling convention. You can implement partial application with `.bind()`, and you can implement currying without `.bind()` (as done above), but they are not the same mechanism. `.bind()` also sets `this`, which is a side effect — the curry implementation above preserves the original function's `this` behavior through the spread call. Mentioning this distinction explicitly during an interview signals that you understand both APIs at the implementation level, not just the usage level.

### Part 6 — Production Examples

**Real incident — Event handler specialization in a data grid:** A team maintained a data grid with configurable column renderers. The rendering pipeline accepted a generic format function `format(type, options, value)`. A curried version allowed each column definition to specify a specialized formatter once: `const currencyFormatter = curry(format)('currency', { decimals: 2 })`. This avoided repeating the type and options in every cell's render call and made the column config objects declarative rather than imperative.

**Real incident — Lodash/fp adoption for composable data pipelines:** A team processing real-time analytics data adopted lodash/fp's curried methods to build composable data transforms: `const processData = pipe(filter(activeUsers), map(aggregateByHour), take(100))`. Each function was already curried, so composition worked without wrapper functions. The team found that the curried style reduced the number of intermediate variables and made data-flow logic easier to read in code reviews — but also noted that debugging curried pipelines was harder because stack traces showed the intermediate curry wrappers rather than the original function names.

---

## 2. Memoization

### Part 1 — Theory

Memoization caches a function's return values keyed by its arguments. If the function is called again with arguments that match a previous call, the cached result is returned instead of re-executing the function. The insight is that for pure functions — functions whose return value depends only on their inputs and has no side effects — recomputing on every call is wasteful when the same inputs recur.

Memoization is a specific case of the general computer science principle of trading memory for CPU time. The cache lives as long as the memoized function exists, which means it's a memory commitment. A memoized function called with ever-changing arguments will grow its cache indefinitely, which is a memory leak in all but name.

The mechanism is a straightforward closure, as covered in Session 2 (`02-closures-arc.md`): the memoize wrapper declares a cache variable in its local scope, and returns a function that closes over it. Each call to the returned function checks the cache before delegating to the original function. The cache — a `Map` or plain object — persists in the retained lexical environment for the lifetime of the memoized function. The same live-reference mechanism that powers currying powers memoization: the returned function retains access to the cache across calls, and mutations to the cache (writing new entries) are visible to subsequent calls through the shared environment.

The hard problem in memoization is the cache key. A correct key strategy must map a set of arguments to a deterministic string or value that identifies them uniquely. There are four common approaches, each with tradeoffs:

1. **`JSON.stringify(args)`** — Simple and works for serializable primitives and plain objects. Breaks for non-serializable values (functions, `undefined`, symbols, circular references). Is order-sensitive for object keys — `{x: 1, y: 2}` and `{y: 2, x: 1}` produce different keys even though they're semantically identical.

2. **`Map` with object references as keys** — A single `Map` can use the arguments tuple itself as a compound key. This avoids serialization entirely and handles non-serializable values. But it uses reference equality, so two calls with different object instances that are structurally identical will both miss the cache.

3. **Structural hash** — A custom hashing function that walks the argument tree and produces a deterministic hash. This is what libraries like `memoizee` and `moize` implement. It handles the object-identity problem but adds hashing cost proportional to argument complexity.

4. **WeakMap for object arguments, Map for primitives** — A hybrid approach: use a `WeakMap` keyed by object arguments to avoid preventing garbage collection, and a `Map` or plain object for primitive keys. This handles the memory-leak aspect but doesn't solve the structural-equality problem.

The choice depends on your use case. For internal utility functions with primitive arguments, `JSON.stringify` is adequate and simple. For memoized selectors in state management (like Reselect's `createSelector`), reference equality on the last arguments tuple is sufficient because the state object identity changes when state changes — no structural comparison needed. For a generic, reusable `memoize`, you need to document which strategy you chose and why, because the tradeoffs are not optional — a wrong choice silently gives you stale results or unbounded cache growth.

### Part 2 — Interview Answer

Memoization caches function results by argument key so you don't recompute something you already computed. If you've got a pure function and you keep calling it with the same values, memoization saves you the work. The cache is just a closure variable — the wrapper declares a cache, returns a function that checks it before calling the original — same retained-environment mechanism as currying, same as any other closure.

The senior insight isn't that memoization caches results. It's that the cache key is the actual hard problem. If you serialize arguments with `JSON.stringify`, you get three failure modes in one: property order matters, so `{x:1, y:2}` and `{y:2, x:1}` are different keys; non-serializable values like functions or circular references throw or silently produce `undefined`; and the serialization itself costs time proportional to argument size. If you use a Map with object references, you avoid serialization but two structurally identical objects are different cache entries. Every call with a new `{x: 1, y: 2}` is a cache miss.

The answer an interviewer wants to hear is: "It depends on what you're memoizing." For Redux selectors, reference equality is right because the state object changes identity when anything changes. For a utility function that processes primitive arguments, `JSON.stringify` is fine. For an expensive computation that takes large data structures, you need a structural hash or a WeakMap-based approach. The answer that names the tradeoff directly — key identity vs. key equality, serialization cost vs. cache-hit rate — is the senior one. The answer that just defines memoization and shows a Fibonacci example is the junior one.

### Part 3 — Whiteboard / Live Coding

Implement a generic `memoize` function and demonstrate the cache-key problem with object arguments.

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/03-currying-memoization-hooks-composables.test.ts
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  const memoized = (...args: any[]): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  return memoized as T;
}
```

Happy path — primitive arguments:

```typescript
let callCount = 0;
function expensiveSum(a: number, b: number): number {
  callCount++;
  return a + b;
}

const memoizedSum = memoize(expensiveSum);

console.log(memoizedSum(1, 2)); // 3 — callCount: 1
console.log(memoizedSum(1, 2)); // 3 — callCount: 1 (cached)
console.log(memoizedSum(3, 4)); // 7 — callCount: 2 (new args)
console.log(memoizedSum(1, 2)); // 3 — callCount: 2 (cached again)
```

The object-argument gotcha — two different object instances with the same content:

```typescript
callCount = 0;
function getTotal(obj: { x: number; y: number }): number {
  callCount++;
  return obj.x + obj.y;
}

const memoizedTotal = memoize(getTotal);

// First call with {x: 1, y: 2}
console.log(memoizedTotal({ x: 1, y: 2 })); // 3 — callCount: 1
// Second call with a different {x: 1, y: 2} instance
// JSON.stringify produces the same key: '[{"x":1,"y":2}]'
console.log(memoizedTotal({ x: 1, y: 2 })); // 3 — callCount: 1 (cache hit)

// But: property order changes the key
// JSON.stringify({y: 2, x: 1}) is '{"y":2,"x":1}' — different string!
console.log(memoizedTotal({ y: 2, x: 1 })); // 3 — callCount: 2 (cache miss!)
```

The key difference: `JSON.stringify({x: 1, y: 2})` produces `'{"x":1,"y":2}'`, while `JSON.stringify({y: 2, x: 1})` produces `'{"y":2,"x":1}'`. These are different strings even though the objects represent the same value. The cache misses on a semantically identical call.

A `Map`-based approach using reference equality has the opposite problem:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/03-currying-memoization-hooks-composables.test.ts
// Alternative approach: Map keyed by the arguments tuple (reference equality)
function memoizeByRef<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<any[], ReturnType<T>>();
  const memoized = (...args: any[]): ReturnType<T> => {
    // Check if this exact arguments array reference is cached
    for (const [key, value] of cache) {
      if (key.length === args.length && key.every((k, i) => k === args[i])) {
        return value;
      }
    }
    const result = fn(...args);
    cache.set(args, result);
    return result;
  };
  return memoized as T;
}
```

But this approach also breaks — the iteration over the `Map` to find a matching entry is O(n) per call, defeating the purpose of memoization. And it doesn't help with the root problem: structurally identical objects with different references.

### Part 4 — Follow-Up Questions

**Q: How does React's `useMemo` relate to this memoize function?**

`useMemo` is memoization with a dependency array as the cache key instead of the full argument list. React compares the dependency array entries by reference (`Object.is`), not by serialization. If the deps haven't changed since the last render, React returns the cached value. This sidesteps the serialization problem entirely — the "key" is just the array of values from the previous render compared by reference. But it also means `useMemo` only persists across renders, not indefinitely — React evicts the cache when the component unmounts.

**Q: How do you handle recursive memoization?**

A recursive memoized function needs the memoized version to call itself for recursive calls, not the original function, otherwise only the top-level call is cached and the recursive calls re-compute everything. The fix is to assign the memoized function to a named variable and use that name inside the body. For a generic `memoize`, this requires the function to reference the memoized wrapper — a pattern called "memoization with recursion" that usually needs the function to accept itself as a parameter or use a Y-combinator variant.

**Q: What about memoization with async functions?**

Memoizing an async function introduces a subtle bug: if the function is called twice before the first call resolves, both calls see a cache miss, and two identical async operations start. A production memoize for async functions needs to cache the pending promise, not just the resolved value. Subsequent calls while the promise is pending should return the same promise instance. This is sometimes called "promise memoization" or "deduplication" and is the pattern behind libraries like `p-memoize`.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Memoization is a technique where you cache function return values to improve performance. Here's a Fibonacci example."

**Senior answer:** A Fibonacci example is the wrong demonstration because it teaches memoization as an academic concept rather than a production tool. The Fibonacci function is pure by nature, rarely called with overlapping arguments in real code, and the memoization benefit for factorial/Fibonacci is a classroom illustration, not a production decision. A senior answer demonstrates the cache-key tradeoff — serialization vs. reference vs. structural hash — because that's the decision you'll actually make when you memoize a selector, an API call, or an expensive computation. The Fibonacci example is a useful starting point; the tradeoff discussion is where the senior depth starts.

**Another junior tell:** "Just use `JSON.stringify` for the cache key — it works for everything."

**Senior correction:** `JSON.stringify` is the most common naive approach and it has three documented failure modes: it doesn't serialize functions, `undefined`, or symbols (it drops them or converts them to `null`); it throws on circular references; and it's order-sensitive for object keys. If you've used it in production without hitting these edge cases, you've either memoized only primitive arguments or gotten lucky. A senior engineer knows the failure modes and either documents the constraint or chooses a different key strategy.

### Part 6 — Production Examples

**Real incident — Reselect selector never memoizing due to an unstable input selector:** A team used `createSelector` for derived state calculations. One of the *input* selectors did inline filtering: `state => state.items.filter(i => i.active)` — a new array reference on every call, regardless of whether `items` had actually changed. Reselect's memoization compares input-selector outputs by reference (`===`), not the combiner's own return value — since this input selector never returned the same reference twice, the outer selector's cache check always failed, and the (expensive) combiner re-ran on every single call. The fix was memoizing the input selector itself (wrapping it in its own `createSelector`, or restructuring it to return a stable reference when the underlying data hadn't changed), which let the outer selector's reference check actually succeed.

**Real incident — API client memoization with object arguments:** An API client memoized GET requests keyed by the request config object. The config object was constructed inline on every call: `api.get('/users', { params: { page: 1 } })`. Because `JSON.stringify` was used as the cache key, requests with the same parameters but different key ordering in the config object produced separate cache entries. The team discovered this during a performance audit where the API client was executing duplicate requests. The fix was normalizing the config object keys before serialization, effectively implementing a deterministic JSON serializer for the cache key.

---

## 3. React Hooks and Vue Composables as Closures

### Part 1 — Theory

React hooks and Vue composables are different APIs built on the same underlying mechanism: closures. Understanding them through the closure lens — rather than through their respective API surfaces — is what separates a senior frontend engineer from an engineer who just knows how to use both frameworks.

**React function components re-run entirely on every render.** When a component renders, the entire function body executes. Every local variable — including destructured state from `useState` — is created fresh for that render. Any closure created during that render (an event handler, a `useEffect` callback, a `useCallback` argument) captures the variables from that specific render's scope.

This is the direct mechanism behind the stale-closure bug: if a closure is created on render 1 and persisted across renders (via an empty `useEffect` dependency array, a `useCallback` with empty deps, or being stored in a ref), it continues to reference render 1's variables. The function component re-runs on render 2 with new variables, but the persisted closure still points to render 1's retained lexical environment.

**Vue's Composition API `setup()` runs once per component instance.** Reactive state is declared via `ref()` which returns a `Ref<T>` object whose current value is accessed through `.value`. When a closure inside a composable or component references `count` (the ref object), it captures the ref object itself, not the primitive value. The ref object persists for the component's lifetime — its `.value` changes, but the object identity does not. So a closure reading `count.value` always reads the current value, because `.value` is a property access on a persistent object.

This is the actual mechanism behind why composables don't have the stale-closure bug. It's not "Vue's reactivity handles it" — that's a vague statement that doesn't explain anything. The precise explanation is: closures capture references, not values. In React, the reference is to a per-render local variable (a primitive). In Vue, the reference is to a persistent ref object whose `.value` property always reflects current state.

**A related but distinct Vue gotcha: destructuring a reactive object.** When you write `const { count } = reactive({ count: 0 })`, `count` is a plain number, not a reactive reference. Mutating it does nothing. The reactivity is lost because the proxy's getter was called once during destructuring, returning the primitive value. The fix is `toRefs()` which converts each property of a reactive object to an individual ref. This is not a stale-closure problem — it's a different mechanism (proxy interception vs. closure capture) — but it's commonly confused with one.

The framework comparison matters most in an interview where you're asked about one framework and the interviewer expects you to understand the other. The senior answer names the mechanism (closure capture of per-render variable vs. persistent object reference) and bridges the two frameworks without pretending one is simply "better designed."

### Part 2 — Interview Answer

React hooks and Vue composables both use closures. The difference in their stale-closure behavior isn't because one framework is more reactive — it's because of what the closures capture.

In React, the entire function component re-runs on every render. Every variable in that function is recreated. When you create an event handler or an effect callback during a render, it captures that render's specific variables. If you keep that closure alive across renders — an empty dep array in useEffect, a useCallback with empty deps — it still references the old variables from the render where it was created. That's the stale-closure bug. It's not a React bug — it's a mechanical consequence of per-render closures capturing per-render values.

In Vue, setup runs once. When you call `const count = ref(0)`, a ref object is created and that object lives for the component's lifetime. Any closure that references `count` captures the ref object, not the number 0. When the closure reads `count.value`, it's reading a property on an object that hasn't been recreated — the object's identity is stable. So the closure always sees the current value. The mechanism is the same — live reference in a retained lexical environment — but the thing being referenced is different: a persistent object instead of a per-render primitive.

A separate Vue gotcha that people conflate with stale closures is destructuring. If you write `const { count } = reactive({ count: 0 })`, you get a plain number, not a reactive reference. Mutating `count` does nothing. That's not a closure issue — that's proxies returning primitives through destructuring. The fix is `toRefs()`.

The reason this distinction matters in an interview is that it shows you understand the mechanism, not just the framework surface. React's stale closures and Vue's immunity to them are both explained by the same closure mechanics, interacting with different render models. An engineer who says "React has this bug, Vue doesn't" and stops there hasn't demonstrated depth. An engineer who can explain *why* in terms of closure capture targets has.

### Part 3 — Whiteboard / Live Coding

**React stale-closure bug and fix** — illustrative (requires React test harness; verified mechanically in the test file via plain-TS simulation):

```typescript
// ILLUSTRATIVE — not executed against a React test harness
// Requires @testing-library/react, which belongs to Modules 7-8

// BUG: Stale closure in useEffect with empty deps
//
// function BuggyCounter() {
//   const [count, setCount] = React.useState(0);
//
//   React.useEffect(() => {
//     const id = setInterval(() => {
//       // `count` is from render 1 — always 0
//       setCount(count + 1); // setCount(0 + 1) every tick → count is always 1
//     }, 1000);
//     return () => clearInterval(id);
//   }, []); // empty deps — effect never re-runs
//   // `count` is captured once, at mount time
//
//   return React.createElement('div', null, count);
// }
//
// FIX 1: Functional update (avoids capturing `count` entirely)
// function FixedCounter1() {
//   const [count, setCount] = React.useState(0);
//
//   React.useEffect(() => {
//     const id = setInterval(() => {
//       setCount(c => c + 1); // React passes the current state — no capture
//     }, 1000);
//     return () => clearInterval(id);
//   }, []);
//
//   return React.createElement('div', null, count);
// }
//
// FIX 2: Add `count` to the dependency array (effect re-runs when count changes)
// function FixedCounter2() {
//   const [count, setCount] = React.useState(0);
//
//   React.useEffect(() => {
//     const id = setInterval(() => {
//       setCount(count + 1);
//     }, 1000);
//     return () => clearInterval(id);
//   }, [count]); // effect re-created every time count changes
//
//   return React.createElement('div', null, count);
// }
```

The mechanical essence of the bug in plain TypeScript — verified:

```typescript
// VERIFIED — tested in examples/01-javascript-mastery/03-currying-memoization-hooks-composables.test.ts
// Simulates React's per-render closure capture
function simulateRender(initialState: number) {
  // This is like a React render: a fresh scope with fresh local variables
  let state = initialState;
  const getState = () => state;
  const setState = (n: number) => { state = n; };
  return { getState, setState };
}

// Render 1: creates a scope with state = 0
const render1 = simulateRender(0);

// A closure from render 1 captures render 1's `state` variable
const snapshotFromRender1 = render1.getState;

// Render 2: a new scope with state = 0 (like React calling the component again)
const render2 = simulateRender(0);
render2.setState(42); // render 2 updates its state

// The closure from render 1 still sees render 1's state — it's "stale"
console.log(snapshotFromRender1()); // 0
console.log(render2.getState());    // 42
```

**Vue composable — no stale-closure issue** — illustrative (requires Vue test harness):

```typescript
// ILLUSTRATIVE — not executed against a Vue test harness
// Requires @vue/test-utils and Vue runtime, which belong to Modules 7-8

// Vue 3 composable using the Composition API
//
// import { ref, onMounted, onUnmounted } from 'vue';
//
// function useInterval(delayMs: number) {
//   const count = ref(0);
//   let id: ReturnType<typeof setInterval> | null = null;
//
//   onMounted(() => {
//     id = setInterval(() => {
//       // count is a Ref<number> object — the closure captures the ref object,
//       // not the numeric value. count.value is a property access on a
//       // persistent object, so it always reads the current value.
//       count.value++;
//     }, delayMs);
//   });
//
//   onUnmounted(() => {
//     if (id) clearInterval(id);
//   });
//
//   return count;
// }
//
// Callers receive a Ref<number> — they can pass it to other composables
// or the template syntax, and it will always reflect the current value.
// No stale-closure risk because `count` is an object with stable identity.

// Vue gotcha: destructuring reactive objects (related but distinct)
//
// import { reactive, toRefs } from 'vue';
//
// const state = reactive({ x: 0, y: 0 });
//
// // BAD: destructuring extracts primitives — reactivity is lost
// const { x, y } = state;
// x++; // This modifies a local variable, not state.x
//
// // FIX: use toRefs() to preserve reactivity
// const { x, y } = toRefs(state);
// x.value++; // This correctly updates state.x and triggers reactivity
```

### Part 4 — Follow-Up Questions

**Q: Does `useCallback` eliminate the stale-closure problem?**

No — `useCallback` is memoization applied to a function reference. It returns the same function instance unless its dependency array changes. If the dependency array is empty, the callback is created once with render 1's captured values and never updated. The callback itself is stable, but the values it captured are stale. `useCallback` with the correct dependencies (including all values the callback reads) prevents unnecessary re-renders of child components but doesn't fix stale closures — it requires correct dependency management to avoid them.

**Q: Does `useRef` fix stale closures?**

`useRef` gives you a mutable object with a `.current` property — conceptually the same pattern as Vue's `ref`. A closure capturing a ref object captures the persistent object, not a per-render value. So yes, storing a value in a ref and reading `ref.current` inside a closure sidesteps the stale-closure problem, for the same reason Vue composables don't have it: the closure captures an object reference with stable identity. This is intentional — `useRef` is React's escape hatch for exactly this pattern, and it proves the mechanism is the same as Vue's.

**Q: Does Vue ever have stale closures?**

Vue's `setup()` runs once, so the classic React stale-closure pattern (a closure created on one render persisting across renders) doesn't apply. But Vue can have stale-closure-like problems in specific cases: if you create a closure inside `watch` or `watchEffect` that captures a primitive value from the outer scope (not a ref), and that value changes between calls, the closure sees the old value. This is the same closure mechanism — nothing framework-specific about it. The difference is that the idiomatic Vue pattern (store state in refs, pass refs to closures) avoids the trap by default, while the idiomatic React pattern (destructure state as primitives) creates the trap by default. Both are consistent with how closures work. Neither framework breaks the rules.

**Related to the React vs. Vue distinction — does `useRef` make React no different from Vue for stale closures?**

`useRef` makes React capable of the same pattern (mutable object reference captured by closure), but it's not the default or idiomatic pattern for state that triggers re-renders. `useState` is the default for re-rendering state, and `useState` returns a primitive on each render. `useRef` doesn't trigger re-renders when `.current` changes — it's for values that need to persist but don't affect the visual output. So while React has the same mechanism available (object reference in a closure), the idiomatic state pattern (primitive from `useState`) is what creates the stale-closure trap, and the idiomatic Vue pattern (ref object) avoids it. The distinction is about what the idiomatic code path looks like, not about what the underlying language can do.

### Part 5 — Common Mistakes

**Junior/mid answer:** "React has stale closures because of the rules of hooks. Vue doesn't have them because Vue is more reactive."

**Senior answer:** That's wrong in two directions. Neither is about "rules of hooks" or "more reactive." Both are about closures. React's component function re-runs on every render, creating new local variables. A closure that outlives its render captures that render's variables — exactly the same mechanism as Session 2's `var`-loop bug. Vue's `setup()` runs once, and reactive state lives in ref objects with stable identity. A closure captures the ref object, not the current value. Both frameworks are consistent with closure behavior. The difference is the render model, not the reactivity system. An engineer who frames it as "React is buggy, Vue is reactive" doesn't understand that both are doing exactly what closures are supposed to do.

**Another junior tell:** "Vue composables don't have closures — they use reactive refs instead."

**Senior correction:** Vue composables are entirely built on closures. The composable function itself creates a closure scope. The ref variables, the returned functions, the watchers — all of them use the same closure mechanism. A composable that returns `{ count, increment }` works because `increment` is a closure over the `count` ref. This is the same private-state pattern from Session 2, applied through Vue's reactivity system. Saying composables don't use closures means you don't see the mechanism behind the API.

**Senior answer for the React vs. Vue comparison:** The correct framing: React's render model creates new scope per render → closures capture that render's variables → persisting a closure across renders gives you stale values. Vue's setup-once model creates persistent ref objects → closures capture the ref, not the value → reading `.value` always gives current state. The same closure rules, different default patterns.

### Part 6 — Production Examples

**Real incident — Stale closure in a React sidebar navigation:** A team used `useEffect` with an empty dependency array to attach a scroll event listener on mount. The listener referenced `activeSection` from the component scope. When the user scrolled and `activeSection` updated via `useState`, the listener still checked the initial `activeSection` value, so the sidebar never highlighted the current section. The listener closure was created during mount and never recreated — classic stale closure. The fix was using a ref to track `activeSection` and reading `ref.current` inside the listener, which avoided capturing a stale primitive.

**Real incident — Composable safely closing over refs in Vue:** A Vue 3 application had a composable that managed WebSocket connections. The composable returned a `send` function and a `messages` ref. The component used `messages.value` in its template. When the WebSocket received a message, the handler pushed to `messages.value`. Because the handler captured the `messages` ref (not the current array), every new message was visible to the component's reactivity system — no stale-closure risk. The team migrated this same logic from a React codebase where the equivalent pattern had required ref-based workarounds.

**Real incident — Confusion between destructuring and stale closures in a Vue team:** A Vue developer new to the Composition API wrote `const { items } = reactive({ items: [] })` and expected `items` to be reactive. When pushing to `items` didn't update the template, they assumed it was a stale-closure problem. The actual cause was destructuring — `items` was a plain array, not a reactive proxy reference. The fix was either using `toRefs()` or accessing `state.items` directly without destructuring. This is a common confusion point because both issues (stale closures and lost reactivity) produce similar symptoms (values that don't update), but the mechanisms are completely different.

---

## 4. The Full Walkthrough — Closures Through the Stack

This chain — currying, memoization, React hooks, Vue composables — is not three separate topics. It's one idea applied at three levels of increasing production relevance:

**Level 1 — Currying:** A function returns a function that collects arguments and calls the original when complete. The intermediate functions close over the accumulated arguments, retained in the lexical environment. This is the purest expression of closure-as-persistence: each curried call creates a new scope with a new slice of the argument list.

**Level 2 — Memoization:** A function returns a function that checks a cache before delegating. The cache variable is closed over, retained in the lexical environment, and persists across calls to the memoized function. This is closure-as-cache: the retained environment holds shared state (the cache) that accumulates over the function's lifetime.

**Level 3 — React hooks and Vue composables:** The same mechanism, now at the framework level. React's per-render closures explain the stale-closure bug mechanically (not as a "hooks are weird" mystery). Vue's persistent ref objects explain why the same closure rules produce different default behavior. Both are closures. Both follow the same rules from Session 2. The difference is what the closure captures — a per-render primitive in React's idiomatic path, a persistent object reference in Vue's.

The stale-closure bug is not a bug. It's closures working exactly as specified, applied within a framework whose render model creates new scope on every execution. The immunity to it in Vue is not magic. It's closures working exactly as specified, applied within a framework whose render model creates persistent state objects. Both follow the same rule: closures retain live references to the scope they were created in, not snapshots of the values at creation time.

Session 4 opens a new sub-chain within Module 1: prototypes, classes, and inheritance. The closure you built across Sessions 2 and 3 — live reference, retained lexical environment, private state — is the foundation. Prototypes are a different mechanism for sharing behavior between objects, but the mental model (what does this function capture, what does it share, what keeps it alive) carries over.

---

*Currying, memoization, and framework hooks are all the same pattern observed at different scales: a closure retains a reference to its creation scope, and that persistence is what makes each of them work. Session 4 — prototypes, classes, and inheritance — continues the Module 1 chain with a different mechanism for behavior sharing.*
