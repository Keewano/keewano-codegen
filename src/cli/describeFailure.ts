/**
 * How one failure is written out, shared by every path that ends in a
 * message on stderr.
 *
 * A validation or I/O failure is the user's to fix, so it gets the one
 * line that says what went wrong; an internal failure asks for a bug
 * report, and a report without the stack is not worth filing.
 */

import type { DescribeFailureArgs } from './types/describeFailure';

import { stringifyError } from '../shared/stringifyError';

import { EXIT_CODES } from './exitCode';

function describeFailure({ error, exit }: DescribeFailureArgs): string {
  const message = stringifyError(error);
  if (exit !== EXIT_CODES.INTERNAL) return message;
  return error instanceof Error && error.stack !== undefined ? error.stack : message;
}

export { describeFailure };
