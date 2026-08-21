// examples/01-javascript-mastery/lib/tdz-spec-b.mjs
//
// The trigger half of the TDZ pair. The top-level line reads tdz-spec-a's
// binding while that module is still mid-evaluation — under spec-strict
// Node ESM this is a ReferenceError during evaluation.

import { a } from './tdz-spec-a.mjs';

export let b = 'b-value';

// Reading `a` here is the whole point: tdz-spec-a's body has NOT run yet.
export const earlyRead = a;