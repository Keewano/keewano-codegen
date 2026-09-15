/**
 * Running the published entry point the way a user does: a real child
 * process, so the exit code the OS reports and the output that survives
 * it are both observable. Everything else in the CLI suite calls `run()`
 * in-process, where neither is.
 */

import type { ShimResult, StandInModulesArgs } from '../types/shim';

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const SHIM = join(REPO_ROOT, 'bin', 'keewano-codegen.cjs');

/** The compiled CLI the shim boots; a missing build fails the suite rather than skipping it. */
function buildIfMissing(): void {
  if (existsSync(join(REPO_ROOT, 'dist', 'src', 'cli', 'run.js'))) return;
  /**
   * The runner that invoked jest is the one to build with; resolving
   * `npm` from PATH would run whichever one the host happens to offer.
   */
  const npm = process.env['npm_execpath'];
  if (npm === undefined) {
    throw new Error('the shim test needs a build: run npm run build first');
  }
  execFileSync(process.execPath, [npm, 'run', 'build'], { cwd: REPO_ROOT, stdio: 'ignore' });
}

function runShim(args: readonly string[]): ShimResult {
  return runShimAt({ shim: SHIM, args });
}

/** The same run against a copy of the shim, for the trees that stand in for a broken install. */
function runShimAt({ shim, args = [] }: { shim: string; args?: readonly string[] }): ShimResult {
  const result = spawnSync(process.execPath, [shim, ...args], { encoding: 'utf8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/**
 * A copy of the shim in a tree of its own, optionally with stand-in
 * modules beside it. Without them the copy has no `dist`, which is what
 * a half-finished install looks like.
 */
function planted({ root, exitCode, run }: StandInModulesArgs): string {
  const shim = join(root, 'bin', 'keewano-codegen.cjs');
  mkdirSync(join(root, 'bin'), { recursive: true });
  copyFileSync(SHIM, shim);
  if (exitCode === undefined && run === undefined) return shim;
  const cli = join(root, 'dist', 'src', 'cli');
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, 'exitCode.js'), exitCode ?? '', 'utf8');
  writeFileSync(join(cli, 'run.js'), run ?? '', 'utf8');
  return shim;
}

export { REPO_ROOT, SHIM, buildIfMissing, planted, runShim, runShimAt };
