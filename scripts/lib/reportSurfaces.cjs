/**
 * Where each SDK publishes its public `report*` API, and how a public
 * member is spelled there.
 *
 * A member of a public type is indented one level, so every pattern
 * anchors on that: it keeps them linear, and it excludes the internal
 * declarations a customer cannot reach - which is the point, since only a
 * public method can be shadowed by a generated wrapper.
 *
 * These are facts about three other checkouts - the TypeScript monorepo,
 * which publishes three of the surfaces, and the two native SDKs - so
 * they move when one of those moves a file or reformats a declaration,
 * not when the comparison in check-reserved-names.cjs changes.
 */
'use strict';

const { snakeCase } = require('./pythonBridge.cjs');
const { PYTHON_SOURCE } = require('./sourceProfiles.cjs');

/** A surface that yields fewer than this stopped being read; that is an error, not a pass. */
const MINIMUM_METHODS_PER_SURFACE = 5;

/**
 * Python publishes `report_button_click` where the reserved list says
 * `ButtonClick`, and case conversion does not round-trip - `ABTestGroupAssignment`
 * flattens to `ab_test_group_assignment`, which naive capitalization would
 * bring back as `AbTestGroupAssignment` and report as unguarded. So a
 * published snake name is matched by converting the RESERVED side down,
 * and only a name no reserved entry flattens to gets the naive spelling -
 * which is then exactly the unguarded finding it should be.
 */
function pascalForSnake(published, reservedNames) {
  const guarded = [...reservedNames].find((name) => snakeCase(name) === published);
  if (guarded !== undefined) return guarded;
  return published
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** The three TypeScript SDKs spell a public member alike; each entry still gets its own matcher. */
const TS_MEMBER = String.raw`^ {2}report([A-Z]\w*)\(`;

const REPORT_SURFACES = [
  {
    id: 'typescript/react-native',
    suffixes: ['packages/react-native-sdk/src/types/keewano.ts'],
    overrideEnv: 'KEEWANO_TS_SDK',
    pattern: new RegExp(TS_MEMBER, 'gm'),
  },
  {
    id: 'typescript/web',
    suffixes: ['packages/web-sdk/src/types/keewano.ts'],
    overrideEnv: 'KEEWANO_TS_SDK',
    pattern: new RegExp(TS_MEMBER, 'gm'),
  },
  {
    /** The per-user surface and the relay's own call live in different files. */
    id: 'typescript/node',
    suffixes: ['packages/node-sdk/src/types/relay.ts', 'packages/node-sdk/src/types/keewano.ts'],
    overrideEnv: 'KEEWANO_TS_SDK',
    pattern: new RegExp(TS_MEMBER, 'gm'),
  },
  {
    id: 'ios',
    suffixes: ['Sources/KeewanoSDK/KeewanoSDK.swift'],
    overrideEnv: 'KEEWANO_IOS_SDK',
    pattern: /^ {4}public static func report([A-Z]\w*)\(/gm,
  },
  {
    /**
     * Kotlin publishes by default, so a bare `fun` counts and `internal`
     * or `private` fails the anchor. `public fun` is equally valid and
     * equally published, and reading it takes naming it: a method the
     * pattern does not see is one never compared against the reserved
     * list, which is silent in both directions.
     */
    id: 'android',
    suffixes: ['keewano-sdk/src/main/kotlin/com/keewano/sdk/KeewanoSDK.kt'],
    overrideEnv: 'KEEWANO_ANDROID_SDK',
    pattern: /^ {4}(?:public )?fun report([A-Z]\w*)\(/gm,
  },
  {
    /**
     * Module-level defs at column zero; a leading underscore is Python's
     * private-by-convention and fails the anchor. The bridge's own
     * report_custom_event* entry points live in codegen.py, not here.
     */
    id: 'python',
    suffixes: ['keewano_sdk/sdk.py'],
    overrideEnv: 'KEEWANO_PYTHON_SDK',
    pattern: /^def report_([a-z0-9_]+)\(/gm,
    strip: PYTHON_SOURCE,
    toCanonical: pascalForSnake,
  },
];

module.exports = { MINIMUM_METHODS_PER_SURFACE, REPORT_SURFACES };
