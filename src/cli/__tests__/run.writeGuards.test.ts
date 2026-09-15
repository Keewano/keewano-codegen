/**
 * Which paths a run refuses to write onto, because they are the
 * definitions file. Every one of these ends the same way if it is
 * missed: the definitions are replaced by generated text, the run
 * reports success, and the next run fails on the JSON it destroyed.
 * The refusals are checked through the real CLI, because the order they
 * fire in is part of what a user sees.
 */

import { linkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { writeDefinitionsFile } from '../../events/__tests__/helpers/definitionsFile';
import { DEFINITIONS_FILE_NAME } from '../../events/definitionsDocument';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-write-guards-');

/** A definitions file under any name a run might write, with one event to prove it was read. */
const definitionsNamed = (name: string): string => {
  const file = join(directory(), name);
  writeDefinitionsFile({ file, events: [{ name: 'Alpha', type: 0 }] });
  return file;
};

describe('cli.run write guards', () => {
  it('refuses a generated file that would land on the definitions file', async () => {
    /** `--input` may name the file anything, including the name the target gives its output. */
    const file = definitionsNamed('keewano-events.generated.ts');
    const before = readFileSync(file, 'utf8');

    const { exit, stderr } = await runCli([
      '--input',
      file,
      '--code',
      directory(),
      '--target',
      'web',
    ]);

    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--code is the definitions file/);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('refuses a manifest that would land on the definitions file', async () => {
    /** The manifest is a `.json` beside the generated file - one character away from the definitions. */
    const file = definitionsNamed('keewano-events.json');
    const before = readFileSync(file, 'utf8');

    const { exit, stderr } = await runCli(['--input', file, '--code', directory(), '--json']);

    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--json is the definitions file/);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('refuses an asset that would land on the definitions file', async () => {
    const file = definitionsNamed('keewano_custom_events.json');
    const before = readFileSync(file, 'utf8');

    const { exit, stderr } = await runCli([
      '--input',
      file,
      '--target',
      'kotlin',
      '--code',
      directory(),
      '--asset',
      directory(),
    ]);

    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--asset is the definitions file/);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('refuses a generated file that reaches the definitions under another name', async () => {
    /**
     * The guard used to compare resolved strings, which two names for
     * one file walk straight past: a hard link here, and on Windows or
     * macOS the same name spelled with different case. The run then
     * reported success while the definitions were replaced by generated
     * source - and the next run failed on the JSON it had destroyed.
     */
    const file = definitionsNamed(DEFINITIONS_FILE_NAME);
    const before = readFileSync(file, 'utf8');
    linkSync(file, join(directory(), 'keewano-events.generated.ts'));

    const { exit, stderr } = await runCli([
      '--input',
      file,
      '--code',
      directory(),
      '--target',
      'web',
    ]);

    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--code is the definitions file/);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});
