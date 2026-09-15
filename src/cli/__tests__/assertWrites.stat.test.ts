/**
 * The guard that stops a planned write from landing on the definitions
 * file compares what the filesystem calls each file, because two names
 * for one file walk past a string comparison. A stat it cannot answer is
 * therefore not the same as a file that is not there: the first leaves
 * the guard unable to speak, the second is the ordinary case and has
 * nothing to compare.
 */

import fs from 'node:fs';
import { join } from 'node:path';

import { DEFINITIONS_FILE_NAME } from '../../events/definitionsDocument';
import { makeErrnoError } from '../../shared/__tests__/helpers/errnoError';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { assertWritesAreSafe } from '../assertWrites';

describe('assertWritesAreSafe: a stat that cannot be answered', () => {
  const directory = useTempDirectory('keewano-codegen-writes-stat-');

  const definitionsFile = (): string => join(directory(), DEFINITIONS_FILE_NAME);
  const writes = (): { flag: string; path: string }[] => [
    { flag: '--code', path: join(directory(), 'out.ts') },
  ];

  it('says nothing when the planned path simply is not there', () => {
    expect(() => {
      assertWritesAreSafe({ writes: writes(), definitionsFile: definitionsFile() });
    }).not.toThrow();
  });

  it('surfaces a permission failure instead of falling back to path strings', () => {
    /**
     * Answering "no identity" on EACCES drops the comparison to resolved
     * paths, which is exactly what a hard link or a case-variant name defeats.
     * The run would then overwrite the definitions and report success.
     */
    const realStat = fs.statSync;
    const stat = jest.spyOn(fs, 'statSync').mockImplementation((...args) => {
      if (String(args[0]).endsWith('out.ts')) throw makeErrnoError('EACCES');
      return realStat(...args);
    });

    expect(() => {
      assertWritesAreSafe({ writes: writes(), definitionsFile: definitionsFile() });
    }).toThrow(/EACCES/);

    stat.mockRestore();
  });
});
