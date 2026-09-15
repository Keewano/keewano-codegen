/**
 * Comparing one declared signature with another.
 *
 * What a caller depends on differs by language, so there are two
 * normalizers rather than one. Kotlin calls positionally, so only the
 * types and their order matter and a parameter renamed upstream breaks
 * nothing. Swift puts the argument label in the call itself - the
 * generated file writes `KeewanoCustomEventSet(version:eventCount:gzipBase64:)`
 * literally - so there the label is part of the signature and only the
 * internal name behind it is free to change.
 */
'use strict';

/** Types and arity only: what a positional caller depends on. */
function normalizeByType(parameters) {
  return splitParameters(parameters)
    .map((parameter) => typeOf(parameter))
    .filter((type) => type !== '')
    .join(',');
}

/** Label and type: what a caller writing Swift argument labels depends on. */
function normalizeByLabel(parameters) {
  return splitParameters(parameters)
    .map((parameter) => `${labelOf(parameter)}:${typeOf(parameter)}`)
    .filter((entry) => entry !== ':')
    .join(',');
}

/** One parameter each, with default values dropped: a default is not part of the call. */
function splitParameters(parameters) {
  return parameters.replaceAll(/=[^,)]+/g, '').split(',');
}

/**
 * The type of one parameter. Swift writes `_ value: Int32` and Kotlin
 * `value: Int`; both put the type after the last colon, and a parameter
 * with no colon carries no type to compare.
 */
function typeOf(parameter) {
  const at = parameter.lastIndexOf(':');
  if (at < 0) return '';
  return parameter.slice(at + 1).trim();
}

/**
 * The label a Swift caller writes. `_ value: Int32` is called without
 * one, `version: UInt32` is called with `version:`, and `to name: X`
 * with `to:` - so the label is the first word before the colon when
 * there are two, and the only word when there is one.
 */
function labelOf(parameter) {
  const at = parameter.lastIndexOf(':');
  if (at < 0) return '';
  return (
    parameter
      .slice(0, at)
      .trim()
      .split(' ')
      .find((word) => word !== '') ?? ''
  );
}

module.exports = { normalizeByLabel, normalizeByType };
