/**
 * `normalizeGzipHeader` applies the RFC 1952 mask exactly, and
 * `buildCustomEventSet` round-trips through `pako.ungzip` with a stable
 * `version` across runs. The primitives (`fnv1a32`, varint) are tested
 * in `mapWriter.test.ts`.
 */

import { gzip, ungzip } from 'pako';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { compareOrdinal } from '../../shared/compareOrdinal';
import { buildCustomEventSet, normalizeGzipHeader, serializeEvents } from '../buildCustomEventSet';
import { fnv1a32 } from '../mapWriter';

/**
 * A set big enough for the compression level to reach the bytes. For an
 * ordinary set every level produces the same deflate stream and differs
 * only in the gzip XFL byte - which this pipeline normalizes away - so a
 * lowered level would leave every ordinary vector untouched. Long names
 * repeating at long distances are what makes the match search depth,
 * which is what the level controls, decide the output.
 */
const LEVEL_SENSITIVE_EVENTS = Array.from(
  { length: 2000 },
  (_, index) => `${index % 900 === 0 ? 'Zzz' : ''}Event${index % 700}Suffix${index}`,
)
  /** In id order with distinct ids, the shape the parser produces and the builder requires. */
  .sort(compareOrdinal)
  .map((name, index) => makeEvent({ name, type: 1, indexOffset: index }));

describe('buildCustomEventSet: end-to-end pipeline', () => {
  it('returns a version (FNV-1a uint32) + eventCount + non-empty gzipData for a non-empty event set', () => {
    const result = buildCustomEventSet([makeEvent({ name: 'Tap', type: 1, indexOffset: 0 })]);
    expect(result.eventCount).toBe(1);
    expect(result.gzipData).toBeInstanceOf(Uint8Array);
    expect(result.gzipData.byteLength).toBeGreaterThan(0);
    expect(Number.isInteger(result.version)).toBe(true);
    expect(result.version).toBeGreaterThanOrEqual(0);
    expect(result.version).toBeLessThanOrEqual(0xffffffff);
  });

  it('writes a gzip stream whose header bytes 4..9 match the normalization mask', () => {
    const result = buildCustomEventSet([makeEvent({ name: 'Tap', type: 1, indexOffset: 0 })]);
    expect(result.gzipData[0]).toBe(0x1f);
    expect(result.gzipData[1]).toBe(0x8b);
    expect(result.gzipData[4]).toBe(0x00);
    expect(result.gzipData[5]).toBe(0x00);
    expect(result.gzipData[6]).toBe(0x00);
    expect(result.gzipData[7]).toBe(0x00);
    expect(result.gzipData[8]).toBe(0x00);
    expect(result.gzipData[9]).toBe(0xff);
  });

  it('writes a gzip stream that round-trips through `pako.ungzip` back to the raw event bytes', () => {
    const events = [
      makeEvent({ name: 'BestScore', type: 2, indexOffset: 0 }),
      makeEvent({ name: 'GameStart', type: 0, indexOffset: 1 }),
    ];
    const expectedRaw = serializeEvents(events);
    const result = buildCustomEventSet(events);
    expect(Array.from(ungzip(result.gzipData))).toEqual(Array.from(expectedRaw));
  });

  it('stamps `version` as the FNV-1a of the header-normalized gzip bytes', () => {
    const result = buildCustomEventSet([makeEvent({ name: 'Tap', type: 1, indexOffset: 0 })]);
    expect(result.version).toBe(fnv1a32(result.gzipData));
  });

  it('is deterministic: same input -> byte-identical gzipData and identical version across runs', () => {
    const events = [
      makeEvent({ name: 'Apple', type: 1, indexOffset: 0 }),
      makeEvent({ name: 'Banana', type: 2, indexOffset: 1 }),
      makeEvent({ name: 'Cherry', type: 5, indexOffset: 2 }),
    ];
    const a = buildCustomEventSet(events);
    const b = buildCustomEventSet(events);
    expect(a.version).toBe(b.version);
    expect(Array.from(a.gzipData)).toEqual(Array.from(b.gzipData));
  });

  it('compresses at maximum level', () => {
    /**
     * The level is part of the contract, not a tuning knob: the hash is
     * taken over these bytes, so a different level is a different set
     * identity for the same events.
     */
    const atLevelNine = Buffer.from(
      normalizeGzipHeader(gzip(serializeEvents(LEVEL_SENSITIVE_EVENTS), { level: 9 })),
    );

    const actual = Buffer.from(buildCustomEventSet(LEVEL_SENSITIVE_EVENTS).gzipData);

    expect(actual.equals(atLevelNine)).toBe(true);
  });

  it('is checked against a set where a lower level would change the hash', () => {
    /** Without this the case above would pass at any level and prove nothing. */
    const raw = serializeEvents(LEVEL_SENSITIVE_EVENTS);
    const atLevelNine = normalizeGzipHeader(gzip(raw, { level: 9 }));
    const atLevelSix = normalizeGzipHeader(gzip(raw, { level: 6 }));

    expect(Buffer.from(atLevelSix).equals(Buffer.from(atLevelNine))).toBe(false);
    expect(fnv1a32(atLevelSix)).not.toBe(fnv1a32(atLevelNine));
  });

  it('produces different `version` values when name or type changes', () => {
    const alphaVersion = buildCustomEventSet([
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }),
    ]).version;
    const betaVersion = buildCustomEventSet([
      makeEvent({ name: 'Beta', type: 0, indexOffset: 0 }),
    ]).version;
    const alphaPriceVersion = buildCustomEventSet([
      makeEvent({ name: 'Alpha', type: 6, indexOffset: 0 }),
    ]).version;
    expect(alphaVersion).not.toBe(betaVersion);
    expect(alphaVersion).not.toBe(alphaPriceVersion);
  });
});
