/**
 * Compare the Kotlin surface in `conformance/__sdk-surfaces/KeewanoSDK.kt`
 * against what the Android SDK publishes, and pin the two names the generated
 * artifacts depend on: the asset the SDK looks up at launch, and the package
 * the reporters are emitted under.
 *
 * Compiling the recorded vectors proves they agree with our stub; nothing
 * proves the stub agrees with the SDK, so a rename upstream would leave a green
 * check over a generated file no customer can build.
 *
 * The three compared files are resolved as one checkout, found by the paths
 * they carry inside their own repository, never by what the checkout is
 * called here - see find-upstream.cjs.
 *
 * Usage: npm run check:surfaces   (KEEWANO_SDKS_DIR names a directory of
 * checkouts, KEEWANO_ANDROID_SDK points at one or at any compared file;
 * KEEWANO_ALLOW_SKIP=1 accepts a run that verified nothing)
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const { findUpstreamCheckout } = require('./find-upstream.cjs');
const { checkAssetContract } = require('./lib/androidAsset.cjs');
const { stampFor } = require('./lib/checkoutStamp.cjs');
const { reportMissing } = require('./lib/compareSurfaces.cjs');
const { checkEntryPoint } = require('./lib/entryPoint.cjs');
const { declaresPublishedObject, readBridgeSignatures } = require('./lib/kotlinBridge.cjs');
const { readOwnFile } = require('./lib/ownFile.cjs');
const { stripComments } = require('./lib/sourceText.cjs');

const ROOT = resolve(__dirname, '..');
const SDKS_DIR = process.env.KEEWANO_SDKS_DIR;
const UPSTREAM_KOTLIN = 'keewano-sdk/src/main/kotlin/com/keewano/sdk/KeewanoCodegen.kt';
const UPSTREAM_KOTLIN_ENTRY = 'keewano-sdk/src/main/kotlin/com/keewano/sdk/KeewanoSDK.kt';
const UPSTREAM_ASSET = 'keewano-sdk/src/main/kotlin/com/keewano/sdk/internal/KCustomEventsAsset.kt';
const OURS_KOTLIN = 'conformance/__sdk-surfaces/KeewanoSDK.kt';
const KOTLIN_VECTOR = 'conformance/single-event/expected/kotlin.generated.kt';

const KOTLIN_GENERATED_PACKAGE = 'com.keewano.sdk.generated';

/** The type every generated file imports by name; a rename upstream is a broken build. */
const BRIDGE_TYPE = 'KeewanoCodegen';

/**
 * A surface that reads as empty is never a pass. Upstream it means the file
 * moved or changed shape and this stopped reading it; on our side it means
 * there was nothing to compare. Both are silent otherwise, because an empty
 * list agrees with everything.
 */
function assertRead({ overloads, path }) {
  if (overloads.length > 0) return;
  throw new Error(
    `android: read no bridge overloads out of ${path}, so there was nothing to compare`,
  );
}

/**
 * The type the generated files import, which a rename upstream would break -
 * and so would a visibility narrowing: `internal object` still carries the
 * name, but a customer's module can no longer import it.
 */
function checkBridgeType(source) {
  if (declaresPublishedObject({ source, name: BRIDGE_TYPE })) return 0;
  console.error(
    `android: the SDK no longer publishes ${BRIDGE_TYPE}, which every generated file imports`,
  );
  return 1;
}

/** @param {string[]} paths - the bridge, the entry point and the asset reader, one checkout. */
function compareKotlin([bridgePath, entryPath, assetPath]) {
  const upstreamSource = stripComments(readFileSync(bridgePath, 'utf8'));
  const upstream = readBridgeSignatures(upstreamSource);
  const ours = readBridgeSignatures(
    readOwnFile({ path: OURS_KOTLIN, wantedFor: 'the surface it compares' }),
  );
  assertRead({ overloads: upstream, path: UPSTREAM_KOTLIN });
  assertRead({ overloads: ours, path: OURS_KOTLIN });
  const stamp = stampFor(bridgePath);
  const missing = reportMissing({ label: 'kotlin', kind: 'bridge', ours, upstream, stamp });
  console.log(
    `android: ${ours.length - missing} of ${upstream.length} bridge overloads mirrored from ${stamp}`,
  );
  return (
    missing +
    checkBridgeType(upstreamSource) +
    checkAssetContract({ path: assetPath }) +
    checkEntryPoint({
      label: 'android',
      path: entryPath,
      declaration: /^(?:public )?object (\w+)/m,
      vector: KOTLIN_VECTOR,
      extend: (name) => `fun ${name}.report`,
    })
  );
}

/** The fixed package is a claim about our own emitter; the vectors are where it shows. */
function checkGeneratedPackage() {
  const vector = readOwnFile({ path: KOTLIN_VECTOR, wantedFor: 'the package it pins' });
  if (vector.includes(`package ${KOTLIN_GENERATED_PACKAGE}`)) return 0;
  console.error(`kotlin: the recorded vectors no longer declare ${KOTLIN_GENERATED_PACKAGE}`);
  return 1;
}

const kotlin = findUpstreamCheckout({
  suffixes: [UPSTREAM_KOTLIN, UPSTREAM_KOTLIN_ENTRY, UPSTREAM_ASSET],
  overrideEnv: 'KEEWANO_ANDROID_SDK',
  repoRoot: ROOT,
  sdksDirectory: SDKS_DIR,
});

let status = 0;
if (kotlin.paths === null) {
  console.error(
    `android: no checkout carrying ${UPSTREAM_KOTLIN} and its entry point and asset reader was ` +
      `found, so the surface was not compared - looked under ${kotlin.searched.join(', ')}` +
      (kotlin.nearMiss === undefined ? '' : `; ${kotlin.nearMiss}`),
  );
  /** A typo in a variable somebody set on purpose is never an unverified run to accept. */
  if (kotlin.overrideFailed === true || process.env.KEEWANO_ALLOW_SKIP !== '1') status = 1;
} else {
  status = compareKotlin(kotlin.paths);
}

status += checkGeneratedPackage();

process.exit(status === 0 ? 0 : 1);
