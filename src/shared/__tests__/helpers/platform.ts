/**
 * Capabilities the platform may not have, probed once for every suite
 * that needs one: creating a symbolic link is privileged on some Windows
 * setups, two names differing only in case need a case-sensitive
 * filesystem, and permission bits are advisory on Windows. A case that
 * cannot run is reported as skipped instead of passing green without
 * asserting anything.
 *
 * A skip is a local convenience and never a way for such a case to go
 * unrun: the runner has all three, so a missing capability under CI
 * means the probe itself broke.
 */

import { chmodSync, existsSync, mkdtempSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROBE = {
  MODE: 0o600,
  PERMISSION_BITS: 0o777,
} as const;

const probeDirectory = mkdtempSync(join(tmpdir(), 'keewano-codegen-probe-'));

const canSymlink = ((): boolean => {
  try {
    symlinkSync(join(probeDirectory, 'nowhere'), join(probeDirectory, 'link'), 'file');
    return true;
  } catch {
    /* no privilege for symbolic links; the cases needing them are skipped */
    return false;
  }
})();

const hasCaseSensitiveNames = ((): boolean => {
  writeFileSync(join(probeDirectory, 'Case'), '');
  return !existsSync(join(probeDirectory, 'case'));
})();

const hasFileModes = ((): boolean => {
  const path = join(probeDirectory, 'mode');
  writeFileSync(path, '');
  chmodSync(path, PROBE.MODE);
  return (statSync(path).mode & PROBE.PERMISSION_BITS) === PROBE.MODE;
})();

if (process.env.CI !== undefined && !(canSymlink && hasCaseSensitiveNames && hasFileModes)) {
  throw new Error(
    `platform probe: CI must have all three (symlink ${String(canSymlink)}, case-sensitive ${String(hasCaseSensitiveNames)}, file modes ${String(hasFileModes)})`,
  );
}

const describeWithSymlinks = canSymlink ? describe : describe.skip;
const describeWithCaseSensitiveNames = hasCaseSensitiveNames ? describe : describe.skip;
const describeWithFileModes = hasFileModes ? describe : describe.skip;

export { describeWithCaseSensitiveNames, describeWithFileModes, describeWithSymlinks };
