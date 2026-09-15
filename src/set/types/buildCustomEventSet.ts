import type { ParsedEvent } from '../../events/types/event';

/**
 * Return shape of `buildCustomEventSet`. Matches the public
 * `CustomEventSet` interface the SDK consumes, but kept as a separate
 * local symbol so the codegen does not pull a runtime dependency on
 * the SDK package surface.
 *
 * version - FNV-1a 32-bit hash of the gzip-normalized event map; uint32.
 * eventCount - Number of events encoded in `gzipData`.
 * gzipData - Gzipped event map with header bytes 4..9 normalized for
 *   cross-OS determinism.
 */
interface BuildResult {
  version: number;
  eventCount: number;
  gzipData: Uint8Array;
}

/**
 * The parsed events together with the set built for exactly them - the
 * one input every renderer (emitter, manifest) receives, so the bytes
 * and the hash come from a single build.
 *
 * events - parsed event list, in declaration order.
 * built - the frozen-contract result for these events.
 */
interface BuiltEvents {
  events: readonly ParsedEvent[];
  built: BuildResult;
}

export type { BuildResult, BuiltEvents };
