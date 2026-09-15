/**
 * What the rendered file carries: the runtime list a by-name bridge
 * resolves against, the exported set, and that the same input renders
 * the same text twice.
 */

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { emitGeneratedSource } from '../emit';

describe('emitGeneratedSource: runtime events list', () => {
  /**
   * The id is part of the entry, not implied by its place: a set that
   * skipped a number would otherwise have the runtime count positions
   * and hand everything after the gap its neighbour's id.
   */
  it('emits the id, name and type the runtime resolves against', () => {
    const source = emitGeneratedSource({
      events: [
        makeEvent({ name: 'Score', type: 2, indexOffset: 0 }),
        makeEvent({ name: 'Tap', type: 0, indexOffset: 1 }),
      ],
    });
    expect(source).toMatch(/events: \[/);
    expect(source).toMatch(/\{ id: 2500, name: 'Score', type: 2 \}/);
    expect(source).toMatch(/\{ id: 2501, name: 'Tap', type: 0 \}/);
  });
});

describe('emitGeneratedSource: customEventSet export', () => {
  it('exports `customEventSet` typed as `CustomEventSet`', () => {
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'Tap', type: 0, indexOffset: 0 })],
    });
    expect(source).toMatch(/export const customEventSet: CustomEventSet = \{/);
  });

  it('emits a 32-bit hex `version` and a non-empty `gzipData` literal for a non-empty event set', () => {
    const source = emitGeneratedSource({
      events: [
        makeEvent({ name: 'A', type: 0, indexOffset: 0 }),
        makeEvent({ name: 'B', type: 0, indexOffset: 1 }),
        makeEvent({ name: 'C', type: 0, indexOffset: 2 }),
      ],
    });
    expect(source).toMatch(/eventCount: 3/);
    expect(source).toMatch(/version: 0x[0-9A-F]{8}/);
    expect(source).toMatch(/gzipData: new Uint8Array\(\[0x[0-9A-F]{2}/);
  });

  it('emits a stable `version` for zero events (deterministic empty-input gzip)', () => {
    expect(emitGeneratedSource({ events: [] })).toMatch(/eventCount: 0/);
  });
});

describe('emitGeneratedSource: determinism', () => {
  it('produces a byte-identical source for the same input across runs', () => {
    const events = [
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'Beta', type: 1, indexOffset: 1 }),
    ];
    expect(emitGeneratedSource({ events })).toBe(emitGeneratedSource({ events }));
  });

  it('produces a different source when an event name changes', () => {
    const alphaSource = emitGeneratedSource({
      events: [makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 })],
    });
    const betaSource = emitGeneratedSource({
      events: [makeEvent({ name: 'Beta', type: 0, indexOffset: 0 })],
    });
    expect(alphaSource).not.toBe(betaSource);
  });
});
