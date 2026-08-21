// examples/01-javascript-mastery/02-closures-arc.test.ts
//
// Verification harness for book/01-javascript-mastery/02-closures-arc.md
// Run via `pnpm test`. Every behavior claimed in the book is tested here
// as actual executed code — no commented-out assertions.

import { describe, it, expect } from 'vitest';

describe('Closures — live reference, not snapshot', () => {
  it('a closure sees mutations to captured variables after creation', () => {
    function createCounter() {
      let count = 0;
      return {
        increment: () => ++count,
        read: () => count,
      };
    }

    const counter = createCounter();
    expect(counter.read()).toBe(0);
    counter.increment();
    expect(counter.read()).toBe(1);
  });

  it('two closures created in the same scope share the same binding', () => {
    function sharedBinding() {
      let x = 1;
      return { setX: (v: number) => { x = v; }, a: () => x, b: () => x };
    }

    const { setX, a, b } = sharedBinding();
    expect(a()).toBe(1);
    expect(b()).toBe(1);
    setX(99);
    expect(a()).toBe(99);
    expect(b()).toBe(99);
  });

  it('closures created with var in a loop all see the final value', () => {
    const fns: (() => number)[] = [];
    for (var i = 0; i < 3; i++) {
      fns.push(() => i);
    }
    for (const fn of fns) {
      expect(fn()).toBe(3);
    }
  });

  it('closures created with let in a loop each see their own binding', () => {
    const fns: (() => number)[] = [];
    for (let i = 0; i < 3; i++) {
      fns.push(() => i);
    }
    for (let j = 0; j < fns.length; j++) {
      expect(fns[j]()).toBe(j);
    }
  });
});

describe('Lexical environment — shared retained environment', () => {
  it('methods returned from the same factory share the same private state', () => {
    function makePair() {
      let value = 'default';
      return {
        setValue: (v: string) => { value = v; },
        getValue: () => value,
        resetValue: () => { value = 'default'; },
      };
    }

    const pair = makePair();
    expect(pair.getValue()).toBe('default');
    pair.setValue('modified');
    expect(pair.getValue()).toBe('modified');
    pair.resetValue();
    expect(pair.getValue()).toBe('default');
  });

  it('nested closures capture the full environment chain', () => {
    function outer() {
      const a = 'outer';
      return function middle() {
        const b = 'middle';
        return function inner() {
          return `${a} > ${b}`;
        };
      };
    }

    const middleFn = outer();
    const innerFn = middleFn();
    expect(innerFn()).toBe('outer > middle');
  });
});

describe('Private state via closures', () => {
  it('closure-based encapsulation prevents external access to private variable', () => {
    function createBankAccount(initialBalance: number) {
      let balance = initialBalance;
      return {
        deposit(amount: number): number {
          balance += amount;
          return balance;
        },
        getBalance(): number {
          return balance;
        },
      };
    }

    const account = createBankAccount(100);
    account.deposit(50);
    expect(account.getBalance()).toBe(150);
    // The balance variable is not accessible as a property
    expect((account as any).balance).toBeUndefined();
    // Object.keys should only show methods
    expect(Object.keys(account)).toEqual(['deposit', 'getBalance']);
  });

  it('multiple factory calls produce independent private state', () => {
    function createCounter() {
      let count = 0;
      return {
        increment: () => ++count,
        read: () => count,
      };
    }

    const a = createCounter();
    const b = createCounter();
    a.increment();
    a.increment();
    b.increment();
    expect(a.read()).toBe(2);
    expect(b.read()).toBe(1);
  });

  it('private class fields provide equivalent encapsulation', () => {
    class BankAccount {
      #balance: number;
      constructor(initialBalance: number) {
        this.#balance = initialBalance;
      }
      deposit(amount: number): number {
        this.#balance += amount;
        return this.#balance;
      }
      getBalance(): number {
        return this.#balance;
      }
    }

    const account = new BankAccount(100);
    account.deposit(50);
    expect(account.getBalance()).toBe(150);
    // #balance is not accessible as a property
    expect((account as any).balance).toBeUndefined();
    expect(Object.keys(account)).not.toContain('balance');
  });
});

describe('Module pattern — IIFE encapsulation', () => {
  it('IIFE module pattern creates private scope with controlled public API', () => {
    const CounterModule = (function() {
      let instanceCount = 0;

      return {
        create(initial = 0) {
          let count = initial;
          instanceCount++;
          return {
            increment: () => ++count,
            get: () => count,
          };
        },
        getInstanceCount: () => instanceCount,
      };
    })();

    const c1 = CounterModule.create(10);
    const c2 = CounterModule.create(20);

    expect(c1.increment()).toBe(11);
    expect(c2.increment()).toBe(21);
    expect(CounterModule.getInstanceCount()).toBe(2);
  });

  it('revealing module pattern exposes selected functions', () => {
    const Calculator = (function() {
      function add(a: number, b: number): number {
        return a + b;
      }
      function subtract(a: number, b: number): number {
        return a - b;
      }
      return { add, subtract };
    })();

    expect(Calculator.add(3, 4)).toBe(7);
    expect(Calculator.subtract(10, 3)).toBe(7);
  });
});
