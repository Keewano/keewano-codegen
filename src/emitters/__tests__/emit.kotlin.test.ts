/**
 * The Kotlin target. Same contract as Swift, minus the set - the SDK
 * reads it from the JSON asset at launch - and with the two things the
 * language forces: `Long` for unsigned payloads, and wrappers as
 * extension functions under the contract's fixed package. The header
 * and the line shape are `emit.kotlin.layout.test.ts`.
 */

import type { CustomEventTypeValue } from '../../events/customEventType';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { buildCustomEventSet } from '../../set/buildCustomEventSet';
import { renderAssetJson } from '../assetJson';
import { emitGeneratedSource } from '../emit';

const GENERATED_PACKAGE = 'com.keewano.sdk.generated';

/** [payload type, the wrapper's signature, what reaches the bridge]. */
const PAYLOADS: readonly [CustomEventTypeValue, string, string][] = [
  [0, 'reportTap()', 'reportCustomEvent(2500)'],
  [1, 'reportTap(value: String)', 'reportCustomEvent(2500, value)'],
  [2, 'reportTap(value: Long)', 'reportCustomEvent(2500, value)'],
  [3, 'reportTap(value: Boolean)', 'reportCustomEvent(2500, value)'],
  [4, 'reportTap(value: Long)', 'reportCustomEvent(2500, value)'],
  [5, 'reportTap(x: Int, y: Int)', 'reportCustomEventUShortPair(2500, x, y)'],
  [6, 'reportTap(value: Long)', 'reportCustomEvent(2500, value)'],
];

const emitKotlin = (type: CustomEventTypeValue): string =>
  emitGeneratedSource({
    events: [makeEvent({ name: 'Tap', type, indexOffset: 0 })],
    target: 'kotlin',
  });

describe('the Kotlin target: wrappers', () => {
  it.each(PAYLOADS)('payload type %i takes %s', (type, signature, call) => {
    const source = emitKotlin(type);
    expect(source).toContain(`fun KeewanoSDK.${signature} =`);
    expect(source).toContain(`KeewanoCodegen.${call}`);
  });

  it('hands both halves over as written, packing and checking neither', () => {
    /**
     * Packing the pair and deciding what an out-of-range half means are the
     * SDK's, which has a logger and can drop the event with a reason. A
     * generated file has neither, so it used to pack inline and pass a
     * sentinel; the bridge takes both halves now and none of that is written
     * into the customer's project.
     */
    const source = emitKotlin(5);

    expect(source).toContain('KeewanoCodegen.reportCustomEventUShortPair(2500, x, y)');
    expect(source).not.toContain('shl 16');
    expect(source).not.toContain('0xFFFF');
    expect(source).not.toContain('-1L');
    expect(source).not.toContain('private fun');
  });
});

describe('the Kotlin target: the fixed package', () => {
  it('declares the contract package before anything else the file contains', () => {
    /**
     * Extension functions work from any package, so there is nothing to
     * discover: the contract names one, and a distinct sub-package
     * cannot split the SDK's own package across modules.
     */
    const source = emitKotlin(1);
    const declaration = source.indexOf(`package ${GENERATED_PACKAGE}`);
    expect(declaration).toBeGreaterThan(-1);
    expect(declaration).toBeLessThan(source.indexOf('import '));
  });
});

describe('the Kotlin target: the file carries no set', () => {
  it('emits reporters only; the set travels as the JSON asset', () => {
    const source = emitKotlin(1);
    expect(source).not.toContain('KeewanoCustomEventSet');
    expect(source).not.toContain('gzipBase64');
  });

  it('imports nothing when there are no events, and says why the file is empty', () => {
    const source = emitGeneratedSource({ events: [], target: 'kotlin' });
    expect(source).not.toContain('import ');
    expect(source).toContain('// (no custom events declared yet)');
    expect(source).not.toContain('fun KeewanoSDK.report');
  });
});

describe('the definition-set asset', () => {
  it('carries exactly the built set: version, count and the map as base64', () => {
    const events = [makeEvent({ name: 'Tap', type: 1, indexOffset: 0 })];
    const built = buildCustomEventSet(events);
    const asset: unknown = JSON.parse(renderAssetJson({ events }));

    expect(asset).toEqual({
      version: built.version,
      eventCount: 1,
      gzipBase64: Buffer.from(built.gzipData).toString('base64'),
    });
  });

  it('renders the same bytes twice, key order included', () => {
    const events = [makeEvent({ name: 'Tap', type: 0, indexOffset: 0 })];
    expect(renderAssetJson({ events })).toBe(renderAssetJson({ events }));
    expect(renderAssetJson({ events }).startsWith('{\n  "version":')).toBe(true);
  });
});

describe('the Kotlin target: determinism', () => {
  it('renders the same text twice', () => {
    const events = [
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'Beta', type: 5, indexOffset: 1 }),
    ];
    const emit = (): string => emitGeneratedSource({ events, target: 'kotlin' });
    expect(emit()).toBe(emit());
  });
});
