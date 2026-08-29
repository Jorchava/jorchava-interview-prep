// examples/01-javascript-mastery/05-event-loop-microtasks-macrotasks.test.ts
//
// Verification harness for book/01-javascript-mastery/05-event-loop-microtasks-macrotasks.md
// Run via `pnpm test`.
//
// What's tested here: every ordering claim the session makes is asserted on a
// full logged sequence array — not on individual isolated calls. If the
// interleaving is wrong anywhere, the toEqual() on the whole array fails.
// The load-bearing claims:
//   1. synchronous code always runs to completion before ANY queued callback
//   2. the event loop runs exactly ONE macrotask per iteration, and the
//      entire microtask queue drains between tasks — including microtasks
//      queued BY a running microtask (the claim the prompt flags as the most
//      commonly misstated one)
//   3. async/await resumptions interleave FIFO with plain .then() callbacks
//      on the same microtask queue — await is sugar over promises
//   4. await always yields, even when the awaited value is not a promise
//   5. (Node aside, verified rather than asserted) process.nextTick is a
//      separate queue from the promise microtask queue, with precedence that
//      depends on module context

import { describe, it, expect } from 'vitest';

// Give every queued 0ms timer a chance to fire before asserting. 120ms is
// orders of magnitude beyond any 0ms timer delay (and beyond the 4ms
// clamping rule), but far below any test-timeout threshold.
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 120));
}

// ---------------------------------------------------------------------------
// 1. The event loop mechanism — synchronous code runs to completion first
// ---------------------------------------------------------------------------

describe('The event loop: synchronous code runs to completion first', () => {
  it('sync statements run before any queued callback, even callbacks scheduled earlier', async () => {
    const order: string[] = [];

    order.push('sync-1');
    setTimeout(() => order.push('macrotask'), 0);
    Promise.resolve().then(() => order.push('microtask'));
    order.push('sync-2');

    await settle();

    // The timer was SCHEDULED before the microtask was scheduled, and both
    // were scheduled before 'sync-2' ran. Scheduling order is irrelevant —
    // the running synchronous block always finishes first, then the
    // microtask queue drains, then the task queue is consulted.
    expect(order).toEqual(['sync-1', 'sync-2', 'microtask', 'macrotask']);
  });
});

// ---------------------------------------------------------------------------
// 2. Macrotasks — one task per iteration, full microtask drain between tasks
// ---------------------------------------------------------------------------

describe('Macrotasks: one task per iteration, microtasks drain between tasks', () => {
  it('microtasks queued BEFORE any timer, and DURING a running timer callback, both run before the NEXT timer', async () => {
    const order: string[] = [];

    setTimeout(() => {
      order.push('t1');
      // Queued while t1 is running — must still run before t2, because the
      // event loop drains the entire microtask queue after EVERY task.
      queueMicrotask(() => order.push('t1-micro'));
    }, 0);
    setTimeout(() => order.push('t2'), 0);
    queueMicrotask(() => order.push('pre-micro'));
    Promise.resolve().then(() => order.push('pre-promise'));

    await settle();

    expect(order).toEqual(['pre-micro', 'pre-promise', 't1', 't1-micro', 't2']);
  });
});

// ---------------------------------------------------------------------------
// 3. Microtasks — THE full-drain claim: microtasks queued during the drain
// ---------------------------------------------------------------------------

describe('Microtasks: the entire queue drains before the next macrotask', () => {
  it('a microtask queued from inside a running microtask still runs before a macrotask that was queued FIRST', async () => {
    const order: string[] = [];

    // The timer is queued before ANY microtask exists. If the event loop
    // interleaved fairly, this timer would be the first thing to run after
    // the initial microtasks. It is not — every microtask queued during the
    // drain, at any nesting depth, runs before it.
    setTimeout(() => order.push('timer'), 0);

    queueMicrotask(() => {
      order.push('mt-1');
      queueMicrotask(() => {
        order.push('mt-1.1');
        queueMicrotask(() => order.push('mt-1.1.1'));
      });
    });
    Promise.resolve().then(() => order.push('promise-1'));

    await settle();

    expect(order).toEqual(['mt-1', 'promise-1', 'mt-1.1', 'mt-1.1.1', 'timer']);
  });

  it('queueMicrotask and Promise reactions share one FIFO queue in scheduling order', async () => {
    const order: string[] = [];

    queueMicrotask(() => order.push('qm-1'));
    Promise.resolve().then(() => order.push('p-1'));
    queueMicrotask(() => order.push('qm-2'));
    Promise.resolve().then(() => order.push('p-2'));
    Promise.resolve().then(() => order.push('p-3'));

    await settle();

    expect(order).toEqual(['qm-1', 'p-1', 'qm-2', 'p-2', 'p-3']);
  });

  it('a microtask chain that never yields to the task queue starves timers', async () => {
    const order: string[] = [];

    // The classic starvation shape: each microtask queues the next one, so
    // the drain never ends and the timer (a macrotask) never runs within a
    // bounded number of iterations. Bounded here for the test, unbounded in
    // the real bug — a recursive queueMicrotask loop freezes the page.
    setTimeout(() => order.push('timer'), 0);
    let depth = 0;
    const recurse = (): void => {
      order.push(`micro-${depth}`);
      depth += 1;
      if (depth <= 5) {
        queueMicrotask(recurse);
      }
    };
    recurse();

    await settle();

    expect(order).toEqual(['micro-0', 'micro-1', 'micro-2', 'micro-3', 'micro-4', 'micro-5', 'timer']);
  });
});

// ---------------------------------------------------------------------------
// 4. async/await as promise sugar — await resumption is a microtask
// ---------------------------------------------------------------------------

describe('async/await: resumption is a microtask, identical to .then()', () => {
  it('an async function interleaves FIFO with raw .then() chains and beats a timer scheduled first', async () => {
    const order: string[] = [];

    async function asyncChain(): Promise<void> {
      order.push('async-1');
      await Promise.resolve();
      order.push('async-2');
      await Promise.resolve();
      order.push('async-3');
    }

    function thenChain(): Promise<void> {
      order.push('then-1');
      return Promise.resolve()
        .then(() => {
          order.push('then-2');
        })
        .then(() => {
          order.push('then-3');
        });
    }

    // Both bodies run synchronously up to their first boundary, in call
    // order: async-1, then-1. Then each boundary is a microtask on the same
    // queue, so the resumptions interleave FIFO: async-2, then-2, async-3,
    // then-3. The timer is a macrotask and runs after all of them.
    asyncChain();
    thenChain();
    setTimeout(() => order.push('timer'), 0);

    await settle();

    expect(order).toEqual(['async-1', 'then-1', 'async-2', 'then-2', 'async-3', 'then-3', 'timer']);
  });

  it('await always yields a microtask, even when the awaited value is not a promise', async () => {
    const order: string[] = [];

    async function f(): Promise<void> {
      order.push('f-start');
      await 1; // plain value — still a boundary: resume is a microtask
      order.push('f-after-await');
    }

    f();
    order.push('sync-after-call');
    setTimeout(() => order.push('timer'), 0);

    await settle();

    expect(order).toEqual(['f-start', 'sync-after-call', 'f-after-await', 'timer']);
  });
});

// ---------------------------------------------------------------------------
// 5. Node aside — process.nextTick vs the promise microtask queue
// ---------------------------------------------------------------------------
//
// Browser-focused book, but the prompt requires: if Node specifics are
// covered at all, verify the precedence directly instead of asserting it.
// The assertion below is the OBSERVED behavior of this exact runtime
// (vitest on Node, ESM). It is not a claim about browsers — Node has no
// process.nextTick equivalent there — and it is not even uniform across
// Node itself: the Node docs document that in CJS modules nextTick
// callbacks run before promise microtasks, while in ESM modules the
// promise microtasks already being drained run first.

describe('Node aside: process.nextTick is a separate queue from promise microtasks', () => {
  it('in this ESM-driven runtime, promise microtasks queued during the drain run before nextTick callbacks', async () => {
    const order: string[] = [];

    process.nextTick(() => {
      order.push('nt-1');
      process.nextTick(() => order.push('nt-1.1'));
    });
    Promise.resolve().then(() => order.push('p-1'));
    Promise.resolve().then(() => order.push('p-2'));

    await settle();

    // Observed in this runtime (vitest, ESM): the test body runs while the
    // promise microtask queue is already being drained, so p-1 and p-2
    // complete that drain before the nextTick queue is touched.
    expect(order).toEqual(['p-1', 'p-2', 'nt-1', 'nt-1.1']);
  });
});
