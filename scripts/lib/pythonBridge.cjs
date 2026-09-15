/**
 * The bridge entry points a Python source publishes, as signatures that can
 * be compared between two checkouts, and the name spelling the generated
 * wrappers share with the SDK.
 *
 * Python documents its API in docstrings and `#` comments, so both are
 * blanked before matching - a def spelled inside a docstring reads exactly
 * like the declaration it describes. A leading underscore never matches:
 * that is Python's private-by-convention, the closest thing it has to a
 * withdrawn visibility.
 */
'use strict';

const { normalizeByType } = require('./signature.cjs');
const { PYTHON_SOURCE } = require('./sourceProfiles.cjs');
const { stripComments } = require('./sourceText.cjs');

/**
 * No indentation anchor: with docstrings and comments blanked first, a
 * `def` can only be a real declaration, and the name must start right
 * after it - which is also what keeps `_`-prefixed, private-by-convention
 * entry points from matching.
 */
const BRIDGE_DECLARATION = /\bdef (report_custom_event\w*)\(([^)]*)\)/g;

/** The Python source with its docstrings and comments blanked. */
const bareDeclarations = (source) => stripComments(source, PYTHON_SOURCE);

/**
 * Every bridge entry point in `source`, each as `name(types)` - the
 * generated wrappers call positionally, so types and arity are what a
 * rename upstream cannot hide behind.
 */
function readBridgeSignatures(source) {
  return [...bareDeclarations(source).matchAll(BRIDGE_DECLARATION)].map(
    (match) => `${match[1]}(${normalizeByType(match[2])})`,
  );
}

/**
 * `EnemyKilled` -> `enemy_killed`: the same conversion the Python emitter
 * applies to wrapper names. Duplicated from src/emitters/python/python.ts
 * because scripts do not load TypeScript; the parity test in
 * scripts/__tests__ compares the two over the whole reserved list, so
 * they cannot drift apart silently.
 */
function snakeCase(name) {
  return name
    .replaceAll(/(?<=[a-z0-9])(?=[A-Z])/g, '_')
    .replaceAll(/(?<=[A-Z])(?=[A-Z][a-z])/g, '_')
    .toLowerCase();
}

module.exports = { bareDeclarations, readBridgeSignatures, snakeCase };
