/**
 * A fresh temp directory per test, removed afterwards; the getter reads
 * the current one. Also moves the process into it so a settings file in
 * the repository root can never leak into a CLI run under test.
 */

import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The path is resolved because the production code under test resolves
 * too - `process.cwd()` after a chdir, and `realpathSync` where an output
 * may be a link. On macOS the temp root is itself a link (`/var` ->
 * `/private/var`), so an unresolved path here makes every such comparison
 * fail for a reason that has nothing to do with the code being tested.
 */
function makeTempDir(prefix: string): string {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

function useTempDirectory(prefix: string): () => string {
  let directory = '';
  let originalCwd = '';
  beforeEach(() => {
    directory = makeTempDir(prefix);
    originalCwd = process.cwd();
    process.chdir(directory);
  });
  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(directory, { recursive: true, force: true });
  });
  return () => directory;
}

export { makeTempDir, useTempDirectory };
