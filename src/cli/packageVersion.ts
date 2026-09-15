/**
 * The package version for `--version`, read from `package.json` at
 * runtime so the CLI never carries a second copy of it.
 */

import { resolve as resolvePath } from 'node:path';

import { readJsonFile } from '../shared/readJsonFile';

const PACKAGE_NAME = '@keewano/codegen';

/** Printed when no manifest of this package can be read. */
const UNKNOWN_VERSION = 'unknown';

/**
 * Two candidate paths cover both deployments:
 *
 *   1. Compiled CLI:   `dist/src/cli/packageVersion.js` -> `../../..` -> `<pkg>/package.json`
 *   2. Source / tests: `src/cli/packageVersion.ts`      -> `../..`    -> `<pkg>/package.json`
 *
 * In the source layout the first candidate is the directory ABOVE the
 * repository, which may hold an unrelated package.json; the manifest
 * is therefore accepted only when it names this package.
 *
 * The standalone executable is a third deployment that neither candidate
 * reaches: the compiler bakes the build machine's `__dirname` in, so both
 * paths point at a checkout the downloader does not have and `--version`
 * answers `unknown`. Naming it here rather than working around it, because
 * the fix is to stamp the version into the build, which belongs with
 * whatever wires releases.
 */
const PACKAGE_JSON_CANDIDATES = [
  resolvePath(__dirname, '..', '..', '..', 'package.json'),
  resolvePath(__dirname, '..', '..', 'package.json'),
];

function readPackageVersion(): string {
  for (const packageJsonPath of PACKAGE_JSON_CANDIDATES) {
    const version = readOwnVersion(packageJsonPath);
    if (version !== undefined) return version;
  }
  return UNKNOWN_VERSION;
}

/** `undefined` for a missing, unreadable, foreign or corrupted manifest. */
function readOwnVersion(packageJsonPath: string): string | undefined {
  let manifest: unknown;
  try {
    manifest = readJsonFile({ path: packageJsonPath, label: 'version' });
  } catch {
    return undefined;
  }
  if (typeof manifest !== 'object' || manifest === null) return undefined;
  const { name, version } = manifest as { name?: unknown; version?: unknown };
  return name === PACKAGE_NAME && typeof version === 'string' ? version : undefined;
}

export { readPackageVersion };
