/**
 * The bin shim against a working install: the exit code the OS reports
 * for each documented outcome, and that the line saying what happened
 * survives the exit. Both are the shim's whole job, and an in-process
 * test can see neither.
 */

import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { buildIfMissing, runShim } from './helpers/shim';

describe('the bin shim', () => {
  const directory = useTempDirectory('keewano-codegen-shim-');

  beforeAll(buildIfMissing);

  const withOneEvent = (): string => {
    const file = definitionsFileIn(directory());
    writeDefinitionsFile({ file, events: [{ name: 'Alpha', type: 0 }] });
    return file;
  };

  it('reports the success code and prints what it wrote', () => {
    const { status, stdout } = runShim([
      '--input',
      withOneEvent(),
      '--code',
      join(directory(), 'out'),
      '--target',
      'web',
    ]);

    expect(status).toBe(EXIT_CODES.OK);
    /**
     * The output matters as much as the code: a shim that exits before
     * the pipe drains reports the right number and swallows the line
     * that says what happened, which on POSIX is what a CI runner sees.
     */
    expect(stdout).toContain('(1 events)');
  });

  it('reports the validation code for input the parser refuses', () => {
    const { status, stderr } = runShim(['--target', 'flutter']);

    expect(status).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toContain('--target must be one of');
  });

  it('reports the I/O code for a definitions file that is not there', () => {
    const { status, stderr } = runShim([
      '--input',
      join(directory(), 'absent.json'),
      '--code',
      join(directory(), 'out'),
      '--target',
      'web',
    ]);

    expect(status).toBe(EXIT_CODES.IO);
    expect(stderr).toContain('not found');
  });
});
