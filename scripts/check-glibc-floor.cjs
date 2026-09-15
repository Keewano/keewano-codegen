/**
 * A manylinux tag is a promise, and this is what keeps it true.
 *
 * The tag tells pip which machines a wheel may be installed on. Nothing else
 * checks it: the tag is a string in a table, the executable is assembled on a
 * host whose glibc is far newer, and a wheel that asks for symbols the target
 * lacks installs cleanly and dies on the first run. The tag is also the only
 * thing standing between a user on an old distribution and that failure, since
 * pip skips a wheel it is told not to take.
 *
 * The promise holds today because bun embeds a runtime linked against an old
 * glibc rather than compiling one on the build host. That is bun's choice and
 * it can change in a release, which is exactly the kind of change that reaches
 * a user rather than a pipeline.
 *
 * The floor is derived from the tag rather than written down again, so raising
 * or lowering the tag moves what is enforced with it.
 *
 * Runs in `build:ci` on the binaries that were just built.
 */
'use strict';

const { resolve } = require('node:path');

const { highestGlibcRequired } = require('./lib/glibcFloor.cjs');
const { TABLES, readTable } = require('./lib/platformTables.cjs');

/** The oldest glibc a manylinux tag admits, or null when the tag is not one. */
function floorOf(tag) {
  const legacy = { manylinux1: [2, 5], manylinux2010: [2, 12], manylinux2014: [2, 17] };
  const named = /^(manylinux\d+)_/.exec(tag);
  if (named !== null && named[1] in legacy) {
    const [major, minor] = legacy[named[1]];
    return { major, minor };
  }
  const modern = /^manylinux_(\d+)_(\d+)_/.exec(tag);
  if (modern === null) return null;
  return { major: Number(modern[1]), minor: Number(modern[2]) };
}

const wheels = TABLES.find((table) => table.name === 'wheels');
const rows = readTable(wheels).filter((row) => floorOf(row.value) !== null);
if (rows.length === 0) {
  throw new Error('check-glibc-floor: no manylinux rows in the wheels table, so it was reshaped');
}

let problems = 0;
for (const { platform, value: tag } of rows) {
  const floor = floorOf(tag);
  const binary = resolve(__dirname, '..', 'binaries', `keewano-codegen-${platform}`);
  let required;
  try {
    required = highestGlibcRequired(binary);
  } catch {
    throw new Error(`check-glibc-floor: cannot read ${binary}, run npm run build:binaries first`);
  }
  if (required === null) continue;
  const above =
    required.major > floor.major ||
    (required.major === floor.major && required.minor > floor.minor);
  if (!above) continue;
  problems += 1;
  process.stderr.write(
    `check-glibc-floor: ${platform} needs GLIBC_${String(required.major)}.${String(required.minor)} ` +
      `but ${tag} promises ${String(floor.major)}.${String(floor.minor)}, so that wheel installs and cannot run\n`,
  );
}

if (problems > 0) process.exit(1);

process.stdout.write(
  `check-glibc-floor: ${String(rows.length)} manylinux wheels, each within the glibc its tag promises\n`,
);
