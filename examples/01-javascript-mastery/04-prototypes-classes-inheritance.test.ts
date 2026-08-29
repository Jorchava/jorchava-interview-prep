// examples/01-javascript-mastery/04-prototypes-classes-inheritance.test.ts
//
// Verification harness for book/01-javascript-mastery/04-prototypes-classes-inheritance.md
// Run via `pnpm test`.
//
// What's tested here: every claim the session calls out as easy to state subtly
// wrong — this-before-super() timing and error type, enumerability of class
// methods vs the constructor-function pattern, calling a class without `new`,
// the `.prototype` vs `Object.getPrototypeOf(instance)` relationship, and the
// private-field inheritance restrictions. Every assertion is behavioral — it
// can fail if the claim it verifies is wrong.

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Prototypes and the prototype chain
// ---------------------------------------------------------------------------

describe('Prototype chain mechanics', () => {
  it('Object.create sets the internal [[Prototype]] link directly', () => {
    const base = { shared: 'from base' };
    const child = Object.create(base);
    child.own = 'from child';

    expect(child.own).toBe('from child');
    expect(child.shared).toBe('from base'); // walked up the chain
    expect(Object.getPrototypeOf(child)).toBe(base);
    expect(Object.getOwnPropertyDescriptor(child, 'shared')).toBeUndefined();
  });

  it('property lookup walks a multi-level chain until it finds the property or reaches null', () => {
    const level1 = { a: 'l1' };
    const level2 = Object.create(level1);
    level2.b = 'l2';
    const level3 = Object.create(level2);
    level3.c = 'l3';

    expect(level3.c).toBe('l3'); // own
    expect(level3.b).toBe('l2'); // one level up
    expect(level3.a).toBe('l1'); // two levels up
    expect('a' in level3).toBe(true);
    expect(Object.getOwnPropertyDescriptor(level3, 'a')).toBeUndefined();

    expect(Object.getPrototypeOf(level3)).toBe(level2);
    expect(Object.getPrototypeOf(level2)).toBe(level1);
    expect(Object.getPrototypeOf(level1)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(Object.prototype)).toBeNull(); // chain ends at null
  });

  it('own properties shadow prototype properties — lookup stops at the first match', () => {
    const proto = { value: 'proto' };
    const instance = Object.create(proto);
    instance.value = 'own';

    expect(instance.value).toBe('own');
    expect(Object.getPrototypeOf(instance).value).toBe('proto'); // not overwritten
  });

  it('Object.create(null) produces an object with no prototype at all', () => {
    const bare = Object.create(null);
    expect(Object.getPrototypeOf(bare)).toBeNull();
    expect((bare as Record<string, unknown>).hasOwnProperty).toBeUndefined();
    expect(() => (bare as Record<string, unknown>).hasOwnProperty('x')).toThrow(TypeError);
  });

  it('Object.create accepts a property descriptor map for the second argument', () => {
    const obj = Object.create({}, { x: { value: 42 } });
    expect((obj as { x: number }).x).toBe(42);
    // Descriptor defaults apply: non-writable, non-enumerable, non-configurable
    expect(Object.getOwnPropertyDescriptor(obj, 'x')!.enumerable).toBe(false);
  });

  it('.prototype is a property ON the constructor; getPrototypeOf reads the link ON the instance', () => {
    function Ctor(this: unknown): void {}
    const inst = new (Ctor as unknown as new () => unknown)();

    // The two are NOT the same thing:
    expect(inst).not.toBe((Ctor as unknown as { prototype: unknown }).prototype);
    // ...but they are related by identity:
    expect(Object.getPrototypeOf(inst)).toBe((Ctor as unknown as { prototype: unknown }).prototype);
    expect((inst as { __proto__: unknown }).__proto__).toBe(
      (Ctor as unknown as { prototype: unknown }).prototype,
    );
    expect(
      ((Ctor as unknown as { prototype: { constructor: unknown } }).prototype).constructor,
    ).toBe(Ctor);

    expect(Object.getPrototypeOf(Ctor.prototype)).toBe(Object.prototype);
  });

  it('instanceof walks the same chain, comparing against .prototype', () => {
    function Ctor(this: unknown): void {}
    const inst = new (Ctor as unknown as new () => unknown)();

    expect(inst instanceof Ctor).toBe(true);
    expect(Object.create((Ctor as unknown as { prototype: object }).prototype) instanceof Ctor).toBe(
      true,
    );
  });

  it('arrow functions have no .prototype property — it exists only where `new` can use it', () => {
    const arrow = (): void => {};
    expect((arrow as unknown as { prototype: unknown }).prototype).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Classes as syntactic sugar
// ---------------------------------------------------------------------------

describe('Classes as syntactic sugar', () => {
  it('class declarations are hoisted but uninitialized — TDZ, like let/const, unlike function declarations', () => {
    expect(() => {
      // @ts-expect-error — accessing the class before its declaration hits the TDZ; that's the point of this test
      new HoistedClass();
      class HoistedClass {}
    }).toThrow(/Cannot access 'HoistedClass' before initialization/);

    // Contrast: function declarations are fully hoisted
    functionCalledBeforeDefinition();
    function functionCalledBeforeDefinition(): void {}
  });

  it('a class cannot be invoked without new — TypeError, even when it looks callable', () => {
    class Callable {
      value = 1;
    }
    expect(() => {
      (Callable as unknown as () => void)();
    }).toThrow(TypeError);
    expect(() => {
      (Callable as unknown as () => void)();
    }).toThrow(/without 'new'/);
  });

  it('methods defined in a class body are non-enumerable on the prototype', () => {
    class Widget {
      render(): string {
        return 'rendered';
      }
    }
    const w = new Widget();

    // Not on the instance at all — methods live on the prototype (Session 2's claim):
    expect(Object.getOwnPropertyDescriptor(w, 'render')).toBeUndefined();
    expect(Object.getPrototypeOf(w).render).toBe(Widget.prototype.render);
    expect(w.render).toBe(Widget.prototype.render); // same function object, shared

    // Non-enumerable on the prototype:
    expect(Object.keys(Widget.prototype)).toEqual([]);
    expect(Object.getOwnPropertyDescriptor(Widget.prototype, 'render')!.enumerable).toBe(false);

    // for...in walks the chain but skips non-enumerable properties:
    const forInKeys: string[] = [];
    for (const k in w) forInKeys.push(k);
    expect(forInKeys).toEqual([]);
  });

  it('class fields are own enumerable properties — the contrast with methods', () => {
    class Fielded {
      field = 1;
      method(): void {}
    }
    const f = new Fielded();
    expect(Object.keys(f)).toEqual(['field']);
  });

  it('the old Constructor.prototype.method = fn pattern IS enumerable by default', () => {
    function OldWidget(this: unknown): void {}
    OldWidget.prototype.render = function (this: unknown): string {
      return 'rendered';
    };

    expect(Object.getOwnPropertyDescriptor(OldWidget.prototype, 'render')!.enumerable).toBe(true);
    expect(Object.keys(OldWidget.prototype)).toEqual(['render']);

    // for...in over the instance surfaces prototype methods that are enumerable:
    const forInKeys: string[] = [];
    for (const k in new (OldWidget as unknown as new () => object)()) forInKeys.push(k);
    expect(forInKeys).toEqual(['render']);
  });

  it('the constructor back-reference is non-enumerable in BOTH patterns — no class-specific difference', () => {
    class C {}
    function F(this: unknown): void {}

    const classDesc = Object.getOwnPropertyDescriptor(C.prototype, 'constructor')!;
    const fnDesc = Object.getOwnPropertyDescriptor(F.prototype, 'constructor')!;

    // Verified against V8/Node 22: the descriptor flags are identical in both patterns.
    // A "class prototypes have a special locked constructor" claim is wrong.
    for (const desc of [classDesc, fnDesc]) {
      expect(desc.writable).toBe(true);
      expect(desc.enumerable).toBe(false);
      expect(desc.configurable).toBe(true);
    }
    expect(classDesc.value).toBe(C);
    expect(fnDesc.value).toBe(F);
    // Consequence: Object.keys() is empty for both, because the only
    // auto-created property is non-enumerable in both.
    expect(Object.keys(C.prototype)).toEqual([]);
    expect(Object.keys(F.prototype)).toEqual([]);
  });

  it('getters defined in a class body are non-enumerable on the prototype', () => {
    class Sized {
      get size(): number {
        return 1;
      }
    }
    expect(Object.getOwnPropertyDescriptor(Sized.prototype, 'size')!.enumerable).toBe(false);
  });

  it('class bodies are strict mode — detached method call gives undefined this', () => {
    class StrictDemo {
      whoAmI(): unknown {
        return this;
      }
    }
    const detached = new StrictDemo().whoAmI;
    // In sloppy mode this would be the global object; strict mode gives undefined
    expect(detached()).toBeUndefined();
  });

  it('class bodies are strict mode — assignment to an undeclared identifier throws', () => {
    class StrictDemo {
      leak(): void {
        eval('deliberateUndeclaredLeak_04 = 1');
      }
    }
    expect(() => new StrictDemo().leak()).toThrow(ReferenceError);
  });
});

// ---------------------------------------------------------------------------
// 3. Inheritance
// ---------------------------------------------------------------------------

describe('Inheritance: extends, super, and private fields', () => {
  it('raw constructor-function + Object.create inheritance matches class/extends behavior', () => {
    // Raw version
    function RawAnimal(this: { name: string }, name: string) {
      this.name = name;
    }
    RawAnimal.prototype.speak = function (this: { name: string }): string {
      return `${this.name} makes a sound`;
    };

    function RawDog(this: { name: string; breed: string }, name: string, breed: string) {
      RawAnimal.call(this, name); // the "super()" call, on a pre-allocated this
      this.breed = breed;
    }
    RawDog.prototype = Object.create(RawAnimal.prototype); // chain the prototypes
    RawDog.prototype.constructor = RawDog; // restore the constructor back-reference
    RawDog.prototype.speak = function (this: { name: string }): string {
      return `${this.name} barks`;
    };

    // Class version
    class ClsAnimal {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      speak(): string {
        return `${this.name} makes a sound`;
      }
    }
    class ClsDog extends ClsAnimal {
      breed: string;
      constructor(name: string, breed: string) {
        super(name);
        this.breed = breed;
      }
      speak(): string {
        return `${this.name} barks`;
      }
    }

    const rawDog = new (RawDog as unknown as new (name: string, breed: string) => {
      name: string;
      breed: string;
      speak: () => string;
    })('Rex', 'Lab');
    const clsDog = new ClsDog('Rex', 'Lab');

    for (const dog of [rawDog, clsDog]) {
      expect(dog.name).toBe('Rex');
      expect(dog.breed).toBe('Lab');
      expect(dog.speak()).toBe('Rex barks');
    }
    // instanceof works through the whole chain in both versions:
    expect(rawDog instanceof RawAnimal).toBe(true);
    expect(clsDog instanceof ClsAnimal).toBe(true);
  });

  it('accessing this before calling super() throws ReferenceError — and the base constructor never runs', () => {
    let baseRan = 0;
    class Base {
      constructor() {
        baseRan++;
      }
    }
    class Derived extends Base {
      constructor() {
        // this.x = 1; // illegal here — throws ReferenceError before super()
        super();
      }
    }

    class BadDerived extends Base {
      constructor() {
        // @ts-expect-error — this-before-super() is illegal; that's the point of this test
        this.x = 1;
        super();
      }
    }

    expect(() => new BadDerived()).toThrow(ReferenceError);
    expect(() => new BadDerived()).toThrow(/super/);
    expect(baseRan).toBe(0); // the throw happened at `this`, before super() ever ran

    expect(new Derived().constructor).toBe(Derived);
    expect(baseRan).toBe(1);
  });

  it('a derived constructor that never calls super throws on return — ReferenceError', () => {
    let baseRan = 0;
    class Base {
      constructor() {
        baseRan++;
      }
    }
    class NoSuper extends Base {
      // @ts-expect-error — a derived constructor with no super() call anywhere is the point of this test
      constructor() {
        // no super() anywhere
      }
    }
    expect(() => new NoSuper()).toThrow(ReferenceError);
    expect(baseRan).toBe(0);
  });

  it('returning an object from a derived constructor bypasses the super requirement', () => {
    class Base {}
    class Weird extends Base {
      // @ts-expect-error — TS's static check requires a super() call regardless of the
      // early-return escape hatch, which only exists at runtime; that gap is the point here
      constructor() {
        return { custom: true };
      }
    }
    const w = new Weird();
    expect((w as { custom: boolean }).custom).toBe(true);
  });

  it('super.method() resolves through the parent prototype but runs with the subclass instance as this', () => {
    class Parent {
      tag = 'parent'; // base declares the contract; subclass field initializer overrides it after super()
      describe(): string {
        return `Parent(${this.tag})`; // `this.tag` must be the subclass instance's
      }
    }
    class Child extends Parent {
      tag = 'child';
      describe(): string {
        return `${super.describe()} -> Child`;
      }
    }

    expect(new Child().describe()).toBe('Parent(child) -> Child');
  });

  it('the base constructor initializes fields on the subclass instance', () => {
    class Base {
      baseField = 'base-initialized';
    }
    class Child extends Base {}
    expect(new Child().baseField).toBe('base-initialized');
  });

  it('extends chains the static side too — subclass inherits static members through its own prototype link', () => {
    class Base {
      static kind = 'base-kind';
      static make(): string {
        return this.kind; // `this` here is the subclass when called on it
      }
    }
    class Child extends Base {}

    expect(Object.getPrototypeOf(Child)).toBe(Base); // the class-to-class link
    expect(Child.kind).toBe('base-kind');
    expect(Child.make()).toBe('base-kind');
  });

  it('private fields are not inherited — subclass code cannot reference the parent private name', () => {
    expect(() => {
      eval(`
        class Parent { #secret = 1; }
        class Child extends Parent {
          constructor() {
            super();
            this.#secret = 2; // SyntaxError: private name not in an enclosing class
          }
        }
        new Child();
      `);
    }).toThrow(SyntaxError);
  });

  it('the private field exists on the subclass instance, but only the declaring class can access it', () => {
    class Parent {
      #secret = 41;
      readSecret(): number {
        return this.#secret; // allowed: #secret is declared in this class
      }
    }
    class Child extends Parent {}
    const c = new Child();
    // The field was installed by the base constructor on the child instance...
    expect(c.readSecret()).toBe(41);
    // ...but the child class body has no way to touch it directly.
  });

  it('option A — protected-style accessor methods bridge the hierarchy', () => {
    class Account {
      #balance = 100;
      protected readBalance(): number {
        return this.#balance;
      }
      protected writeBalance(n: number): void {
        this.#balance = n;
      }
    }
    class SavingsAccount extends Account {
      addInterest(): number {
        const b = this.readBalance(); // subclass accesses via the protected bridge
        this.writeBalance(b + 10);
        return this.readBalance();
      }
    }
    expect(new SavingsAccount().addInterest()).toBe(110);
  });

  it('option B — a WeakMap keyed by instance provides hierarchy-wide private state', () => {
    const balances = new WeakMap<object, number>();
    class Account {
      constructor(initial: number) {
        balances.set(this, initial);
      }
      getBalance(): number {
        return balances.get(this) ?? 0;
      }
    }
    class SavingsAccount extends Account {
      rate: number;
      constructor(initial: number, rate: number) {
        super(initial);
        this.rate = rate;
      }
      applyInterest(): void {
        balances.set(this, (balances.get(this) ?? 0) * (1 + this.rate));
      }
    }
    const sa = new SavingsAccount(100, 0.1);
    sa.applyInterest();
    expect(sa.getBalance()).toBeCloseTo(110);
  });
});
