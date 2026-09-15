/**
 * The two public entry points guard their input separately -
 * `buildCustomEventSet` through `assertCanonicalEvents`, and
 * `emitGeneratedSource` through `assertEmittable` - and the second says
 * in its own doc that it applies "the same three checks the parser
 * applies, so both boundaries accept exactly the same events".
 *
 * That agreement is held by hand across two files. This table is the
 * enforcement: every bad list has to be refused by both, and the one
 * asymmetry that is deliberate is written down as such rather than
 * discovered later.
 *
 * The error class is asserted, not just the throw. `emitGeneratedSource`
 * ends by calling `buildCustomEventSet`, so a check dropped from the
 * emit guard alone still gets caught by the build guard behind it - the
 * list is refused either way and only the class changes. Since the CLI
 * routes the two classes to different exit codes, the class is what a
 * drift in that direction actually costs, and what has to be pinned.
 */

import type { ParsedEvent } from '../../events/types/event';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { CustomEventType } from '../../events/customEventType';
import { buildCustomEventSet } from '../../set/buildCustomEventSet';
import { EmitError, ParseError } from '../../shared/errors';
import { emitGeneratedSource } from '../emit';

const event = (name: string, indexOffset: number): ParsedEvent =>
  makeEvent({ name, type: CustomEventType.None, indexOffset });

/** Lists neither boundary may accept, one per way a list can be wrong. */
const REJECTED_BY_BOTH: readonly [string, unknown][] = [
  ['not a list at all', 'Alpha'],
  ['an entry that is not an object', [null]],
  ['a name the schema pattern refuses', [{ ...event('Alpha', 0), name: 'lowercase' }]],
  ['a payload type outside the seven', [{ ...event('Alpha', 0), type: 99 }]],
  ['an id below the range the wire reserves', [{ ...event('Alpha', 0), id: 7 }]],
  ['two entries on one id', [event('Alpha', 0), event('Beta', 0)]],
  ['a list out of wire-id order', [event('Alpha', 1), event('Beta', 0)]],
];

const build = (events: unknown): void => {
  buildCustomEventSet(events as readonly ParsedEvent[]);
};
const emit = (events: unknown): void => {
  emitGeneratedSource({ events: events as readonly ParsedEvent[], target: 'web' });
};

describe('the two boundaries accept the same events', () => {
  it.each(REJECTED_BY_BOTH)('both refuse %s, each in its own class', (_label, events) => {
    expect(() => {
      build(events);
    }).toThrow(ParseError);
    expect(() => {
      emit(events);
    }).toThrow(EmitError);
  });

  it('both accept a canonical list', () => {
    const events = [event('Alpha', 0), event('Beta', 1)];
    expect(() => {
      build(events);
    }).not.toThrow();
    expect(() => {
      emit(events);
    }).not.toThrow();
  });

  it('only the emit boundary refuses a reserved name, which is the one deliberate difference', () => {
    /**
     * A reserved name is a legal event that would generate a wrapper
     * shadowing a built-in report method. The set can hold it - the
     * bytes are fine - but no file may be emitted for it, so the check
     * belongs to the emitter alone.
     */
    const events = [event('ButtonClick', 0)];
    expect(() => {
      build(events);
    }).not.toThrow();
    expect(() => {
      emit(events);
    }).toThrow(/reserved name/);
  });
});
