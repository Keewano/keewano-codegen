/**
 * `serializeEvents`: the documented per-event byte layout
 * `[uint16 LE id][varint UTF-8 length][UTF-8 name][uint16 LE type]` and
 * the uint16 range guard at the public-API boundary.
 */

import type { ParsedEvent } from '../../events/types/event';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { serializeEvents } from '../buildCustomEventSet';

describe('serializeEvents: byte-exact per-event encoding', () => {
  it('returns an empty buffer for zero events', () => {
    expect(serializeEvents([]).byteLength).toBe(0);
  });

  it('encodes one event as `[uint16 LE id][varint len][UTF-8 name][uint16 LE type]`', () => {
    /**
     * Vector: name "Tap" (3 UTF-8 bytes), type 1 (String), id 2500.
     *   id     -> 0xC4 0x09
     *   len    -> 0x03
     *   name   -> 0x54 0x61 0x70 ("Tap")
     *   type   -> 0x01 0x00
     */
    const bytes = serializeEvents([makeEvent({ name: 'Tap', type: 1, indexOffset: 0 })]);
    expect(Array.from(bytes)).toEqual([0xc4, 0x09, 0x03, 0x54, 0x61, 0x70, 0x01, 0x00]);
  });

  it('preserves event order and increments ids across a multi-event sequence', () => {
    const bytes = serializeEvents([
      makeEvent({ name: 'A', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'B', type: 3, indexOffset: 1 }),
    ]);
    expect(Array.from(bytes)).toEqual([
      0xc4, 0x09, 0x01, 0x41, 0x00, 0x00, 0xc5, 0x09, 0x01, 0x42, 0x03, 0x00,
    ]);
  });

  it('encodes multi-byte UTF-8 names with the correct varint byte length (not character length)', () => {
    const bytes = serializeEvents([makeEvent({ name: 'Ω', type: 0, indexOffset: 0 })]);
    expect(Array.from(bytes)).toEqual([0xc4, 0x09, 0x02, 0xce, 0xa9, 0x00, 0x00]);
  });

  it('uses uint16 LE for every CustomEventType value', () => {
    // Single-character names give a fixed stride of 6 bytes; type cell at offset 4.
    const types = [0, 1, 2, 3, 4, 5, 6] as const;
    const events = types.map((type, i) =>
      makeEvent({ name: String.fromCodePoint(65 + i), type, indexOffset: i }),
    );
    const bytes = serializeEvents(events);
    expect(bytes.byteLength).toBe(events.length * 6);
    for (const [i, type] of types.entries()) {
      expect(bytes[i * 6 + 4]).toBe(type);
      expect(bytes[i * 6 + 5]).toBe(0x00);
    }
  });
});

describe('serializeEvents: uint16 range guard at the public-API boundary', () => {
  it('accepts both ends of the uint16 range', () => {
    /**
     * `type` is typed to the 0..6 union, but `serializeEvents` is a
     * public-API boundary that validates the full uint16 range at
     * runtime; cast past the compile-time narrowing to exercise the
     * upper bound an untyped JS caller could hit.
     */
    const events = [
      { id: 0, name: 'Lo', type: 0 },
      { id: 0xffff, name: 'Hi', type: 0xffff },
    ] as unknown as ParsedEvent[];
    expect(() => serializeEvents(events)).not.toThrow();
  });

  it('throws RangeError when event id exceeds uint16', () => {
    expect(() => serializeEvents([{ id: 0x10000, name: 'X', type: 0 }])).toThrow(RangeError);
    expect(() => serializeEvents([{ id: 0x10000, name: 'X', type: 0 }])).toThrow(
      /writeUint16LE: value out of range/,
    );
  });

  it('throws RangeError when event type exceeds uint16', () => {
    const events = [{ id: 2500, name: 'X', type: 0x10000 }] as unknown as ParsedEvent[];
    expect(() => serializeEvents(events)).toThrow(/writeUint16LE: value out of range/);
  });

  it('throws RangeError on a negative event id', () => {
    expect(() => serializeEvents([{ id: -1, name: 'X', type: 0 }])).toThrow(
      /writeUint16LE: value out of range/,
    );
  });

  it('throws RangeError on a non-integer event id', () => {
    expect(() => serializeEvents([{ id: 2500.5, name: 'X', type: 0 }])).toThrow(
      /writeUint16LE: value out of range/,
    );
  });
});
