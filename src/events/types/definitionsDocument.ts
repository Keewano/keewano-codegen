import type { CustomEventTypeValue } from '../customEventType';

/**
 * Arguments of `definitionEntry`.
 *
 * name - the event name, written as `eventName`.
 * type - the payload tag, written as its wire name under `eventValueType`.
 */
interface DefinitionEntryArgs {
  name: string;
  type: CustomEventTypeValue;
}

export type { DefinitionEntryArgs };
