/**
 * What the CLI does with input it cannot use. Each of these is a promise
 * to a CI script, which branches on the exit code and reads the one line
 * on stderr to know what to change.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
  writeLegacyEventFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-input-failures-');
const file = (): string => definitionsFileIn(directory());
const code = (): string => join(directory(), 'gen');

describe('cli.run: input it cannot use', () => {
  it('exits with VALIDATION on an unknown --target', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const { exit, stderr } = await runCli([
      '--input',
      file(),
      '--code',
      code(),
      '--target',
      'flutter',
    ]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--target must be/);
  });

  it('exits with VALIDATION when the definitions file is malformed', async () => {
    writeFileSync(file(), '{not json', 'utf8');
    const { exit, stderr } = await runCli(['--input', file(), '--code', code()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/keewano\.events\.json.*malformed JSON/);
  });

  it('exits with VALIDATION when an event name fails the pattern', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'lowercase', type: 0 }] });
    const { exit, stderr } = await runCli(['--input', file(), '--code', code()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/must match pattern/);
  });

  it('exits with IO when the definitions file does not exist', async () => {
    const { exit, stderr } = await runCli(['--input', file(), '--code', code()]);
    expect(exit).toBe(EXIT_CODES.IO);
    expect(stderr).toMatch(/not found/);
  });

  it('refuses a directory at --input and prints the file it should become, without the usage page', async () => {
    /**
     * A directory is the layout this tool used to read, one file per
     * event. The reader who still has one needs the file it became, not
     * a JSON error and not forty lines of usage under it.
     */
    const legacy = join(directory(), 'keewano-custom-events');
    mkdirSync(legacy);
    writeLegacyEventFile({ directory: legacy, name: 'Tap', body: { id: 2500, n: 'Tap', t: 2 } });
    const { exit, stderr } = await runCli(['--input', legacy, '--code', code()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/a directory/);
    expect(stderr).toContain('"eventName": "Tap"');
    expect(stderr).toContain('"eventValueType": "uint"');
    expect(stderr).not.toMatch(/Usage:/);
  });
});
