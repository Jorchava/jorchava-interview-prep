// examples/01-javascript-mastery/lib/live-binding-reader.ts
//
// The importing half of the live-bindings proof. This module does NOT
// re-export anything from the exporter — it reads the imported binding
// through its own function, so the test observes the binding across a
// real module boundary. If imports were snapshots, readCounterFromExporter
// would keep returning the value captured at import time.

import { counter } from './live-binding-exporter';
import defaultValue from './live-binding-exporter';

export function readCounterFromExporter(): number {
  return counter; // a live reference — reads the CURRENT value, not a snapshot
}

export function readDefaultFromExporter(): string {
  return defaultValue;
}