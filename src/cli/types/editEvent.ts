/**
 * Arguments of `editEvent`.
 *
 * name - the event to change, as it is named today.
 * rename - the name it takes instead. The position, and so the id, and
 *   the payload type are carried over untouched: the id is what past data
 *   was recorded under, and a payload type that changed would reinterpret
 *   that data.
 * input - the definitions file.
 */
interface EditEventArgs {
  name: string;
  rename: string;
  input: string;
}

export type { EditEventArgs };
