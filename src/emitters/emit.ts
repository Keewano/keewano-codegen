/**
 * The generation entry point: validate the input at the boundary, build
 * the set through the frozen core, hand both to the emitter registered
 * for the target. It builds rather than accepting a built set, so a
 * caller cannot hand it a set assembled for a different event list.
 * Everything language-specific lives under `emitters/`; this file knows
 * nothing about any target's syntax.
 *
 * The output is deterministic: same `events` + `target` -> byte-identical
 * text. No timestamps, no nondeterministic byte literals.
 */

import type { EmitGeneratedSourceArgs } from './types/emit';

import { buildCustomEventSet } from '../set/buildCustomEventSet';
import { EmitError } from '../shared/errors';

import {
  assertCanonicalOrder,
  assertDistinctReporters,
  assertEmittableEvent,
  assertEntryIsEvent,
  assertIsList,
} from './assertEmittable';
import { DEFAULT_TARGET, getEmitter, isEmitTarget } from './registry';

/**
 * The default is written into the parameter, not applied after it: a
 * destructuring default fires on an absent property and on nothing else. `??`
 * or `||` would take `null` for absent too, and a build script reading a
 * nullable config field would then get react-native wrappers where it asked for
 * nothing - the one bad value that produces an artifact instead of an error.
 */
function emitGeneratedSource({
  events,
  target: resolvedTarget = DEFAULT_TARGET,
}: EmitGeneratedSourceArgs): string {
  /**
   * `target` is typed, but the programmatic entry point can be called
   * from untyped JS; `isEmitTarget` checks own keys only so
   * prototype-chain names cannot slip through.
   */
  if (!isEmitTarget(resolvedTarget)) {
    throw new EmitError(`emit: unsupported target "${String(resolvedTarget)}"`);
  }
  /**
   * The CLI path always feeds parser-validated events, but the
   * programmatic entry point can be handed anything, so the same checks
   * run here - the shape first. A string iterates into its characters,
   * and each one would otherwise be reported as an event with a bad
   * name: a plausible message about the wrong thing.
   */
  assertIsList(events);
  for (const [index, event] of events.entries()) {
    assertEntryIsEvent({ entry: event, index });
    assertEmittableEvent(event);
  }
  assertCanonicalOrder(events);
  const emitter = getEmitter(resolvedTarget);
  /**
   * The guards above compare event names; this one compares the
   * identifiers the chosen target will actually declare, which are the
   * same strings only where the template interpolates a name unchanged.
   * It runs after the target is resolved because only the emitter knows
   * how it spells them.
   */
  assertDistinctReporters({ events, emitter });
  /**
   * The map is built here, from exactly the events being rendered. A
   * caller that filtered or reordered a parsed list and handed in a set
   * built earlier would get wrappers whose names no longer line up with
   * the ids inside the map, and every event of that build would arrive
   * under a neighbour's name - with nothing in the file looking wrong.
   * One extra gzip pass per run buys that away.
   */
  return emitter.emit({ events, built: buildCustomEventSet(events) });
}

export { emitGeneratedSource };
