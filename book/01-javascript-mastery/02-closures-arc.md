# Closures, Lexical Environment, Garbage Collection, Private State, and the Module Pattern

> Five connected topics tracing one line: how a function remembers the scope it was created in, why that memory persists, and what you can build with it. Reuses Session 1's vocabulary — lexical environment, scope chain, execution context — without redefining it. Currying, memoization, and hooks/composables are Session 3.

---

## 1. Closures — What and Why

### Part 1 — Theory

A closure is a function bundled with a persistent reference to the lexical environment in which it was created. It is not a snapshot of the variable values at creation time — it is a live reference to the bindings themselves. If the outer variable changes after the closure is created, the closure sees the new value.

Every function in JavaScript is technically a closure, because every function carries a reference to its outer environment. But the term is practically used for functions that *outlive* the scope they were created in — when a nested function is returned or passed as a callback, it retains access to bindings from its parent scope even after the parent has finished executing.

Three things make a closure useful:

1. **Memory access** — the closure can read and write variables from its outer scope.
2. **Persistence** — those outer bindings stay alive as long as the closure does.
3. **Encapsulation** — no code outside the closure's scope can reach those bindings except through the closure itself.

The most common framing is wrong: "a closure is a function that remembers the variables it was created with." That implies a copy. The correct framing is: a closure is a function that retains a reference to the scope it was created in, and sees whatever those variables hold at the moment the closure *runs*, not the moment it was *created*.

### Part 2 — Interview Answer

A closure is a function that carries a persistent reference to the scope it was created in. Not a copy of the variables — a live reference to the bindings themselves. So if you create a closure that reads a variable, and that variable changes later, the closure sees the new value when it runs.

The most direct way to show this is a counter. An outer function creates a local variable and returns an inner function that increments it. Every call to that inner function sees the current value of the variable, not a frozen copy. That proves it's a live reference.

What makes closures interview-important is they come up in three different ways. The first is the mechanism itself — can you explain how the engine keeps variables alive after the outer function returned? The second is encapsulation — closures are the original way to get private state in JavaScript, before private class fields existed. The third is the gotcha — the closure-in-a-loop bug, where every iteration's closure captures the same variable unless you use let or an extra function scope.

The senior answer connects those three. It doesn't just define a closure and give an example. It says: here's the mechanism — a retained reference to the lexical environment — here's what it enables — private state and the module pattern — and here's the trap — closures retain the environment, not specific variables, so a closure that doesn't even use a particular variable can still keep it alive and cause a memory leak. The deepest answer is the one that leads to garbage collection, not the one that stops at defining the term.

### Part 3 — Whiteboard / Live Coding

```typescript
// The core demonstration: live reference, not snapshot
function createCounter(): { increment: () => number; read: () => number } {
  let count = 0;
  return {
    increment: () => ++count,
    read: () => count,
  };
}

const counter = createCounter();
console.log(counter.read()); // 0
counter.increment();
console.log(counter.read()); // 1 — live reference, the closure sees the mutation

// Proving it's a reference, not a copy: create two closures that share
// the same binding — mutating x proves both see the change
function sharedBinding(): { setX: (v: number) => void; a: () => number; b: () => number } {
  let x = 1;
  return {
    setX: (v: number) => { x = v; },
    a: () => x,
    b: () => x,
  };
}
const { setX, a, b } = sharedBinding();
console.log(a()); // 1
console.log(b()); // 1
setX(99);
console.log(a()); // 99 — a and b share the same binding, not independent copies
console.log(b()); // 99

// The closure-in-a-loop bug — and the fix
function captureWithVar(): void {
  const fns: (() => number)[] = [];
  for (var i = 0; i < 3; i++) {
    fns.push(() => i);
  }
  for (const fn of fns) {
    console.log(fn()); // 3, 3, 3 — every closure sees the same `i` (3)
  }
}

function captureWithLet(): void {
  const fns: (() => number)[] = [];
  for (let i = 0; i < 3; i++) {
    fns.push(() => i);
  }
  for (const fn of fns) {
    console.log(fn()); // 0, 1, 2 — each closure captures a different binding
  }
}

captureWithVar();
captureWithLet();
```

### Part 4 — Follow-Up Questions

**Q: Does a closure capture the variable or the value?**

The variable. The closure holds a reference to the binding in the outer lexical environment, not a copy of what the variable held at closure-creation time. This is why the counter example works and why the `var`-loop bug happens — every closure created in that loop refers to the same `i` binding, and when the loop finishes, they all see its final value.

**Q: What's the relationship between closures and IIFEs?**

An IIFE (Immediately Invoked Function Expression) is a function that runs as soon as it's defined. Before `let` existed, the closure-in-a-loop fix was wrapping the loop body in an IIFE, which created a new scope each iteration whose parameter held the iteration value. `let` in a `for` header does the same thing implicitly — the spec says each iteration gets its own binding.

**Q: Can you have a closure without a function?**

No. Only functions create closures in JavaScript. A block (`{}`) creates a scope for `let` and `const`, but it doesn't create a closure — there's no function to carry the reference. The closure mechanism is specifically a function's `[[Environment]]` internal slot holding a reference to its outer lexical environment.

### Part 5 — Common Mistakes

**Junior/mid answer:** "A closure is a function that remembers variables from where it was defined. It takes a snapshot of the variables at the time the function is created."

**Senior answer:** The snapshot framing is the most common wrong answer and it directly contradicts how closures actually behave. A closure is a live reference to the variable bindings, not a copy of their values. The proof is a counter returned from a factory function — the inner function sees the current count, not the count at creation time. Senior engineers also know the second-order implication: because closures hold references to the *environment* rather than individual variables, a closure can keep an entire scope's bindings alive even if it only uses one of them. That's the GC angle, and it's the difference between knowing what a closure is and understanding what it actually costs.

**Another junior tell:** "A closure creates a copy of the variable."

**Senior correction:** A closure does not copy anything. It retains a reference to the lexical environment record. All closures created in the same scope share the same environment record — which is why the `var`-loop bug makes every closure see the same `i`.

### Part 6 — Production Examples

**Real incident — Subscription callback in a Vue composable:** A composable created a WebSocket connection inside `onMounted` and attached a message handler. The handler referenced a reactive `messages` array from the composable's scope. The composable was used in a list view where items were frequently mounted and unmounted. On unmount, the WebSocket was closed, but closures inside promise chains that had been created earlier still held references to the component's state, preventing garbage collection. The fix was cancelling the promise chain or using a `__disposed` flag that the closure checked before touching the reactive state.

**Real incident — The `var` loop bug in a 2015 codebase:** A team used `var` in a `for` loop that created event handlers. Every handler captured the same loop variable. When the handlers eventually fired (after the loop had finished), they all used the final iteration value. The fix was switching to `let` for the loop variable, which was the exact motivation for `let`'s per-iteration binding behavior in the ES2015 spec.

---

## 2. Lexical Environment — Why Closures Actually Work

### Part 1 — Theory

A closure works because of how the engine manages lexical environments. When a function is created, the engine sets its `[[Environment]]` internal slot to the currently running execution context's lexical environment. This is the scope chain link that Session 1 described — the outer environment reference that each execution context carries.

When the outer function returns, its execution context is popped from the call stack. But the lexical environment that was created for that function call does *not* necessarily disappear. The call stack frame is freed, but the environment record — the actual bindings — lives on the heap as long as anything references it. The closure, through its `[[Environment]]` slot, holds that reference.

This is why the vocabulary from Session 1 matters: a `LexicalEnvironment` is a pointer to an `EnvironmentRecord`, and that record exists on the heap. The call stack only holds the execution context scaffolding. When the stack frame is popped, the heap-allocated environment record survives if the closure's `[[Environment]]` still points to it (or to a parent environment in the chain).

The retained lexical environment is not a full copy of the outer scope. It is exactly the same environment record that existed while the outer function was executing. If two closures are created in the same function call, they share the same environment record. If one closure modifies a variable, the other sees the change.

### Part 2 — Interview Answer

The question behind the question when someone asks about closures is: how does the engine actually keep variables alive after the function returned? And the answer is the lexical environment, which connects directly to Session 1's scope chain.

Every function, when it's created, gets an internal slot called `[[Environment]]` that points to the lexical environment that was active at the moment of creation. That environment record lives on the heap, not the stack. When the outer function is called, the engine creates a new lexical environment for that invocation, with bindings for its parameters and local variables. The inner function's `[[Environment]]` points to that environment. When the outer function returns, its stack frame is popped — but the heap-allocated environment record persists because the closure's `[[Environment]]` slot keeps a reference to it.

What makes this precise is knowing the difference between the call stack and the heap. The call stack is for execution flow — contexts get pushed and popped. The heap is for data that needs to outlive a single function call. A closure's retained environment is heap data. It has nothing to do with the call stack after the outer function returns.

The other thing worth knowing is that the environment is shared, not copied. Two closures created in the same outer call share one environment record. If one mutates a variable, the other sees it. That's not a bug — it's the actual mechanism. And it's what makes the module pattern work, where public methods share private state through the same retained environment.

### Part 3 — Whiteboard / Live Coding

```typescript
// Demonstrate retained environment with shared state
function makePair(): {
  setValue: (v: string) => void;
  getValue: () => string;
  resetValue: () => void;
} {
  let value = "default";

  return {
    setValue: (v: string) => { value = v; },
    getValue: () => value,
    resetValue: () => { value = "default"; },
  };
}

const pair = makePair();
console.log(pair.getValue()); // "default"
pair.setValue("modified");
console.log(pair.getValue()); // "modified"
pair.resetValue();
console.log(pair.getValue()); // "default"
// All three functions share the same value binding

// Demonstrate that the environment survives the outer function
// even when no closure is immediately created
function lazyClosure(): () => number {
  let value = 42;
  // The function below captures `value` even though we haven't
  // returned yet — `[[Environment]]` is set at creation time
  return () => value;
}

const fn = lazyClosure();
console.log(fn()); // 42 — the environment still exists

// Show the environment chain: multiple levels of nesting
function outer(): () => () => string {
  const a = "outer";
  return function middle(): () => string {
    const b = "middle";
    return function inner(): string {
      return `${a} > ${b}`;
    };
  };
}

const middleFn = outer();
const innerFn = middleFn();
console.log(innerFn()); // "outer > middle"
// innerFn's [[Environment]] → middle's environment → outer's environment
// Each level remains reachable through the chain
```

### Part 4 — Follow-Up Questions

**Q: Does every function call create a new lexical environment?**

Yes. Each invocation creates a new lexical environment for that call. If you call `makePair()` twice, you get two independent environments, each with its own `value` binding. The closures returned from the first call share the first environment; closures from the second call share the second. This is how multiple instances get independent private state.

**Q: How does `[[Environment]]` differ from the scope chain?**

They are the same mechanism. `[[Environment]]` is the function's own reference to its outer lexical environment, set at definition time. The scope chain is the linked traversal from the current environment through successive outer environment references. `[[Environment]]` is the starting point for that chain when the function is called — the engine creates a new lexical environment for the call and sets its outer reference to the function's `[[Environment]]`.

**Q: Can the retained environment be garbage collected while the closure is still reachable?**

No — not as a general rule. The entire chain of environment records referenced by the closure's `[[Environment]]` slot remains reachable as long as the closure itself is reachable. There is no partial collection in the spec; even bindings the closure never uses are kept alive. However, modern engines (V8, SpiderMonkey) may optimize via escape analysis — breaking the environment into smaller allocation units so that unused variables can be collected. This is an optimization, not a guarantee, and the conservative assumption is that everything in the retained scope stays alive. This is the source of the memory-leak pattern discussed in the next section.

### Part 5 — Common Mistakes

**Junior/mid answer:** "The closure stores the variables it needs in a special hidden object."

**Senior answer:** There's no hidden object. The closure's variables are in the same environment record they always were. That record is heap-allocated instead of stack-allocated because the engine detected at function-creation time that the inner function references it. Modern engines like V8 optimize this with scope analysis — if the engine can prove the closure only uses two specific variables out of ten, it may allocate a smaller environment with just those two. But that's an optimization, not a different model. The mental model should be: the environment record persists, and the closure holds a reference to it.

**Another junior tell:** "The closure makes a copy of the outer function's variables."

**Senior correction:** No copy. The closure shares the same bindings as any code running in that scope. Mutations are visible to all closures sharing that environment. Copying would be prohibitively expensive for large objects and would break the shared-state patterns that closures are designed to enable.

### Part 6 — Production Examples

**Real incident — Class component methods in early React:** Before arrow function class properties were common, React class components bound methods in the constructor. Each binding (`this.handleClick = this.handleClick.bind(this)`) created a new function whose `[[Environment]]` captured `this` through `.bind()`. Teams that forgot to bind methods in the constructor got the default-binding-`undefined` error at runtime. The fix was either a lint rule enforcing binding in the constructor or migrating to the class-properties syntax where the arrow captures `this` lexically.

---

## 3. Garbage Collection Implications

### Part 1 — Theory

JavaScript engines use mark-and-sweep garbage collection: starting from known roots (global object, active call stack frames, etc.), the engine traces reachable objects through references, and anything not reached is collected.

A closure's retained lexical environment is reachable because the closure itself is reachable. As long as some code holds a reference to the closure — a variable, an event listener, a stored callback — the entire environment record chain from the closure's `[[Environment]]` outward is part of the reachability graph.

The subtle trap: the engine retains the *entire* environment record, not just the variables the closure actually uses. If an outer function creates ten large arrays and returns a closure that only uses one of them, all ten remain in memory as long as the closure is live, because they're all part of the same environment record. Modern engines (V8, SpiderMonkey) can optimize this with escape analysis — they sometimes break the environment into smaller allocation units — but the optimization is not guaranteed, and the conservative assumption is that everything in the retained scope stays alive.

This matters most with event listeners and callbacks. A DOM event listener attached with `addEventListener` holds the callback closure reachable as long as the element is in the DOM. If that closure retains an environment containing a large component instance or a heavy cache, the memory is never freed until the listener is removed or the element is removed from the DOM.

### Part 2 — Interview Answer

Closures keep things alive. That's what makes them useful and also what makes them dangerous. The retained lexical environment is part of the GC reachability graph — as long as the closure is reachable, every variable in that environment is reachable too, even variables the closure never touches.

The practical consequence is that a single closure attached to a DOM element can keep a whole scope alive. An event listener that captures a large component instance through its closure chain will prevent that instance from being collected, even if the component is otherwise unreachable. This is a common pattern in single-page apps where components mount and unmount — if you forget to remove an event listener on unmount, the listener closure keeps its entire retained scope alive.

Engine optimizations can help. V8 will sometimes allocate separate "context" objects for groups of variables based on which closures actually use them, instead of keeping one monolithic environment. But you should never rely on that. The conservative rule is: anything in the retained scope chain stays alive.

The fix is usually explicit cleanup — remove event listeners, clear references, or structure your scopes so that large objects are in an inner scope that specific short-lived closures capture, rather than in a scope captured by a long-lived one. WeakRef and FinalizationRegistry exist for advanced cases, but in practice the answer is proper lifecycle management.

### Part 3 — Whiteboard / Live Coding

```typescript
// The broad-scope retention trap
function setupHandler(): () => void {
  const largeData = new Array(1000000).fill("x"); // large allocation
  const important = "I need this";

  return () => {
    console.log(important); // only uses `important`
  };
  // `largeData` is retained because it's in the same environment
  // as `important` — both are in the same environment record
}

const handler = setupHandler();
// handler holds `largeData` alive even though it never uses it

// The fix: scope large data outside the closure's reach
function setupHandlerFixed(): () => void {
  const largeData = new Array(1000000).fill("x");
  // Do whatever with largeData synchronously

  const important = "I need this";
  return () => {
    console.log(important);
  };
  // V8 can sometimes optimize this, but the safer pattern is
  // to structure code so large data is freed before the closure
  // is created
}
const handlerFixed = setupHandlerFixed();
// handlerFixed still retains important but may not retain largeData
// depending on engine optimization — not guaranteed

// Testing reachability — demonstrating that reassigning a captured
// binding releases the original reference through that path
function demonstrateRetention(): void {
  let captured: { data: string } | null = { data: "I'm here" };
  const closure = () => {
    console.log(captured?.data);
  };

  closure(); // "I'm here"

  // Reassigning the binding does NOT keep the original object reachable
  // through this closure. The closure retains the binding itself, not a
  // snapshot of what it once held — once `captured` points to null,
  // there's no path back to the original object through this closure.
  captured = null;
  closure(); // undefined

  // This is a genuinely useful pattern: if you're done with a large
  // captured object before the closure's own lifetime ends, reassigning
  // the binding releases your reference to it early — without needing
  // the closure itself to become unreachable.
}
demonstrateRetention();
```

### Part 4 — Follow-Up Questions

**Q: How does `WeakMap` relate to closure memory management?**

`WeakMap` holds keys weakly — the key does not count as a GC root. This is useful when a closure needs to associate metadata with an object without preventing the object from being collected. If you used a `Map` instead, the closure's retention of the map would keep the object alive indirectly. `WeakMap` avoids that.

**Q: Can you manually free a closure's retained environment?**

Only by making the closure itself unreachable. Set the variable holding the closure to `null`, remove the event listener that references it, or let the containing scope finish. There is no API to selectively purge bindings from a retained environment. However, reassigning a captured variable (as demonstrated in Section 3 Part 3) releases *that specific reference* without requiring the closure itself to become unreachable — not a formal API, but a real, available technique, and the direct reason closures retaining live bindings (not snapshots) matters here.

**Q: How does Chrome DevTools help diagnose closure-related memory leaks?**

The Memory panel's heap snapshot shows closures under "closure" or by function name in the retainers tree. You can inspect what variables are retained and trace the reference path from a GC root to the closure. Detached DOM trees often appear alongside closure references — a common pattern is an element removed from the DOM but held alive by an attached event listener's closure scope.

### Part 5 — Common Mistakes

**Junior/mid answer:** "JavaScript has automatic garbage collection, so closures don't cause memory leaks."

**Senior answer:** Automatic GC doesn't prevent closures from causing leaks. GC collects what's unreachable. A closure's retained environment is reachable by design — that's the whole point of closures. The leak happens when a closure outlives its usefulness but nothing clears the reference to it. An event listener on a long-lived element that references a long-gone component is the classic case. The GC does exactly what it should — it keeps the reachable data alive. The problem is the data shouldn't be reachable anymore.

**Another junior tell:** "Memory leaks in JavaScript aren't a real problem for frontend apps."

**Senior correction:** They are, especially in single-page apps where users navigate between views without a full page reload. Every unmounted component whose closures are still referenced by event listeners, timers, or promises accumulates in memory. Over a long session, this causes jank, increased GC pause times, and eventually tab crashes.

### Part 6 — Production Examples

**Real incident — Unremoved `resize` listener in a dashboard:** A dashboard application created a chart component that attached a `resize` listener to `window` inside its lifecycle hook. The listener closure referenced the chart's configuration object. When the dashboard navigated to a different view, the chart component was unmounted but the listener was never removed. Every navigation added more listeners, each retaining the configuration of a destroyed chart. Users who navigated between five or six dashboard views over a work session experienced increasing memory usage and eventual tab crashes. The fix was removing the listener in the component's cleanup hook.

**Real incident — Promise chain retaining component scope:** A Vue component made a fetch call and processed the result in a `.then()` callback. The component referenced `this.someLargeDataset` inside the callback. The component was destroyed before the fetch completed, but the promise callback's closure kept the component's retained environment alive, including the large dataset. The fix was checking a disposed flag or using AbortController to cancel the fetch.

---

## 4. Private State via Closures

### Part 1 — Theory

Before private class fields (`#field`) existed in JavaScript, closures were the only way to achieve genuine encapsulation. A closure-returned object can expose methods that read and write a variable from the outer scope, with no way for external code to access that variable except through those methods.

This is not convention-based privacy (like an underscore prefix `_private`). It is enforced by the language: the variable is in the closure's lexical environment, and no code outside that environment can reference it. There is no reflection API, no property access, no `Object.keys()` traversal that can reach it.

The pattern is straightforward:
1. Write a function that declares local variables.
2. Return an object with methods that reference those variables.
3. Each call to the factory function creates an independent instance with its own private state.

Modern JavaScript offers private class fields (`#count`) as an alternative. These provide the same encapsulation guarantee through a different mechanism — the private field is a language-level restriction enforced at runtime by the engine, not a closure-based scope restriction. The choice between the two depends on context: closure-based encapsulation works in any function (not just classes) and is more flexible for simple cases, while private fields integrate naturally with the class syntax and prototype-based method sharing.

### Part 2 — Interview Answer

Closures give you genuine private state. Not a convention, not a naming scheme — an actual language-enforced guarantee. The variable exists in the closure's lexical environment and there is no way to access it from outside. No reflection, no property enumeration, no tricks.

The classic example is a counter factory. The outer function declares a count variable and returns an object with methods that read and write it. The count is captured by the closure. External code can call increment and read, but it cannot touch the count variable directly. Each call to the factory creates a new environment with its own count.

What's interesting now is that private class fields give you a similar guarantee with a different mechanism. A `#count` private field is enforced by the engine at the language level, not by closure scope. The question a senior engineer should ask is: when do I reach for one over the other?

Closure-based private state is simpler for a one-off case where you don't need a full class. It works anywhere a function works, and it doesn't require understanding the `#` syntax's prototype implications. Private fields are better when you have multiple methods sharing state on a class, because the field syntax is declarative and the methods are on the prototype rather than created per-instance. For a counter, a closure factory and a class with `#count` are functionally equivalent — the choice is about code style and whether you already have a class.

The reason this is a senior-level topic is not just the mechanism; it's the tradeoff. Closure-based encapsulation creates a new function object for every method on every instance. Private fields on a class do not — methods live on the prototype. For a handful of instances the difference is noise, but at scale it matters.

### Part 3 — Whiteboard / Live Coding

```typescript
// Closure-based private state — the classic pattern
function createBankAccount(initialBalance: number) {
  let balance = initialBalance;

  return {
    deposit(amount: number): number {
      if (amount <= 0) throw new Error("Amount must be positive");
      balance += amount;
      return balance;
    },
    withdraw(amount: number): number {
      if (amount <= 0) throw new Error("Amount must be positive");
      if (amount > balance) throw new Error("Insufficient funds");
      balance -= amount;
      return balance;
    },
    getBalance(): number {
      return balance;
    },
  };
}

const account = createBankAccount(100);
account.deposit(50);
console.log(account.getBalance()); // 150
// There is no way to access `balance` from outside:
// account.balance is undefined
// Object.keys(account) shows only "deposit", "withdraw", "getBalance"

// Modern alternative with private class fields
class BankAccount {
  #balance: number;

  constructor(initialBalance: number) {
    this.#balance = initialBalance;
  }

  deposit(amount: number): number {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.#balance += amount;
    return this.#balance;
  }

  withdraw(amount: number): number {
    if (amount <= 0) throw new Error("Amount must be positive");
    if (amount > this.#balance) throw new Error("Insufficient funds");
    this.#balance -= amount;
    return this.#balance;
  }

  getBalance(): number {
    return this.#balance;
  }
}

const account2 = new BankAccount(100);
account2.deposit(50);
console.log(account2.getBalance()); // 150
// #balance is private — no external access
```

### Part 4 — Follow-Up Questions

**Q: Can closure-based private state be inherited?**

No. Private state via closures is per-instance and not accessible to subclasses — the subclass has no way to reference the parent closure's variable. If you need inheritance, private class fields also don't solve this — `#` fields are scoped to the class that defines them and are not accessible to subclasses. For shared private state in an inheritance chain, you would use a `WeakMap` pattern or carefully designed protected properties.

**Q: Do closure-based methods and class methods have different memory characteristics?**

Yes. Closure-based methods are created per-instance — every call to `createBankAccount` creates new `deposit`, `withdraw`, and `getBalance` function objects. Class methods live on the prototype — `BankAccount.prototype.deposit` is one function shared by all instances. For a small number of instances the difference is negligible, but for thousands of short-lived instances the allocation cost of closure-based methods can be measurable.

**Q: Can you have read-only private state with closures?**

Yes. Declare the variable with `const` inside the outer function and don't expose a setter. The closure can read it but cannot reassign the binding. If the value is an object, the object's properties can still be mutated — `const` prevents reassignment, not mutation.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Using a closure for private state is the same as using an underscore prefix like `_private`."

**Senior answer:** They have opposite guarantees. An underscore prefix is a convention enforced by nothing — the property is fully accessible, enumerable, and writable. A closure's local variable is genuinely inaccessible from outside the closure. The underscore pattern only signals intent; the closure pattern enforces it. This distinction matters when you're building a library or API that other teams consume — convention-based privacy leaks, closure-based privacy does not.

**Another junior tell:** "Private class fields and closure-based private state are identical."

**Senior correction:** They achieve the same goal (encapsulation) through different mechanisms with different tradeoffs. Private fields are a language feature enforced by the engine, with the benefit of prototype-based method sharing. Closure-based state is a scoping pattern with per-instance methods. The choice depends on whether you're already using a class and how many instances you'll create.

### Part 6 — Production Examples

**Real incident — Private state in a Vue composable before `#` was available:** A Vue 3 composable used closure-based state to hold internal reactive refs that should not be exposed to the component using the composable. The composable returned only a subset of functions, while internal refs (like loading state for nested operations) stayed private in the closure. This was a deliberate API design choice — consumers couldn't accidentally depend on internals that might change.

**Real incident — Migration from closure-based to class-based private state:** A team maintained a data-access layer built with factory functions and closure-based private state. Each "model" was a factory returning an object with methods. Over time, the models grew to have ten-plus methods each, and the per-instance function allocation became noticeable in profiling during heavy data loading. The team migrated selected hot-path models to classes with `#` private fields, keeping factory functions for simpler cases.

---

## 5. The Module Pattern

### Part 1 — Theory

The module pattern is the closure-based private-state technique applied at the scope of an entire file. Before ES modules existed, JavaScript had no built-in module system. The pattern used an IIFE (Immediately Invoked Function Expression) to create a private scope and returned a public API object:

```typescript
const MyModule = (function() {
  // Private scope — not accessible outside
  let privateState = 0;
  function privateHelper() {
    return privateState;
  }

  // Public API
  return {
    increment() {
      privateState++;
      return privateState;
    },
    read() {
      return privateHelper();
    },
  };
})();
```

The IIFE creates a lexical environment; the returned object's methods close over that environment. External code can only interact through the exposed methods. This is exactly the same mechanism as the closure-based counter, just structured as a module.

Variations of the pattern include:
- **Revealing module pattern** — define all functions and variables privately, then return an object that maps public names to the private functions.
- **Augmentable module** — pass the module object into the IIFE and add properties to it across multiple files.
- **Lazy initialization** — the module does expensive setup only on first use, with the result cached in the private scope.

ES modules (`import`/`export`) now provide the same encapsulation with less ceremony and better tooling support. A file's top-level scope is module-scoped — nothing is global unless explicitly exported. This makes the IIFE module pattern mostly legacy in new code. But it persists in older codebases, in UMD bundles (Universal Module Definition, which wraps modules in IIFEs for compatibility), and in build-tool output.

### Part 2 — Interview Answer

The module pattern is what you get when you apply closure-based encapsulation to an entire file. Before ES modules existed, every JavaScript file shared the global scope — there was no way to keep things private without wrapping them in a function. The IIFE pattern created a private scope, and the public API was whatever the IIFE returned.

The revealing module pattern was a common variation: you'd define all your functions and variables, then at the end return an object that mapped the public names to them. This made it clear what was an internal helper versus what was public API. You'd see it in older libraries like jQuery plugins and in the early days of Backbone.js.

Today ES modules make the standalone IIFE unnecessary for new code. You just use export and import — top-level declarations are module-scoped by default, and only what you export is accessible to other files. But the pattern still shows up in three places: older codebases that predate ES modules, UMD bundles that need to work in both CommonJS and browser environments, and build tool output that wraps code in an IIFE for scope isolation.

The senior understanding isn't just knowing the pattern — it's knowing why it existed and when you'd still encounter it. If an interviewer asks about the module pattern, they're checking whether you understand scope as an encapsulation mechanism, not whether you can write an IIFE from memory. The connection to closures is the entire point.

### Part 3 — Whiteboard / Live Coding

```typescript
// Classic IIFE module pattern
const CounterModule = (function() {
  let instanceCount = 0;

  function validate(n: number): boolean {
    return n >= 0;
  }

  return {
    create(initial = 0): { increment: () => number; get: () => number } {
      if (!validate(initial)) throw new Error("Invalid initial value");
      let count = initial;
      instanceCount++;
      return {
        increment: () => ++count,
        get: () => count,
      };
    },
    getInstanceCount(): number {
      return instanceCount;
    },
  };
})();

const c1 = CounterModule.create(10);
const c2 = CounterModule.create(20);
console.log(c1.increment()); // 11
console.log(c2.increment()); // 21
console.log(CounterModule.getInstanceCount()); // 2
// `validate` and `instanceCount` are private — no external access

// Revealing module pattern — all functions in one place, public API at end
const Calculator = (function() {
  function add(a: number, b: number): number {
    return a + b;
  }

  function subtract(a: number, b: number): number {
    return a - b;
  }

  function multiply(a: number, b: number): number {
    return a * b;
  }

  // Reveal specific functions as public API
  return {
    add,
    subtract,
    multiply,
  };
})();

console.log(Calculator.add(3, 4)); // 7

// ES module equivalent (for illustration — this is the modern approach)
// Save this comment: the code above is the historical pattern; the code
// below is what replaced it.
//
// // counter.ts
// let instanceCount = 0;
// export function create(initial = 0) { ... }
// export function getInstanceCount() { return instanceCount; }
//
// // consumer.ts
// import { create } from './counter.js';
```

### Part 4 — Follow-Up Questions

**Q: Does the IIFE module pattern still have any advantage over ES modules?**

For application code, no — ES modules are strictly better in every way: static analysis, tree shaking, dead-code elimination, cyclic dependency handling, and browser-native loading. For library code distributed as a single file (like a CDN bundle), an IIFE wrapper still provides scope isolation that ES module syntax alone doesn't in a non-module script tag. UMD bundles use IIFEs to work across module systems.

**Q: What is the "revelation" in the revealing module pattern?**

The pattern "reveals" which functions are public by listing them in the return statement. The benefit is that all functions are defined with the same syntax (as private functions), and the return object acts as explicit documentation of the public API. The downside is that if a public function references another public function by the internal name, and you rename the internal name, the return object mapping can get out of sync.

**Q: How does the module pattern relate to tree-shaking?**

ES modules support tree-shaking because `import` and `export` are static — the bundler can determine at build time which exports are unused and eliminate them. IIFE module patterns cannot be tree-shaken effectively because the entire IIFE is executed at once and the bundler cannot statically analyze which returned properties are used by consumers.

### Part 5 — Common Mistakes

**Junior/mid answer:** "The module pattern is a way to organize code. You use an IIFE to wrap your code and call it a module."

**Senior answer:** Organization is the effect, not the mechanism. The module pattern uses closure scope to create encapsulation. The IIFE creates a lexical environment that lives as long as any of the returned methods exist. The "module" is the closure. Understanding it as a closure — not as a code-organization trick — connects it to everything else about scope, GC, and private state. An engineer who sees it only as an IIFE won't recognize it when it appears in a different form, like a build tool's output wrapper or a UMD shim.

**Another junior tell:** "Every IIFE is a module pattern."

**Senior correction:** An IIFE that doesn't return anything or doesn't create encapsulated state is just a scope isolation wrapper, not a module pattern. The module pattern specifically uses the IIFE to create private state and expose a controlled API. A plain IIFE that just runs code and returns nothing is commonly used for scope isolation but isn't the module pattern.

### Part 6 — Production Examples

**Real incident — Legacy IIFE module in a modern pipeline:** A team migrated an older JavaScript application to TypeScript and ES modules. One third-party analytics library was distributed as an IIFE that attached itself to `window`. The IIFE had internal state (a queue of unsent events) and exposed a public API (`track`, `identify`). The team had to keep the IIFE import as a side-effect module because the library author never shipped an ES module version. The internal closure state was opaque and untyped — they wrote a type declaration file for the public API but had no visibility into the internal queue management.

**Real incident — Build output wrapping:** A team using an older version of webpack configured to output UMD found that the generated bundle wrapped their entire application in an IIFE. A third-party integration attempted to access an internal function that the team had exported in the source code, but the function wasn't on the global scope — it was trapped inside the IIFE closure. The fix was configuring the library target properly in webpack to expose the intended API.

---

## 6. Putting It All Together — The Full Walkthrough

The five topics in this chain form one logical sequence:

A **closure** is a function that retains a reference to the scope it was created in. The **lexical environment** mechanism is how the engine implements this: the closure's internal `[[Environment]]` slot points to a heap-allocated environment record that persists when the outer function's call-stack frame is popped. That persistence has a **garbage collection** consequence — everything in the retained environment stays reachable as long as the closure is reachable, which is both what makes closures useful and a source of unintentional memory retention if the closure outlives its purpose.

The same mechanism enables **private state**: variables in the retained lexical environment are accessible only through the closure that captured them, with no external access path. When you structure that private state as a module — a self-contained scope with a controlled public API — you get the **module pattern**, which was the standard encapsulation technique before ES modules existed and still appears in legacy code, UMD bundles, and build-tool output.

The sequence from mechanism to architectural pattern:
- Closure → a function with a retained environment reference
- Lexical environment → how the engine makes that retention work
- GC implications → what staying reachable actually costs
- Private state → what you can build with that persistence
- Module pattern → the same idea at file scope

Session 3 takes the next step: currying (closures that return functions expecting more arguments), memoization (closures that cache results), and how both patterns manifest in React hooks and Vue composables. The closure you built here is the same closure that powers `useState`'s state capture, `computed`'s dependency tracking, and every debounced callback that needs to reference the latest value without re-creating itself.
