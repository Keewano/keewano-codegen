/**
 * The Swift target: the surface it writes against, and that every
 * wrapper hands its value to the bridge exactly as it took it.
 */

import type { CustomEventTypeValue } from '../../events/customEventType';

import { ungzip } from 'pako';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { buildCustomEventSet } from '../../set/buildCustomEventSet';
import { emitGeneratedSource } from '../emit';

/** [payload type, the wrapper's signature, what reaches the bridge]. */
const PAYLOADS: readonly [CustomEventTypeValue, string, string][] = [
  [0, 'reportTap()', 'reportCustomEvent(2500)'],
  [1, 'reportTap(_ value: String)', 'reportCustomEvent(2500, value)'],
  [2, 'reportTap(_ value: Int64)', 'reportCustomEvent(2500, value)'],
  [3, 'reportTap(_ value: Bool)', 'reportCustomEvent(2500, value)'],
  [4, 'reportTap(_ value: Int64)', 'reportCustomEvent(2500, value)'],
  [5, 'reportTap(x: Int, y: Int)', 'reportCustomEventUShortPair(2500, x, y)'],
  [6, 'reportTap(_ value: Int64)', 'reportCustomEvent(2500, value)'],
];

const emitSwift = (type: CustomEventTypeValue): string =>
  emitGeneratedSource({
    events: [makeEvent({ name: 'Tap', type, indexOffset: 0 })],
    target: 'swift',
  });

describe('the Swift target: wrappers', () => {
  it.each(PAYLOADS)('payload type %i takes %s', (type, signature, call) => {
    const source = emitSwift(type);
    expect(source).toContain(`public static func ${signature} {`);
    expect(source).toContain(`KeewanoCodegen.${call}`);
  });
});

describe('the Swift target: the set', () => {
  it('carries the map as base64 that decodes back to the built bytes', () => {
    /**
     * A `[UInt8]` literal of real size is slow for the Swift
     * type-checker, so the bytes travel as base64 and the SDK decodes
     * them at init.
     */
    const events = [makeEvent({ name: 'Tap', type: 1, indexOffset: 0 })];
    const built = buildCustomEventSet(events);
    const source = emitGeneratedSource({ events, target: 'swift' });

    const base64 = /gzipBase64: "([^"]+)"/.exec(source)?.[1] ?? '';
    expect(Buffer.from(base64, 'base64')).toEqual(Buffer.from(built.gzipData));
    expect(ungzip(Buffer.from(base64, 'base64'))).toEqual(ungzip(built.gzipData));
    expect(source).toContain(`version: ${String(built.version)}`);
    expect(source).toContain('eventCount: 1');
  });

  it('still declares the set when no events exist yet', () => {
    /** An SDK has to be told the project has no custom events, not left guessing. */
    const source = emitGeneratedSource({ events: [], target: 'swift' });
    expect(source).toContain('public static let set = KeewanoCustomEventSet(');
    expect(source).toContain('eventCount: 0');
    expect(source).toContain('import KeewanoSDK');
  });
});

describe('the Swift target: the pair', () => {
  it('hands both halves over as written, packing neither', () => {
    /**
     * The pair has a bridge method of its own now, so the wrapper passes the
     * halves and the SDK lays them out. Packing them here put wire arithmetic
     * in the customer's file, and `Int` rather than an unsigned type is the
     * SDK's own choice: an unsigned parameter forces the caller through a
     * conversion that traps, where an out-of-range half should be a dropped
     * event with a log.
     */
    const source = emitSwift(5);

    expect(source).toContain('KeewanoCodegen.reportCustomEventUShortPair(2500, x, y)');
    expect(source).not.toContain('<< 16');
    expect(source).not.toContain('UInt32(');
  });
});

describe('the Swift target: determinism', () => {
  it('renders the same text twice', () => {
    const events = [
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'Beta', type: 5, indexOffset: 1 }),
    ];
    expect(emitGeneratedSource({ events, target: 'swift' })).toBe(
      emitGeneratedSource({ events, target: 'swift' }),
    );
  });
});

describe('the Swift target: an empty set', () => {
  it('says so instead of carrying an empty extension', () => {
    const source = emitGeneratedSource({ events: [], target: 'swift' });
    expect(source).toContain('// (no custom events declared yet)');
    expect(source).not.toContain('extension KeewanoSDK');
  });
});

describe('the Swift target: the header', () => {
  it('lists the ids a reader needs, and says so when there are none', () => {
    const withEvents = emitSwift(2);
    expect(withEvents).toContain('//   2500  Tap  (UnsignedInt)');
    expect(emitGeneratedSource({ events: [], target: 'swift' })).toContain(
      '//   (no events defined)',
    );
  });
});
