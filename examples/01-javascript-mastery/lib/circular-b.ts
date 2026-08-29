// examples/01-javascript-mastery/lib/circular-b.ts
//
// The mirror half of the working circular-import pair. B's top-level code
// only ASSIGNS its own binding — it never reads `a` at evaluation time —
// which is what keeps the cycle legal. Reading `a` during B's evaluation
// would be a TDZ ReferenceError (see tdz-a/tdz-b for exactly that crash).

import { a } from './circular-a';

export let b = 'b-value';

export function readA(): string {
  return a;
}