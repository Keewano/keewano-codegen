import type { CustomEventTypeValue } from '../../events/customEventType';

/**
 * Arguments of `addEvent`.
 *
 * name - the event name.
 * type - the payload tag, already resolved from the name the user typed.
 * input - the definitions file the entry is appended to; created when
 *   there is none yet.
 */
interface AddEventArgs {
  name: string;
  type: CustomEventTypeValue;
  input: string;
}

export type { AddEventArgs };
