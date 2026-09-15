import type { Emitter } from '../../emitters/types/emitter';
import type { ParsedEvent } from '../../events/types/event';

/**
 * Arguments of `assertNameIsUsable`.
 *
 * name - the spelling the user typed, before anything is written.
 * events - the definitions already in the file, as parsed. The new
 *   name is checked against these rather than against the file listing,
 *   so a name that only collides after a target transforms it is caught.
 * replacing - the event the name is taking over from, when one is being
 *   renamed. Left out for `add`. Its own entry is dropped before the
 *   comparison, so renaming an event to a spelling only it holds is not
 *   reported as a collision with itself.
 */
interface AssertNameIsUsableArgs {
  name: string;
  events: readonly ParsedEvent[];
  replacing?: string;
}

/**
 * Arguments of `assertReporterIsFree`.
 *
 * name - the spelling the user typed.
 * others - the definitions the new name has to stand apart from, with
 *   the one being renamed already dropped.
 * emitter - the target whose spelling of these names is being compared.
 */
interface AssertReporterIsFreeArgs {
  name: string;
  others: readonly ParsedEvent[];
  emitter: Emitter;
}

export type { AssertNameIsUsableArgs, AssertReporterIsFreeArgs };
