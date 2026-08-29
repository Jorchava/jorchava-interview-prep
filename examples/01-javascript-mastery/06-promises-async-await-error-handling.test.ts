// examples/01-javascript-mastery/06-promises-async-await-error-handling.test.ts
//
// Verification harness for book/01-javascript-mastery/06-promises-async-await-error-handling.md
// Run via `pnpm test`.
//
// What's tested here, carried forward from Session 5's standard: ordering and
// rejection claims are asserted on FULL logged sequence arrays, not on
// individual toThrow() checks. If an interleaving is wrong anywhere, the
// toEqual() on the whole array fails.
//
// The load-bearing claims:
//   1. a .then() attached to an ALREADY-SETTLED promise still runs as a
//      microtask — never synchronously (the same rule as Session 5's
//      "await always yields")
//   2. settlement is immutable — the value is the same for handlers attached
//      before and after settlement
//   3. .then() return values flatten: plain value, promise, thenable — all
//      through the SAME adoption machinery. Verified: the resolution
//      protocol reads and calls the returned object's .then (spec:
//      Promise Resolve Functions → Get(resolution,"then") →
//      NewPromiseResolveThenableJob), even for native promises — an
//      instrumented .then on a native promise is invoked, and the value
//      flows through it. A throw routes to the next rejection handler.
//   4. a rejected promise awaited in try/catch throws at the await
//      expression and is caught like a synchronous throw — with the full
//      sequence asserted, not just the catch firing
//   5. .finally() runs on both the fulfillment and the rejection path
//      without swallowing either the value or the reason
//   6. the combinators: all (fail fast), allSettled (never rejects),
//      race (first SETTLEMENT wins, rejection included), any (first
//      fulfillment; AggregateError only if everything rejects) — and race
//      attaches reactions to every participant, so a late-rejecting loser
//      is handled, not an unhandled rejection
//   7. unhandled rejections are OBSERVABLE: process 'unhandledRejection'
//      fires with the reason. The listener is registered and removed
//      (process.off) within the same test. Vitest's own worker handler
//      skips reporting when another listener is present (verified in
//      vitest source: `if (processListeners(event).length > 1) return`),
//      so the in-process rejection is safe; the FULL suite is run after
//      this file to confirm no listener leaks into other tests.
//   8. Error subclassing (building on Session 4) preserves instanceof and
//      fixes name; the `cause` option preserves the wrapped error.

import { describe, it, expect } from 'vitest';

async function wait(ms = 60): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. The promise state machine — settlement is immutable, reactions are
//    always microtasks
// ---------------------------------------------------------------------------

describe('The promise state machine: immutable settlement, always-async reactions', () => {
  it('a .then() attached to an already-settled promise still runs as a microtask, never synchronously', async () => {
    const order: string[] = [];

    const p = Promise.resolve('ready');
    order.push('sync-before');
    p.then((v) => order.push(`then:${v}`));
    order.push('sync-after');
    setTimeout(() => order.push('timer'), 0);

    await wait();

    // 'then:ready' must run after BOTH sync lines — the reaction was queued,
    // not executed — and before the timer, because a queued reaction is a
    // microtask and outranks every macrotask. Settlement happened long ago;
    // that does not make the reaction synchronous.
    expect(order).toEqual(['sync-before', 'sync-after', 'then:ready', 'timer']);
  });

  it('a settled promise keeps its value forever — the same value for handlers attached at any time', async () => {
    const order: string[] = [];

    const p = Promise.resolve('once');
    p.then((v) => order.push(`early:${v}`));
    await wait();
    p.then((v) => order.push(`late:${v}`)); // attached after settlement
    await wait();

    expect(order).toEqual(['early:once', 'late:once']);
  });
});

// ---------------------------------------------------------------------------
// 2. .then() return-value handling — flattening and error routing
// ---------------------------------------------------------------------------

describe('.then() return values: flattening and throw routing', () => {
  it('plain values, promises, and thenables all flatten; a throw routes to the next rejection handler', async () => {
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
        return Promise.resolve('promise-flattened'); // native promise: adopted directly
      })
      .then((v) => {
        order.push(v);
        return thenable; // thenable: adopted through a call to its .then
      })
      .then((v) => {
        order.push(v);
        throw new Error('routed'); // throw: rejects the returned promise
      })
      .then(undefined, (e: unknown) => {
        // .catch is sugar for exactly this call shape
        order.push(`caught:${(e as Error).message}`);
        return 'recovered'; // a rejection handler that returns a value recovers the chain
      })
      .then((v) => {
        order.push(`final:${v}`);
      });

    expect(order).toEqual([
      'start',
      'promise-flattened',
      'thenable-then-called',
      'thenable-flattened',
      'caught:routed',
      'final:recovered',
    ]);
  });

  it('the thenable protocol runs in the drain: the returned object\'s .then is invoked between the two links', async () => {
    const order: string[] = [];

    const thenable = {
      then(resolve: (value: string) => void): void {
        order.push('thenable-then-called');
        resolve('t');
      },
    } as unknown as PromiseLike<string>;

    // Baseline: two consecutive links in a chain are consecutive microtasks.
    await Promise.resolve()
      .then(() => order.push('plain-1'))
      .then(() => order.push('plain-2'));

    // When a link returns an object with a callable then, the adoption job
    // runs inside the same drain, between the two links: the thenable's
    // .then is invoked, and only after it resolves the chain does the next
    // link run.
    await Promise.resolve()
      .then(() => order.push('thenable-1'))
      .then(() => thenable)
      .then(() => order.push('thenable-2'));

    expect(order).toEqual(['plain-1', 'plain-2', 'thenable-1', 'thenable-then-called', 'thenable-2']);
  });

  it('a returned promise is adopted through the thenable protocol — its .then IS called with the resolution functions', async () => {
    const order: string[] = [];
    const calls: string[] = [];

    // Instrument a NATIVE promise's own then property. The adoption
    // machinery (spec: Promise Resolve Functions → Get(resolution,"then") →
    // NewPromiseResolveThenableJob) reads and calls it. If the chain had a
    // fast path that adopted native promises from internal slots directly,
    // this override would never fire and the value would not flow through it.
    const native = Promise.resolve('native');
    Object.defineProperty(native, 'then', {
      configurable: true,
      value: function (this: unknown, onFulfilled: (value: string) => void): void {
        calls.push('then-called');
        onFulfilled('native');
      },
    });

    await Promise.resolve()
      .then(() => native)
      .then((v) => order.push(`adopted:${v}`));

    expect(order).toEqual(['adopted:native']);
    expect(calls).toEqual(['then-called']);
  });
});

// ---------------------------------------------------------------------------
// 3. The combinators — interview depth, not implementation
// ---------------------------------------------------------------------------

describe('Promise combinators: settle semantics, not implementations', () => {
  it('Promise.all resolves in input order and fails fast on the first rejection', async () => {
    const order: string[] = [];

    const slow = new Promise<string>((resolve) => {
      setTimeout(() => {
        order.push('slow-settled');
        resolve('slow');
      }, 60);
    });
    const fast = new Promise<string>((_, reject) => {
      setTimeout(() => {
        order.push('fast-rejected');
        reject(new Error('first failure'));
      }, 10);
    });

    const result = await Promise.all([slow, fast]).catch((e: unknown) => {
      order.push(`all-rejected:${(e as Error).message}`);
      return 'caught';
    });
    order.push(`result:${result}`);

    await wait(120); // let the slow promise's 60ms timer settle before asserting

    // Fail-fast: the all() settled at 10ms on the rejection, while the slow
    // promise would have fulfilled at 60ms. The slow promise still settles
    // (its callback runs) but the all() already rejected.
    expect(order).toEqual(['fast-rejected', 'all-rejected:first failure', 'result:caught', 'slow-settled']);
  });

  it('Promise.allSettled never rejects — every outcome becomes a status, in input order', async () => {
    const results = await Promise.allSettled([
      Promise.resolve('a'),
      Promise.reject(new Error('b')),
      Promise.resolve('c'),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);

    const fulfilledValues = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    const rejectedReasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason as Error).message);

    expect(fulfilledValues).toEqual(['a', 'c']);
    expect(rejectedReasons).toEqual(['b']);
  });

  it('Promise.race settles with the first SETTLEMENT — a rejection wins if it arrives first', async () => {
    const order: string[] = [];

    const first = new Promise<string>((_, reject) => {
      setTimeout(() => {
        order.push('first-settled');
        reject(new Error('first one lost'));
      }, 10);
    });
    const second = new Promise<string>((resolve) => {
      setTimeout(() => {
        order.push('second-settled');
        resolve('second');
      }, 60);
    });

    const result = await Promise.race([first, second]).catch((e: unknown) => `caught:${(e as Error).message}`);
    order.push(`race-result:${result}`);

    await wait(120); // let the second promise's 60ms timer settle before asserting

    expect(order).toEqual(['first-settled', 'race-result:caught:first one lost', 'second-settled']);
  });

  it('Promise.race attaches reactions to every participant — a late-rejecting loser is handled, not unhandled', async () => {
    const order: string[] = [];

    const onUnhandled = (reason: unknown): void => {
      order.push(`unhandled:${(reason as Error).message}`);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const winner = new Promise<string>((resolve) => {
        setTimeout(() => resolve('fast'), 10);
      });
      const loser = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('late loser')), 40);
      });

      const result = await Promise.race([winner, loser]);
      order.push(`race:${result}`);

      await wait(80); // let the loser's rejection land AFTER the race settled
      order.push('loser-rejected-in-silence');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    // race() internally attaches reactions to every input, so the loser's
    // rejection at 40ms is handled by the race machinery. If race only
    // watched the winner, this array would contain 'unhandled:late loser'.
    expect(order).toEqual(['race:fast', 'loser-rejected-in-silence']);
  });

  it('Promise.any resolves with the first fulfillment; AggregateError only when everything rejects', async () => {
    const winner = await Promise.any([
      Promise.reject(new Error('cdn-a down')),
      Promise.resolve('cdn-b ok'),
    ]);
    expect(winner).toEqual('cdn-b ok');

    const aggregate = await Promise.any([Promise.reject(new Error('x')), Promise.reject(new Error('y'))]).then(
      () => 'resolved?!',
      (e: unknown) => (e instanceof AggregateError ? `aggregate:${e.errors.length}` : 'other'),
    );
    expect(aggregate).toEqual('aggregate:2');
  });
});

// ---------------------------------------------------------------------------
// 4. async/await error handling — a rejection becomes a throwable exception
// ---------------------------------------------------------------------------

describe('async/await: a rejected awaited promise throws at the await expression', () => {
  it('the rejection is caught exactly like a synchronous throw — full sequence asserted', async () => {
    const order: string[] = [];

    async function fetchUser(): Promise<string> {
      order.push('fetch-start');
      return Promise.reject(new Error('network down'));
    }

    async function loadProfile(): Promise<void> {
      order.push('load-start');
      try {
        const user = await fetchUser();
        order.push(`user:${user}`); // never runs — the await throws
      } catch (e: unknown) {
        order.push(`thrown-at-await:${(e as Error).message}`);
      }
      order.push('load-continues'); // control flow resumes past the catch
    }

    await loadProfile();
    order.push('test-continues');

    // 'load-start' and 'fetch-start' run synchronously; the rejection crosses
    // the await boundary as a microtask (Session 5's mechanics), then throws
    // INSIDE the try, so the catch handles it like a sync throw.
    expect(order).toEqual(['load-start', 'fetch-start', 'thrown-at-await:network down', 'load-continues', 'test-continues']);
  });

  it('a throw from synchronous code inside the same try is caught by the same catch — uniform handling', async () => {
    const order: string[] = [];

    async function run(): Promise<void> {
      try {
        const parsed = JSON.parse('{bad json'); // sync throw, before any await
        order.push(`parsed:${parsed}`);
        await Promise.resolve('unreached');
      } catch (e: unknown) {
        order.push(`caught:${(e as SyntaxError).name}`);
      }
    }

    await run();

    expect(order).toEqual(['caught:SyntaxError']);
  });
});

// ---------------------------------------------------------------------------
// 5. .finally() — runs on both paths, swallows neither
// ---------------------------------------------------------------------------

describe('.finally(): both paths, no swallowing', () => {
  it('the cleanup runs on fulfillment and rejection, preserving value and reason', async () => {
    const order: string[] = [];

    await Promise.resolve('kept')
      .finally(() => {
        order.push('fulfill-cleanup');
      })
      .then((v) => {
        order.push(`after-finally:${v}`); // value still passes through
      });

    await Promise.reject(new Error('kept reason'))
      .finally(() => {
        order.push('reject-cleanup');
      })
      .catch((e: unknown) => {
        order.push(`after-finally-caught:${(e as Error).message}`); // reason still propagates
      });

    expect(order).toEqual([
      'fulfill-cleanup',
      'after-finally:kept',
      'reject-cleanup',
      'after-finally-caught:kept reason',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 6. Unhandled rejections — observable, and cleaned up within this file
// ---------------------------------------------------------------------------
//
// The listener is registered and removed (process.off) in the SAME test, in
// a try/finally. Vitest's own worker handler skips reporting when another
// listener is present at fire time (`processListeners(event).length > 1`),
// which is what makes an in-process unhandled rejection safe here. The full
// suite is re-run after this file to confirm no listener leaks into other
// tests or files.

describe('Unhandled rejections: observable via process events, cleaned up in-test', () => {
  it('an unawaited async failure fires "unhandledRejection" with the reason — the forgotten-await bug', async () => {
    const order: string[] = [];

    const onUnhandled = (reason: unknown): void => {
      order.push(`unhandled:${(reason as Error).message}`);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      async function failsAfterTurn(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 0));
        throw new Error('forgotten await');
      }

      // The production-shaped bug: the call is not awaited and has no .catch.
      void failsAfterTurn();

      await wait(50); // the rejection lands in a microtask drain; the event fires after it
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect(order).toEqual(['unhandled:forgotten await']);
  });

  it('a handler attached after the event fired does not unsend it — "rejectionHandled" fires instead', async () => {
    const order: string[] = [];

    const onUnhandled = (reason: unknown): void => {
      order.push(`unhandled:${(reason as Error).message}`);
    };
    const onHandled = (): void => {
      order.push('handled-too-late');
    };
    process.on('unhandledRejection', onUnhandled);
    process.on('rejectionHandled', onHandled);
    try {
      const p = Promise.reject(new Error('late catch'));

      // Attached after the event-loop turn in which the rejection went
      // unhandled: the event has already fired; this only stops the process
      // from considering the rejection permanently unhandled.
      setTimeout(() => {
        p.catch(() => undefined);
      }, 10);

      await wait(50);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      process.off('rejectionHandled', onHandled);
    }

    expect(order).toEqual(['unhandled:late catch', 'handled-too-late']);
  });
});

// ---------------------------------------------------------------------------
// 7. Custom Error subclasses and the cause option — building on Session 4
// ---------------------------------------------------------------------------

describe('Custom Error subclasses and `cause` (Session 4 follow-up, now in depth)', () => {
  it('subclassing Error preserves instanceof and fixes the name, while keeping stack semantics', () => {
    class ApiError extends Error {
      constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'ApiError';
      }
    }

    const err = new ApiError('user fetch failed');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('user fetch failed');
    expect(err.stack).toContain('ApiError');
  });

  it('the cause option wraps a low-level error without losing it', async () => {
    class ApiError extends Error {
      constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'ApiError';
      }
    }

    async function fetchFromGateway(): Promise<string> {
      throw new Error('socket hang up');
    }

    async function loadUser(): Promise<string> {
      try {
        return await fetchFromGateway();
      } catch (e: unknown) {
        throw new ApiError('user fetch failed', { cause: e });
      }
    }

    const caught = await loadUser().catch((e: unknown) => e);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as Error).message).toBe('user fetch failed');
    expect((caught as Error).cause).toBeInstanceOf(Error);
    expect(((caught as Error).cause as Error).message).toBe('socket hang up');
  });
});
