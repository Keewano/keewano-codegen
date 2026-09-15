/**
 * How one payload type appears in the generated Python.
 *
 * parameters - the wrapper's parameter list; empty for an event that
 *   carries no payload.
 * argument - what follows the id in the bridge call, comma included;
 *   empty for an event that carries no payload.
 * method - which bridge entry point the wrapper calls. Always present:
 *   Python has no overloading, so the entry point is named rather than
 *   chosen by argument type. Several payload types share one - a
 *   timestamp and a price are both unsigned numbers on the wire.
 */
interface PythonPayload {
  parameters: string;
  argument: string;
  method: string;
}

export type { PythonPayload };
