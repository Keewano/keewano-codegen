/**
 * Arguments of `assertIntInRange`.
 *
 * functionName - the writer method the check guards, for the message.
 * value - the number under test.
 * max - inclusive upper bound; the lower bound is always 0.
 */
interface AssertIntInRangeArgs {
  functionName: string;
  value: number;
  max: number;
}

export type { AssertIntInRangeArgs };
