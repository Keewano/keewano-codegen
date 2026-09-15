/**
 * Encode a parsed event list into the deterministic binary custom-event
 * map: per-event byte stream -> gzip -> cross-OS header normalization ->
 * FNV-1a version stamp. The result matches the public `CustomEventSet`
 * shape the SDK consumes at runtime.
 *
 * The entry point is public, so the order it depends on is checked here
 * rather than assumed of the caller.
 */

import type { BuildResult } from './types/buildCustomEventSet';
import type { ParsedEvent } from '../events/types/event';

import { gzip as pakoGzip } from 'pako';

import { assertCanonicalEvents } from './assertCanonicalEvents';
import { MapWriter, fnv1a32 } from './mapWriter';

/**
 * Deterministic settings applied to the per-build pipeline.
 *
 * GZIP_LEVEL - 9 = maximum compression; deterministic for a fixed
 *   pako version (pinned in package.json).
 * MIN_GZIP_HEADER_LENGTH - 10 = the RFC 1952 fixed-size gzip header
 *   length; any shorter buffer is malformed and cannot be normalized.
 * GZIP_HEADER_MASK - byte offsets of the informational gzip header
 *   fields (RFC 1952 bytes 4..9). MTIME (4..7) and XFL (8) are zeroed;
 *   OS (9) is set to GZIP_OS_UNKNOWN so the FNV-1a hash is identical
 *   across Windows / Linux / macOS builders.
 * GZIP_OS_UNKNOWN - 0xFF, the "unknown" OS byte of RFC 1952.
 */
const PIPELINE = {
  GZIP_LEVEL: 9,
  MIN_GZIP_HEADER_LENGTH: 10,
  GZIP_HEADER_MASK: { MTIME_0: 4, MTIME_1: 5, MTIME_2: 6, MTIME_3: 7, XFL: 8, OS: 9 },
  GZIP_OS_UNKNOWN: 0xff,
} as const;

function buildCustomEventSet(events: readonly ParsedEvent[]): BuildResult {
  assertCanonicalEvents(events);
  /**
   * Version `0` is the wire protocol's "no custom-event schema", and every SDK
   * short-circuits its whole custom-event path on it. Hashing the gzip of an
   * empty list would hand them a confident-looking stamp instead: they would
   * persist a blob describing nothing, tag every batch with it, and hold the
   * upload behind registering it - so a project that ran the generator before
   * declaring its first event would stop reporting anything at all.
   *
   * Built here rather than shared from module scope, for the reason the
   * non-empty path below returns a fresh object and `normalizeGzipHeader`
   * copies: this function is exported, so a caller that mutated one result
   * would be mutating every later empty build in the process.
   */
  if (events.length === 0) return { version: 0, eventCount: 0, gzipData: new Uint8Array() };
  const eventBytes = serializeEvents(events);
  const gzipped = pakoGzip(eventBytes, { level: PIPELINE.GZIP_LEVEL });
  const normalized = normalizeGzipHeader(gzipped);
  const version = fnv1a32(normalized);
  return {
    version,
    eventCount: events.length,
    gzipData: normalized,
  };
}

/**
 * `serializeEvents` accepts any `ParsedEvent[]` the caller hands in; the
 * writer rejects an `id` or `type` outside the uint16 wire range, so an
 * out-of-range value cannot truncate silently into a map whose `version`
 * no longer matches the server decoder.
 */
function serializeEvents(events: readonly ParsedEvent[]): Uint8Array {
  const stream = new MapWriter();
  for (const event of events) {
    stream.writeUint16LE(event.id);
    stream.writeString(event.name);
    stream.writeUint16LE(event.type);
  }
  return stream.toBytes();
}

/**
 * RFC 1952: bytes 4..9 are informational and ignored by every
 * conforming decompressor, so flattening them is byte-safe.
 *
 * Every path hands back a copy, including the one with nothing to
 * flatten: a caller that owns the buffer on one input and aliases the
 * argument on another cannot reason about either.
 */
function normalizeGzipHeader(gzipData: Uint8Array): Uint8Array {
  if (gzipData.length < PIPELINE.MIN_GZIP_HEADER_LENGTH) return gzipData.slice();
  const normalized = new Uint8Array(gzipData);
  normalized[PIPELINE.GZIP_HEADER_MASK.MTIME_0] = 0;
  normalized[PIPELINE.GZIP_HEADER_MASK.MTIME_1] = 0;
  normalized[PIPELINE.GZIP_HEADER_MASK.MTIME_2] = 0;
  normalized[PIPELINE.GZIP_HEADER_MASK.MTIME_3] = 0;
  normalized[PIPELINE.GZIP_HEADER_MASK.XFL] = 0;
  normalized[PIPELINE.GZIP_HEADER_MASK.OS] = PIPELINE.GZIP_OS_UNKNOWN;
  return normalized;
}

export { buildCustomEventSet, normalizeGzipHeader, serializeEvents };
