/**
 * Whether a name the user just typed may become an event, asked before
 * the file is written so a rejected name leaves it as it was.
 *
 * The shape and reserved-name rules are the parser's own, so a name this
 * accepts is one the next generate accepts too. The collision rules are
 * asked of every target rather than of the one the project generates
 * today: the definitions file is target-agnostic, and a name that is
 * distinct in TypeScript can merge with a neighbour once Python lowers
 * it. Catching that here costs nothing; catching it later means telling
 * someone their event set stopped generating because of a name they
 * committed weeks ago.
 *
 * Only the new name is judged. A set can already hold a pair that
 * collides under a target it does not generate for, and that set builds
 * perfectly well - so re-testing the pairs already on disk would refuse
 * an unrelated event over two others, naming neither the command nor
 * anything the caller can act on. What the whole set owes every target
 * is the generate path's question, on the target actually asked for.
 */

import type { AssertNameIsUsableArgs, AssertReporterIsFreeArgs } from './types/eventNameGuard';

import { TARGET_NAMES, getEmitter } from '../emitters/registry';
import { isReservedEventName, isWellFormedEventName } from '../events/eventName';
import { RESERVED_EVENT_NAMES } from '../events/reservedEventNames';
import { ParseError } from '../shared/errors';

function assertNameIsUsable({ name, events, replacing }: AssertNameIsUsableArgs): void {
  /**
   * Kept as a plain boolean: the check narrows an `unknown` for its
   * other caller, and letting it narrow a value already typed `string`
   * leaves `never` behind for the message below to interpolate.
   */
  const wellFormed: boolean = isWellFormedEventName(name);
  if (!wellFormed) {
    throw new ParseError(`event: "${name}" is not a PascalCase ASCII name`);
  }
  if (isReservedEventName(name)) {
    throw new ParseError(`event: "${name}" is a reserved name (built-in report method)`);
  }
  const others = events.filter((event) => event.name !== replacing);
  if (others.some((event) => event.name === name)) {
    throw new ParseError(`event: "${name}" is already defined`);
  }
  for (const target of TARGET_NAMES) {
    assertReporterIsFree({ name, others, emitter: getEmitter(target) });
  }
}

/**
 * The identifier this target would declare for the new name, checked
 * against what the set already declares and against the SDK's own report
 * surface. Both comparisons are on the emitted spelling rather than on
 * the event name, because that is what a target with a transform makes
 * one-to-many: `Button_Click` reaches `report_button_click`, the name
 * the SDK already publishes, past a reserved list holding `ButtonClick`.
 */
function assertReporterIsFree({ name, others, emitter }: AssertReporterIsFreeArgs): void {
  const reporter = emitter.reporterNameFor(name);
  for (const reserved of RESERVED_EVENT_NAMES) {
    if (emitter.reporterNameFor(reserved) === reporter) {
      throw new ParseError(`event: "${name}" emits ${reporter}, a built-in report method`);
    }
  }
  const owner = others.find((event) => emitter.reporterNameFor(event.name) === reporter);
  if (owner !== undefined) {
    throw new ParseError(`event: "${name}" and "${owner.name}" both emit ${reporter}`);
  }
}

export { assertNameIsUsable };
