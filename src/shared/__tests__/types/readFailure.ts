/**
 * Arguments of `mockReadFailure`.
 *
 * pathSuffix - reads of paths ending in this fail; others pass through.
 * code - the errno code the simulated failure carries.
 */
interface MockReadFailureArgs {
  pathSuffix: string;
  code: string;
}

export type { MockReadFailureArgs };
