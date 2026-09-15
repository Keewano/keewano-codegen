/**
 * Where a platform is written down, and how to read each place back.
 *
 * The list appears five times: as bun targets in build-binaries.cjs, as Maven
 * classifiers in the Gradle plugin, as wheel tags in build-wheels.sh, as SPM
 * triples in build-artifactbundle.sh, and as the host lookup in hostBinary.sh.
 * This is the registry both checks answer to: check-host-classifiers.cjs ties
 * the classifiers to the targets, check-platform-tables.cjs ties the other
 * three tables to them. One answer to "what does this project build", so the
 * two cannot disagree about it on a machine where only some targets were made.
 *
 * Each of those three only looks downward - it refuses to run when a binary it
 * names is missing, and none of them notices a binary that names it back.
 *
 * Read, never executed: parsing the sources beats importing them, because
 * build-binaries.cjs throws when dist/ is absent and the shell tables are not
 * importable at all.
 */
'use strict';

const { readOwnFile } = require('./ownFile.cjs');

/** A row in a shell table: the binary it names, then the value it maps to. */
const SHELL_ROW = String.raw`^keewano-codegen-([a-z0-9-]+?)(?:\.exe)?[ \t]+(\S+)`;

/**
 * One table to compare against the platforms the build produces.
 *
 * name - what it is called in a complaint.
 * source - the script holding it.
 * marker - a line inside the table, so a reshaped script fails to parse
 *   instead of matching an empty region and passing.
 * rows - captures the platform a row names and, where the row has one, the
 *   value that row exists to get right.
 * value - what that second capture is called in a complaint.
 * covers - which built platforms the table is required to name.
 * absentReason - why a platform outside `covers` must not appear.
 */
const TABLES = [
  {
    name: 'wheels',
    source: 'scripts/build-wheels.sh',
    marker: 'manylinux2014_x86_64',
    rows: SHELL_ROW,
    value: 'wheel tag',
    covers: () => true,
    absentReason: 'every platform gets a wheel',
  },
  {
    name: 'artifact bundle',
    source: 'scripts/build-artifactbundle.sh',
    marker: 'x86_64-unknown-linux-gnu',
    rows: SHELL_ROW,
    value: 'SPM triple',
    covers: (platform) => !platform.startsWith('windows'),
    absentReason:
      'the bundle serves the Apple and Linux toolchains; Windows is served by the wheel',
  },
  {
    name: 'host lookup',
    source: 'scripts/lib/hostBinary.sh',
    marker: 'Darwin/arm64',
    rows: String.raw`host_platform="([a-z0-9.-]+)"`,
    value: 'host',
    covers: () => true,
    absentReason: 'every platform can be the host a check runs on',
  },
];

/**
 * The platforms the build produces, named the way the tables name them.
 *
 * Read from build-binaries.cjs and not from binaries/, which is never pruned:
 * a leftover from an older build would demand rows for a platform nothing
 * builds any more, and a partial build would let a missing row pass as covered.
 */
function readBuiltPlatforms() {
  const source = readOwnFile({
    path: 'scripts/build-binaries.cjs',
    wantedFor: 'the platforms it compiles',
  });
  if (!source.includes('const TARGETS')) {
    throw new Error('check-platform-tables: build-binaries.cjs no longer declares TARGETS');
  }
  const platforms = new Set(
    [...source.matchAll(/name: 'keewano-codegen-([a-z0-9-]+?)(?:\.exe)?'/g)].map((hit) => hit[1]),
  );
  if (platforms.size === 0) {
    throw new Error('check-platform-tables: no targets parsed from build-binaries.cjs');
  }
  return platforms;
}

/** The rows a table holds, each as the platform it names and its value. */
function readTable(table) {
  const source = readOwnFile({ path: table.source, wantedFor: 'the platforms it names' });
  if (!source.includes(table.marker)) {
    throw new Error(
      `check-platform-tables: ${table.source} no longer contains ${table.marker}, so its table moved or was reshaped`,
    );
  }
  const rows = [...source.matchAll(new RegExp(table.rows, 'gm'))].map((hit) => ({
    platform: hit[1].replace(/\.exe$/, ''),
    value: hit[2],
  }));
  if (rows.length === 0) {
    throw new Error(`check-platform-tables: no platforms parsed from ${table.source}`);
  }
  return rows;
}

module.exports = { TABLES, readBuiltPlatforms, readTable };
