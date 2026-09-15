/**
 * Typed error hierarchy. The CLI routes exit codes via `instanceof`
 * checks (see `exitCode.ts`), so throw sites stamp the intent into the
 * type system instead of a magic message prefix.
 *
 * ParseError - JSON, schema, or file-content validation failed. CLI maps
 *   to `EXIT_CODES.VALIDATION` (1).
 * IoError - a filesystem operation failed: input missing, permission
 *   refused, write target unreachable. CLI maps to `EXIT_CODES.IO` (2).
 * EmitError - the emit boundary refused an event. CLI maps to
 *   `EXIT_CODES.INTERNAL` (3): the parser rejects everything a CLI user
 *   can get wrong, so reaching this one means the tool was handed input
 *   its own front door would not have passed.
 */
class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

class IoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IoError';
  }
}

class EmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmitError';
  }
}

export { EmitError, IoError, ParseError };
