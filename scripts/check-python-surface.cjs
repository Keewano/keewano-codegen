/**
 * Compare the Python surface in `conformance/__sdk-surfaces/keewano_sdk.py`
 * against what the Python SDK publishes: the seven bridge entry points the
 * generated wrappers call, and the `from_gzip_base64` constructor the
 * generated set is built with.
 *
 * Executing the recorded vectors against our stub proves they agree with
 * it; nothing proves the stub agrees with the SDK, so a rename upstream
 * would leave a green check over a generated file no customer can run.
 *
 * The two compared files are resolved as one checkout, found by the paths
 * they carry inside their own repository, never by what the checkout is
 * called here - see find-upstream.cjs.
 *
 * Usage: npm run check:surfaces   (KEEWANO_SDKS_DIR names a directory of
 * checkouts, KEEWANO_PYTHON_SDK points at one or at either compared file;
 * KEEWANO_ALLOW_SKIP=1 accepts a run that verified nothing)
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const { findUpstreamCheckout } = require('./find-upstream.cjs');
const { stampFor } = require('./lib/checkoutStamp.cjs');
const { reportMissing } = require('./lib/compareSurfaces.cjs');
const { readOwnFile } = require('./lib/ownFile.cjs');
const { bareDeclarations, readBridgeSignatures } = require('./lib/pythonBridge.cjs');

const ROOT = resolve(__dirname, '..');
const SDKS_DIR = process.env.KEEWANO_SDKS_DIR;
const UPSTREAM_BRIDGE = 'keewano_sdk/codegen.py';
const UPSTREAM_SET = 'keewano_sdk/internal/custom_event_set.py';
const OURS_PYTHON = 'conformance/__sdk-surfaces/keewano_sdk.py';
const PYTHON_VECTOR = 'conformance/single-event/expected/python.generated.py';

/** What every generated file writes down literally; a rename upstream is a broken run. */
const SET_CONSTRUCTOR = 'from_gzip_base64';
const GENERATED_IMPORT = 'from keewano_sdk import CustomEventSet, KeewanoCodegen';

/**
 * A surface that reads as empty is never a pass. Upstream it means the file
 * moved or changed shape and this stopped reading it; on our side it means
 * there was nothing to compare. Both are silent otherwise, because an empty
 * list agrees with everything.
 */
function assertRead({ entryPoints, path }) {
  if (entryPoints.length > 0) return;
  throw new Error(
    `python: read no bridge entry points out of ${path}, so there was nothing to compare`,
  );
}

/** The constructor the generated set is built with, read as a declaration, not prose. */
function checkSetConstructor(source) {
  if (new RegExp(String.raw`def ${SET_CONSTRUCTOR}\(`).test(bareDeclarations(source))) return 0;
  console.error(
    `python: the SDK no longer declares ${SET_CONSTRUCTOR}, which every generated file calls`,
  );
  return 1;
}

/** The import line and the constructor call are claims about our own emitter; the vector shows them. */
function checkVector() {
  const vector = readOwnFile({ path: PYTHON_VECTOR, wantedFor: 'the seam it writes against' });
  let broken = 0;
  if (!vector.includes(GENERATED_IMPORT)) {
    console.error(`python: the recorded vectors no longer write "${GENERATED_IMPORT}"`);
    broken += 1;
  }
  if (!vector.includes(`.${SET_CONSTRUCTOR}(`)) {
    console.error(`python: the recorded vectors no longer call ${SET_CONSTRUCTOR}`);
    broken += 1;
  }
  return broken;
}

/** @param {string[]} paths - the bridge and the set constructor, one checkout. */
function comparePython([bridgePath, setPath]) {
  const upstream = readBridgeSignatures(readFileSync(bridgePath, 'utf8'));
  const ours = readBridgeSignatures(
    readOwnFile({ path: OURS_PYTHON, wantedFor: 'the surface it compares' }),
  );
  assertRead({ entryPoints: upstream, path: UPSTREAM_BRIDGE });
  assertRead({ entryPoints: ours, path: OURS_PYTHON });
  const stamp = stampFor(bridgePath);
  const missing = reportMissing({ label: 'python', kind: 'bridge', ours, upstream, stamp });
  console.log(
    `python: ${ours.length - missing} of ${upstream.length} bridge entry points mirrored ` +
      `from ${stamp}`,
  );
  return missing + checkSetConstructor(readFileSync(setPath, 'utf8'));
}

const python = findUpstreamCheckout({
  suffixes: [UPSTREAM_BRIDGE, UPSTREAM_SET],
  overrideEnv: 'KEEWANO_PYTHON_SDK',
  repoRoot: ROOT,
  sdksDirectory: SDKS_DIR,
});

let status = 0;
if (python.paths === null) {
  console.error(
    `python: no checkout carrying ${UPSTREAM_BRIDGE} and ${UPSTREAM_SET} was found, so the ` +
      `surface was not compared - looked under ${python.searched.join(', ')}` +
      (python.nearMiss === undefined ? '' : `; ${python.nearMiss}`),
  );
  /** A typo in a variable somebody set on purpose is never an unverified run to accept. */
  if (python.overrideFailed === true || process.env.KEEWANO_ALLOW_SKIP !== '1') status = 1;
} else {
  status = comparePython(python.paths);
}

status += checkVector();

process.exit(status === 0 ? 0 : 1);
