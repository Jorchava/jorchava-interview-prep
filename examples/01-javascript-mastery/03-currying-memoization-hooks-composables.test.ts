// examples/01-javascript-mastery/03-currying-memoization-hooks-composables.test.ts
//
// Verification harness for book/01-javascript-mastery/03-currying-memoization-hooks-composables.md
// Run via `pnpm test`.
//
// What's tested here: curry (generic implementation), memoize (generic implementation,
// including object-argument cache-key problem), and a plain-TS simulation of React's
// stale-closure mechanism. React/Vue hook and composable examples in the book are
// illustrative and not executed against framework test harnesses — per the session's
// scope boundary, full @testing-library/react and @vue/test-utils setup belongs to
// Modules 7-8.

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Curry
// ---------------------------------------------------------------------------

function curry<T extends (...args: any[]) => any>(fn: T) {
  const arity = fn.length;
  return function curried(...args: any[]) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  };
}

describe('Currying', () => {
  it('transforms f(a, b, c) into f(a)(b)(c)', () => {
    const sum = (a: number, b: number, c: number) => a + b + c;
    const curriedSum = curry(sum);

    expect(curriedSum(1)(2)(3)).toBe(6);
  });

  it('supports partial application — multiple args at once', () => {
    const sum = (a: number, b: number, c: number) => a + b + c;
    const curriedSum = curry(sum);

    expect(curriedSum(1, 2)(3)).toBe(6);
    expect(curriedSum(1)(2, 3)).toBe(6);
    expect(curriedSum(1, 2, 3)).toBe(6);
  });

  it('each partial application returns a new function until all args supplied', () => {
    const multiply = (a: number, b: number, c: number) => a * b * c;
    const curriedMultiply = curry(multiply);

    const step1 = curriedMultiply(2);     // expects (b, c)
    const step2 = step1(3);               // expects (c)
    expect(step2(4)).toBe(24);
  });

  it('produces independent partial applications from different starting args', () => {
    const multiply = (a: number, b: number, c: number) => a * b * c;
    const curriedMultiply = curry(multiply);

    const double = curriedMultiply(2);
    const triple = curriedMultiply(3);

    expect(double(3, 4)).toBe(24);
    expect(triple(3, 4)).toBe(36);
  });

  it('works with functions of different arities', () => {
    const add = (a: number, b: number) => a + b;
    const greet = (greeting: string, name: string, punctuation: string) =>
      `${greeting}, ${name}${punctuation}`;

    expect(curry(add)(5)(3)).toBe(8);
    expect(curry(greet)('Hello')('Alice')('!')).toBe('Hello, Alice!');
  });

  it('calls the function when more args than arity are supplied', () => {
    const add = (a: number, b: number) => a + b;
    // JS functions ignore extra args by default
    expect(curry(add)(1, 2, 999)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

function compose<T>(f: (x: T) => T, g: (x: T) => T): (x: T) => T {
  return (x: T) => f(g(x));
}

describe('Compose', () => {
  it('composes two unary functions right-to-left', () => {
    const add1 = (x: number) => x + 1;
    const double = (x: number) => x * 2;

    const doubleThenAdd1 = compose(add1, double);
    expect(doubleThenAdd1(5)).toBe(11); // (5 * 2) + 1
  });

  it('compose(f, g)(x) === f(g(x))', () => {
    const f = (x: number) => x * 3;
    const g = (x: number) => x + 2;

    expect(compose(f, g)(4)).toBe(f(g(4))); // (4 + 2) * 3 === 18
  });
});

// ---------------------------------------------------------------------------
// Memoization
// ---------------------------------------------------------------------------

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

function memoizeByRef<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<any[], ReturnType<T>>();
  const memoized = (...args: any[]): ReturnType<T> => {
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

describe('Memoization', () => {
  it('caches results for primitive arguments', () => {
    let callCount = 0;
    const sum = (a: number, b: number) => {
      callCount++;
      return a + b;
    };
    const memoized = memoize(sum);

    // First call — executes the function
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);

    // Second call with same args — cache hit
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);

    // New args — executes again
    expect(memoized(3, 4)).toBe(7);
    expect(callCount).toBe(2);
  });

  it('cache-key problem: same content, different instance — cache hit via JSON.stringify', () => {
    let callCount = 0;
    const fn = (obj: { x: number; y: number }) => {
      callCount++;
      return obj.x + obj.y;
    };
    const memoized = memoize(fn);

    // Two different object instances with same content and same key order
    expect(memoized({ x: 1, y: 2 })).toBe(3);
    expect(callCount).toBe(1);

    expect(memoized({ x: 1, y: 2 })).toBe(3);
    // Cache hit — JSON.stringify produces the same key for both instances
    // because the literal keys are in the same insertion order
    expect(callCount).toBe(1);
  });

  it('cache-key problem: different key order causes cache miss', () => {
    let callCount = 0;
    const fn = (obj: { x: number; y: number }) => {
      callCount++;
      return obj.x + obj.y;
    };
    const memoized = memoize(fn);

    // First call with keys in one order
    expect(memoized({ x: 1, y: 2 })).toBe(3);
    expect(callCount).toBe(1);

    // Same content but keys in reverse insertion order
    // JSON.stringify({ y: 2, x: 1 }) !== JSON.stringify({ x: 1, y: 2 })
    expect(memoized({ y: 2, x: 1 })).toBe(3);
    expect(callCount).toBe(2); // cache miss — different key string
  });

  it('returns cached results for repeated calls with the same args', () => {
    let callCount = 0;
    const fn = (a: number, b: number, c: number) => {
      callCount++;
      return a * b * c;
    };
    const memoized = memoize(fn);

    expect(memoized(2, 3, 4)).toBe(24);
    expect(callCount).toBe(1);

    expect(memoized(2, 3, 4)).toBe(24);
    expect(callCount).toBe(1);

    expect(memoized(2, 3, 4)).toBe(24);
    expect(callCount).toBe(1);
  });

  it('memoizeByRef uses O(n) element-wise comparison — works for primitives', () => {
    let callCount = 0;
    const fn = (a: number, b: number) => {
      callCount++;
      return a + b;
    };
    const memoized = memoizeByRef(fn);

    // First call with {args: [1, 2]} — executes fn
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);

    // Second call — new args array, but elements are === to the stored ones
    // So the O(n) scan finds a match and returns cached result
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);
  });

  it('memoizeByRef misses cache for structurally identical object arguments', () => {
    let callCount = 0;
    const fn = (obj: { x: number }) => {
      callCount++;
      return obj.x;
    };
    const memoized = memoizeByRef(fn);

    expect(memoized({ x: 1 })).toBe(1);
    expect(callCount).toBe(1);

    // Different object instance — {x: 1} !== {x: 1}, so cache misses
    expect(memoized({ x: 1 })).toBe(1);
    expect(callCount).toBe(2); // cache miss due to reference inequality on the object
  });
});

// ---------------------------------------------------------------------------
// Stale closures — simulating React's per-render capture in plain TS
// ---------------------------------------------------------------------------

describe('Stale closures — plain TS simulation of React per-render capture', () => {
  it('each call to a function creates an independent scope — closures capture that scope', () => {
    // Each call to `render` creates a new lexical environment with its own `state`,
    // analogous to a React function component executing on each render
    function render(value: number) {
      const state = value; // like useState's destructured value for this render
      return {
        getSnapshot: () => state,
        setState: (n: number) => { /* no-op — each render has its own scope */ },
      };
    }

    const render1 = render(0);
    const render2 = render(100);

    // Each closure captures its own render's state
    expect(render1.getSnapshot()).toBe(0);
    expect(render2.getSnapshot()).toBe(100);
  });

  it('a closure persisted across simulated renders retains the original scope', () => {
    let persistedClosure: (() => number) | null = null;

    function render(value: number) {
      const state = value;
      if (!persistedClosure) {
        // First render: store a closure for later — like a useCallback with empty deps
        persistedClosure = () => state;
      }
      // On subsequent calls, a new `state` variable is created, but the stored
      // closure still references the *first* render's `state` binding
    }

    render(10); // persistedClosure captures state = 10
    expect(persistedClosure!()).toBe(10);

    render(99); // new scope with state = 99, but persistedClosure still has state = 10
    expect(persistedClosure!()).toBe(10); // "stale" — still render 1's value
  });

  it('using a ref-like object avoids the stale closure problem', () => {
    // This simulates useRef in React or ref() in Vue: a persistent object
    // whose property is read through the closure
    function createRef(initial: number) {
      const ref = { current: initial }; // like useRef(0) or ref(0)
      return {
        getSnapshot: () => ref.current,
        createCallback: () => () => ref.current,
        set: (n: number) => { ref.current = n; },
      };
    }

    const renderer = createRef(0);
    const callback = renderer.createCallback(); // captures the ref object

    expect(callback()).toBe(0); // ref.current = 0

    renderer.set(42); // update the ref
    // The callback captures the ref object (stable identity), not the primitive
    // Reading ref.current always gives the current value
    expect(callback()).toBe(42);
  });

});
