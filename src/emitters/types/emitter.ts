import type { BuiltEvents } from '../../set/types/buildCustomEventSet';

/**
 * One language template. `emit` renders the whole generated file as
 * text from the parsed events and the set the core already built; an
 * emitter never rebuilds bytes or hashes itself. The output must be
 * deterministic - the same input renders byte-identical text - because
 * the file lives in customer repositories and is diffed on every
 * regeneration. Which target an emitter answers to is the registry's
 * business, not the emitter's.
 */
interface Emitter {
  emit(input: BuiltEvents): string;
  /**
   * The identifier this target's generated file declares for an event of
   * that name - what a customer ends up calling. Every emitter answers,
   * including the ones that interpolate the name unchanged, because the
   * boundary's uniqueness and reserved-name guards have to compare the
   * spelling that is emitted rather than the name it came from: a target
   * whose spelling is many-to-one turns two events into one definition,
   * and the raw-name guards cannot see it.
   */
  reporterNameFor(name: string): string;
}

export type { Emitter };
