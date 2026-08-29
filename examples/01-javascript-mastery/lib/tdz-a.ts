// examples/01-javascript-mastery/lib/tdz-a.ts
//
// The crashing half of the circular-import pair — a deliberate demo of
// the spec's hoisting-done-right boundary. Evaluation order when this
// module is the entry:
//   1. tdz-a starts evaluating
//   2. its import of tdz-b begins that module's evaluation
//   3. tdz-b's import of tdz-a hits the cycle — tdz-a's bindings EXIST
//      (instantiated) but `a` is not yet initialized (its initializer
//      hasn't run; tdz-a's body hasn't executed at all)
//   4. tdz-b's top-level body READS `a` → TDZ ReferenceError
//   5. tdz-b's evaluation fails, tdz-a's fails with it — the dynamic
//      import in the test rejects
//
// This is exactly the failure shape of the Session 4 production incident
// (04-prototypes-classes-inheritance.md): a class binding read at module
// evaluation time, before its initializer ran.

import { b } from './tdz-b';

export let a = 'a-value';

export function readB(): string {
  return b;
}