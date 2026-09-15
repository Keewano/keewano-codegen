/**
 * The recorded vectors are generated files, so each one imports the SDK
 * it was generated for. This repository depends on no SDK, by design -
 * the generator must not be able to reach into one - so those imports
 * resolve to nothing and an editor marks every vector as broken code.
 *
 * These declarations are the surface the README states a host SDK must
 * offer: a `CustomEventSet` and a `reportCustomEvent` the wrappers
 * forward to. Nothing here describes a real SDK's implementation; it
 * describes what a generated file is allowed to use, so a vector that
 * called something else would stop compiling here.
 *
 * Mirrors the TypeScript SDK: packages/core/src/reports/types/customEvents.ts
 * (CustomEventValue), packages/core/src/events/customEventType.ts
 * (CustomEventTypeValue), packages/core/src/network/types/customEventSet.ts.
 * Checked 2026-08-20. A rename upstream is caught here only by re-checking:
 * this file cannot see that repository.
 */

/**
 * The payload union the bridge accepts, as the SDK declares it. Widening
 * it to `unknown` costs the check its teeth: a wrapper handing the bridge
 * an object literal the SDK cannot encode would compile clean.
 */
type KeewanoCustomEventValue = string | number | boolean | Date | { x: number; y: number };

/** The payload type ids, closed the way the SDK's own union is closed. */
type KeewanoCustomEventTypeValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The set the generated module exports for the SDK's init call. */
interface KeewanoCustomEventSet {
  version: number;
  eventCount: number;
  gzipData: Uint8Array;
  events: readonly { id?: number; name: string; type: KeewanoCustomEventTypeValue }[];
}

/** The bridge every generated wrapper forwards to. */
interface KeewanoCustomEventReporter {
  reportCustomEvent(event: { name: string; value?: KeewanoCustomEventValue }): void;
}

declare module '@keewano/react-native-sdk' {
  export type CustomEventSet = KeewanoCustomEventSet;
  export const Keewano: KeewanoCustomEventReporter;
}

declare module '@keewano/react-native-expo-sdk' {
  export type CustomEventSet = KeewanoCustomEventSet;
  export const Keewano: KeewanoCustomEventReporter;
}

declare module '@keewano/web-sdk' {
  export type CustomEventSet = KeewanoCustomEventSet;
  export const Keewano: KeewanoCustomEventReporter;
}

declare module '@keewano/node-sdk' {
  export type CustomEventSet = KeewanoCustomEventSet;
  export type UserReporter = KeewanoCustomEventReporter;
}
