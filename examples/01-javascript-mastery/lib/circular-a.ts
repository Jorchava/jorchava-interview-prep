// examples/01-javascript-mastery/lib/circular-a.ts
//
// The WORKING half of the circular-import pair. A imports a binding from
// B and B imports a binding from A. This cycle is legal because the spec
// hoists (instantiates) every binding in the graph before evaluating any
// module body: by the time either module's code runs, all bindings exist.
// Reads are deferred to function calls that run AFTER evaluation finishes,
// so every binding is initialized by the time it is read.
//
// Evaluation order when this module is the entry:
//   1. circular-a starts evaluating
//   2. its import of circular-b begins that module's evaluation
//   3. circular-b's import of circular-a hits the cycle — circular-a is
//      already evaluating, so circular-b continues with A's bindings
//      EXISTING but not yet initialized
//   4. circular-b's body runs (it only assigns `b`, never reads `a`) → done
//   5. circular-a's body runs (assigns `a`) → done

import { b } from './circular-b';

export let a = 'a-value';

export function readB(): string {
  return b;
}