/**
 * Compare the surfaces in `conformance/__sdk-surfaces/` against the declarations
 * the SDKs actually publish. Compiling the recorded vectors proves they agree
 * with those files; nothing proved the files agree with the SDKs, so a rename
 * upstream would leave a green check over a generated file no customer can
 * build. This reads the upstream declarations and fails on any our surface
 * claims that upstream does not have.
 *
 * It is a comparison of declarations, not a build. Building the real iOS SDK
 * needs macOS, and the real Android module needs Gradle and the Android
 * framework, so the end-to-end check belongs in those repositories. This is
 * what can be done from here, and it is the difference between a transcription
 * and a comparison.
 *
 * The two compared files are resolved as one checkout, found by the paths
 * they carry inside their own repository, never by what the checkout is
 * called here - see find-upstream.cjs.
 *
 * Usage: npm run check:surfaces   (KEEWANO_SDKS_DIR names a directory of
 * checkouts, KEEWANO_IOS_SDK points at the iOS one or at either compared
 * file; KEEWANO_ALLOW_SKIP=1 accepts a run that verified nothing)
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const { findUpstreamCheckout } = require('./find-upstream.cjs');
const { stampFor } = require('./lib/checkoutStamp.cjs');
const { reportMissing } = require('./lib/compareSurfaces.cjs');
const { checkEntryPoint } = require('./lib/entryPoint.cjs');
const { readOwnFile } = require('./lib/ownFile.cjs');
const { assertRead, declaresType, readDeclarations } = require('./lib/swiftSurface.cjs');

const ROOT = resolve(__dirname, '..');
const SDKS_DIR = process.env.KEEWANO_SDKS_DIR;
const UPSTREAM_SWIFT = 'Sources/KeewanoSDK/KeewanoCustomEvents.swift';
const UPSTREAM_SWIFT_ENTRY = 'Sources/KeewanoSDK/KeewanoSDK.swift';
const OURS_SWIFT = 'conformance/__sdk-surfaces/KeewanoSDK.swift';
const SWIFT_VECTOR = 'conformance/single-event/expected/swift.generated.swift';

/**
 * The type names a generated file writes down. Comparing only the signatures
 * leaves a rename of either of these behind a green check while every emitted
 * file stops compiling, because the file names both of them literally.
 */
const REFERENCED_TYPES = ['KeewanoCustomEventSet', 'KeewanoCodegen'];

/** The three comparisons, reported separately so the message names what moved. */
function compare({ ours, upstream, stamp }) {
  const kinds = [
    { kind: 'property', key: 'properties' },
    { kind: 'initializer', key: 'initializers' },
    { kind: 'bridge overload', key: 'bridge' },
  ];
  return kinds.map(({ kind, key }) =>
    reportMissing({ label: 'swift', kind, ours: ours[key], upstream: upstream[key], stamp }),
  );
}

/** What the SDK publishes and we do not is not a failure, but it is worth naming. */
function reportCoverage({ ours, upstream, mismatched, stamp }) {
  const unused = upstream.bridge.filter((entry) => !ours.bridge.includes(entry));
  console.log(
    `ios: ${ours.bridge.length - mismatched} of ${upstream.bridge.length} bridge overloads mirrored ` +
      `from ${stamp}` +
      (unused.length > 0 ? `, not mirrored: ${unused.join(' | ')}` : ''),
  );
}

/** Every type a generated file names, which a rename upstream would break. */
function checkReferencedTypes(source) {
  let missing = 0;
  for (const name of REFERENCED_TYPES) {
    if (declaresType({ source, name })) continue;
    console.error(
      `ios: the SDK no longer publishes ${name}, which every generated file names - ` +
        `the emitted code would not build`,
    );
    missing += 1;
  }
  return missing;
}

/** @param {string[]} paths - the custom-events file and the entry point, one checkout. */
function compareSwift([customEventsPath, entryPath]) {
  const upstreamSource = readFileSync(customEventsPath, 'utf8');
  const upstream = readDeclarations(upstreamSource);
  const ours = readDeclarations(
    readOwnFile({ path: OURS_SWIFT, wantedFor: 'the surface it compares' }),
  );
  assertRead({ surface: upstream, path: UPSTREAM_SWIFT });
  assertRead({ surface: ours, path: OURS_SWIFT });
  const stamp = stampFor(customEventsPath);
  const [properties, initializers, mismatched] = compare({ ours, upstream, stamp });
  reportCoverage({ ours, upstream, mismatched, stamp });
  return (
    properties +
    initializers +
    mismatched +
    checkReferencedTypes(upstreamSource) +
    checkEntryPoint({
      label: 'ios',
      path: entryPath,
      declaration: /^public (?:final class|class|enum|struct|actor) (\w+)/m,
      vector: SWIFT_VECTOR,
      extend: (name) => `extension ${name} {`,
    })
  );
}

const ios = findUpstreamCheckout({
  suffixes: [UPSTREAM_SWIFT, UPSTREAM_SWIFT_ENTRY],
  overrideEnv: 'KEEWANO_IOS_SDK',
  repoRoot: ROOT,
  sdksDirectory: SDKS_DIR,
});

let status = 0;
if (ios.paths === null) {
  console.error(
    `ios: no checkout carrying ${UPSTREAM_SWIFT} and ${UPSTREAM_SWIFT_ENTRY} was found, so the ` +
      `surface was not compared - looked under ${ios.searched.join(', ')}` +
      (ios.nearMiss === undefined ? '' : `; ${ios.nearMiss}`),
  );
  /** A typo in a variable somebody set on purpose is never an unverified run to accept. */
  if (ios.overrideFailed === true || process.env.KEEWANO_ALLOW_SKIP !== '1') status = 1;
} else {
  status = compareSwift(ios.paths);
}

process.exit(status === 0 ? 0 : 1);
