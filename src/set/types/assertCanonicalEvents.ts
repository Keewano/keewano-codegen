/**
 * Arguments of `assertEntryIsEvent`.
 *
 * entry - the value sitting at that position in the caller's list, typed
 *   as unknown because the typed signature is a compile-time promise the
 *   caller may not have kept.
 * index - where it sits, so the message names the slot rather than the
 *   value, which may not be printable.
 */
interface AssertEntryIsEventArgs {
  entry: unknown;
  index: number;
}

export type { AssertEntryIsEventArgs };
