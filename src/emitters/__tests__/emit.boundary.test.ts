/**
 * The emit boundary: event validation for programmatic callers, the
 * runtime events list, the `customEventSet` export and determinism.
 */

import type { ParsedEvent } from '../../events/types/event';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { EmitError } from '../../shared/errors';
import { emitGeneratedSource } from '../emit';

describe('emitGeneratedSource: event validation at the emit boundary', () => {
  /**
   * The CLI always feeds parser-validated events, but the programmatic
   * entry point can be handed arbitrary objects. Names are interpolated
   * into identifier and string-literal positions of the generated
   * source, so anything outside the parser's own pattern must be
   * rejected at the boundary instead of emitting broken (or injected)
   * output.
   */
  it('rejects a name that fails the parser pattern (hyphen)', () => {
    expect(() =>
      emitGeneratedSource({ events: [makeEvent({ name: 'Level-Up', type: 0, indexOffset: 0 })] }),
    ).toThrow(EmitError);
    expect(() =>
      emitGeneratedSource({ events: [makeEvent({ name: 'Level-Up', type: 0, indexOffset: 0 })] }),
    ).toThrow(/emit: invalid event name "Level-Up"/);
  });

  it('rejects a quote-injection name so hostile input cannot escape the generated string literal', () => {
    const hostile = "X' }); process.exit(1); ({ name: 'Y";
    expect(() =>
      emitGeneratedSource({ events: [makeEvent({ name: hostile, type: 1, indexOffset: 0 })] }),
    ).toThrow(/invalid event name/);
  });

  it('rejects a name over the schema length cap', () => {
    const oversized = `A${'b'.repeat(200)}`;
    expect(() =>
      emitGeneratedSource({ events: [makeEvent({ name: oversized, type: 0, indexOffset: 0 })] }),
    ).toThrow(/invalid event name/);
  });

  it('rejects an out-of-range event type instead of emitting a broken wrapper', () => {
    expect(() =>
      emitGeneratedSource({
        events: [makeEvent({ name: 'Tap', type: 7 as ParsedEvent['type'], indexOffset: 0 })],
      }),
    ).toThrow(/emit: unsupported event type 7/);
  });

  it('rejects a prototype-chain type key instead of resolving it through the wrapper table', () => {
    expect(() =>
      emitGeneratedSource({
        events: [
          makeEvent({
            name: 'Tap',
            type: 'toString' as unknown as ParsedEvent['type'],
            indexOffset: 0,
          }),
        ],
      }),
    ).toThrow(/unsupported event type/);
  });
});

describe('emitGeneratedSource: reserved names at the programmatic boundary', () => {
  it('rejects a name that would shadow a built-in report method, like the parser does', () => {
    /** A build script bypassing the parser must not get a reportButtonClick wrapper either. */
    const events = [makeEvent({ name: 'ButtonClick', type: 0, indexOffset: 0 })];
    expect(() => emitGeneratedSource({ events })).toThrow(EmitError);
    expect(() => emitGeneratedSource({ events })).toThrow(/"ButtonClick" is a reserved name/);
  });
});
