/**
 * What a list must be before a template renders it, kept apart from the
 * boundary that calls it.
 *
 * The CLI feeds parser-validated events, so most of this can only fire
 * on the programmatic path, which can be handed anything, and where a
 * wrong list is invisible afterwards: an id is a position, so a shuffled
 * or renumbered one produces wrappers whose names no longer line up with
 * the ids inside the map they ship with, and every event of that build
 * arrives under a neighbour's name. Those throw `EmitError`, which the
 * CLI reports as an internal failure worth a bug report.
 *
 * `assertDistinctReporters` is the exception and throws `ParseError`
 * instead: the parser cannot run it, because the spelling it compares
 * depends on the target, so a definition set that is perfectly valid
 * reaches it and is rejected here. That is the user's own naming to fix,
 * not a defect to report.
 */

import type { AssertDistinctReportersArgs, AssertEntryIsEventArgs } from './types/assertEmittable';
import type { ParsedEvent } from '../events/types/event';

import {
  isCustomEventId,
  MAX_CUSTOM_EVENT_COUNT,
  isCustomEventType,
} from '../events/customEventType';
import { isReservedEventName, isWellFormedEventName } from '../events/eventName';
import { RESERVED_EVENT_NAMES } from '../events/reservedEventNames';
import { EmitError, ParseError } from '../shared/errors';

/**
 * The typed signature is a compile-time promise only; from untyped
 * JavaScript any value can sit in the list, and reading a field off it
 * would surface as a TypeError from inside a template rather than as the
 * boundary's own error. The parameter is `unknown` so the checks are
 * about the value rather than about a type the caller may not have kept.
 */
function assertEntryIsEvent({ entry, index }: AssertEntryIsEventArgs): void {
  if (entry === null || typeof entry !== 'object') {
    throw new EmitError(`emit: entry ${String(index)} is not an event`);
  }
}

/**
 * A string iterates into its characters, so without this every one of
 * them is reported as an event with a bad name: a believable message
 * about the wrong thing. It is a function of its own so `Array.isArray`
 * narrows its own parameter rather than the caller's typed list, which
 * it would widen to `any[]`.
 */
function assertIsList(events: unknown): void {
  if (!Array.isArray(events)) {
    throw new EmitError('emit: events must be an array');
  }
}

function assertCanonicalOrder(events: readonly ParsedEvent[]): void {
  /** The parser enforces this too; a programmatic caller would otherwise reach the byte writer. */
  if (events.length > MAX_CUSTOM_EVENT_COUNT) {
    throw new EmitError('emit: more events than the wire id space');
  }
  let previousId: number | undefined;
  const seenNames = new Set<string>();
  for (const event of events) {
    if (!isCustomEventId(event.id)) {
      throw new EmitError(`emit: "${event.name}" has an id outside the range`);
    }
    if (previousId !== undefined && event.id <= previousId) {
      throw new EmitError(`emit: "${event.name}" has an id out of order`);
    }
    if (seenNames.has(event.name)) {
      throw new EmitError(`emit: duplicate event name "${event.name}"`);
    }
    seenNames.add(event.name);
    previousId = event.id;
  }
}

/**
 * Reject an event whose `name` fails the parser's schema pattern /
 * length cap or would shadow a built-in report method, or whose `type`
 * is not one of the payload-type tags - the same three checks the parser
 * applies, so both boundaries accept exactly the same events.
 */
function assertEmittableEvent(event: ParsedEvent): void {
  if (!isWellFormedEventName(event.name)) {
    throw new EmitError(`emit: invalid event name "${String(event.name)}"`);
  }
  if (isReservedEventName(event.name)) {
    throw new EmitError(`emit: "${event.name}" is a reserved name (built-in report method)`);
  }
  if (!isCustomEventType(event.type)) {
    throw new EmitError(`emit: unsupported event type ${String(event.type)}`);
  }
}

/**
 * The same two guards again, on the identifier the target actually
 * declares. `assertEmittableEvent` and the duplicate check above compare
 * the event name, which is the emitted spelling only where the template
 * interpolates it unchanged. Where it does not, both go blind: Python
 * lower-cases and inserts underscores, so `Button_Click` reaches
 * `report_button_click` - the name its SDK already publishes - past a
 * reserved list that holds `ButtonClick`, and `LevelUp` with `Level_Up`
 * reach one definition twice, where Python keeps the last and every call
 * to the first is silently reported as the other event.
 *
 * Asked of every emitter rather than the one that transforms today, so a
 * target added later is guarded by default rather than by memory.
 */
function assertDistinctReporters({ events, emitter }: AssertDistinctReportersArgs): void {
  const reserved = new Set([...RESERVED_EVENT_NAMES].map((name) => emitter.reporterNameFor(name)));
  const owners = new Map<string, string>();
  for (const event of events) {
    const reporter = emitter.reporterNameFor(event.name);
    const owner = owners.get(reporter);
    if (owner !== undefined) {
      throw new ParseError(`emit: "${owner}" and "${event.name}" both emit ${reporter}`);
    }
    if (reserved.has(reporter)) {
      throw new ParseError(`emit: "${event.name}" emits ${reporter}, a built-in report method`);
    }
    owners.set(reporter, event.name);
  }
}

export {
  assertCanonicalOrder,
  assertDistinctReporters,
  assertEmittableEvent,
  assertEntryIsEvent,
  assertIsList,
};
