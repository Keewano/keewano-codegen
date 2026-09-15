/**
 * Strict ordinal (UTF-16 code-unit) string comparator. `localeCompare`
 * would make any order that feeds a wire id depend on the machine's
 * collation; this one orders the same on every machine.
 */
function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export { compareOrdinal };
