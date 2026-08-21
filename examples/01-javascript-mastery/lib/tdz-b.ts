// examples/01-javascript-mastery/lib/tdz-b.ts
//
// The trigger half of the TDZ crash pair. The top-level line
// `export const earlyRead = a;` READS tdz-a's binding during tdz-b's own
// evaluation — before tdz-a's `let a = 'a-value'` initializer can ever
// run (the cycle guarantees tdz-b is evaluated first, while tdz-a is
// still suspended mid-evaluation). The binding exists; the value does
// not. TDZ throws.

import { a } from './tdz-a';

export let b = 'b-value';

// Reading `a` here is the whole point: tdz-a's body has NOT run yet.
export const earlyRead = a;