// examples/01-javascript-mastery/lib/tdz-spec-a.mjs
//
// Plain-ESM (no TS, no bundler) pair used to verify the circular-import TDZ
// claim against Node's OWN ESM runtime — the spec-strict end of the
// spectrum. Node evaluates this module: its import of tdz-spec-b.mjs begins
// that module's evaluation; tdz-spec-b's import of THIS module hits the
// in-flight cycle; tdz-spec-b's top-level body reads `a` before this
// module's `let a = 'a-value'` initializer has run. The binding exists
// (hoisted/instantiated for the whole graph); the value does not.
// ReferenceError: Cannot access 'a' before initialization — process exit 1.
//
// Spawned from 08-destructuring-spread-rest-modules.test.ts.

import { b } from './tdz-spec-b.mjs';

export let a = 'a-value';

export function readB() {
  return b;
}