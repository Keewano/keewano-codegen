/**
 * What makes a string usable as an event name, in one place, because
 * two boundaries ask: the parser (against the definitions file) and the
 * emit entry point (against objects a build script hands in). The shape
 * rules come from `keewano-events.schema.json` itself, so the two can
 * never drift; the reserved list is the SDK's own report surface.
 *
 * A name is interpolated into identifier and string-literal positions
 * of the generated source, so anything outside the schema pattern
 * would produce a broken wrapper or inject code into the output.
 */

import schema from '../../schemas/keewano-events.schema.json';

import { RESERVED_EVENT_NAMES } from './reservedEventNames';

const NAME_RULES = schema.properties.events.items.properties.eventName;
const EVENT_NAME_PATTERN = new RegExp(NAME_RULES.pattern);
const EVENT_NAME_MAX_LENGTH = NAME_RULES.maxLength;

/** True for a name the schema accepts (shape and length). */
function isWellFormedEventName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length <= EVENT_NAME_MAX_LENGTH &&
    EVENT_NAME_PATTERN.test(name)
  );
}

/** True for a name whose `report<Name>` wrapper would shadow a built-in one. */
function isReservedEventName(name: string): boolean {
  return RESERVED_EVENT_NAMES.has(name);
}

export { isReservedEventName, isWellFormedEventName };
