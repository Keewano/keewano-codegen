import type { CustomEventDataTypeName, CustomEventTypeValue } from '../customEventType';

/**
 * One entry of the definitions file, as written.
 *
 * eventName - event name; becomes an identifier in every target language.
 * eventValueType - payload type, spelled as the help prints it (`none`,
 *   `string`, `uint`, `bool`, `timestamp`, `ushortvec2`, `price_usd_cent`).
 */
interface RawEventDefinition {
  eventName: string;
  eventValueType: CustomEventDataTypeName;
}

/**
 * On-disk shape of the definitions file, `keewano.events.json`.
 *
 * events - every event, in declaration order. The position is the id.
 */
interface RawEventDefinitions {
  events: RawEventDefinition[];
}

/**
 * A validated event after parsing.
 *
 * name - event name, as declared.
 * type - CustomEventType tag resolved from `eventValueType`.
 * id - wire event id: the first reserved id plus the entry's position in
 *   the file. It is not stored anywhere, so it moves when an entry before
 *   it is removed - which is why the file says to append only.
 */
interface ParsedEvent {
  name: string;
  type: CustomEventTypeValue;
  id: number;
}

export type { ParsedEvent, RawEventDefinition, RawEventDefinitions };
