/**
 * What `add` refuses, and that a refusal leaves the file as it was. Each
 * of these is a definition the next generate would have rejected, or a
 * flag the command does not have; either way nothing is written.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
  writeLegacyEventFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-add-refusals-');
const file = (): string => definitionsFileIn(directory());
const text = (): string => readFileSync(file(), 'utf8');

describe('cli.run: add refusals', () => {
  it('refuses a name the set already has, and leaves the file as it was', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const before = text();
    const { exit, stderr } = await runCli(['add', 'Tap', '--type', 'none', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/"Tap" is already defined/);
    expect(text()).toBe(before);
  });

  it('refuses a name that would shadow a built-in report method', async () => {
    const { exit, stderr } = await runCli([
      'add',
      'ButtonClick',
      '--type',
      'none',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/reserved name/);
    expect(existsSync(file())).toBe(false);
  });

  /**
   * The two names differ, so the duplicate check passes them both. They
   * only merge once a target lowercases and joins them, and the event
   * that lost would then be reported under its neighbour's name.
   */
  it('refuses a name that collides only after a target transforms it', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'LevelUp', type: 0 }] });
    const { exit, stderr } = await runCli(['add', 'Level_Up', '--type', 'none', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/both emit report_level_up/);
  });

  it('refuses a payload type it does not have', async () => {
    const { exit, stderr } = await runCli(['add', 'Tap', '--type', 'float', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--type must be one of/);
  });

  it('refuses --id: an id is a position, not a number anyone chooses', async () => {
    const { exit, stderr } = await runCli(['add', 'Tap', '--type', 'none', '--id', '2600']);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/add does not take "--id"/);
  });

  it('refuses a flag that belongs to the generate path', async () => {
    const { exit, stderr } = await runCli(['add', 'Tap', '--type', 'none', '--target', 'swift']);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/add does not take "--target"/);
  });

  /**
   * The usage page belongs to a run rejected before it started. A
   * command that got past argv fails over the definitions themselves,
   * and forty lines of usage bury the one line that names the file.
   */
  it('does not print the usage page over a definitions error', async () => {
    writeFileSync(file(), '{not json', 'utf8');
    const { exit, stderr } = await runCli(['add', 'Fresh', '--type', 'none', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/keewano\.events\.json/);
    expect(stderr).not.toMatch(/Usage: keewano-codegen/);
  });

  it('refuses the old per-event directory and prints the file it should become', async () => {
    /** A directory at --input is the layout this tool used to read; the reader needs the file, not a JSON error. */
    const legacy = join(directory(), 'keewano-custom-events');
    mkdirSync(legacy);
    writeLegacyEventFile({ directory: legacy, name: 'Tap', body: { id: 2500, n: 'Tap', t: 0 } });
    const { exit, stderr } = await runCli(['add', 'Swipe', '--type', 'none', '--input', legacy]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/a directory/);
    expect(stderr).toContain('"eventName": "Tap"');
  });

  it('refuses a definitions path in a directory that does not exist, creating nothing', async () => {
    /**
     * The write would create the directory as well, and a mistyped
     * --input would then fork the definitions into a folder nothing
     * reads, with exit 0 and a success line.
     */
    const elsewhere = join(directory(), 'evnts', 'keewano.events.json');
    const { exit, stderr } = await runCli(['add', 'Tap', '--type', 'none', '--input', elsewhere]);
    expect(exit).toBe(EXIT_CODES.IO);
    expect(stderr).toMatch(/directory not found/);
    expect(existsSync(join(directory(), 'evnts'))).toBe(false);
  });
});
