/**
 * Locate one checkout of another Keewano repository without assuming what
 * that repository is called or where it sits. Folder names are a property
 * of one machine: a checkout is named one thing here and another on the next
 * desk, so a check that hardcodes the name passes or fails for reasons that
 * have nothing to do with the code.
 *
 * What is matched instead is the path each declaration has *inside its own
 * repository* - `Sources/KeewanoSDK/KeewanoCustomEvents.swift` is a fact about
 * the SDK, not about this filesystem. A surface is resolved as one checkout
 * shipping every file it spans, never file by file: independent lookups let
 * two clones of the same SDK each supply half, and the checks then compared
 * a surface no real repository ships. Every caller may also point straight
 * at a checkout or at one of its files with an environment variable, and
 * nothing is ever guessed silently: when the search comes up empty the
 * caller is told where it looked.
 */
const { existsSync, readdirSync, statSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');

/**
 * Directories that hold no source of ours and cost the most to walk. Named one
 * by one rather than by a rule such as "anything starting with a dot": that
 * rule skipped every hidden directory, which made the five dotted names below
 * unreachable and would have hidden a checkout kept under one. Walking the
 * hidden directories it leaves costs about two milliseconds, measured.
 */
const SKIPPED = new Set([
  'node_modules',
  '.git',
  '.gradle',
  '.idea',
  'build',
  'dist',
  'coverage',
  'Pods',
  'DerivedData',
  '.build',
  'out',
  '.next',
  'vendor',
]);

/**
 * Deep enough for the deepest declaration compared today - the Android SDK's
 * `keewano-sdk/src/main/kotlin/com/keewano/sdk/internal/<file>.kt` sits nine
 * directories under the workspace - while staying shallow enough to be quick.
 */
const MAX_DEPTH = 10;

function* walk(directory, depth) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED.has(entry.name)) continue;
      yield* walk(full, depth + 1);
    } else {
      yield full;
    }
  }
}

/**
 * Where to look, in order of how much the caller meant it: an explicit file or
 * checkout, then a directory of checkouts, then the directory this repository
 * sits in.
 */
function searchRoots({ repoRoot, sdksDirectory }) {
  /**
   * A directory the caller named is the whole answer, not a hint. Adding the
   * siblings underneath it would mean a run that says it searched one place and
   * actually searched another - the caller would trust a result they never asked
   * for.
   */
  if (sdksDirectory) return [resolve(sdksDirectory)];
  return [resolve(repoRoot, '..')];
}

/** The checkout a file at `path` belongs to, given the suffix it was matched by. */
const checkoutOf = ({ path, wanted }) => path.slice(0, -(wanted.length + 1));

/**
 * Find one checkout shipping every one of `suffixes`, and the files it ships
 * them at, in the same order.
 *
 * suffixes - repository-relative paths, e.g. `Sources/KeewanoSDK/KeewanoSDK.swift`.
 * overrideEnv - name of an environment variable holding the checkout or any
 *   one of those files; an override that does not resolve to a checkout
 *   carrying all of them is an error, never a fallback to searching.
 *
 * Returns `{ paths, searched }` on success. Otherwise `paths` is null,
 * `searched` names where it looked, `overrideFailed` marks a variable that
 * was set and did not resolve, and `nearMiss` names a checkout that carried
 * the first file but not the rest - the case where two clones would
 * otherwise each have supplied half a surface.
 */
function findUpstreamCheckout({ suffixes, overrideEnv, repoRoot, sdksDirectory }) {
  const wanted = suffixes.map((suffix) => suffix.split('/').join(sep));
  const override = overrideEnv ? process.env[overrideEnv] : undefined;
  if (override) return checkoutFromOverride({ override, overrideEnv, wanted });
  const roots = searchRoots({ repoRoot, sdksDirectory });
  /**
   * A directory the caller named and misspelled is the same mistake as a
   * misspelt file override, and reads the same way: a search that found
   * nothing. It goes through the same channel, so no flag waives it.
   */
  if (sdksDirectory !== undefined && !existsSync(roots[0])) {
    return { paths: null, searched: [`KEEWANO_SDKS_DIR=${sdksDirectory}`], overrideFailed: true };
  }
  return searchCheckout({ roots, wanted });
}

/** The first checkout under `roots` shipping every wanted file; near misses are remembered. */
function searchCheckout({ roots, wanted }) {
  let nearMiss;
  for (const root of roots) {
    for (const candidate of walk(root, 0)) {
      if (!candidate.endsWith(sep + wanted[0])) continue;
      const checkout = checkoutOf({ path: candidate, wanted: wanted[0] });
      const missing = wanted.find((suffix) => !existsSync(join(checkout, suffix)));
      if (missing === undefined) {
        return { paths: wanted.map((suffix) => join(checkout, suffix)), searched: roots };
      }
      if (nearMiss === undefined) nearMiss = `${checkout} lacks ${missing}`;
    }
  }
  return { paths: null, searched: roots, nearMiss };
}

/**
 * What an explicit override resolves to: the named checkout, or the checkout
 * a named file belongs to - derived from whichever suffix the file matches,
 * so pointing at any one compared file serves the whole surface. A file that
 * is none of the compared files, or a checkout missing any of them, is a
 * failure naming the variable.
 *
 * @param {{ override: string, overrideEnv: string, wanted: string[] }} args
 */
function checkoutFromOverride({ override, overrideEnv, wanted }) {
  const failed = { paths: null, searched: [`${overrideEnv}=${override}`], overrideFailed: true };
  const resolved = resolve(override);
  if (!existsSync(resolved)) return failed;
  const isFile = statSync(resolved).isFile();
  const matched = isFile ? wanted.find((suffix) => resolved.endsWith(sep + suffix)) : undefined;
  if (isFile && matched === undefined) return failed;
  const checkout = isFile ? checkoutOf({ path: resolved, wanted: matched }) : resolved;
  const paths = wanted.map((suffix) => join(checkout, suffix));
  return paths.every((path) => existsSync(path)) ? { paths, searched: [override] } : failed;
}

module.exports = { findUpstreamCheckout };
