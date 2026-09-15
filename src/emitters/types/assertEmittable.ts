import type { Emitter } from './emitter';
import type { ParsedEvent } from '../../events/types/event';

/**
 * Arguments of `assertEntryIsEvent`.
 *
 * entry - the value sitting at that position in the caller's list, typed
 *   as unknown because the typed signature is a promise the caller may
 *   not have kept.
 * index - where it sits, so the message names the slot rather than the
 *   value, which may not be printable.
 */
interface AssertEntryIsEventArgs {
  entry: unknown;
  index: number;
}

/**
 * Arguments of `assertDistinctReporters`.
 *
 * events - the list about to be rendered.
 * emitter - the one that will render it; only it knows how it spells the
 *   identifier it declares for a name.
 */
interface AssertDistinctReportersArgs {
  events: readonly ParsedEvent[];
  emitter: Emitter;
}

export type { AssertDistinctReportersArgs, AssertEntryIsEventArgs };
