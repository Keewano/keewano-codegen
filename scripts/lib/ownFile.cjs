/**
 * Reading a file this repository owns, for the checks that compare it
 * with another checkout.
 *
 * A path that does not resolve is a broken checkout or a rename that
 * skipped the check, and either way the reader needs the name of the
 * file and what it was wanted for - not a loader stack.
 */
'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');

/** @param {{ path: string, wantedFor: string }} args */
function readOwnFile({ path, wantedFor }) {
  try {
    return readFileSync(join(ROOT, path), 'utf8');
  } catch {
    throw new Error(`cannot read ${path}: this check needs it for ${wantedFor}`);
  }
}

module.exports = { readOwnFile };
