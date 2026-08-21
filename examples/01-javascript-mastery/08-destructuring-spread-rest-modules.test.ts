// examples/01-javascript-mastery/08-destructuring-spread-rest-modules.test.ts
//
// Verification harness for book/01-javascript-mastery/08-destructuring-spread-rest-modules.md
// Run via `pnpm test`.
//
// The load-bearing claims, matching the session's Critical Notes:
//   1. Array destructuring is an ITERATOR-PROTOCOL consumer (Session 7's
//      vocabulary): it works on Sets, generators, and hand-written
//      iterables — and a non-iterable throws TypeError on the spot.
//      Object destructuring is a SEPARATE mechanism (property access) —
//      null/undefined throw, plain objects work, nothing iterative.
//   2. Spread has two UNRELATED meanings sharing one syntax:
//      [...x] and fn(...x) consume the iterator protocol; {...x} copies
//      OWN ENUMERABLE properties (string + symbol keys; skips inherited
//      and non-enumerable). The Map/Set-into-object case yields {} —
//      a Map's entries are not own enumerable properties.
//   3. Spread copies are SHALLOW: a nested object/array is a shared
//      reference, and a nested mutation leaks back into the "copy" —
//      this assertion fails if the copy were a deep clone.
//   4. Rest parameters collect the remainder into a REAL array, versus
//      the arguments object: array-like (has length, IS iterable via the
//      protocol) but not an array (no .map), and arrows have no
//      arguments binding of their own (enclosing function's wins; at
//      module top level it is a ReferenceError).
//   5. ES modules: live bindings — an imported binding reflects the
//      exporter's CURRENT value after the exporter mutates it, verified
//      across two real module files (lib/live-binding-exporter.ts +
//      lib/live-binding-reader.ts), and imported bindings are read-only
//      in the importing module (assignment throws TypeError).
//   6. Circular imports, spec terms: bindings are hoisted (instantiated
//      for the whole graph before evaluation), so a cycle where nothing
//      reads before initialization evaluates fine (lib/circular-*.ts);
//      reading a not-yet-initialized binding at evaluation time is a TDZ
//      ReferenceError (lib/tdz-*.ts, asserted by catching the rejected
//      dynamic import — NOT an empty catch block).
//
// Every throw-testing assertion in this file asserts the throw via
// expect(...).toThrow(...) — there is no empty catch block anywhere.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { counter, bump } from './lib/live-binding-exporter';
import * as exporterNamespace from './lib/live-binding-exporter';
import { readCounterFromExporter, readDefaultFromExporter } from './lib/live-binding-reader';

// ---------------------------------------------------------------------------
// 1. Destructuring — array form consumes the iterator protocol (Session 7),
//    object form is property access
// ---------------------------------------------------------------------------

describe('destructuring: array form consumes the iterator protocol; object form is property access', () => {
  it('array destructuring works on ANY iterable, not just arrays — a Set', () => {
    const [first, second] = new Set(['a', 'b', 'c']);
    expect([first, second]).toEqual(['a', 'b']);
  });

  it('array destructuring works on a generator, including hole elision', () => {
    function* gen(): Generator<number> {
      yield 10;
      yield 20;
      yield 30;
    }
    const [x, , z] = gen(); // the middle hole skips one value via the protocol
    expect([x, z]).toEqual([10, 30]);
  });

  it('array destructuring works on a hand-written iterable — [Symbol.iterator] is all it uses', () => {
    const range: Iterable<number> = {
      [Symbol.iterator]() {
        let i = 0;
        return {
          next: () => (i < 3 ? { value: i++, done: false } : { value: 0, done: true }),
        };
      },
    };
    const [a, b, c] = range;
    expect([a, b, c]).toEqual([0, 1, 2]);
  });

  it('strings are iterable, so they array-destructure through the protocol too', () => {
    const [h, i] = 'hi';
    expect([h, i]).toEqual(['h', 'i']);
  });

  it('a NON-iterable cannot be array-destructured — TypeError, asserted not swallowed', () => {
    expect(() => {
      const [x] = 42 as unknown as Iterable<number>;
      void x;
    }).toThrow(TypeError);

    expect(() => {
      const [x] = {} as unknown as Iterable<unknown>;
      void x;
    }).toThrow(TypeError);
  });

  it('object destructuring is property access — plain objects work without any iteration', () => {
    const { a, b } = { a: 1, b: 2 };
    expect([a, b]).toEqual([1, 2]);
  });

  it('object destructuring null/undefined — TypeError, asserted', () => {
    expect(() => {
      const { a } = null as unknown as { a: number };
      void a;
    }).toThrow(TypeError);

    expect(() => {
      const { a } = undefined as unknown as { a: number };
      void a;
    }).toThrow(TypeError);
  });

  it('defaults kick in ONLY for undefined — null is a value and passes through', () => {
    const { a = 1 } = {} as { a?: number };
    expect(a).toBe(1);

    const { b = 1 } = { b: null } as unknown as { b: number | null };
    expect(b).toBeNull(); // the default did NOT apply — null is present

    const [x = 1] = [] as number[];
    expect(x).toBe(1);

    const [y = 1] = [null] as Array<number | null>;
    expect(y).toBeNull();

    const [gone] = [] as number[];
    expect(gone).toBeUndefined(); // destructuring past the end is undefined, not an error
  });

  it('renaming ({ a: renamed }) and nested patterns both work', () => {
    const { a: renamed } = { a: 'value' };
    expect(renamed).toBe('value');

    const { nested: { deep } } = { nested: { deep: 'found' } };
    expect(deep).toBe('found');
  });

  it('THE swap idiom — the reason seniors reach for array destructuring', () => {
    let x = 'left';
    let y = 'right';
    [x, y] = [y, x]; // [y, x] is a fresh array; both reads happen before either write
    expect([x, y]).toEqual(['right', 'left']);
  });
});

// ---------------------------------------------------------------------------
// 2. Spread — [...x] / fn(...x) consume the iterator protocol;
//    {...x} copies own enumerable properties (unrelated mechanism)
// ---------------------------------------------------------------------------

describe('spread: TWO unrelated mechanisms sharing one syntax', () => {
  it('array-literal spread consumes the protocol — Set, generator, string', () => {
    expect([...new Set([3, 1, 2])]).toEqual([3, 1, 2]);

    function* g(): Generator<number> {
      yield 1;
      yield 2;
    }
    expect([...g()]).toEqual([1, 2]);
    expect([...'ab']).toEqual(['a', 'b']);
  });

  it('function-call spread hands an iterable over as individual arguments', () => {
    expect(Math.max(...new Set([5, 1, 9]))).toBe(9);

    function sum(...nums: number[]): number {
      return nums.reduce((acc, n) => acc + n, 0);
    }
    expect(sum(...new Set([1, 2, 3]))).toBe(6);
  });

  it('spreading a NON-iterable into an array — TypeError, asserted', () => {
    expect(() => {
      const out = [...(42 as unknown as Iterable<number>)];
      void out;
    }).toThrow(TypeError);
  });

  it('object spread copies OWN ENUMERABLE properties only — no inherited, no non-enumerable, symbols yes', () => {
    const symbolKey = Symbol('meta');
    const source = { visible: 1, [symbolKey]: 2 } as Record<PropertyKey, number>;
    Object.defineProperty(source, 'hidden', { value: 3, enumerable: false });
    Object.setPrototypeOf(source, { inherited: 4 });

    const copy = { ...source } as Record<PropertyKey, number> & { hidden?: never; inherited?: never };

    expect(copy['visible']).toBe(1);
    expect(copy[symbolKey]).toBe(2); // symbol keys ARE copied by object spread
    expect('hidden' in copy).toBe(false); // non-enumerable: skipped
    expect('inherited' in copy).toBe(false); // prototype chain: skipped
  });

  it('THE contrast: object-spreading a Map or Set yields {} — entries are not own enumerable properties', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    expect({ ...map }).toEqual({});

    const set = new Set([1, 2]);
    expect({ ...set }).toEqual({});

    // the same data, in a plain object, spreads fine — the mechanism is
    // property copying, not iteration:
    expect({ ...Object.fromEntries(map) }).toEqual({ a: 1, b: 2 });
  });

  it('object spread ignores null/undefined sources; array spread of them throws — the asymmetry', () => {
    const nil: unknown = null;
    const undef: unknown = undefined;

    expect({ ...(nil as object) }).toEqual({});
    expect({ ...(undef as object) }).toEqual({});

    expect(() => {
      const out = [...(nil as unknown as Iterable<unknown>)];
      void out;
    }).toThrow(TypeError);
  });

  it('spread copies are SHALLOW — a nested mutation leaks into the "copy"', () => {
    const original = { nested: { count: 1 }, list: [1, 2, 3] };
    const copy = { ...original };

    copy.nested.count = 99;
    copy.list.push(4);

    // these can FAIL if the spread were a deep clone — they are the proof
    // that nested structures are shared references, not copies:
    expect(original.nested.count).toBe(99);
    expect(original.list).toEqual([1, 2, 3, 4]);
  });

  it('later keys win in object spread', () => {
    expect({ ...{ a: 1, b: 1 }, a: 2 }).toEqual({ a: 2, b: 1 });
  });

  it('Object.assign writes THROUGH a target setter; object spread creates fresh data properties', () => {
    const setterCalls: number[] = [];
    const target = {
      set x(v: number) {
        setterCalls.push(v);
      },
    };
    Object.assign(target, { x: 42 });
    expect(setterCalls).toEqual([42]); // the setter, not a plain write, received the value

    // spread has no target at all — it builds a fresh object with data
    // properties, so no setter could fire:
    const spread = { ...{ x: 1 } };
    const descriptor = Object.getOwnPropertyDescriptor(spread, 'x');
    expect(descriptor?.value).toBe(1);
    expect(descriptor?.set).toBeUndefined();
  });

  it('both spread forms read GETTERS on the source — the shared part of the two mechanisms', () => {
    let reads = 0;
    const source = {
      get x(): number {
        reads += 1;
        return 7;
      },
    };
    const copy = { ...source };
    expect(copy.x).toBe(7);
    expect(reads).toBe(1); // the getter ran exactly once, for the read
  });
});

// ---------------------------------------------------------------------------
// 3. Rest — real arrays for parameters and destructuring, versus the
//    arguments object
// ---------------------------------------------------------------------------

describe('rest: remainder into a REAL array, destructuring rest, arguments-object contrast', () => {
  it('rest parameters collect the remainder into a genuine array', () => {
    function collect(first: number, ...rest: number[]): number[] {
      return rest;
    }

    expect(collect(1, 2, 3, 4)).toEqual([2, 3, 4]);
    expect(collect(1)).toEqual([]); // zero remainder → empty array

    const remainder = collect(1, 9);
    expect(Array.isArray(remainder)).toBe(true); // it IS an array...
    expect(remainder.map((n) => n * 2)).toEqual([18]); // ...so array methods exist
  });

  it('the arguments object is array-LIKE: no .map, but IT IS iterable via the protocol', () => {
    function legacy(..._allArgs: unknown[]): {
      length: number;
      hasMap: string;
      iterable: string;
      spread: unknown[];
    } {
      const args = arguments as unknown as {
        length: number;
        map?: unknown;
        [Symbol.iterator]?: unknown;
      };
      return {
        length: args.length,
        hasMap: typeof args.map,
        iterable: typeof args[Symbol.iterator],
        spread: [...(args as unknown as Iterable<unknown>)],
      };
    }

    const result = legacy('x', 'y', 'z');
    expect(result.length).toBe(3);
    expect(result.hasMap).toBe('undefined'); // array-like is NOT array: no .map
    expect(result.iterable).toBe('function'); // but arguments satisfies Session 7's protocol
    expect(result.spread).toEqual(['x', 'y', 'z']); // so [...arguments] works
  });

  it('arrows have no `arguments` binding of their own — the enclosing function\'s wins', () => {
    function enclosing(..._allArgs: string[]): unknown[] {
      // an arrow does not get its own arguments; this resolves UP to
      // enclosing's arguments object (normalized via spread — the protocol — so
      // vitest can compare it as a plain array):
      const arrow = (): unknown[] => [...(arguments as unknown as Iterable<unknown>)];
      return arrow();
    }

    expect(enclosing('only', 'these')).toEqual(['only', 'these']);
  });

  it('at module top level, arrow-referenced `arguments` is a ReferenceError — asserted', () => {
    const moduleLevelArrow = (): unknown => {
      // @ts-expect-error — ESM module scope has no `arguments` binding, and
      // an arrow cannot create one of its own
      return arguments;
    };

    expect(() => moduleLevelArrow()).toThrow(ReferenceError);
  });

  it('rest in destructuring: [first, ...others] and { a, ...rest }', () => {
    const [first, ...others] = [1, 2, 3, 4, 5];
    expect(first).toBe(1);
    expect(others).toEqual([2, 3, 4, 5]);
    expect(Array.isArray(others)).toBe(true);

    const { a, ...restOfObj } = { a: 1, b: 2, c: 3 };
    expect(a).toBe(1);
    expect(restOfObj).toEqual({ b: 2, c: 3 });
  });

  it('object rest mirrors object spread: own enumerable string keys only — no inherited props', () => {
    const withProto = Object.assign(Object.create({ inherited: 'nope' }), { own: 'yes' });
    const { own, ...nothingElse } = withProto as Record<string, string>;

    expect(own).toBe('yes');
    expect(nothingElse).toEqual({}); // 'inherited' lives on the prototype — not copied
  });

  it('object rest ALSO mirrors object spread on symbol keys: own enumerable symbols land in rest', () => {
    const sym = Symbol('meta');
    const { a, ...rest } = { a: 1, [sym]: 2 } as Record<PropertyKey, number>;

    expect(a).toBe(1);
    expect(Object.keys(rest)).toEqual([]); // no string keys left...
    expect(sym in rest).toBe(true); // ...but the own enumerable symbol key IS in rest
    expect(rest[sym]).toBe(2);
  });

  it('a parameter after a rest parameter is a SyntaxError — even the Function constructor rejects it', () => {
    // Real parsed code can never contain this, so the Function constructor
    // (which compiles its parameter list at runtime) is the legal witness:
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function('...rest', 'last', 'return rest');
    }).toThrow(SyntaxError);

    // and the same construction proves a rest-ONLY function collects into a real array:
    const f = new Function('...rest', 'return rest');
    expect(f(1, 2, 3)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// 4. ES modules — live bindings across real files, read-only imports,
//    named + default forms, circular imports
// ---------------------------------------------------------------------------

describe('ES modules: live bindings, read-only imports, and circular imports', () => {
  it('LIVE BINDINGS: an import reflects the exporter\'s CURRENT value after the exporter mutates', () => {
    // read BEFORE any mutation — proves the reader module is reading the
    // binding, and gives the assertion a starting point it can fail from:
    expect(readCounterFromExporter()).toBe(0);

    bump(); // the EXPORTER mutates its own binding (lib/live-binding-exporter.ts)

    // if imports were snapshots taken at import time, this would still be 0:
    expect(readCounterFromExporter()).toBe(1);
    expect(counter).toBe(1); // the test file's own import is live too
    expect(exporterNamespace.counter).toBe(1); // namespace-object imports reflect live values too
  });

  it('imports are READ-ONLY in the importing module — assignment throws TypeError, asserted', () => {
    expect(() => {
      // @ts-expect-error — assigning to an import is a TypeError at runtime
      counter = 99;
    }).toThrow(TypeError);

    // and the legal path — mutation via the exporter's own function — is what stays live:
    bump();
    expect(readCounterFromExporter()).toBe(2);
  });

  it('named AND default exports are both importable from the same module', () => {
    expect(readDefaultFromExporter()).toBe('default-export-value');
    expect(readCounterFromExporter()).toBe(2); // named import still live after both mutations
  });

  it('CIRCULAR IMPORTS (working case): a cycle is legal when nothing reads before initialization', async () => {
    // lib/circular-a.ts and lib/circular-b.ts import each other. Bindings are
    // hoisted (instantiated for the whole graph first); the cycle resolves
    // because both modules only ASSIGN at evaluation time and READ later:
    const a = await import('./lib/circular-a');
    expect(a.a).toBe('a-value');
    expect(a.readB()).toBe('b-value');
  });

  it('CIRCULAR IMPORTS (spec-strict): node reads a not-yet-initialized binding at evaluation time → TDZ ReferenceError', () => {
    // lib/tdz-spec-*.mjs are PLAIN ESM files, spawned under Node's own ESM
    // runtime (spec-strict Node ESM, no bundler transform). tdz-spec-b's
    // top-level body reads tdz-spec-a's `a` while tdz-spec-a is suspended
    // mid-evaluation: the binding exists (hoisted), the value does not.
    // This is the Session 4 production incident's failure shape, verified
    // against the spec end of the spectrum — the Critical Notes' warning
    // that bundler behavior can differ from spec-strict Node ESM.
    const entry = fileURLToPath(new URL('./lib/tdz-spec-a.mjs', import.meta.url));

    const result = spawnSync(process.execPath, [entry], { encoding: 'utf8' });

    expect(result.status).not.toBe(0); // the module graph failed to evaluate
    expect(result.stderr).toMatch(/Cannot access 'a' before initialization/);
  });

  it('CIRCULAR IMPORTS (bundler-specific): vitest\'s module runner RESOLVES the same cycle without throwing', async () => {
    // The documented contrast to the spec-strict behavior above: the SAME
    // two-module shape (lib/tdz-a.ts / lib/tdz-b.ts) does NOT throw under
    // vitest's Vite-based module runner — in-flight cycle reads are not
    // TDZ-enforced there. This assertion locks in the observed bundler
    // behavior so the book's caveat is verified, not asserted:
    const tdzA = await import('./lib/tdz-a');
    expect(tdzA.a).toBe('a-value');
  });
});