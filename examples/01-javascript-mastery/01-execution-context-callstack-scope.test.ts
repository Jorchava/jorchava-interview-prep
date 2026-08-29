// examples/01-javascript-mastery/01-execution-context-callstack-scope.test.ts
//
// Verification harness for book/01-javascript-mastery/01-execution-context-
// callstack-scope.md — run via `pnpm test`. These assertions are what
// stand behind Part 3's code samples; the book's excerpts should be
// copy-pasted from here, not retyped.

import { describe, it, expect } from 'vitest';

describe('Hoisting & the temporal dead zone', () => {
  it('var is hoisted and initialized to undefined before its declaration', () => {
    function run() {
      // @ts-expect-error — reading x before its var assignment is the point of this test
      const before = typeof x;
      var x = 5;
      return before;
    }
    expect(run()).toBe('undefined');
  });

  it('let/const are hoisted but left uninitialized in the TDZ', () => {
    function accessBeforeDeclaration() {
      // @ts-expect-error — accessing z before its declaration hits the TDZ; that's the point of this test
      console.log(z);
      let z = 5;
    }
    expect(accessBeforeDeclaration).toThrow(ReferenceError);
  });
});

describe('this — all four binding rules', () => {
  it('implicit binding: a method call binds this to the object it was called on', () => {
    const obj = {
      value: 42,
      getValue() {
        return this.value;
      },
    };
    expect(obj.getValue()).toBe(42);
  });

  it('explicit binding: call/apply/bind override implicit binding', () => {
    function getValue(this: { value: number }) {
      return this.value;
    }
    expect(getValue.call({ value: 7 })).toBe(7);
    expect(getValue.apply({ value: 8 })).toBe(8);
    expect(getValue.bind({ value: 9 })()).toBe(9);
  });

  it('new binding: a constructor call binds this to the new instance', () => {
    class Point {
      x: number;
      constructor(x: number) {
        this.x = x;
      }
    }
    const p = new Point(3);
    expect(p.x).toBe(3);
  });

  it('arrow functions have no this of their own — call/apply/bind on them do nothing', () => {
    const obj = {
      value: 10,
      getArrow() {
        return () => this.value;
      },
    };
    const arrow = obj.getArrow();
    expect(arrow()).toBe(10);

    // Arrow functions ignore attempts to rebind `this` directly on them —
    // there's no `this` slot to overwrite.
    expect(arrow.call({ value: 999 })).toBe(10);
  });

  it('bare class method call with no receiver throws TypeError — this is undefined in strict mode', () => {
    class UserService {
      apiUrl: string;
      token: string;
      constructor(apiUrl: string, token: string) {
        this.apiUrl = apiUrl;
        this.token = token;
      }
      fetchUser(id: string): void {
        void(id);
        console.log(`Fetching from ${this.apiUrl} with token ${this.token}`);
      }
    }

    const service = new UserService('https://api.example.com', 'abc123');
    const bareFetch = service.fetchUser;
    // Default binding in strict mode (classes are strict) — this is undefined,
    // accessing this.apiUrl throws TypeError
    expect(() => bareFetch('user_42')).toThrow(TypeError);
  });
});

describe('TDZ — specific named cases (Session 1 Fix-Up)', () => {
  it('accessLetEarly throws ReferenceError — let in TDZ', () => {
    function accessLetEarly(): void {
      // @ts-expect-error — accessing b before its declaration hits the TDZ; that's the point of this test
      console.log(b);
      let b = 20;
    }
    expect(accessLetEarly).toThrow(ReferenceError);
  });

  it('accessConstEarly throws ReferenceError — const in TDZ', () => {
    function accessConstEarly(): void {
      // @ts-expect-error — accessing c before its declaration hits the TDZ; that's the point of this test
      console.log(c);
      const c = 30;
    }
    expect(accessConstEarly).toThrow(ReferenceError);
  });

  it('accessClassEarly throws ReferenceError — class in TDZ', () => {
    function accessClassEarly(): void {
      // @ts-expect-error — accessing the class before its declaration hits the TDZ; that's the point of this test
      new MyClass();
      class MyClass {
        value: number;
        constructor() {
          this.value = 1;
        }
      }
    }
    expect(accessClassEarly).toThrow(ReferenceError);
  });

  it('typeofInTDZ throws ReferenceError — typeof does not protect against TDZ', () => {
    function typeofInTDZ(): void {
      // @ts-expect-error — typeof does not protect against the TDZ; that's the point of this test
      console.log(typeof x);
      let x = 1;
    }
    expect(typeofInTDZ).toThrow(ReferenceError);
  });

  it('shadowingTDZ throws ReferenceError — inner binding creates TDZ across the block', () => {
    function shadowingTDZ(): void {
      const value = 'outer';
      {
        // @ts-expect-error — the inner const shadows the outer one, so this read hits the inner TDZ; that's the point of this test
        console.log(value);
        const value = 'inner';
      }
    }
    expect(shadowingTDZ).toThrow(ReferenceError);
  });
});
