/**
 * The one place that knows what a Node filesystem error looks like:
 * an object carrying a string `code` such as `ENOENT` or `EACCES`.
 * Callers ask these predicates instead of sniffing the shape
 * themselves, so every site agrees on what counts as an I/O failure.
 *
 * CODE - the errno spellings the predicates compare against.
 *   NOT_FOUND - a missing file or directory.
 *   FS_PREFIX - what every code the filesystem raises starts with.
 *   NODE_PREFIX - Node's own error codes; programming errors, not I/O.
 *   NODE_FS_PREFIX - the exception: fs APIs throw these for I/O failures.
 *   UNKNOWN - what libuv reports when Windows returns a status it has no
 *     errno for (a locked file, a disconnected share). It is an I/O
 *     failure like any other, and the only one that does not start
 *     with `E`.
 */

const CODE = {
  NOT_FOUND: 'ENOENT',
  FS_PREFIX: 'E',
  NODE_PREFIX: 'ERR_',
  NODE_FS_PREFIX: 'ERR_FS_',
  UNKNOWN: 'UNKNOWN',
} as const;

function getErrnoCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

/**
 * The `E*` codes the filesystem raises (`ENOENT`, `EACCES`, `EISDIR`) and
 * Node's `ERR_FS_*` family; every other `ERR_*` code (`ERR_INVALID_ARG_TYPE`)
 * is a programming error and must surface as internal, not as I/O.
 */
function isFsErrnoError(error: unknown): boolean {
  const code = getErrnoCode(error) ?? '';
  if (code === CODE.UNKNOWN) return true;
  /** A prefix on its own is not a code. */
  if (!code.startsWith(CODE.FS_PREFIX) || code === CODE.FS_PREFIX) return false;
  return !code.startsWith(CODE.NODE_PREFIX) || code.startsWith(CODE.NODE_FS_PREFIX);
}

function isNotFoundError(error: unknown): boolean {
  return getErrnoCode(error) === CODE.NOT_FOUND;
}

export { getErrnoCode, isFsErrnoError, isNotFoundError };
