/**
 * The settings file as one run sees it: what it supplies, what a typed
 * flag overrides in either direction, and what an unreadable or absent
 * one does. Parsing the file is settings.test.ts; this is the run around
 * it, plus the one thing only a real path can show - that the manifest
 * follows a linked generated file to where the write lands.
 */

import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_TARGET, generatedFileNameFor } from '../../emitters/registry';
import {
  DEFINITIONS_FILE_NAME,
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { describeWithSymlinks } from '../../shared/__tests__/helpers/platform';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { CLI_DEFAULTS } from '../defaults';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const GENERATED = generatedFileNameFor(DEFAULT_TARGET);

describe('cli.run: settings file', () => {
  const directory = useTempDirectory('keewano-codegen-settings-');
  const file = (): string => definitionsFileIn(directory());

  it('exits with VALIDATION when an explicitly named --config file does not exist', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const missing = join(directory(), 'prod.codegen.json');
    const { exit, stderr } = await runCli([
      '--input',
      file(),
      '--code',
      directory(),
      '--config',
      missing,
    ]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--config .*prod\.codegen\.json not found/);
    expect(existsSync(join(directory(), GENERATED))).toBe(false);
  });

  it('reads the settings file named by --config, resolving its paths against itself', async () => {
    const events = mkdir(join(directory(), 'events'));
    writeDefinitionsFile({
      file: join(events, DEFINITIONS_FILE_NAME),
      events: [{ name: 'Tap', type: 0 }],
    });
    const configPath = join(directory(), 'settings.json');
    writeFileSync(
      configPath,
      JSON.stringify({ input: `events/${DEFINITIONS_FILE_NAME}`, code: 'out' }),
    );
    const { exit } = await runCli(['--config', configPath]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(existsSync(join(directory(), 'out', GENERATED))).toBe(true);
  });

  it('lets --no-json switch off a manifest the settings file asked for', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    writeFileSync(
      join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME),
      JSON.stringify({ input: DEFINITIONS_FILE_NAME, code: 'out', json: true }),
    );
    const { exit } = await runCli(['--no-json']);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(existsSync(join(directory(), 'out', GENERATED))).toBe(true);
    expect(existsSync(join(directory(), 'out', CLI_DEFAULTS.MANIFEST_FILE_NAME))).toBe(false);
  });

  it('refuses the "output" key by name, pointing at the one that replaced it', async () => {
    /** Every earlier settings file carried it; refused as unknown, the reader would look for a typo. */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    writeFileSync(
      join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME),
      JSON.stringify({ output: 'gen.ts' }),
    );
    const { exit, stderr } = await runCli(['--code', directory()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/"output" was replaced by "code"/);
  });

  it('prints --help even when the settings file in cwd is broken', async () => {
    writeFileSync(join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME), '{ broken');
    const { exit, stdout } = await runCli(['--help']);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/Usage: keewano-codegen/);
  });

  it('reports an unreadable settings file as IO, without the usage block', async () => {
    /** A directory where the file should be: EISDIR on read, not a usage mistake. */
    const configPath = join(directory(), 'settings.json');
    mkdir(configPath);
    const { exit, stderr } = await runCli(['--config', configPath]);
    expect(exit).toBe(EXIT_CODES.IO);
    expect(stderr).toMatch(/cannot read file/);
    expect(stderr).not.toMatch(/Usage:/);
  });
});

function mkdir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

describeWithSymlinks('the generated file is a link', () => {
  const directory = useTempDirectory('keewano-codegen-linked-out-');

  it('puts the manifest beside the file the write lands on, not beside the link', async () => {
    /**
     * The write follows the link, so deriving the manifest directory from
     * the link put the two artifacts of one run in two directories: the
     * module in the target folder, the manifest describing it next door.
     * Skipped where a link cannot be made; the CI runner can, and the
     * platform probe fails the build if it ever cannot.
     */
    const linkDirectory = mkdir(join(directory(), 'link-side'));
    const realDirectory = mkdir(join(directory(), 'real-side'));
    const file = definitionsFileIn(directory());
    writeDefinitionsFile({ file, events: [{ name: 'Tap', type: 1 }] });

    const target = join(realDirectory, GENERATED);
    writeFileSync(target, '', 'utf8');
    symlinkSync(target, join(linkDirectory, GENERATED), 'file');

    const { exit } = await runCli(['--input', file, '--code', linkDirectory, '--json']);

    expect(exit).toBe(EXIT_CODES.OK);
    expect(existsSync(join(realDirectory, CLI_DEFAULTS.MANIFEST_FILE_NAME))).toBe(true);
    expect(existsSync(join(linkDirectory, CLI_DEFAULTS.MANIFEST_FILE_NAME))).toBe(false);
  });
});
