/** The shape Node throws for a filesystem failure: an Error with a string `code`. */
function makeErrnoError(code: string): Error {
  return Object.assign(new Error(`${code}: simulated failure`), { code });
}

export { makeErrnoError };
