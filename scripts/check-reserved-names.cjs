/**
 * Compare RESERVED_EVENT_NAMES against the public `report*` surface each SDK
 * actually ships. The list exists because a custom event called `ButtonClick`
 * generates a `reportButtonClick` wrapper that shadows the built-in one, and
 * the language says nothing: measured in Swift, an extension declared in the
 * customer's module compiles without a warning and wins the call, so the
 * built-in event stops being reported. No compiler can catch that - the
 * wrapper is legal code - so the list is the only guard, and until now nothing
 * checked it against the SDKs it claims to mirror.
 *
 * The SDK checkouts are not dependencies of this package and will not exist on
 * a CI runner, so this runs on demand next to `check:native`. A checkout that
 * is missing is reported as unverified, never as a pass.
 *
 * The checkouts are found by the path each declaration carries inside its own
 * repository, never by what the checkout is called here - see find-upstream.cjs.
 *
 * Usage: npm run check:reserved   (KEEWANO_SDKS_DIR names a directory of
 * checkouts, KEEWANO_IOS_SDK / KEEWANO_ANDROID_SDK / KEEWANO_TS_SDK point at
 * one each; KEEWANO_ALLOW_SKIP=1 accepts a run that verified nothing)
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const { findUpstreamCheckout } = require('./find-upstream.cjs');
const { readOwnFile } = require('./lib/ownFile.cjs');
const { MINIMUM_METHODS_PER_SURFACE, REPORT_SURFACES } = require('./lib/reportSurfaces.cjs');
const { stripAnnotations, stripComments } = require('./lib/sourceText.cjs');

const ROOT = resolve(__dirname, '..');
const SDKS_DIR = process.env.KEEWANO_SDKS_DIR;

/** The list as the source states it; a shape change here must be loud, not silently empty. */
function readReservedNames() {
  const source = readOwnFile({
    path: 'src/events/reservedEventNames.ts',
    wantedFor: 'the list it compares',
  });
  const opening = source.indexOf('new Set([');
  const closing = source.indexOf('])', opening);
  if (opening < 0 || closing < 0)
    throw new Error('cannot find the RESERVED_EVENT_NAMES set literal');
  const names = [...source.slice(opening, closing).matchAll(/'([^']+)'/g)].map((match) => match[1]);
  if (names.length === 0) throw new Error('the RESERVED_EVENT_NAMES set parsed as empty');
  return new Set(names);
}

/** Every public report name each surface publishes, and the surfaces that were not found. */
function collect(reserved) {
  const found = new Map();
  const missing = [];
  for (const source of REPORT_SURFACES) {
    /**
     * One checkout per surface, never one lookup per file: independent
     * lookups let two clones of the same SDK each supply half, and the
     * comparison then read a surface no real repository ships.
     */
    const located = findUpstreamCheckout({
      suffixes: source.suffixes,
      overrideEnv: source.overrideEnv,
      repoRoot: ROOT,
      sdksDirectory: SDKS_DIR,
    });
    if (located.paths === null) {
      /** A variable somebody set on purpose and misspelled is a typo, never a skip. */
      missing.push({
        id: source.id,
        searched: located.searched,
        mistyped: located.overrideFailed === true,
        nearMiss: located.nearMiss,
      });
      continue;
    }
    for (const raw of readSurface({ source, paths: located.paths })) {
      const name = source.toCanonical === undefined ? raw : source.toCanonical(raw, reserved);
      if (!found.has(name)) found.set(name, []);
      if (!found.get(name).includes(source.id)) found.get(name).push(source.id);
    }
  }
  return { found, missing };
}

/**
 * The names one surface publishes, counted per file rather than over the
 * surface: a two-file surface whose smaller half stopped being read still
 * cleared a floor the larger half met on its own.
 *
 * @param {{ source: object, paths: string[] }} args
 */
function readSurface({ source, paths }) {
  const names = [];
  for (const path of paths) {
    /**
     * Prose first, then annotations. Comments are blanked, so the
     * indentation the patterns anchor on survives, and a declaration left
     * behind in one stops counting as a method the SDK still publishes.
     * Annotations are deleted instead, because blanking them leaves
     * `@JvmStatic fun reportX(` starting past that indentation and the
     * method drops out of the reading - silently in both directions, since
     * a name never read is a name never compared against the reserved list.
     */
    const code = stripAnnotations(stripComments(readFileSync(path, 'utf8'), source.strip));
    const found = [...code.matchAll(source.pattern)].map((match) => match[1]);
    if (found.length === 0) {
      throw new Error(
        `${source.id}: found no public report methods in ${path}, ` +
          `so the declaration moved or was reformatted and this check stopped reading it`,
      );
    }
    names.push(...found);
  }
  if (names.length < MINIMUM_METHODS_PER_SURFACE) {
    throw new Error(
      `${source.id}: found ${names.length} public report methods in ${source.suffixes.join(', ')}, ` +
        `so the declaration moved or was reformatted and this check stopped reading it`,
    );
  }
  return names;
}

const reserved = readReservedNames();
const { found, missing } = collect(reserved);
let status = 0;

for (const { id, searched, nearMiss } of missing) {
  const detail = nearMiss === undefined ? '' : `; ${nearMiss}`;
  console.error(
    `${id}: no checkout carrying its whole surface was found, so it was not compared - looked ` +
      `under ${searched.join(', ')}${detail}`,
  );
}
const mistyped = missing.some((entry) => entry.mistyped === true);
if (missing.length > 0 && (mistyped || process.env.KEEWANO_ALLOW_SKIP !== '1')) status = 1;

const unguarded = [...found.keys()].filter((name) => !reserved.has(name)).sort();
for (const name of unguarded) {
  console.error(
    `${name}: public in ${found.get(name).join(', ')} but absent from RESERVED_EVENT_NAMES - ` +
      `a custom event of that name would shadow it`,
  );
  status = 1;
}

const defensive = [...reserved].filter((name) => !found.has(name)).sort();
if (defensive.length > 0) {
  console.log(`reserved without a matching public method today: ${defensive.join(', ')}`);
}
console.log(
  `checked ${found.size} public report methods across ${REPORT_SURFACES.length - missing.length} of ${REPORT_SURFACES.length} surfaces`,
);
process.exit(status);
