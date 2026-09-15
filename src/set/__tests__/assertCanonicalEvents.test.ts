/**
 * The precondition of the frozen pipeline: what a caller must hand
 * `buildCustomEventSet` for its bytes to mean what they say. Each case
 * here is a list a build script can assemble by hand and the parser
 * never produces - the shapes that used to hash into a version the
 * backend reads as somebody else's schema.
 */

import type { ParsedEvent } from '../../events/types/event';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { ParseError } from '../../shared/errors';
import { buildCustomEventSet } from '../buildCustomEventSet';

describe('buildCustomEventSet: the canonical-order guard', () => {
  /**
   * The reviewer probed the exported function with four shapes of the
   * same two events and got four confident uint32s. Each shape is
   * pinned here as a rejection, because a version the backend reads as
   * a distinct schema is the failure the frozen contract exists to
   * prevent - and this entry point is reachable from any build script.
   */
  const canonical = [
    makeEvent({ name: 'BestScore', type: 2, indexOffset: 0 }),
    makeEvent({ name: 'GameStart', type: 0, indexOffset: 1 }),
  ] as const;

  it('accepts the parser-shaped list', () => {
    expect(() => buildCustomEventSet(canonical)).not.toThrow();
  });

  it('rejects the same events shuffled', () => {
    /** The ids decide the byte order, so the same events in another order hash differently. */
    expect(() => buildCustomEventSet([canonical[1], canonical[0]])).toThrow(
      /has an id out of order/,
    );
  });

  it('rejects ids below the range the wire reserves for custom events', () => {
    /** Under 2500 the map would claim ids the predefined events already own. */
    const renumbered = canonical.map((event, index) => ({ ...event, id: 7 + 2 * index }));

    expect(() => buildCustomEventSet(renumbered)).toThrow(/has an id outside the range/);
  });

  it('rejects two events on one id, which no reader could tell apart', () => {
    const collided = [
      makeEvent({ name: 'BestScore', type: 2, indexOffset: 0 }),
      makeEvent({ name: 'GameStart', type: 0, indexOffset: 0 }),
    ];

    expect(() => buildCustomEventSet(collided)).toThrow(/has an id out of order/);
  });

  it('accepts a gap, because deleting an event must not renumber the rest', () => {
    /**
     * The whole point of hand-written ids is that they stay put. A list whose
     * middle event was deleted is what a project looks like the day after, and
     * refusing it would force exactly the renumbering this design removes.
     */
    const withGap = [
      makeEvent({ name: 'BestScore', type: 2, indexOffset: 0 }),
      makeEvent({ name: 'GameStart', type: 0, indexOffset: 7 }),
    ];

    expect(() => buildCustomEventSet(withGap)).not.toThrow();
  });

  it('rejects a duplicate name, which distinct ids alone would admit', () => {
    const doubled = [
      makeEvent({ name: 'Tap', type: 0, indexOffset: 0 }),
      makeEvent({ name: 'Tap', type: 1, indexOffset: 1 }),
    ];

    expect(() => buildCustomEventSet(doubled)).toThrow(/duplicate event name/);
  });

  it.each([7, 42, 65535])('rejects payload type %i, which no decoder has', (type) => {
    /**
     * The tag is written as a uint16, so a wrong one fits the bytes and
     * the map still hashes - into a schema that claims a payload nothing
     * can read. The parser keeps the CLI path to the seven tags; this is
     * the entry point a build script reaches without it.
     */
    const events = [{ ...makeEvent({ name: 'Tap', type: 0, indexOffset: 0 }), type }];
    expect(() => buildCustomEventSet(events as never)).toThrow(/has an unsupported type/);
  });

  it('rejects a name the schema would never have produced', () => {
    const injected = [{ ...makeEvent({ name: 'Tap', type: 0, indexOffset: 0 }), name: 'Tap; x' }];
    expect(() => buildCustomEventSet(injected)).toThrow(/invalid event name/);
  });

  it('rejects more events than the wire id space', () => {
    /** A real but empty array: the count check runs before any entry is read. */
    const flood = new Array<ParsedEvent>(0x10000);
    expect(() => buildCustomEventSet(flood)).toThrow(/more events than the wire id space/);
  });

  it.each([
    ['a string', 'nope'],
    ['undefined', undefined],
    ['a plain object', { length: 1 }],
  ])('rejects %s instead of failing inside the encoder', (_label, value) => {
    /**
     * The entry point is reachable from untyped JavaScript. A TypeError
     * thrown from inside the byte writer is an error class the package
     * does not document, so no build script catches it.
     */
    expect(() => buildCustomEventSet(value as never)).toThrow(ParseError);
    expect(() => buildCustomEventSet(value as never)).toThrow(/must be an array/);
  });

  it.each([[null], [undefined], ['Tap'], [42]])(
    'rejects %p as a list entry, naming its position',
    (entry) => {
      expect(() => buildCustomEventSet([entry] as never)).toThrow(/entry 0 is not an event/);
    },
  );

  it('rejects a hole in the list, which skips a per-entry check rather than failing one', () => {
    /**
     * `Array.prototype.forEach` walks past a missing slot, so a guard
     * written with it would pass this list and let the encoder fail on
     * an undefined instead - with an error class the package does not
     * document.
     */
    const sparse: ParsedEvent[] = [];
    sparse[1] = makeEvent({ name: 'Beta', type: 0, indexOffset: 1 });

    expect(() => buildCustomEventSet(sparse)).toThrow(ParseError);
    expect(() => buildCustomEventSet(sparse)).toThrow(/entry 0 is not an event/);
  });
});
