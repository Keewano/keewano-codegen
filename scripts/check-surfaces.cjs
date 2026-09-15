/**
 * Run every surface comparison and report all of them.
 *
 * Chaining the checks in the npm script made the first failure hide the
 * rest: a missing iOS checkout skipped the Android comparison entirely
 * and the run still looked like one check that failed. Each one is
 * independent, so each one runs, and one failing check fails the run.
 * There is no finer grade to pass along - the checks themselves exit
 * 0 or 1 and say what failed on stderr.
 *
 * Usage: npm run check:surfaces
 */
'use strict';

const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const CHECKS = [
  'check-sdk-surfaces.cjs',
  'check-android-surface.cjs',
  'check-python-surface.cjs',
  'check-typescript-surface.cjs',
];

let status = 0;
for (const check of CHECKS) {
  const run = spawnSync(process.execPath, [join(__dirname, check)], { stdio: 'inherit' });
  /** A signal or a spawn failure leaves status null; neither is a pass. */
  if (run.status !== 0) status = 1;
}
process.exit(status);
