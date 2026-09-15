/**
 * The precondition of the frozen pipeline, kept apart from it: what a
 * caller must hand `buildCustomEventSet` for the bytes it writes to mean
 * what they say.
 *
 * An id is an event's position in the definitions file and the list
 * arrives in that order, and the version is a hash of the bytes written
 * in that order, so a caller who shuffles, renumbers or filters a parsed
 * list gets a confident-looking uint32 the backend reads as a different
 * schema. A tag outside the seven
 * payload types is the same failure by another route: it fits the bytes
 * and describes a payload no decoder has.
 *
 * The builder is public, so a build script reaches it past every other
 * boundary. That is why this is enforced rather than described.
 */

import type { AssertEntryIsEventArgs } from './types/assertCanonicalEvents';
import type { ParsedEvent } from '../events/types/event';

import {
  isCustomEventId,
  MAX_CUSTOM_EVENT_COUNT,
  isCustomEventType,
} from '../events/customEventType';
import { isWellFormedEventName } from '../events/eventName';
import { ParseError } from '../shared/errors';

/**
 * The entry point is reachable from untyped JavaScript, where the
 * argument can be anything. Without this the length below is read off a
 * string or a null, and the caller gets a TypeError from inside the
 * encoder - an error class nothing here documents and no build script
 * catches. It is a function of its own so `Array.isArray` narrows its
 * own parameter rather than the caller's typed list, which it would
 * widen to `any[]`.
 */
function assertIsList(events: unknown): void {
  if (!Array.isArray(events)) {
    throw new ParseError('buildCustomEventSet: events must be an array');
  }
}

/**
 * The typed signature is a compile-time promise only; from untyped
 * JavaScript any value can sit in the list, and reading a field off it is
 * where the encoder would fail with an error class this package does not
 * document. The parameter is `unknown` so the checks are about the value
 * rather than about a type the caller may not have honoured.
 */
function assertEntryIsEvent({ entry, index }: AssertEntryIsEventArgs): void {
  if (entry === null || typeof entry !== 'object') {
    throw new ParseError(`buildCustomEventSet: entry ${String(index)} is not an event`);
  }
}

function assertCanonicalEvents(events: readonly ParsedEvent[]): void {
  assertIsList(events);
  if (events.length > MAX_CUSTOM_EVENT_COUNT) {
    throw new ParseError('buildCustomEventSet: more events than the wire id space');
  }
  let previousId: number | undefined;
  const seenNames = new Set<string>();
  /**
   * `entries()` and not `forEach`: the latter skips the holes of a sparse
   * array, so a list with a missing slot would pass every check here and
   * fail inside the encoder instead, with the error class this guard
   * exists to keep callers from seeing.
   */
  for (const [index, event] of events.entries()) {
    assertEntryIsEvent({ entry: event, index });
    if (!isWellFormedEventName(event.name)) {
      throw new ParseError(`buildCustomEventSet: invalid event name "${String(event.name)}"`);
    }
    if (!isCustomEventType(event.type)) {
      throw new ParseError(
        `buildCustomEventSet: "${event.name}" has an unsupported type ${String(event.type)}`,
      );
    }
    if (!isCustomEventId(event.id)) {
      throw new ParseError(`buildCustomEventSet: "${event.name}" has an id outside the range`);
    }
    /**
     * Ascending rather than merely distinct: the ids decide the byte order, so
     * a list that carries the right ids in the wrong order would hash to a
     * version no other build of the same events produces.
     */
    if (previousId !== undefined && event.id <= previousId) {
      throw new ParseError(`buildCustomEventSet: "${event.name}" has an id out of order`);
    }
    if (seenNames.has(event.name)) {
      throw new ParseError(`buildCustomEventSet: duplicate event name "${event.name}"`);
    }
    seenNames.add(event.name);
    previousId = event.id;
  }
}

export { assertCanonicalEvents };
