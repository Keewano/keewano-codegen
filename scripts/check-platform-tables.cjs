/**
 * Every built executable reaches the packages and lookups that ship it.
 *
 * A target added without its wheel row publishes no wheel for that platform,
 * and pip answers with "no matching distribution" rather than anything that
 * points here. Added without its host row, the determinism check calls that
 * machine a host it has no executable for and fails the build on it. Neither
 * names the table that is actually missing, which is what this exists to say.
 *
 * The tables do not cover the same set, and that is deliberate rather than
 * drift: a wheel exists for every platform and every platform can be the host
 * running a check, while the artifact bundle serves the Apple and Linux
 * toolchains this project supports. So Windows is required to be absent from
 * the bundle, not merely tolerated - it is served by the wheel instead.
 *
 * Where each platform is written down, and how each place is read back, is
 * lib/platformTables.cjs. Runs beside check-host-classifiers in `build:ci`.
 */
'use strict';

const { TABLES, readBuiltPlatforms, readTable } = require('./lib/platformTables.cjs');

const built = readBuiltPlatforms();
let problems = 0;

function complain(message) {
  problems += 1;
  process.stderr.write(`check-platform-tables: ${message}\n`);
}

for (const table of TABLES) {
  const rows = readTable(table);
  const listed = new Set(rows.map((row) => row.platform));

  for (const platform of built) {
    if (!table.covers(platform) || listed.has(platform)) continue;
    complain(`${platform} is built but the ${table.name} table does not name it`);
  }
  for (const platform of listed) {
    if (!built.has(platform)) {
      complain(`the ${table.name} table names ${platform} but nothing builds it`);
    } else if (!table.covers(platform)) {
      complain(
        `the ${table.name} table names ${platform}, which it cannot use - ${table.absentReason}`,
      );
    }
  }

  /**
   * The second column is what the table exists to get right, and it is what a
   * row copied from the one above keeps by accident. Two platforms sharing a
   * wheel tag or an SPM triple send one platform's users the other's
   * executable, which installs cleanly and fails on the first run.
   */
  const owner = new Map();
  for (const { platform, value } of rows) {
    if (value === undefined) continue;
    const first = owner.get(value);
    if (first === undefined) owner.set(value, platform);
    else {
      complain(
        `the ${table.name} table gives ${first} and ${platform} the same ${table.value}: ${value}`,
      );
    }
  }
}

if (problems > 0) process.exit(1);

process.stdout.write(
  `check-platform-tables: ${String(built.size)} built platforms, each named everywhere it belongs\n`,
);
