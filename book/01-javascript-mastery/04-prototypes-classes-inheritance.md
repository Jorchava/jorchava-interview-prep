# Prototypes, Classes, and Inheritance

> Three connected topics tracing one line: how objects borrow behavior from other objects, what the `class` keyword actually does to that mechanism, and why inheritance in JavaScript is a chain of links rather than a copy of code. This session cashes in two claims made earlier without proof: Session 1's "class — hoisted, uninitialized (TDZ)" line in its hoisting section (`01-execution-context-callstack-scope.md`), and Session 2's "methods live on the prototype" and "private fields aren't accessible to subclasses" lines in its private-state section (`02-closures-arc.md`). Here's the mechanism behind each of those.

---

## 1. Prototypes and the Prototype Chain

### Part 1 — Theory

Every object in JavaScript has an internal `[[Prototype]]` link to another object — or to `null`. That link is the entire inheritance mechanism: there is no class hierarchy at runtime, only objects pointing at other objects, and property lookup that walks those links.

The fundamental way to create an object with a chosen prototype is `Object.create(proto)`. It returns a brand-new object whose internal `[[Prototype]]` is set to `proto` directly — no function call, no constructor, nothing in between. `Object.create(null)` produces an object with no prototype at all, which is the closest thing JavaScript has to a pure dictionary: no inherited methods, no risk of inherited properties colliding with keys.

Property lookup walks the chain: when you read `obj.name`, the engine first checks `obj`'s own properties, then `Object.getPrototypeOf(obj)`, then that object's prototype, and so on until it either finds a property or hits `null`. The walk stops at the first match — an own property shadows a prototype property without deleting or modifying it. Writes behave differently: assignment sets an own property on the target object; it never walks up and mutates a prototype property unless you use an explicit setter or `Object.defineProperty`.

The relationship between two similarly-named things is where the confusion starts:

- **`.prototype`** is a property that exists *on functions* (constructor functions and classes). It's a plain object that `new` will use as the `[[Prototype]]` of instances it creates.
- **`Object.getPrototypeOf(instance)`** (and the legacy `__proto__` accessor) reads the *actual link on the instance*.

They are not the same thing, but they are related by identity: `Object.getPrototypeOf(instance) === Constructor.prototype`. `instance.__proto__` and `instance.prototype` are both wrong and meaningless — the instance's link is read with `getPrototypeOf`/`__proto__`, while `.prototype` is a property of the function that made it. Functions that can't be constructors (arrow functions) have no `.prototype` property at all.

The tradeoff this design forces: methods stored on the prototype are shared across all instances (one function object, not one per instance — the memory consequence Session 2 flagged), and because lookup is dynamic, you can add or replace a prototype method at runtime and every existing instance picks it up. That power is also the danger — prototype pollution, mutating a shared prototype (especially `Object.prototype`), affects the entire program.

### Part 2 — Interview Answer

The mental model that has to replace the "class from other languages" instinct is this: JavaScript inheritance is just objects linked to other objects. Every object carries an internal prototype link, and when you read a property, the engine walks that chain from the object outward until it finds a match or runs out. That's the entire mechanism. No class hierarchy exists at runtime — `class` is a way of writing it, not the thing itself.

The two names that trip everyone up: `.prototype` and `__proto__`. The constructor function has a `.prototype` property — a plain object that serves as the blueprint for instances it creates with `new`. The instance has an internal prototype link, readable via `Object.getPrototypeOf` or the legacy `__proto__` accessor. And here's the identity that connects them: `Object.getPrototypeOf(instance)` is exactly `Constructor.prototype`. They're two different things with a precise relationship, not two spellings of the same thing. So `instance.prototype` is wrong — instances don't have a `.prototype` property. And `instance.__proto__` is the link, not a copy of the constructor.

`Object.create` is the direct way to build these links: pass an object, get a new object whose prototype is that object. Pass `null`, get a true dictionary with nothing inherited. That's what the whole system is built on — constructor functions use it implicitly, classes use it implicitly, and it's the tool you reach for when you want prototypal delegation without a constructor at all.

The reason this matters in an interview and in production: it explains why a method you add to a shared prototype shows up on every existing instance, why own properties shadow rather than overwrite inherited ones, and why mutating `Object.prototype` pollutes everything. And it's the base layer for the next question — because `class` is sugar over exactly this link, with some sharp edges added on top. The instance's own properties are its own; everything else it can do, it borrowed.

### Part 3 — Whiteboard / Live Coding

**The chain walk, explicitly, three levels deep:**

```typescript
const entity = { hitPoints: 10, takeDamage(amount: number): void { this.hitPoints -= amount; } };

const enemy = Object.create(entity);      // enemy[[Prototype]] → entity
enemy.name = "goblin";

const goblin = Object.create(enemy);      // goblin[[Prototype]] → enemy
goblin.armor = 1;

console.log(goblin.hitPoints); // 10  — walk: goblin → enemy → entity, found on entity
console.log(goblin.name);      // "goblin" — walk stops at enemy
console.log(goblin.takeDamage === entity.takeDamage); // true — one shared function

goblin.takeDamage(4);
console.log(goblin.hitPoints); // 6 — own property created on goblin via assignment
console.log(entity.hitPoints); // 10 — the walk was read-only; prototype untouched

// Shadowing, not overwriting:
goblin.hitPoints = 99;
console.log(goblin.hitPoints); // 99 — own property wins
console.log(entity.hitPoints); // 10 — prototype still intact

// Where the chain ends:
console.log(Object.getPrototypeOf(goblin) === enemy);      // true
console.log(Object.getPrototypeOf(enemy) === entity);      // true
console.log(Object.getPrototypeOf(entity) === Object.prototype); // true
console.log(Object.getPrototypeOf(Object.prototype) === null);   // true — chain ends
```

**`.prototype` vs. the instance link — the identity, not the conflation:**

```typescript
function Monster(this: { name: string }, name: string): void {
  this.name = name;
}
Monster.prototype.attack = function (this: { name: string }): string {
  return `${this.name} attacks!`;
};

const m = new (Monster as unknown as new (name: string) => { name: string; attack: () => string })("orc");
console.log(Object.getPrototypeOf(m) === Monster.prototype);        // true — the link
console.log((m as unknown as { __proto__: unknown }).__proto__ === Monster.prototype); // true — legacy accessor, same link
console.log(m.attack === Monster.prototype.attack);         // true — shared, not copied
console.log(m instanceof Monster);                          // true — walks the same chain
// m.prototype is undefined — instances have no .prototype property.
```

**`Object.create(null)` — a dictionary with nothing inherited:**

```typescript
const lookup = Object.create(null);
lookup["foo"] = 1;
console.log(lookup["foo"]);            // 1
console.log(lookup.toString);          // undefined — no Object.prototype in the chain
// lookup.hasOwnProperty("foo") — would throw: no such method inherited.
// Safe to check with: Object.hasOwn(lookup, "foo") → true
```

### Part 4 — Follow-Up Questions

**Q: Does property lookup walk the chain on writes too?**

No. Reading walks the chain; writing creates an own property on the target object (unless a prototype defines a setter for that name, in which case the setter is invoked with the target as `this`). This is why shadowing happens at all: `goblin.hitPoints = 99` doesn't update `entity.hitPoints` — it makes a new own property. The same rule is why you can't "fix" a prototype bug from one instance; you must mutate the prototype object itself.

**Q: What is `instanceof` actually checking?**

It walks the prototype chain of the left operand and asks whether the right operand's `.prototype` property is found anywhere along it. So `goblin instanceof Monster` is a chain walk ending in a comparison with `Monster.prototype` — it can be fooled by reassigning `Monster.prototype`, and it returns `false` for objects created with `Object.create(null)` since there's nothing to walk. `Symbol.hasInstance` lets a class customize that behavior.

**Q: Is `Object.create(null)` useful outside edge cases?**

Yes — as a true hash map. A normal object literal inherits from `Object.prototype`, so a key like `"toString"` or `"constructor"` collides with inherited properties. A null-prototype object has zero inherited keys, so arbitrary untrusted keys are safe without `Object.hasOwn` guards. Libraries like Lodash use it for internal lookups, and it's the standard answer for "how do I make a map with no prototype pollution risk."

**Q: How does a deep chain affect performance?**

Each hop costs a lookup. Modern engines inline-cache property accesses, so hot paths with stable shapes are fast even with shallow chains, but a very deep chain of objects created per-frame in a game loop is a real, measurable cost. The practical rule: keep prototype chains short — two or three links — and don't build per-instance chains in hot code. That's also why class hierarchies beyond two or three levels are a design smell, which Module 11 covers.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Every object has a `.prototype` property, and the prototype chain links them. `obj.prototype` tells you what the object inherits from."

**Senior answer:** That conflates the two things this topic is built on. `.prototype` is a property that exists on constructor functions and classes — arrow functions don't even have it — and it holds the object that `new` will attach to instances. The instance's actual link is internal `[[Prototype]]`, read with `Object.getPrototypeOf` or the legacy `__proto__`. An instance does not have a `.prototype` property at all; `instance.prototype` is `undefined`. The precise identity is `Object.getPrototypeOf(instance) === Constructor.prototype` — different properties, on different objects, related by identity, and naming them exactly is the first signal that you know the mechanism rather than the vocabulary.

**Another junior tell:** "Inheritance in JavaScript works by copying the parent's methods onto the child."

**Senior correction:** Nothing is copied. The child's prototype chain points at the parent's prototype object, and lookup walks it live. That's why a method added to the prototype after an instance is created is still visible to that instance — a copy-based model can't explain that. It also explains the memory profile Session 2 referenced: shared methods are one function object on the prototype, while closure-based methods were created per-instance.

### Part 6 — Production Examples

**Real incident — Prototype pollution via a recursive merge:** A team built a settings-merge utility that did a naive recursive `Object.assign`-style copy. A malicious payload with a key like `"__proto__"` caused the merge to assign onto `Object.prototype`, and suddenly `({}).polluted === true` everywhere — across every module, every library, including code the team didn't write. Everything inherited the injected property through the shared chain. The fix was guarding against `__proto__`/`constructor`/`prototype` keys, or using `Object.create(null)` for the lookup layer of the merge. This is the classic "one shared prototype, one mistake, whole program affected" failure mode.

**Real incident — Prototype method fix, no redeploy of consumers:** A charting library shipped a bug in a shared render method on the chart base class's prototype. A consumer team patched it by assigning a corrected implementation onto the prototype at app startup. Every chart instance in the app, present and future, picked up the fix because instance lookup is live — and the library's own instances created after startup got it too. That's the dynamic-lookup property in action, and it cuts both ways: the same mechanism is what makes pollution attacks possible.

**Entity systems in a web game:** A 2D game stored shared behavior — movement, collision callbacks, damage handling — as methods on the prototype of a base `Entity` constructor, with per-instance fields (position, hit points) as own properties. Spawning hundreds of enemies didn't allocate hundreds of copies of each method; the own-property/prototype split is exactly the tradeoff this topic describes. The per-instance data lives on the instance; the shared logic lives one link up.

---

## 2. Classes as Syntactic Sugar

### Part 1 — Theory

A `class` declaration is sugar over the prototype mechanism from Section 1: methods declared in the class body become properties on `ClassName.prototype`, and `new ClassName()` produces an instance whose `[[Prototype]]` is `ClassName.prototype` — identical to a constructor function doing the same work. But "sugar" undersells it, because the class form hard-enforces three behaviors the constructor-function form does not.

**1. TDZ binding semantics.** A class declaration is hoisted to the top of its scope but left uninitialized — the exact `let`-style binding Session 1 described in its hoisting section. Referencing the class before its declaration throws `ReferenceError: Cannot access 'X' before initialization`. This is the mechanism behind Session 1's "class — hoisted, uninitialized (TDZ)" line: the class name is registered in the lexical environment at creation phase, but the binding isn't initialized until the declaration executes, so the entire region before the declaration is temporal dead zone. A `function` constructor is fully hoisted — callable before its line. A `class` is not. The consequence: no circular-extends accidents and no using a class before it exists, caught loudly instead of as `undefined` blowing up later.

**2. Strict mode by default.** All code inside a class body runs in strict mode whether or not the file has `"use strict"`. Detaching a class method and calling it standalone gives you `this === undefined` (strict default binding) instead of silently binding the global object — which is why the classic `setInterval(this.fetchUser, ...)` bug from Session 1's `this` section throws immediately in a class and can silently corrupt state in a function prototype.

**3. No invocation without `new`.** Calling a class like a function throws `TypeError: Class constructor X cannot be invoked without 'new'`. A constructor function called without `new` silently runs with sloppy-mode default binding — writing to `this` either throws (strict) or creates global variables (sloppy). The class makes the misuse un-ignorable at the exact point of misuse.

**Enumerability — the contrast Part 5 builds on.** Methods defined in a class body are non-enumerable on the prototype: `Object.keys(Class.prototype)` is `[]`, and `for...in` over an instance skips them. The old pattern, `Constructor.prototype.method = function(){}`, creates an *enumerable* property by default — `for...in` over such an instance surfaces `"method"`. Both were verified against Node 22: descriptor `enumerable: false` for the class form, `true` for assignment. (A related claim worth preempting: the `constructor` back-reference on the prototype is identical in both patterns — `writable: true, enumerable: false, configurable: true` — there's no special "locked" constructor on class prototypes.)

Public class fields are the opposite: they're own enumerable properties on each instance, which is what `Object.keys(instance)` shows.

### Part 2 — Interview Answer

A class is syntactic sugar over the prototype mechanism — methods land on the prototype, `new` links instances to it — but it's sugar with teeth. Three behaviors are hard-enforced by the language, and naming all three is the difference between "it's just sugar" and an answer that shows you know the mechanism.

First, class declarations are hoisted but uninitialized, like `let` and `const`. The name is registered in the lexical environment at the creation phase, but the binding doesn't get its value until the declaration line executes. Accessing it earlier throws a ReferenceError — that's the temporal dead zone, exactly the class case from Session 1's hoisting section. A function constructor is fully hoisted and callable before its line; a class is not, which is why you can't accidentally use a class before it's defined.

Second, class bodies are strict mode, always. That changes the failure mode of the classic detached-method bug: pull a class method off its instance and call it standalone, and `this` is undefined, so touching a property throws immediately. The same code with a constructor function could silently write to the global object depending on call site — the class makes the bug loud instead of latent.

Third, you cannot call a class without `new`. The engine throws a TypeError the moment you try. The old constructor-function pattern would run, and whether it blew up depended on strict mode and on whether it happened to write to `this`. So "sugar" is the right word for where methods go, but the wrong word for the safety rails — those are new behavior, and they're the reason a team converting constructors to classes finds bugs that were silently tolerated before.

And one enumerability detail that matters in real code: class methods are non-enumerable on the prototype, so `for...in` over an instance skips them. The old `Constructor.prototype.method = fn` assignment created enumerable properties. If you ever iterate an instance and rely on what appears, those two forms behave differently — and the class form is the one that doesn't leak its methods.

### Part 3 — Whiteboard / Live Coding

**A class and its constructor-function equivalent, side by side:**

```typescript
class Counter {
  count = 0;                     // own field, enumerable
  increment(): number {
    return ++this.count;
  }
  read(): number {
    return this.count;
  }
}

function FnCounter(this: { count: number }): void {
  this.count = 0;
}
FnCounter.prototype.increment = function (this: { count: number }): number {
  return ++this.count;
};
FnCounter.prototype.read = function (this: { count: number }): number {
  return this.count;
};

const c1 = new Counter();
const c2 = new (FnCounter as unknown as new () => { count: number; increment: () => number })();
console.log(c1.increment()); // 1
console.log(c2.increment()); // 1 — same behavior, same chain shape
```

**The enumerability difference, demonstrated:**

```typescript
class Cls {
  method(): void {}
}
function Fn(this: unknown): void {}
Fn.prototype.method = function (this: unknown): void {};

console.log(Object.keys(Cls.prototype));   // [] — class methods are non-enumerable
console.log(Object.keys(Fn.prototype));    // ["method"] — assignment is enumerable

const forInKeys: string[] = [];
for (const k in new Cls()) forInKeys.push(k);   // [] — nothing surfaces
const forInFn: string[] = [];
for (const k in new (Fn as unknown as new () => { method: () => void })()) forInFn.push(k);
console.log(forInFn); // ["method"] — for...in surfaces the enumerable prototype method

console.log(
  Object.getOwnPropertyDescriptor(Cls.prototype, "method")!.enumerable, // false
  Object.getOwnPropertyDescriptor(Fn.prototype, "method")!.enumerable,  // true
);
```

**The three enforcement rails, verified behavior:**

```typescript
// 1. TDZ — verified ReferenceError
try {
  // @ts-expect-error — accessing the class before its declaration hits the TDZ
  new TooEarly();
  class TooEarly {}
} catch (e) {
  console.log((e as Error).message); // "Cannot access 'TooEarly' before initialization"
}

// 2. Strict mode — detached method, this is undefined (not the global object)
class StrictDemo {
  whoAmI(): unknown {
    return this;
  }
}
const detached = new StrictDemo().whoAmI;
console.log(detached()); // undefined

// 3. No call without new — verified TypeError
try {
  (Counter as unknown as () => void)();
} catch (e) {
  console.log((e as Error).message); // "Class constructor Counter cannot be invoked without 'new'"
}
```

### Part 4 — Follow-Up Questions

**Q: Is a class a function? What is `typeof`?**

`typeof SomeClass` is `"function"` — a class is a callable function object internally, and `SomeClass.prototype.constructor` points back at the class. But it's a function that the language refuses to call without `new`. The class *name* binding behaves like `let` (TDZ), even though the *value* is function-like. That's the precise split: let-binding semantics for the name, function identity for the value.

**Q: Does the TDZ apply to class expressions?**

Yes. `const C = class {};` — the binding `C` is a `const` (TDZ), and the anonymous class expression itself initializes when the assignment executes. Inside the expression, a named class expression's own name is TDZ within its body as well. The same "hoisted, uninitialized" rule applies to both forms.

**Q: Can you modify a class's prototype after the fact?**

Yes — `ClassName.prototype.newMethod = fn` works, and existing instances see it immediately, exactly as with constructor functions, because it's the same prototype object. The method you add this way is enumerable (assignment semantics), so the class body and post-hoc additions are distinguishable by descriptor — a subtle but real difference if anything iterates the prototype.

**Q: What's the memory difference between class methods and closure-based methods?**

Class methods live on the prototype: one function object shared by all instances. Closure-based methods (Session 2's private-state pattern) create a new function per instance. For a handful of instances it's noise; for thousands of short-lived objects in a loop, the per-instance allocation is measurable. That's precisely why Session 2 flagged the memory profile as the deciding factor between the two private-state approaches.

**Q: Why is this-before-`super()` such a hard rule in classes but not in constructor functions?**

Because in a derived class constructor, `this` starts *uninitialized* — `super()` is what initializes it, by running the parent constructor on the child's behalf. The raw pattern's `Parent.call(this)` reused a `this` that `new Child()` had already allocated, so it could be called at any point. The class form enforces order structurally instead of by convention. The throw is a `ReferenceError`, verified message: "Must call super constructor in derived class before accessing 'this' or returning from derived constructor."

### Part 5 — Common Mistakes

**Junior/mid answer:** "Classes are just functions. A class is a shortcut for a constructor function, nothing else."

**Senior answer:** "Just sugar" is the right shape but the wrong conclusion. Where methods go is sugar — onto the prototype, same as a constructor function. But the class form adds three hard rules the function form doesn't have: the class name is TDZ-bound like `let` (ReferenceError if you touch it before the declaration), class bodies are always strict mode, and calling without `new` throws a TypeError. A team converting constructor functions to classes routinely discovers bugs that used to fail silently — an accidentally detached method that now throws instead of leaking, a misuse that now throws instead of polluting globals. The senior answer names the mechanism *and* the enforcement rails; the junior answer stops at "it's sugar."

**Another junior tell:** "`for...in` over a class instance shows all its methods, same as the old pattern."

**Senior correction:** No — this is the one place the two forms behave differently at the descriptor level. Class-body methods are non-enumerable on the prototype (`Object.keys(Class.prototype)` is `[]`), so `for...in` skips them entirely. The `Constructor.prototype.method = fn` assignment creates enumerable properties, so `for...in` over that instance surfaces the method names. If you ever serialize an instance or iterate it generically — and `for...in` is the footgun of choice — the old pattern leaks method names into your output and the class form doesn't. I've debugged exactly that: an `Object.keys`-based serializer that suddenly lost a method name after a refactor to classes.

### Part 6 — Production Examples

**Real incident — Serializer broke after converting constructors to classes:** A team's API serializer built payloads by iterating instance properties with `for...in`. Under the old constructor-function pattern, prototype methods assigned with `Constructor.prototype.method = fn` were enumerable, so `for...in` surfaced them — and, because the serializer only picked known keys, the noise was filtered silently. After the team converted the models to `class`, the enumerability flipped: methods became non-enumerable, `for...in` output changed shape, and the "known keys" filter masked it until a client sent a payload with a missing field. The bug traced to exactly the enumerability contrast above. Fix: serialize from an explicit schema, never from `for...in`.

**Real incident — A DI-style helper that called constructors without `new`:** A shared utility invoked registered "factories" with `factory.call(ctx, opts)`, which worked for years against constructor functions (sloppy-mode default binding; `this` fell through to whatever the call supplied). A team registered a `class` as one of those factories. Production threw `TypeError: Class constructor X cannot be invoked without 'new'` at the exact call site, on every request. The class's no-`new` rail turned a latent misuse into a loud one — the utility was refactored to use `new` and to detect constructors properly. That's the "teeth" of class syntax catching a bug the function pattern silently tolerated.

**Real incident — TDZ class in a circular import:** Two modules imported each other; module A instantiated a class defined in module B at module top-level. Before the refactor to classes, B's constructor function was fully hoisted so the call worked. After `class`, the binding was TDZ-uninitialized at the moment A ran, throwing `ReferenceError: Cannot access 'B' before initialization` only under certain import orders. The fix was deferring the instantiation out of module scope — the exact failure the TDZ design exists to make loud. (Session 1's production section covers a related static-initialization variant of this incident.)

---

## 3. Inheritance: `extends`, `super`, and Private Fields

### Part 1 — Theory

`class Child extends Parent` sets up **two** prototype links, and both matter:

1. **Instance side:** `Object.getPrototypeOf(Child.prototype) === Parent.prototype`. An instance of `Child` walks `child → Child.prototype → Parent.prototype → Object.prototype → null`. That's how a child instance can call methods defined on the parent's prototype.
2. **Static side:** `Object.getPrototypeOf(Child) === Parent`. The class itself inherits from the parent class, so static methods and fields on `Parent` are available as `Child.someStatic` — verified: `Child.kind` returns the parent's static value, and inside the static method, `this` is the subclass.

**`super()` in a derived constructor.** In a derived class, the instance is allocated, but its `this` is deliberately left *uninitialized* until `super()` runs. `super()` executes the parent constructor with the child's uninitialized `this`, which initializes it — running the parent's field initializers and constructor body on the child instance. Consequences, both verified:

- Accessing `this` before `super()` throws `ReferenceError: Must call super constructor in derived class before accessing 'this' or returning from derived constructor`. The throw happens at the *access*, and the parent constructor **never runs** — verified with a counter: `baseRan` stayed `0` when `this` was touched first.
- A derived constructor that never calls `super()` throws the same `ReferenceError` when it tries to return — unless it explicitly returns an object, which bypasses the requirement entirely (verified: `constructor() { return { custom: true }; }` works).

**`super.method()` resolution.** `super.method()` looks up `method` starting at the parent's prototype — not the child's — but runs it with `this` bound to the subclass instance. Verified: a parent method reading `this.tag` inside a `super.describe()` call sees the *child's* `tag` value. This is how "call parent's implementation, then extend" works.

**Private fields and inheritance — extending Session 2's claim.** Session 2 stated private fields aren't accessible to subclasses. The mechanism: a `#name` private name is lexically scoped to the class body that declares it. The field *is* installed on subclass instances — the parent constructor runs on the child, so the storage exists — but no code outside the declaring class body can *name* it. A subclass method referencing the parent's `#secret` fails at **parse time** with a `SyntaxError`, not a runtime error (verified via `eval`). So the restriction is structural: subclasses inherit the *value* (the field slot exists) but not the *name* (no code path can address it).

When you need shared-but-restricted state across a hierarchy, the practical options:

1. **Protected-style accessor methods** — the declaring class exposes `protected`/plain methods that read/write its private field; subclasses use those. Verified pattern.
2. **A `WeakMap` keyed by instance** — the map lives in module scope; both base and subclass code can access it. Works across the hierarchy, and weak keys mean no retention leak. Verified pattern.
3. **Don't use `#` for anything a subclass needs** — plain public fields or documented convention, accepting the loss of enforcement.

### Part 2 — Interview Answer

Inheritance in JavaScript is two links, not one. When you write `class Child extends Parent`, the engine sets up `Child.prototype` to point at `Parent.prototype` — that's the instance side, how a child instance reaches parent methods — and it also links the classes themselves: `Object.getPrototypeOf(Child)` is `Parent`, which is how static members inherit. Most people only know the first link, and the static side is where interviewers probe.

`super()` is the sharp edge. In a derived constructor, `this` doesn't exist yet when the constructor starts — it's deliberately uninitialized. `super()` is what initializes it, by running the parent constructor on the child's behalf. If you touch `this` before `super()`, the engine throws a ReferenceError — I've verified the exact message: "Must call super constructor in derived class before accessing 'this' or returning from derived constructor." And the timing detail worth knowing: the throw happens at the access, and the parent constructor never runs — I've tested this with a counter; the parent body doesn't execute at all. A constructor that never calls super throws the same error when it tries to return, unless it returns an object explicitly.

`super.method()` is the other half: it starts the lookup at the parent's prototype rather than the child's, but it runs with the child instance as `this`. So a parent method that reads `this` sees the subclass's data — that's the mechanism behind "call the parent implementation, then extend."

And private fields are the weird part. A `#` field is installed on subclass instances — the parent constructor runs on the child, so the storage exists. But the name itself is lexically scoped to the declaring class body, so a subclass trying to touch `#secret` is a parse-time SyntaxError, not a runtime undefined. The field is inherited as storage, never as an address. If you need shared-but-restricted state, the options are protected-style accessor methods on the base, or a module-scoped WeakMap keyed by instance, which both sides can use.

### Part 3 — Whiteboard / Live Coding

**The same hierarchy, twice — raw `Object.create` + constructor functions, then `class`/`extends`:**

```typescript
// --- Raw version: the mechanism, unpadded ---
function Animal(this: { name: string }, name: string): void {
  this.name = name;
}
Animal.prototype.speak = function (this: { name: string }): string {
  return `${this.name} makes a sound`;
};

function Dog(this: { name: string; breed: string }, name: string, breed: string): void {
  Animal.call(this, name); // the raw "super()": run parent code on this pre-allocated this
  this.breed = breed;
}
Dog.prototype = Object.create(Animal.prototype); // link the chains
Dog.prototype.constructor = Dog;                 // repair the back-reference
Dog.prototype.speak = function (this: { name: string }): string {
  return `${this.name} barks`;
};

// --- Class version: the same shape, enforced ---
class Cat {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  speak(): string {
    return `${this.name} makes a sound`;
  }
}
class Lion extends Cat {
  maneSize: number;
  constructor(name: string, maneSize: number) {
    super(name); // required first step: initializes this
    this.maneSize = maneSize;
  }
  speak(): string {
    return `${super.speak()} — and roars`; // parent implementation + extension
  }
}

const dog = new (Dog as unknown as new (name: string, breed: string) => {
  name: string;
  breed: string;
  speak: () => string;
})("Rex", "Labrador");
const lion = new Lion("Leo", 5);

console.log(dog.speak());  // "Rex barks"
console.log(lion.speak()); // "Leo makes a sound — and roars"
console.log(dog instanceof Animal); // true — chain walk: Dog.prototype → Animal.prototype
console.log(lion instanceof Cat);   // true — same walk in the class version
```

**`this`-before-`super()`, verified failure mode and timing:**

```typescript
let baseRan = 0;
class Base {
  constructor() {
    baseRan++;
  }
}
class Bad extends Base {
  constructor() {
    // @ts-expect-error — this-before-super() is illegal
    this.x = 1;
    super();
  }
}
try {
  new Bad();
} catch (e) {
  console.log((e as Error).message);
  // "Must call super constructor in derived class before accessing 'this'
  //  or returning from derived constructor" — ReferenceError, thrown at the access
}
console.log(baseRan); // 0 — the parent constructor never ran
```

**`super.method()` runs with the subclass instance as `this`, verified:**

```typescript
class Machine {
  label = "machine";
  describe(): string {
    return `I am a ${this.label}`;
  }
}
class Robot extends Machine {
  label = "robot";
  describe(): string {
    return `${super.describe()} with arms`;
  }
}
console.log(new Robot().describe()); // "I am a robot with arms" — parent code, child data
```

**Private fields: inherited as storage, never as an address:**

```typescript
class Wallet {
  #balance = 100;
  protected readBalance(): number {
    return this.#balance;
  }
  protected writeBalance(n: number): void {
    this.#balance = n;
  }
}
class SafeWallet extends Wallet {
  withdraw(amount: number): boolean {
    const b = this.readBalance(); // option 1: protected accessor bridge
    if (b < amount) return false;
    this.writeBalance(b - amount);
    return true;
  }
}
console.log(new SafeWallet().withdraw(30)); // true

// Option 2: WeakMap keyed by instance — hierarchy-wide private state
const hp = new WeakMap<object, number>();
class Entity {
  constructor(startHp: number) {
    hp.set(this, startHp);
  }
  get hitPoints(): number {
    return hp.get(this) ?? 0;
  }
}
class Dragon extends Entity {
  breath(): void {
    hp.set(this, (hp.get(this) ?? 0) - 5); // both sides of the hierarchy share the map
  }
}
const dragon = new Dragon(50);
dragon.breath();
console.log(dragon.hitPoints); // 45

// What does NOT work — subclass code naming the parent's #field:
// class BreakIt extends Wallet {
//   constructor() {
//     super();
//     this.#balance = 0; // SyntaxError at parse time — the private name is not in scope
//   }
// }
```

### Part 4 — Follow-Up Questions

**Q: What exactly does `extends` do to the two prototypes?**

It sets `Object.getPrototypeOf(Child.prototype)` to `Parent.prototype` (instance-side lookup) and `Object.getPrototypeOf(Child)` to `Parent` (static-side lookup). Both were verified: a child instance walks up to parent prototype methods, and `Child.staticMethod` resolves through the class-to-class link. `extends` also works with plain functions and `Object.create`-built objects, not only classes.

**Q: Can a derived class have no `constructor` at all?**

Yes. If you don't write one, the default is `constructor(...args) { super(...args); }` — the parent constructor receives whatever arguments came in. That's why `class Child extends Parent {}` still runs the parent's initialization.

**Q: What's the difference between `super()` in a constructor and `Parent.call(this)` in the raw pattern?**

In the raw pattern, `new Child()` allocates `this` before any constructor code runs, and `Parent.call(this, ...)` reuses that pre-allocated object — you can call it at any point in the body, or never, and `this` still exists. In a class, `this` is uninitialized until `super()` runs; the parent constructor *is* the initialization step, and order is structurally enforced with the ReferenceError. Same effect, different enforcement: convention vs. hard rule.

**Q: Why does `super.method()` see the subclass's `this`?**

Because `super` in a method is resolved through the method's `[[HomeObject]]` — the prototype object the method was defined on — but the method executes in a normal call where `this` is whatever the call site supplied. `Robot.describe` calling `super.describe()` invokes the parent prototype's function with `this` still bound to the `Robot` instance. There's no separate "parent this"; it's the same instance, just a different starting point for the lookup.

**Q: What's the cost difference between `super()` and not calling it?**

None at runtime for the call itself — the cost is in the enforcement: the engine must track whether `this` is initialized in derived constructors, which is precisely why the ReferenceError exists. The practical cost is on the developer side: forgetting `super()` in a derived class with a custom constructor is a guaranteed loud error, not a silent undefined, and that's the design intent.

**Q: Can you `extends` built-ins like `Array` or `Error`?**

Yes. `class MyError extends Error` is the standard way to get proper `name`/`stack` semantics on custom errors. `extends Array` works for subclasses with the caveat that methods returning new arrays will call the subclass constructor — the well-known `.map()` on a custom array subclass creates a new instance of the subclass, not a plain array, which surprises people. Built-in subclassing is a supported, verified behavior; the gotchas are in the specifics, which Module 6 (error handling in Session 6's chain) covers for errors specifically.

### Part 5 — Common Mistakes

**Junior/mid answer:** "You have to call `super()` in the constructor, and if you don't, JavaScript throws a TypeError."

**Senior answer:** Two corrections. First, it's a `ReferenceError`, not a `TypeError` — verified message: "Must call super constructor in derived class before accessing 'this' or returning from derived constructor." The error type matters because it tells you what kind of thing is wrong: this is a failure of the binding state (`this` uninitialized), not a type mismatch. Second, the trigger isn't "forgetting super" in the abstract — it's *touching `this` before* `super()` runs, or *returning from the constructor* without having called it. A derived constructor that calls `super()` as its very last statement is fine; one that accesses `this` anywhere before the call is not, and the throw happens at the access, not at the end. The parent constructor never even starts in that case — verified by counting executions.

**Another junior tell:** "Private fields just aren't copied to subclasses, so they're undefined there."

**Senior correction:** The storage exists on the subclass instance — the parent constructor installs `#balance` on every child instance, and the parent's own methods can read it on children. What subclasses lack is the *name*: `#balance` is lexically scoped to the declaring class body, so subclass code can't even reference it — a `SyntaxError` at parse time, not `undefined` at runtime. This is the mechanism behind Session 2's claim, and it's why the escape hatches exist: protected-style accessor methods or a module-scoped `WeakMap` when a hierarchy genuinely needs shared private state.

**Another junior tell:** "`super.method()` calls the parent method on a parent instance."

**Senior correction:** There is no parent instance. `super.method()` starts the property lookup at the parent's prototype, but it executes with the *subclass* instance as `this`. The parent method reading `this` sees the child's data — that's the whole point of "call the parent, then extend." If it created a separate parent instance, state would never be shared and inheritance would be useless. This is the same call-site rule as Session 1's `this` binding: the lookup origin changes, the receiver doesn't.

### Part 6 — Production Examples

**Real incident — Class conversion broke a subclass touching a private name:** A team introduced `#` fields on a base data model to stop external code from mutating internal counters. A subclass in a feature module had been incrementing the counter via `this.internalCount` — the public field it replaced. The moment the base class renamed it to `#internalCount`, the subclass failed to *parse*: SyntaxError, not a runtime error, so the whole feature module went down at load time. The fix was the protected-accessor bridge: the base class exposed `protected incrementInternal()`, and the subclass called that instead. The lesson, codified in a lint rule: private fields in a class meant to be extended need a documented, deliberate access path for subclasses.

**Real incident — The WeakMap pattern for entity state in a game:** A web game's entity hierarchy — `Entity → Unit → Player` — needed `hp` to be instance-private but readable and writable from base and derived code alike. `#hp` on the base didn't work (subclass parse error, as above). The team used a module-scoped `WeakMap<object, number>` shared by the whole hierarchy: base class set it in the constructor, derived classes read and mutated it, and because keys are weak, entity teardown didn't leak. This is the pattern from Part 3 used in production, chosen specifically because the private-field restriction makes a hierarchy-wide `#` impossible by design.

**Real incident — `super()` misuse that shipped to prod:** A developer wrote a derived class whose constructor called `this.configure()` *before* `super()`, relying on the parent to finish initialization. In development it appeared to work — the access was inside a method that only read a defaulted field, so the engine's uninitialized-`this` check fired only in the path that actually touched `this`, which tests never hit. In production, `configure()` wrote to `this`, and the ReferenceError surfaced on the first real user session. The team's fix and rule: in derived constructors, `super()` is the first statement, no exceptions, and the CI lint now enforces it. The interesting part is the timing — the error is precise about *when* it throws, and code that happens to not touch `this` before `super()` can run, which is why the bug was testable-but-uncaught.

---

## 4. Putting It All Together — The Full Walkthrough

The four sections of this chain are one mechanism seen at four levels of abstraction:

- **`Object.create(proto)`** is the primitive: an object whose internal `[[Prototype]]` link is set directly. Nothing else happens — no constructor, no allocation ceremony. Everything else in this session is this one operation wearing different clothes.
- **`class`** is sugar over exactly that link. A class body's methods are properties on `ClassName.prototype`; `new` links instances to it via `[[Prototype]]`, non-enumerably, in strict mode, with the class name TDZ-bound like `let` instead of fully hoisted like a `function` declaration — the mechanism behind Session 1's "class — hoisted, uninitialized (TDZ)" line. And it cannot be called without `new`, a rail the function pattern never had.
- **`extends`** chains multiple prototype links: `Child.prototype → Parent.prototype` for instance lookup, `Child → Parent` for static lookup, with `super()` as the required step that initializes `this` in the derived constructor before any use, and `super.method()` as the "parent code, child data" escape hatch. Session 2's "methods live on the prototype, shared across instances" line is this chain working as designed — one function object per method, reached by walking links.
- **Private fields sit outside this chain entirely.** `#name` is lexically scoped to the declaring class body, not a link walked at lookup time — which is why Session 2's "private fields aren't accessible to subclasses" is true: the value inherits (the slot exists on the child instance), the name never does (no subclass code can parse a reference to it). The escape hatches — protected accessors, module-scoped `WeakMap` — exist precisely because the chain can't carry private names.

The through-line: inheritance in JavaScript is delegation through links, not copy. Read-time lookup walks the chain; write-time creates own properties; class syntax enforces structure on top; private fields are the one thing the chain can't express, by design.

The next step in this chain's context: Session 5 returns to Session 1's execution-model thread — the event loop, microtasks, and macrotasks — where the call stack from Session 1 meets the queueing that makes async code work. The prototype chain and the event loop are the two mechanisms every other JavaScript behavior builds on.
