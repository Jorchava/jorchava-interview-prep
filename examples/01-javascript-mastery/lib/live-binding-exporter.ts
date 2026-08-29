// examples/01-javascript-mastery/lib/live-binding-exporter.ts
//
// One half of the live-bindings proof for Session 8. This module owns a
// mutable binding (counter) and a default export. The reader module
// (live-binding-reader.ts) imports them across a real module boundary —
// the test asserts that the reader observes mutations made HERE, which
// only works if imported bindings are live, not snapshots taken at
// import time.

export let counter = 0;

export function bump(): void {
  counter += 1;
}

export function read(): number {
  return counter;
}

export default 'default-export-value';