/**
 * What the emit boundary demands of the list as a whole, rather than of
 * any one event: the order the ids describe, the shape of the container
 * itself, and that two runs over the same list render the same text.
 */

import type { ParsedEvent } from '../../events/types/event';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { MAX_CUSTOM_EVENT_COUNT } from '../../events/customEventType';
import { EmitError } from '../../shared/errors';
import { emitGeneratedSource } from '../emit';

describe('emitGeneratedSource: the list must be the one the ids describe', () => {
  /**
   * A build script that filters or reorders a parsed list is the case
   * that motivates these: both the wrappers and the map would still look
   * plausible, while every event of that build would be recorded under a
   * neighbour's name.
   */
  it('accepts a gap, because an id nobody moved is the point of writing it', () => {
    const events = [
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'Gamma', type: 0, indexOffset: 2 }),
    ];

    expect(() => emitGeneratedSource({ events })).not.toThrow();
  });

  it('rejects an id below the range the wire reserves for custom events', () => {
    const events = [{ ...makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }), id: 7 }];

    expect(() => emitGeneratedSource({ events })).toThrow(EmitError);
    expect(() => emitGeneratedSource({ events })).toThrow(/"Alpha" has an id outside the range/);
  });

  it('rejects a list that is not in wire-id order', () => {
    /** Names may sit in any order now; the ids are what the bytes follow. */
    const events = [
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 1 }),
      makeEvent({ name: 'Beta', type: 0, indexOffset: 0 }),
    ];

    expect(() => emitGeneratedSource({ events })).toThrow(/"Beta" has an id out of order/);
  });

  it('rejects more events than the wire id space, instead of reaching the byte writer', () => {
    /**
     * The parser caps this too; a build script that assembles its own
     * list would otherwise get a range error from deep inside the
     * encoder, which reads as a bug in the tool rather than a limit.
     */
    const events = Array.from({ length: MAX_CUSTOM_EVENT_COUNT + 1 }, (_, index) =>
      makeEvent({ name: `E${String(index)}`, type: 0, indexOffset: index }),
    );
    expect(() => emitGeneratedSource({ events })).toThrow(/more events than the wire id space/);
  });

  it('rejects a repeated name, which would generate one method twice', () => {
    const events = [
      makeEvent({ name: 'Alpha', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'Alpha', type: 1, indexOffset: 1 }),
    ];

    expect(() => emitGeneratedSource({ events })).toThrow(/duplicate event name "Alpha"/);
  });
});

describe('emitGeneratedSource: the shape of the list itself', () => {
  /**
   * The typed signature stops none of this from a JavaScript build
   * script. A string is the case worth naming: it iterates into its
   * characters, so without the array check every one of them is reported
   * as an event with a bad name - a believable message about the wrong
   * thing.
   */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['a plain object', { length: 1 }],
  ])('refuses %s as the list', (_label, value) => {
    expect(() => emitGeneratedSource({ events: value as never, target: 'web' })).toThrow(EmitError);
    expect(() => emitGeneratedSource({ events: value as never, target: 'web' })).toThrow(
      /events must be an array/,
    );
  });

  it.each([[null], [undefined], ['Tap'], [42]])(
    'refuses %p as an entry, naming its position',
    (entry) => {
      expect(() => emitGeneratedSource({ events: [entry] as never, target: 'web' })).toThrow(
        /entry 0 is not an event/,
      );
    },
  );

  it('refuses a hole, which an entry check alone would walk past', () => {
    const sparse: ParsedEvent[] = [];
    sparse[1] = makeEvent({ name: 'Beta', type: 0, indexOffset: 1 });
    expect(() => emitGeneratedSource({ events: sparse, target: 'web' })).toThrow(
      /entry 0 is not an event/,
    );
  });
});
