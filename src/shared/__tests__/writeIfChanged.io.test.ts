/**
 * The three failures this module turns into an I/O error rather than
 * swallowing. Its header promises that a file which exists but cannot be
 * read surfaces as an I/O failure instead of being silently replaced,
 * and that a cleanup which also fails does not replace the write failure
 * the user has to act on. None of that is reachable through the
 * filesystem on every platform, so each is driven by a spy.
 *
 * Without these a refactor could turn any of the three into a swallow
 * and the suite would stay green - while the tool quietly replaced a
 * file it was never able to read.
 */

import fs from 'node:fs';
import { join } from 'node:path';

import { IoError } from '../errors';
import { writeIfChanged } from '../writeIfChanged';

import { makeErrnoError } from './helpers/errnoError';
import { useTempDirectory } from './helpers/tempDirectory';

const directory = useTempDirectory('keewano-codegen-write-io-');

/** Fail one filesystem call for paths ending in `suffix`, and behave normally otherwise. */
const failOn = <K extends 'realpathSync' | 'statSync' | 'rmSync'>(
  call: K,
  suffix: string,
  code: string,
): jest.SpyInstance => {
  const real = fs[call] as (...args: unknown[]) => unknown;
  return jest.spyOn(fs, call).mockImplementation(((...args: unknown[]) => {
    if (String(args[0]).endsWith(suffix)) throw makeErrnoError(code);
    return real(...args);
  }) as never);
};

describe('writeIfChanged: a failure it cannot read past', () => {
  it('reports a link it cannot resolve instead of replacing what it points at', () => {
    const path = join(directory(), 'generated.ts');
    fs.writeFileSync(path, 'before', 'utf8');
    const spy = failOn('realpathSync', 'generated.ts', 'EACCES');
    try {
      expect(() => writeIfChanged({ path, text: 'after' })).toThrow(IoError);
      expect(() => writeIfChanged({ path, text: 'after' })).toThrow(/cannot resolve/);
    } finally {
      spy.mockRestore();
    }
    /** The file it could not resolve is the file it must not have touched. */
    expect(fs.readFileSync(path, 'utf8')).toBe('before');
  });

  it('reports a file it cannot stat rather than losing the permissions it carries', () => {
    /**
     * The mode is read to carry it onto the replacement. A stat that
     * fails for anything but "no such file" means the tool cannot know
     * what the customer set, and writing anyway would silently reset it.
     */
    const path = join(directory(), 'stat.ts');
    fs.writeFileSync(path, 'before', 'utf8');
    const spy = failOn('statSync', 'stat.ts', 'EACCES');
    try {
      expect(() => writeIfChanged({ path, text: 'after' })).toThrow(/cannot stat/);
    } finally {
      spy.mockRestore();
    }
  });

  it('lets a cleanup failure that is not a filesystem error surface', () => {
    /**
     * Cleanup of the temporary sibling is best effort: an I/O failure
     * there must not replace the write failure the user has to act on.
     * Anything else is a bug in this module and has to be seen.
     */
    const path = join(directory(), 'leftover.ts');
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw makeErrnoError('ENOSPC');
    });
    const rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {
      throw new TypeError('not a filesystem failure');
    });
    try {
      expect(() => writeIfChanged({ path, text: 'after' })).toThrow(TypeError);
    } finally {
      rmSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });

  it('keeps the write failure when the cleanup fails for a filesystem reason', () => {
    const path = join(directory(), 'masked.ts');
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw makeErrnoError('ENOSPC');
    });
    const rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {
      throw makeErrnoError('EACCES');
    });
    try {
      expect(() => writeIfChanged({ path, text: 'after' })).toThrow(/ENOSPC/);
    } finally {
      rmSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });
});
