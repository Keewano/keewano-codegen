/**
 * How one payload type appears in the generated Swift.
 *
 * parameters - the wrapper's parameter list; empty for an event that
 *   carries no payload.
 * argument - what follows the id in the bridge call, comma included;
 *   empty for an event that carries no payload.
 */
interface SwiftPayload {
  parameters: string;
  argument: string;
  method?: string;
}

export type { SwiftPayload };
