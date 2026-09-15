/**
 * The built registry, refused when the build behind it predates the sources.
 *
 * The asset name is read out of dist/ so a rename on our side cannot leave the
 * Android check green while the SDK opens a file nothing produces. A stale
 * dist/ reopens exactly that hole from the other end: the module loads, the
 * old name comes back, and the check passes against a checkout it is not
 * looking at. check-determinism.sh already refuses to drive a stale build;
 * this is the same rule for the same reason, one consumer over.
 *
 * The freshness rule mirrors that script: what the build consumes is src/
 * minus the tests both build tsconfigs exclude, plus the schemas it bundles.
 * One dist file stands for the whole build because tsc here is not
 * incremental - every build rewrites every output.
 */
'use strict';

const { readdirSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');

const REGISTRY_MODULE = '../../dist/src/emitters/registry.js';
const ROOT = resolve(__dirname, '..', '..');
const SOURCE_ROOTS = [
  { directory: 'src', extension: '.ts', skip: '__tests__' },
  { directory: 'schemas', extension: '.json', skip: null },
];

/** The first file under `directory` newer than `builtMtime`, or null. */
function newerFileUnder({ directory, extension, skip, builtMtime }) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === skip) continue;
      const below = newerFileUnder({ directory: full, extension, skip, builtMtime });
      if (below !== null) return below;
      continue;
    }
    if (!entry.name.endsWith(extension)) continue;
    if (statSync(full).mtimeMs > builtMtime) return full;
  }
  return null;
}

/**
 * A source file the build at `builtFile` cannot have seen, or null when the
 * build is current. `sourceRoots` defaults to what the real build consumes;
 * it is a parameter so the rule itself can be tested against fixtures.
 */
function staleSourceFor({ builtFile, sourceRoots = SOURCE_ROOTS, root = ROOT }) {
  const builtMtime = statSync(builtFile).mtimeMs;
  for (const { directory, extension, skip } of sourceRoots) {
    const found = newerFileUnder({ directory: join(root, directory), extension, skip, builtMtime });
    if (found !== null) return found;
  }
  return null;
}

/** The registry as built, or a thrown sentence saying which build step is owed. */
function requireBuiltRegistry() {
  let registry;
  try {
    registry = require(REGISTRY_MODULE);
  } catch {
    throw new Error('dist/ is missing, so the asset name is unknown - run npm run build first');
  }
  const stale = staleSourceFor({ builtFile: require.resolve(REGISTRY_MODULE) });
  if (stale !== null) {
    throw new Error(
      `dist/ is older than ${stale}, so the asset name may not match this checkout - ` +
        `run npm run build first`,
    );
  }
  return registry;
}

module.exports = { requireBuiltRegistry, staleSourceFor };
