/**
 * The exit-code contract and the one mapping onto it. A CI script
 * branches on these numbers, so both the table and the classifier
 * change only when the contract does.
 *
 * EXIT_CODES - documented contract:
 *   OK         - emit succeeded (or no-op when output already matches).
 *   VALIDATION - input rejected by schema / coherence checks (`ParseError`).
 *   IO         - filesystem operation failed (`IoError`).
 *   INTERNAL   - unexpected error (`EmitError` or unknown throw type).
 */

import { isFsErrnoError } from '../shared/errno';
import { EmitError, IoError, ParseError } from '../shared/errors';

const EXIT_CODES = {
  OK: 0,
  VALIDATION: 1,
  IO: 2,
  INTERNAL: 3,
} as const;

/**
 * Typed error classes win first; a raw filesystem errno is routed to
 * IO; anything else is an internal failure, including Node's own
 * `ERR_*` programming errors.
 */
function classifyExitCode(error: unknown): number {
  if (error instanceof ParseError) return EXIT_CODES.VALIDATION;
  if (error instanceof IoError) return EXIT_CODES.IO;
  if (error instanceof EmitError) return EXIT_CODES.INTERNAL;
  if (isFsErrnoError(error)) return EXIT_CODES.IO;
  return EXIT_CODES.INTERNAL;
}

export { EXIT_CODES, classifyExitCode };
