/**
 * Coerce an `unknown` throw value into a readable string for terse
 * error messages, so every catch site produces the same diagnostic for
 * the same thrown shape: an `Error` gives its message, an object its
 * JSON (or its tag when it cannot be serialised), and anything else the
 * string form it already has.
 */

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || error === null) return String(error);
  try {
    return JSON.stringify(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

export { stringifyError };
