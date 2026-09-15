/**
 * `--version` reads the number from the package manifest at runtime, and
 * the source layout puts a foreign `package.json` on the first candidate
 * path (the directory above the repository). The guard that rejects it
 * is what keeps the CLI from reporting a stranger's version as its own.
 */

import fs from 'node:fs';

import { readPackageVersion } from '../packageVersion';

describe('readPackageVersion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the version of this package', () => {
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('refuses a manifest that belongs to another package', () => {
    jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(JSON.stringify({ name: 'someone-else', version: '9.9.9' }));

    expect(readPackageVersion()).toBe('unknown');
  });

  it('says unknown rather than throwing when no manifest can be read', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw Object.assign(new Error('EACCES: simulated'), { code: 'EACCES' });
    });

    expect(readPackageVersion()).toBe('unknown');
  });

  it('says unknown for a manifest that is not an object', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue('"just a string"');

    expect(readPackageVersion()).toBe('unknown');
  });
});
