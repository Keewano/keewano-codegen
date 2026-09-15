/**
 * What `writeIfChanged` promises the customer's repository: an
 * unchanged text does not touch the file, a write that dies partway
 * leaves the previous file whole rather than a truncated artifact that
 * gets committed, and replacing the file keeps what the customer set on
 * it - its permissions, and the symbolic link others read it through.
 */

import fs from 'node:fs';
import { join } from 'node:path';

import { writeIfChanged } from '../writeIfChanged';

import { makeErrnoError } from './helpers/errnoError';
import { describeWithFileModes, describeWithSymlinks } from './helpers/platform';
import { useTempDirectory } from './helpers/tempDirectory';

const PERMISSIONS = {
  SET_BY_CUSTOMER: 0o640,
  BITS: 0o777,
} as const;

describe('writeIfChanged', () => {
  const directory = useTempDirectory('keewano-codegen-write-');

  it('reports a rewrite only when the text differs', () => {
    const path = join(directory(), 'generated.ts');
    expect(writeIfChanged({ path, text: 'first' })).toBe(true);
    expect(writeIfChanged({ path, text: 'first' })).toBe(false);
    expect(writeIfChanged({ path, text: 'second' })).toBe(true);
    expect(fs.readFileSync(path, 'utf8')).toBe('second');
  });

  it('keeps the previous file when the write dies partway', () => {
    /**
     * The simulated failure puts bytes on disk before throwing, the way
     * a full disk does. Written straight to the target, those bytes are
     * what the customer would commit.
     */
    const path = join(directory(), 'generated.ts');
    fs.writeFileSync(path, 'previous', 'utf8');
    const realWrite = fs.writeFileSync;
    const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation((...writeArgs) => {
      realWrite(writeArgs[0], 'half a fi');
      throw makeErrnoError('ENOSPC');
    });

    try {
      expect(() => writeIfChanged({ path, text: 'next' })).toThrow(/ENOSPC/);
    } finally {
      spy.mockRestore();
    }

    expect(fs.readFileSync(path, 'utf8')).toBe('previous');
    expect(fs.readdirSync(directory())).toEqual(['generated.ts']);
  });
});

describeWithFileModes('writeIfChanged: permissions', () => {
  const directory = useTempDirectory('keewano-codegen-write-mode-');

  it('keeps the permissions the file already had', () => {
    /**
     * The replacement is a new file, so without carrying the mode a
     * generated file the customer restricted would come back with
     * whatever the umask gives.
     */
    const path = join(directory(), 'generated.ts');
    fs.writeFileSync(path, 'first', 'utf8');
    fs.chmodSync(path, PERMISSIONS.SET_BY_CUSTOMER);

    expect(writeIfChanged({ path, text: 'second' })).toBe(true);

    expect(fs.statSync(path).mode & PERMISSIONS.BITS).toBe(PERMISSIONS.SET_BY_CUSTOMER);
  });
});

describeWithSymlinks('writeIfChanged: symbolic links', () => {
  const directory = useTempDirectory('keewano-codegen-write-link-');

  it('writes through a link instead of replacing it', () => {
    /**
     * One generated file shared by two projects through a link: a
     * rename over the link would turn it into a regular file and the
     * other project would silently stop seeing updates.
     */
    const realPath = join(directory(), 'real.ts');
    const linkPath = join(directory(), 'link.ts');
    fs.writeFileSync(realPath, 'first', 'utf8');
    fs.symlinkSync(realPath, linkPath, 'file');

    expect(writeIfChanged({ path: linkPath, text: 'second' })).toBe(true);

    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(realPath, 'utf8')).toBe('second');
  });
});
