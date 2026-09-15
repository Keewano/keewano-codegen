/**
 * How one payload type appears in the generated Kotlin.
 *
 * parameters - the wrapper's parameter list; empty for an event that
 *   carries no payload.
 * argument - what follows the id in the bridge call, comma included;
 *   empty for an event that carries no payload.
 * method - the bridge method the wrapper calls, when the payload does not
 *   travel through the one every other type uses.
 */
interface KotlinPayload {
  parameters: string;
  argument: string;
  method?: string;
}

export type { KotlinPayload };
