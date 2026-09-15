/**
 * Arguments of `describeFailure`.
 *
 * error - what was thrown.
 * exit - the code it already classified to, so the description and the
 *   status the caller returns cannot disagree about what kind of failure
 *   this was.
 */
interface DescribeFailureArgs {
  error: unknown;
  exit: number;
}

export type { DescribeFailureArgs };
