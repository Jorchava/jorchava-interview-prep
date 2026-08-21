// examples/01-javascript-mastery/07-symbols-iterators-generators-map-weakmap-set.test.ts
//
// Verification harness for book/01-javascript-mastery/07-symbols-iterators-generators-map-weakmap-set.md
// Run via `pnpm test`.
//
// The load-bearing claims, matching the session's Critical Notes:
//   1. Symbol uniqueness below the description — Symbol('x') !== Symbol('x'),
//      with Symbol.for/Symbol.keyFor as the registered exception.
//   2. Symbol.hasInstance is the mechanism behind instanceof — a class or
//      plain object can redefine it (Session 4's follow-up, now verified).
//   3. The iterator protocol: an iterable has [Symbol.iterator]() returning
//      an iterator with .next() → { value, done }. A hand-written iterable
//      must work in for...of, spread, destructuring, Array.from, and the
//      combinators / AggregateError (Session 6's "takes an iterable, not an
//      array" point). Plain objects must NOT be iterable.
//   4. Generator two-way communication, THE most-misstated claim: the value
//      passed to .next(value) becomes the RESULT of the yield expression the
//      generator is paused on — verified by asserting on what the generator
//      READS, not on what it yields. Also: a generator is both iterator and
//      iterable ([Symbol.iterator]() === itself), yield* delegates and returns
//      the inner generator's return value.
//   5. Laziness: an infinite Fibonacci generator computes exactly the terms
//      consumed — asserted via a computation counter, not just value checks.
//   6. Map: any value as key (NaN works via SameValueZero), insertion order,
//      .size, direct iteration — versus plain-object string-coercion of keys.
//   7. WeakMap/WeakSet: STRUCTURAL claims only — no GC-timing assertions
//      anywhere. Keys must be objects (TypeError), no .size, not iterable.
//      WeakMap's constructor DOES take an iterable of [key, value] pairs.
//
// NO test in this file attempts to observe garbage collection timing for
// WeakMap — the reachability semantics are described, never timed.

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Symbols — uniqueness, the global registry, symbol keys, Symbol.hasInstance
// ---------------------------------------------------------------------------

describe('Symbols: unique primitives with a registry exception', () => {
  it('two Symbol() calls are never equal, even with the same description', () => {
    expect(Symbol('x')).not.toBe(Symbol('x'));
    expect(typeof Symbol('x')).toBe('symbol');
    // The description is a debugging label, not an identity.
    expect(Symbol('same description').description).toBe('same description');
  });

  it('Symbol.for / Symbol.keyFor are the ONE exception — a global registry keyed by string', () => {
    expect(Symbol.for('shared')).toBe(Symbol.for('shared'));
    expect(Symbol.keyFor(Symbol.for('shared'))).toBe('shared');
    // A locally-created symbol is NOT in the registry.
    expect(Symbol.keyFor(Symbol('shared'))).toBeUndefined();
  });

  it('symbol-keyed properties do not collide with or surface in string-key enumeration', () => {
    const key = Symbol('secret');
    const obj = { visible: 1, [key]: 'hidden' };

    expect(Object.keys(obj)).toEqual(['visible']); // symbol keys stay out of Object.keys
    expect(JSON.stringify(obj)).toBe('{"visible":1}'); // skipped in JSON too
    expect(Object.getOwnPropertySymbols(obj)).toEqual([key]); // reachable, on purpose
    expect(Reflect.ownKeys(obj)).toEqual(['visible', key]);
  });

  it('Symbol.hasInstance customizes instanceof — the mechanism from Session 4', () => {
    class TypeGuard {
      static [Symbol.hasInstance](value: unknown): boolean {
        return typeof value === 'number';
      }
    }
    expect((5 as any) instanceof TypeGuard).toBe(true);
    expect(('5' as any) instanceof TypeGuard).toBe(false);

    // A plain object on the right-hand side works too — instanceof simply
    // calls whatever [Symbol.hasInstance] it finds.
    const matcher = {
      [Symbol.hasInstance](value: unknown): boolean {
        return value === 'looked-for';
      },
    };
    expect(('looked-for' as any) instanceof (matcher as unknown as Function)).toBe(true);
    expect(('else' as any) instanceof (matcher as unknown as Function)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. The iterator protocol — one hand-written iterable, five consumers
// ---------------------------------------------------------------------------

describe('The iterator protocol: an iterable has [Symbol.iterator], an iterator has .next()', () => {
  // The minimal hand-written iterable: no array backing, just the two halves
  // of the contract — [Symbol.iterator]() returns an iterator whose .next()
  // returns { value, done }.
  function makeRange(start: number, end: number): Iterable<number> {
    return {
      [Symbol.iterator](): { next: () => { value: number; done: boolean } } {
        // Each call to [Symbol.iterator]() returns a FRESH iterator with its
        // own position — that is the contract. (The shared-closure version of
        // this is a well-known bug: a second for...of silently returns [].)
        let i = start;
        return {
          next() {
            if (i > end) return { value: 0, done: true };
            return { value: i++, done: false };
          },
        };
      },
    };
  }

  it('for...of consumes a hand-written iterable', () => {
    const out: number[] = [];
    for (const n of makeRange(1, 3)) out.push(n);
    expect(out).toEqual([1, 2, 3]);
  });

  it('spread, destructuring, and Array.from all sit on the same protocol', () => {
    expect([...makeRange(1, 4)]).toEqual([1, 2, 3, 4]);

    const [first, second] = makeRange(5, 20);
    expect([first, second]).toEqual([5, 6]);

    expect(Array.from(makeRange(2, 4))).toEqual([2, 3, 4]);
  });

  it('an iterator is single-pass: each for...of gets a FRESH iterator from the iterable', () => {
    const src = makeRange(1, 2);
    expect([...src]).toEqual([1, 2]);
    expect([...src]).toEqual([1, 2]); // calling [Symbol.iterator] again restarts the walk
  });

  it('plain objects are NOT iterable — for...of throws TypeError', () => {
    expect(() => {
      for (const _ of ({ plain: true } as unknown as Iterable<unknown>)) {
      }
    }).toThrow(TypeError);
  });

  it('Session 6 gated: the combinators accept an iterable, not specifically an array — a Set proves it', async () => {
    const results = await Promise.all(new Set([Promise.resolve('a'), Promise.resolve('b')]));
    expect(results).toEqual(['a', 'b']);

    const raced = await Promise.race(new Set([Promise.resolve('first'), Promise.resolve('second')]));
    expect(raced).toBe('first');

    const any = await Promise.any(new Set([Promise.reject(new Error('boom')), Promise.resolve('ok')]));
    expect(any).toBe('ok');
  });

  it('Session 6 gated: AggregateError accepts an iterable of errors — a generator of errors', () => {
    function* errorGenerator(): Generator<Error> {
      yield new Error('first'); // a generator is itself an iterable
      yield new Error('second');
    }
    const aggregate = new AggregateError(errorGenerator(), 'both failed');
    expect(aggregate.message).toBe('both failed');
    expect(aggregate.errors).toHaveLength(2);
    expect(aggregate.errors.map((e) => (e as Error).message)).toEqual(['first', 'second']);
  });
});

// ---------------------------------------------------------------------------
// 3. Generators — two-way communication, laziness, delegation
// ---------------------------------------------------------------------------

describe('Generators: pause/resume, TWO-WAY communication, laziness', () => {
  it('THE most-misstated claim: .next(value) resumes the yield expression with `value`', () => {
    const received: string[] = [];

    function* query(): Generator<string, string> {
      const first = yield 'paused-at-1';
      received.push(`first-read:${first}`);
      const second = yield 'paused-at-2';
      received.push(`second-read:${second}`);
      return 'done';
    }

    const gen = query();

    // first .next() runs to the first yield, done:false — the value is what
    // the generator offers, nothing has been received yet.
    expect(gen.next()).toEqual({ value: 'paused-at-1', done: false });

    // now the VALUE lands INSIDE the generator, as the result of that yield.
    expect(gen.next('sent-in')).toEqual({ value: 'paused-at-2', done: false });
    expect(received).toEqual(['first-read:sent-in']); // sent value was READ, not ignored

    // the third .next()'s value is what the SECOND yield expression reads.
    expect(gen.next('sent-after')).toEqual({ value: 'done', done: true });
    expect(received).toEqual(['first-read:sent-in', 'second-read:sent-after']);
  });

  it('a generator object is BOTH an iterator and an iterable — [Symbol.iterator] returns itself', () => {
    function* numbers(): Generator<number> {
      yield 1;
      yield 2;
    }
    const gen = numbers();
    expect(typeof gen.next).toBe('function');
    expect(gen[Symbol.iterator]()).toBe(gen);

    // because it is an iterable, for...of and spread consume it directly
    expect([...numbers()]).toEqual([1, 2]);
    const collected: number[] = [];
    for (const n of numbers()) collected.push(n);
    expect(collected).toEqual([1, 2]);
  });

  it('laziness is real: an infinite sequence computes ONLY the terms consumed', () => {
    let computed = 0;

    function* fibonacci(): Generator<number> {
      let [prev, curr] = [0, 1];
      while (true) {
        computed++; // the ONLY place a term is computed
        yield prev;
        [prev, curr] = [curr, prev + curr];
      }
    }

    const gen = fibonacci();
    const firstTen: number[] = [];
    for (let n = 0; n < 10; n++) {
      const step = gen.next();
      if (!step.done) firstTen.push(step.value);
    }

    expect(firstTen).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34]); // correct values...
    expect(computed).toBe(10); // ...and ONLY ten terms were computed — nothing for the rest of the infinite loop

    // pulling five more is the ONLY way the count grows.
    for (let n = 0; n < 5; n++) gen.next();
    expect(computed).toBe(15);
  });

  it('yield* delegates to another iterable/generator, and yields its return value', () => {
    function* inner(): Generator<number, number> {
      yield 10;
      return 42;
    }
    function* outer(): Generator<number, void> {
      const delegated = yield* inner(); // 42 — the delegated generator's return value
      yield delegated;
      yield 99;
    }

    expect([...outer()]).toEqual([10, 42, 99]);
  });
});

// ---------------------------------------------------------------------------
// 4. Map vs. plain object — keys, ordering, size
// ---------------------------------------------------------------------------

describe('Map: any value as a key, insertion order, direct size', () => {
  it('a plain object coerces keys to strings — a Map keeps them distinct', () => {
    const plain: Record<string, unknown> = {};
    plain[1] = 'number-one';
    plain['1'] = 'string-one';
    expect(Object.keys(plain)).toEqual(['1']); // ONE key: the collision
    expect(plain[1]).toBe('string-one'); // the number key lost

    const map = new Map<number | string, string>();
    map.set(1, 'number-one');
    map.set('1', 'string-one');
    expect(map.size).toBe(2); // two distinct keys
    expect(map.get(1)).toBe('number-one');
    expect(map.get('1')).toBe('string-one');
  });

  it('NaN works as a Map key (SameValueZero) — impossible in a plain object lookup', () => {
    const map = new Map<number, string>();
    map.set(NaN, 'not-a-number key');
    expect(map.get(NaN)).toBe('not-a-number key');

    map.set(NaN, 'second');
    expect(map.size).toBe(1); // same key — the set overwrote, not added
    expect(map.get(NaN)).toBe('second');
  });

  it('maps iterate in insertion order, with a reliable .size', () => {
    const map = new Map<string, number>();
    map.set('one', 1);
    map.set('two', 2);
    map.set('three', 3);

    expect([...map.keys()]).toEqual(['one', 'two', 'three']);
    expect([...map.values()]).toEqual([1, 2, 3]);
    expect(map.size).toBe(3);
    expect(map.has('two')).toBe(true);
    map.delete('two');
    expect(map.size).toBe(2);
  });

  it('a Map is directly iterable (an object is not) — it yields [key, value] pairs', () => {
    const map = new Map<number, string>([[1, 'a'], [2, 'b']]);
    const pairs: Array<[number, string]> = [];
    for (const pair of map) pairs.push(pair);
    expect(pairs).toEqual([[1, 'a'], [2, 'b']]);
  });
});

// ---------------------------------------------------------------------------
// 5. Set / WeakSet — uniqueness, O(1) has(), weak membership (structural only)
// ---------------------------------------------------------------------------

describe('Set for uniqueness, WeakSet for weak membership (structural API only)', () => {
  it('Set deduplicates, including NaN and +0/-0 via SameValueZero', () => {
    const set = new Set<number>([1, 1, 2, NaN, NaN, 0, -0]);
    expect(set.size).toBe(4); // {1, 2, NaN, 0}
    expect(set.has(1)).toBe(true);
    expect(set.has(NaN)).toBe(true);
    expect(set.has(0)).toBe(true);
  });

  it('Set members are consulted by identity, and iteration is in insertion order', () => {
    const set = new Set([30, 10, 20]);
    expect([...set]).toEqual([30, 10, 20]);
    set.add(10); // already there — no change, no duplicate entry
    expect([...set]).toEqual([30, 10, 20]);
    expect(set.size).toBe(3);
  });

  it('WeakSet: structural API only — no .size, not iterable, object-only membership', () => {
    const ws = new WeakSet();
    const obj = {};
    ws.add(obj);
    expect(ws.has(obj)).toBe(true);
    expect(ws.delete(obj)).toBe(true);

    // structural claims, each asserted directly:
    expect((ws as { size?: unknown }).size).toBeUndefined(); // no usable .size
    expect(typeof (ws as { [Symbol.iterator]?: unknown })[Symbol.iterator]).toBe('undefined'); // not iterable
    expect(() => {
      for (const _ of (ws as unknown as Set<object>)) {
      }
    }).toThrow(TypeError);
    expect(() => (ws as unknown as { add: (n: number) => WeakSet<object> }).add(1)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// 6. WeakMap — structural API: object-only keys, no order, no size, iterable by design
// ---------------------------------------------------------------------------
//
// The prompt's Critical Notes: whether a weakly-held key actually gets
// collected is NOT reliably observable from a sync vitest assertion, so this
// section asserts structural behavior ONLY. The reachability semantics (a
// WeakMap entry does not count as a GC root for its key) are described in the
// book/ file, never asserted with a timing expectation.

describe('WeakMap: object-only keys, no .size, not iterable — structural only', () => {
  it('keys must be objects — a primitive key throws TypeError', () => {
    const weakMap = new WeakMap<object, string>();
    expect(() =>
      (weakMap as unknown as { set: (k: unknown, v: string) => void }).set('primitive', 'x'),
    ).toThrow(TypeError);
    expect(() => (weakMap as unknown as { set: (k: number, v: string) => void }).set(1, 'x')).toThrow(
      TypeError,
    );
  });

  it('WeakMap has no .size property, no .keys()/.values(), and is NOT iterable', () => {
    const weakMap = new WeakMap();
    const obj = {};

    expect((weakMap as { size?: unknown }).size).toBeUndefined(); // not undefined in the map sense
    expect(typeof (weakMap as { keys?: unknown }).keys).toBe('undefined'); // no enumeration API
    expect(typeof (weakMap as { values?: unknown }).values).toBe('undefined');
    expect(typeof (weakMap as { [Symbol.iterator]?: unknown })[Symbol.iterator]).toBe('undefined');

    // for...of over a WeakMap is a TypeError — nothing to iterate BY DESIGN.
    expect(() => {
      for (const _ of (weakMap as unknown as Set<unknown>)) {
      }
    }).toThrow(TypeError);
  });

  it('the constructor takes an ITERABLE of [key, value] pairs — the protocol this session defined', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };

    // a generator is an iterable — this could not be expressed without the protocol
    function* pairs(): Generator<[object, string]> {
      yield [a, 'A'];
      yield [b, 'B'];
    }

    const weakMap = new WeakMap(pairs());
    expect(weakMap.get(a)).toBe('A');
    expect(weakMap.get(b)).toBe('B');
    expect(weakMap.has(b)).toBe(true);
  });

  it('WeakMap holds object references — .get returns the stored value while the key is the key', () => {
    const weakMap = new WeakMap<object, { meta: string }>();
    const entity = {};
    weakMap.set(entity, { meta: 'attached' });
    expect(weakMap.get(entity)?.meta).toBe('attached');
  });
});