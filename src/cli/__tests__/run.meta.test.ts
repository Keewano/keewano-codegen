/**
 * Meta-flag tests (`--version`, unknown options, blank values). The
 * usage page's content is `run.usage.test.ts`; end-to-end tests against
 * a real definitions file live in `run.e2e.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { DEFAULT_TARGET, generatedFileNameFor } from '../../emitters/registry';
import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

/**
 * Resolves to `<pkg>/package.json` from this test file's location so
 * the `--version` assertion compares against the live source of truth
 * instead of a hard-coded string the CI version bump would invalidate.
 */
const PACKAGE_VERSION = (
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

describe('cli.run: meta flags', () => {
  const workDirectory = useTempDirectory('keewano-codegen-meta-');

  it('prints a version string and exits 0 on --version', async () => {
    const { exit, stdout } = await runCli(['--version']);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout.trim().split('.')).toHaveLength(3);
  });

  it('--version reports this package, from the source layout as well as the built one', async () => {
    /**
     * In the source layout the first candidate path is the directory
     * above the repository; a package.json there must not be mistaken
     * for ours. Asserting against the live manifest catches both a
     * foreign version and a fallback to the unknown-version string.
     */
    const { exit, stdout } = await runCli(['--version']);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout.trim()).toBe(PACKAGE_VERSION);
  });

  it('exits with VALIDATION on an unknown option and prints the usage block', async () => {
    const { exit, stderr } = await runCli(['--noSuchFlag']);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/unknown option "--noSuchFlag"/);
    expect(stderr).toMatch(/Usage: keewano-codegen/);
  });

  it('exits with VALIDATION when a value-flag (--input) is followed by another flag', async () => {
    const { exit, stderr } = await runCli(['--input', '--watch']);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--input requires a value/);
  });

  it.each(['--input', '--code', '--asset', '--config'])(
    'exits with VALIDATION when %s is given a blank value',
    async (flag) => {
      /**
       * `--input "$EVENTS_FILE"` with the variable unset arrives as an
       * empty string. Resolved, it is the current directory: the run
       * would refuse it as a directory, or for `--code` write the file
       * wherever the shell happened to be.
       */
      const { exit, stderr } = await runCli([flag, '']);
      expect(exit).toBe(EXIT_CODES.VALIDATION);
      expect(stderr).toMatch(new RegExp(`${flag} requires a value`));
    },
  );

  it('uses an absolute --input path as given', async () => {
    const directory = workDirectory();
    expect(isAbsolute(directory)).toBe(true);
    const file = definitionsFileIn(directory);
    writeDefinitionsFile({ file, events: [{ name: 'Tap', type: 0 }] });
    const code = join(directory, 'gen');
    const { exit } = await runCli(['--input', file, '--code', code]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(readFileSync(join(code, generatedFileNameFor(DEFAULT_TARGET)), 'utf8')).toMatch(
      /reportTap/,
    );
  });

  /**
   * A first token that reads as a command but names none used to reach the
   * generate parser, which can only see flags - so a mistyped command came
   * back as an unknown option and sent the reader hunting for a flag.
   */
  it('names a mistyped command as a command, not as an option', async () => {
    const { exit, stderr } = await runCli(['frobnicate']);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/unknown command "frobnicate"/);
    expect(stderr).not.toMatch(/unknown option/);
  });
});
