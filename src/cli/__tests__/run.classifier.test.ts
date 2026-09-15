/**
 * Which code each thrown shape becomes. A CI script branches on these
 * numbers, so every mapping here is a promise rather than an
 * implementation detail: a write the OS refuses is I/O, an unreadable
 * existing output is I/O, a throw the classifier does not recognise is
 * internal. Which paths a run refuses to write is its own file,
 * `run.writeGuards.test.ts`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_TARGET, generatedFileNameFor } from '../../emitters/registry';
import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { mockReadFailure } from '../../shared/__tests__/helpers/readFailure';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-classifier-');
const file = (): string => definitionsFileIn(directory());

describe('cli.run exit-code classifier', () => {
  it('exits IO when the generated file is a directory (write refused by the OS)', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    /** A directory under the name the generator gives the file, so the write is what fails. */
    const code = join(directory(), 'gen');
    mkdirSync(join(code, generatedFileNameFor(DEFAULT_TARGET)), { recursive: true });
    const { exit, stderr } = await runCli(['--input', file(), '--code', code]);
    expect(exit).toBe(EXIT_CODES.IO);
    expect(stderr).toMatch(/EISDIR|illegal operation on a directory/);
  });

  it('exits IO when the existing generated file cannot be read', async () => {
    /**
     * The idempotency check reads the previous output first; a
     * permission failure there must surface as IO, not be mistaken
     * for "no file yet" and silently overwritten. The failure is
     * injected rather than produced with chmod: chmod is advisory on
     * Windows and ignored for root, which is what a container runner is.
     */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const outputPath = join(directory(), generatedFileNameFor(DEFAULT_TARGET));
    writeFileSync(outputPath, 'stale');
    const spy = mockReadFailure({
      pathSuffix: generatedFileNameFor(DEFAULT_TARGET),
      code: 'EACCES',
    });
    try {
      const { exit, stderr } = await runCli(['--input', file(), '--code', directory()]);
      expect(exit).toBe(EXIT_CODES.IO);
      expect(stderr).toMatch(/EACCES/);
    } finally {
      spy.mockRestore();
    }
    expect(readFileSync(outputPath, 'utf8')).toBe('stale');
  });

  it('exits INTERNAL on a throw the classifier does not recognize', async () => {
    /**
     * A generator bug (a plain TypeError, no errno, not one of our
     * typed errors) must not masquerade as a user-fixable VALIDATION
     * or IO failure - INTERNAL is the honest code.
     */
    jest.resetModules();
    jest.doMock('../../events/parseEventDefinitions', () => ({
      parseEventDefinitions: () => {
        throw new TypeError('generator bug');
      },
    }));
    const { runCli: runIsolated } =
      require('./helpers/runCli') as typeof import('./helpers/runCli');
    try {
      const { exit, stderr } = await runIsolated(['--input', file(), '--code', directory()]);
      expect(exit).toBe(EXIT_CODES.INTERNAL);
      expect(stderr).toMatch(/generator bug/);
    } finally {
      jest.dontMock('../../events/parseEventDefinitions');
      jest.resetModules();
    }
  });
});
